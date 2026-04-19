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

async function lookupBarcode(barcode: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const key = process.env.FOOD_SAFETY_API_KEY!;
  const [fsRes, offRes] = await Promise.allSettled([
    fetch(
      `https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02?serviceKey=${key}&pageNo=1&numOfRows=3&type=json&BAR_CD=${barcode}`
    ),
    fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=image_front_small_url`
    ),
  ]);

  let imageUrl = '';
  if (offRes.status === 'fulfilled' && offRes.value.ok) {
    const offData = await offRes.value.json();
    imageUrl = offData?.product?.image_front_small_url ?? '';
  }

  const fsData = fsRes.status === 'fulfilled' ? await fsRes.value.json() : null;
  const rows = fsData?.body?.items;
  if (!rows || rows.length === 0) return null;

  const productName = rows[0].FOOD_NM_KR ?? '알 수 없는 제품';
  const brand = rows[0].MAKER_NM ?? '';
  const rawIngredients = rows[0].RAWMTRL_NM ?? '';

  // barcode_items 저장 (fire-and-forget, 이미 있으면 무시)
  supabase.from('barcode_items').upsert({
    barcode,
    name: productName,
    brand,
    ingredients: rawIngredients,
  }, { onConflict: 'barcode', ignoreDuplicates: true }).then(() => {});

  return { productName, brand, rawIngredients, imageUrl };
}

type MatchedIngredient = { name: string; status: string; reason: string };

async function matchIngredientRules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawIngredients: string
): Promise<MatchedIngredient[]> {
  const { data: rules } = await supabase
    .from('ingredient_rules')
    .select('keyword, risk_level, reason_ko');
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

async function callGeminiBarcode(
  product: { productName: string; brand: string; rawIngredients: string },
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
제조사: ${product.brand}
원재료명: ${product.rawIngredients || '정보 없음'}

${hasMatched
  ? `★규칙 기반 판정 완료 성분★ (이 판정을 절대 변경하지 말고 ingredients 배열에 그대로 포함해줘):
${JSON.stringify(matchedIngredients)}

나머지 원재료에서 추가로 주목할 성분이 있으면 ingredients에 더 추가해줘.
전체 status는 위 판정 성분 중 가장 높은 위험도를 반드시 반영해줘 (danger > caution > success).`
  : ''}

status는 "success", "caution", "danger" 중 하나로 설정해줘.
${hasWeekInfo
  ? `현재 사용자는 임신 ${pregnancyWeeks}주차입니다. description은 일반적인 설명으로 작성하고, weekAnalysis 필드에 이 주차의 임산부에게 맞는 맞춤형 섭취 조언을 작성해줘.`
  : `일반적인 임산부 기준으로 섭취 조언을 weekAnalysis에 작성해줘.`}

${hasDBAlts
  ? `★대체 제품 추천 우선순위★: 아래는 실제로 안전 판정을 받은 제품 목록이야. alternatives 추천 시 이 목록에서 관련 있는 제품을 최우선으로 골라줘. 목록에 적합한 게 없을 때만 일반적인 대체품을 추천해줘.
[${dbSafeProducts.join(', ')}]`
  : ''}

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
    },
  }));
  return JSON.parse(response.text?.trim() ?? '{}');
}

const FAILURE_REASON_MAP: Record<string, string> = {
  error_future_category: 'category_future',
  error_unsupported_category: 'category_blocked',
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
  try {
    const { imageBase64, barcode, pregnancyWeeks } = await req.json();
    const hasWeekInfo = pregnancyWeeks !== undefined && pregnancyWeeks !== null;

    if (!imageBase64 && !barcode) {
      return NextResponse.json({ error: 'no_input' }, { status: 400 });
    }

    const supabase = await createClient();

    // 현재 유저 (비로그인이면 null)
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

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

        // 주차 있으면 weekAnalysis만 경량 재생성
        if (hasWeekInfo) {
          try {
            const weekRes = await withRetry(() => ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: {
                parts: [{
                  text: `임신 ${pregnancyWeeks}주차 임산부가 "${cached.product_name}"을 섭취할 때 주의사항을 2-3문장으로 작성해줘. JSON: {"weekAnalysis": "..."}`,
                }],
              },
              config: { responseMimeType: 'application/json' },
            }));
            const weekData = JSON.parse(weekRes.text?.trim() ?? '{}');
            if (weekData.weekAnalysis) (result as any).weekAnalysis = weekData.weekAnalysis;
          } catch {}
        }

        return NextResponse.json({ success: true, result, fromCache: true });
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

        const result = await callGeminiBarcode(product, pregnancyWeeks, matchedIngredients, dbSafeProducts);
        if (product.imageUrl) result.imageUrl = product.imageUrl;

        // 4. products 테이블에 저장 (weekAnalysis, imageUrl 제외)
        const saveResult = { ...result };
        delete saveResult.weekAnalysis;
        delete saveResult.imageUrl;

        supabase.from('products').insert({
          cache_key: cacheKey,
          product_name: product.productName,
          result_json: saveResult,
          status: result.status,
          barcode,
          hit_count: 0,
        }).then(() => {});

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

    // 1. 경량 식별 호출: 제품명 + 바코드만 먼저 추출해 캐시 조회
    try {
      const identifyRes = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: `이 이미지에서 제품명과 바코드 숫자만 알려줘. JSON: {"productName": "이름 또는 알 수 없음", "detectedBarcode": "숫자만 또는 빈 문자열"}` },
          ],
        },
        config: { responseMimeType: 'application/json' },
      }));

      const identified = JSON.parse(identifyRes.text?.trim() ?? '{}');
      const idBarcode = identified.detectedBarcode?.trim();
      const idName = identified.productName?.trim();

      const cacheKey = idBarcode
        ? `barcode:${idBarcode}`
        : idName && idName !== '알 수 없음'
          ? `product:${idName.toLowerCase()}`
          : null;

      if (cacheKey) {
        const { data: cached } = await supabase
          .from('products')
          .select('result_json, product_name, hit_count')
          .eq('cache_key', cacheKey)
          .maybeSingle();

        if (cached) {
          supabase.from('products')
            .update({ hit_count: (cached.hit_count ?? 0) + 1 })
            .eq('cache_key', cacheKey)
            .then(() => {});

          const result = { ...(cached.result_json as object) };

          if (hasWeekInfo) {
            try {
              const weekRes = await withRetry(() => ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                  parts: [{
                    text: `임신 ${pregnancyWeeks}주차 임산부가 "${cached.product_name}"을 섭취할 때 주의사항을 2-3문장으로 작성해줘. JSON: {"weekAnalysis": "..."}`,
                  }],
                },
                config: { responseMimeType: 'application/json' },
              }));
              const weekData = JSON.parse(weekRes.text?.trim() ?? '{}');
              if (weekData.weekAnalysis) (result as any).weekAnalysis = weekData.weekAnalysis;
            } catch {}
          }

          return NextResponse.json({ success: true, result, fromCache: true });
        }
      }
    } catch {
      // 식별 실패 시 전체 분석으로 진행
    }

    // 2. 전체 이미지 분석 + DB 안전 제품 목록을 대체 제품 힌트로 전달
    const dbSafeProducts = await getDBSafeProducts(supabase);
    const dbAltsHint = dbSafeProducts.length > 0
      ? `\n★대체 제품 추천 우선순위★: 아래는 실제로 안전 판정을 받은 제품 목록이야. alternatives 추천 시 이 목록에서 관련 있는 제품을 최우선으로 골라줘. 목록에 적합한 게 없을 때만 일반적인 대체품을 추천해줘.\n[${dbSafeProducts.join(', ')}]`
      : '';

    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          {
            text: `이 사진에 있는 제품이 무엇인지 식별하고, 임산부가 섭취해도 안전한지 분석해줘.
만약 사진이 식료품이 아니거나 식별이 불가능하다면, 다음 중 가장 적절한 status를 선택해줘:
- "error_future_category": 일반 화장품, 일반의약품 등 마미스캔이 추후 지원할 예정인 카테고리인 경우
- "error_unsupported_category": 전문의약품, 식당 조리 음식 등 성분 판정 기준이 달라 지원하지 않는 카테고리인 경우
- "error_image_quality": 사진이 너무 흐리거나, 너무 어둡거나, 여러 제품이 찍혔거나, 제품이 없는 경우
- "error_db_mismatch": 바코드는 인식되나 제품을 도저히 알 수 없는 경우

정상적으로 식별된 식료품인 경우 status를 "success", "caution", "danger" 중 하나로 설정해줘.

★중요★: 만약 위의 error_* status를 선택하더라도, 이미지 속 제품/음식이 무엇인지 대략적으로라도 식별할 수 있다면, productName, headline, description, ingredients, weekAnalysis에 정상적인 분석 정보를 최대한 작성해줘. 완전히 식별 불가능한 경우에만 description에 그 이유를 적어줘.
${dbAltsHint}
${hasWeekInfo
  ? `현재 사용자는 임신 ${pregnancyWeeks}주차입니다. description은 일반적인 임산부 기준으로 작성하고, weekAnalysis 필드에는 임신 ${pregnancyWeeks}주차에 맞는 맞춤형 섭취 조언을 별도로 작성해줘.`
  : `일반적인 임산부 기준으로 섭취 조언을 weekAnalysis에 작성해줘.`}
다음 JSON 형식으로 응답해줘:
{
  "status": "success" | "caution" | "danger" | "error_future_category" | "error_unsupported_category" | "error_image_quality" | "error_db_mismatch",
  "productName": "식별된 식료품 이름 (식별 불가시 '알 수 없음')",
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
      },
    }));

    const result = JSON.parse(response.text?.trim() ?? '{}');
    const detectedBarcode = result.detectedBarcode?.trim();
    delete result.detectedBarcode;

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

      if (detectedBarcode) {
        // 바코드 OCR 성공: 식품안전나라 이미지 보강 + 바코드 기반 키
        const barcodeData = await lookupBarcode(detectedBarcode, supabase).catch(() => null);
        if (barcodeData?.imageUrl) result.imageUrl = barcodeData.imageUrl;
        delete saveResult.imageUrl;

        supabase.from('products').upsert({
          cache_key: `barcode:${detectedBarcode}`,
          product_name: result.productName,
          result_json: saveResult,
          status: result.status,
          barcode: detectedBarcode,
          hit_count: 0,
        }, { onConflict: 'cache_key', ignoreDuplicates: true }).then(() => {});
      } else {
        // 바코드 미인식: 제품명 기반 키
        supabase.from('products').upsert({
          cache_key: `product:${result.productName.toLowerCase().trim()}`,
          product_name: result.productName,
          result_json: saveResult,
          status: result.status,
          barcode: null,
          hit_count: 0,
        }, { onConflict: 'cache_key', ignoreDuplicates: true }).then(() => {});
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('[analyze] error:', err);
    const is503 =
      err?.status === 503 ||
      String(err?.message ?? '').includes('503') ||
      String(err?.message ?? '').includes('UNAVAILABLE');
    const message = is503
      ? '지금 분석이 많이 몰려 있어요. 잠시 후 다시 시도해주세요.'
      : '분석 중 오류가 발생했어요.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
