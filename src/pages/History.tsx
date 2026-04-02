import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Clock, Search, Filter, Lock } from "lucide-react"
import { Card, CardContent } from "@/src/components/ui/card"
import { Badge } from "@/src/components/ui/badge"
import { useAuth } from "@/src/lib/AuthContext"
import { Button } from "@/src/components/ui/button"

export function History() {
  const navigate = useNavigate()
  const { user, login } = useAuth()
  const [isNewUser, setIsNewUser] = useState(false)

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
            setIsNewUser(true);
            navigate('/login', { replace: true });
          } else {
            // Stay on history page, it will re-render with user state
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

  const historyData = [
    { id: 1, date: "오늘", items: [
      { name: "매콤달콤 떡볶이 스낵", brand: "오리온", status: "caution", time: "오후 2:30" },
      { name: "유기농 바나나 우유", brand: "상하목장", status: "success", time: "오전 10:15" },
    ]},
    { id: 2, date: "어제", items: [
      { name: "무알콜 맥주 제로", brand: "하이트", status: "success", time: "오후 8:45" },
      { name: "매운 불닭 볶음면", brand: "삼양", status: "danger", time: "오후 1:20" },
    ]},
    { id: 3, date: "이번 주", items: [
      { name: "디카페인 아메리카노", brand: "스타벅스", status: "caution", time: "수요일" },
      { name: "초코파이 정", brand: "오리온", status: "caution", time: "화요일" },
      { name: "제주 삼다수", brand: "광동제약", status: "success", time: "월요일" },
    ]}
  ]

  const isPremium = user?.subscription_status === 'premium'
  
  // If not logged in, show a limited fake history so it fills the screen without scrolling
  const displayData = user ? (isPremium ? historyData : historyData.slice(0, 1)) : historyData.slice(0, 2)

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <span className="font-bold text-lg text-text-primary">스캔 히스토리</span>
      </header>

      <main className="px-4 py-6 flex flex-col flex-1 space-y-6 relative">
        {/* Search & Filter */}
        <div className="flex space-x-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input 
              type="text" 
              placeholder="제품명 검색" 
              className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button className="p-2 bg-bg-surface border border-border-subtle rounded-lg text-text-secondary hover:bg-neutral-bg transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* History List */}
        <div className={`relative flex-1 flex flex-col ${!user ? 'overflow-hidden' : ''}`}>
          {!user && (
            <div className="absolute inset-0 z-10 bg-bg-canvas/40 backdrop-blur-[4px] flex flex-col items-center justify-center p-6 text-center">
              <div className="bg-primary/10 p-3 rounded-full mb-3">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-text-primary mb-2">회원 전용 기능</h3>
              <p className="text-sm text-text-secondary mb-6">
                스캔 기록을 저장하고 언제든 다시 확인하려면<br/>로그인이 필요합니다.
              </p>
              
              <div className="w-full max-w-[280px] space-y-3">
                <button
                  onClick={() => handleOAuth('kakao')}
                  className="w-full flex items-center justify-center space-x-2 bg-[#FEE500] hover:bg-[#FEE500]/90 text-black font-bold h-12 rounded-xl transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M12 3c-5.523 0-10 3.515-10 7.85 0 2.764 1.764 5.188 4.418 6.55l-1.12 4.104c-.06.22.18.4.38.28l4.74-3.15c.51.08 1.04.12 1.58.12 5.523 0 10-3.515 10-7.85C22 6.515 17.523 3 12 3z" />
                  </svg>
                  <span>카카오로 시작하기</span>
                </button>
                <button
                  onClick={() => handleOAuth('google')}
                  className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 font-bold h-12 rounded-xl border border-gray-200 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span>Google로 시작하기</span>
                </button>
              </div>
            </div>
          )}

          <div className={!user ? "opacity-40 pointer-events-none select-none flex-1" : "flex-1"}>
            {displayData.map((group) => (
              <section key={group.id} className="space-y-3 mb-6">
                <h3 className="text-sm font-bold text-text-secondary px-1">{group.date}</h3>
                <div className="grid gap-3">
                  {group.items.map((item, idx) => (
                    <Card 
                      key={idx} 
                      className="bg-bg-surface border-border-subtle shadow-sm hover:bg-neutral-bg transition-colors cursor-pointer"
                      onClick={() => navigate("/result")}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-2 h-10 rounded-full ${
                            item.status === 'success' ? 'bg-success-fg' : 
                            item.status === 'caution' ? 'bg-caution-fg' : 'bg-danger-fg'
                          }`} />
                          <div>
                            <p className="text-xs text-text-secondary mb-0.5">{item.brand}</p>
                            <p className="font-semibold text-text-primary text-sm">{item.name}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent text-white ${item.status === 'success' ? 'bg-success-fg hover:bg-success-fg/80' : item.status === 'caution' ? 'bg-caution-fg hover:bg-caution-fg/80' : 'bg-danger-fg hover:bg-danger-fg/80'}`}>
                            {item.status === 'success' ? '안전' : item.status === 'caution' ? '주의' : '위험'}
                          </div>
                          <span className="text-[10px] text-text-secondary">{item.time}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}

            {user && !isPremium && (
              <div className="mt-8 p-6 bg-accent/50 border border-primary/20 rounded-xl text-center space-y-4">
                <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-base font-bold text-text-primary">
                  과거 히스토리가 궁금하신가요?
                </h3>
                <p className="text-sm text-text-secondary">
                  프리미엄 플랜을 구독하시면 무제한 스캔 히스토리를 확인하실 수 있습니다.
                </p>
                <Button 
                  className="w-full font-bold mt-2"
                  onClick={() => navigate("/pricing")}
                >
                  프리미엄 혜택 알아보기
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
