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

  // 5. DB 업데이트 (RPC로 원자 처리 — 트랜잭션 + 이용권 + 로그를 하나의 트랜잭션으로 묶음)
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

    const { error: rpcError } = await supabase.rpc('confirm_scan5_purchase', {
      p_user_id:     user.id,
      p_order_id:    orderId,
      p_payment_key: paymentKey,
      p_amount:      amount,
      p_description: plan.orderName,
      p_scan_count:  grant.count,
      p_expires_at:  expiresAt.toISOString(),
      p_status:      activeSub ? 'pending' : 'active',
    });

    if (rpcError) {
      console.error('confirm_scan5_purchase RPC error:', rpcError, { orderId, paymentKey });
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

      const { error: rpcError } = await supabase.rpc('confirm_monthly_stack', {
        p_user_id:        user.id,
        p_order_id:       orderId,
        p_payment_key:    paymentKey,
        p_amount:         amount,
        p_description:    plan.orderName,
        p_entitlement_id: activeSub.id,
        p_new_expires_at: newExpiresAt.toISOString(),
      });

      if (rpcError) {
        console.error('confirm_monthly_stack RPC error:', rpcError, { orderId, paymentKey });
        return NextResponse.json({ error: 'db_error' }, { status: 500 });
      }

    } else {
      // 신규 구독
      const { error: rpcError } = await supabase.rpc('confirm_monthly_new', {
        p_user_id:     user.id,
        p_order_id:    orderId,
        p_payment_key: paymentKey,
        p_amount:      amount,
        p_description: plan.orderName,
      });

      if (rpcError) {
        console.error('confirm_monthly_new RPC error:', rpcError, { orderId, paymentKey });
        return NextResponse.json({ error: 'db_error' }, { status: 500 });
      }

      // 스캔권 잔여 중 구매 → 잔여 수량 계산 (팝업 안내용)
      const { data: activeScanRights } = await supabase
        .from('user_entitlements')
        .select('scan_count')
        .eq('user_id', user.id)
        .eq('type', 'scan5')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .gt('scan_count', 0);

      const remainingScans = (activeScanRights ?? []).reduce((sum, c) => sum + (c.scan_count ?? 0), 0);
      if (remainingScans > 0) {
        return NextResponse.json({ success: true, planType, isPending: true, remainingScans });
      }
    }
  }

  return NextResponse.json({ success: true, planType });
}
