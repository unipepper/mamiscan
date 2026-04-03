import { useNavigate } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Sparkles, Star, Clock } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent } from "@/src/components/ui/card"
import { useAuth } from "@/src/lib/AuthContext"

export function Pricing() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSubscribe = async (passType: 'premium' | '5scans') => {
    if (!user) {
      navigate("/login", { state: { returnTo: "/pricing" } })
    } else {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/payments/mock-purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ passType })
        });
        const data = await res.json();
        if (data.success) {
          alert("결제가 완료되었습니다.");
          // Reload page to fetch updated user info
          window.location.href = "/settings";
        } else {
          alert("결제에 실패했습니다.");
        }
      } catch (err) {
        console.error(err);
        alert("결제 중 오류가 발생했습니다.");
      }
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-primary">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-medium ml-2 text-text-primary">이용권 구매</span>
      </header>

      <main className="px-4 py-6 space-y-8">
        {/* Intro */}
        <section className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-[26px] leading-[35px] font-bold text-text-primary">
            무료 체험 6회를<br />모두 사용했어요
          </h1>
          <p className="text-sm text-text-secondary">
            장볼 때마다 계속 확인하려면 이용권이 필요해요.
          </p>
        </section>

        {/* Pricing Cards */}
        <section className="space-y-4">
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
              <Button className="w-full text-base font-bold h-12" onClick={() => handleSubscribe('premium')}>
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
                <Clock className="w-5 h-5 text-text-secondary" />
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
              <Button variant="outline" className="w-full text-base font-bold h-12" onClick={() => handleSubscribe('5scans')}>
                5회 추가권 구매하기
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
