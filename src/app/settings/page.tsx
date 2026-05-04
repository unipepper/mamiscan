'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Calendar, ChevronRight, LogOut, Loader2, MessageSquare, Pencil, X, Bell, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { calcPregnancyWeek, weeksToStartDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NotificationDot } from '@/components/ui/notification-dot';
import { SectionLinkButton } from '@/components/ui/section-link-button';
import { createClient } from '@/lib/supabase/client';
import { getRemainingDays } from '@/lib/subscription';
import { BottomNav } from '@/components/BottomNav';
import { HintCheckbox } from '@/components/ui/hint-checkbox';

const PREGNANCY_INFO: Record<number, string> = {
  1: '착상이 이루어지고 있어요. 엄마 몸이 임신을 준비하는 중이에요.',
  2: '배아가 자궁벽에 자리를 잡고 있어요.',
  3: '신경관이 형성되기 시작해요. 엽산이 특히 중요한 시기예요.',
  4: '심장과 뇌의 기초가 만들어지고 있어요.',
  5: '아기의 심장이 뛰기 시작해요. 크기는 참깨 한 알 정도예요.',
  6: '팔다리의 싹이 생기기 시작해요. 얼굴 윤곽도 조금씩 잡혀가요.',
  7: '손가락과 발가락이 나뉘기 시작해요. 크기는 블루베리 정도예요.',
  8: '모든 주요 장기가 형성되는 중이에요. 크기는 강낭콩 정도예요.',
  9: '손가락이 완전히 분리되었어요. 아기가 작은 움직임을 해요.',
  10: '손톱이 자라기 시작해요. 크기는 딸기 정도로 자랐어요.',
  11: '아기가 하품을 하기 시작해요. 뼈가 단단해지고 있어요.',
  12: '손가락 지문이 생기기 시작해요. 크기는 라임 정도예요.',
  13: '성별이 구분되기 시작해요. 얼굴 표정을 만들 수 있어요.',
  14: '아기가 빛에 반응할 수 있어요. 크기는 복숭아 정도예요.',
  15: '청각이 발달해요. 엄마 목소리를 들을 수 있기 시작해요.',
  16: '눈이 빛을 감지할 수 있어요. 크기는 아보카도 정도예요.',
  17: '지방이 쌓이기 시작해요. 아기가 삼키는 연습을 해요.',
  18: '태동을 처음 느낄 수 있는 시기예요. 크기는 고구마 정도예요.',
  19: '피부를 보호하는 태지가 생겨요. 감각기관이 발달해요.',
  20: '임신 절반을 지났어요! 아기 키가 약 25cm 정도 됐어요.',
  21: '아기가 소리에 반응해요. 손가락을 빠는 연습을 해요.',
  22: '눈썹과 속눈썹이 생겨요. 크기는 파파야 정도예요.',
  23: '폐가 발달하고 있어요. 아기가 꿈을 꿀 수도 있어요.',
  24: '생존 가능성이 높아지는 시기예요. 뇌가 빠르게 발달해요.',
  25: '손의 파악 반사가 생겨요. 크기는 순무 정도예요.',
  26: '눈을 뜨고 감을 수 있어요. 폐 발달이 활발해요.',
  27: '뇌 발달이 매우 빠른 시기예요. 크기는 콜리플라워 정도예요.',
  28: '3분기가 시작됐어요. 아기가 방향을 바꿔 머리가 아래로 향해요.',
  29: '뼈가 완전히 단단해지고 있어요. 근육도 발달해요.',
  30: '아기의 뇌가 뚜렷한 주름을 갖기 시작해요. 크기는 양배추 정도예요.',
  31: '면역 시스템이 발달해요. 아기가 킥을 더 강하게 해요.',
  32: '손발톱이 완성됐어요. 크기는 스쿼시 정도예요.',
  33: '뼈가 점점 단단해져요. 폐가 거의 완성되고 있어요.',
  34: '중추신경계가 완성돼요. 크기는 멜론 정도예요.',
  35: '신장이 완전히 발달했어요. 간이 노폐물을 처리해요.',
  36: '아기의 뺨에 지방이 통통하게 쌓여요. 곧 만날 준비 중이에요.',
  37: '만삭에 가까워졌어요. 아기가 언제든 나올 수 있어요.',
  38: '아기의 모든 기관이 완성됐어요. 크기는 수박 정도예요.',
  39: '아기가 태어날 준비가 거의 다 됐어요. 곧 만나요!',
  40: '출산 예정일이에요! 아기를 곧 만나게 될 거예요.',
  41: '예정일이 지났어요. 의사와 상의하며 경과를 지켜봐요.',
  42: '출산이 매우 임박했어요. 병원과 긴밀히 연락하세요.',
};

