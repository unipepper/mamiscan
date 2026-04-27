import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BATCH_SIZE = 50;

async function findBarcodeInDB(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productName: string
): Promise<string | null> {
  const { data } = await supabase
    .from('catalog_items')
    .select('barcode')
    .ilike('name', `%${productName}%`)
    .limit(1)
    .maybeSingle();
  return data?.barcode ?? null;
}

async function findBarcodeViaAPI(productName: string): Promise<string | null> {
  const key = process.env.FOOD_SAFETY_API_KEY!;
  try {
    const res = await fetch(
      `https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02?serviceKey=${key}&pageNo=1&numOfRows=1&type=json&FOOD_NM_KR=${encodeURIComponent(productName)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const barcode = data?.body?.items?.[0]?.BAR_CD?.trim();
    return barcode || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Vercel Cron 또는 직접 호출 모두 지원
  const cronSecret = req.headers.get('authorization');
  const adminSecret = req.headers.get('x-admin-secret');

  const isVercelCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = adminSecret === process.env.ADMIN_SECRET;

  if (!isVercelCron && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = await createClient();

  // product: 키로 저장된 이미지 분석 결과 조회
  const { data: productEntries, error } = await supabase
    .from('products')
    .select('cache_key, product_name, result_json, status')
    .like('cache_key', 'product:%')
    .is('barcode', null)
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
  }

  if (!productEntries || productEntries.length === 0) {
    return NextResponse.json({ success: true, processed: 0, mapped: 0, skipped: 0 });
  }

  let mapped = 0;
  let skipped = 0;

  for (const entry of productEntries) {
    const productName = entry.product_name;
    if (!productName) { skipped++; continue; }

    // 1순위: catalog_items 테이블
    let barcode = await findBarcodeInDB(supabase, productName);

    // 2순위: 식품안전나라 Open API
    if (!barcode) {
      barcode = await findBarcodeViaAPI(productName);
    }

    if (!barcode) { skipped++; continue; }

    // barcode: 키로 products 추가 (이미 있으면 무시)
    const { error: upsertError } = await supabase
      .from('products')
      .upsert({
        cache_key: `barcode:${barcode}`,
        product_name: productName,
        result_json: entry.result_json,
        status: (entry as any).status ?? null,
        barcode,
        hit_count: 0,
      }, { onConflict: 'cache_key', ignoreDuplicates: true });

    if (upsertError) { skipped++; continue; }

    // 기존 product: 행에도 barcode 컬럼 업데이트
    supabase.from('products')
      .update({ barcode })
      .eq('cache_key', entry.cache_key)
      .then(({ error }) => {
        if (error) console.error('[map-barcodes] products barcode update failed:', error);
      });

    mapped++;
  }

  return NextResponse.json({
    success: true,
    processed: productEntries.length,
    mapped,
    skipped,
  });
}
