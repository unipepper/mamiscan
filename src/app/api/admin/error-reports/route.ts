import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdmin } from '@/lib/admin-auth';

/**
 * GET /api/admin/error-reports
 * 오류 제보 목록 조회 (최신순, 페이지네이션)
 *
 * Query params:
 *   page      (default: 1)
 *   limit     (default: 20, max: 100)
 *   status    'open' | 'in_progress' | 'resolved' | 'dismissed' (미지정 시 전체)
 *   correction_type  필터 (미지정 시 전체)
 *   ai_confidence    필터 (미지정 시 전체)
 */
export async function GET(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const statusFilter = searchParams.get('status');
  const correctionTypeFilter = searchParams.get('correction_type');
  const confidenceFilter = searchParams.get('ai_confidence');

  const supabase = createAdminClient();

  let query = supabase
    .from('scan_error_reports')
    .select(`
      id,
      body,
      status,
      ai_confidence,
      correction_type,
      ai_analyzed_at,
      created_at,
      scan_history_id,
      scan_history (
        product_name,
        status
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (statusFilter) query = query.eq('status', statusFilter);
  if (correctionTypeFilter) query = query.eq('correction_type', correctionTypeFilter);
  if (confidenceFilter) query = query.eq('ai_confidence', confidenceFilter);

  const { data, error, count } = await query;

  if (error) {
    console.error('[admin/error-reports] list error:', error);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  });
}
