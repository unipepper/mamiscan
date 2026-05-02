'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Search, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { BottomNav } from '@/components/BottomNav';

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
              time: new Date(row.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              resultData: (() => {
                try {
                  const parsed = JSON.parse(row.result_json);
                  if (row.image_url) parsed.userImageUrl = row.image_url;
                  return parsed;
                } catch { return null; }
              })(),
            });
          });
          setGroupedHistory(Object.entries(grouped).map(([date, items], id) => ({ id, date, items })));
        }
      }
      setIsLoading(false);
    });
  }, []);

  // 비교 테스트: '/result' | '/result-notion' | '/result-cal'
  const RESULT_ROUTE = '/result';

  const navigateToResult = (resultData: any, productName?: string) => {
    if (resultData) {
      sessionStorage.setItem('resultData', JSON.stringify(resultData));
      window.location.href = RESULT_ROUTE;
    } else if (productName) {
      window.location.href = `${RESULT_ROUTE}?productName=${encodeURIComponent(productName)}`;
    }
  };

  const filtered = groupedHistory.map((group) => ({
    ...group,
    items: group.items.filter((item: any) =>
      search === '' || item.name?.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-nav">
      <header className="safe-top sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <span className="text-lg font-semibold text-text-primary">스캔 히스토리</span>
      </header>

      <main className="px-4 py-6 flex flex-col flex-1 space-y-4">
        {/* Search */}
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

        {/* 보관 정책 안내 */}
        {!isLoading && isActive && groupedHistory.length > 0 && (
          <p className="text-xs text-text-tertiary text-center">
            기록은 스캔 후 90일이 지나면 자동으로 사라져요.<br />중요한 결과는 스크린샷으로 저장해두세요.
          </p>
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
                  <h3 className="text-sm text-text-secondary px-1">{group.date}</h3>
                  <div className="grid gap-3">
                    {group.items.map((item: any, idx: number) => (
                      <Card
                        key={idx}
                        className="bg-bg-surface border-border-subtle shadow-sm hover:bg-neutral-bg transition-colors cursor-pointer"
                        onClick={() => navigateToResult(item.resultData, item.name)}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-2 h-10 rounded-full ${item.status === 'success' ? 'bg-success-fg' :
                              item.status === 'caution' ? 'bg-caution-fg' : 'bg-danger-fg'
                              }`} />
                            <p className="font-medium text-text-primary text-sm">{item.name}</p>
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${item.status === 'success' ? 'bg-success-fg' :
                              item.status === 'caution' ? 'bg-caution-fg' : 'bg-danger-fg'
                              }`}>
                              {item.status === 'success' ? '안전' : item.status === 'caution' ? '주의' : '위험'}
                            </div>
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
          <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
            <div className="bg-primary/10 p-3 rounded-full mb-3 inline-flex">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-text-primary mb-2">로그인하고 기록을 저장하세요</h3>
            <p className="text-sm text-text-secondary mb-5">로그인하면 스캔 기록이 안전하게 저장돼요.</p>
            <Button onClick={() => router.push('/login')} className="w-full">로그인하기</Button>
          </div>
        )}

        {/* Logged in but no subscription */}
        {!isLoading && authUser && !isActive && (
          <div className="mt-4 p-6 bg-accent/50 border border-primary/20 rounded-xl text-center space-y-4">
            <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-base text-text-primary">히스토리 저장은 스캔권 전용이에요</h3>
            <p className="text-sm text-text-secondary">스캔권을 구매하시면 무제한 스캔 히스토리를 확인할 수 있어요.</p>
            <Button className="w-full" onClick={() => router.push('/pricing')}>스캔권 알아보기</Button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
