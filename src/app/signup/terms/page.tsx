'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Check, FileCheck2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { EscapeButton } from '@/components/ui/escape-button';

const TERMS_ITEMS = [
  {
    key: 'terms',
    label: '이용약관',
    required: true,
    href: '/terms',
  },
  {
    key: 'privacy',
    label: '개인정보 처리방침',
    required: true,
    href: '/privacy',
  },
  {
    key: 'age',
    label: '만 14세 이상입니다',
    required: true,
    href: null,
    tooltip: '만 14세 미만은 서비스를 이용할 수 없습니다.',
  },
];

export default function SignupTermsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({
    terms: false,
    privacy: false,
    age: false,
  });

  const allChecked = TERMS_ITEMS.every((item) => checked[item.key]);
  const [shaking, setShaking] = useState<Record<string, boolean>>({});
  const [showHint, setShowHint] = useState(false);

  const shakeUnchecked = useCallback(() => {
    if (allChecked) return;
    setShaking({ all: true });
    setShowHint(true);
    setTimeout(() => setShaking({}), 500);
  }, [allChecked]);

  function toggleAll() {
    const next = !allChecked;
    setChecked({ terms: next, privacy: next, age: next });
  }

  function toggle(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleAgree() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/agree-terms', { method: 'POST' });
      if (!res.ok) throw new Error('동의 처리에 실패했어요.');
      await supabase.auth.refreshSession();
      router.replace('/signup/profile');
    } catch {
      setError('오류가 발생했어요. 다시 시도해 주세요.');
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex-1 w-full max-w-sm mx-auto px-6 pt-12 pb-40 flex flex-col gap-8">

        {/* 헤더 */}
        <div className="space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
            <FileCheck2 className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">마미스캔 시작을 위해</h1>
            <p className="text-2xl font-bold text-gray-900">아래 약관에 동의해주세요</p>
          </div>
        </div>

        {/* 약관 목록 */}
        <div className="space-y-1">
          {/* 전체 동의 */}
          <div>
            <button
              type="button"
              onClick={toggleAll}
              className="w-full flex items-center gap-3 h-11 px-1 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${allChecked ? 'bg-primary border-primary' : shaking.all ? 'border-primary' : 'border-border-subtle'} ${shaking.all ? 'animate-shake' : ''}`}>
                {allChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
              <span className="text-base font-semibold text-text-primary">필수항목 전체 동의</span>
            </button>
            {showHint && (
              <p className="text-xs text-danger-fg pl-9 -mt-1">모든 필수 항목에 동의해주세요</p>
            )}
          </div>

          <div className="border-t border-border-subtle mt-2" />

          {/* 개별 항목 */}
          <ul className="space-y-0">
            {TERMS_ITEMS.map((item) => (
              <li key={item.key} className="px-1">
                <div className="flex items-center justify-between h-9">
                  <button
                    type="button"
                    onClick={() => toggle(item.key)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${checked[item.key] ? 'bg-primary border-primary' : 'border-border-subtle'}`}>
                      {checked[item.key] && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className="text-sm text-text-primary">
                      <span className="text-text-tertiary mr-1.5">[필수]</span>
                      {item.label}
                      {item.tooltip && (
                        <span
                          className="ml-1.5 text-xs text-text-tertiary cursor-default"
                          title={item.tooltip}
                        >
                          ⓘ
                        </span>
                      )}
                    </span>
                  </button>
                  {item.href && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(item.href!, '_blank')}
                      className="gap-0.5 shrink-0 text-text-tertiary hover:text-text-secondary h-9"
                    >
                      보기
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                {showHint && !checked[item.key] && (
                  <p className="text-xs text-danger-fg pl-8 pb-1">필수 동의 항목이에요</p>
                )}
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* CTA — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white px-6 pt-4 pb-10 space-y-3 border-t border-border-subtle">
        <div className="max-w-sm mx-auto space-y-3">
          {error && (
            <p className="text-center text-sm text-danger-fg">{error}</p>
          )}
          <Button
            onClick={allChecked ? handleAgree : shakeUnchecked}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                처리 중...
              </span>
            ) : (
              '동의하고 시작하기'
            )}
          </Button>
          <EscapeButton onClick={handleLogout} disabled={loading}>
            가입 취소
          </EscapeButton>
        </div>
      </div>
    </div>
  );
}
