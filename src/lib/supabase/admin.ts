import { createClient } from '@supabase/supabase-js';

/**
 * Service Role 클라이언트 — RLS를 우회하므로 서버 전용 로직에서만 사용.
 * 일반 사용자 데이터 접근에는 절대 사용하지 말 것.
 * 허용 용도:
 *   - auth.admin.deleteUser() (회원탈퇴)
 *   - user_terms_agreements INSERT (RLS INSERT 정책 없음)
 *   - user_entitlements 시스템 지급 (trial, admin_grant)
 *   - admin API (catalog, scan_error_reports 관리)
 *   - Vercel Cron (batch, cleanup)
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase admin credentials are not configured');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
