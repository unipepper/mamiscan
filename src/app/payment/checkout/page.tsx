'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PLANS, type PlanType } from '@/lib/toss/plans';

declare global {
  interface Window {
    TossPayments: (clientKey: string) => {
      widgets: (options: { customerKey: string }) => TossWidgets;
    };
  }
}

interface TossWidgets {
  setAmount: (amount: { currency: string; value: number }) => Promise<void>;
  renderPaymentMethods: (options: { selector: string; variantKey?: string }) => Promise<void>;
  renderAgreement: (options: { selector: string; variantKey?: string }) => Promise<void>;
  requestPayment: (options: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerEmail?: string;
    customerName?: string;
  }) => Promise<void>;
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planType = (searchParams.get('plan') ?? 'scan5') as PlanType;
  const plan = PLANS[planType];

  const widgetsRef = useRef<TossWidgets | null>(null);
  const initializedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) {
      router.replace('/pricing');
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return; }
      setUserId(user.id);
    });

    // Toss SDK 로드
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v2/standard';
    script.async = true;
    script.onload = () => initWidgets();
    document.head.appendChild(script);

    return () => { document.head.removeChild(script); };
  }, []);

  async function initWidgets() {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tossPayments = window.TossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      const widgets = tossPayments.widgets({ customerKey: user.id });
      widgetsRef.current = widgets;

      await widgets.setAmount({ currency: 'KRW', value: plan.amount });
      await widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' });
      await widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' });
    } catch (err) {
      console.error('위젯 초기화 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    if (!widgetsRef.current || !userId) return;
    setPaying(true);

    const orderId = `${planType}-${userId}-${Date.now()}`;
    try {
      await widgetsRef.current.requestPayment({
        orderId,
        orderName: plan.orderName,
        successUrl: `${location.origin}/payment/success`,
        failUrl: `${location.origin}/payment/fail`,
      });
    } catch {
      setPaying(false);
    }
  }

  if (!plan) return null;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-sm text-gray-500 mb-6">← 뒤로</button>

        <h1 className="text-xl font-bold text-gray-900 mb-1">{plan.orderName}</h1>
        <p className="text-2xl font-bold text-pink-500 mb-6">{plan.amount.toLocaleString()}원</p>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div id="payment-method" />
        <div id="agreement" className="mt-4" />

        {!loading && (
          <button
            onClick={handlePay}
            disabled={paying}
            className="mt-6 w-full py-4 bg-pink-500 text-white font-semibold rounded-xl hover:bg-pink-600 disabled:opacity-60 transition"
          >
            {paying ? '처리 중...' : `${plan.amount.toLocaleString()}원 결제하기`}
          </button>
        )}
      </div>
    </div>
  );
}
