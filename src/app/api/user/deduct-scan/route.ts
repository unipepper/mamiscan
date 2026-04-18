import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = new Date().toISOString();

  // 1. 활성화된 무제한 이용권 확인
  const { data: activeSub } = await supabase
    .from('user_entitlements')
    .select('id, expires_at')
    .eq('user_id', user.id)
    .eq('type', 'monthly')
    .eq('status', 'active')
    .gt('expires_at', now)
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

  // 2. 무제한 이용권 없음 → 대기 중인 무제한 이용권 확인
  const { data: pendingSub } = await supabase
    .from('user_entitlements')
    .select('id')
    .eq('user_id', user.id)
    .eq('type', 'monthly')
    .eq('status', 'pending')
    .maybeSingle();

  // 3. 무제한 이용권이 아예 없을 때(만료 포함): pause된 스캔권 복원
  if (!pendingSub) {
    await supabase
      .from('user_entitlements')
      .update({ status: 'active' })
      .eq('user_id', user.id)
      .in('type', ['scan5', 'trial', 'admin'])
      .eq('status', 'pending')
      .gt('expires_at', now)
      .gt('scan_count', 0);
  }

  // 4. FIFO: 만료 임박 순으로 횟수권 차감 (가입 보상, 어드민 지급 포함)
  const { data: scanRights } = await supabase
    .from('user_entitlements')
    .select('id, scan_count')
    .eq('user_id', user.id)
    .in('type', ['scan5', 'trial', 'admin'])
    .eq('status', 'active')
    .gt('expires_at', now)
    .gt('scan_count', 0)
    .order('expires_at', { ascending: true })
    .limit(1);

  if (!scanRights || scanRights.length === 0) {
    // 5. 스캔권도 없음 → 대기 중인 무제한 이용권 첫 스캔으로 활성화
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

      // 무제한 활성화 시 활성 스캔권 모두 pause
      await supabase
        .from('user_entitlements')
        .update({ status: 'pending' })
        .eq('user_id', user.id)
        .in('type', ['scan5', 'trial', 'admin'])
        .eq('status', 'active');

      await supabase.from('scan_usage_logs').insert({
        user_id: user.id,
        type: 'scan_use',
        count: -1,
        entitlement_id: pendingSub.id,
        description: '스캔 사용 (무제한 첫 사용)',
      });

      return NextResponse.json({ success: true, type: 'subscription', entitlementId: pendingSub.id });
    }

    return NextResponse.json({ error: 'no_scans' }, { status: 403 });
  }

  // 3. 스캔권 차감 (scan_count 감소, row 유지)
  const scanRight = scanRights[0];

  const { error: updateError } = await supabase
    .from('user_entitlements')
    .update({ scan_count: scanRight.scan_count! - 1 })
    .eq('id', scanRight.id);

  if (updateError) {
    console.error('user_entitlements update error:', updateError);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  await supabase.from('scan_usage_logs').insert({
    user_id: user.id,
    type: 'scan_use',
    count: -1,
    entitlement_id: scanRight.id,
    description: '스캔 사용',
  });

  return NextResponse.json({ success: true, type: 'scan', entitlementId: scanRight.id });
}
