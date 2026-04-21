import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

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
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt)); // 1s → 2s
      }
    }
  }
  throw lastErr;
}

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
    detectedBarcode: { type: Type.STRING },
  },
  required: ['status', 'productName', 'headline', 'description', 'ingredients', 'alternatives', 'weekAnalysis'],
};

/**
 * 바코드로 제품 정보 조회
 * 1순위: 식품안전나라 C005(바코드연계제품정보) — 한국 식품 등록률 높음, 원재료 없음
 * 2순위: OpenFoodFacts — 글로벌 DB, 원재료 포함
 * 모두 없으면 null → 이미지 분석 폴백
 */
async function lookupBarcode(barcode: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const koreaKey = process.env.FOOD_SAFETY_KOREA_API_KEY;

  // ── 1. 식품안전나라 C005 ──
  if (koreaKey) {
    try {
      const c005Res = await fetch(
        `https://openapi.foodsafetykorea.go.kr/api/${koreaKey}/C005/json/1/3/BAR_CD=${barcode}`
      );
      if (c005Res.ok) {
        const c005Data = await c005Res.json();
        const rows = c005Data?.C005?.row;
        if (rows && rows.length > 0) {
          const row = rows[0];
          const productName = row.PRDLST_NM ?? '';
          const brand = row.BSSH_NM ?? '';
          const productType = row.PRDLST_DCNM ?? ''; // 제품 분류명 (Gemini 컨텍스트용)

          if (productName) {
            supabase.from('barcode_items').upsert({
              barcode,
              name: productName,
              brand,
              ingredients: '', // C005에는 원재료 없음
            }, { onConflict: 'barcode', ignoreDuplicates: true }).then(() => {});

            return {
              productName,
              brand,
              rawIngredients: '', // 원재료 없음 — Gemini가 제품명 기반으로 분석
              productType,        // Gemini 프롬프트에 분류 힌트로 전달
              imageUrl: '',
            };
          }
        }
      }
    } catch {
      // C005 실패 시 OpenFoodFacts 폴백
    }
  }

  // ── 2. OpenFoodFacts ──
  try {
    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,ingredients_text,image_front_small_url`
    );
    if (offRes.ok) {
      const offData = await offRes.json();
      const p = offData?.product;
      if (p && (p.product_name || p.ingredients_text)) {
        const offProduct = {
          productName: p.product_name ?? '알 수 없는 제품',
          brand: p.brands ?? '',
          rawIngredients: p.ingredients_text ?? '',
          imageUrl: p.image_front_small_url ?? '',
        };

        supabase.from('barcode_items').upsert({
          barcode,
          name: offProduct.productName,
          brand: offProduct.brand,
          ingredients: offProduct.rawIngredients,
        }, { onConflict: 'barcode', ignoreDuplicates: true }).then(() => {});

        return offProduct;
      }
    }
  } catch {
    // OpenFoodFacts 실패
  }

  return null;
}

type MatchedIngredient = { name: string; status: string; reason: string };

// ingredient_rules는 자주 바뀌지 않으므로 서버 프로세스 내에서 5분간 캐싱
let _rulesCache: { keyword: string; risk_level: string; reason_ko: string }[] | null = null;
let _rulesCacheExpiry = 0;

async function matchIngredientRules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawIngredients: string
): Promise<MatchedIngredient[]> {
  const now = Date.now();
  if (!_rulesCache || now > _rulesCacheExpiry) {
    const { data: rules } = await supabase
      .from('ingredient_rules')
      .select('keyword, risk_level, reason_ko');
    _rulesCache = rules ?? [];
    _rulesCacheExpiry = now + 5 * 60 * 1000; // 5분
  }
  const rules = _rulesCache;
  if (!rules) return [];

  const text = rawIngredients.toLowerCase();
  const matched: MatchedIngredient[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    const kw = rule.keyword.toLowerCase();
    if (text.includes(kw) && !seen.has(kw)) {
      seen.add(kw);
      matched.push({ name: rule.keyword, status: rule.risk_level, reason: rule.reason_ko });
    }
  }
  return matched;
}

/** products 테이블에서 안전 판정(success)된 제품명 목록 조회 */
async function getDBSafeProducts(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string[]> {
  const { data } = await supabase
    .from('products')
    .select('product_name')
    .eq('status', 'success')
    .order('hit_count', { ascending: false })
    .limit(20);
  return data?.map(d => d.product_name) ?? [];
}

/** 제품명 정규화 — 괄호/영문 병기 제거 후 소문자 trim */
function normalizeProductName(name: string): string {
  return name.toLowerCase().trim().replace(/\s*\(.*?\)\s*/g, '').trim();
}

/** Gemini가 반환한 alternatives 중 DB에 없는 항목 제거, 현재 제품 자기 자신 제외 */
function filterAlternatives(
  alternatives: { name: string; brand: string; price: string }[],
  dbSafeProducts: string[],
  currentProductName?: string
): { name: string; brand: string; price: string }[] {
  if (!alternatives?.length || !dbSafeProducts.length) return [];
  const safeSet = new Set(dbSafeProducts.map(n => n.toLowerCase().trim()));
  const currentNorm = currentProductName?.toLowerCase().trim();
  return alternatives.filter(alt => {
    const altNorm = alt.name?.toLowerCase().trim();
    if (currentNorm && altNorm === currentNorm) return false; // 자기 자신 제외
    return safeSet.has(altNorm);
  });
}

async function callGeminiBarcode(
  product: { productName: string; brand: string; rawIngredients: string; productType?: string },
  pregnancyWeeks: number | null,
  matchedIngredients: MatchedIngredient[] = [],
  dbSafeProducts: string[] = []
) {
  const hasWeekInfo = pregnancyWeeks !== undefined && pregnancyWeeks !== null;
  const hasMatched = matchedIngredients.length > 0;
  const hasDBAlts = dbSafeProducts.length > 0;

  const response = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          text: `다음 식품 정보를 바탕으로 임산부가 섭취해도 안전한지 분석해줘.

제품명: ${product.productName}
제조사: ${product.brand}${product.productType ? `\n식품 분류: ${product.productType}` : ''}
원재료명: ${product.rawIngredients || '정보 없음 (제품명과 식품 분류를 기반으로 일반적인 성분을 추론해서 분석해줘)'}

${hasMatched
  ? `★규칙 기반 판정 완료 성분★ (이 판정을 절대 변경하지 말고 ingredients 배열에 그대로 포함해줘):
${JSON.stringify(matchedIngredients)}

나머지 원재료에서 추가로 주목할 성분이 있으면 ingredients에 더 추가해줘.
전체 status는 위 판정 성분 중 가장 높은 위험도를 반드시 반영해줘 (danger > caution > success).`
  : ''}

status는 "success", "caution", "danger" 중 하나로 설정해줘.
★카페인 음료 필수 규칙★: 녹차, 홍차, 우롱차, 커피, 에너지드링크 등 카페인이 함유된 음료는 카페인 함량이 낮더라도 반드시 "caution" 이상으로 분류해줘. 임산부는 하루 총 카페인 섭취량(200mg 미만 권고)을 관리해야 하기 때문이야.
${hasWeekInfo
  ? `현재 사용자는 임신 ${pregnancyWeeks}주차입니다. description은 일반적인 설명으로 작성하고, weekAnalysis 필드에 이 주차의 임산부에게 맞는 맞춤형 섭취 조언을 작성해줘.`
  : `일반적인 임산부 기준으로 섭취 조언을 weekAnalysis에 작성해줘.`}

${hasDBAlts
  ? `★대체 제품 제약★: 아래는 실제로 안전 판정을 받은 제품 목록이야. alternatives는 반드시 이 목록에 있는 제품 이름만 사용해줘. 목록에 관련 제품이 없으면 alternatives를 빈 배열([])로 반환해줘. 절대 목록 외의 제품을 만들어 넣지 마.
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
  "weekAnalysis": "임신 주차에 따른 섭취 조언"
}`,
        },
      ],
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
 * Gemini가 ingredients에 danger 성분을 표기했는데 전체 status를 낮게 설정하는 경우를 방지.
 * ingredients 중 하나라도 danger면 전체 status를 danger로 올림.
 */
function normalizeStatus(result: Record<string, any>): void {
  if (!result.ingredients?.length) return;
  const hasDanger = result.ingredients.some((i: any) => i.status === 'danger');
  if (hasDanger && result.status !== 'danger') {
    result.status = 'danger';
  }
}

const FAILURE_REASON_MAP: Record<string, string> = {
  error_future_category: 'category_future',
  error_unsupported_category: 'category_blocked',
  error_food_estimate: 'food_estimate',
  error_image_quality: 'image_quality',
  error_db_mismatch: 'db_no_match',
};

async function saveUnsupportedLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    userId,
    uploadType,
    failureReason,
    productHint,
  }: {
    userId: string | null;
    uploadType: 'barcode' | 'product_image' | 'unknown';
    failureReason: string;
    productHint?: string;
  }
) {
  await supabase.from('unsupported_logs').insert({
    user_id: userId,
    upload_type: uploadType,
    failure_reason: failureReason,
    product_hint: productHint ?? null,
  });
}

