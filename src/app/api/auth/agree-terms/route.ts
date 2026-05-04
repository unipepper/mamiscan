import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { POLICY_CURRENT_VERSION } from '@/lib/policy';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 이미 동의한 유저: JWT 메타데이터만 업데이트 후 반환
  const { data: existing } = await supabase
    .from('user_terms_agreements')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.auth.updateUser({ data: { terms_agreed: true } });
    return NextResponse.json({ ok: true });
  }

  // RLS INSERT 정책: "users can insert own terms agreement" (migration-v30)
  const { error: insertError } = await supabase
    .from('user_terms_agreements')
    .insert({
      user_id: user.id,
      terms_version: '1.0',
      privacy_version: POLICY_CURRENT_VERSION,
      is_adult: true,
    });

  if (insertError) {
    console.error('[agree-terms] insert error:', insertError.message);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  // JWT user_metadata에 동의 여부 기록 (미들웨어에서 DB 조회 없이 체크)
  await supabase.auth.updateUser({ data: { terms_agreed: true } });

  // trial 이용권 지급 — RLS INSERT 정책: "users can insert own entitlements" (migration-v30)
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

  return NextResponse.json({ ok: true });
}
