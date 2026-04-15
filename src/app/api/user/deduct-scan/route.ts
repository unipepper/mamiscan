import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 무제한 이용권이면 차감 불필요
  const { data: prof } = await supabase
    .from('users')
    .select('subscription_status, subscription_expires_at, pending_monthly_at')
    .eq('id', user.id)
    .single();

  if (prof?.subscription_status === 'active') {
    const expires = prof.subscription_expires_at ? new Date(prof.subscription_expires_at) : null;
    if (expires && expires > new Date()) {
      return NextResponse.json({ success: true, type: 'subscription' });
    }
    // 만료된 경우 status 초기화
    await supabase.from('users').update({ subscription_status: 'free' }).eq('id', user.id);
  }

  // FIFO: 만료 임박 순으로 scan_credits 차감
  const { data: credits } = await supabase
    .from('scan_credits')
    .select('id, count')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .gt('count', 0)
    .order('expires_at', { ascending: true })
    .limit(1);

  if (!credits || credits.length === 0) {
    // Case 1: 스캔권 소진/만료 후 대기 중인 무제한 이용권 자동 활성화
    if (prof?.pending_monthly_at) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await supabase
        .from('users')
        .update({
          subscription_status: 'active',
          subscription_expires_at: expiresAt.toISOString(),
          pending_monthly_at: null,
        })
        .eq('id', user.id);
      return NextResponse.json({ success: true, type: 'subscription' });
    }
    return NextResponse.json({ error: 'no_credits' }, { status: 403 });
  }

  const credit = credits[0];
  if (credit.count > 1) {
    await supabase.from('scan_credits').update({ count: credit.count - 1 }).eq('id', credit.id);
  } else {
    // 마지막 횟수 사용: count = 0으로 소진 처리 (row 유지, 감사 이력 보존)
    await supabase.from('scan_credits').update({ count: 0 }).eq('id', credit.id);

    if (prof?.pending_monthly_at) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await supabase
        .from('users')
        .update({
          subscription_status: 'active',
          subscription_expires_at: expiresAt.toISOString(),
          pending_monthly_at: null,
        })
        .eq('id', user.id);
    }
  }

  return NextResponse.json({ success: true, type: 'credit' });
}
