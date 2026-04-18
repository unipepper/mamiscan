import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (code) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      // 약관 동의 여부 확인
      const { data: termsAgreement } = await supabase
        .from('user_terms_agreements')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // 신규 유저: 약관 동의 페이지로 이동
      if (!termsAgreement) {
        return NextResponse.redirect(`${origin}/signup/terms`);
      }

      // 기존 유저: trial 이용권 확인 후 지급 (안전망)
      const { data: existingTrial } = await supabase
        .from('user_entitlements')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'trial')
        .maybeSingle();

      if (!existingTrial) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabase.from('user_entitlements').insert({
          user_id: user.id,
          type: 'trial',
          status: 'active',
          scan_count: 3,
          expires_at: expiresAt.toISOString(),
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
