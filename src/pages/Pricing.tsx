import { useNavigate } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Sparkles, Star } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent } from "@/src/components/ui/card"
import { useAuth } from "@/src/lib/AuthContext"

export function Pricing() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSubscribe = () => {
    if (!user) {
      navigate("/login")
    } else {
      // TODO: Implement payment logic
      console.log("Proceed to payment")
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-primary">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-medium ml-2 text-text-primary">구독 플랜</span>
      </header>

      <main className="px-4 py-6 space-y-8">
        {/* Intro */}
        <section className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-[26px] leading-[35px] font-bold text-text-primary">
            우리 아이를 위한<br />가장 확실한 안심
          </h1>
          <p className="text-sm text-text-secondary">
            프리미엄 플랜으로 주차별 맞춤 분석과<br />무제한 히스토리를 이용해보세요.
          </p>
        </section>

        {/* Pricing Cards */}
        <section className="space-y-4">
          {/* Early Bird Package */}
          <Card className="bg-accent border-2 border-primary shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
              얼리버드 특가 (선착순 300명)
            </div>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-2">
                <Star className="w-5 h-5 text-primary fill-primary" />
                <h2 className="text-lg font-bold text-text-primary">임신 패키지</h2>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-text-primary">33,000원</span>
                <span className="text-sm text-text-secondary ml-1">/ 일시불</span>
                <p className="text-xs text-primary font-medium mt-1">정가 49,000원 대비 33% 할인</p>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm text-text-primary">10개월 내내 무제한 이용 (월 3,300원 꼴)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm text-text-primary">임신 주차별 정밀 맞춤 분석</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm text-text-primary">스캔 히스토리 무제한 저장</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm text-text-primary">안전한 대체 제품 우선 추천</span>
                </li>
              </ul>
              <Button className="w-full text-base font-bold h-12" onClick={handleSubscribe}>
                임신 패키지 시작하기
              </Button>
            </CardContent>
          </Card>

          {/* Monthly Plan */}
          <Card className="bg-bg-surface border border-border-subtle shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-text-primary mb-2">월간 구독</h2>
              <div className="mb-4">
                <span className="text-2xl font-bold text-text-primary">3,900원</span>
                <span className="text-sm text-text-secondary ml-1">/ 월</span>
                <p className="text-xs text-text-secondary mt-1 line-through">정가 5,900원</p>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                  <span className="text-sm text-text-primary">임신 주차별 정밀 맞춤 분석</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                  <span className="text-sm text-text-primary">스캔 히스토리 무제한 저장</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full text-base font-bold h-12" onClick={handleSubscribe}>
                월간 구독 시작하기
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* FAQ Teaser */}
        <section className="text-center pt-4">
          <p className="text-sm text-text-secondary mb-2">
            결제나 서비스에 대해 궁금한 점이 있으신가요?
          </p>
          <button 
            className="text-sm font-bold text-primary hover:underline"
            onClick={() => navigate("/faq")}
          >
            자주 묻는 질문(FAQ) 보기
          </button>
        </section>
      </main>
    </div>
  )
}