export async function POST(req: Request) {
  const _t0 = Date.now();
  try {
    // pregnancyWeeks는 클라이언트에서 전달할 수도 있고(비캐시 경로 호환),
    // 생략 시 서버에서 직접 조회 — 클라이언트 auth 대기 없이 즉시 호출 가능하도록
    const { imageBase64, barcode, pregnancyWeeks: clientWeeks } = await req.json();

    if (!imageBase64 && !barcode) {
      return NextResponse.json({ error: 'no_input' }, { status: 400 });
    }

    const supabase = await createClient();

    // 현재 유저 (비로그인이면 null)
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    // pregnancy_weeks: 클라이언트 전달값 우선, 없으면 서버에서 직접 조회
    let pregnancyWeeks: number | null = clientWeeks ?? null;
    if (pregnancyWeeks === null && userId) {
      const { data: prof } = await supabase
        .from('users').select('pregnancy_weeks').eq('id', userId).single();
      pregnancyWeeks = prof?.pregnancy_weeks ?? null;
    }
    const hasWeekInfo = pregnancyWeeks !== undefined && pregnancyWeeks !== null;

    // ── 바코드 우선 분석 (이미지가 함께 있어도 바코드 먼저 시도) ──
    if (barcode) {
      const cacheKey = `barcode:${barcode}`;

      // 1. products 테이블 조회
      const { data: cached } = await supabase
        .from('products')
        .select('result_json, product_name, hit_count')
        .eq('cache_key', cacheKey)
        .maybeSingle();

      if (cached) {
        // hit_count 증가 (fire-and-forget)
        supabase
          .from('products')
          .update({ hit_count: (cached.hit_count ?? 0) + 1 })
          .eq('cache_key', cacheKey)
          .then(() => {});

        const result = { ...(cached.result_json as object) };

        // weekAnalysis는 클라이언트가 /api/analyze/week 엔드포인트로 별도 요청
        // (캐시 히트 시 Gemini를 추가 호출하지 않아 응답 속도 대폭 개선)
        console.log(`[analyze] CACHE_HIT barcode=${barcode} total=${Date.now()-_t0}ms`);
        return NextResponse.json({
          success: true,
          result,
          fromCache: true,
          productName: cached.product_name,
          needsWeekAnalysis: hasWeekInfo,
        });
      }

      // 2. DB MISS → 외부 API 조회
      const product = await lookupBarcode(barcode, supabase);

      if (!product) {
        if (!imageBase64) {
          // 이미지 폴백 없음 → error_db_mismatch
          saveUnsupportedLog(supabase, {
            userId,
            uploadType: 'barcode',
            failureReason: 'db_no_match',
            productHint: barcode,
          }).catch(() => {});

          return NextResponse.json({
            success: true,
            result: {
              status: 'error_db_mismatch',
              productName: '알 수 없는 제품',
              headline: '데이터베이스에 없는 제품이에요',
              description: '바코드가 인식되었지만 식품 DB에 등록되지 않은 제품이에요. 사진 촬영으로 다시 시도해 보세요.',
              ingredients: [],
              alternatives: [],
              weekAnalysis: '',
            },
          });
        }
        // imageBase64 있음 → 이미지 분석으로 폴백 (fall through)
      } else {
        // 3. 룰 매칭 1차 판정 + DB 안전 제품 조회 + Gemini 분석
        const [matchedIngredients, dbSafeProducts] = await Promise.all([
          product.rawIngredients
            ? matchIngredientRules(supabase, product.rawIngredients)
            : Promise.resolve([]),
          getDBSafeProducts(supabase),
        ]);

        const _tGemini = Date.now();
        const result = await callGeminiBarcode(product, pregnancyWeeks, matchedIngredients, dbSafeProducts);
        normalizeStatus(result);
        console.log(`[analyze] BARCODE_MISS barcode=${barcode} gemini=${Date.now()-_tGemini}ms total=${Date.now()-_t0}ms`);
        if (product.imageUrl) result.imageUrl = product.imageUrl;
        result.alternatives = filterAlternatives(result.alternatives, dbSafeProducts, product.productName);

        // 4. products 테이블에 저장 (weekAnalysis, imageUrl 제외)
        const saveResult = { ...result };
        delete saveResult.weekAnalysis;
        delete saveResult.imageUrl;

        const { error: insertError } = await supabase.from('products').insert({
          cache_key: cacheKey,
          product_name: product.productName,
          result_json: saveResult,
          status: result.status,
          barcode,
          hit_count: 0,
        });
        if (insertError) console.error('[products insert barcode]', insertError);

        return NextResponse.json({ success: true, result });
      }
    }

    // ── 이미지 분석 (순수 이미지 촬영 또는 바코드 DB 미스 폴백) ──
    if (!imageBase64) {
      return NextResponse.json({ error: 'no_input' }, { status: 400 });
    }
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const mimeTypeMatch = imageBase64.match(/data:([^;]+);/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

    // 전체 이미지 분석 + DB 안전 제품 목록을 대체 제품 힌트로 전달
    const dbSafeProducts = await getDBSafeProducts(supabase);
    const dbAltsHint = dbSafeProducts.length > 0
      ? `\n★대체 제품 제약★: 아래는 실제로 안전 판정을 받은 제품 목록이야. alternatives는 반드시 이 목록에 있는 제품 이름만 사용해줘. 목록에 관련 제품이 없으면 alternatives를 빈 배열([])로 반환해줘. 절대 목록 외의 제품을 만들어 넣지 마.\n[${dbSafeProducts.join(', ')}]`
      : '\nalternatives는 빈 배열([])로 반환해줘.';

    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          {
            text: `이 사진에 있는 것이 무엇인지 식별하고, 임산부에게 안전한지 분석해줘.
사진 내용에 따라 다음 중 가장 적절한 status를 선택해줘:

포장 제품 (성분 표기가 있는 가공식품):
- 안전/주의/위험 판정 가능 → "success" | "caution" | "danger"

포장 제품이 아닌 경우:
- "error_food_estimate": 조리된 음식, 식당 메뉴, 음식 사진 등 성분 표기가 없는 경우. AI 추정으로 분석 가능.
- "error_future_category": 일반 화장품, 일반의약품 등 추후 지원 예정인 카테고리
- "error_unsupported_category": 전문의약품처럼 의료 전문가 판단이 필요한 경우
- "error_image_quality": 사진이 너무 흐리거나 어둡거나, 여러 제품이 찍혔거나, 식품이 없는 경우
- "error_db_mismatch": 바코드는 인식되나 제품을 도저히 알 수 없는 경우

★중요★: 어떤 status든 이미지에서 음식/제품을 식별할 수 있다면 productName, headline, description, ingredients, weekAnalysis에 분석 정보를 최대한 작성해줘. 완전히 식별 불가능한 경우에만 description에 그 이유를 짧게 적어줘.
★카페인 음료 필수 규칙★: 녹차, 홍차, 우롱차, 커피, 에너지드링크 등 카페인이 함유된 음료는 카페인 함량이 낮더라도 반드시 "caution" 이상으로 분류해줘. 임산부는 하루 총 카페인 섭취량(200mg 미만 권고)을 관리해야 하기 때문이야.
${dbAltsHint}
${hasWeekInfo
  ? `현재 사용자는 임신 ${pregnancyWeeks}주차입니다. description은 일반적인 임산부 기준으로 작성하고, weekAnalysis 필드에는 임신 ${pregnancyWeeks}주차에 맞는 맞춤형 섭취 조언을 별도로 작성해줘.`
  : `일반적인 임산부 기준으로 섭취 조언을 weekAnalysis에 작성해줘.`}
다음 JSON 형식으로 응답해줘:
{
  "status": "success" | "caution" | "danger" | "error_food_estimate" | "error_future_category" | "error_unsupported_category" | "error_image_quality" | "error_db_mismatch",
  "productName": "식별된 음식/제품 이름 (식별 불가시 '알 수 없음')",
  "headline": "요약 헤드라인 (주의/위험 성분명 직접 언급 절대 금지. 예: 안심하고 드셔도 좋아요, 주의가 필요한 성분이 있어요 등)",
  "description": "임산부 섭취와 관련된 전반적인 설명 (주의/위험 성분명 직접 언급 절대 금지. 식별 불가시 그 이유를 짧게 작성. 예: '너무 어두워요', '여러 제품이 찍혔어요')",
  "ingredients": [{ "name": "주요 성분/특징 1", "status": "success" | "caution" | "danger", "reason": "이유" }],
  "alternatives": [{ "name": "대체 식품 이름", "brand": "브랜드명 (없으면 일반명칭)", "price": "예상 가격대" }],
  "weekAnalysis": "임신 주차에 따른 섭취 조언",
  "detectedBarcode": "이미지에서 바코드 숫자가 명확히 보이면 숫자만 (예: 8801234567890), 보이지 않으면 빈 문자열"
}`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }));

    const result = JSON.parse(response.text?.trim() ?? '{}');
    if (!result.status) throw new Error('Gemini returned empty or invalid response');
    normalizeStatus(result);
    const detectedBarcode = result.detectedBarcode?.trim();

    // 이미지 분석 후 캐시 일치 확인 — Gemini는 호출마다 다른 결과를 줄 수 있으므로
    // 이미 저장된 결과가 있으면 그것을 우선 반환해 일관성 유지
    if (!result.status.startsWith('error_') && result.productName) {
      const cacheKeysToCheck: string[] = [];
      if (detectedBarcode) cacheKeysToCheck.push(`barcode:${detectedBarcode}`);
      cacheKeysToCheck.push(`product:${normalizeProductName(result.productName)}`);

      const { data: existingCache } = await supabase
        .from('products')
        .select('result_json, product_name, hit_count, cache_key')
        .in('cache_key', cacheKeysToCheck)
        .order('hit_count', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingCache) {
        supabase.from('products').update({ hit_count: (existingCache.hit_count ?? 0) + 1 })
          .eq('cache_key', existingCache.cache_key).then(() => {});
        const cachedResult = { ...(existingCache.result_json as object) };
        if (detectedBarcode) (cachedResult as any).detectedBarcode = detectedBarcode;
        console.log(`[analyze] IMAGE_CACHE_HIT key=${existingCache.cache_key} total=${Date.now()-_t0}ms`);
        return NextResponse.json({ success: true, result: cachedResult, fromCache: true });
      }
    }
    // detectedBarcode는 클라이언트에 그대로 전달 — scan_history에 저장되어 오류 제보 분석 시 cache_key 복원에 사용됨
    // products 저장 시에는 saveResult에서 별도 제거
    result.alternatives = filterAlternatives(result.alternatives, dbSafeProducts, result.productName);

    // error_image_quality: 식품이 아닌 화면 등 식별 불가 케이스.
    // Gemini가 대체 제품 힌트 목록의 이름을 productName에 잘못 채우는 경우를 방지.
    if (result.status === 'error_image_quality') {
      result.productName = '';
    }

    // 판정 불가 → unsupported_logs 저장 (fire-and-forget)
    if (result.status.startsWith('error_') && FAILURE_REASON_MAP[result.status]) {
      saveUnsupportedLog(supabase, {
        userId,
        uploadType: 'product_image',
        failureReason: FAILURE_REASON_MAP[result.status],
        productHint: result.productName && result.productName !== '알 수 없음' ? result.productName : undefined,
      }).catch(() => {});
    }

    // 이미지 분석 결과 저장 (정상 판정만, imageBase64 제외)
    if (!result.status.startsWith('error_') && result.productName && result.productName !== '알 수 없음') {
      const saveResult = { ...result };
      delete saveResult.weekAnalysis;
      delete saveResult.detectedBarcode;

      if (detectedBarcode) {
        // 바코드 OCR 성공: 식품안전나라 이미지 보강 + 바코드 기반 키
        const barcodeData = await lookupBarcode(detectedBarcode, supabase).catch(() => null);
        if (barcodeData?.imageUrl) result.imageUrl = barcodeData.imageUrl;
        delete saveResult.imageUrl;

        const { error: upsertError1 } = await supabase.from('products').upsert({
          cache_key: `barcode:${detectedBarcode}`,
          product_name: result.productName,
          result_json: saveResult,
          status: result.status,
          barcode: detectedBarcode,
          hit_count: 0,
        }, { onConflict: 'cache_key', ignoreDuplicates: true });
        if (upsertError1) console.error('[products upsert barcode-ocr]', upsertError1);
      } else {
        // 바코드 미인식: 제품명 기반 키
        const { error: upsertError2 } = await supabase.from('products').upsert({
          cache_key: `product:${normalizeProductName(result.productName)}`,
          product_name: result.productName,
          result_json: saveResult,
          status: result.status,
          barcode: null,
          hit_count: 0,
        }, { onConflict: 'cache_key', ignoreDuplicates: true });
        if (upsertError2) console.error('[products upsert product-name]', upsertError2);
      }
    }

    console.log(`[analyze] IMAGE total=${Date.now()-_t0}ms`);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('[analyze] error:', err);
    const is503 =
      err?.status === 503 ||
      String(err?.message ?? '').includes('503') ||
      String(err?.message ?? '').includes('UNAVAILABLE');
    const is429 =
      err?.status === 429 ||
      String(err?.message ?? '').includes('429') ||
      String(err?.message ?? '').includes('RESOURCE_EXHAUSTED') ||
      String(err?.message ?? '').includes('quota');
    const message = is429
      ? '지금 분석 요청이 너무 많아요. 잠시 후 다시 시도해주세요.'
      : is503
      ? '지금 분석이 많이 몰려 있어요. 잠시 후 다시 시도해주세요.'
      : '분석 중 오류가 발생했어요.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
