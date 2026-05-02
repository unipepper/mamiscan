'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Scan, ShieldCheck, Search, CheckCircle2, Calendar, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calcPregnancyWeek } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  pregnancy_start_date: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [remainingScans, setRemainingScans] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [hasPendingMonthly, setHasPendingMonthly] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      setIsLoggedIn(true);

      const now = new Date().toISOString();
      const [{ data: prof }, { data: scanRights }, { data: activeSub }, { data: pendingSub }, { data: recent }] = await Promise.all([
        supabase.from('users').select('id, email, name, pregnancy_start_date').eq('id', user.id).single(),
        supabase.from('user_entitlements').select('scan_count').eq('user_id', user.id).in('type', ['scan5', 'trial', 'admin']).eq('status', 'active').gt('expires_at', now).gt('scan_count', 0),
        supabase.from('user_entitlements').select('expires_at').eq('user_id', user.id).eq('type', 'monthly').eq('status', 'active').gt('expires_at', now).maybeSingle(),
        supabase.from('user_entitlements').select('id').eq('user_id', user.id).eq('type', 'monthly').eq('status', 'pending').maybeSingle(),
        supabase.from('scan_history').select('product_name, status, created_at, result_json, image_url').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
      ]);

      setProfile(prof);
      setRemainingScans(scanRights?.reduce((sum: number, c: any) => sum + c.scan_count, 0) ?? 0);
      setIsActive(!!activeSub);
      setHasPendingMonthly(!!pendingSub);
      setRecentScans(recent ?? []);
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


  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-bg-surface/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="마미스캔" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, objectFit: 'contain' }} />
            <span className="font-bold text-lg text-text-primary tracking-tight">마미스캔</span>
          </div>
        </div>
      </header>

      {/* Top Utility Area */}
      <div className="px-4 pt-4 pb-0 space-y-3">
        {!isLoggedIn ? (
          <div
            className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-between cursor-pointer"
            onClick={() => router.push('/login')}
          >
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-text-primary">로그인하고 무료로 시작하기</span>
            </div>
            <span className="text-xs font-medium text-primary bg-white px-2 py-1 rounded-full shadow-sm">시작하기</span>
          </div>
        ) : (
          <div className="flex gap-2">
            {/* 임신 주차 */}
            <button
              onClick={() => router.push('/settings')}
              className="flex-1 flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-xl px-3 py-3 hover:bg-neutral-bg transition-colors"
            >
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-[10px] text-text-secondary leading-none mb-1">임신 주차</p>
                <p className="text-sm font-semibold text-text-primary leading-none truncate">
                  {calcPregnancyWeek(profile?.pregnancy_start_date) ? `${calcPregnancyWeek(profile?.pregnancy_start_date)}주차` : '설정하기'}
                </p>
              </div>
            </button>

            {/* 남은 스캔 / 무제한 */}
            <button
              onClick={() => router.push(isActive ? '/billing-history' : '/pricing')}
              className="flex-1 flex items-center justify-between gap-2 bg-bg-surface border border-border-subtle rounded-xl px-3 py-3 hover:bg-neutral-bg transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isActive ? (
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <Scan className="w-4 h-4 text-secondary shrink-0" />
                )}
                <div className="text-left min-w-0">
                  <p className="text-[10px] text-text-secondary leading-none mb-1">남은 스캔</p>
                  <p className={`text-sm font-semibold leading-none truncate ${isActive ? 'text-primary' : 'text-secondary'}`}>
                    {isActive ? '무제한' : `${remainingScans}회`}
                  </p>
                </div>
              </div>
              {!isActive && (
                <span className="text-[10px] font-medium text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-full shrink-0">충전</span>
              )}
            </button>
          </div>
        )}

        {hasPendingMonthly && (
          <div className="bg-caution/10 border border-caution/20 rounded-xl p-3 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-caution shrink-0" />
            <span className="text-sm text-text-primary">
              5회 스캔권 소진 후 <strong>무제한 스캔권</strong>이 자동으로 시작돼요
            </span>
          </div>
        )}
      </div>

      {/* Hero */}
      <section className="px-4 pt-6 pb-0">
        <div className="bg-accent rounded-[28px] px-6 pt-6 pb-5 relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-sm font-medium text-primary">
              {isLoggedIn && profile?.name ? `${profile.name}님,` : '엄마도 맛있게, 아가도 건강하게'}
            </span>
            <h1 className="text-[26px] leading-[35px] font-bold text-text-primary mt-1 mb-2">
              지금 먹어도 되는지<br />바로 확인해보세요
            </h1>
            <p className="text-sm text-text-secondary mb-5">
              임산부 기준 성분 분석부터<br />안전한 대체 제품 추천까지 5초면 충분해요.
            </p>
            <Button
              size="lg"
              onClick={() => router.push('/scan')}
              className="w-full gap-2"
            >
              <Scan className="w-5 h-5" />
              5초 안에 확인하기
            </Button>

            {/* 제품명 검색 — 카드 안 */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchQuery.trim();
                if (q) router.push('/result?productName=' + encodeURIComponent(q));
              }}
              className="flex gap-2 mt-3"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제품명 검색"
                  className="w-full h-11 pl-9 pr-3 bg-white/80 border border-primary/20 rounded-2xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button
                type="submit"
                className="h-11 w-11 shrink-0 bg-white/80 border border-primary/20 rounded-2xl flex items-center justify-center active:bg-white/60 transition-colors"
                aria-label="검색"
              >
                <Search className="w-4 h-4 text-text-secondary" />
              </button>
            </form>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-10">
            <Scan className="w-72 h-72 text-primary" />
          </div>
        </div>
      </section>

      {/* Recent Scans */}
      {isLoggedIn && recentScans.length > 0 && (
        <section className="px-4 pt-8 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">최근 스캔</h2>
            <button
              onClick={() => router.push('/history')}
              className="flex items-center gap-0.5 text-xs font-medium text-text-secondary"
            >
              전체 보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="bg-bg-surface border border-border-subtle rounded-[24px] shadow-sm overflow-hidden">
            {recentScans.map((item: any, idx: number) => {
              const statusColor =
                item.status === 'success' ? 'bg-success-fg' :
                item.status === 'caution' ? 'bg-caution-fg' : 'bg-danger-fg';
              const statusLabel =
                item.status === 'success' ? '안전' :
                item.status === 'caution' ? '주의' : '위험';
              const statusTextColor =
                item.status === 'success' ? 'text-success-fg' :
                item.status === 'caution' ? 'text-caution-fg' : 'text-danger-fg';
              const statusBgColor =
                item.status === 'success' ? 'bg-success-bg' :
                item.status === 'caution' ? 'bg-caution-bg' : 'bg-danger-bg';
              let resultData: any = null;
              try { resultData = JSON.parse(item.result_json); if (item.image_url) resultData.userImageUrl = item.image_url; } catch {}
              return (
                <button
                  key={idx}
                  onClick={() => { if (resultData) { sessionStorage.setItem('scanResult', JSON.stringify(resultData)); router.push('/result'); } }}
                  className={`w-full flex items-center px-4 py-3.5 gap-3 hover:bg-neutral-bg transition-colors text-left ${idx < recentScans.length - 1 ? 'border-b border-border-subtle' : ''}`}
                >
                  <div className={`w-1.5 h-8 rounded-full shrink-0 ${statusColor}`} />
                  <p className="flex-1 text-sm font-medium text-text-primary truncate">{item.product_name}</p>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusBgColor} ${statusTextColor}`}>
                    {statusLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Features */}
      <section className="px-4 pt-6 pb-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary px-1">
          이렇게 도와드려요
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
                  <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
                  <p className="text-sm text-text-secondary">{desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="px-4 py-6 bg-bg-surface border-y border-border-subtle">
        <div className="text-center space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">믿을 수 있는 데이터 기준</h2>
          <p className="text-sm text-text-secondary px-4">
            식약처(MFDS), 미국 FDA, CDC 등<br />공신력 있는 기관의 임산부 가이드라인을 바탕으로 분석합니다.
          </p>
          <div className="flex justify-center items-center space-x-6 pt-3 opacity-50 grayscale">
            <div className="font-bold text-xl">MFDS</div>
            <div className="font-bold text-xl">FDA</div>
            <div className="font-bold text-xl">CDC</div>
          </div>
        </div>
      </section>


      <footer className="py-4 text-center flex items-center justify-center gap-3">
        <Link href="/terms" className="text-xs text-text-tertiary hover:text-text-secondary transition-colors underline underline-offset-2">
          이용약관
        </Link>
        <span className="text-xs text-text-tertiary">·</span>
        <Link href="/privacy" className="text-xs text-text-tertiary hover:text-text-secondary transition-colors underline underline-offset-2">
          개인정보처리방침
        </Link>
      </footer>

      <BottomNav />
    </div>
  );
}
