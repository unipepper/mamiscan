import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Vercel Pro: 최대 60초 허용 (Hobby는 10초 — Gemini 응답 시간 고려 시 Pro 권장)
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const RESCAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    status:      { type: Type.STRING },
    headline:    { type: Type.STRING },
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

function buildPrompt(productName: string): string {
  return [
    '다음 식품 정보를 바탕으로 임산부가 섭취해도 안전한지 분석해줘.',
    '',
    `제품명: ${productName}`,
    '원재료명: 정보 없음 (제품명과 일반적인 식품 지식을 바탕으로 주요 성분을 추론해서 분석해줘)',
    '',
    'status는 "success", "caution", "danger" 중 하나로 설정해줘.',
    '★카페인 음료 필수 규칙★: 녹차, 홍차, 우롱차, 커피, 에너지드링크 등 카페인 함유 음료는 반드시 "caution" 이상으로 분류해줘.',
    '★날생선·날해산물 필수 규칙★: 생선회, 날것의 생선, 날새우, 날굴, 스시(날것 토핑) 등은 반드시 "danger"로 분류해줘.',
    '',
    '다음 JSON 형식으로 응답해줘:',
    '{',
    '  "status": "success" | "caution" | "danger",',
    '  "headline": "요약 헤드라인 (주의/위험 성분명 직접 언급 절대 금지)",',
    '  "description": "임산부 섭취와 관련된 전반적인 설명",',
    '  "ingredients": [{ "name": "주요 성분/특징", "status": "success"|"caution"|"danger", "reason": "이유" }],',
    '  "evidence": "분석 근거 (어떤 성분/특성 때문에 이 판정을 내렸는지)"',
    '}',
  ].join('\n');
}

/**
 * POST /api/admin/scans/reanalyze
 *
 * 관리자가 입력한 제품명으로 Gemini 풀 스캔을 실행하고 결과를 즉시 반환합니다.
 * report_id가 제공되면 scan_error_reports.ai_analysis에도 저장합니다.
 *
 * Body:  { product_name: string, report_id?: number }
 * Response: { scan: { status, headline, description, ingredients, evidence, scanned_at } }
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { product_name?: string; report_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const productName = body.product_name?.trim();
  if (!productName) {
    return NextResponse.json({ error: 'product_name_required' }, { status: 400 });
  }

  const reportId = body.report_id ? Number(body.report_id) : null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: buildPrompt(productName) }] }],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RESCAN_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const raw = response.text?.trim() ?? '';
    if (!raw) {
      console.error('[admin/scans/reanalyze] Gemini returned empty response');
      return NextResponse.json({ error: 'gemini_empty_response' }, { status: 500 });
    }
    const parsed = JSON.parse(raw) as {
      status: 'success' | 'caution' | 'danger';
      headline: string;
      description: string;
      ingredients: { name: string; status: string; reason: string }[];
      evidence: string;
    };

    const scannedAt = new Date().toISOString();

    // report_id가 있으면 scan_error_reports.ai_analysis에도 저장
    if (reportId) {
      const supabase = createAdminClient();
      await supabase
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
          ai_analyzed_at: scannedAt,
        })
        .eq('id', reportId);
    }

    return NextResponse.json({
      scan: {
        status:      parsed.status,
        headline:    parsed.headline,
        description: parsed.description,
        ingredients: parsed.ingredients,
        evidence:    parsed.evidence,
        scanned_at:  scannedAt,
      },
    });
  } catch (err) {
    console.error('[admin/scans/reanalyze] error:', err);
    return NextResponse.json({ error: 'gemini_error', detail: String(err) }, { status: 500 });
  }
}
