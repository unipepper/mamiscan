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

  // 스캔 크레딧/구독 회수
  const planType = tx.order_id?.split('-')[0];
  if (planType === 'scan5') {
    await supabase
      .from('scan_credits')
      .delete()
      .eq('user_id', user.id)
      .gte('created_at', tx.created_at)
      .order('created_at', { ascending: false })
      .limit(1);
  } else if (planType === 'monthly') {
    await supabase
      .from('users')
      .update({ subscription_status: 'free', subscription_expires_at: null })
      .eq('id', user.id);
  }

  await supabase
    .from('transactions')
    .update({ status: 'refunded' })
    .eq('id', transactionId);

  return NextResponse.json({ success: true, message: '환불이 완료됐어요. 결제 수단으로 3-5 영업일 내 반환됩니다.' });
}
