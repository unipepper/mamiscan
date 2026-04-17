export type SubscriptionStatus = 'pending' | 'active' | 'expired';

export interface UserSubscription {
  id: number;
  user_id: string;
  transaction_id: number | null;
  status: SubscriptionStatus;
  purchased_at: string;
  started_at: string | null;
  expires_at: string | null;
  created_at: string;
}

/** 활성화된 무제한 구독인지 확인 (만료 시각 기준) */
export function isSubscriptionValid(
  sub: Pick<UserSubscription, 'status' | 'expires_at'> | null | undefined,
): boolean {
  if (!sub || sub.status !== 'active') return false;
  if (!sub.expires_at) return false;
  return new Date(sub.expires_at) > new Date();
}

/** 활성 구독의 남은 일수 계산 */
export function getRemainingDays(expiresAt: string | null | undefined): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}
