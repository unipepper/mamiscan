import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * POST /api/analyze/rescan
 *
 * 유저가 오류 제보 시 올바른 제품명을 입력하면 Google Search grounding으로 재분석.
 * catalog 갱신은 유저가 "해결됐어요" 확인 후 /api/support/confirm-rescan에서만 처리.
 *
 * Body: { productName: string, barcode?: string }
 * Response: { success: true, result: { status, productName, headline, description, ingredients, weekAnalysis } }
 */
export async function POST(req: Request) {
  let body: { productName?: string; scanHistoryId?: number; barcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const productName = body.productName?.trim();
  if (!productName) {
    return NextResponse.json({ error: 'product_name_required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 임신 주차 조회
  let pregnancyWeeks: number | null = null;
  if (user) {
    const { data: prof } = await supabase
      .from('users')
      .select('pregnancy_weeks, pregnancy_start_date')
      .eq('id', user.id)
      .single();
    if (prof?.pregnancy_weeks) {
      pregnancyWeeks = prof.pregnancy_weeks;
    } else if (prof?.pregnancy_start_date) {
      const start = new Date(prof.pregnancy_start_date);
      const diffDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
      const week = Math.floor(diffDays / 7) + 1;
      pregnancyWeeks = week >= 1 && week <= 42 ? week : null;
    }
  }

  const weekInstruction = pregnancyWeeks
    ? `현재 사용자는 임신 ${pregnancyWeeks}주차입니다. description은 왜 주의/위험/안전한지 결론 한 줄로 작성하고, weekAnalysis에는 위험 이유 재설명 없이 "${pregnancyWeeks}주차에 얼마나/어떻게/대신 무엇을" 같은 실천 가능한 행동 지침만 2문장 이내로 작성해줘.`
    : '일반적인 임산부 기준으로 weekAnalysis에 실천 가능한 섭취 행동 지침만 2문장 이내로 작성해줘.';

  const prompt = `"${productName}" 식품의 임산부 안전성을 분석해줘.

★반드시 Google Search로 이 제품의 공식 홈페이지, 식약처 식품DB, 쿠팡/네이버쇼핑 상세페이지 등에서 실제 원재료명을 먼저 검색해줘.★

검색으로 원재료를 확인한 경우: 확인된 원재료만 기반으로 정확하게 판정해줘.
검색으로 원재료를 확인하지 못한 경우: 추론하지 말고 status를 "success"로 두고 description에 "원재료를 확인하지 못해 정밀 분석이 어렵습니다"라고 명시해줘. 불확실한 성분은 ingredients에 넣지 마.

status는 "success", "caution", "danger" 중 하나.

★판정 기준★
- caution/danger는 의학적으로 실질적 위험이 있는 성분에만 부여.
- 설탕, 나트륨, 구연산, 향료, 유화제 등 보편적 가공식품 성분은 success.
- caution: 카페인(음료), 액상과당, 아질산나트륨, 아스파탐·사카린, 타르색소, 경화유.
- danger: 알코올·에탄올, 황새치·상어·삼치·옥돔, 비살균 원유, 육회·생햄, 날달걀, 쑥추출물·당귀·홍화.
- 인공감미료(에리스리톨, 수크랄로스, 스테비아)는 식약처 허용 성분으로 success 처리.
★카페인 규칙★: 커피·녹차·홍차·에너지드링크 등 카페인 함유 음료는 반드시 caution 이상.
★날생선 규칙★: 날생선·날해산물 포함 시 반드시 danger.

${weekInstruction}

다음 JSON 형식으로 응답해줘:
{
  "status": "success" | "caution" | "danger",
  "productName": "정확한 한국어 제품명 (브랜드 포함)",
  "headline": "요약 헤드라인 (주의/위험 성분명 직접 언급 금지)",
  "description": "임산부에게 왜 안전/주의/위험한지 1~2문장. 확인된 성분명·수치 직접 언급. 행동 지침은 weekAnalysis에서 다룸.",
  "ingredients": [{ "name": "성분명", "status": "success"|"caution"|"danger", "reason": "구체적 설명" }],
  "weekAnalysis": "임신 주차 맞춤 행동 지침"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const raw = response.text?.trim() ?? '';
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
    const parsed = JSON.parse(jsonMatch?.[1] ?? jsonMatch?.[0] ?? '{}') as {
      status: 'success' | 'caution' | 'danger';
      productName: string;
      headline: string;
      description: string;
      ingredients: { name: string; status: string; reason: string }[];
      weekAnalysis: string;
    };

    if (!parsed.status) throw new Error('Gemini returned invalid response');

    // catalog 갱신은 유저 확인(confirm-rescan) 후에만 처리
    return NextResponse.json({ success: true, result: parsed });
  } catch (err) {
    console.error('[analyze/rescan] error:', err);
    return NextResponse.json({ error: 'analysis_failed' }, { status: 500 });
  }
}
