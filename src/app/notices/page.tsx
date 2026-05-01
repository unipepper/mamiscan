'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, ChevronRight, ShieldCheck, Megaphone, Wrench, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Notice {
  id: string;
  title: string;
  body: string;
  type: 'general' | 'policy_update' | 'service';
  requires_ack: boolean;
  published_at: string;
}

const TYPE_META = {
  policy_update: { label: '방침 안내', icon: ShieldCheck, color: 'text-primary', bg: 'bg-primary/10' },
  service: { label: '서비스 안내', icon: Wrench, color: 'text-secondary', bg: 'bg-secondary/10' },
  general: { label: '공지', icon: Megaphone, color: 'text-caution', bg: 'bg-caution/10' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function NoticesPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [acking, setAcking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const [{ data: { user } }, { data: noticeRows }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('notices')
          .select('*')
          .order('published_at', { ascending: false }),
      ]);

      setNotices(noticeRows ?? []);

      if (user) {
        setUserId(user.id);
        const { data: reads } = await supabase
          .from('user_notice_reads')
          .select('notice_id')
          .eq('user_id', user.id);
        setReadIds(new Set((reads ?? []).map((r: { notice_id: string }) => r.notice_id)));
      }

      setLoading(false);
    }

    load();
  }, []);

  const handleOpen = async (notice: Notice) => {
    setSelected(notice);

    // 로그인 상태면 읽음 처리
    if (userId && !readIds.has(notice.id)) {
      const supabase = createClient();
      await supabase
        .from('user_notice_reads')
        .upsert({ user_id: userId, notice_id: notice.id });
      setReadIds(prev => new Set([...prev, notice.id]));
    }
  };

  const handleAck = async () => {
    if (!selected || !userId) return;
    setAcking(true);
    const supabase = createClient();

    // 읽음 처리 (user_notice_reads에 이미 upsert됨)
    // policy_update는 간주 동의 방식 — 별도 동의 처리 없이 읽음만 기록
    await supabase
      .from('user_notice_reads')
      .upsert({ user_id: userId, notice_id: selected.id });
    setReadIds(prev => new Set([...prev, selected.id]));

    setAcking(false);
    setSelected(null);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-canvas">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 상세 보기
  if (selected) {
    const meta = TYPE_META[selected.type];
    const Icon = meta.icon;
    const isRead = readIds.has(selected.id);

    return (
      <div className="flex flex-col flex-1 bg-bg-canvas pb-12">
        <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
          <button
            onClick={() => setSelected(null)}
            className="p-1 -ml-1 mr-3 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-lg text-text-primary">공지사항</span>
        </header>

        <main className="px-4 py-6 space-y-4">
          {/* 헤더 */}
          <div className="space-y-2">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}>
              <Icon className="w-3 h-3" />
              {meta.label}
            </div>
            <h1 className="text-xl font-semibold text-text-primary leading-snug">{selected.title}</h1>
            <p className="text-xs text-text-tertiary">{formatDate(selected.published_at)}</p>
          </div>

          <div className="border-t border-border-subtle" />

          {/* 본문 */}
          <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {selected.body}
          </div>

          {/* 개인정보처리방침 링크 */}
          {selected.type === 'policy_update' && (
            <button
              onClick={() => router.push('/privacy')}
              className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">개인정보처리방침 전문 보기</span>
              </div>
              <ChevronRight className="w-4 h-4 text-primary" />
            </button>
          )}

          {/* 확인 버튼 */}
          {userId && (
            <div className="pt-2">
              {isRead ? (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-primary font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  확인 완료
                </div>
              ) : (
                <Button
                  onClick={handleAck}
                  disabled={acking}
                  className="w-full h-12"
                >
                  {acking ? '처리 중...' : '확인했어요'}
                </Button>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // 목록 보기
  const unreadCount = notices.filter(n => !readIds.has(n.id)).length;

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-12">
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <button
          onClick={() => router.back()}
          className="p-1 -ml-1 mr-3 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-lg text-text-primary">공지사항</span>
        {unreadCount > 0 && (
          <span className="ml-2 bg-danger-fg text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}
      </header>

      <main className="px-4 py-4 space-y-2">
        {notices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-neutral-bg rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-text-tertiary" />
            </div>
            <p className="text-sm text-text-secondary">등록된 공지사항이 없어요</p>
          </div>
        ) : (
          notices.map(notice => {
            const meta = TYPE_META[notice.type];
            const Icon = meta.icon;
            const isRead = readIds.has(notice.id);

            return (
              <Card
                key={notice.id}
                onClick={() => handleOpen(notice)}
                className={`bg-bg-surface border-border-subtle shadow-sm cursor-pointer hover:bg-neutral-bg transition-colors ${
                  !isRead ? 'border-l-2 border-l-primary' : ''
                }`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className={`text-sm font-medium truncate ${isRead ? 'text-text-secondary' : 'text-text-primary'}`}>
                        {notice.title}
                      </p>
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-text-tertiary">{formatDate(notice.published_at)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0 mt-0.5" />
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
