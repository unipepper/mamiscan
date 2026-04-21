import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1]?.trim() ?? '';
}

async function fetchHaccp(reportNo: string, apiKey: string): Promise<{
  rawIngredients: string;
  allergyInfo: string;
  imageUrl: string;
} | null> {
  if (!reportNo) return null;
  try {
    const encodedKey = encodeURIComponent(apiKey);
    const res = await fetch(
      `https://apis.data.go.kr/B553748/CertImgListServiceV3/getCertImgListServiceV3?serviceKey=${encodedKey}&prdlstReportNo=${reportNo}&pageNo=1&numOfRows=1`
    );
    if (!res.ok) return null;
    const xml = await res.text();
    if (!xml.includes('<item>')) return null;
    return {
      rawIngredients: extractXmlTag(xml, 'rawmtrl'),
      allergyInfo:    extractXmlTag(xml, 'allergy'),
      imageUrl:       extractXmlTag(xml, 'imgurl1'),
    };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * POST /api/admin/batch/load-food-safety
 * C005(바코드+품목보고번호) + HACCP(원재료+알레르기+이미지)를 결합해
 * products 테이블에 완전한 레코드를 선제 적재.
 *
 * - result_json은 NULL로 저장 (첫 스캔 시 Gemini lazy-fill)
 * - raw_ingredients가 있으면 첫 스캔 시 C005+HACCP API 호출 스킵, Gemini만 실행
 *
 * Body: { start: number, end: number }  (C005 API 인덱스 범위, 최대 100)
 * 인증: X-Admin-Secret 헤더
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const koreaKey = process.env.FOOD_SAFETY_KOREA_API_KEY;
  const haccpKey = process.env.FOOD_SAFETY_API_KEY;
  if (!koreaKey) {
    return NextResponse.json({ error: 'FOOD_SAFETY_KOREA_API_KEY not configured' }, { status: 500 });
  }

  let body: { start: number; end: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { start, end } = body;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return NextResponse.json({ error: 'start/end must be positive integers with start <= end' }, { status: 400 });
  }
  if (end - start + 1 > 100) {
    return NextResponse.json({ error: 'range cannot exceed 100 items per request' }, { status: 400 });
  }

  // ── 1. C005 범위 조회 ──
  const c005Url = `https://openapi.foodsafetykorea.go.kr/api/${koreaKey}/C005/json/${start}/${end}`;
  let c005Rows: any[];
  let totalCount: number;
  try {
    const res = await fetch(c005Url);
    if (!res.ok) {
      return NextResponse.json({ error: `C005 API error: ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const resultCode = data?.C005?.RESULT?.CODE ?? data?.RESULT?.CODE;
    if (resultCode && resultCode !== 'INFO-000') {
      return NextResponse.json({
        error: 'C005 API returned error',
        code: resultCode,
        message: data?.C005?.RESULT?.MSG ?? data?.RESULT?.MSG,
      }, { status: 502 });
    }
    c005Rows = data?.C005?.row ?? [];
    totalCount = Number(data?.C005?.total_count ?? 0);
  } catch (err: any) {
    return NextResponse.json({ error: `C005 fetch failed: ${err.message}` }, { status: 502 });
  }

  if (c005Rows.length === 0) {
    return NextResponse.json({ success: true, range: { start, end }, requested: 0, inserted: 0, skipped: 0, totalCount });
  }

  // ── 2. 유효 항목 필터링 (바코드 필수) ──
  const validRows = c005Rows.filter(row => {
    const barcode = row.BAR_CD?.trim();
    return barcode && /^\d{8,14}$/.test(barcode) && row.PRDLST_NM?.trim();
  });

  // ── 3. HACCP 병렬 호출 (10개씩 청크, 청크 간 200ms 딜레이) ──
  const CHUNK_SIZE = 10;
  const results: Array<{
    barcode: string;
    productName: string;
    brand: string | null;
    reportNo: string;
    rawIngredients: string | null;
    allergyInfo: string | null;
    imageUrl: string | null;
  }> = [];

  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async (row) => {
        const barcode = row.BAR_CD.trim();
        const productName = row.PRDLST_NM.trim();
        const brand = row.BSSH_NM?.trim() || null;
        const reportNo = row.PRDLST_REPORT_NO?.trim() ?? '';

        let rawIngredients: string | null = null;
        let allergyInfo: string | null = null;
        let imageUrl: string | null = null;

        if (haccpKey && reportNo) {
          const haccp = await fetchHaccp(reportNo, haccpKey);
          if (haccp) {
            rawIngredients = haccp.rawIngredients || null;
            allergyInfo = haccp.allergyInfo || null;
            imageUrl = haccp.imageUrl || null;
          }
        }

        return { barcode, productName, brand, reportNo, rawIngredients, allergyInfo, imageUrl };
      })
    );
    results.push(...chunkResults);
    if (i + CHUNK_SIZE < validRows.length) await sleep(200);
  }

  // ── 4. Supabase upsert ──
  const supabase = createAdminClient();
  let inserted = 0;
  let skipped = 0;

  for (const item of results) {
    const { error } = await supabase.from('products').upsert({
      cache_key:    `barcode:${item.barcode}`,
      product_name: item.productName,
      brand:        item.brand,
      raw_ingredients: item.rawIngredients,
      allergy_info:    item.allergyInfo,
      result_json:     null,   // lazy-fill: 첫 스캔 시 Gemini 분석
      status:          null,
      barcode:         item.barcode,
      hit_count:       0,
    }, {
      onConflict:       'cache_key',
      ignoreDuplicates: true,  // 이미 분석 완료된 항목(result_json != null) 보호
    });

    if (error) {
      console.error(`[load-food-safety] upsert error barcode=${item.barcode}:`, error.message);
      skipped++;
    } else {
      inserted++;
    }
  }

  return NextResponse.json({
    success:   true,
    range:     { start, end },
    requested: c005Rows.length,
    valid:     validRows.length,
    inserted,
    skipped,
    totalCount,
  });
}