function getPregnancyInfo(week: number | null): string | null {
  if (!week) return null;
  return PREGNANCY_INFO[Math.min(Math.max(week, 1), 42)] ?? null;
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatExpiresAt(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const hours = d.getHours();
  const ampm = hours < 12 ? '오전' : '오후';
  const h = hours % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${date} (${ampm} ${h}:${min}까지)`;
}

export default function SettingsPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [remainingScans, setRemainingScans] = useState(0);
  const [activeSubStartedAt, setActiveSubStartedAt] = useState<string | null>(null);
  const [activeSubExpiresAt, setActiveSubExpiresAt] = useState<string | null>(null);
  const [hasPendingMonthly, setHasPendingMonthly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const [showWeekDial, setShowWeekDial] = useState(false);
  const [weekDialMode, setWeekDialMode] = useState<'weeks' | 'lmp'>('weeks');
  const [weekNumInput, setWeekNumInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [weekSaveStatus, setWeekSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lmpError, setLmpError] = useState<string | null>(null);
  const [showNicknameSheet, setShowNicknameSheet] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameSaveStatus, setNicknameSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting'>('idle');
  const [deleteAgreed, setDeleteAgreed] = useState(false);
  const [showDeleteHint, setShowDeleteHint] = useState(false);
  const [shakeDeleteCheckbox, setShakeDeleteCheckbox] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'kakao' | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setAuthUser(user);
      if (user) {
        const now = new Date().toISOString();
        const [{ data: prof }, { data: scanRights }, { data: activeSub }, { data: pendingSub }] = await Promise.all([
          supabase.from('users').select('id, name, pregnancy_start_date').eq('id', user.id).single(),
          supabase.from('user_entitlements').select('scan_count').eq('user_id', user.id).in('type', ['scan5', 'trial', 'admin']).eq('status', 'active').gt('expires_at', now).gt('scan_count', 0),
          supabase.from('user_entitlements').select('started_at, expires_at').eq('user_id', user.id).eq('type', 'monthly').eq('status', 'active').gt('expires_at', now).maybeSingle(),
          supabase.from('user_entitlements').select('id').eq('user_id', user.id).eq('type', 'monthly').eq('status', 'pending').maybeSingle(),
        ]);
        setProfile(prof);
        setRemainingScans(scanRights?.reduce((s: number, c: any) => s + c.scan_count, 0) ?? 0);
        setActiveSubStartedAt(activeSub?.started_at ?? null);
        setActiveSubExpiresAt(activeSub?.expires_at ?? null);
        setHasPendingMonthly(!!pendingSub);
        if (prof?.pregnancy_start_date) {
          setDateInput(prof.pregnancy_start_date);
          const w = calcPregnancyWeek(prof.pregnancy_start_date);
          if (w) setWeekNumInput(String(w));
        }
        if (prof?.name) setNicknameInput(prof.name);

        // 미읽음 공지 수 조회
        const { data: allNotices } = await supabase.from('notices').select('id');
        const { data: readNotices } = await supabase
          .from('user_notice_reads')
          .select('notice_id')
          .eq('user_id', user.id);
        const readSet = new Set((readNotices ?? []).map((r: any) => r.notice_id));
        setUnreadNoticeCount((allNotices ?? []).filter((n: any) => !readSet.has(n.id)).length);
      }
      setLoading(false);
    });
  }, []);

  const handleDialSave = async () => {
    if (!authUser) return;
    let startDate: string | null = null;
    if (weekDialMode === 'weeks') {
      const w = parseInt(weekNumInput, 10);
      startDate = w >= 1 && w <= 42 ? weeksToStartDate(w) : null;
    } else {
      if (!dateInput) return;
      const d = new Date(dateInput);
      const now = new Date();
      const minDate = new Date();
      minDate.setDate(now.getDate() - 42 * 7);
      if (d > now) {
        setLmpError('마지막 생리일은 오늘보다 이전 날짜여야 해요.');
        return;
      }
      if (d < minDate) {
        setLmpError('마지막 생리일 기준으로 42주가 지났어요. 이미 출산하셨나요?');
        return;
      }
      setLmpError(null);
      startDate = dateInput;
    }
    if (!startDate) return;
    setWeekSaveStatus('saving');
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('users')
        .update({ pregnancy_start_date: startDate })
        .eq('id', authUser.id);
      if (error) throw error;
      setProfile((prev: any) => ({ ...prev, pregnancy_start_date: startDate }));
      setWeekSaveStatus('saved');
      setTimeout(() => { setWeekSaveStatus('idle'); setShowWeekDial(false); }, 1500);
    } catch {
      setWeekSaveStatus('idle');
    }
  };

  const handleNicknameSave = async () => {
    if (!nicknameInput.trim() || !authUser) return;
    setNicknameSaveStatus('saving');
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('users')
        .update({ name: nicknameInput.trim() })
        .eq('id', authUser.id);
      if (error) throw error;
      setProfile((prev: any) => ({ ...prev, name: nicknameInput.trim() }));
      setNicknameSaveStatus('saved');
      setTimeout(() => { setNicknameSaveStatus('idle'); setShowNicknameSheet(false); }, 1200);
    } catch (e: any) {
      console.error('[nickname] error:', e?.message);
      setNicknameSaveStatus('error');
      setTimeout(() => setNicknameSaveStatus('idle'), 2000);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const loginWithGoogle = async () => {
    setOauthError(null);
    setOauthLoading('google');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/api/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
    if (error) { setOauthError('Google 로그인에 실패했어요. 다시 시도해 주세요.'); setOauthLoading(null); }
  };

  const loginWithKakao = async () => {
    setOauthError(null);
    setOauthLoading('kakao');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${location.origin}/api/auth/callback`, scopes: 'account_email' },
    });
    if (error) { setOauthError('카카오 로그인에 실패했어요. 다시 시도해 주세요.'); setOauthLoading(null); }
  };

  const handleDeleteAccount = async () => {
    if (deleteStatus === 'deleting') return;
    setDeleteStatus('deleting');
    try {
      const res = await fetch('/api/user/delete', { method: 'POST' });
      if (!res.ok) throw new Error('delete failed');
      router.push('/home');
    } catch {
      setDeleteStatus('idle');
      alert('탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-canvas">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = !!activeSubExpiresAt;

  if (!authUser) {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas pb-nav">
        <header className="safe-top sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-surface/80 backdrop-blur-md border-b border-border-subtle">
          <span className="text-lg font-semibold text-text-primary">내 정보</span>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <User className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-4 leading-tight">
            마미스캔과 함께<br />안전한 임신 여정을 시작하세요
          </h1>
          <p className="text-sm text-text-tertiary mb-10 leading-relaxed">
            임신 중 먹거리 고민, 혼자 하지 마세요.<br />임신 주차에 맞게 알려드려요.
          </p>
          <div className="w-full space-y-2">
            <Button
              variant="outline"
              onClick={loginWithGoogle}
              disabled={!!oauthLoading}
              className="w-full gap-3 rounded-xl h-12"
            >
              {oauthLoading === 'google' ? (
                <div className="w-5 h-5 border-2 border-border-subtle border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Google로 계속하기
            </Button>
            <Button
              onClick={loginWithKakao}
              disabled={!!oauthLoading}
              className="w-full gap-3 rounded-xl h-12 bg-[#FEE500] text-[#3C1E1E] hover:bg-[#F5DC00] shadow-sm"
            >
              {oauthLoading === 'kakao' ? (
                <div className="w-5 h-5 border-2 border-[#3C1E1E]/40 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#3C1E1E">
                  <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.68 5.07 4.2 6.48L5.1 21l4.62-2.52c.72.12 1.47.18 2.28.18 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
                </svg>
              )}
              카카오로 계속하기
            </Button>
            {oauthError && <p className="text-sm text-danger-fg">{oauthError}</p>}
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-nav">
      <header className="safe-top sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-surface/80 backdrop-blur-md border-b border-border-subtle">
        <span className="text-lg font-semibold text-text-primary">내 정보</span>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Profile */}
        <section
          className="cursor-pointer group pt-2"
          onClick={() => { setNicknameInput(profile?.name || ''); setShowNicknameSheet(true); }}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[22px] leading-[30px] font-bold text-text-primary truncate">
                  {profile?.name || '닉네임을 설정해주세요'}
                </h2>
                <Pencil className="w-4 h-4 text-text-tertiary shrink-0 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm text-text-tertiary truncate mt-0.5">{authUser.email}</p>
            </div>
          </div>
        </section>

        {/* Subscription */}
        <section>
          <div className="flex items-center justify-between px-1 mb-2">
            <h3 className="text-[18px] font-semibold text-text-primary">스캔권 정보</h3>
            <SectionLinkButton label="전체 내역 보기" onClick={() => router.push('/billing-history')} />
          </div>
          <Card className="bg-bg-surface border-border-subtle shadow-sm">
            <CardContent className="p-4">
              {isActive ? (
                <>
                  <p className="font-semibold text-primary mb-3">무제한 스캔권 사용 중</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-text-tertiary mb-1">만료일</p>
                      <p className="text-sm text-text-secondary">{formatExpiresAt(activeSubExpiresAt)}</p>
                    </div>
                    <p className="text-2xl font-bold text-text-primary">{getRemainingDays(activeSubExpiresAt)}<span className="text-sm font-medium text-text-secondary ml-1">일 남음</span></p>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">남은 스캔 횟수</p>
                    <p className="text-2xl font-bold text-text-primary">{remainingScans}<span className="text-sm font-medium text-text-secondary ml-1">회</span></p>
                  </div>
                  <Button size="sm" onClick={() => router.push('/pricing')} className="font-semibold text-sm">충전하기</Button>
                </div>
              )}
            </CardContent>
          </Card>
          {hasPendingMonthly && (
            <Card className="bg-caution/5 border-caution/20 shadow-sm">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-text-primary mb-1">무제한 스캔권 대기 중</p>
                <p className="text-xs text-text-secondary">5회 스캔권을 모두 소진하시면 무제한 스캔권이 자동으로 시작돼요 (30일)</p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Pregnancy Info */}
        <section className="mt-6">
          <h3 className="text-[18px] font-semibold text-text-primary px-1 mb-2">임신 정보</h3>
          <Card className="bg-bg-surface border-border-subtle shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Button
                variant="ghost"
                onClick={() => setShowWeekDial(true)}
                className="w-full p-4 justify-between h-auto"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-text-secondary mb-0.5">현재 임신 주차</p>
                    {calcPregnancyWeek(profile?.pregnancy_start_date) ? (
                      <p className="text-lg font-medium text-text-primary"><span className="font-bold">{calcPregnancyWeek(profile?.pregnancy_start_date)}</span>주차</p>
                    ) : (
                      <p className="text-sm font-medium text-text-secondary">마지막 생리일을 입력해주세요</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {weekSaveStatus === 'saving' && <span className="text-xs text-text-secondary">저장 중...</span>}
                  {weekSaveStatus === 'saved' && <span className="text-xs text-primary font-medium">저장됨 ✓</span>}
                  <ChevronRight className="w-5 h-5 text-text-secondary" />
                </div>
              </Button>
              {(() => {
                const week = calcPregnancyWeek(profile?.pregnancy_start_date);
                const info = getPregnancyInfo(week);
                return (
                  <div className="mx-4 mb-4 space-y-2">
                    {info && (
                      <div className="bg-bg-canvas rounded-xl px-4 py-3 flex items-center space-x-2">
                        <span className="text-sm shrink-0">🐣</span>
                        <p className="text-xs text-text-secondary leading-relaxed">{info}</p>
                      </div>
                    )}
                    <div className="bg-primary/10 rounded-xl px-4 py-3 flex items-center space-x-2">
                      <span className="text-sm shrink-0">✨</span>
                      <p className="text-xs text-primary font-medium leading-relaxed">
                        {week ? `${week}주차 맞춤 분석이 스캔 결과에 반영돼요` : '마지막 생리일을 입력하면 스캔 결과에 주차별 맞춤 분석을 드려요'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </section>

        <div className="border-t border-border-subtle -mx-4" />

        {/* 링크 메뉴 */}
        <section>
          <Card className="bg-bg-surface border-border-subtle shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Button variant="ghost" className="w-full p-4 border-b border-border-subtle justify-between h-auto rounded-none" onClick={() => router.push('/notices')}>
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5 text-text-secondary" />
                  <span className="relative text-base font-medium text-text-primary">
                    공지사항
                    {unreadNoticeCount > 0 && <NotificationDot />}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary" />
              </Button>
              <Button variant="ghost" className="w-full p-4 border-b border-border-subtle justify-between h-auto rounded-none" onClick={() => router.push('/support')}>
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-text-secondary" />
                  <span className="text-base font-medium text-text-primary">고객센터 / 문의하기</span>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary" />
              </Button>
              <Button variant="ghost" className="w-full p-4 justify-between h-auto rounded-none" onClick={() => router.push('/policies')}>
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-text-secondary" />
                  <span className="text-base font-medium text-text-primary">약관 및 방침</span>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary" />
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* 로그아웃 */}
        <section>
          <Card className="bg-bg-surface border-border-subtle shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Button variant="ghost" className="w-full p-4 justify-start gap-3 h-auto text-danger-fg rounded-none" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
                <span className="text-base font-medium">로그아웃</span>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* 회원 탈퇴 */}
        <section className="pb-4 flex items-center justify-center">
          <Button
            variant="link"
            size="sm"
            onClick={() => setShowDeleteSheet(true)}
            className="text-text-tertiary hover:text-danger-fg"
          >
            회원 탈퇴
          </Button>
        </section>
      </main>

      {/* 회원 탈퇴 확인 Bottom Sheet */}
      {showDeleteSheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowDeleteSheet(false); setDeleteAgreed(false); setShowDeleteHint(false); }}>
          <div className="bg-bg-canvas w-full rounded-t-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border-subtle rounded-full" />
            </div>
            <div className="px-6 pt-4 pb-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-danger-fg/10 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-danger-fg" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">정말 탈퇴하시겠어요?</h3>
                  <p className="text-xs text-text-secondary mt-0.5">탈퇴 후에는 복구가 불가능해요</p>
                </div>
              </div>

              <div className="bg-neutral-bg rounded-2xl p-4 space-y-2.5 mb-6">
                {[
                  '스캔 기록, 임신 주차 등 모든 데이터가 즉시 삭제돼요',
                  '남은 5회 스캔권 및 무제한 스캔권은 환불 없이 소멸돼요',
                  '결제·거래 기록은 전자상거래법에 따라 5년간 보관돼요',
                ].map((text) => (
                  <div key={text} className="flex items-start gap-2">
                    <span className="text-danger-fg text-sm mt-0.5 shrink-0">•</span>
                    <p className="text-sm text-text-secondary leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              <HintCheckbox
                checked={deleteAgreed}
                onChange={setDeleteAgreed}
                label="안내를 확인하였으며, 이에 동의합니다"
                hint="동의 후 탈퇴를 진행할 수 있어요"
                showHint={showDeleteHint}
                shaking={shakeDeleteCheckbox}
                className="mb-5 pl-2"
              />

              <div className="space-y-2 pb-10">
                <Button
                  variant="danger"
                  onClick={!deleteAgreed ? () => {
                    setShowDeleteHint(true);
                    setShakeDeleteCheckbox(true);
                    setTimeout(() => setShakeDeleteCheckbox(false), 500);
                  } : handleDeleteAccount}
                  disabled={deleteStatus === 'deleting'}
                  className="w-full gap-2"
                >
                  {deleteStatus === 'deleting'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> 탈퇴 처리 중...</>
                    : <><Trash2 className="w-4 h-4" /> 탈퇴하기</>
                  }
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setShowDeleteSheet(false); setDeleteAgreed(false); setShowDeleteHint(false); }}
                  disabled={deleteStatus === 'deleting'}
                  className="w-full"
                >
                  취소
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pregnancy Week Bottom Sheet */}
      {showWeekDial && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowWeekDial(false)}>
          <div className="bg-bg-canvas w-full rounded-t-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-border-subtle rounded-full" /></div>
            <div className="px-6 pt-3 pb-2">
              <h3 className="text-lg font-bold text-text-primary">임신 주차 설정</h3>
            </div>
            <div className="px-6 pb-2 pt-1 space-y-3">
              {/* 탭 토글 */}
              <div className="flex bg-neutral-bg rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setWeekDialMode('weeks')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    weekDialMode === 'weeks'
                      ? 'bg-bg-surface text-text-primary shadow-sm'
                      : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  현재 주차로 입력
                </button>
                <button
                  type="button"
                  onClick={() => setWeekDialMode('lmp')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    weekDialMode === 'lmp'
                      ? 'bg-bg-surface text-text-primary shadow-sm'
                      : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  마지막 생리일로 입력
                </button>
              </div>

              {weekDialMode === 'weeks' ? (
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={42}
                      value={weekNumInput}
                      onChange={(e) => setWeekNumInput(e.target.value)}
                      placeholder="예) 12"
                      className="w-full h-14 px-4 rounded-2xl border-2 border-primary/30 bg-bg-surface text-text-primary text-base placeholder:text-text-disabled focus:outline-none focus:border-primary transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">주차</span>
                  </div>
                  {weekNumInput && !(parseInt(weekNumInput, 10) >= 1 && parseInt(weekNumInput, 10) <= 42) && (
                    <p className="text-xs text-danger-fg pl-1 mt-1">1–42 사이 숫자를 입력해주세요</p>
                  )}
                  {parseInt(weekNumInput, 10) >= 1 && parseInt(weekNumInput, 10) <= 42 && (
                    <p className="text-sm text-primary font-medium mt-2 px-1">임신 {parseInt(weekNumInput, 10)}주차로 저장돼요</p>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type="date"
                    value={dateInput}
                    onChange={(e) => { setDateInput(e.target.value); setLmpError(null); }}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full h-14 px-4 rounded-2xl border-2 border-primary/30 bg-bg-surface text-text-primary text-base focus:outline-none focus:border-primary transition-colors"
                  />
                  {lmpError && (
                    <p className="text-xs text-danger-fg mt-1 px-1">{lmpError}</p>
                  )}
                  {!lmpError && dateInput && calcPregnancyWeek(dateInput) && (
                    <p className="text-sm text-primary font-medium mt-2 px-1">
                      현재 임신 {calcPregnancyWeek(dateInput)}주차로 계산돼요
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 pb-10 pt-3">
              <Button
                onClick={handleDialSave}
                disabled={weekSaveStatus === 'saving' || (
                  weekDialMode === 'weeks'
                    ? !(parseInt(weekNumInput, 10) >= 1 && parseInt(weekNumInput, 10) <= 42)
                    : !dateInput
                )}
                className="w-full h-12 text-base"
              >
                {weekSaveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : weekSaveStatus === 'saved' ? '저장됨 ✓' : '저장하기'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Nickname Bottom Sheet */}
      {showNicknameSheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowNicknameSheet(false)}>
          <div className="bg-bg-canvas w-full rounded-t-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-border-subtle rounded-full" /></div>
            <div className="px-6 pt-3 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-text-primary">닉네임 설정</h3>
                <p className="text-xs text-text-secondary mt-0.5">앱에서 표시될 이름을 입력해주세요</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowNicknameSheet(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="px-6 pb-2">
              <div className="relative">
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNicknameSave()}
                  placeholder="예) 하늘이맘, 토순이맘, 별이맘"
                  maxLength={20}
                  autoFocus
                  className="w-full h-14 px-4 rounded-2xl border-2 border-primary/30 bg-bg-surface text-text-primary text-base font-medium placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors"
                />
                {nicknameInput.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setNicknameInput('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-text-secondary hover:text-text-primary"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-text-secondary mt-2 px-1">태명+맘으로 입력해보세요 (예: 하늘이맘)</p>
            </div>
            <div className="px-6 pb-10 pt-2">
              <Button
                type="button"
                onClick={handleNicknameSave}
                disabled={!nicknameInput.trim() || nicknameSaveStatus === 'saving'}
                className="w-full h-12 rounded-2xl text-base"
              >
                {nicknameSaveStatus === 'saving' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : nicknameSaveStatus === 'saved' ? (
                  '저장됨 ✓'
                ) : nicknameSaveStatus === 'error' ? (
                  '저장 실패 — 다시 시도해주세요'
                ) : (
                  '저장하기'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
