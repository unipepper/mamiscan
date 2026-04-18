import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTossBasicAuth } from '@/lib/toss/auth';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { transactionId, reason } = await req.json();
  if (!transactionId || !reason) {
    return NextResponse.json({ success: false, message: '요청 정보가 올바르지 않아요.' }, { status: 400 });
  }

  // 본인 거래 확인
  const { data: tx } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('user_id', user.id)
    .single();

  if (!tx) {
    return NextResponse.json({ success: false, message: '거래 내역을 찾을 수 없어요.' }, { status: 404 });
  }

  if (tx.status !== 'completed') {
    return NextResponse.json({ success: false, message: '이미 처리된 거래예요.' }, { status: 400 });
  }

  if (!tx.payment_key) {
    return NextResponse.json({ success: false, message: '결제 정보를 찾을 수 없어요. 고객센터로 문의해 주세요.' }, { status: 400 });
  }

  // 단순 변심: 스캔 이력 없으면 즉시 취소
  if (reason === 'simple') {
    const { count } = await supabase
      .from('scan_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', tx.created_at);

    if ((count ?? 0) > 0) {
      return NextResponse.json({
        success: false,
        message: '이용권 사용 이력이 있어 자동 환불이 어려워요. 고객센터로 문의해 주세요.',
      }, { status: 400 });
    }
  }

  // 연결된 이용권 조회 (Toss 호출 전 미리 확인)
  const { data: entitlement } = await supabase
    .from('user_entitlements')
    .select('id, scan_count')
    .eq('transaction_id', transactionId)
    .eq('user_id', user.id)
    .maybeSingle();

  // Toss 결제 취소 API 호출
  const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${tx.payment_key}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: getTossBasicAuth(),
      'Content-Type': 'application/json',
      'Idempotency-Key': `refund-${transactionId}`,
    },
    body: JSON.stringify({
      cancelReason: reason === 'simple' ? '단순 변심' : '중복/오류 결제',
    }),
  });

  if (!tossRes.ok) {
    const err = await tossRes.json();
    console.error('Toss cancel error:', err);
    return NextResponse.json({
      success: false,
      message: `토스 환불 처리에 실패했어요. 고객센터로 문의해 주세요. (${err.code})`,
    }, { status: 400 });
  }

  // DB 업데이트 (RPC로 원자 처리 — 이용권 회수 + 로그 + 거래 상태를 하나의 트랜잭션으로 묶음)
  const { error: rpcError } = await supabase.rpc('process_refund', {
    p_user_id:        user.id,
    p_transaction_id: transactionId,
    p_entitlement_id: entitlement?.id ?? null,
    p_revoked_count:  entitlement?.scan_count ?? 0,
  });

  if (rpcError) {
    // Toss 취소는 완료됐으나 DB 업데이트 실패 — 수동 복구 필요
    console.error('process_refund RPC error:', rpcError, { transactionId, userId: user.id });
    return NextResponse.json({
      success: false,
      message: '환불은 처리됐으나 내부 오류가 발생했어요. 고객센터로 문의해 주세요.',
    }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: '환불이 완료됐어요. 결제 수단으로 3-5 영업일 내 반환됩니다.' });
}
