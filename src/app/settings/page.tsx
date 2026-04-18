'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Calendar, ChevronRight, LogOut, Loader2, MessageSquare, Pencil, X, Shield, Bell, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { getRemainingDays, formatSubscriptionDate } from '@/lib/subscription';
import { BottomNav } from '@/components/BottomNav';

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
  const [dialWeek, setDialWeek] = useState('12');
  const [weekSaveStatus, setWeekSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const weekPickerRef = useRef<HTMLDivElement>(null);
  const ITEM_H = 56;
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
          supabase.from('users').select('id, name, pregnancy_weeks').eq('id', user.id).single(),
          supabase.from('user_entitlements').select('scan_count').eq('user_id', user.id).in('type', ['scan5', 'trial', 'admin']).eq('status', 'active').gt('expires_at', now).gt('scan_count', 0),
          supabase.from('user_entitlements').select('started_at, expires_at').eq('user_id', user.id).eq('type', 'monthly').eq('status', 'active').gt('expires_at', now).maybeSingle(),
          supabase.from('user_entitlements').select('id').eq('user_id', user.id).eq('type', 'monthly').eq('status', 'pending').maybeSingle(),
        ]);
        setProfile(prof);
        setRemainingScans(scanRights?.reduce((s: number, c: any) => s + c.scan_count, 0) ?? 0);
        setActiveSubStartedAt(activeSub?.started_at ?? null);
        setActiveSubExpiresAt(activeSub?.expires_at ?? null);
        setHasPendingMonthly(!!pendingSub);
        if (prof?.pregnancy_weeks) setDialWeek(String(prof.pregnancy_weeks));
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
    if (!authUser) return;
    setWeekSaveStatus('saving');
    try {
      const supabase = createClient();
      const weeks = parseInt(dialWeek, 10);
      const { error } = await supabase
        .from('users')
        .update({ pregnancy_weeks: weeks })
        .eq('id', authUser.id);
      if (error) throw error;
      setProfile((prev: any) => ({ ...prev, pregnancy_weeks: weeks }));
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
        <section
          className="flex items-center space-x-4 cursor-pointer group"
          onClick={() => { setNicknameInput(profile?.name || ''); setShowNicknameSheet(true); }}
        >
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xl font-bold text-text-primary truncate">
                {profile?.name || '닉네임을 설정해주세요'}
              </h2>
              <Pencil className="w-4 h-4 text-text-secondary shrink-0 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-text-secondary truncate">{authUser.email}</p>
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
                    {activeSubExpiresAt && (
                      <p className="text-xs text-text-secondary mt-1">
                        이용 기간: {formatSubscriptionDate(activeSubStartedAt)} ~ {formatSubscriptionDate(activeSubExpiresAt)} (남은 기간: {getRemainingDays(activeSubExpiresAt)}일)
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
          {hasPendingMonthly && (
            <Card className="bg-caution/5 border-caution/20 shadow-sm">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-text-primary mb-1">1개월 무제한 이용권 대기 중</p>
                <p className="text-xs text-text-secondary">스캔권을 모두 소진하시면 무제한 이용권이 자동으로 시작돼요 (30일)</p>
              </CardContent>
            </Card>
          )}
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
<button className="w-full p-4 border-b border-border-subtle flex items-center justify-between hover:bg-neutral-bg transition-colors" onClick={() => router.push('/notices')}>
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5 text-text-secondary" />
                  <span className="font-medium text-text-primary">공지사항</span>
                </div>
                <div className="flex items-center gap-2">
                  {unreadNoticeCount > 0 && (
                    <span className="bg-danger-fg text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {unreadNoticeCount}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-text-secondary" />
                </div>
              </button>
              <button className="w-full p-4 border-b border-border-subtle flex items-center justify-between hover:bg-neutral-bg transition-colors" onClick={() => router.push('/support')}>
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-text-secondary" />
                  <span className="font-medium text-text-primary">고객센터 / 문의하기</span>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary" />
              </button>
              <button className="w-full p-4 border-b border-border-subtle flex items-center justify-between hover:bg-neutral-bg transition-colors" onClick={() => router.push('/terms')}>
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-text-secondary" />
                  <span className="font-medium text-text-primary">이용약관</span>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary" />
              </button>
              <button className="w-full p-4 border-b border-border-subtle flex items-center justify-between hover:bg-neutral-bg transition-colors" onClick={() => router.push('/privacy')}>
                <div className="flex items-center space-x-3">
                  <Shield className="w-5 h-5 text-text-secondary" />
                  <span className="font-medium text-text-primary">개인정보처리방침</span>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary" />
              </button>
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-bg transition-colors text-danger-fg" onClick={handleLogout}>
                <div className="flex items-center space-x-3">
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">로그아웃</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 계정 탈퇴 */}
        <section className="pb-4">
          <button
            onClick={() => setShowDeleteSheet(true)}
            className="w-full text-center text-xs text-text-tertiary underline underline-offset-2 hover:text-danger-fg transition-colors py-2"
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
                  '남은 스캔권 및 월간 이용권은 환불 없이 소멸돼요',
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
                  className="w-full h-12 rounded-2xl bg-danger-fg text-white font-bold text-sm hover:bg-danger-fg/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteStatus === 'deleting'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> 탈퇴 처리 중...</>
                    : <><Trash2 className="w-4 h-4" /> 탈퇴하기</>
                  }
                </button>
                <button
                  onClick={() => setShowDeleteSheet(false)}
                  disabled={deleteStatus === 'deleting'}
                  className="w-full h-12 rounded-2xl bg-bg-surface border border-border-subtle text-text-primary font-bold text-sm hover:bg-neutral-bg transition-colors disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                className="w-full font-bold h-12 rounded-2xl text-base"
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
