import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function POST(request: NextRequest) {
  try {
    const { phone, countryCode } = await request.json();
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const prompt = `Analyze this phone number from a real estate CRM in Pakistan/UAE:
Phone: "${phone}"
Country Code setting: ${countryCode || '+92'}

Explain in 1-2 short sentences in simple Urdu/English mixed:
1. What's wrong with this number (format, missing digits, corruption etc.)
2. What the correct format should be

Keep it short and actionable. Example responses:
- "Ye number 10 digits ka hai lekin 03 se start hona chahiye. Correct format: +92300XXXXXXX"
- "Number mein spaces hain. Correct format: +923004010710"
- "Ye Excel scientific notation hai, asli number khoy gaya. Original source check karein"
- "Number mein country code missing hai. Should be +97150XXXXXXX for UAE"

Response should be max 2 lines.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ analysis: text });
  } catch (error) {
    console.error('Phone analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
