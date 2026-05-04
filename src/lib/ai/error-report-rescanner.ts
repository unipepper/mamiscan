import { GoogleGenAI, Type } from '@google/genai';
import { createAdminClient } from '@/lib/supabase/admin';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/** 503(UNAVAILABLE) 에러에 한해 최대 3회 지수 백오프 재시도 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is503 =
        err?.status === 503 ||
        String(err?.message ?? '').includes('503') ||
        String(err?.message ?? '').includes('UNAVAILABLE');
      if (!is503) throw err;
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}

const RESCAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING },
    headline: { type: Type.STRING },
    description: { type: Type.STRING },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name:   { type: Type.STRING },
          status: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['name', 'status', 'reason'],
      },
    },
    evidence: { type: Type.STRING },
  },
  required: ['status', 'headline', 'description', 'ingredients', 'evidence'],
};

function buildRescanPrompt(productName: string): string {
  return [
    '다음 식품 정보를 바탕으로 임산부가 섭취해도 안전한지 분석해줘.',
    '',
    `제품명: ${productName}`,
    '원재료명: 정보 없음 (제품명과 일반적인 식품 지식을 바탕으로 주요 성분을 분석해줘)',
    '',
    'status는 "success", "caution", "danger" 중 하나로 설정해줘.',
    '★출력 언어 규칙★: headline, description, ingredients의 reason, evidence 등 모든 응답 텍스트에 "추론", "추정", "추측" 등의 단어를 절대 사용하지 마.',
    '★카페인 음료 필수 규칙★: 녹차, 홍차, 우롱차, 커피, 에너지드링크 등 카페인이 함유된 음료는 카페인 함량이 낮더라도 반드시 "caution" 이상으로 분류해줘.',
    '★날생선·날해산물 필수 규칙★: 생선회, 날것의 생선, 날새우, 날굴, 스시(날것 토핑) 등 익히지 않은 생선·해산물이 포함된 경우 반드시 "danger"로 분류해줘.',
    '',
    '다음 JSON 형식으로 응답해줘:',
    '{',
    '  "status": "success" | "caution" | "danger",',
    '  "headline": "요약 헤드라인 (주의/위험 성분명 직접 언급 절대 금지)",',
    '  "description": "임산부 섭취와 관련된 전반적인 설명",',
    '  "ingredients": [{ "name": "주요 성분/특징", "status": "success" | "caution" | "danger", "reason": "이유" }],',
    '  "evidence": "분석 근거 (어떤 성분/특성 때문에 이 판정을 내렸는지)"',
    '}',
  ].join('\n');
}


async function saveFailure(
  supabase: ReturnType<typeof createAdminClient>,
  reportId: number,
  reason: string,
  detail?: string,
) {
  await supabase
    .from('scan_error_reports')
    .update({
      ai_confidence: 'unclear',
      correction_type: 'unverifiable',
      ai_analysis: {
        diagnosis: reason,
        evidence: detail ?? '',
        suggested_changes: null,
      },
      ai_analyzed_at: new Date().toISOString(),
    })
    .eq('id', reportId);
}

/**
 * 관리자가 입력한 올바른 제품명으로 Gemini 풀 재스캔 실행 후 결과 저장.
 * after()로 백그라운드 실행 — 실패해도 유저 응답에 영향 없음.
 */
export async function rescanProduct(reportId: number, productName: string): Promise<void> {
  const supabase = createAdminClient();

  try {
    // 1. scan_history 존재 여부 확인
    const { data: report, error: reportErr } = await supabase
      .from('scan_error_reports')
      .select('id, scan_history (id)')
      .eq('id', reportId)
      .single();

    if (reportErr || !report) {
      console.error('[error-report-rescanner] report fetch failed', reportErr);
      return;
    }

    const scanHistory = Array.isArray(report.scan_history)
      ? report.scan_history[0]
      : report.scan_history;

    if (!scanHistory) {
      await saveFailure(supabase, reportId, '스캔 이력 정보가 없어 재스캔할 수 없습니다.');
      return;
    }

    // 2. Gemini 재스캔 — 제품명만으로 풀 분석
    const prompt = buildRescanPrompt(productName);

    const geminiResponse = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: RESCAN_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
    );

    const raw = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = JSON.parse(raw) as {
      status: 'success' | 'caution' | 'danger';
      headline: string;
      description: string;
      ingredients: { name: string; status: string; reason: string }[];
      evidence: string;
    };

    // 3. 결과 저장 — 기존 UI(ai_analysis.suggested_changes)와 호환되는 구조로
    const { error: updateErr } = await supabase
      .from('scan_error_reports')
      .update({
        ai_analysis: {
          diagnosis: `'${productName}' 제품 재스캔 결과`,
          evidence: parsed.evidence,
          suggested_changes: {
            status:      parsed.status,
            headline:    parsed.headline,
            description: parsed.description,
            ingredients: parsed.ingredients,
          },
        },
        ai_confidence: 'high',
        correction_type: 'status_change',
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (updateErr) {
      console.error('[error-report-rescanner] update failed', updateErr);
    }
  } catch (err) {
    console.error('[error-report-rescanner] unexpected error', err);
    await saveFailure(supabase, reportId, 'AI 재스캔 중 오류가 발생했습니다.', String(err));
  }
}
