import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [
    { data: transactions },
    { data: entitlements },
    { data: scanLogs },
    { data: trialEntitlements },
    { data: adminEntitlements },
    { data: scanHistories },
  ] = await Promise.all([
    // 결제/환불 내역
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),

    // 이용권 현황 (결제 연결된 것만 — 결제 내역 enrichment용)
    supabase
      .from('user_entitlements')
      .select('id, type, status, scan_count, started_at, expires_at, transaction_id')
      .eq('user_id', user.id)
      .not('transaction_id', 'is', null),

    // 스캔 사용 로그 (최근 50건)
    supabase
      .from('scan_usage_logs')
      .select('id, type, count, entitlement_id, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),

    // 가입 보상 체험권 (transactions 연결 여부 무관하게 별도 조회)
    supabase
      .from('user_entitlements')
      .select('id, type, status, scan_count, expires_at, transaction_id, created_at')
      .eq('user_id', user.id)
      .eq('type', 'trial'),

    // 어드민 지급 이용권 (transactions 연결 없이 별도 조회)
    supabase
      .from('user_entitlements')
      .select('id, type, status, scan_count, expires_at, transaction_id, created_at')
      .eq('user_id', user.id)
      .eq('type', 'admin'),

    // 스캔 사용 상품명 (entitlement_id가 있는 것만)
    supabase
      .from('scan_history')
      .select('id, entitlement_id, product_name, status, created_at')
      .eq('user_id', user.id)
      .not('entitlement_id', 'is', null)
      .order('created_at', { ascending: false }),
  ]);

  // 결제 내역에 이용권 현황 연결 (잔여 횟수, 만료일, 구독 상태 표시용)
  const entitlementMap: Record<string, { id: string; type: string; status: string; scan_count: number | null; expires_at: string }> =
    Object.fromEntries(
      (entitlements ?? []).map(e => [e.transaction_id, {
        id: e.id,
        type: e.type,
        status: e.status,
        scan_count: e.scan_count,
        started_at: e.started_at,
        expires_at: e.expires_at,
      }])
    );

  const enrichedTransactions = (transactions ?? []).map(tx => ({
    ...tx,
    entitlement: entitlementMap[tx.id] ?? null,
  }));

  // 가입 보상 체험권이 transactions 테이블에 없는 경우 가상 항목 추가
  // (migration으로 trial 트랜잭션이 삭제되었거나, 연결이 없는 경우 대응)
  const coveredTxIds = new Set((transactions ?? []).map(t => t.id));
  const syntheticTrialEntries = (trialEntitlements ?? [])
    .filter(e => !e.transaction_id || !coveredTxIds.has(e.transaction_id))
    .map(e => ({
      id: `trial-ent-${e.id}`,
      type: 'trial',
      amount: 0,
      price_krw: 0,
      description: '가입 보상 스캔권 3회',
      created_at: e.created_at,
      status: 'completed',
      payment_key: null,
      entitlement: {
        id: e.id,
        type: e.type,
        status: e.status,
        scan_count: e.scan_count,
        expires_at: e.expires_at,
      },
    }));

  // 어드민 지급 이용권이 transactions 테이블에 없는 경우 가상 항목 추가
  const syntheticAdminEntries = (adminEntitlements ?? [])
    .filter(e => !e.transaction_id || !coveredTxIds.has(e.transaction_id))
    .map(e => {
      // scan_usage_logs의 admin_grant 로그에서 최초 지급 횟수 조회
      const grantLog = (scanLogs ?? []).find(
        l => String(l.entitlement_id) === String(e.id) && l.type === 'admin_grant'
      );
      const grantCount = grantLog ? Math.abs(grantLog.count) : (e.scan_count ?? 0);
      return {
      id: `admin-ent-${e.id}`,
      type: 'trial' as const,
      amount: 0,
      price_krw: 0,
      description: `스캔권 ${grantCount}회 (관리자 지급)`,
      created_at: e.created_at,
      status: 'completed',
      payment_key: null,
      entitlement: {
        id: e.id,
        type: e.type,
        status: e.status,
        scan_count: e.scan_count,
        expires_at: e.expires_at,
      },
    };
  });

  const allTransactions = [...enrichedTransactions, ...syntheticTrialEntries, ...syntheticAdminEntries]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({
    success: true,
    transactions: allTransactions,      // 결제/환불 내역 + 가입 보상
    scanLogs: scanLogs ?? [],            // 스캔 사용 로그 (grant/use 구분용)
    scanHistories: scanHistories ?? [],  // 스캔 상품명 (entitlement_id 연결된 것)
  });
}
