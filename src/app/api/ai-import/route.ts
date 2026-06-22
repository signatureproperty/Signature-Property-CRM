import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];

async function tryGenerate(prompt: string) {
  let lastError: any;
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result;
    } catch (e: any) {
      lastError = e;
      const msg = e?.message || '';
      if (!msg.includes('not found') && !msg.includes('not supported') && !msg.includes('not available') && !msg.includes('404')) {
        throw e;
      }
    }
  }
  throw lastError;
}

export async function POST(request: NextRequest) {
  const { csvText, importType } = await request.json();
  if (!csvText) {
    return NextResponse.json({ error: 'CSV data is required' }, { status: 400 });
  }

  // Truncate huge CSVs to prevent timeout
  const maxLen = 40000;
  const truncated = csvText.length > maxLen ? csvText.substring(0, maxLen) + '\n... [truncated]' : csvText;

  const type = importType === 'buyers' ? 'Buyers/Leads' : 'Properties';

  const prompt = `You are a data cleaning assistant for a real estate CRM. Clean and normalize the following CSV data for ${type}.

Rules:
1. Fix phone numbers: remove spaces, dashes. Add +92 for Pakistan numbers (10 digits starting with 3), +971 for UAE (9 digits starting with 5/50), +1 for US (11 digits starting with 1), +44 for UK (12 digits starting with 44).
2. Fix Excel scientific notation (e.g. 4.47878E+11 → try to recover the number, or mark as "CORRUPTED").
3. Fix Excel ="..." format (remove = and quotes).
4. If a row has ONLY a phone number with no other data, still keep it as a valid entry.
5. Standardize column headers to match these exact names:
    ${type === 'Buyers/Leads' 
      ? 'serial, name, phone, email, status, listing, area, propType, minB, maxB, notes'
      : 'serial, video_recorded, date, number, city, area, address, property_type, size, storey, utilities, status, road_size, potential_rent, front, length, demand, documents'}
6. Return ONLY valid JSON array of objects. No markdown, no explanation.
7. Keep all original data - do not drop rows.

CSV DATA:
\`\`\`
${truncated}
\`\`\`

Return JSON array only.`;

  // Retry up to 3 times with exponential backoff for rate limits
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await tryGenerate(prompt);
      const text = result.response.text();
      
      let jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const start = jsonStr.indexOf('[');
      const end = jsonStr.lastIndexOf(']');
      if (start !== -1 && end !== -1) {
        jsonStr = jsonStr.substring(start, end + 1);
      }

      const data = JSON.parse(jsonStr);
      return NextResponse.json({ data, count: Array.isArray(data) ? data.length : 0 });
    } catch (error: any) {
      console.error(`AI Import attempt ${attempt} error:`, error?.message || error);
      const msg = error?.message || 'AI processing failed';
      
      if ((msg.includes('quota') || msg.includes('rate') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) && attempt < 3) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      if ((msg.includes('quota') || msg.includes('rate') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED'))) {
        return NextResponse.json({ error: 'API rate limit reached. Please wait 30 seconds and try again, or upgrade your Gemini API key for higher limits.' }, { status: 429 });
      }
      if (msg.includes('SAFETY') || msg.includes('safety')) {
        return NextResponse.json({ error: 'AI blocked the content for safety. Check your CSV data.' }, { status: 422 });
      }
      return NextResponse.json({ error: msg.length > 200 ? msg.substring(0, 200) : msg }, { status: 500 });
    }
  }
}
