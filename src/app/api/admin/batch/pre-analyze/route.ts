import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdmin } from '@/lib/admin-auth';

// Vercel Pro 최대 실행 시간 (Hobby는 10초라 배치 크기를 작게 유지해야 함)
export const maxDuration = 300;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING },
    productName: { type: Type.STRING },
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
    alternatives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          brand: { type: Type.STRING },
          price: { type: Type.STRING },
        },
        required: ['name', 'brand', 'price'],
      },
    },
    weekAnalysis: { type: Type.STRING },
  },
  required: ['status', 'productName', 'headline', 'description', 'ingredients', 'alternatives', 'weekAnalysis'],
};

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
        await sleep(1000 * 2 ** attempt);
      }
    }
  }
  throw lastErr;
}

type MatchedIngredient = { name: string; status: string; reason: string };

async function getDBSafeProducts(supabase: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data } = await supabase
    .from('catalog')
    .select('product_name')
    .eq('status', 'success')
    .order('hit_count', { ascending: false })
    .limit(20);
  return data?.map(d => d.product_name) ?? [];
}

function normalizeStatus(result: Record<string, any>): void {
  if (!result.ingredients?.length) return;
  const hasDanger = result.ingredients.some((i: any) => i.status === 'danger');
  if (hasDanger && result.status !== 'danger') result.status = 'danger';
}

function filterAlternatives(
  alternatives: { name: string; brand: string; price: string }[],
  dbSafeProducts: string[],
  currentProductName?: string,
): { name: string; brand: string; price: string }[] {
  if (!alternatives?.length || !dbSafeProducts.length) return [];
  const safeSet = new Set(dbSafeProducts.map(n => n.toLowerCase().trim()));
  const currentNorm = currentProductName?.toLowerCase().trim();
  return alternatives.filter(alt => {
    const altNorm = alt.name?.toLowerCase().trim();
    if (currentNorm && altNorm === currentNorm) return false;
    return safeSet.has(altNorm);
  });
}

async function analyzeProduct(
  product: { productName: string; brand: string; rawIngredients: string; allergyInfo: string },
  matchedIngredients: MatchedIngredient[],
  dbSafeProducts: string[],
) {
  const hasMatched = matchedIngredients.length > 0;
  const hasDBAlts = dbSafeProducts.length > 0;

  const response = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [{
        text: `다음 식품 정보를 바탕으로 임산부가 섭취해도 안전한지 분석해줘.

제품명: ${product.productName}
제조사: ${product.brand}
원재료명: ${product.rawIngredients || '정보 없음 (제품명을 기반으로 일반적인 성분을 추론해서 분석해줘)'}${product.allergyInfo && product.allergyInfo !== '없음' ? `\n알레르기 유발물질: ${product.allergyInfo}` : ''}

${hasMatched
  ? `★규칙 기반 판정 완료 성분★ (이 판정을 절대 변경하지 말고 ingredients 배열에 그대로 포함해줘):
${JSON.stringify(matchedIngredients)}

나머지 원재료에서 추가로 주목할 성분이 있으면 ingredients에 더 추가해줘.
전체 status는 위 판정 성분 중 가장 높은 위험도를 반드시 반영해줘 (danger > caution > success).`
  : ''}

status는 "success", "caution", "danger" 중 하나로 설정해줘.
★카페인 음료 필수 규칙★: 녹차, 홍차, 우롱차, 커피, 에너지드링크 등 카페인이 함유된 음료는 카페인 함량이 낮더라도 반드시 "caution" 이상으로 분류해줘.
★날생선·날해산물 필수 규칙★: 생선회, 회, 날것의 생선, 날새우, 날굴, 날조개, 스시(날것 토핑), 세비체 등 익히지 않은 생선·해산물이 포함된 경우 반드시 "danger"로 분류해줘.
일반적인 임산부 기준으로 섭취 조언을 weekAnalysis에 작성해줘.

${hasDBAlts
  ? `★대체 제품 제약★: 아래는 실제로 안전 판정을 받은 제품 목록이야. alternatives는 반드시 이 목록에 있는 제품 이름만 사용해줘. 목록에 관련 제품이 없으면 alternatives를 빈 배열([])로 반환해줘.
[${dbSafeProducts.join(', ')}]`
  : 'alternatives는 빈 배열([])로 반환해줘.'}

다음 JSON 형식으로 응답해줘:
{
  "status": "success" | "caution" | "danger",
  "productName": "${product.productName}",
  "headline": "요약 헤드라인 (주의/위험 성분명 직접 언급 절대 금지)",
  "description": "임산부 섭취와 관련된 전반적인 설명",
  "ingredients": [{ "name": "주요 성분/특징", "status": "success" | "caution" | "danger", "reason": "이유" }],
  "alternatives": [{ "name": "대체 식품 이름", "brand": "브랜드명", "price": "예상 가격대" }],
  "weekAnalysis": "일반적인 임산부 기준 섭취 조언"
}`,
      }],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  }));

  const parsed = JSON.parse(response.text?.trim() ?? '{}');
  if (!parsed.status) throw new Error('Gemini returned empty or invalid response');
  return parsed;
}

