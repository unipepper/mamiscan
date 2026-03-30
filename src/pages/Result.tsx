import { useNavigate } from "react-router-dom"
import { ArrowLeft, AlertTriangle, CheckCircle, Info, ChevronRight, ShoppingBag, Lock } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent } from "@/src/components/ui/card"
import { Badge } from "@/src/components/ui/badge"
import { useAuth } from "@/src/lib/AuthContext"

export function Result() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isPremium = user?.subscription_status === 'premium'

  // Mock data for result
  const result = {
    status: "caution", // "success" | "caution" | "danger"
    productName: "매콤달콤 떡볶이 스낵",
    headline: "주의해서 확인해 주세요",
    description: "임신 중 사용을 한 번 더 확인하는 것이 좋은 성분이 포함되어 있어요.",
    ingredients: [
      { name: "L-글루탐산나트륨", status: "caution", reason: "과다 섭취 시 임산부에게 두통이나 메스꺼움을 유발할 수 있어 주의가 필요해요." },
      { name: "합성착향료", status: "caution", reason: "일부 합성착향료는 알레르기 반응을 일으킬 수 있어요." },
      { name: "밀가루", status: "success", reason: "" },
      { name: "정제염", status: "success", reason: "" },
    ],
    alternatives: [
      { name: "우리밀 떡볶이 과자", brand: "자연드림", price: "2,500원" },
      { name: "현미 떡볶이 스낵", brand: "올가홀푸드", price: "3,200원" },
    ],
    weekAnalysis: "현재 임신 16주차(중기)에는 나트륨 배출이 원활하지 않을 수 있어 짠 음식 섭취에 더욱 주의가 필요합니다. 해당 제품은 나트륨 함량이 높아 섭취량을 조절하시는 것을 권장합니다."
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-primary">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-medium ml-2 text-text-primary">분석 결과</span>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Result Summary Card */}
        <Card className="bg-caution-bg border-none shadow-none overflow-hidden">
          <CardContent className="p-6 flex flex-col items-start">
            <div className="mb-4 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-caution-fg text-white hover:bg-caution-fg/80">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              주의 필요
            </div>
            <h1 className="text-[26px] leading-[35px] font-bold text-caution-fg mb-2">
              {result.headline}
            </h1>
            <p className="text-sm text-caution-fg/80 font-medium mb-4">
              {result.productName}
            </p>
            <p className="text-sm text-text-primary leading-relaxed">
              {result.description}
            </p>
          </CardContent>
        </Card>

        {/* Ingredients Detail (Member Only) */}
        <section className="space-y-4 relative">
          {!user && (
            <div className="absolute inset-0 z-10 bg-bg-canvas/60 backdrop-blur-[4px] flex flex-col items-center justify-center rounded-xl border border-border-subtle mt-8 p-6 text-center">
              <div className="bg-primary/10 p-3 rounded-full mb-3">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-text-primary mb-2">회원 전용 기능</h3>
              <p className="text-sm text-text-secondary mb-4">
                어떤 성분이 주의가 필요한지<br/>상세한 분석 결과를 확인해보세요.
              </p>
              <Button onClick={() => navigate("/login")} className="font-bold">
                로그인 / 회원가입 하기
              </Button>
            </div>
          )}
          
          <div className={!user ? "opacity-40 pointer-events-none select-none" : ""}>
            <h2 className="text-[18px] font-bold text-text-primary px-1">
              어떤 성분 때문인가요?
            </h2>
            
            <div className="space-y-3 mt-4">
              {result.ingredients.filter(i => i.status !== "success").map((ingredient, idx) => (
                <Card key={idx} className="bg-bg-surface border-border-subtle shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-text-primary">{ingredient.name}</span>
                      <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent text-white ${ingredient.status === 'caution' ? 'bg-caution-fg hover:bg-caution-fg/80' : 'bg-danger-fg hover:bg-danger-fg/80'}`}>
                        {ingredient.status === "caution" ? "주의" : "위험"}
                      </div>
                    </div>
                    <div className="bg-neutral-bg rounded-lg p-3 mt-3">
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {ingredient.reason}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Premium Features: Week Analysis & Alternatives */}
        <section className="space-y-6 pt-4 border-t border-border-subtle">
          <div>
            {/* Week Analysis */}
            <div className="space-y-3 mb-8">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[18px] font-bold text-text-primary">
                  임신 주차별 맞춤 분석
                </h2>
                <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-md font-medium">
                  16주차 (중기)
                </span>
              </div>
              <div className="relative">
                <div className={!isPremium ? "opacity-30 blur-[3px] pointer-events-none select-none" : ""}>
                  <Card className="bg-primary/5 border-primary/20 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-sm text-text-primary leading-relaxed">
                        {result.weekAnalysis}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                {user && !isPremium && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center">
                    <Lock className="w-8 h-8 text-text-secondary/40" />
                  </div>
                )}
              </div>
            </div>

            {/* Alternatives Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[18px] font-bold text-text-primary">
                  안전한 대체 제품
                </h2>
                <span className="text-xs text-text-secondary bg-neutral-bg px-2 py-1 rounded-md">
                  광고 아님
                </span>
              </div>
              
              <p className="text-sm text-text-secondary px-1 mb-2">
                주의 성분이 없는 비슷한 제품을 찾아봤어요.
              </p>

              <div className="relative">
                <div className={!isPremium ? "opacity-30 blur-[3px] pointer-events-none select-none grid gap-3" : "grid gap-3"}>
                  {result.alternatives.map((alt, idx) => (
                    <Card key={idx} className="bg-bg-surface border-border-subtle shadow-sm hover:bg-neutral-bg transition-colors cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-neutral-bg rounded-md flex items-center justify-center shrink-0">
                            <ShoppingBag className="w-5 h-5 text-text-secondary" />
                          </div>
                          <div>
                            <p className="text-xs text-text-secondary mb-0.5">{alt.brand}</p>
                            <p className="font-semibold text-text-primary text-sm">{alt.name}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-text-secondary" />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {user && !isPremium && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
                    <div className="bg-primary/10 p-3 rounded-full mb-3">
                      <Lock className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-text-primary mb-2">프리미엄 전용 기능</h3>
                    <p className="text-sm text-text-secondary mb-4">
                      주차별 맞춤 분석과 안전한 대체 제품 추천은<br/>프리미엄 플랜에서 제공됩니다.
                    </p>
                    <Button onClick={() => navigate("/pricing")} className="font-bold shadow-md">
                      프리미엄 혜택 알아보기
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="pt-6 pb-8">
          <div className="bg-neutral-bg rounded-xl p-4 flex items-start space-x-3">
            <Info className="w-5 h-5 text-text-secondary shrink-0 mt-0.5" />
            <p className="text-[12px] leading-relaxed text-text-secondary">
              본 서비스의 분석 결과는 식약처 및 관련 기관의 가이드라인을 바탕으로 제공되나, <strong>의료적 진단이나 조언을 대체할 수 없습니다.</strong> 기저 질환이 있거나 불안하다면 담당 의료진의 안내를 우선해 주세요.
            </p>
          </div>
        </section>
      </main>

      {/* Bottom Action Panel */}
      <div className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 p-4 bg-bg-surface border-t border-border-subtle pb-safe z-50">
        <div className="flex space-x-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate("/history")}>
            히스토리 보기
          </Button>
          <Button className="flex-1" onClick={() => navigate("/scan")}>
            다른 제품 스캔
          </Button>
        </div>
      </div>
    </div>
  )
}
