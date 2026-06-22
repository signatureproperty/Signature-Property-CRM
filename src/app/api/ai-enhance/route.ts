import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function POST(request: NextRequest) {
  const { cells } = await request.json();
  if (!cells || !Array.isArray(cells) || cells.length === 0) {
    return NextResponse.json({ fixes: [] });
  }

  const batchSize = 30;
  const allFixes: { row: number; field: string; corrected: string }[] = [];

  for (let i = 0; i < cells.length; i += batchSize) {
    const batch = cells.slice(i, i + batchSize);
    const prompt = `You are a data cleaning assistant for a real estate CRM. Fix the following messy cell values.

For each item, return ONLY the cleaned/normalized value. Rules:
- Phone numbers: clean spaces/dashes, format for Pakistan (+92), UAE (+971), US (+1), UK (+44)
- Sizes: if it's a range like "3 to 5 Marla" or "3-5 Marla" or "3 se 5 Marla", return "3 Marla|5 Marla" (min|max)
- Prices: if a range like "45 to 60 Lacs", return "45 Lacs|60 Lacs"; "1 Cr" → "1 Crore"; single value → just the normalized value
- Area: clean extra spaces, fix obvious typos
- If value is already fine, return it as-is
- Never drop data

Input format: JSON array of {row: number, field: string, value: string}
Output format: JSON array of {row: number, field: string, corrected: string}

Input:
${JSON.stringify(batch)}

Return JSON array only, no markdown.`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      let jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const start = jsonStr.indexOf('[');
      const end = jsonStr.lastIndexOf(']');
      if (start !== -1 && end !== -1) jsonStr = jsonStr.substring(start, end + 1);
      const fixes = JSON.parse(jsonStr);
      allFixes.push(...fixes);
    } catch {
      // If AI fails for a batch, skip it (smart parsing will handle it)
    }
  }

  return NextResponse.json({ fixes: allFixes });
}
