'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Calendar, ChevronRight, LogOut, Loader2, MessageSquare, Pencil, X, Bell, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { calcPregnancyWeek } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NotificationDot } from '@/components/ui/notification-dot';
import { createClient } from '@/lib/supabase/client';
import { getRemainingDays } from '@/lib/subscription';
import { BottomNav } from '@/components/BottomNav';

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
  const [dateInput, setDateInput] = useState('');
  const [weekSaveStatus, setWeekSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showNicknameSheet, setShowNicknameSheet] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameSaveStatus, setNicknameSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting'>('idle');

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
        if (prof?.pregnancy_start_date) setDateInput(prof.pregnancy_start_date);
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
    if (!authUser || !dateInput) return;
    setWeekSaveStatus('saving');
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('users')
        .update({ pregnancy_start_date: dateInput })
        .eq('id', authUser.id);
      if (error) throw error;
      setProfile((prev: any) => ({ ...prev, pregnancy_start_date: dateInput }));
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

  // Not logged in
  if (!authUser) {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas pb-20">
        <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
          <span className="text-lg font-semibold text-text-primary">내 정보</span>
        </header>
        <main className="px-6 py-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <User className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-4 leading-tight">
            마미스캔과 함께<br />안전한 임신 여정을 시작하세요
          </h1>
          <p className="text-text-secondary mb-10">로그인하시면 임신 주차 맞춤 분석과 히스토리 저장을 이용할 수 있어요.</p>
          <Button className="w-full h-12" onClick={() => router.push('/login')}>로그인 / 회원가입</Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-20">
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
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
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[18px] font-semibold text-text-primary">스캔권 정보</h3>
            <button onClick={() => router.push('/billing-history')} className="text-sm font-medium text-text-secondary hover:text-primary transition-colors flex items-center">
              전체 내역 보기 <ChevronRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
          <Card className="bg-bg-surface border-border-subtle shadow-sm">
            <CardContent className="p-5">
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
                  <Button variant="outline" size="sm" onClick={() => router.push('/pricing')}>충전하기</Button>
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
        <section className="space-y-4">
          <h3 className="text-[18px] font-semibold text-text-primary px-1">임신 정보</h3>
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
                    {calcPregnancyWeek(profile?.pregnancy_start_date) ? (
                      <p className="text-lg font-medium text-text-primary">{calcPregnancyWeek(profile?.pregnancy_start_date)}주차</p>
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
              </button>
              <div className={`mx-5 mb-5 rounded-xl px-4 py-3 flex items-center space-x-2 ${calcPregnancyWeek(profile?.pregnancy_start_date) ? 'bg-primary/5' : 'bg-neutral-bg'}`}>
                {calcPregnancyWeek(profile?.pregnancy_start_date) ? (
                  <>
                    <span className="text-sm shrink-0">✨</span>
                    <p className="text-xs text-primary font-medium leading-relaxed">{calcPregnancyWeek(profile?.pregnancy_start_date)}주차 맞춤 분석이 스캔 결과에 반영돼요</p>
                  </>
                ) : (
                  <p className="text-xs text-text-secondary leading-relaxed">마지막 생리일을 입력하면 스캔 결과에 주차별 맞춤 분석을 드려요</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="border-t border-border-subtle -mx-4" />

        {/* 링크 메뉴 */}
        <section>
          <Card className="bg-bg-surface border-border-subtle shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <button className="w-full p-4 border-b border-border-subtle flex items-center justify-between hover:bg-neutral-bg transition-colors" onClick={() => router.push('/notices')}>
                <div className="flex items-center space-x-3">
                  <Bell className="w-4 h-4 text-text-secondary" />
                  <span className="relative text-sm font-medium text-text-primary">
                    공지사항
                    {unreadNoticeCount > 0 && <NotificationDot />}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-secondary" />
              </button>
              <button className="w-full p-4 border-b border-border-subtle flex items-center justify-between hover:bg-neutral-bg transition-colors" onClick={() => router.push('/support')}>
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">고객센터 / 문의하기</span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-secondary" />
              </button>
              <button className="w-full p-4 flex items-center justify-between hover:bg-neutral-bg transition-colors" onClick={() => router.push('/policies')}>
                <div className="flex items-center space-x-3">
                  <FileText className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">약관 및 방침</span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-secondary" />
              </button>
            </CardContent>
          </Card>
        </section>

        {/* 로그아웃 */}
        <section>
          <Card className="bg-bg-surface border-border-subtle shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <button className="w-full p-4 flex items-center space-x-3 hover:bg-neutral-bg transition-colors text-danger-fg" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">로그아웃</span>
              </button>
            </CardContent>
          </Card>
        </section>

        {/* 회원 탈퇴 */}
        <section className="pb-4 flex items-center justify-center">
          <button
            onClick={() => setShowDeleteSheet(true)}
            className="text-xs text-text-tertiary underline underline-offset-2 hover:text-danger-fg transition-colors py-2"
          >
            회원 탈퇴
          </button>
        </section>
      </main>

      {/* 회원 탈퇴 확인 Bottom Sheet */}
      {showDeleteSheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteSheet(false)}>
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
                    <span className="text-danger-fg text-xs mt-0.5 shrink-0">•</span>
                    <p className="text-xs text-text-secondary leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pb-10">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteStatus === 'deleting'}
                  className="w-full h-12 rounded-2xl bg-danger-fg text-white text-sm hover:bg-danger-fg/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteStatus === 'deleting'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> 탈퇴 처리 중...</>
                    : <><Trash2 className="w-4 h-4" /> 탈퇴하기</>
                  }
                </button>
                <button
                  onClick={() => setShowDeleteSheet(false)}
                  disabled={deleteStatus === 'deleting'}
                  className="w-full h-12 rounded-2xl bg-bg-surface border border-border-subtle text-text-primary text-sm hover:bg-neutral-bg transition-colors disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pregnancy Start Date Bottom Sheet */}
      {showWeekDial && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowWeekDial(false)}>
          <div className="bg-bg-canvas w-full rounded-t-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-border-subtle rounded-full" /></div>
            <div className="px-6 pt-3 pb-2">
              <h3 className="text-lg font-bold text-text-primary">마지막 생리 시작일</h3>
              <p className="text-xs text-text-secondary mt-1">입력하신 날짜를 기준으로 임신 주차가 자동 계산돼요</p>
            </div>
            <div className="px-6 pb-2 pt-3">
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full h-14 px-4 rounded-2xl border-2 border-primary/30 bg-bg-surface text-text-primary text-base focus:outline-none focus:border-primary transition-colors"
              />
              {dateInput && calcPregnancyWeek(dateInput) && (
                <p className="text-sm text-primary font-medium mt-2 px-1">
                  현재 임신 {calcPregnancyWeek(dateInput)}주차로 계산돼요
                </p>
              )}
            </div>
            <div className="px-6 pb-10 pt-3">
              <Button onClick={handleDialSave} disabled={weekSaveStatus === 'saving' || !dateInput} className="w-full h-12 text-base">
                {weekSaveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : '저장하기'}
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
              <button onClick={() => setShowNicknameSheet(false)} className="p-1 text-text-secondary hover:text-text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
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
                  <button
                    onClick={() => setNicknameInput('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
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
