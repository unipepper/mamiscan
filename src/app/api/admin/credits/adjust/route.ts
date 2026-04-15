import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  // Admin 인증
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { userId, delta, reason } = await req.json();
  if (!userId || typeof delta !== 'number' || delta === 0) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  if (delta > 0) {
    // 증가: 항상 신규 lot 생성 (transaction_id 연결로 충전수량 추적 가능)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'deduct',
        amount: 0,
        count: delta,
        description: reason || '관리자 수동 조정',
        status: 'completed',
      })
      .select('id')
      .single();

    if (txError || !txData) {
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }

    await supabase.from('scan_credits').insert({
      user_id: userId,
      count: delta,
      expires_at: expiresAt.toISOString(),
      source: 'admin_adjust',
      transaction_id: txData.id,
    });
  } else {
    // 차감: FIFO (가장 먼저 만료되는 row부터)
    const absDelta = Math.abs(delta);
    const { data: credits } = await supabase
      .from('scan_credits')
      .select('id, count')
      .eq('user_id', userId)
      .gt('expires_at', now)
      .gt('count', 0)
      .order('expires_at', { ascending: true });

    if (!credits || credits.length === 0) {
      return NextResponse.json({ error: 'no_credits' }, { status: 400 });
    }

    let remaining = absDelta;
    for (const credit of credits) {
      if (remaining <= 0) break;
      if (credit.count > remaining) {
        await supabase
          .from('scan_credits')
          .update({ count: credit.count - remaining })
          .eq('id', credit.id);
        remaining = 0;
      } else {
        // 소진: count = 0으로 업데이트 (row 유지, 감사 이력 보존)
        await supabase.from('scan_credits').update({ count: 0 }).eq('id', credit.id);
        remaining -= credit.count;
      }
    }
  }

  // transactions 기록 (차감만 — 증가는 위에서 lot 생성 전에 이미 insert)
  if (delta < 0) {
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'deduct',
      amount: 0,
      count: delta,
      description: reason || '관리자 수동 조정',
      status: 'completed',
    });
  }

  // 최종 잔여 크레딧 합산
  const { data: remaining } = await supabase
    .from('scan_credits')
    .select('count')
    .eq('user_id', userId)
    .gt('expires_at', now)
    .gt('count', 0);

  const totalCount = remaining?.reduce((sum, r) => sum + r.count, 0) ?? 0;

  return NextResponse.json({ success: true, updatedCount: totalCount });
}
