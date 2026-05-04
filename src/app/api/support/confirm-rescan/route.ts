import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deductScan } from '@/lib/entitlement';

/**
 * POST /api/support/confirm-rescan
 *
 * 유저가 재진단 결과를 보고 "해결됐어요 / 여전히 잘못 나와요" 응답 처리.
 *
 * "해결됐어요" (confirmed: 'correct'):
 *   - catalog 갱신 (재진단 결과 반영)
 *   - scan_history.result_json 업데이트 + is_under_review=false
 *   - scan_error_reports.user_confirmed='correct', status='resolved'
 *   - 스캔권 재차감 (환불 취소)
 *
 * "여전히 잘못 나와요" (confirmed: 'incorrect'):
 *   - catalog 갱신 안 함
 *   - scan_history.is_under_review 유지 (히스토리 미노출)
 *   - scan_error_reports.user_confirmed='incorrect' (관리자 검토 케이스)
 *   - 스캔권 환불 유지
 *
 * Body: { reportId: number, confirmed: 'correct' | 'incorrect', rescanResult: object, barcode?: string }
 */
export async function POST(req: Request) {
  let body: {
    reportId?: number;
    confirmed?: 'correct' | 'incorrect';
    rescanResult?: {
      status: string;
      productName: string;
      headline: string;
      description: string;
      ingredients: { name: string; status: string; reason: string }[];
      weekAnalysis?: string;
    };
    barcode?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { reportId, confirmed, rescanResult, barcode } = body;

  if (!reportId || !confirmed || !['correct', 'incorrect'].includes(confirmed)) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }
  if (confirmed === 'correct' && !rescanResult) {
    return NextResponse.json({ error: 'rescan_result_required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const adminSupabase = createAdminClient();

  // 제보 소유권 확인
  const { data: report } = await adminSupabase
    .from('scan_error_reports')
    .select('id, scan_history_id, user_confirmed')
    .eq('id', reportId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!report) return NextResponse.json({ error: 'report_not_found' }, { status: 404 });
  if (report.user_confirmed) return NextResponse.json({ error: 'already_confirmed' }, { status: 409 });

  const scanHistoryId = report.scan_history_id;

  if (confirmed === 'correct' && rescanResult) {
    // ── 해결됐어요 ──────────────────────────────────────────────────

    // 1. catalog 갱신
    const productName = rescanResult.productName;
    const saveResult = { ...rescanResult };
    delete (saveResult as any).weekAnalysis;

    if (barcode) {
      await adminSupabase.from('catalog').upsert({
        cache_key: `barcode:${barcode}`,
        barcode,
        product_name: productName,
        result_json: saveResult,
        status: rescanResult.status,
        hit_count: 0,
      }, { onConflict: 'cache_key' });
    }
    const normalized = productName.toLowerCase().trim().replace(/\s+/g, ' ');
    await adminSupabase.from('catalog').upsert({
      cache_key: `product:${normalized}`,
      product_name: productName,
      result_json: saveResult,
      status: rescanResult.status,
      hit_count: 0,
    }, { onConflict: 'cache_key' });

    // 2. scan_history 업데이트 — 재진단 결과로 교체 + 검토 해제
    if (scanHistoryId) {
      await adminSupabase
        .from('scan_history')
        .update({
          result_json: JSON.stringify(rescanResult),
          product_name: productName,
          status: rescanResult.status,
          is_under_review: false,
        })
        .eq('id', scanHistoryId);
    }

    // 3. scan_error_reports 확인 완료 처리
    await adminSupabase
      .from('scan_error_reports')
      .update({ user_confirmed: 'correct', status: 'resolved' })
      .eq('id', reportId);

    // 4. 스캔권 재차감 (환불 취소)
    const deductResult = await deductScan(supabase, user.id);
    if (deductResult.ok) {
      await adminSupabase.from('scan_usage_logs').insert({
        user_id: user.id,
        type: 'scan_use',
        count: -1,
        entitlement_id: deductResult.entitlementId,
        scan_history_id: scanHistoryId ?? null,
        description: '재진단 확인 후 스캔권 차감',
      });
    }

    return NextResponse.json({ success: true, confirmed: 'correct' });

  } else {
    // ── 여전히 잘못 나와요 ─────────────────────────────────────────

    // scan_error_reports: 관리자 검토 필요 케이스로 분류
    await adminSupabase
      .from('scan_error_reports')
      .update({ user_confirmed: 'incorrect' })
      .eq('id', reportId);

    // scan_history는 is_under_review=true 유지 (히스토리 미노출)
    // 스캔권 환불도 유지

    return NextResponse.json({ success: true, confirmed: 'incorrect' });
  }
}
