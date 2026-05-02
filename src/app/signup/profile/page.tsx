'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { calcPregnancyWeek, weeksToStartDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function SignupProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [nameConfirmed, setNameConfirmed] = useState(false);

  const [inputMode, setInputMode] = useState<'weeks' | 'lmp'>('weeks');
  const [weekInput, setWeekInput] = useState('');
  const [lmpInput, setLmpInput] = useState('');
  const [pregnancyConfirmed, setPregnancyConfirmed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pregnancyRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  useEffect(() => {
    if (nameConfirmed) {
      setTimeout(() => pregnancyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [nameConfirmed]);

  useEffect(() => {
    if (pregnancyConfirmed) {
      setTimeout(() => ctaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [pregnancyConfirmed]);

  function getPregnancyStartDate(): string | undefined {
    if (inputMode === 'weeks') {
      const w = parseInt(weekInput, 10);
      return w >= 1 && w <= 42 ? weeksToStartDate(w) : undefined;
    }
    return lmpInput || undefined;
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/setup-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          pregnancy_start_date: getPregnancyStartDate(),
        }),
      });

      if (!res.ok) throw new Error();
      router.replace('/home');
    } catch {
      setError('오류가 발생했어요. 다시 시도해 주세요.');
      setLoading(false);
    }
  }

  const pregnancyStartDate = getPregnancyStartDate();
  const weekNum = inputMode === 'weeks' ? parseInt(weekInput, 10) : calcPregnancyWeek(lmpInput);

  return (
    <div className="min-h-screen flex flex-col bg-bg-canvas px-6">

      {/* 상단 */}
      <div className="flex justify-end pt-5 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSubmit}
          className="text-text-tertiary hover:text-text-secondary"
        >
          건너뛰기
        </Button>
      </div>

      <div className="flex flex-col max-w-sm w-full mx-auto pt-6 pb-24 gap-8">

        {/* 헤더 */}
        <div className="space-y-1">
          <p className="text-2xl font-bold text-text-primary">거의 다 왔어요!</p>
          <p className="text-2xl font-bold text-text-primary">내 정보를 알려주세요</p>
        </div>

        {/* 필드 1: 별명 */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
            별명 <span className="normal-case font-normal">(선택)</span>
          </label>

          {nameConfirmed ? (
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-bg rounded-xl">
              <span className="text-sm text-text-primary">{name.trim() || '입력 안 함'}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setNameConfirmed(false); setPregnancyConfirmed(false); }}
                className="text-text-tertiary hover:text-text-secondary"
              >
                수정
              </Button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 20))}
                onKeyDown={(e) => e.key === 'Enter' && setNameConfirmed(true)}
                placeholder="예) 하음맘, 튼튼맘"
                autoFocus
                className="w-full px-4 py-3 border border-border-subtle rounded-xl text-sm text-text-primary placeholder:text-text-disabled bg-bg-surface focus:outline-none focus:border-primary transition"
              />
              <Button
                onClick={() => setNameConfirmed(true)}
                className="w-full"
              >
                확인
              </Button>
              <Button
                variant="link"
                onClick={() => { setName(''); setNameConfirmed(true); }}
                className="w-full"
              >
                다음에 입력할게요
              </Button>
            </>
          )}
        </div>

        {/* 필드 2: 임신 주차 */}
        {nameConfirmed && (
          <div ref={pregnancyRef} className="space-y-3">
            <label className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
              임신 주차 <span className="normal-case font-normal">(선택)</span>
            </label>

            {pregnancyConfirmed ? (
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-bg rounded-xl">
                <span className="text-sm text-text-primary">
                  {weekNum && weekNum >= 1 ? `임신 ${weekNum}주차` : '입력 안 함'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPregnancyConfirmed(false)}
                  className="text-text-tertiary hover:text-text-secondary"
                >
                  수정
                </Button>
              </div>
            ) : (
              <>
                {/* 입력 방식 탭: toggle 상태 기반 조건부 스타일로 native button 유지 */}
                <div className="flex bg-neutral-bg rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setInputMode('weeks')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      inputMode === 'weeks'
                        ? 'bg-bg-surface text-text-primary shadow-sm'
                        : 'text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    현재 주차로 입력
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('lmp')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      inputMode === 'lmp'
                        ? 'bg-bg-surface text-text-primary shadow-sm'
                        : 'text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    마지막 생리일로 입력
                  </button>
                </div>

                {inputMode === 'weeks' ? (
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={42}
                        value={weekInput}
                        onChange={(e) => setWeekInput(e.target.value)}
                        placeholder="예) 12"
                        className="w-full px-4 py-3 border border-border-subtle rounded-xl text-sm text-text-primary bg-bg-surface placeholder:text-text-disabled focus:outline-none focus:border-primary transition"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">주차</span>
                    </div>
                    {weekInput && !(parseInt(weekInput, 10) >= 1 && parseInt(weekInput, 10) <= 42) && (
                      <p className="text-xs text-danger-fg pl-1 mt-1">1–42 사이 숫자를 입력해주세요</p>
                    )}
                    {parseInt(weekInput, 10) >= 1 && parseInt(weekInput, 10) <= 42 && (
                      <p className="text-xs text-text-secondary pl-1 mt-1 font-medium">임신 {parseInt(weekInput, 10)}주차로 저장돼요</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="date"
                      value={lmpInput}
                      onChange={(e) => setLmpInput(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-border-subtle rounded-xl text-sm text-text-primary bg-bg-surface focus:outline-none focus:border-primary transition"
                    />
                    {lmpInput && calcPregnancyWeek(lmpInput) && (
                      <p className="text-xs text-text-secondary pl-1 mt-1 font-medium">
                        현재 임신 {calcPregnancyWeek(lmpInput)}주차로 계산돼요
                      </p>
                    )}
                  </div>
                )}

                <p className="text-xs text-text-tertiary pl-1">
                  · 주차별 맞춤 성분 분석에 사용돼요. 설정에서 언제든 변경할 수 있어요.
                </p>

                <Button
                  onClick={() => setPregnancyConfirmed(true)}
                  className="w-full"
                >
                  확인
                </Button>
                <Button
                  variant="link"
                  onClick={() => { setWeekInput(''); setLmpInput(''); setPregnancyConfirmed(true); }}
                  className="w-full"
                >
                  다음에 입력할게요
                </Button>
              </>
            )}
          </div>
        )}

        {/* CTA */}
        {pregnancyConfirmed && (
          <div ref={ctaRef} className="space-y-3">
            {error && (
              <p className="text-center text-sm text-danger-fg">{error}</p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  저장 중...
                </span>
              ) : (
                '시작하기'
              )}
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
