'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const MESSAGES: Record<string, { title: string; desc: string }> = {
  PAY_PROCESS_CANCELED: {
    title: '결제를 취소했어요',
    desc: '결제가 취소됐어요. 다시 시도하거나 다른 결제 수단을 이용해 주세요.',
  },
  PAY_PROCESS_ABORTED: {
    title: '결제에 실패했어요',
    desc: '결제 처리 중 문제가 발생했어요. 다시 시도해 주세요.',
  },
};

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code') ?? '';
  const message = searchParams.get('message') ?? '';

  const { title, desc } = MESSAGES[code] ?? {
    title: '오류가 발생했어요',
    desc: message || '알 수 없는 오류가 발생했어요. 고객센터에 문의해 주세요.',
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="text-4xl">{code === 'PAY_PROCESS_CANCELED' ? '🙅' : '😥'}</div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{desc}</p>
        <div className="flex flex-col gap-2 pt-2">
          {code !== 'PAY_PROCESS_CANCELED' && code !== 'PAY_PROCESS_ABORTED' ? (
            <button
              onClick={() => router.push('/home')}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
            >
              홈으로
            </button>
          ) : (
            <button
              onClick={() => router.back()}
              className="w-full py-3 bg-pink-500 text-white rounded-xl font-medium"
            >
              다시 시도하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PaymentFailContent />
    </Suspense>
  );
}
