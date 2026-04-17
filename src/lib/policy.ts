// 현재 시행 중인 개인정보처리방침 버전 (YYYY-MM-DD)
export const POLICY_CURRENT_VERSION = '2026-04-17';

// 다음 방침 버전 — 변경 예정이 없으면 null
// 변경 시: 시행 예정일을 넣으세요 (예: '2026-06-01')
// 이 값을 설정하면 시행 D-7일부터 공지사항에 배지가 표시됩니다.
export const POLICY_NEXT_VERSION: string | null = null;

// 사전 공지 기간 (일) — 방침 변경 며칠 전부터 공지를 올릴지
export const POLICY_NOTICE_DAYS = 7;

// 방침 변경 시 공지사항 ID 패턴: `policy-v{버전}` (예: 'policy-v1.1')
