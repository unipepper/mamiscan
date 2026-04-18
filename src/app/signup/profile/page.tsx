'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const WEEK_OPTIONS = Array.from({ length: 42 }, (_, i) => i + 1);

export default function SignupProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pregnancyWeeks, setPregnancyWeeks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/setup-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          pregnancy_weeks: pregnancyWeeks ? Number(pregnancyWeeks) : undefined,
        }),
      });

      if (!res.ok) throw new Error();
      router.replace('/home');
    } catch {
      setError('오류가 발생했어요. 다시 시도해 주세요.');
      setLoading(false);
    }
  }

  function handleSkip() {
    router.replace('/home');
  }

  return (
    <div className="min-h-screen flex flex-col bg-white px-6">

      {/* 건너뛰기 */}
      <div className="flex justify-end pt-5 pb-2">
        <button
          onClick={handleSkip}
          className="text-sm text-gray-400 hover:text-gray-600 transition"
        >
          건너뛰기 →
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto gap-10 pb-16">

        {/* 헤더 */}
        <div className="space-y-1">
          <p className="text-2xl font-bold text-gray-900">거의 다 왔어요!</p>
          <p className="text-2xl font-bold text-gray-900">내 정보를 입력해주세요</p>
        </div>

        {/* 폼 */}
        <div className="space-y-6">

          {/* 이메일 (read-only) */}
          {email && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                계정
              </label>
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-500">{email}</span>
              </div>
            </div>
          )}

          {/* 별명 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              별명 <span className="normal-case font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              placeholder="앱에서 사용할 이름을 입력해주세요"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition"
            />
          </div>

          {/* 임신주차 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              임신주차 <span className="normal-case font-normal">(선택)</span>
            </label>
            <select
              value={pregnancyWeeks}
              onChange={(e) => setPregnancyWeeks(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-gray-400 transition appearance-none bg-white"
            >
              <option value="">주차를 선택해주세요</option>
              {WEEK_OPTIONS.map((w) => (
                <option key={w} value={w}>{w}주차</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 pl-1">
              · 성분 안전 판단에 사용돼요. 설정에서 언제든 변경할 수 있어요.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          {error && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 bg-gray-900 text-white text-base font-semibold rounded-2xl hover:bg-gray-800 disabled:opacity-60 transition"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                저장 중...
              </span>
            ) : (
              '시작하기'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
