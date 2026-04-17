import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 1. 활성화된 무제한 이용권 확인
  const { data: activeSub } = await supabase
    .from('user_entitlements')
    .select('id, expires_at')
    .eq('user_id', user.id)
    .eq('type', 'monthly')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (activeSub) {
    await supabase.from('scan_usage_logs').insert({
      user_id: user.id,
      type: 'scan_use',
      count: -1,
      entitlement_id: activeSub.id,
      description: '스캔 사용 (무제한)',
    });
    return NextResponse.json({ success: true, type: 'subscription', entitlementId: activeSub.id });
  }

  // 2. FIFO: 만료 임박 순으로 횟수권 차감 (가입 보상 포함)
  const { data: credits } = await supabase
    .from('user_entitlements')
    .select('id, scan_count')
    .eq('user_id', user.id)
    .in('type', ['trial', 'scan5'])
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .gt('scan_count', 0)
    .order('expires_at', { ascending: true })
    .limit(1);

  if (!credits || credits.length === 0) {
    // 스캔권 없음 → 대기 중인 무제한 이용권이 있으면 첫 스캔으로 활성화
    const { data: pendingSub } = await supabase
      .from('user_entitlements')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'monthly')
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingSub) {
      const startedAt = new Date();
      const expiresAt = new Date(startedAt);
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase
        .from('user_entitlements')
        .update({
          status: 'active',
          started_at: startedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', pendingSub.id);

      await supabase.from('scan_usage_logs').insert({
        user_id: user.id,
        type: 'scan_use',
        count: -1,
        entitlement_id: pendingSub.id,
        description: '스캔 사용 (무제한 첫 사용)',
      });

      return NextResponse.json({ success: true, type: 'subscription', entitlementId: pendingSub.id });
    }

    return NextResponse.json({ error: 'no_credits' }, { status: 403 });
  }

  // 3. 스캔권 차감 (scan_count 감소, row 유지)
  const credit = credits[0];

  const { error: updateError } = await supabase
    .from('user_entitlements')
    .update({ scan_count: credit.scan_count! - 1 })
    .eq('id', credit.id);

  if (updateError) {
    console.error('user_entitlements update error:', updateError);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  await supabase.from('scan_usage_logs').insert({
    user_id: user.id,
    type: 'scan_use',
    count: -1,
    entitlement_id: credit.id,
    description: '스캔 사용',
  });

  return NextResponse.json({ success: true, type: 'credit', entitlementId: credit.id });
}
