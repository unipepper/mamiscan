'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PLANS, type PlanType } from '@/lib/toss/plans';

type Status = 'loading' | 'success' | 'error';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [planType, setPlanType] = useState<PlanType | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = Number(searchParams.get('amount'));

    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      setErrorMessage('결제 정보가 올바르지 않아요.');
      return;
    }

    const parsed = orderId.split('-')[0] as PlanType;
    setPlanType(parsed);

    fetch('/api/payment/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage(data.message ?? '결제 승인에 실패했어요.');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMessage('네트워크 오류가 발생했어요.');
      });
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">결제를 확인하는 중이에요...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">😢</div>
          <h2 className="text-lg font-bold text-gray-900">결제 승인에 실패했어요</h2>
          <p className="text-sm text-gray-500">{errorMessage}</p>
          <button
            onClick={() => router.push('/payment/checkout')}
            className="w-full py-3 bg-pink-500 text-white rounded-xl font-medium"
          >
            다시 시도하기
          </button>
        </div>
      </div>
    );
  }

  const plan = planType ? PLANS[planType] : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold text-gray-900">결제가 완료됐어요!</h2>
        {plan && (
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-pink-500">{plan.orderName}</span>이 활성화됐어요.
          </p>
        )}
        {planType === 'scan5' && (
          <p className="text-sm text-gray-500">5회 이용권이 추가됐어요. 14일 이내에 사용해 주세요.</p>
        )}
        {planType === 'monthly' && (
          <p className="text-sm text-gray-500">30일간 무제한으로 이용할 수 있어요.</p>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => router.push('/scan')}
            className="w-full py-3 bg-pink-500 text-white rounded-xl font-medium"
          >
            스캔하러 가기
          </button>
          <button
            onClick={() => router.push('/home')}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
