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
      description: '가입 보상 크레딧 3회',
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

  const allTransactions = [...enrichedTransactions, ...syntheticTrialEntries]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({
    success: true,
    transactions: allTransactions,  // 결제/환불 내역 + 가입 보상
    scanLogs: scanLogs ?? [],        // 스캔 사용 로그
  });
}
