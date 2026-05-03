'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Scan, ShieldCheck, Search, CheckCircle2, Calendar, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calcPregnancyWeek } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionLinkButton } from '@/components/ui/section-link-button';
import { BottomNav } from '@/components/BottomNav';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';

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
    <div className="flex flex-col flex-1 bg-bg-canvas pb-nav">
      {/* Header */}
      <header className="safe-top sticky top-0 z-50 w-full border-b border-border-subtle bg-bg-surface/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center -ml-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="마미스캔" style={{ width: 64, height: 64, borderRadius: 14, flexShrink: 0, objectFit: 'contain' }} />
            <span className="font-bold text-lg text-text-primary tracking-tight -ml-3">마미스캔</span>
          </div>
        </div>
      </header>

      <PwaInstallBanner />

      {/* Top Utility Area */}
      <div className="px-4 pt-6 pb-0 space-y-2">
        {isLoggedIn && profile?.name && (
          <p className="text-lg font-semibold text-text-primary px-1 pb-0.5">
            {profile.name}님, 안녕하세요 👋
          </p>
        )}
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
              className="flex-1 flex items-center gap-3 bg-bg-surface border border-border-subtle rounded-xl px-3 py-3 hover:bg-neutral-bg transition-colors"
            >
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-xs text-text-secondary leading-none mb-1.5">임신 주차</p>
                <p className="text-base font-bold text-text-primary leading-none truncate">
                  {calcPregnancyWeek(profile?.pregnancy_start_date) ? `${calcPregnancyWeek(profile?.pregnancy_start_date)}주차` : '설정하기'}
                </p>
              </div>
            </button>

            {/* 남은 스캔 / 무제한 */}
            <button
              onClick={() => router.push(isActive ? '/billing-history' : '/pricing')}
              className="flex-1 flex items-center justify-between gap-3 bg-bg-surface border border-border-subtle rounded-xl px-3 py-3 hover:bg-neutral-bg transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {isActive ? (
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <Scan className="w-4 h-4 text-secondary-strong shrink-0" />
                )}
                <div className="text-left min-w-0">
                  <p className="text-xs text-text-secondary leading-none mb-1.5">남은 스캔</p>
                  <p className={`text-base font-bold leading-none truncate ${isActive ? 'text-primary' : 'text-secondary-strong'}`}>
                    {isActive ? '무제한' : `${remainingScans}회`}
                  </p>
                </div>
              </div>
              {!isActive && (
                <span className="text-xs font-semibold text-secondary-strong bg-secondary/30 px-2.5 py-1.5 rounded-full shrink-0">충전</span>
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
      <section className="px-4 pt-4 pb-2">
        <div className="bg-accent rounded-[28px] px-6 pt-6 pb-5 relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-sm font-medium text-primary">
              엄마도 맛있게, 아가도 건강하게
            </span>
            <h1 className="text-[26px] leading-[35px] font-bold text-text-primary mt-1 mb-4">
              지금 먹어도 되는지<br />바로 확인해보세요
            </h1>
            <p className="text-sm text-text-secondary mb-6">
              임산부 기준 성분 분석부터<br />안전한 대체 제품 추천까지 5초면 충분해요.
            </p>
            <Button
              size="lg"
              onClick={() => router.push('/scan')}
              className="w-full gap-2"
            >
              <Scan className="w-4 h-4" />
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
                  placeholder="제품명으로 검색"
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
        <section className="px-4 pt-4 pb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-text-primary pl-2">최근 스캔</h2>
            <SectionLinkButton label="전체 보기" onClick={() => router.push('/history')} />
          </div>
          <div className="bg-bg-surface border border-border-subtle rounded-[24px] shadow-sm overflow-hidden">
            {recentScans.map((item: any, idx: number) => {
              const statusColor =
                item.status === 'success' ? 'bg-success-fg' :
                item.status === 'caution' ? 'bg-caution-fg' : 'bg-danger-fg';
              const statusLabel =
                item.status === 'success' ? '안전' :
                item.status === 'caution' ? '주의' : '위험';
              const badgeVariant: 'solid-success' | 'solid-caution' | 'solid-danger' =
                item.status === 'success' ? 'solid-success' :
                item.status === 'caution' ? 'solid-caution' : 'solid-danger';
              const resultData: any = item.result_json
                ? { ...(typeof item.result_json === 'string' ? JSON.parse(item.result_json) : item.result_json), ...(item.image_url ? { userImageUrl: item.image_url } : {}) }
                : null;
              return (
                <button
                  key={idx}
                  onClick={() => { if (resultData) { sessionStorage.setItem('resultData', JSON.stringify(resultData)); router.push('/result'); } }}
                  className={`w-full flex items-center px-4 py-3.5 gap-3 hover:bg-neutral-bg transition-colors text-left ${idx < recentScans.length - 1 ? 'border-b border-border-subtle' : ''}`}
                >
                  <div className={`w-1.5 h-8 rounded-full shrink-0 ${statusColor}`} />
                  <p className="flex-1 text-base font-medium text-text-primary truncate">{item.product_name}</p>
                  <Badge size="sm" variant={badgeVariant} className="shrink-0">{statusLabel}</Badge>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Features — 비로그인 또는 히스토리 없을 때 노출 */}
      {(!isLoggedIn || recentScans.length === 0) && (
        <section className="px-4 pt-4 pb-6 space-y-2">
          <p className="text-lg font-semibold text-text-primary px-1">
            이런 상황에서 써보세요
          </p>
          <div className="bg-bg-surface border border-border-subtle rounded-[24px] shadow-sm overflow-hidden">
            {[
              { icon: Scan, iconBg: 'bg-[#FAEEE9]', iconColor: 'text-primary', title: '먹어도 되는 건지 헷갈릴 때', desc: '제품 바코드나 식료품을 찍으면 5초 안에 분석해드려요.' },
              { icon: ShieldCheck, iconBg: 'bg-[#E8F0EC]', iconColor: 'text-secondary', title: '뱃속 아가가 커갈수록', desc: '주차에 맞게 주의 성분이 달라지니까, 지금 기준으로 다시 확인해드려요.' },
              { icon: Search, iconBg: 'bg-caution-bg', iconColor: 'text-caution-fg', title: '먹고 싶은데 찜찜할 때', desc: '비슷하지만 더 안심할 수 있는 제품을 바로 찾아드려요.' },
            ].map(({ icon: Icon, iconBg, iconColor, title, desc }, idx, arr) => (
              <div key={title} className="flex flex-col">
                <div className="flex items-start gap-4 px-4 py-4">
                <div className={`${iconBg} p-2.5 rounded-full shrink-0`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <div className="py-0.5">
                  <h3 className="text-base font-semibold text-text-primary mb-0.5">{title}</h3>
                  <p className="type-body-brief text-text-secondary">{desc}</p>
                </div>
                </div>
                {idx < arr.length - 1 && <div className="border-b border-border-subtle mx-8" />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trust */}
      <section className="px-4 py-6 bg-neutral-bg">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">믿을 수 있는 데이터 기준</h2>
          <p className="text-sm text-text-secondary px-4">
            식약처(MFDS), 미국 FDA, CDC 등<br />공신력 있는 기관의 임산부 가이드라인을 바탕으로 분석합니다.
          </p>
          <div className="flex justify-center items-center space-x-6 pt-2 opacity-50 grayscale">
            <div className="font-bold text-xl">MFDS</div>
            <div className="font-bold text-xl">FDA</div>
            <div className="font-bold text-xl">CDC</div>
          </div>
        </div>
      </section>

      <footer className="pt-10 pb-4 text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <Link href="/terms" className="text-xs text-text-tertiary hover:text-text-secondary transition-colors underline underline-offset-2">
            이용약관
          </Link>
          <span className="text-xs text-text-tertiary">·</span>
          <Link href="/privacy" className="text-xs text-text-tertiary hover:text-text-secondary transition-colors underline underline-offset-2">
            개인정보처리방침
          </Link>
        </div>
        <div className="text-[11px] text-text-disabled leading-relaxed px-4">
          <p>상호: 유니페퍼 · 대표자: 허윤희 · 사업자등록번호: 621-28-02323</p>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
