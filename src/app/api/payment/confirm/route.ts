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

  // 2. 유저 확인
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 3. 중복 결제 방지
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
  // 5-1. transactions INSERT (결제 기록)
  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      order_id: orderId,
      payment_key: paymentKey,
      type: 'purchase',
      amount,
      description: plan.orderName,
      price_krw: amount,
      status: 'completed',
    })
    .select('id')
    .single();

  if (txError || !txData) {
    console.error('transactions insert error:', txError);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  if (planType === 'scan5') {
    const grant = plan.grant as { type: 'scan'; count: number; validDays: number };

    // 무제한 이용 중 스캔권 구매 → 무제한 만료일부터 유효기간 시작
    const { data: activeSub } = await supabase
      .from('user_entitlements')
      .select('expires_at')
      .eq('user_id', user.id)
      .eq('type', 'monthly')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const expiresAt = activeSub?.expires_at
      ? new Date(activeSub.expires_at)
      : new Date();
    expiresAt.setDate(expiresAt.getDate() + grant.validDays);

    // 5-2. user_entitlements INSERT (이용권 생성)
    const { data: entData, error: entError } = await supabase
      .from('user_entitlements')
      .insert({
        user_id: user.id,
        type: 'scan5',
        status: 'active',
        scan_count: grant.count,
        transaction_id: txData.id,
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (entError || !entData) {
      console.error('user_entitlements insert error:', entError);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }

    // 5-3. scan_usage_logs INSERT (지급 이벤트 기록)
    const { error: logError } = await supabase
      .from('scan_usage_logs')
      .insert({
        user_id: user.id,
        type: 'purchase_grant',
        count: grant.count,
        entitlement_id: entData.id,
        transaction_id: txData.id,
        description: plan.orderName,
      });

    if (logError) {
      console.error('scan_usage_logs insert error:', logError);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }

  } else if (planType === 'monthly') {
    const grant = plan.grant as { type: 'subscription'; days: number };

    // 현재 활성 구독 확인
    const { data: activeSub } = await supabase
      .from('user_entitlements')
      .select('id, expires_at')
      .eq('user_id', user.id)
      .eq('type', 'monthly')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (activeSub) {
      // 무제한 이용 중 재구매 → 만료일에 30일 추가 (스택)
      const newExpiresAt = new Date(activeSub.expires_at!);
      newExpiresAt.setDate(newExpiresAt.getDate() + grant.days);

      const { error: updateError } = await supabase
        .from('user_entitlements')
        .update({ expires_at: newExpiresAt.toISOString() })
        .eq('id', activeSub.id);

      if (updateError) {
        console.error('user_entitlements update error (stack):', updateError);
        return NextResponse.json({ error: 'db_error' }, { status: 500 });
      }

      // scan_usage_logs INSERT (스택 지급 기록)
      await supabase.from('scan_usage_logs').insert({
        user_id: user.id,
        type: 'purchase_grant',
        count: 0,
        entitlement_id: activeSub.id,
        transaction_id: txData.id,
        description: `${plan.orderName} (기간 연장)`,
      });

    } else {
      // 신규 구독: pending 상태로 생성, 첫 스캔 시 활성화
      const { data: entData, error: entError } = await supabase
        .from('user_entitlements')
        .insert({
          user_id: user.id,
          type: 'monthly',
          status: 'pending',
          scan_count: null,
          transaction_id: txData.id,
          expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 첫 스캔 시 갱신
        })
        .select('id')
        .single();

      if (entError || !entData) {
        console.error('user_entitlements insert error:', entError);
        return NextResponse.json({ error: 'db_error' }, { status: 500 });
      }

      // scan_usage_logs INSERT (구매 기록)
      await supabase.from('scan_usage_logs').insert({
        user_id: user.id,
        type: 'purchase_grant',
        count: 0,
        entitlement_id: entData.id,
        transaction_id: txData.id,
        description: plan.orderName,
      });

      // 스캔권 잔여 중 구매 → 잔여 수량 계산 (팝업 안내용)
      const { data: activeCredits } = await supabase
        .from('user_entitlements')
        .select('scan_count')
        .eq('user_id', user.id)
        .eq('type', 'scan5')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .gt('scan_count', 0);

      const remainingCredits = (activeCredits ?? []).reduce((sum, c) => sum + (c.scan_count ?? 0), 0);
      if (remainingCredits > 0) {
        return NextResponse.json({ success: true, planType, isPending: true, remainingCredits });
      }
    }
  }

  return NextResponse.json({ success: true, planType });
}
