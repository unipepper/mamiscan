'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const TERMS_ITEMS = [
  {
    label: '이용약관',
    required: true,
    href: '/terms',
  },
  {
    label: '개인정보 처리방침',
    required: true,
    href: '/privacy',
  },
  {
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

  async function handleAgree() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/agree-terms', { method: 'POST' });
      if (!res.ok) throw new Error('동의 처리에 실패했어요.');
      // 미들웨어가 읽는 JWT에 terms_agreed가 반영되도록 세션 갱신
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm flex flex-col gap-10">

        {/* 헤더 */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">
            마미스캔 시작을 위해
          </h1>
          <p className="text-2xl font-bold text-gray-900">
            아래 약관에 동의해주세요
          </p>
        </div>

        {/* 약관 목록 */}
        <ul className="space-y-4">
          {TERMS_ITEMS.map((item) => (
            <li key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-gray-700">
                <span className="text-gray-400 mr-1.5">[필수]</span>
                {item.label}
                {item.tooltip && (
                  <span
                    className="ml-1.5 text-xs text-gray-400 cursor-default"
                    title={item.tooltip}
                  >
                    ⓘ
                  </span>
                )}
              </span>
              {item.href && (
                <button
                  onClick={() => window.open(item.href!, '_blank')}
                  className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600 transition shrink-0"
                >
                  보기
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="space-y-3">
          {error && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}
          <button
            onClick={handleAgree}
            disabled={loading}
            className="w-full py-4 bg-gray-900 text-white text-base font-semibold rounded-2xl hover:bg-gray-800 disabled:opacity-60 transition"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                처리 중...
              </span>
            ) : (
              '전체 동의하기'
            )}
          </button>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition py-1"
          >
            가입 취소
          </button>
        </div>

      </div>
    </div>
  );
}
