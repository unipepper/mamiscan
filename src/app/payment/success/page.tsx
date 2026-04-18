'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Clock, Zap } from 'lucide-react';
import { PLANS, type PlanType } from '@/lib/toss/plans';

type Status = 'loading' | 'success' | 'error';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [planType, setPlanType] = useState<PlanType | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [remainingScans, setRemainingScans] = useState(0);
  const [showPendingModal, setShowPendingModal] = useState(false);

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
          if (data.isPending) {
            setIsPending(true);
            setRemainingScans(data.remainingScans ?? 0);
            setShowPendingModal(true);
          }
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
        {planType === 'monthly' && !isPending && (
          <p className="text-sm text-gray-500">30일간 무제한으로 이용할 수 있어요.</p>
        )}
        {planType === 'monthly' && isPending && (
          <p className="text-sm text-gray-500">
            남은 스캔권 소진 후 무제한 이용권이 자동으로 시작돼요.
          </p>
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

      {/* 대기 안내 팝업 */}
      {showPendingModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-center w-12 h-12 bg-pink-50 rounded-full mx-auto">
                <Clock className="w-6 h-6 text-pink-500" />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="font-bold text-lg text-gray-900">무제한 이용권 대기 중</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  현재 남은 스캔권을 모두 사용하면<br />
                  무제한 이용권이 자동으로 시작돼요.
                </p>
              </div>
              <div className="bg-pink-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-pink-500" />
                  <span className="text-sm font-medium text-gray-700">현재 잔여 스캔권</span>
                </div>
                <span className="text-lg font-bold text-pink-500">{remainingScans}회</span>
              </div>
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                스캔권 {remainingScans}회를 모두 사용하거나 만료되면<br />
                30일 무제한 이용권이 자동으로 활성화돼요.
              </p>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowPendingModal(false)}
                className="w-full py-3 bg-pink-500 text-white rounded-xl font-bold"
              >
                확인했어요
              </button>
            </div>
          </div>
        </div>
      )}
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
