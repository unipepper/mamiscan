import { useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Scan, ShieldCheck, Search, ArrowRight, ChevronRight, LogIn } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card"
import { useAuth } from "@/src/lib/AuthContext"
import { Header } from "@/src/components/layout/Header"

export function Home() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true })
    }
  }, [user, isLoading, navigate])

  if (isLoading || !user) {
    return <div className="min-h-screen bg-bg-canvas flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg-canvas">
      <Header />
      {/* Hero Section */}
      <section className="px-4 pt-6 pb-8">
        <div className="bg-accent rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-start">
            <span className="text-sm font-semibold text-primary mb-1">식품 원재료표를 찍고</span>
            <h1 className="text-[26px] leading-[35px] font-bold text-text-primary mb-2">
              지금 먹어도 되는지<br />바로 확인해보세요
            </h1>
            <p className="text-sm text-text-secondary mb-5 max-w-[240px]">
              임산부 기준 성분 분석부터 안전한 대체 제품 추천까지 5초면 충분해요.
            </p>
            <div className="flex w-full space-x-2">
              <Button 
                className="flex-1 h-12 text-base font-semibold shadow-md" 
                onClick={() => navigate("/scan")}
              >
                <Scan className="mr-2 h-5 w-5" />
                5초 안에 확인하기
              </Button>
            </div>
          </div>
          {/* Decorative element */}
          <div className="absolute -right-6 -bottom-6 opacity-10">
            <Scan className="w-40 h-40 text-primary" />
          </div>
        </div>
      </section>

      {/* Features Section (Pregnancy Info equivalent) */}
      <section className="px-4 py-6 space-y-4">
        <h2 className="text-[22px] leading-[30px] font-bold text-text-primary px-1 mb-4">
          마마스캔이 도와드릴게요
        </h2>
        
        <div className="grid gap-4">
          <Card className="bg-bg-surface border-border-subtle shadow-sm">
            <CardContent className="p-5 flex items-start space-x-4">
              <div className="bg-primary/10 p-3 rounded-full shrink-0">
                <Scan className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-1">바코드 스캔</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  마트에서 고민될 때, 제품 바코드나 성분표를 찍으면 바로 분석해드려요.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-bg-surface border-border-subtle shadow-sm">
            <CardContent className="p-5 flex items-start space-x-4">
              <div className="bg-secondary/10 p-3 rounded-full shrink-0">
                <ShieldCheck className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-1">주차별 맞춤 판단</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  현재 임신 주차에 맞춰 주의해야 할 성분을 꼼꼼하게 체크해드려요.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-bg-surface border-border-subtle shadow-sm">
            <CardContent className="p-5 flex items-start space-x-4">
              <div className="bg-caution-bg p-3 rounded-full shrink-0">
                <Search className="w-6 h-6 text-caution-fg" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-1">안전한 대체 제품</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  주의 성분이 있다면, 안심하고 먹을 수 있는 비슷한 제품을 추천해드려요.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trust Section */}
      <section className="px-4 py-8 mt-4 bg-white border-y border-border-subtle">
        <div className="text-center space-y-4">
          <h2 className="text-[18px] font-bold text-text-primary">
            믿을 수 있는 데이터 기준
          </h2>
          <p className="text-sm text-text-secondary px-4">
            식약처(MFDS), 미국 FDA, CDC 등 공신력 있는 기관의 임산부 가이드라인을 바탕으로 분석합니다.
          </p>
          <div className="flex justify-center items-center space-x-6 pt-4 opacity-50 grayscale">
            {/* Placeholder for logos */}
            <div className="font-bold text-xl">MFDS</div>
            <div className="font-bold text-xl">FDA</div>
            <div className="font-bold text-xl">CDC</div>
          </div>
        </div>
      </section>

      {/* Subscription Section */}
      <section className="px-4 py-8 space-y-4">
        <h3 className="text-[18px] font-bold text-text-primary px-1">
          구독 관리
        </h3>
        <Card 
          className="bg-bg-surface border-border-subtle shadow-sm hover:bg-neutral-bg transition-colors cursor-pointer"
          onClick={() => navigate("/pricing")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="font-medium text-text-primary block mb-1">
                {user.subscription_status === 'premium' ? '현재 프리미엄 플랜 이용 중' : '현재 무료 플랜 이용 중'}
              </span>
              {user.subscription_status !== 'premium' && (
                <span className="text-xs text-primary font-medium">프리미엄 혜택 알아보기</span>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-text-secondary" />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
