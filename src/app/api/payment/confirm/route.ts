import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PLANS, type PlanType } from '@/lib/toss/plans';
import { getTossBasicAuth } from '@/lib/toss/auth';

export async function POST(req: Request) {
  const { paymentKey, orderId, amount } = await req.json();

  // 1. planType 파싱 + 금액 검증
  const planType = orderId.split('-')[0] as PlanType;
  const plan = PLANS[planType];
  if (!plan || plan.amount !== amount) {
    return NextResponse.json({ error: 'amount_mismatch' }, { status: 400 });
  }

  // 2. Supabase에서 현재 유저 확인
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 3. 중복 결제 방지: orderId가 이미 transactions에 있으면 거부
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'duplicate_order' }, { status: 409 });
  }

  // 4. Toss 결제 승인
  const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: getTossBasicAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  if (!tossRes.ok) {
    const err = await tossRes.json();
    return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
  }

  // 5. DB 업데이트
  if (planType === 'scan5') {
    const grant = plan.grant as { type: 'scan'; count: number; validDays: number };
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + grant.validDays);

    const { error: insertError } = await supabase.from('scan_credits').insert({
      user_id: user.id,
      count: grant.count,
      expires_at: expiresAt.toISOString(),
    });
    if (insertError) {
      console.error('scan_credits insert error:', insertError);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }
  } else if (planType === 'monthly') {
    const grant = plan.grant as { type: 'subscription'; days: number };
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + grant.days);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscription_status: 'active',
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('id', user.id);
    if (updateError) {
      console.error('users update error:', updateError);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }
  }

  // 6. transactions INSERT
  const scanCount = planType === 'scan5'
    ? (plan.grant as { type: 'scan'; count: number; validDays: number }).count
    : null; // null = 무제한

  await supabase.from('transactions').insert({
    user_id: user.id,
    order_id: orderId,
    payment_key: paymentKey,
    type: 'purchase',
    amount,
    description: plan.orderName,
    price_krw: amount,
    count: scanCount,
    status: 'completed',
  });

  return NextResponse.json({ success: true, planType });
}
