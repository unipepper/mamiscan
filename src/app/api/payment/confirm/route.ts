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

  // 5. 현재 유저 구독 상태 조회 (중첩 케이스 처리용)
  const { data: prof } = await supabase
    .from('users')
    .select('subscription_status, subscription_expires_at')
    .eq('id', user.id)
    .single();

  const isActiveSub =
    prof?.subscription_status === 'active' &&
    prof?.subscription_expires_at &&
    new Date(prof.subscription_expires_at) > new Date();

  // 6. DB 업데이트
  if (planType === 'scan5') {
    const grant = plan.grant as { type: 'scan'; count: number; validDays: number };

    let expiresAt: Date;
    if (isActiveSub) {
      // Case 2: 무제한 이용 중 스캔권 구매 → 무제한 만료 후 14일
      expiresAt = new Date(prof!.subscription_expires_at!);
      expiresAt.setDate(expiresAt.getDate() + grant.validDays);
    } else {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + grant.validDays);
    }

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

    if (isActiveSub) {
      // Case 3: 무제한 이용 중 무제한 구매 → 현재 만료일에 30일 추가 (스택)
      const newExpiresAt = new Date(prof!.subscription_expires_at!);
      newExpiresAt.setDate(newExpiresAt.getDate() + grant.days);

      const { error: updateError } = await supabase
        .from('users')
        .update({ subscription_expires_at: newExpiresAt.toISOString() })
        .eq('id', user.id);
      if (updateError) {
        console.error('users update error (case3):', updateError);
        return NextResponse.json({ error: 'db_error' }, { status: 500 });
      }
    } else {
      // 유효한 스캔권이 있는지 확인 (Case 1)
      const { data: activeCredits } = await supabase
        .from('scan_credits')
        .select('id')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .gt('count', 0)
        .limit(1);

      if (activeCredits && activeCredits.length > 0) {
        // Case 1: 스캔권 잔여 중 무제한 구매 → 대기 등록 (스캔권 소진/만료 후 자동 활성화)
        const { error: updateError } = await supabase
          .from('users')
          .update({ pending_monthly_at: new Date().toISOString() })
          .eq('id', user.id);
        if (updateError) {
          console.error('users update error (case1):', updateError);
          return NextResponse.json({ error: 'db_error' }, { status: 500 });
        }
      } else {
        // 일반 케이스: 즉시 활성화
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
