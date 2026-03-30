import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, User, Calendar, Bell, ChevronRight, LogOut, Lock } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent } from "@/src/components/ui/card"
import { useAuth } from "@/src/lib/AuthContext"

export function Settings() {
  const navigate = useNavigate()
  const [week, setWeek] = useState<string>("12")
  const { user, isLoading, logout } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true })
    }
  }, [user, isLoading, navigate])

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  if (isLoading || !user) {
    return <div className="flex-1 bg-bg-canvas flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
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
                  입력하신 주차 정보는 <strong>구독 플랜</strong> 이용 시 스캔 결과에 반영되어 더욱 정밀한 맞춤 분석을 제공합니다.
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
