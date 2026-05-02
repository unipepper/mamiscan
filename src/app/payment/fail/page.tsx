'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

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
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        <p className="text-sm text-text-secondary">{desc}</p>
        <div className="flex flex-col gap-2 pt-2">
          {code !== 'PAY_PROCESS_CANCELED' && code !== 'PAY_PROCESS_ABORTED' ? (
            <Button variant="secondary" onClick={() => router.push('/home')} className="w-full">
              홈으로
            </Button>
          ) : (
            <Button onClick={() => router.back()} className="w-full">
              다시 시도하기
            </Button>
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
