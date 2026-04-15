'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Scan, ShieldCheck, Search, ChevronRight, CheckCircle2, Star, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  pregnancy_weeks: number | null;
  subscription_status: string;
  subscription_expires_at: string | null;
  pending_monthly_at: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [remainingScans, setRemainingScans] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return; }

      const [{ data: prof }, { data: credits }] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('scan_credits').select('count').eq('user_id', user.id).gt('expires_at', new Date().toISOString()),
      ]);

      setProfile(prof);
      setRemainingScans(credits?.reduce((sum: number, c: any) => sum + c.count, 0) ?? 0);
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-canvas">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = profile?.subscription_status === 'active';
  const hasPendingMonthly = !!profile?.pending_monthly_at;

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-bg-surface/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-bold text-lg text-text-primary tracking-tight">마미스캔</span>
        </div>
      </header>

      {/* Scan Status Banner */}
      <div className="px-4 pt-4 space-y-2">
        {isActive ? (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-text-primary">무제한 스캔 이용 중</span>
          </div>
        ) : (
          <div
            className="bg-secondary/10 border border-secondary/20 rounded-xl p-3 flex items-center justify-between cursor-pointer"
            onClick={() => router.push('/pricing')}
          >
            <div className="flex items-center space-x-2">
              <Scan className="w-5 h-5 text-secondary" />
              <span className="text-sm font-medium text-text-primary">
                남은 스캔 횟수: <strong className="text-secondary">{remainingScans}회</strong>
              </span>
            </div>
            <span className="text-xs font-bold text-secondary bg-white px-2 py-1 rounded-full shadow-sm">충전하기</span>
          </div>
        )}
        {hasPendingMonthly && (
          <div className="bg-caution/10 border border-caution/20 rounded-xl p-3 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-caution shrink-0" />
            <span className="text-sm text-text-primary">
              스캔권 소진 후 <strong>1개월 무제한 이용권</strong>이 자동으로 시작돼요
            </span>
          </div>
        )}
      </div>

      {/* Hero */}
      <section className="px-4 pt-4 pb-6">
        <div className="bg-accent rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-start">
            <span className="text-sm font-semibold text-primary mb-1">식품 원재료표를 찍고</span>
            <h1 className="text-[26px] leading-[35px] font-bold text-text-primary mb-2">
              지금 먹어도 되는지<br />바로 확인해보세요
            </h1>
            <p className="text-sm text-text-secondary mb-5 max-w-[240px]">
              임산부 기준 성분 분석부터 안전한 대체 제품 추천까지 5초면 충분해요.
            </p>
            <Button className="w-full h-12 text-base font-semibold shadow-md" onClick={() => router.push('/scan')}>
              <Scan className="mr-2 h-5 w-5" />
              5초 안에 확인하기
            </Button>
          </div>
          <div className="absolute -right-6 -bottom-6 opacity-10">
            <Scan className="w-40 h-40 text-primary" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-4 space-y-4">
        <h2 className="text-[22px] leading-[30px] font-bold text-text-primary px-1">
          마미스캔이 도와드릴게요
        </h2>
        <div className="grid gap-4">
          {[
            { icon: Scan, color: 'primary', title: '바코드 스캔', desc: '마트에서 고민될 때, 제품 바코드나 식료품을 찍으면 바로 분석해드려요.' },
            { icon: ShieldCheck, color: 'secondary', title: '주차별 맞춤 판단', desc: '현재 임신 주차에 맞춰 주의해야 할 성분을 꼼꼼하게 체크해드려요.' },
            { icon: Search, color: 'caution', title: '안전한 대체 제품', desc: '주의 성분이 있다면, 안심하고 먹을 수 있는 비슷한 제품을 추천해드려요.' },
          ].map(({ icon: Icon, color, title, desc }) => (
            <Card key={title} className="bg-bg-surface border-border-subtle shadow-sm">
              <CardContent className="p-5 flex items-start space-x-4">
                <div className={`bg-${color}/10 p-3 rounded-full shrink-0`}>
                  <Icon className={`w-6 h-6 text-${color}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary mb-1">{title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="px-4 py-6 mt-2 bg-white border-y border-border-subtle">
        <div className="text-center space-y-3">
          <h2 className="text-[18px] font-bold text-text-primary">믿을 수 있는 데이터 기준</h2>
          <p className="text-sm text-text-secondary px-4">
            식약처(MFDS), 미국 FDA, CDC 등 공신력 있는 기관의 임산부 가이드라인을 바탕으로 분석합니다.
          </p>
          <div className="flex justify-center items-center space-x-6 pt-3 opacity-50 grayscale">
            <div className="font-bold text-xl">MFDS</div>
            <div className="font-bold text-xl">FDA</div>
            <div className="font-bold text-xl">CDC</div>
          </div>
        </div>
      </section>

      {/* My Info */}
      <section className="px-4 py-6 space-y-4">
        <h3 className="text-[18px] font-bold text-text-primary px-1">내 정보</h3>

        <Card
          className="bg-bg-surface border-border-subtle shadow-sm cursor-pointer hover:bg-neutral-bg transition-colors"
          onClick={() => router.push('/settings')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="font-medium text-text-primary block">현재 임신 주차</span>
                <span className="text-sm text-text-secondary">
                  {profile?.pregnancy_weeks ? `${profile.pregnancy_weeks}주차` : '설정하기'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-text-secondary" />
          </CardContent>
        </Card>

        <Card
          className="bg-bg-surface border-border-subtle shadow-sm cursor-pointer hover:bg-neutral-bg transition-colors"
          onClick={() => router.push('/pricing')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-secondary/10 p-2 rounded-full">
                <Star className="w-5 h-5 text-secondary" />
              </div>
              <div>
                {isActive ? (
                  <>
                    <span className="font-medium text-text-primary block mb-1">1개월 무제한 이용권</span>
                    {profile?.subscription_expires_at && (
                      <p className="text-xs text-text-secondary">
                        남은 기간: {Math.max(0, Math.ceil((new Date(profile.subscription_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}일
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-medium text-text-primary block">남은 스캔 횟수</span>
                    <span className="text-sm font-bold text-secondary">{remainingScans}회</span>
                  </>
                )}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-text-secondary" />
          </CardContent>
        </Card>
      </section>

      <BottomNav />
    </div>
  );
}
