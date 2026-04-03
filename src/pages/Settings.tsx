import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, User, Calendar, Bell, ChevronRight, LogOut, Lock, Search, Clock } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent } from "@/src/components/ui/card"
import { useAuth } from "@/src/lib/AuthContext"

export function Settings() {
  const navigate = useNavigate()
  const [week, setWeek] = useState<string>("12")
  const { user, isLoading, logout, login } = useAuth()

  // Listen for OAuth messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { token, user, isNewUser } = event.data.payload;
        if (token && user) {
          login(token, user);
          if (isNewUser) {
            navigate('/login', { replace: true });
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [login, navigate]);

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

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  if (isLoading) {
    return <div className="flex-1 bg-bg-canvas flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  }

  if (!user) {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas relative pb-32">
        <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
          <span className="font-bold text-lg text-text-primary">내 정보</span>
        </header>
        
        <main className="px-6 py-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <User className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-4 leading-tight">
            마마스캔과 함께<br/>안전한 임신 여정을 시작하세요
          </h1>
          <p className="text-text-secondary mb-10">
            로그인하시면 다음과 같은 혜택을 누리실 수 있습니다.
          </p>

          <div className="w-full space-y-4 text-left">
            <div className="flex items-start space-x-4 p-4 bg-bg-surface rounded-2xl border border-border-subtle shadow-sm">
              <div className="bg-primary/10 p-2 rounded-full mt-0.5 shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary mb-1">임신 주차별 맞춤 분석</h3>
                <p className="text-sm text-text-secondary">현재 주차에 꼭 피해야 할 성분을 정확하게 알려드려요.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4 p-4 bg-bg-surface rounded-2xl border border-border-subtle shadow-sm">
              <div className="bg-primary/10 p-2 rounded-full mt-0.5 shrink-0">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary mb-1">안전한 대체 제품 추천</h3>
                <p className="text-sm text-text-secondary">위험 성분이 발견되면, 안심하고 쓸 수 있는 제품을 바로 추천해드려요.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4 p-4 bg-bg-surface rounded-2xl border border-border-subtle shadow-sm">
              <div className="bg-primary/10 p-2 rounded-full mt-0.5 shrink-0">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary mb-1">스캔 히스토리 무제한 저장</h3>
                <p className="text-sm text-text-secondary">과거에 스캔했던 모든 제품의 기록을 언제든 다시 확인할 수 있어요.</p>
              </div>
            </div>
          </div>
        </main>

        {/* Floating CTA */}
        <div className="fixed bottom-[64px] left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-6 pt-24 bg-gradient-to-t from-bg-canvas via-bg-canvas via-60% to-transparent z-40">
          <div className="space-y-3">
            <button
              onClick={() => handleOAuth('kakao')}
              className="w-full flex items-center justify-center space-x-2 bg-[#FEE500] hover:bg-[#FEE500]/90 text-black font-bold h-12 rounded-xl transition-colors shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M12 3c-5.523 0-10 3.515-10 7.85 0 2.764 1.764 5.188 4.418 6.55l-1.12 4.104c-.06.22.18.4.38.28l4.74-3.15c.51.08 1.04.12 1.58.12 5.523 0 10-3.515 10-7.85C22 6.515 17.523 3 12 3z" />
              </svg>
              <span>카카오로 시작하기</span>
            </button>
            <button
              onClick={() => handleOAuth('google')}
              className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 font-bold h-12 rounded-xl border border-gray-200 transition-colors shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Google로 시작하기</span>
            </button>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border-subtle" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-bg-canvas px-2 text-text-secondary">또는</span>
              </div>
            </div>
            <button 
              onClick={async () => {
                try {
                  const res = await fetch('/api/auth/test', { method: 'POST' });
                  const data = await res.json();
                  if (data.success) {
                    login(data.token, data.user);
                    if (data.isNewUser) {
                      navigate('/login', { replace: true });
                    }
                  }
                } catch (err) {
                  console.error(err);
                  alert('테스트 로그인에 실패했습니다.');
                }
              }} 
              className="w-full py-3 bg-primary text-white rounded-xl font-bold text-base shadow-sm flex items-center justify-center space-x-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>개발자 로그인 (테스트 계정)</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <span className="font-bold text-lg text-text-primary">내 정보</span>
      </header>

      <main className="px-4 py-6 space-y-8">
        {/* Profile Section */}
        <section className="flex items-center space-x-4 mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">{user.name} 님</h2>
            <p className="text-sm text-text-secondary">{user.email}</p>
          </div>
        </section>

        {/* Subscription Status */}
        <section className="space-y-4 mb-8">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[18px] font-bold text-text-primary">
              이용권 정보
            </h3>
            <button 
              onClick={() => navigate("/billing-history")}
              className="text-sm font-medium text-text-secondary hover:text-primary transition-colors flex items-center"
            >
              전체 내역 보기 <ChevronRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
          <Card className="bg-bg-surface border-border-subtle shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                {user.subscription_status === 'premium' ? (
                  <>
                    <p className="font-bold text-primary mb-1">무제한 이용권 사용 중</p>
                    <p className="text-sm text-text-secondary">횟수 제한 없이 스캔 가능합니다.</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-text-primary mb-1">
                      남은 스캔 횟수: <span className="text-secondary">{user.remaining_scans || 0}회</span>
                    </p>
                    <p className="text-sm text-text-secondary">추가 스캔이 필요하신가요?</p>
                  </>
                )}
              </div>
              {user.subscription_status !== 'premium' && (
                <Button variant="outline" size="sm" onClick={() => navigate("/pricing")}>
                  충전하기
                </Button>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Pregnancy Info */}
        <section className="space-y-4 mb-8">
          <h3 className="text-[18px] font-bold text-text-primary px-1">
            임신 정보
          </h3>
          <Card className="bg-bg-surface border-border-subtle shadow-sm">
            <CardContent className="p-0">
              <div className="p-4 border-b border-border-subtle flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-text-secondary" />
                  <span className="font-medium text-text-primary">현재 임신 주차</span>
                </div>
                <div className="flex items-center space-x-2">
                  <select 
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    className="bg-neutral-bg border-none text-sm font-medium rounded-md px-3 py-1.5 focus:ring-1 focus:ring-primary outline-none"
                  >
                    {Array.from({ length: 42 }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w}>{w}주차</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-4 bg-accent/50">
                <p className="text-xs text-text-secondary leading-relaxed">
                  입력하신 주차 정보는 <strong>이용권</strong> 구매 시 스캔 결과에 반영되어 더욱 정밀한 맞춤 분석을 제공합니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* App Settings */}
        <section className="space-y-4">
          <h3 className="text-[18px] font-bold text-text-primary px-1">
            앱 설정
          </h3>
          <Card className="bg-bg-surface border-border-subtle shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4 border-b border-border-subtle flex items-center justify-between cursor-pointer hover:bg-neutral-bg transition-colors">
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5 text-text-secondary" />
                  <span className="font-medium text-text-primary">알림 설정</span>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary" />
              </div>
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-bg transition-colors text-danger-fg"
                onClick={handleLogout}
              >
                <div className="flex items-center space-x-3">
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">로그아웃</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
