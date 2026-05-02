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
      model: 'gemini-2.5-flash',
      contents: {
        parts: [{
          text: `임신 ${pregnancyWeeks}주차 임산부가 "${productName}"을 섭취할 때 구체적인 행동 지침을 2문장 이내로 작성해줘. 위험 이유 재설명 금지 — 이미 본문에서 다뤘으니, 여기선 "얼마나 먹어도 되는지", "어떻게 먹으면 좋은지", "대신 무엇을 먹으면 좋은지" 같은 실천 가능한 조언만 써줘. 반드시 ${pregnancyWeeks}주차 시기 특성에 맞게 작성하고, 다른 시기는 언급하지 마. JSON: {"weekAnalysis": "..."}`,
        }],
      },
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    });

    const data = JSON.parse(res.text?.trim() ?? '{}');
    return NextResponse.json({ success: true, weekAnalysis: data.weekAnalysis ?? '' });
  } catch (err) {
    console.error('[analyze/week] error:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
