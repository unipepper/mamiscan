import { GoogleGenAI, Type } from '@google/genai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    diagnosis: { type: Type.STRING },
    evidence: { type: Type.STRING },
    confidence: { type: Type.STRING },
    correction_type: { type: Type.STRING },
    suggested_changes: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        status: { type: Type.STRING },
        headline: { type: Type.STRING },
        description: { type: Type.STRING },
        ingredients: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              status: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ['name', 'status', 'reason'],
          },
        },
      },
    },
  },
  required: ['diagnosis', 'evidence', 'confidence', 'correction_type'],
};

function buildPrompt(params: {
  reportBody: string;
  productName: string;
  productStatus: string;
  ingredients: unknown;
  rawIngredients?: string | null;
}): string {
  const { reportBody, productName, productStatus, ingredients, rawIngredients } = params;

  const statusLabel: Record<string, string> = {
    success: '안전 (먹어도 됩니다)',
    caution: '주의 (적당히 섭취 가능)',
    danger: '위험 (섭취 자제 권장)',
  };

  const lines = [
    '당신은 임신부 식품 스캐너 앱의 분석 품질 담당자입니다.',
    '유저 오류 제보를 읽고, 실제 DB 데이터와 비교해 수정이 필요한지 판단하세요.',
    '',
    '[유저 제보]',
    reportBody,
    '',
    '[앱이 보여준 결과]',
    `제품명: ${productName}`,
    `판정: ${statusLabel[productStatus] ?? productStatus}`,
    `성분 분석: ${JSON.stringify(ingredients, null, 2)}`,
  ];

  if (rawIngredients) {
    lines.push(
      '',
      '[원재료명 원본 (공공데이터 식품안전처 API)]',
      rawIngredients,
    );
  }

  lines.push(
    '',
    '---',
    '',
    '다음 JSON 스키마에 맞게 출력하세요:',
    '- diagnosis: 한 문장 진단 (무엇이 문제인지)',
    '- evidence: 판단 근거 (구체적인 데이터 인용)',
    '- confidence: "high" | "medium" | "low" | "unclear"',
    '  · high: 데이터로 명확히 확인 가능한 오류',
    '  · medium: 개연성은 있지만 확신 불가',
    '  · low: 가능성은 낮으나 배제 불가',
    '  · unclear: 제보 내용이 불명확하거나 판단 불가',
    '- correction_type: 아래 중 하나',
    '  · "status_change": 판정(safe/caution/danger)이 잘못됨',
    '  · "ingredient_correction": 특정 성분 분석이 잘못됨',
    '  · "product_name": 제품명이 잘못됨',
    '  · "unverifiable": 오류는 있을 수 있으나 데이터로 검증 불가',
    '  · "user_error": 유저의 오해이며 앱 결과가 정확함',
    '- suggested_changes: correction_type이 "user_error" 또는 "unverifiable"이면 null,',
    '  그 외에는 변경되어야 할 필드만 포함 (status, headline, description, ingredients 중 해당하는 것)',
    '',
    '주의: 수정 제안은 임신 중 식품 안전성 기준(CDC/FDA/NHS/ACOG/MFDS)을 따르세요.',
    '확실하지 않으면 more conservative(더 주의하는 방향)으로 판단하세요.',
  );

  return lines.join('\n');
}

/** service_role 클라이언트 (백그라운드 함수용, 쿠키 불필요) */
function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
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
      ai_status: 'analyzed',
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
 * 오류 제보 AI 분석 실행 및 결과 저장
 * after()로 백그라운드 실행 — 실패해도 유저 응답에 영향 없음
 */
export async function analyzeErrorReport(reportId: number): Promise<void> {
  const supabase = createAdminClient();

  try {
    // 1. 제보 + 연결된 스캔 이력 조회
    const { data: report, error: reportErr } = await supabase
      .from('scan_error_reports')
      .select(`
        id,
        body,
        scan_history_id,
        scan_history (
          id,
          product_name,
          status,
          result_json
        )
      `)
      .eq('id', reportId)
      .single();

    if (reportErr || !report) {
      console.error('[error-report-analyzer] report fetch failed', reportErr);
      return;
    }

    const scanHistory = Array.isArray(report.scan_history)
      ? report.scan_history[0]
      : report.scan_history;

    if (!scanHistory) {
      await saveFailure(supabase, reportId, '스캔 이력 정보가 없어 분석할 수 없습니다.', 'scan_history_id 누락');
      return;
    }

    const resultJson = scanHistory.result_json as Record<string, unknown>;
    const productName: string = scanHistory.product_name;
    const productStatus: string = scanHistory.status;
    const ingredients = resultJson?.ingredients ?? [];

    // 2. products 캐시에서 현재 저장된 분석 결과 조회
    //    detectedBarcode가 있으면 barcode: 키, 없으면 product: 키로 조회
    const detectedBarcode = resultJson?.detectedBarcode as string | undefined;
    let productRecord: { status: string; result_json: unknown } | null = null;

    if (detectedBarcode) {
      const cacheKey = `barcode:${detectedBarcode}`;
      const { data } = await supabase
        .from('products')
        .select('status, result_json')
        .eq('cache_key', cacheKey)
        .maybeSingle();
      productRecord = data;
    }

    if (!productRecord) {
      // product: 키 또는 product_name으로 fallback 조회
      const normalized = productName.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
      const { data } = await supabase
        .from('products')
        .select('status, result_json')
        .eq('cache_key', `product:${normalized}`)
        .maybeSingle();
      productRecord = data;
    }

    // 3. 바코드 스캔이면 barcode_items에서 원재료명 원본 조회
    let rawIngredients: string | null = null;
    if (detectedBarcode) {
      const { data: barcodeItem } = await supabase
        .from('barcode_items')
        .select('ingredients')
        .eq('barcode', detectedBarcode)
        .maybeSingle();
      rawIngredients = barcodeItem?.ingredients ?? null;
    }

    // 분석 기준: products 캐시 있으면 그것 사용, 없으면 scan_history 데이터 사용
    const analysisStatus = productRecord?.status ?? productStatus;
    const analysisIngredients =
      (productRecord?.result_json as Record<string, unknown>)?.ingredients ?? ingredients;

    // 4. Gemini 2.5 Flash 분석
    const prompt = buildPrompt({
      reportBody: report.body,
      productName,
      productStatus: analysisStatus,
      ingredients: analysisIngredients,
      rawIngredients,
    });

    const geminiResponse = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: ANALYSIS_SCHEMA,
        },
      })
    );

    const raw = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = JSON.parse(raw) as {
      diagnosis: string;
      evidence: string;
      confidence: 'high' | 'medium' | 'low' | 'unclear';
      correction_type: 'status_change' | 'ingredient_correction' | 'product_name' | 'unverifiable' | 'user_error';
      suggested_changes: Record<string, unknown> | null;
    };

    // 5. 분석 결과 저장
    const { error: updateErr } = await supabase
      .from('scan_error_reports')
      .update({
        ai_status: 'analyzed',
        ai_analysis: {
          diagnosis: parsed.diagnosis,
          evidence: parsed.evidence,
          suggested_changes: parsed.suggested_changes ?? null,
        },
        ai_confidence: parsed.confidence,
        correction_type: parsed.correction_type,
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (updateErr) {
      console.error('[error-report-analyzer] update failed', updateErr);
    }
  } catch (err) {
    console.error('[error-report-analyzer] unexpected error', err);
    await saveFailure(supabase, reportId, 'AI 분석 중 오류가 발생했습니다.', String(err));
  }
}
