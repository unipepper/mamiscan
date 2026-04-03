import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Star, ShieldCheck, Search, Clock, Shield, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent } from "@/src/components/ui/card"
import { useAuth } from "@/src/lib/AuthContext"

export function PlanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const isUnlimited = id === 'unlimited'

  const planData = {
    unlimited: {
      title: "1개월 무제한 이용권",
      subtitle: "가장 추천",
      heroImage: "https://picsum.photos/seed/motherhood/800/600?blur=2",
      hook: "여러 제품을 비교해서 확인한다면\n1개월 무제한이 가장 편해요",
      price: "5,800",
      originalPrice: "6,900원",
      period: "30일",
      discountBadge: "베타 특별가",
      socialProof: {
        rating: "4.9",
        reviews: "2,104",
        text: "가장 많은 예비맘이 선택했어요!"
      },
      features: [
        { icon: <Clock className="w-6 h-6 text-primary" />, title: "30일 동안 횟수 제한 없이 스캔", desc: "마트에서 장볼 때마다 횟수 차감 걱정 없이 마음 편히 스캔하세요." },
        { icon: <ShieldCheck className="w-6 h-6 text-primary" />, title: "임신 주차 반영 개인화 분석", desc: "현재 임신 주차에 맞춰 주의해야 할 성분을 꼼꼼하게 체크해 드립니다." },
        { icon: <Search className="w-6 h-6 text-primary" />, title: "안전한 대체 제품 추천", desc: "주의 성분이 발견되면, 안심하고 먹을 수 있는 비슷한 제품을 가장 먼저 추천받을 수 있습니다." },
        { icon: <CheckCircle2 className="w-6 h-6 text-primary" />, title: "스캔 히스토리 무제한 저장", desc: "과거에 스캔했던 모든 제품의 기록을 언제든 다시 확인할 수 있습니다." }
      ],
      valueAnchor: "자동결제 걱정 없이 결제일 기준 30일 동안만!\n필요할 때 다시 구매할 수 있어요.",
      faqs: [
        { q: "자동으로 결제되나요?", a: "아니요, 마마스캔의 1개월 무제한 이용권은 정기구독이 아닙니다. 결제일로부터 30일이 지나면 자동으로 종료되며, 원하실 때 다시 구매하실 수 있습니다." },
        { q: "임신 주차는 어떻게 설정하나요?", a: "가입 시 입력한 출산 예정일을 기준으로 매주 자동으로 주차가 업데이트되며, 그에 맞는 성분 분석이 제공됩니다." },
        { q: "대체 제품은 믿을 수 있나요?", a: "마마스캔의 대체 제품은 식약처 데이터와 전문가 자문을 바탕으로 엄격하게 선별된 '주의 성분 0개' 제품들입니다." }
      ],
      ctaText: "5,800원 결제하기",
      ctaGuestText: "로그인하고 1개월 무제한 시작하기",
      theme: "primary",
      bgLight: "bg-primary/5",
      borderLight: "border-primary/20",
      textTheme: "text-primary"
    },
    pass: {
      title: "5회 추가권",
      subtitle: "부담 없이 시작",
      heroImage: "https://picsum.photos/seed/care/800/600?blur=2",
      hook: "조금만 더 써보고 싶다면\n5회 추가권을 선택할 수 있어요",
      price: "1,800",
      originalPrice: "2,400원",
      period: "5회",
      discountBadge: "베타 특별가",
      socialProof: {
        rating: "4.8",
        reviews: "852",
        text: "가볍게 더 써보고 싶은 분들께 추천해요."
      },
      features: [
        { icon: <Clock className="w-6 h-6 text-secondary" />, title: "결제 후 14일 동안 사용 가능", desc: "구매일로부터 14일 동안 5회의 스캔을 자유롭게 이용할 수 있습니다." },
        { icon: <ShieldCheck className="w-6 h-6 text-secondary" />, title: "상세 분석 및 히스토리 제공", desc: "무제한 이용권과 동일하게 주차별 맞춤 분석과 히스토리 저장 기능을 제공합니다." }
      ],
      valueAnchor: "무료 체험이 아쉬울 때,\n커피 반 잔 가격으로 가볍게 시작해 보세요.",
      faqs: [
        { q: "사용 기한이 있나요?", a: "네, 5회 추가권은 결제일로부터 14일 동안 사용하실 수 있습니다. 기한이 지나면 남은 횟수는 소멸됩니다." },
        { q: "사용 중에 1개월 이용권으로 바꿀 수 있나요?", a: "네, 언제든 1개월 무제한 이용권을 추가로 구매하실 수 있습니다. 이 경우 무제한 이용권이 우선 적용됩니다." }
      ],
      ctaText: "1,800원 결제하기",
      ctaGuestText: "로그인하고 5회 추가하기",
      theme: "secondary",
      bgLight: "bg-secondary/5",
      borderLight: "border-secondary/20",
      textTheme: "text-secondary"
    }
  }

  const plan = isUnlimited ? planData.unlimited : planData.pass

  const handleCtaClick = () => {
    if (!user) {
      navigate('/login', { state: { returnTo: `/plan/${isUnlimited ? 'unlimited' : 'pass'}` } })
    } else {
      alert('결제 모듈로 이동합니다.')
    }
  }

  const toggleFaq = (idx: number) => {
    if (openFaq === idx) setOpenFaq(null)
    else setOpenFaq(idx)
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-28 relative">
      {/* Transparent Header */}
      <header className="fixed top-0 w-full max-w-md z-50 flex items-center h-14 px-4 bg-gradient-to-b from-black/60 to-transparent text-white">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6 drop-shadow-md" />
        </button>
      </header>

      {/* Hero Image Section */}
      <div className="relative h-72 w-full shrink-0">
        <img src={plan.heroImage} alt={plan.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-canvas via-bg-canvas/40 to-transparent" />
        
        <div className="absolute bottom-6 left-0 w-full px-6 text-center">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-3 ${isUnlimited ? 'bg-primary text-white' : 'bg-secondary text-white'} shadow-md`}>
            {plan.subtitle}
          </span>
          <h1 className="text-2xl font-bold text-text-primary mb-2 drop-shadow-sm">
            {plan.hook}
          </h1>
        </div>
      </div>

      <main className="px-4 space-y-8 relative z-10 -mt-2">
        {/* Pricing Card */}
        <Card className={`p-6 shadow-xl border-2 ${isUnlimited ? 'border-primary/30' : 'border-border-subtle'} bg-bg-surface rounded-2xl relative overflow-hidden`}>
          {plan.discountBadge && (
            <div className={`absolute top-0 right-0 ${isUnlimited ? 'bg-primary' : 'bg-secondary'} text-white text-[11px] font-bold px-4 py-1.5 rounded-bl-xl shadow-sm`}>
              {plan.discountBadge}
            </div>
          )}
          <div className="text-center mt-2">
            <h2 className="text-lg font-bold text-text-secondary mb-1">{plan.title}</h2>
            <div className="flex items-baseline justify-center space-x-1 mb-2">
              <span className="text-4xl font-extrabold text-text-primary">{plan.price}</span>
              <span className="text-lg font-bold text-text-primary">원</span>
              <span className="text-sm text-text-secondary ml-1">/ {plan.period}</span>
            </div>
            <p className="text-sm text-text-secondary line-through decoration-text-secondary/50">
              정가 {plan.originalPrice}
            </p>
          </div>
        </Card>

        {/* Social Proof */}
        <div className="flex flex-col items-center justify-center space-y-2 py-2">
          <div className="flex items-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            ))}
            <span className="font-bold text-text-primary ml-2">{plan.socialProof.rating}</span>
          </div>
          <p className="text-sm font-medium text-text-secondary">
            {plan.socialProof.text} <span className="text-xs opacity-70">({plan.socialProof.reviews}개 리뷰)</span>
          </p>
        </div>

        {/* Value Anchor */}
        <div className={`p-5 rounded-2xl ${plan.bgLight} ${plan.borderLight} border text-center`}>
          <p className="text-[15px] font-semibold text-text-primary leading-relaxed whitespace-pre-line">
            {plan.valueAnchor}
          </p>
        </div>

        {/* Features */}
        <section className="space-y-5 pt-4">
          <div className="flex items-center space-x-2 px-1">
            <Shield className={`w-5 h-5 ${plan.textTheme}`} />
            <h2 className="text-xl font-bold text-text-primary">어떤 혜택이 있나요?</h2>
          </div>
          <div className="grid gap-4">
            {plan.features.map((feature, idx) => (
              <div key={idx} className="flex items-start space-x-4 p-5 bg-bg-surface rounded-2xl border border-border-subtle shadow-sm">
                <div className={`p-3 rounded-xl shrink-0 ${plan.bgLight}`}>
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-bold text-text-primary mb-1.5 text-[16px]">{feature.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="space-y-5 pt-6 pb-8 border-t border-border-subtle">
          <h2 className="text-xl font-bold text-text-primary px-1">자주 묻는 질문</h2>
          <div className="space-y-3">
            {plan.faqs.map((faq, idx) => (
              <div key={idx} className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
                <button 
                  className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none"
                  onClick={() => toggleFaq(idx)}
                >
                  <span className="font-semibold text-[15px] text-text-primary pr-4">{faq.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-text-secondary shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-text-secondary shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4 text-sm text-text-secondary leading-relaxed bg-neutral-bg/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-bg-canvas/90 backdrop-blur-md border-t border-border-subtle z-50 pb-safe">
        <div className="flex justify-center mb-2">
          <span className="text-[11px] font-medium text-text-secondary flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> 안전 결제 및 언제든 해지 가능
          </span>
        </div>
        <Button className="w-full h-14 text-lg font-bold shadow-lg rounded-xl" onClick={handleCtaClick}>
          {user ? plan.ctaText : plan.ctaGuestText}
        </Button>
      </div>
    </div>
  )
}
