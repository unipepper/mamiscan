import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft, AlertTriangle, CheckCircle, Info, ChevronRight, ShoppingBag, Lock, Loader2, Flag, X } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent } from "@/src/components/ui/card"
import { Badge } from "@/src/components/ui/badge"
import { useAuth } from "@/src/lib/AuthContext"
import { GoogleGenAI, Type } from "@google/genai"

export function Result() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const isPremium = user?.subscription_status === 'premium'
  const pregnancyWeeks = user?.pregnancy_weeks
  const hasWeekInfo = pregnancyWeeks !== undefined && pregnancyWeeks !== null

  const imageBase64 = location.state?.imageBase64 as string | undefined

  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Report Error State
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportText, setReportText] = useState("")
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const handleReportSubmit = () => {
    setIsSubmittingReport(true)
    // Mock API call
    setTimeout(() => {
      setIsSubmittingReport(false)
      setShowReportModal(false)
      setReportText("")
      setToastMessage("소중한 의견이 정상적으로 접수되었습니다. 감사합니다!")
      setTimeout(() => setToastMessage(null), 3000)
    }, 1000)
  }

  useEffect(() => {
    async function analyzeFood() {
      if (!imageBase64) {
        // Fallback to mock data if no image is provided (e.g., barcode scan)
        setResult({
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
        })
        setIsLoading(false)
        return
      }

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
        
        // Extract base64 data without the prefix (e.g., "data:image/jpeg;base64,...")
        const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64
        const mimeTypeMatch = imageBase64.match(/data:([^;]+);/)
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg"

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
              {
                text: `이 사진에 있는 식료품이 무엇인지 식별하고, 임산부가 섭취해도 안전한지 분석해줘.
                만약 사진이 너무 흐리거나 식료품이 아니어서 식별이 불가능하다면, status를 "unknown"으로 설정하고 description에 그 이유를 적어줘.
                ${hasWeekInfo ? `현재 사용자는 임신 ${pregnancyWeeks}주차입니다. 이 주차의 임산부에게 맞는 섭취 조언을 weekAnalysis에 작성해줘.` : `일반적인 임산부 기준으로 섭취 조언을 weekAnalysis에 작성해줘.`}
                다음 JSON 형식으로 응답해줘:
                {
                  "status": "success" | "caution" | "danger" | "unknown",
                  "productName": "식별된 식료품 이름 (식별 불가시 '알 수 없음')",
                  "headline": "요약 헤드라인 (주의/위험 성분명 직접 언급 절대 금지. 예: 안심하고 드셔도 좋아요, 주의가 필요한 성분이 있어요 등)",
                  "description": "임산부 섭취와 관련된 전반적인 설명 (주의/위험 성분명 직접 언급 절대 금지. 식별 불가시 그 이유)",
                  "ingredients": [
                    { "name": "주요 성분/특징 1", "status": "success" | "caution" | "danger", "reason": "이유" }
                  ],
                  "alternatives": [
                    { "name": "대체 식품 이름", "brand": "브랜드명 (없으면 일반명칭)", "price": "예상 가격대" }
                  ],
                  "weekAnalysis": "임신 주차에 따른 섭취 조언"
                }`
              }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING, description: "success, caution, danger, or unknown" },
                productName: { type: Type.STRING },
                headline: { type: Type.STRING },
                description: { type: Type.STRING },
                ingredients: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      status: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ["name", "status", "reason"]
                  }
                },
                alternatives: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      brand: { type: Type.STRING },
                      price: { type: Type.STRING }
                    },
                    required: ["name", "brand", "price"]
                  }
                },
                weekAnalysis: { type: Type.STRING }
              },
              required: ["status", "productName", "headline", "description", "ingredients", "alternatives", "weekAnalysis"]
            }
          }
        })

        const jsonStr = response.text?.trim()
        if (jsonStr) {
          const parsedResult = JSON.parse(jsonStr)
          if (parsedResult.status === 'unknown') {
            setError(parsedResult.description || "식료품을 명확하게 인식할 수 없습니다.\n다시 촬영해 주세요.")
            setResult(null)
          } else {
            // Deduct scan if user is logged in
            if (user) {
              try {
                const token = localStorage.getItem('token');
                await fetch('/api/user/deduct-scan', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                });
              } catch (e) {
                console.error("Failed to deduct scan:", e);
              }
            }
            setResult(parsedResult)
          }
        } else {
          throw new Error("No response from AI")
        }
      } catch (err) {
        console.error("Analysis failed:", err)
        setError("분석 중 오류가 발생했습니다. 다시 시도해주세요.")
      } finally {
        setIsLoading(false)
      }
    }

    analyzeFood()
  }, [imageBase64])

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-text-primary font-medium">식료품을 분석하고 있어요...</p>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas items-center justify-center min-h-screen px-6">
        <div className="bg-danger-bg p-4 rounded-full mb-6">
          <AlertTriangle className="w-12 h-12 text-danger-fg" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2 text-center">분석에 실패했어요</h2>
        <p className="text-text-secondary font-medium mb-8 text-center leading-relaxed">
          {error || "식료품을 명확하게 인식할 수 없거나\n네트워크 오류가 발생했습니다."}
        </p>
        <div className="flex flex-col w-full max-w-xs space-y-3">
          <Button 
            onClick={() => navigate(-1)} 
            className="w-full font-bold py-6 rounded-xl shadow-md"
          >
            다시 촬영하기
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate("/")} 
            className="w-full font-bold py-6 rounded-xl"
          >
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 bg-bg-canvas/80 backdrop-blur-md">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-primary">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <span className="font-medium ml-2 text-text-primary">분석 결과</span>
        </div>
        <button 
          onClick={() => setShowReportModal(true)}
          className="p-2 -mr-2 text-text-secondary hover:text-text-primary transition-colors flex items-center"
          aria-label="오류 제보하기"
        >
          <Flag className="w-5 h-5" />
        </button>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Result Summary Card */}
        <Card className={`border-none shadow-none overflow-hidden ${result.status === 'success' ? 'bg-success-bg' : result.status === 'danger' ? 'bg-danger-bg' : 'bg-caution-bg'}`}>
          <CardContent className="p-6 flex flex-col items-start">
            <div className={`mb-4 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent text-white ${result.status === 'success' ? 'bg-success-fg hover:bg-success-fg/80' : result.status === 'danger' ? 'bg-danger-fg hover:bg-danger-fg/80' : 'bg-caution-fg hover:bg-caution-fg/80'}`}>
              {result.status === 'success' ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
              {result.status === 'success' ? '안전' : result.status === 'danger' ? '위험' : '주의 필요'}
            </div>
            <h1 className={`text-[26px] leading-[35px] font-bold mb-2 ${result.status === 'success' ? 'text-success-fg' : result.status === 'danger' ? 'text-danger-fg' : 'text-caution-fg'}`}>
              {result.headline}
            </h1>
            <p className={`text-sm font-medium mb-4 ${result.status === 'success' ? 'text-success-fg/80' : result.status === 'danger' ? 'text-danger-fg/80' : 'text-caution-fg/80'}`}>
              {result.productName}
            </p>
            <p className="text-sm text-text-primary leading-relaxed">
              {result.description}
            </p>
          </CardContent>
        </Card>

        {/* Locked Content Area */}
        <div className="relative mt-6">
          {!user && (
            <div className="absolute inset-0 z-20 flex flex-col items-center pt-12 pb-8 bg-gradient-to-b from-transparent via-bg-canvas/60 to-bg-canvas backdrop-blur-[2px]">
              <div className="bg-white/95 p-6 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center max-w-[280px] text-center sticky top-32">
                <div className="bg-primary/10 p-3 rounded-full mb-3">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-bold text-text-primary mb-2">회원 전용 기능</h3>
                <p className="text-sm text-text-secondary mb-4 leading-relaxed">
                  상세 성분 분석부터 주차별 맞춤 가이드까지<br/>모든 결과를 확인해보세요.
                </p>
                <Button onClick={() => navigate("/login")} className="w-full font-bold rounded-xl py-5 shadow-sm">
                  로그인 / 회원가입 하기
                </Button>
              </div>
            </div>
          )}

          <div className={!user ? "opacity-30 pointer-events-none select-none overflow-hidden max-h-[400px]" : ""}>
            {/* Ingredients Detail */}
            <section className="space-y-4">
              <h2 className="text-[18px] font-bold text-text-primary px-1">
                어떤 성분/특징 때문인가요?
              </h2>
            
            <div className="space-y-3 mt-4">
              {!user ? (
                // Fake data for non-logged-in users to keep it short and visually appealing
                <>
                  <Card className="bg-bg-surface border-border-subtle shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-text-primary">주의 성분 A</span>
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-caution-fg text-white">
                          주의
                        </div>
                      </div>
                      <div className="bg-neutral-bg rounded-lg p-3 mt-3">
                        <p className="text-sm text-text-secondary leading-relaxed">
                          임산부에게 영향을 줄 수 있는 성분으로 섭취량 조절이 필요합니다.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-bg-surface border-border-subtle shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-text-primary">위험 성분 B</span>
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-danger-fg text-white">
                          위험
                        </div>
                      </div>
                      <div className="bg-neutral-bg rounded-lg p-3 mt-3">
                        <p className="text-sm text-text-secondary leading-relaxed">
                          임신 중 섭취를 피하는 것이 권장되는 성분입니다.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : result.ingredients && result.ingredients.filter((i: any) => i.status !== "success").length > 0 ? (
                result.ingredients.filter((i: any) => i.status !== "success").map((ingredient: any, idx: number) => (
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
                ))
              ) : (
                <Card className="bg-bg-surface border-border-subtle shadow-sm">
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="w-8 h-8 text-success-fg mx-auto mb-3" />
                    <p className="text-text-primary font-medium">주의해야 할 성분이나 특징이 발견되지 않았어요.</p>
                  </CardContent>
                </Card>
              )}
            </div>
            </section>

        {/* Premium Features: Week Analysis & Alternatives */}
        <section className="space-y-6 pt-4 border-t border-border-subtle">
          <div>
            {/* Week Analysis */}
            <div className="space-y-3 mb-8 relative">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[18px] font-bold text-text-primary">
                  임신 주차별 맞춤 분석
                </h2>
                {hasWeekInfo && (
                  <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-md font-medium">
                    {pregnancyWeeks}주차
                  </span>
                )}
              </div>
              <div className="relative">
                <div className={user && !hasWeekInfo ? "opacity-30 blur-[4px] pointer-events-none select-none" : ""}>
                  <Card className="bg-primary/5 border-primary/20 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-sm text-text-primary leading-relaxed">
                        {!user ? "현재 임신 주차에 따른 맞춤형 섭취 가이드와 주의사항을 상세하게 분석하여 제공해 드립니다. 개인화된 리포트를 확인해보세요." : result.weekAnalysis}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                {user && !hasWeekInfo && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4">
                    <div className="bg-white/90 p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center max-w-[260px]">
                      <div className="bg-primary/10 p-2 rounded-full mb-2">
                        <Lock className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-[15px] font-bold text-gray-900 mb-1">
                        임신 주차를 설정해주세요
                      </p>
                      <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                        마이페이지에서 주차를 입력하면 맞춤 가이드를 제공해드려요.
                      </p>
                      <Button 
                        size="sm" 
                        onClick={() => navigate("/profile")}
                        className="w-full h-9 text-xs font-bold rounded-xl"
                      >
                        주차 설정하기
                      </Button>
                    </div>
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
                주의할 특징이 없는 비슷한 제품을 찾아봤어요.
              </p>

              <div className="relative">
                <div className={!isPremium ? "opacity-30 blur-[3px] pointer-events-none select-none grid gap-3" : "grid gap-3"}>
                  {result.alternatives && result.alternatives.length > 0 ? (
                    result.alternatives.map((alt: any, idx: number) => (
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
                    ))
                  ) : (
                    <Card className="bg-bg-surface border-border-subtle shadow-sm">
                      <CardContent className="p-6 text-center">
                        <p className="text-text-secondary text-sm">추천할 만한 대체 제품이 없습니다.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {user && !isPremium && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
                    <div className="bg-primary/10 p-3 rounded-full mb-3">
                      <Lock className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-text-primary mb-2">이용권 전용 기능</h3>
                    <p className="text-sm text-text-secondary mb-4">
                      주차별 맞춤 분석과 안전한 대체 제품 추천은<br/>이용권 구매 시 제공됩니다.
                    </p>
                    <Button onClick={() => navigate("/pricing")} className="font-bold shadow-md">
                      이용권 알아보기
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
        </div>
      </div>

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

      {/* Report Error Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-canvas w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setShowReportModal(false)}
              className="absolute top-4 right-4 p-1 text-text-secondary hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center">
              <Flag className="w-5 h-5 mr-2 text-primary" />
              정보 오류 제보
            </h3>
            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              AI가 분석한 결과가 실제 제품과 다르다면 알려주세요. 보내주신 의견은 서비스 개선에 소중하게 사용됩니다.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">올바른 제품명이나 상세 내용을 적어주세요 (선택)</label>
                <textarea 
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="예: 이 제품은 떡볶이 스낵이 아니라 감자칩입니다."
                  className="w-full h-24 px-3 py-2 bg-bg-surface border border-border-subtle rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              
              <Button 
                onClick={handleReportSubmit}
                disabled={isSubmittingReport}
                className="w-full font-bold py-2.5 rounded-xl"
              >
                {isSubmittingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : "제보하기"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center px-4 z-[70] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-800/90 text-white px-4 py-3 rounded-xl shadow-lg backdrop-blur-md text-sm font-medium flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-success-fg" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}
