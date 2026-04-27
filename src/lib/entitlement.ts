import type { SupabaseClient } from '@supabase/supabase-js';

export const MONTHLY_DURATION_DAYS = 30;

type DeductSuccess = {
  ok: true;
  entitlementId: string;
  type: 'subscription' | 'scan';
  description: string;
};

type DeductError = {
  ok: false;
  error: 'no_scans' | 'db_error';
  status: 403 | 500;
};

export type DeductResult = DeductSuccess | DeductError;

/**
 * 스캔 이용권 차감 (scan_usage_logs 삽입 제외 — 호출부에서 처리)
 *
 * 차감 우선순위:
 * 1. 활성 무제한 이용권 → 로그만 기록
 * 2. 대기 중인 무제한 이용권 없는 경우 → pause된 횟수권 복원
 * 3. FIFO: 만료 임박 횟수권 차감 (Optimistic Locking + 최대 1회 재시도)
 * 4. 횟수권도 없고 대기 중인 무제한 이용권 있음 → 첫 스캔으로 활성화
 * 5. 모두 없음 → no_scans
 */
export async function deductScan(
  supabase: SupabaseClient,
  userId: string
): Promise<DeductResult> {
  const now = new Date().toISOString();

  // ── 1. 활성 무제한 이용권 ──────────────────────────────────────────
  const { data: activeSub } = await supabase
    .from('user_entitlements')
    .select('id, expires_at')
    .eq('user_id', userId)
    .eq('type', 'monthly')
    .eq('status', 'active')
    .gt('expires_at', now)
    .maybeSingle();

  if (activeSub) {
    return {
      ok: true,
      entitlementId: activeSub.id,
      type: 'subscription',
      description: '스캔 사용 (무제한)',
    };
  }

  // ── 2. 대기 중인 무제한 이용권 확인 ───────────────────────────────
  const { data: pendingSub } = await supabase
    .from('user_entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'monthly')
    .eq('status', 'pending')
    .maybeSingle();

  // ── 3. 무제한 이용권 없을 때: pause된 횟수권 복원 ─────────────────
  if (!pendingSub) {
    await supabase
      .from('user_entitlements')
      .update({ status: 'active' })
      .eq('user_id', userId)
      .in('type', ['scan5', 'trial', 'admin'])
      .eq('status', 'pending')
      .gt('expires_at', now)
      .gt('scan_count', 0);
  }

  // ── 4. FIFO: 만료 임박 횟수권 차감 (Optimistic Locking + 1회 재시도) ──
  const tryDeduct = async (): Promise<
    { scanRight: { id: string; scan_count: number } } | 'retry' | null
  > => {
    const { data: scanRights } = await supabase
      .from('user_entitlements')
      .select('id, scan_count')
      .eq('user_id', userId)
      .in('type', ['scan5', 'trial', 'admin'])
      .eq('status', 'active')
      .gt('expires_at', now)
      .gt('scan_count', 0)
      .order('expires_at', { ascending: true })
      .limit(1);

    if (!scanRights || scanRights.length === 0) return null;

    const scanRight = scanRights[0];

    const { data: updated } = await supabase
      .from('user_entitlements')
      .update({ scan_count: scanRight.scan_count - 1 })
      .eq('id', scanRight.id)
      .eq('scan_count', scanRight.scan_count) // 동시 요청 방어
      .select('id');

    if (!updated?.length) return 'retry'; // 동시 수정으로 실패 → 재시도

    return { scanRight };
  };

  let deductAttempt = await tryDeduct();
  if (deductAttempt === 'retry') deductAttempt = await tryDeduct();

  if (deductAttempt && deductAttempt !== 'retry') {
    return {
      ok: true,
      entitlementId: deductAttempt.scanRight.id,
      type: 'scan',
      description: '스캔 사용',
    };
  }

  // ── 5. 횟수권 없음 → 대기 중인 무제한 이용권 첫 스캔으로 활성화 ──
  if (pendingSub) {
    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    expiresAt.setDate(expiresAt.getDate() + MONTHLY_DURATION_DAYS);

    const { error: activateError } = await supabase
      .from('user_entitlements')
      .update({
        status: 'active',
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', pendingSub.id);

    if (activateError) {
      return { ok: false, error: 'db_error', status: 500 };
    }

    // 무제한 활성화 시 활성 횟수권 모두 pause
    await supabase
      .from('user_entitlements')
      .update({ status: 'pending' })
      .eq('user_id', userId)
      .in('type', ['scan5', 'trial', 'admin'])
      .eq('status', 'active');

    return {
      ok: true,
      entitlementId: pendingSub.id,
      type: 'subscription',
      description: '스캔 사용 (무제한 첫 사용)',
    };
  }

  return { ok: false, error: 'no_scans', status: 403 };
}
