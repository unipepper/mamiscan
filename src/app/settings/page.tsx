'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Calendar, Bell, ChevronRight, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { BottomNav } from '@/components/BottomNav';

export default function SettingsPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [remainingScans, setRemainingScans] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showWeekDial, setShowWeekDial] = useState(false);
  const [dialWeek, setDialWeek] = useState('12');
  const [weekSaveStatus, setWeekSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const weekPickerRef = useRef<HTMLDivElement>(null);
  const ITEM_H = 56;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setAuthUser(user);
      if (user) {
        const [{ data: prof }, { data: credits }] = await Promise.all([
          supabase.from('users').select('*').eq('id', user.id).single(),
          supabase.from('scan_credits').select('count').eq('user_id', user.id).gt('expires_at', new Date().toISOString()),
        ]);
        setProfile(prof);
        setRemainingScans(credits?.reduce((s: number, c: any) => s + c.count, 0) ?? 0);
        if (prof?.pregnancy_weeks) setDialWeek(String(prof.pregnancy_weeks));
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (showWeekDial && weekPickerRef.current) {
      setTimeout(() => {
        if (weekPickerRef.current) {
          weekPickerRef.current.scrollTop = (parseInt(dialWeek) - 1) * ITEM_H;
        }
      }, 50);
    }
  }, [showWeekDial]);

  const handleDialSave = async () => {
    setWeekSaveStatus('saving');
    try {
      const res = await fetch('/api/user/pregnancy-weeks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeks: parseInt(dialWeek, 10) }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev: any) => ({ ...prev, pregnancy_weeks: parseInt(dialWeek, 10) }));
        setWeekSaveStatus('saved');
        setTimeout(() => { setWeekSaveStatus('idle'); setShowWeekDial(false); }, 1500);
      } else {
        setWeekSaveStatus('idle');
      }
    } catch {
      setWeekSaveStatus('idle');
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-canvas">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = profile?.subscription_status === 'active';

  // Not logged in
  if (!authUser) {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas pb-20">
        <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
          <span className="font-bold text-lg text-text-primary">내 정보</span>
        </header>
        <main className="px-6 py-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <User className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-4 leading-tight">
            마미스캔과 함께<br />안전한 임신 여정을 시작하세요
          </h1>
          <p className="text-text-secondary mb-10">로그인하시면 임신 주차 맞춤 분석과 히스토리 저장을 이용할 수 있어요.</p>
          <Button className="w-full font-bold h-12" onClick={() => router.push('/login')}>로그인 / 회원가입</Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-20">
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <span className="font-bold text-lg text-text-primary">내 정보</span>
      </header>

      <main className="px-4 py-6 space-y-8">
        {/* Profile */}
        <section className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">{profile?.full_name || authUser.email?.split('@')[0]} 님</h2>
            <p className="text-sm text-text-secondary">{authUser.email}</p>
          </div>
        </section>

        {/* Subscription */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[18px] font-bold text-text-primary">이용권 정보</h3>
            <button onClick={() => router.push('/billing-history')} className="text-sm font-medium text-text-secondary hover:text-primary transition-colors flex items-center">
              전체 내역 보기 <ChevronRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
          <Card className="bg-bg-surface border-border-subtle shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                {isActive ? (
                  <>
                    <p className="font-bold text-primary mb-1">무제한 이용권 사용 중</p>
                    <p className="text-sm text-text-secondary">횟수 제한 없이 스캔 가능합니다.</p>
                    {profile?.subscription_expires_at && (
                      <p className="text-xs text-text-secondary mt-1">
                        남은 기간: {Math.max(0, Math.ceil((new Date(profile.subscription_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}일
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-bold text-text-primary mb-1">남은 스캔 횟수: <span className="text-secondary">{remainingScans}회</span></p>
                    <p className="text-sm text-text-secondary">추가 스캔이 필요하신가요?</p>
                  </>
                )}
              </div>
              {!isActive && (
                <Button variant="outline" size="sm" onClick={() => router.push('/pricing')}>충전하기</Button>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Pregnancy Info */}
        <section className="space-y-4">
          <h3 className="text-[18px] font-bold text-text-primary px-1">임신 정보</h3>
          <Card className="bg-bg-surface border-border-subtle shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <button
                onClick={() => setShowWeekDial(true)}
                className="w-full p-5 flex items-center justify-between hover:bg-neutral-bg transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-text-secondary mb-0.5">현재 임신 주차</p>
                    {profile?.pregnancy_weeks ? (
                      <p className="text-lg font-bold text-text-primary">{profile.pregnancy_weeks}주차</p>
                    ) : (
                      <p className="text-sm font-medium text-text-secondary">주차를 입력해주세요</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {weekSaveStatus === 'saving' && <span className="text-xs text-text-secondary">저장 중...</span>}
                  {weekSaveStatus === 'saved' && <span className="text-xs text-primary font-medium">저장됨 ✓</span>}
                  <ChevronRight className="w-5 h-5 text-text-secondary" />
                </div>
              </button>
              <div className={`mx-5 mb-5 rounded-xl px-4 py-3 flex items-center space-x-2 ${profile?.pregnancy_weeks ? 'bg-primary/5' : 'bg-neutral-bg'}`}>
                {profile?.pregnancy_weeks ? (
                  <>
                    <span className="text-sm shrink-0">✨</span>
                    <p className="text-xs text-primary font-medium leading-relaxed">{profile.pregnancy_weeks}주차 맞춤 분석이 스캔 결과에 반영돼요</p>
                  </>
                ) : (
                  <p className="text-xs text-text-secondary leading-relaxed">주차를 입력하면 스캔 결과에 주차별 맞춤 분석을 드려요</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* App Settings */}
        <section className="space-y-4">
          <h3 className="text-[18px] font-bold text-text-primary px-1">앱 설정</h3>
          <Card className="bg-bg-surface border-border-subtle shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4 border-b border-border-subtle flex items-center justify-between opacity-50 cursor-not-allowed">
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5 text-text-secondary" />
                  <span className="font-medium text-text-primary">알림 설정</span>
                </div>
                <span className="text-xs text-text-tertiary bg-neutral-bg px-2 py-0.5 rounded-full">준비 중</span>
              </div>
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-bg transition-colors text-danger-fg" onClick={handleLogout}>
                <div className="flex items-center space-x-3">
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">로그아웃</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Week Dial Bottom Sheet */}
      {showWeekDial && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowWeekDial(false)}>
          <div className="bg-bg-canvas w-full rounded-t-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-border-subtle rounded-full" /></div>
            <div className="px-6 pt-3 pb-2 text-center">
              <h3 className="text-lg font-bold text-text-primary">몇 주차이세요?</h3>
              <p className="text-xs text-text-secondary mt-1">주차에 맞는 맞춤 분석을 드릴게요</p>
            </div>
            <div className="relative mx-auto w-48 h-[168px] overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-bg-canvas to-transparent pointer-events-none z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-bg-canvas to-transparent pointer-events-none z-10" />
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-14 border-y-2 border-primary/30 bg-primary/5 pointer-events-none z-10 rounded-xl" />
              <div
                ref={weekPickerRef}
                onScroll={() => {
                  if (weekPickerRef.current) {
                    const idx = Math.round(weekPickerRef.current.scrollTop / ITEM_H);
                    setDialWeek(String(Math.min(42, Math.max(1, idx + 1))));
                  }
                }}
                className="h-full overflow-y-scroll"
                style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', paddingTop: 56, paddingBottom: 56 }}
              >
                {Array.from({ length: 42 }, (_, i) => i + 1).map((w) => (
                  <div
                    key={w}
                    style={{ scrollSnapAlign: 'center', height: ITEM_H }}
                    className={`flex items-center justify-center text-2xl font-bold transition-colors ${parseInt(dialWeek) === w ? 'text-primary' : 'text-text-secondary/40'}`}
                  >
                    {w}주차
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-8 pt-4">
              <Button onClick={handleDialSave} disabled={weekSaveStatus === 'saving'} className="w-full font-bold h-12 rounded-2xl text-base">
                {weekSaveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : '저장하기'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
