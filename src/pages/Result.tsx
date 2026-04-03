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
  const existingResultData = location.state?.resultData as any | undefined

  const [result, setResult] = useState<any>(existingResultData || null)
  const [isLoading, setIsLoading] = useState(!existingResultData)
  const [error, setError] = useState<string | null>(null)

  // Report Error State
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportText, setReportText] = useState("")
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Pregnancy Weeks Modal State
  const [showWeekModal, setShowWeekModal] = useState(false)
  const [inputWeeks, setInputWeeks] = useState<string>("")
  const [isSubmittingWeeks, setIsSubmittingWeeks] = useState(false)
  const { updateUser } = useAuth()

  const handleWeekSubmit = async () => {
    const weeks = parseInt(inputWeeks, 10)
    if (isNaN(weeks) || weeks < 1 || weeks > 42) {
      alert("1에서 42 사이의 숫자를 입력해주세요.")
      return
    }

    setIsSubmittingWeeks(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/user/pregnancy-weeks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ weeks })
      })
      const data = await res.json()
      if (data.success) {
        updateUser(data.user)
        setShowWeekModal(false)
        setToastMessage("임신 주차가 설정되었습니다. 다시 스캔하시면 맞춤 결과를 볼 수 있어요!")
        setTimeout(() => setToastMessage(null), 3000)
      } else {
        alert(data.message || "주차 설정에 실패했습니다.")
      }
    } catch (e) {
      console.error(e)
      alert("오류가 발생했습니다.")
    } finally {
      setIsSubmittingWeeks(false)
    }
  }

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

  const saveToTemporaryHistory = (parsedResult: any) => {
    if (user) return; // Only save to temporary history if not logged in
    try {
      const history = JSON.parse(localStorage.getItem('temporaryHistory') || '[]');
      const newItem = {
        id: Date.now(),
        name: parsedResult.productName || "알 수 없는 제품",
        brand: "알 수 없음",
        status: parsedResult.status,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('ko-KR'),
        timestamp: Date.now(),
        resultData: parsedResult // Store full result to show it later if needed
      };
      
      // Add to beginning, keep max 3 items for non-logged in users
      const updatedHistory = [newItem, ...history].slice(0, 3);
      localStorage.setItem('temporaryHistory', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error("Failed to save temporary history", e);
    }
  };

  useEffect(() => {
    if (existingResultData) {
      return; // Skip analysis if we already have data
    }
    async function analyzeFood() {
      if (!imageBase64) {
        // Fallback to mock data if no image is provided (e.g., barcode scan)
        const mockResult = {
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
        };
        setResult(mockResult)
        saveToTemporaryHistory(mockResult)
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
                text: `이 사진에 있는 제품이 무엇인지 식별하고, 임산부가 섭취해도 안전한지 분석해줘.
                만약 사진이 식료품이 아니거나 식별이 불가능하다면, 다음 중 가장 적절한 status를 선택해줘:
                - "error_future_category": 일반 화장품, 일반의약품 등 마미스캔이 추후 지원할 예정인 카테고리인 경우
                - "error_unsupported_category": 전문의약품, 식당 조리 음식 등 성분 판정 기준이 달라 지원하지 않는 카테고리인 경우
                - "error_image_quality": 사진이 너무 흐리거나, 너무 어둡거나, 여러 제품이 찍혔거나, 제품이 없는 경우
                - "error_db_mismatch": 바코드는 인식되나 제품을 도저히 알 수 없는 경우
                
                정상적으로 식별된 식료품인 경우 status를 "success", "caution", "danger" 중 하나로 설정해줘.
                
                ★중요★: 만약 위의 error_* status를 선택하더라도, 이미지 속 제품/음식이 무엇인지 대략적으로라도 식별할 수 있다면, productName, headline, description, ingredients, weekAnalysis에 정상적인 분석 정보를 최대한 작성해줘. 완전히 식별 불가능한 경우에만 description에 그 이유를 적어줘.
                
                ${hasWeekInfo ? `현재 사용자는 임신 ${pregnancyWeeks}주차입니다. description 작성 시, 이 주차의 임산부에게 맞는 맞춤형 섭취 조언을 자연스럽게 포함하여 하나의 문단으로 작성해줘. weekAnalysis 필드는 빈 문자열("")로 남겨둬.` : `일반적인 임산부 기준으로 섭취 조언을 weekAnalysis에 작성해줘.`}
                다음 JSON 형식으로 응답해줘:
                {
                  "status": "success" | "caution" | "danger" | "error_future_category" | "error_unsupported_category" | "error_image_quality" | "error_db_mismatch",
                  "productName": "식별된 식료품 이름 (식별 불가시 '알 수 없음')",
                  "headline": "요약 헤드라인 (주의/위험 성분명 직접 언급 절대 금지. 예: 안심하고 드셔도 좋아요, 주의가 필요한 성분이 있어요 등)",
                  "description": "임산부 섭취와 관련된 전반적인 설명 (주의/위험 성분명 직접 언급 절대 금지. 식별 불가시 그 이유를 짧게 작성. 예: '너무 어두워요', '여러 제품이 찍혔어요')",
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
                status: { type: Type.STRING, description: "success, caution, danger, error_future_category, error_unsupported_category, error_image_quality, error_db_mismatch" },
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
          if (parsedResult.status.startsWith('error_')) {
            setResult(parsedResult)
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
            } else {
              saveToTemporaryHistory(parsedResult);
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

  if (error) {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas items-center justify-center min-h-screen px-6">
        <div className="bg-danger-bg p-4 rounded-full mb-6">
          <AlertTriangle className="w-12 h-12 text-danger-fg" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2 text-center">분석에 실패했어요</h2>
        <p className="text-text-secondary font-medium mb-8 text-center leading-relaxed">
          {error}
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

  if (result && result.status.startsWith('error_')) {
    const isFoodIdentified = result.productName && result.productName !== '알 수 없음' && result.productName.trim() !== '';
    
    if (!isFoodIdentified) {
      let head = "";
      let body = "";
      let ctaText = "다시 촬영하기";
      let ctaAction = () => navigate(-1);
      let subTip = result.description;

      switch (result.status) {
        case 'error_future_category':
          head = "아직 이 제품은 확인하기 어려워요";
          body = "이 카테고리는 아직 준비 중이에요.";
          ctaText = "다른 제품 스캔하기";
          break;
        case 'error_unsupported_category':
          head = "이 종류는 마미스캔이 판정하기 어려워요";
          body = "처방약이나 조리 음식은 성분 판정 기준이 달라서 지원하지 않아요. 담당 의사 또는 약사에게 문의해 주세요.";
          ctaText = "지원 범위 확인하기";
          ctaAction = () => navigate("/"); // Or an info page if exists
          break;
        case 'error_image_quality':
          head = "제품이 잘 안 보여요";
          body = "제품 하나만 가까이서, 밝은 곳에서 다시 찍어주세요.";
          ctaText = "다시 촬영하기";
          break;
        case 'error_db_mismatch':
          head = "아직 데이터베이스에 없는 제품이에요";
          body = "바코드는 읽었는데 아직 이 제품 정보가 없어요. 제품 이미지를 다시 찍으면 분석할 수 있어요.";
          ctaText = "제품 이미지 다시 촬영하기";
          break;
        default:
          head = "분석에 실패했어요";
          body = "식료품을 명확하게 인식할 수 없거나 네트워크 오류가 발생했습니다.";
      }

      return (
        <div className="flex flex-col flex-1 bg-bg-canvas items-center justify-center min-h-screen px-6">
          <div className="bg-neutral-bg p-4 rounded-full mb-6">
            <Info className="w-12 h-12 text-text-secondary" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2 text-center">{head}</h2>
          <p className="text-text-secondary font-medium mb-2 text-center leading-relaxed">
            {body}
          </p>
          {subTip && (
            <p className="text-sm text-text-tertiary mb-8 text-center bg-bg-surface p-3 rounded-lg w-full max-w-xs">
              💡 {subTip}
            </p>
          )}
          <div className="flex flex-col w-full max-w-xs space-y-3 mt-4">
            <Button 
              onClick={ctaAction} 
              className="w-full font-bold py-6 rounded-xl shadow-md"
            >
              {ctaText}
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
  }

  if (!result) return null;

  const isError = result.status.startsWith('error_');

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
        {isError && (
          <div className="bg-neutral-bg rounded-xl p-4 flex items-start space-x-3 border border-border-subtle">
            <Info className="w-5 h-5 text-text-secondary shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-1">
                {result.status === 'error_future_category' ? "아직 이 제품은 정확한 확인이 어려워요" :
                 result.status === 'error_unsupported_category' ? "이 종류는 마미스캔이 판정하기 어려워요" :
                 result.status === 'error_image_quality' ? "제품이 잘 안 보여서 정확하지 않을 수 있어요" :
                 "아직 데이터베이스에 없는 제품이에요"}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                {result.status === 'error_future_category' ? "이 카테고리는 아직 준비 중이에요. 아래 정보는 참고용으로만 확인해주세요." :
                 result.status === 'error_unsupported_category' ? "처방약이나 조리 음식은 성분 판정 기준이 달라서 지원하지 않아요. 아래 정보는 참고용으로만 확인해주세요." :
                 result.status === 'error_image_quality' ? "제품 하나만 가까이서, 밝은 곳에서 다시 찍어주시면 더 정확해요." :
                 "바코드 정보가 없어 이미지 기반으로 분석한 참고용 정보입니다."}
              </p>
            </div>
          </div>
        )}

        {/* Result Summary Card */}
        <Card className={`border-none shadow-none overflow-hidden ${
          isError ? 'bg-bg-surface border border-border-subtle' :
          result.status === 'success' ? 'bg-success-bg' : 
          result.status === 'danger' ? 'bg-danger-bg' : 'bg-caution-bg'
        }`}>
          <CardContent className="p-6 flex flex-col items-start">
            <div className="flex items-center flex-wrap gap-2 mb-4">
              <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent text-white ${
                isError ? 'bg-text-secondary hover:bg-text-secondary/80' :
                result.status === 'success' ? 'bg-success-fg hover:bg-success-fg/80' : 
                result.status === 'danger' ? 'bg-danger-fg hover:bg-danger-fg/80' : 'bg-caution-fg hover:bg-caution-fg/80'
              }`}>
                {isError ? <Info className="w-3.5 h-3.5 mr-1" /> :
                 result.status === 'success' ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                {isError ? '참고 정보' :
                 result.status === 'success' ? '안전' : 
                 result.status === 'danger' ? '위험' : '주의 필요'}
              </div>
              {hasWeekInfo && (
                <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm ${
                  isError ? 'bg-neutral-bg text-text-secondary' : 'bg-white/60 text-primary'
                }`}>
                  임신 {pregnancyWeeks}주차 맞춤
                </div>
              )}
            </div>
            <h1 className={`text-[26px] leading-[35px] font-bold mb-2 ${
              isError ? 'text-text-primary' :
              result.status === 'success' ? 'text-success-fg' : 
              result.status === 'danger' ? 'text-danger-fg' : 'text-caution-fg'
            }`}>
              {result.headline}
            </h1>
            <p className={`text-sm font-medium mb-4 ${
              isError ? 'text-text-secondary' :
              result.status === 'success' ? 'text-success-fg/80' : 
              result.status === 'danger' ? 'text-danger-fg/80' : 'text-caution-fg/80'
            }`}>
              {result.productName}
            </p>
            <p className="text-sm text-text-primary leading-relaxed">
              {result.description}
              {hasWeekInfo && result.weekAnalysis && ` ${result.weekAnalysis}`}
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
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[18px] font-bold text-text-primary">
                  어떤 성분/특징 때문인가요?
                </h2>
                {hasWeekInfo && (
                  <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-md font-medium">
                    {pregnancyWeeks}주차 기준
                  </span>
                )}
              </div>
            
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
            {!hasWeekInfo && (
              <div className="space-y-3 mb-8 relative">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[18px] font-bold text-text-primary">
                    임신 주차별 맞춤 분석
                  </h2>
                </div>
                <div className="relative">
                  <div className={user ? "opacity-30 blur-[4px] pointer-events-none select-none" : ""}>
                    <Card className="bg-primary/5 border-primary/20 shadow-sm">
                      <CardContent className="p-4">
                        <p className="text-sm text-text-primary leading-relaxed">
                          현재 임신 주차에 따른 맞춤형 섭취 가이드와 주의사항을 상세하게 분석하여 제공해 드립니다. 개인화된 리포트를 확인해보세요.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  {user && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4">
                      <div className="bg-white/90 p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center max-w-[260px]">
                        <div className="bg-primary/10 p-2 rounded-full mb-2">
                          <Info className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-[15px] font-bold text-gray-900 mb-1">
                          임신 주차를 알려주세요
                        </p>
                        <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                          주차를 입력하면 우리 아이 발달 단계에 맞춘<br/>더 정확한 섭취 가이드를 제공해드려요.
                        </p>
                        <Button 
                          size="sm" 
                          onClick={() => setShowWeekModal(true)}
                          className="w-full h-9 text-xs font-bold rounded-xl"
                        >
                          주차 입력하기
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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

      {/* Pregnancy Weeks Modal */}
      {showWeekModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-canvas w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setShowWeekModal(false)}
              className="absolute top-4 right-4 p-1 text-text-secondary hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center">
              <Info className="w-5 h-5 mr-2 text-primary" />
              임신 주차 입력
            </h3>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              현재 임신 주차를 알려주시면, 우리 아이 발달 단계에 맞춘 더 정확하고 개인화된 섭취 가이드를 제공해드려요.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">현재 임신 주차 (1~42주)</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="number"
                    min="1"
                    max="42"
                    value={inputWeeks}
                    onChange={(e) => setInputWeeks(e.target.value)}
                    placeholder="예: 16"
                    className="flex-1 h-12 px-4 bg-bg-surface border border-border-subtle rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-text-secondary font-medium">주차</span>
                </div>
              </div>
              
              <Button 
                onClick={handleWeekSubmit}
                disabled={isSubmittingWeeks || !inputWeeks}
                className="w-full font-bold py-3 rounded-xl mt-2"
              >
                {isSubmittingWeeks ? <Loader2 className="w-5 h-5 animate-spin" /> : "입력 완료"}
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