/**
 * POST /api/admin/batch/pre-analyze
 *
 * result_json = NULL 인 products를 Gemini로 사전 분석해 캐시를 채웁니다.
 * 첫 스캔 사용자의 Gemini 대기 시간(2-4초)을 제거하는 것이 목적입니다.
 *
 * Body: { limit?: number }  — 1회 처리 건수 (기본 10, 최대 30)
 * 인증: X-Admin-Secret 헤더
 *
 * Response: { analyzed, failed, remaining }
 */
export async function POST(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.response;

  let limit = 10;
  try {
    const body = await req.json();
    if (body.limit !== undefined) {
      limit = Math.min(Math.max(1, Number(body.limit)), 30);
    }
  } catch {
    // body 없으면 기본값 사용
  }

  const supabase = createAdminClient();

  // 분석 대상: result_json이 NULL인 제품
  const { data: targets, error: fetchErr } = await supabase
    .from('catalog')
    .select('cache_key, product_name, brand, raw_ingredients, allergy_info')
    .is('result_json', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (fetchErr) {
    return NextResponse.json({ error: 'db_fetch_failed', detail: fetchErr.message }, { status: 500 });
  }
  if (!targets?.length) {
    const { count } = await supabase
      .from('catalog')
      .select('*', { count: 'exact', head: true })
      .is('result_json', null);
    return NextResponse.json({ analyzed: 0, failed: 0, remaining: count ?? 0 });
  }

  // ingredient_rules는 배치 전체에서 한 번만 조회
  const { data: allRules } = await supabase
    .from('ingredient_rules')
    .select('keyword, risk_level, reason_ko');
  const rules = allRules ?? [];

  // DB 안전 제품 목록도 한 번만 조회 (alternatives 화이트리스트)
  const dbSafeProducts = await getDBSafeProducts(supabase);

  let analyzed = 0;
  let failed = 0;
  const errors: { cacheKey: string; error: string }[] = [];

  for (const target of targets) {
    try {
      const rawIngredients = target.raw_ingredients ?? '';
      const allergyInfo = target.allergy_info ?? '';

      // ingredient_rules 매칭 (미리 로드한 rules 재사용)
      const matchedIngredients: MatchedIngredient[] = [];
      if (rawIngredients) {
        const text = rawIngredients.toLowerCase();
        const seen = new Set<string>();
        for (const rule of rules) {
          const kw = rule.keyword.toLowerCase();
          if (text.includes(kw) && !seen.has(kw)) {
            seen.add(kw);
            matchedIngredients.push({ name: rule.keyword, status: rule.risk_level, reason: rule.reason_ko });
          }
        }
      }

      const result = await analyzeProduct(
        {
          productName: target.product_name,
          brand: target.brand ?? '',
          rawIngredients,
          allergyInfo,
        },
        matchedIngredients,
        dbSafeProducts,
      );

      normalizeStatus(result);
      result.alternatives = filterAlternatives(result.alternatives, dbSafeProducts, target.product_name);

      // weekAnalysis는 사용자 요청 시 /api/analyze/week에서 별도 생성하므로 저장 제외
      const saveResult = { ...result };
      delete saveResult.weekAnalysis;

      const { error: updateErr } = await supabase
        .from('catalog')
        .update({ result_json: saveResult, status: result.status })
        .eq('cache_key', target.cache_key);

      if (updateErr) throw new Error(updateErr.message);
      analyzed++;
    } catch (err: any) {
      failed++;
      errors.push({ cacheKey: target.cache_key, error: err.message ?? String(err) });
      console.error(`[pre-analyze] failed cache_key=${target.cache_key}:`, err);
    }

    // Gemini 레이트리밋 방지 (항목 간 300ms 간격)
    await sleep(300);
  }

  const { count: remaining } = await supabase
    .from('catalog')
    .select('*', { count: 'exact', head: true })
    .is('result_json', null);

  return NextResponse.json({
    analyzed,
    failed,
    remaining: remaining ?? 0,
    ...(errors.length ? { errors } : {}),
  });
}
