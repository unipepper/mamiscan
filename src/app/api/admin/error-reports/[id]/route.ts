import { NextResponse, after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdmin } from '@/lib/admin-auth';
import { rescanProduct } from '@/lib/ai/error-report-rescanner';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/error-reports/[id]
 * 오류 제보 상세 조회 — AI 분석 결과 + 연결된 스캔 이력 + products 캐시 포함
 */
export async function GET(req: Request, ctx: RouteContext) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const reportId = Number(id);
  if (!reportId || isNaN(reportId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: report, error } = await supabase
    .from('scan_error_reports')
    .select(`
      id,
      body,
      status,
      admin_note,
      attachments,
      ai_analysis,
      ai_confidence,
      correction_type,
      ai_analyzed_at,
      created_at,
      updated_at,
      scan_history_id,
      scan_history (
        id,
        product_name,
        status,
        result_json,
        image_url,
        created_at
      )
    `)
    .eq('id', reportId)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // products 캐시 조회 (현재 저장된 분석 결과)
  const scanHistory = Array.isArray(report.scan_history)
    ? report.scan_history[0]
    : report.scan_history;

  let productCache = null;
  if (scanHistory) {
    const resultJson = scanHistory.result_json as Record<string, unknown>;
    const detectedBarcode = resultJson?.detectedBarcode as string | undefined;
    const normalized = scanHistory.product_name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();

    const cacheKey = detectedBarcode ? `barcode:${detectedBarcode}` : `product:${normalized}`;
    const { data: product } = await supabase
      .from('catalog')
      .select('cache_key, status, result_json, barcode, hit_count')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    productCache = product;
  }

  return NextResponse.json({ report, productCache });
}

/**
 * POST /api/admin/error-reports/[id]
 * 올바른 제품명으로 Gemini 풀 재스캔 실행 (이미 분석됐어도 덮어씀)
 *
 * Body: { product_name: string }
 */
export async function POST(req: Request, ctx: RouteContext) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const reportId = Number(id);
  if (!reportId || isNaN(reportId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let body: { product_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const productName = body.product_name?.trim();
  if (!productName) {
    return NextResponse.json({ error: 'product_name_required' }, { status: 400 });
  }

  after(() => rescanProduct(reportId, productName));

  return NextResponse.json({ ok: true }, { status: 202 });
}

/**
 * PATCH /api/admin/error-reports/[id]
 * 상태 및 어드민 메모 수동 업데이트
 *
 * Body: { status?, admin_note? }
 */
export async function PATCH(req: Request, ctx: RouteContext) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const reportId = Number(id);
  if (!reportId || isNaN(reportId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let body: { status?: string; admin_note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const allowedStatuses = ['open', 'in_progress', 'resolved', 'dismissed'];
  if (body.status && !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) updates.status = body.status;
  if (body.admin_note !== undefined) updates.admin_note = body.admin_note;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('scan_error_reports')
    .update(updates)
    .eq('id', reportId)
    .select('id, status, admin_note, updated_at')
    .single();

  if (error) {
    console.error('[admin/error-reports/[id]] patch error:', error);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ data });
}
