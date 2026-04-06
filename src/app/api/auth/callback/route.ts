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
      // 신규 가입 여부 확인: trial 크레딧이 없으면 지급
      const { data: existingTrial } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'trial')
        .maybeSingle();

      if (!existingTrial) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await Promise.all([
          supabase.from('scan_credits').insert({
            user_id: user.id,
            count: 3,
            expires_at: expiresAt.toISOString(),
          }),
          supabase.from('transactions').insert({
            user_id: user.id,
            order_id: `trial-${user.id}`,
            type: 'trial',
            amount: 0,
            description: '가입 보상 크레딧 3회',
            price_krw: 0,
            status: 'completed',
          }),
        ]);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
