'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Search, Lock, BookOpen, ShieldCheck, ArrowRight, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { BottomNav } from '@/components/BottomNav';

const DUMMY_HISTORY = [
  { date: '오늘', items: [
    { name: '풀무원 국산콩 두부', status: 'success', time: '오전 11:23' },
    { name: '오뚜기 진라면 순한맛', status: 'caution', time: '오전 10:05' },
  ]},
  { date: '어제', items: [
    { name: '매일유업 소화가 잘 되는 우유', status: 'success', time: '오후 3:41' },
  ]},
];

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  // 시간을 제거하고 날짜만 비교
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nowOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays <= 7) return '이번 주';
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

export default function HistoryPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<any>(null);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'kakao' | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [groupedHistory, setGroupedHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setAuthUser(user);
      if (!user) { setIsLoading(false); return; }

      const now = new Date().toISOString();
      // access-policy: 아래 셋 중 하나면 히스토리 접근 허용
      // 1. monthly active (무제한 이용권 활성 중)
      // 2. monthly pending (스캔권 소진 전 무제한 대기 중)
      // 3. 유료 결제 이력 1건 이상 (type='purchase')
      const [{ data: subscription }, { data: purchaseHistory }] = await Promise.all([
        supabase
          .from('user_entitlements')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'monthly')
          .or(`status.eq.pending,and(status.eq.active,expires_at.gt.${now})`)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'purchase')
          .limit(1)
          .maybeSingle(),
      ]);
      const active = !!subscription || !!purchaseHistory;
      setIsActive(active);

      if (active) {
        const { data: history } = await supabase
          .from('scan_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (history) {
          const grouped: Record<string, any[]> = {};
          history.forEach((row: any) => {
            const label = getRelativeDate(row.created_at);
            if (!grouped[label]) grouped[label] = [];
            grouped[label].push({
              name: row.product_name,
              status: row.status,
              time: new Date(row.created_at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }),
              resultData: (() => {
                if (!row.result_json) return null;
                const parsed = typeof row.result_json === 'string'
                  ? (() => { try { return JSON.parse(row.result_json); } catch { return null; } })()
                  : row.result_json;
                if (!parsed) return null;
                if (row.image_url) parsed.userImageUrl = row.image_url;
                return parsed;
              })(),
            });
          });
          setGroupedHistory(Object.entries(grouped).map(([date, items], id) => ({ id, date, items })));
        }
      }
      setIsLoading(false);
    });
  }, []);

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

  // 비교 테스트: '/result' | '/result-notion' | '/result-cal'
  const RESULT_ROUTE = '/result';

  const navigateToResult = (resultData: any) => {
    if (!resultData) return;
    sessionStorage.setItem('resultData', JSON.stringify(resultData));
    window.location.href = RESULT_ROUTE;
  };

  const filtered = groupedHistory.map((group) => ({
    ...group,
    items: group.items.filter((item: any) =>
      search === '' || item.name?.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-nav">
      <header className="safe-top sticky top-0 z-50 px-4 bg-bg-surface/80 backdrop-blur-md border-b border-border-subtle">
        <div className="flex items-center h-14">
          <span className="text-lg font-semibold text-text-primary">스캔 히스토리</span>
        </div>
      </header>

      <main className="px-4 py-6 flex flex-col flex-1 space-y-4">
        {!isLoading && isActive && groupedHistory.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary pl-2">
            <Info className="w-3 h-3 shrink-0" />
            <p>기록은 스캔 후 90일이 지나면 자동으로 사라져요.</p>
          </div>
        )}
        {/* Search — 로그인 상태에서만 표시 */}
        {(isLoading || authUser) && (
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="제품명 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-9 pr-4 bg-bg-surface border border-border-subtle rounded-2xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        )}


        {isLoading && (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* History list */}
        {!isLoading && isActive && (
          <div className="pb-4">
            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <Clock className="w-12 h-12 text-border-subtle mx-auto mb-4" />
                <p className="text-text-secondary font-medium">
                  {search ? '검색 결과가 없어요.' : '아직 스캔 기록이 없어요.'}
                </p>
              </div>
            ) : (
              filtered.map((group) => (
                <section key={group.id} className="space-y-3 mb-6">
                  <h3 className="text-sm text-text-secondary pl-2">{group.date}</h3>
                  <div className="grid gap-2">
                    {group.items.map((item: any, idx: number) => (
                      <Card
                        key={idx}
                        className="bg-bg-surface border-border-subtle shadow-sm hover:bg-neutral-bg transition-colors cursor-pointer"
                        onClick={() => navigateToResult(item.resultData)}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-2 h-10 rounded-full ${item.status === 'success' ? 'bg-success-fg' :
                              item.status === 'caution' ? 'bg-caution-fg' : 'bg-danger-fg'
                              }`} />
                            <p className="font-medium text-text-primary text-sm">{item.name}</p>
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <Badge size="sm" variant={item.status === 'success' ? 'solid-success' : item.status === 'caution' ? 'solid-caution' : 'solid-danger'}>
                              {item.status === 'success' ? '안전' : item.status === 'caution' ? '주의' : '위험'}
                            </Badge>
                            <span className="text-[10px] text-text-secondary">{item.time}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        )}


        {/* Not logged in */}
        {!isLoading && !authUser && (
          <div className="space-y-3">
            {/* 메인 카드 */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-5 py-8 space-y-4">
              {/* 타이틀 */}
              <div className="text-center">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-1">로그인하고, 언제든 다시 확인하세요.</h3>
                <p className="text-sm text-text-tertiary leading-relaxed">
                  스캔할 때마다 기록이 쌓여요.<br />언제든 꺼내보고, 제품명으로 검색해보세요.
                </p>
              </div>

              {/* 더미 히스토리 */}
              <div className="bg-bg-surface border border-border-subtle rounded-xl px-4 py-6 pointer-events-none select-none" aria-hidden="true">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                  <div className="w-full h-11 pl-9 pr-4 bg-bg-canvas border border-border-subtle rounded-2xl flex items-center">
                    <span className="text-sm text-text-tertiary">제품명 검색</span>
                  </div>
                </div>
                {DUMMY_HISTORY.map((group, gIdx) => (
                  <section key={gIdx} className="space-y-2 mb-4 last:mb-0">
                    <h3 className="text-sm text-text-secondary pl-2">{group.date}</h3>
                    <div className="grid gap-2">
                      {group.items.map((item, idx) => (
                        <Card key={idx} className="bg-bg-surface border-border-subtle shadow-sm">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className={`w-2 h-10 rounded-full ${item.status === 'success' ? 'bg-success-fg' : 'bg-caution-fg'}`} />
                              <p className="font-medium text-text-primary text-sm">{item.name}</p>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                              <Badge size="sm" variant={item.status === 'success' ? 'solid-success' : 'solid-caution'}>
                                {item.status === 'success' ? '안전' : '주의'}
                              </Badge>
                              <span className="text-[10px] text-text-secondary">{item.time}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Logged in but no subscription */}
        {!isLoading && authUser && !isActive && (
          <div className="space-y-4">
            {/* 미리보기 더미 카드 */}
            <div className="space-y-3 pointer-events-none select-none" aria-hidden="true">
              {DUMMY_HISTORY.flatMap(g => g.items).map((item, idx) => (
                <Card key={idx} className="bg-bg-surface border-border-subtle shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-2 h-10 rounded-full ${item.status === 'success' ? 'bg-success-fg' : 'bg-caution-fg'}`} />
                      <p className="font-medium text-text-primary text-sm">{item.name}</p>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <Badge size="sm" variant={item.status === 'success' ? 'solid-success' : 'solid-caution'}>
                        {item.status === 'success' ? '안전' : '주의'}
                      </Badge>
                      <span className="text-[10px] text-text-secondary">{item.time}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 가치 전달 카드 */}
            <div className="bg-accent border border-primary/20 rounded-2xl p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">히스토리 저장</p>
                <h3 className="text-lg font-semibold text-text-primary leading-snug">
                  스캔한 제품, 언제든<br />다시 확인하세요
                </h3>
              </div>

              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1.5 rounded-lg shrink-0 mt-0.5">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">언제든 결과 다시 보기</p>
                    <p className="text-xs text-text-secondary mt-0.5">마트에서 확인했던 성분 분석을 집에서도 꺼내볼 수 있어요.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1.5 rounded-lg shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">주의 성분 이력 한눈에</p>
                    <p className="text-xs text-text-secondary mt-0.5">주의 또는 위험으로 나온 제품을 리스트로 관리하세요.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/10 p-1.5 rounded-lg shrink-0 mt-0.5">
                    <Search className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">제품명으로 빠르게 검색</p>
                    <p className="text-xs text-text-secondary mt-0.5">비슷한 제품들을 비교하거나 과거 결과를 찾을 수 있어요.</p>
                  </div>
                </li>
              </ul>

              <Button
                className="w-full flex items-center justify-center gap-1.5"
                onClick={() => router.push('/pricing')}
              >
                스캔권 알아보기
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* 비로그인 하단 고정 버튼 */}
      {!isLoading && !authUser && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-bg-canvas/90 backdrop-blur-md border-t border-border-subtle">
          <div className="max-w-md mx-auto px-4 pt-3 space-y-2" style={{paddingBottom: 'calc(4rem + env(safe-area-inset-bottom) + 1rem)'}}>
          <Button
            variant="outline"
            onClick={loginWithGoogle}
            disabled={!!oauthLoading}
            className="w-full gap-3 rounded-xl h-12 bg-white"
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
          {oauthError && <p className="text-sm text-danger-fg text-center">{oauthError}</p>}
          </div>
        </div>
      )}

      <BottomNav />

    </div>
  );
}
