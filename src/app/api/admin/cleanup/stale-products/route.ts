import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * POST /api/admin/cleanup/stale-products
 * result_json IS NULL AND hit_count = 0 인 제품(벌크 적재 후 스캔된 적 없는 항목)을 삭제하고
 * 삭제 목록을 cleanup_logs 테이블에 JSON으로 저장.
 *
 * 트리거 조건: Gemini 분석 완료된 항목(result_json NOT NULL)이 ANALYZED_THRESHOLD 초과 시 실행
 *   → 실제로 DB가 차오를 때만 stale 항목 정리 (벌크 적재만 있는 상태에서는 실행 안 함)
 * Vercel Cron: 매일 KST 03:00 (UTC 18:00) 자동 호출
 * 수동 실행: X-Admin-Secret 헤더로도 호출 가능
 */

// 분석 완료 항목이 이 수를 넘으면 stale 정리 실행 (실제 스토리지 사용 기준)
const ANALYZED_THRESHOLD = 20_000;

export async function POST(req: Request) {
  const cronSecret = req.headers.get('authorization');
  const adminSecret = req.headers.get('x-admin-secret');
  const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = adminSecret === process.env.ADMIN_SECRET;

  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = createAdminClient();

  // 1. 분석 완료 항목 수 확인 (실제 스토리지 사용량 기준)
  const { count: analyzedCount, error: countErr } = await supabase
    .from('catalog')
    .select('*', { count: 'exact', head: true })
    .not('result_json', 'is', null);

  if (countErr) {
    console.error('[cleanup] count error:', countErr);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  if ((analyzedCount ?? 0) <= ANALYZED_THRESHOLD) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: `analyzed count ${analyzedCount} ≤ threshold ${ANALYZED_THRESHOLD} — no cleanup needed`,
    });
  }

  // stale 항목 수 조회 (로그용)
  const { count: staleCount } = await supabase
    .from('catalog')
    .select('*', { count: 'exact', head: true })
    .is('result_json', null)
    .eq('hit_count', 0);

  // 2. 삭제 대상 조회 (로그 저장용)
  const { data: targets, error: selectErr } = await supabase
    .from('catalog')
    .select('id, barcode, product_name, brand')
    .is('result_json', null)
    .eq('hit_count', 0);

  if (selectErr || !targets) {
    console.error('[cleanup] select error:', selectErr);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  // 3. 삭제 실행
  const { error: deleteErr } = await supabase
    .from('catalog')
    .delete()
    .is('result_json', null)
    .eq('hit_count', 0);

  if (deleteErr) {
    console.error('[cleanup] delete error:', deleteErr);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  // 4. scan_history 3개월 이상된 기록 삭제
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const { count: deletedHistoryCount, error: historyErr } = await supabase
    .from('scan_history')
    .delete({ count: 'exact' })
    .lt('created_at', threeMonthsAgo.toISOString());

  if (historyErr) {
    console.error('[cleanup] scan_history delete error:', historyErr);
  }

  // 5. cleanup_logs에 기록
  const { error: logErr } = await supabase
    .from('cleanup_logs')
    .insert({
      deleted_count: targets.length,
      reason:        isCron ? 'stale_threshold' : 'manual',
      deleted_items: {
        stale_products: targets,
        scan_history_deleted: deletedHistoryCount ?? 0,
      },
    });

  if (logErr) {
    console.error('[cleanup] log insert error:', logErr);
  }

  console.log(`[cleanup] products ${targets.length}건, scan_history ${deletedHistoryCount ?? 0}건 삭제 완료`);

  return NextResponse.json({
    success:                true,
    deleted_products:       targets.length,
    deleted_scan_history:   deletedHistoryCount ?? 0,
    stale_before:           staleCount,
    reason:                 isCron ? 'stale_threshold' : 'manual',
  });
}
