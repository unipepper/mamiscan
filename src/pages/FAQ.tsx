import { useNavigate } from "react-router-dom"
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react"
import { useState, useEffect } from "react"
import { useAuth } from "@/src/lib/AuthContext"

export function FAQ() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()
  const [openIndex, setOpenIndex] = useState<number | null>(0)

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

  const faqs = [
    {
      q: "이 정보는 얼마나 신뢰할 수 있나요?",
      a: "마마스캔의 성분 분석은 식약처(MFDS), 미국 FDA, CDC 등 공신력 있는 기관의 임산부 가이드라인을 바탕으로 이루어집니다. 다만, 개인의 건강 상태나 기저 질환에 따라 다를 수 있으므로 의료적 진단이나 조언을 대체할 수는 없습니다."
    },
    {
      q: "임신 주차는 어떻게 입력하나요?",
      a: "하단 메뉴의 '내 정보' 탭에서 현재 임신 주차를 입력할 수 있습니다. 입력하신 정보는 구독 플랜 이용 시 스캔 결과에 반영되어 주차별 맞춤 분석을 제공합니다."
    },
    {
      q: "무료 플랜과 구독 플랜의 차이는 무엇인가요?",
      a: "무료 플랜은 무제한 스캔과 기본 판정, 대체 제품 추천을 제공합니다. 월 3,900원의 구독 플랜을 이용하시면 임신 주차별 정밀 맞춤 분석과 스캔 히스토리 무제한 저장 기능이 추가됩니다."
    },
    {
      q: "대체 제품은 어떻게 추천되나요?",
      a: "스캔하신 제품과 동일한 용도의 상품군 중에서 주의 성분이 포함되지 않은 안전한 제품들을 선별하여 추천해 드립니다."
    }
  ]

  return (
    <div className="flex flex-col min-h-screen bg-bg-canvas pb-20">
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-primary">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-medium ml-2 text-text-primary">자주 묻는 질문</span>
      </header>

      <main className="px-4 py-6 space-y-4">
        <h1 className="text-[22px] font-bold text-text-primary px-1 mb-6">
          무엇을 도와드릴까요?
        </h1>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm"
            >
              <button 
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              >
                <span className="font-semibold text-text-primary pr-4">{faq.q}</span>
                {openIndex === idx ? (
                  <ChevronUp className="w-5 h-5 text-text-secondary shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-text-secondary shrink-0" />
                )}
              </button>
              {openIndex === idx && (
                <div className="px-4 pb-4 pt-1">
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
