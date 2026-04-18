export type EntitlementType = 'scan5' | 'monthly' | 'trial' | 'admin';
export type EntitlementStatus = 'pending' | 'active' | 'expired';

/** user_entitlements 테이블 행 타입 */
export interface UserEntitlement {
  id: number;
  user_id: string;
  type: EntitlementType;
  status: EntitlementStatus;
  scan_count: number | null;  // monthly는 null, 나머지는 잔여 횟수
  transaction_id: number | null;
  started_at: string | null;  // monthly 전용: 첫 스캔 시각
  expires_at: string;
  created_at: string;
}

/** 활성화된 무제한 이용권인지 확인 (만료 시각 기준) */
export function isEntitlementValid(
  ent: Pick<UserEntitlement, 'status' | 'expires_at'> | null | undefined,
): boolean {
  if (!ent || ent.status !== 'active') return false;
  return new Date(ent.expires_at) > new Date();
}

/** 날짜 문자열을 'yyyy.mm.dd 오전/오후 h:mm' 형식으로 포맷 */
export function formatSubscriptionDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hours = d.getHours();
  const ampm = hours < 12 ? '오전' : '오후';
  const h = hours % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${ampm} ${h}:${min}`;
}

/** 활성 구독의 남은 일수 계산 */
export function getRemainingDays(expiresAt: string | null | undefined): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}
