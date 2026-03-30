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

  const isPackage = id === 'package'

  const planData = {
    package: {
      title: "임신 패키지",
      subtitle: "얼리버드 특가",
      heroImage: "https://picsum.photos/seed/motherhood/800/600?blur=2",
      hook: "열 달 내내, 우리 아이를 위한 가장 확실한 안심",
      price: "33,000",
      originalPrice: "49,000원",
      period: "일시불 (10개월)",
      discountBadge: "33% 할인",
      socialProof: {
        rating: "4.9",
        reviews: "2,104",
        text: "이미 1만 명의 예비맘이 선택했어요!"
      },
      features: [
        { icon: <Clock className="w-6 h-6 text-primary" />, title: "10개월 내내 무제한", desc: "매번 결제할 필요 없이 단 한 번의 결제로 출산일까지 마음 편히 스캔하세요. (월 3,300원 꼴)" },
        { icon: <ShieldCheck className="w-6 h-6 text-primary" />, title: "주차별 정밀 맞춤 분석", desc: "임신 초기, 중기, 후기... 매주 변하는 주의 성분을 꼼꼼하게 체크해 드립니다." },
        { icon: <Search className="w-6 h-6 text-primary" />, title: "안전한 대체 제품 추천", desc: "주의 성분이 발견되면, 안심하고 먹을 수 있는 비슷한 제품을 가장 먼저 추천받을 수 있습니다." },
        { icon: <CheckCircle2 className="w-6 h-6 text-primary" />, title: "스캔 히스토리 평생 소장", desc: "과거에 스캔했던 모든 제품의 기록을 언제든 다시 확인할 수 있습니다." }
      ],
      valueAnchor: "한 달에 커피 한 잔 가격(3,300원)으로\n10개월 내내 성분 걱정 없이 안심하세요.",
      faqs: [
        { q: "결제 후 환불이 가능한가요?", a: "네, 결제 후 7일 이내 미사용 시 100% 환불해 드립니다." },
        { q: "임신 주차는 어떻게 설정하나요?", a: "가입 시 입력한 출산 예정일을 기준으로 매주 자동으로 주차가 업데이트되며, 그에 맞는 성분 분석이 제공됩니다." },
        { q: "대체 제품은 믿을 수 있나요?", a: "마마스캔의 대체 제품은 식약처 데이터와 전문가 자문을 바탕으로 엄격하게 선별된 '주의 성분 0개' 제품들입니다." }
      ],
      ctaText: "33,000원 결제하기",
      ctaGuestText: "로그인하고 33% 할인받기",
      theme: "primary",
      bgLight: "bg-primary/5",
      borderLight: "border-primary/20",
      textTheme: "text-primary"
    },
    monthly: {
      title: "월간 구독",
      subtitle: "베이직 플랜",
      heroImage: "https://picsum.photos/seed/care/800/600?blur=2",
      hook: "필요한 순간에만 가볍게, 안심 스캔",
      price: "3,900",
      originalPrice: "5,900원",
      period: "월",
      discountBadge: "런칭 특가",
      socialProof: {
        rating: "4.8",
        reviews: "852",
        text: "언제든 부담 없이 시작하고 해지하세요."
      },
      features: [
        { icon: <ShieldCheck className="w-6 h-6 text-secondary" />, title: "주차별 정밀 맞춤 분석", desc: "현재 임신 주차에 맞춰 주의해야 할 성분을 꼼꼼하게 체크해 드립니다." },
        { icon: <CheckCircle2 className="w-6 h-6 text-secondary" />, title: "스캔 히스토리 무제한 저장", desc: "과거에 스캔했던 모든 제품의 기록을 언제든 다시 확인할 수 있습니다." }
      ],
      valueAnchor: "언제든 위약금 없이 해지할 수 있어요.\n필요한 달에만 가볍게 이용해 보세요.",
      faqs: [
        { q: "언제든 해지할 수 있나요?", a: "네, 마이페이지에서 버튼 한 번으로 언제든 위약금 없이 해지할 수 있습니다. 해지하더라도 결제하신 달의 마지막 날까지는 혜택이 유지됩니다." },
        { q: "임신 패키지로 변경할 수 있나요?", a: "네, 월간 구독 이용 중 언제든 더 저렴한 임신 패키지로 업그레이드하실 수 있습니다." }
      ],
      ctaText: "월 3,900원 구독하기",
      ctaGuestText: "로그인하고 시작하기",
      theme: "secondary",
      bgLight: "bg-secondary/5",
      borderLight: "border-secondary/20",
      textTheme: "text-secondary"
    }
  }

  const plan = isPackage ? planData.package : planData.monthly

  const handleCtaClick = () => {
    if (!user) {
      navigate('/login')
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
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-3 ${isPackage ? 'bg-primary text-white' : 'bg-secondary text-white'} shadow-md`}>
            {plan.subtitle}
          </span>
          <h1 className="text-2xl font-bold text-text-primary mb-2 drop-shadow-sm">
            {plan.hook}
          </h1>
        </div>
      </div>

      <main className="px-4 space-y-8 relative z-10 -mt-2">
        {/* Pricing Card */}
        <Card className={`p-6 shadow-xl border-2 ${isPackage ? 'border-primary/30' : 'border-border-subtle'} bg-bg-surface rounded-2xl relative overflow-hidden`}>
          {plan.discountBadge && (
            <div className={`absolute top-0 right-0 ${isPackage ? 'bg-primary' : 'bg-secondary'} text-white text-[11px] font-bold px-4 py-1.5 rounded-bl-xl shadow-sm`}>
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
