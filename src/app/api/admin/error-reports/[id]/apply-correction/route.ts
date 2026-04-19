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
  const normalized = scanHistory.product_name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
  const cacheKey = detectedBarcode ? `barcode:${detectedBarcode}` : `product:${normalized}`;

  // 2. products 현재 result_json 조회
  const { data: product, error: productErr } = await supabase
    .from('products')
    .select('cache_key, status, result_json')
    .eq('cache_key', cacheKey)
    .single();

  if (productErr || !product) {
    return NextResponse.json({ error: 'product_not_found', cache_key: cacheKey }, { status: 404 });
  }

  // 3. result_json에 변경사항 병합
  const currentResult = product.result_json as Record<string, unknown>;
  const updatedResult: Record<string, unknown> = { ...currentResult };

  if (changes.headline !== undefined) updatedResult.headline = changes.headline;
  if (changes.description !== undefined) updatedResult.description = changes.description;
  if (changes.ingredients !== undefined) updatedResult.ingredients = changes.ingredients;
  if (changes.status !== undefined) updatedResult.status = changes.status;

  // 4. products UPDATE
  const { data: updatedProduct, error: updateErr } = await supabase
    .from('products')
    .update({
      result_json: updatedResult,
      ...(changes.status ? { status: changes.status } : {}),
    })
    .eq('cache_key', cacheKey)
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
