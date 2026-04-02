import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/src/lib/AuthContext"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { Button } from "@/src/components/ui/button"

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, user, isLoading } = useAuth()
  const [isNewUser, setIsNewUser] = useState(false)
  const returnTo = location.state?.returnTo

  const handleLoginSuccess = (isNew: boolean) => {
    if (isNew) {
      setIsNewUser(true);
      navigate('/login', { replace: true, state: { returnTo } });
    } else {
      if (returnTo) {
        navigate(returnTo, { replace: true });
      } else if (window.history.length > 2) {
        navigate(-1);
      } else {
        navigate('/', { replace: true });
      }
    }
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin is from AI Studio preview or localhost
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        login(event.data.token, event.data.user);
        handleLoginSuccess(event.data.isNewUser);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [login, navigate, returnTo]);

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    try {
      const redirectUri = `${window.location.origin}/api/auth/${provider}/callback`;
      const res = await fetch(`/api/auth/${provider}/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      if (!res.ok) throw new Error('Failed to get auth URL');
      const { url } = await res.json();
      
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        alert('팝업 차단이 설정되어 있습니다. 팝업을 허용해주세요.');
      }
    } catch (err) {
      console.error(err);
      alert('로그인 서버 연결에 실패했습니다.');
    }
  };

  const handleTestLogin = async () => {
    try {
      const res = await fetch('/api/auth/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        login(data.token, data.user);
        handleLoginSuccess(data.isNewUser);
      }
    } catch (err) {
      console.error(err);
      alert('테스트 로그인에 실패했습니다.');
    }
  };

  if (isLoading) {
    return <div className="flex-1 bg-bg-canvas flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  }

  if (user) {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas items-center justify-center px-6">
        <div className="bg-primary/10 p-4 rounded-full mb-4">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          {isNewUser ? '회원가입 완료!' : '로그인 완료!'}
        </h1>
        <p className="text-text-secondary mb-8 text-center">
          {isNewUser ? '마마스캔에 오신 것을 환영합니다.' : '다시 오신 것을 환영합니다.'}
        </p>
        <Button 
          className="w-full h-12 text-base font-bold" 
          onClick={() => {
            if (returnTo) {
              navigate(returnTo, { replace: true });
            } else {
              navigate('/');
            }
          }}
        >
          {returnTo ? '이용권 안내로 이동하기' : '홈으로 가기'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas">
      <header className="flex items-center h-14 px-4 sticky top-0 z-50">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </header>
      <div className="flex-1 flex flex-col justify-center px-6 py-6 overflow-y-auto">
        <h1 className="text-3xl font-bold text-text-primary mb-2">로그인</h1>
        <p className="text-text-secondary mb-12">마마스캔에 오신 것을 환영합니다.</p>

        <div className="space-y-4">
          <button 
            onClick={() => handleOAuth('kakao')} 
            className="w-full py-4 bg-[#FEE500] text-black rounded-xl font-bold text-lg shadow-sm flex items-center justify-center space-x-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M12 3c-5.523 0-10 3.515-10 7.85 0 2.734 1.743 5.14 4.41 6.51-.425 1.555-1.53 5.594-1.57 5.74-.05.18.06.27.19.2.1-.05 4.54-3.03 6.34-4.24.2.01.41.02.63.02 5.523 0 10-3.515 10-7.85S17.523 3 12 3z"/>
            </svg>
            <span>카카오로 시작하기</span>
          </button>
          
          <button 
            onClick={() => handleOAuth('google')} 
            className="w-full py-4 bg-white text-black border border-gray-300 rounded-xl font-bold text-lg shadow-sm flex items-center justify-center space-x-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Google로 시작하기</span>
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border-subtle" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-bg-canvas px-2 text-text-secondary">또는</span>
            </div>
          </div>

          <button 
            onClick={handleTestLogin} 
            className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-sm flex items-center justify-center space-x-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>개발자 로그인 (테스트 계정)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
