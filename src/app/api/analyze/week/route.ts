import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: Request) {
  try {
    const { productName, pregnancyWeeks } = await req.json();
    if (!productName || !pregnancyWeeks) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }

    const res = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [{
          text: `임신 ${pregnancyWeeks}주차 임산부가 "${productName}"을 섭취할 때 주의사항을 2-3문장으로 작성해줘. JSON: {"weekAnalysis": "..."}`,
        }],
      },
      config: { responseMimeType: 'application/json' },
    });

    const data = JSON.parse(res.text?.trim() ?? '{}');
    return NextResponse.json({ success: true, weekAnalysis: data.weekAnalysis ?? '' });
  } catch (err) {
    console.error('[analyze/week] error:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
