'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'google' | 'kakao' | null>(null);

  async function loginWithGoogle() {
    setLoginError(null);
    setLoading('google');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/api/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setLoginError('Google 로그인에 실패했어요. 다시 시도해 주세요.');
      setLoading(null);
    }
  }

  async function loginWithKakao() {
    setLoginError(null);
    setLoading('kakao');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${location.origin}/api/auth/callback`,
        scopes: 'account_email',
      },
    });
    if (error) {
      setLoginError('카카오 로그인에 실패했어요. 다시 시도해 주세요.');
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas">
      <header className="safe-top sticky top-0 z-50 flex items-center h-14 px-2 bg-bg-surface/80 backdrop-blur-md border-b border-border-subtle">
        <button
          onClick={() => router.back()}
          className="p-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Image src="/logo.png" alt="마미스캔" width={160} height={160} className="rounded-3xl mx-auto" />
          <h1 className="text-3xl font-bold text-text-primary -mt-1">마미스캔</h1>
          <p className="text-base text-text-secondary mt-1">임산부를 위한 성분 안전 확인 서비스</p>
        </div>

        <div className="space-y-2 pt-2">
          <Button
            variant="outline"
            onClick={loginWithGoogle}
            disabled={!!loading}
            className="w-full gap-3 rounded-xl"
          >
            {loading === 'google' ? (
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
            disabled={!!loading}
            className="w-full gap-3 rounded-xl bg-[#FEE500] text-[#3C1E1E] hover:bg-[#F5DC00] shadow-sm"
          >
            {loading === 'kakao' ? (
              <div className="w-5 h-5 border-2 border-[#3C1E1E]/40 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#3C1E1E">
                <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.68 5.07 4.2 6.48L5.1 21l4.62-2.52c.72.12 1.47.18 2.28.18 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
              </svg>
            )}
            카카오로 계속하기
          </Button>

          {loginError && (
            <p className="text-center text-sm text-danger-fg">{loginError}</p>
          )}

          <Button
            variant="ghost"
            onClick={() => router.push('/home')}
            className="w-full text-text-tertiary hover:text-text-secondary text-sm font-normal mt-2"
          >
            로그인 없이 둘러보기
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
