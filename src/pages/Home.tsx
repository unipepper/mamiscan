import { Link, useNavigate } from "react-router-dom"
import { Scan, ShieldCheck, Search, ArrowRight, ChevronRight, LogIn, CheckCircle2, Lock, Star, Calendar } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card"
import { useAuth } from "@/src/lib/AuthContext"
import { Header } from "@/src/components/layout/Header"

export function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSubscribe = () => {
    if (!user) {
      navigate("/login", { state: { returnTo: "/pricing" } })
    } else {
      alert("결제창이 열립니다. (결제 모듈 연동 필요)")
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas relative">
      <Header />
      
      {/* Scan Status Banner */}
      <div className="px-4 pt-4">
        {!user ? (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-between cursor-pointer" onClick={() => navigate("/login")}>
            <div className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-text-primary">로그인하고 무료 스캔 3회 받기</span>
            </div>
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          </div>
        ) : user.subscription_status === 'premium' ? (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-text-primary">무제한 스캔 이용 중</span>
            </div>
          </div>
        ) : (
          <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-3 flex items-center justify-between cursor-pointer" onClick={() => navigate("/pricing")}>
            <div className="flex items-center space-x-2">
              <Scan className="w-5 h-5 text-secondary" />
              <span className="text-sm font-medium text-text-primary">
                남은 스캔 횟수: <strong className="text-secondary">{user.remaining_scans || 0}회</strong>
              </span>
            </div>
            <span className="text-xs font-bold text-secondary bg-white px-2 py-1 rounded-full shadow-sm">충전하기</span>
          </div>
        )}
      </div>

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
                  마트에서 고민될 때, 제품 바코드나 식료품을 찍으면 바로 분석해드려요.
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
            <div className="font-bold text-xl">MFDS</div>
            <div className="font-bold text-xl">FDA</div>
            <div className="font-bold text-xl">CDC</div>
          </div>
        </div>
      </section>

      {/* Subscription Section or Pricing Teaser */}
      <section className="px-4 py-8 space-y-4">
        {user ? (
          <div className="space-y-4">
            <h3 className="text-[18px] font-bold text-text-primary px-1">
              내 정보
            </h3>
            
            {/* Pregnancy Info Card */}
            <Card 
              className="bg-bg-surface border-border-subtle shadow-sm hover:bg-neutral-bg transition-colors cursor-pointer"
              onClick={() => navigate("/settings")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium text-text-primary block">
                      현재 임신 주차
                    </span>
                    <span className="text-sm text-text-secondary">
                      {user.pregnancy_weeks ? `${user.pregnancy_weeks}주차` : '설정하기'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary" />
              </CardContent>
            </Card>

            {/* Subscription Card */}
            <Card 
              className="bg-bg-surface border-border-subtle shadow-sm hover:bg-neutral-bg transition-colors cursor-pointer"
              onClick={() => navigate("/pricing")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-secondary/10 p-2 rounded-full">
                    <Star className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    {user.subscription_status === 'premium' ? (
                      <>
                        <span className="font-medium text-text-primary block mb-1">
                          1개월 무제한 이용권
                        </span>
                        {user.subscription_expires_at && (
                          <div className="space-y-1">
                            <p className="text-xs text-text-secondary">
                              이용기간: ~ {new Date(user.subscription_expires_at).toLocaleDateString('ko-KR')}
                            </p>
                            <p className="text-xs font-bold text-primary">
                              남은 기간: {Math.max(0, Math.ceil((new Date(user.subscription_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}일
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-text-primary block">
                          남은 스캔 횟수
                        </span>
                        <span className="text-sm font-bold text-secondary">
                          {user.remaining_scans || 0}회
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary" />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-[18px] font-bold text-text-primary px-1 mb-2">
              요금제 안내
            </h3>
            
            {/* 1 Month Unlimited Plan */}
            <Card className="bg-accent border-2 border-primary shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                가장 추천
              </div>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2 mb-2">
                  <Star className="w-5 h-5 text-primary fill-primary" />
                  <h2 className="text-lg font-bold text-text-primary">1개월 무제한 이용권</h2>
                </div>
                <p className="text-xs text-text-secondary mb-4">여러 제품을 비교해서 확인한다면 1개월 무제한이 가장 편해요.</p>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-text-primary">5,800원</span>
                  <span className="text-sm text-text-secondary ml-1">/ 30일</span>
                  <p className="text-xs text-primary font-medium mt-1">정상가 6,900원 (베타 특별가)</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm text-text-primary">30일 동안 횟수 제한 없이 스캔</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm text-text-primary">임신 주차 반영 개인화 분석</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm text-text-primary">스캔 히스토리 무제한 저장</span>
                  </li>
                  <li className="flex items-start space-x-2 mt-2 pt-2 border-t border-primary/20">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm font-medium text-primary">자동결제 아님 (필요할 때 다시 구매 가능)</span>
                  </li>
                </ul>
                <Button className="w-full text-base font-bold h-12" onClick={handleSubscribe}>
                  1개월 무제한 시작하기
                </Button>
              </CardContent>
            </Card>

            {/* 5 Scans Pass */}
            <Card className="bg-bg-surface border border-border-subtle shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-neutral-bg text-text-secondary text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                부담 없이 시작
              </div>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2 mb-2">
                  <h2 className="text-lg font-bold text-text-primary">5회 추가권</h2>
                </div>
                <p className="text-xs text-text-secondary mb-4">조금만 더 써보고 싶다면 5회 추가권을 선택할 수 있어요.</p>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-text-primary">1,800원</span>
                  <span className="text-sm text-text-secondary ml-1">/ 5회</span>
                  <p className="text-xs text-text-secondary mt-1 line-through">정상가 2,400원</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                    <span className="text-sm text-text-primary">결제 후 14일 동안 사용 가능</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                    <span className="text-sm text-text-primary">상세 분석 및 히스토리 제공</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full text-base font-bold h-12" onClick={handleSubscribe}>
                  5회 추가권 구매하기
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </div>
  )
}
