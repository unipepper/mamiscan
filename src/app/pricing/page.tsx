'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CheckCircle2, Sparkles, Star, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

export default function PricingPage() {
  const router = useRouter();
  const [remainingScans, setRemainingScans] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const now = new Date().toISOString();
      const [{ data: scanRights }, { data: activeSub }] = await Promise.all([
        supabase
          .from('user_entitlements')
          .select('scan_count')
          .eq('user_id', user.id)
          .in('type', ['scan5', 'trial', 'admin'])
          .eq('status', 'active')
          .gt('expires_at', now)
          .gt('scan_count', 0),
        supabase
          .from('user_entitlements')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'monthly')
          .eq('status', 'active')
          .gt('expires_at', now)
          .maybeSingle(),
      ]);
      setIsActive(!!activeSub);
      setRemainingScans(scanRights?.reduce((s: number, c: any) => s + c.scan_count, 0) ?? 0);
    });
  }, []);

  const headingText = () => {
    if (isActive) return '더 많은 기능을 이용해보세요';
    if (remainingScans === null) return '스캔권 구매';
    if (remainingScans > 0) return `스캔권을 추가로 충전할 수 있어요`;
    return '무료 체험 스캔권을\n모두 사용했어요';
  };

  const subText = () => {
    if (remainingScans !== null && remainingScans > 0) {
      return `잔여 스캔권 ${remainingScans}회가 남아 있어요.\n추가로 충전하면 더 오래 이용할 수 있어요.`;
    }
    return '장볼 때마다 계속 확인하려면 스캔권이 필요해요.';
  };

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas safe-bottom pb-8">
      <header className="safe-top sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-text-primary">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-medium ml-2 text-text-primary">스캔권 구매</span>
      </header>

      <main className="px-4 py-6 space-y-8">
        <section className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-[26px] leading-[35px] font-bold text-text-primary whitespace-pre-line">
            {headingText()}
          </h1>
          <p className="text-sm text-text-secondary whitespace-pre-line">
            {subText()}
          </p>
        </section>

        <section className="space-y-4">
          {/* 1개월 무제한 */}
          <Card className="bg-accent border-2 border-primary shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
              가장 추천
            </div>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-2">
                <Star className="w-5 h-5 text-primary fill-primary" />
                <h2 className="text-lg font-semibold text-text-primary">무제한 스캔권</h2>
              </div>
              <p className="text-xs text-text-secondary mb-4">여러 제품을 비교해서 확인한다면 1개월 무제한이 가장 편해요.</p>
              <div className="mb-4">
                <span className="text-3xl font-bold text-text-primary">5,800원</span>
                <span className="text-sm text-text-secondary ml-1">/ 30일</span>
                <p className="text-sm text-primary font-medium mt-1">정상가 6,900원 (베타 특별가)</p>
              </div>
              <ul className="space-y-3 mb-6">
                {[
                  '30일 동안 횟수 제한 없이 스캔',
                  '임신 주차 반영 개인화 분석',
                  '스캔 히스토리 무제한 저장',
                ].map((item) => (
                  <li key={item} className="flex items-start space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm text-text-primary">{item}</span>
                  </li>
                ))}
                <li className="flex items-start space-x-2 mt-2 pt-2 border-t border-primary/20">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm font-medium text-primary">자동결제 아님 (필요할 때 다시 구매 가능)</span>
                </li>
              </ul>
              <Button
                size="lg"
                className="w-full"
                onClick={() => router.push('/payment/checkout?plan=monthly')}
              >
                1개월 무제한 시작하기
              </Button>
            </CardContent>
          </Card>

          {/* 5회 추가권 */}
          <Card className="bg-bg-surface border border-border-subtle shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-neutral-bg text-text-secondary text-xs font-medium px-3 py-1 rounded-bl-lg">
              부담 없이 시작
            </div>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="w-5 h-5 text-text-secondary" />
                <h2 className="text-lg font-semibold text-text-primary">5회 추가권</h2>
              </div>
              <p className="text-xs text-text-secondary mb-4">조금만 더 써보고 싶다면 5회 추가권을 선택할 수 있어요.</p>
              <div className="mb-4">
                <span className="text-2xl font-bold text-text-primary">1,800원</span>
                <span className="text-sm text-text-secondary ml-1">/ 5회</span>
                <p className="text-sm text-text-secondary mt-1 line-through">정상가 2,400원</p>
              </div>
              <ul className="space-y-3 mb-6">
                {['결제 후 14일 동안 사용 가능', '상세 분석 및 히스토리 제공'].map((item) => (
                  <li key={item} className="flex items-start space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                    <span className="text-sm text-text-primary">{item}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => router.push('/payment/checkout?plan=scan5')}
              >
                5회 추가권 구매하기
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
