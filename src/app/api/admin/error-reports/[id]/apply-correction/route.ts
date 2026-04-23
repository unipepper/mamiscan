import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type RouteContext = { params: Promise<{ id: string }> };

type Ingredient = {
  name: string;
  status: string;
  reason: string;
};

type ApprovedChanges = {
  status?: string;
  productName?: string;
  headline?: string;
  description?: string;
  ingredients?: Ingredient[];
};

/**
 * POST /api/admin/error-reports/[id]/apply-correction
 * AI 제안(또는 관리자가 편집한 값)을 products 캐시에 반영하고 제보를 resolved 처리
 *
 * Body:
 *   approved_changes: { status?, headline?, description?, ingredients? }
 *   admin_note?: string  (선택적 내부 메모)
 */
export async function POST(req: Request, ctx: RouteContext) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const reportId = Number(id);
  if (!reportId || isNaN(reportId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let body: { approved_changes: ApprovedChanges; admin_note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { approved_changes: changes, admin_note } = body;
  if (!changes || typeof changes !== 'object') {
    return NextResponse.json({ error: 'approved_changes_required' }, { status: 400 });
  }

  const allowedStatuses = ['success', 'caution', 'danger'];
  if (changes.status && !allowedStatuses.includes(changes.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. 제보 조회 — scan_history 통해 products cache_key 확인
  const { data: report, error: reportErr } = await supabase
    .from('scan_error_reports')
    .select(`
      id,
      status,
      scan_history_id,
      scan_history (
        id,
        product_name,
        result_json
      )
    `)
    .eq('id', reportId)
    .single();

  if (reportErr || !report) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (report.status === 'resolved') {
    return NextResponse.json({ error: 'already_resolved' }, { status: 409 });
  }

  const scanHistory = Array.isArray(report.scan_history)
    ? report.scan_history[0]
    : report.scan_history;

  if (!scanHistory) {
    return NextResponse.json({ error: 'no_scan_history' }, { status: 422 });
  }

  const resultJson = scanHistory.result_json as Record<string, unknown>;
  const detectedBarcode = resultJson?.detectedBarcode as string | undefined;
  // 관리자가 올바른 제품명을 입력한 경우 그것으로 cache_key 생성 (Case 2b: 이미지 오분석)
  const correctedProductName = (changes.productName ?? scanHistory.product_name).trim();
  const normalized = correctedProductName.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const cacheKey = detectedBarcode ? `barcode:${detectedBarcode}` : `product:${normalized}`;

  // 2. products 현재 row 조회 (오류 제보로 삭제됐을 수 있으므로 없어도 계속 진행)
  const { data: product } = await supabase
    .from('products')
    .select('cache_key, status, result_json')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  // 3. result_json 베이스 결정: products 캐시 있으면 그것, 없으면 scan_history 기반으로 재구성
  const baseResult: Record<string, unknown> = product
    ? (product.result_json as Record<string, unknown>)
    : (() => {
        const base = { ...(resultJson as Record<string, unknown>) };
        // scan_history.result_json에서 저장 불필요 필드 제거
        delete base.weekAnalysis;
        delete base.imageUrl;
        delete base.detectedBarcode;
        return base;
      })();

  // 4. 변경사항 병합
  const updatedResult: Record<string, unknown> = { ...baseResult };

  if (changes.productName !== undefined) updatedResult.productName = changes.productName;
  if (changes.headline !== undefined) updatedResult.headline = changes.headline;
  if (changes.description !== undefined) updatedResult.description = changes.description;
  if (changes.ingredients !== undefined) updatedResult.ingredients = changes.ingredients;
  if (changes.status !== undefined) updatedResult.status = changes.status;

  // 5. products UPSERT (없으면 INSERT, 있으면 UPDATE)
  const { data: updatedProduct, error: updateErr } = await supabase
    .from('products')
    .upsert({
      cache_key: cacheKey,
      product_name: correctedProductName,
      brand: (product?.result_json as any)?.brand ?? null,
      result_json: updatedResult,
      status: changes.status ?? (product?.status as string) ?? (updatedResult.status as string),
      barcode: detectedBarcode ?? null,
      hit_count: 0,
    }, { onConflict: 'cache_key' })
    .select('cache_key, status, result_json')
    .single();

  if (updateErr) {
    console.error('[apply-correction] products update error:', updateErr);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  // 5. scan_error_reports resolved 처리
  const { error: resolveErr } = await supabase
    .from('scan_error_reports')
    .update({
      status: 'resolved',
      ...(admin_note !== undefined ? { admin_note } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  if (resolveErr) {
    console.error('[apply-correction] resolve error:', resolveErr);
    // products는 이미 수정됐으므로 에러만 로깅하고 성공 반환
  }

  return NextResponse.json({
    success: true,
    updated_product: updatedProduct,
    cache_key: cacheKey,
  });
}
