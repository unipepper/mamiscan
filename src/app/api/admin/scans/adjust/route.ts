import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/admin-auth';

export async function POST(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.response;

  const { userId, delta, reason } = await req.json();
  if (!userId || typeof delta !== 'number' || delta === 0) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  if (delta > 0) {
    // 증가: 신규 이용권 lot 생성 (30일 유효)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 무제한 이용권 활성 중이면 pending으로 생성
    const { data: activeMonthly } = await supabase
      .from('user_entitlements')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'monthly')
      .eq('status', 'active')
      .gt('expires_at', now)
      .maybeSingle();

    const { data: entData, error: entError } = await supabase
      .from('user_entitlements')
      .insert({
        user_id: userId,
        type: 'admin',
        status: activeMonthly ? 'pending' : 'active',
        scan_count: delta,
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (entError || !entData) {
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }

    await supabase.from('scan_usage_logs').insert({
      user_id: userId,
      type: 'admin_grant',
      count: delta,
      entitlement_id: entData.id,
      description: reason || '관리자 수동 지급',
    });

  } else {
    // 차감: FIFO (만료 임박 순)
    const absDelta = Math.abs(delta);
    const { data: entitlements } = await supabase
      .from('user_entitlements')
      .select('id, scan_count')
      .eq('user_id', userId)
      .in('type', ['scan5', 'admin', 'trial'])
      .eq('status', 'active')
      .gt('expires_at', now)
      .gt('scan_count', 0)
      .order('expires_at', { ascending: true });

    if (!entitlements || entitlements.length === 0) {
      return NextResponse.json({ error: 'no_scans' }, { status: 400 });
    }

    let remaining = absDelta;
    for (const ent of entitlements) {
      if (remaining <= 0) break;
      const deduct = Math.min(ent.scan_count!, remaining);
      const newCount = ent.scan_count! - deduct;

      await supabase
        .from('user_entitlements')
        .update({ scan_count: newCount })
        .eq('id', ent.id);

      await supabase.from('scan_usage_logs').insert({
        user_id: userId,
        type: 'admin_deduct',
        count: -deduct,
        entitlement_id: ent.id,
        description: reason || '관리자 수동 차감',
      });

      remaining -= deduct;
    }
  }

  // 최종 잔여 스캔권 합산
  const { data: remaining } = await supabase
    .from('user_entitlements')
    .select('scan_count')
    .eq('user_id', userId)
    .in('type', ['scan5', 'admin', 'trial'])
    .eq('status', 'active')
    .gt('expires_at', now)
    .gt('scan_count', 0);

  const totalCount = remaining?.reduce((sum, r) => sum + (r.scan_count ?? 0), 0) ?? 0;

  return NextResponse.json({ success: true, updatedCount: totalCount });
}
