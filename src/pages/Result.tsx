import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft, AlertTriangle, CheckCircle, Info, ChevronRight, ShoppingBag, Lock, Loader2, Flag, X } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent } from "@/src/components/ui/card"
import { Badge } from "@/src/components/ui/badge"
import { useAuth } from "@/src/lib/AuthContext"

export function Result() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const isPremium = user?.subscription_status === 'premium'
  const pregnancyWeeks = user?.pregnancy_weeks
  const hasWeekInfo = pregnancyWeeks !== undefined && pregnancyWeeks !== null

  const imageBase64 = location.state?.imageBase64 as string | undefined
  const barcode = location.state?.barcode as string | undefined
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
  const [inputWeeks, setInputWeeks] = useState<string>("12")
  const [isSubmittingWeeks, setIsSubmittingWeeks] = useState(false)
  const { updateUser } = useAuth()
  const weekPickerRef = useRef<HTMLDivElement>(null)
  const ITEM_H = 56

  useEffect(() => {
    if (showWeekModal) {
      setTimeout(() => {
        if (weekPickerRef.current) {
          const week = parseInt(inputWeeks) || 12
          weekPickerRef.current.scrollTop = (week - 1) * ITEM_H
        }
      }, 50)
    }
  }, [showWeekModal])

  const handlePickerScroll = () => {
    if (weekPickerRef.current) {
      const idx = Math.round(weekPickerRef.current.scrollTop / ITEM_H)
      setInputWeeks(String(Math.min(42, Math.max(1, idx + 1))))
    }
  }

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
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imageBase64 || null,
            barcode: barcode || null,
            pregnancyWeeks: hasWeekInfo ? pregnancyWeeks : null
          })
        })
        if (!res.ok) throw new Error("Server error")
        const data = await res.json()
        if (!data.success) throw new Error(data.message || "Analysis failed")
        const parsedResult = data.result
        if (!parsedResult.status.startsWith('error_')) {
          if (user) {
            const deductRes = await fetch('/api/user/deduct-scan', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            })
            if (deductRes.status === 403) {
              navigate('/pricing', { replace: true, state: { message: '남은 스캔 횟수가 없어요. 이용권을 충전해주세요.' } })
              return
            }
            // Save to scan history
            fetch('/api/scan/history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                productName: parsedResult.productName || '알 수 없는 제품',
                status: parsedResult.status,
                resultJson: parsedResult
              })
            }).catch(() => {})
          } else {
            saveToTemporaryHistory(parsedResult)
          }
        }
        setResult(parsedResult)
      } catch (err) {
        console.error("Analysis failed:", err)
        setError("분석 중 오류가 발생했습니다. 다시 시도해주세요.")
      } finally {
        setIsLoading(false)
      }
    }

    analyzeFood()
  }, [imageBase64, barcode])

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

      <main className="px-4 py-5 space-y-5">
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
          <CardContent className="p-5 flex flex-col">

            {/* 상단: 뱃지 + 제품 이미지 */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center flex-wrap gap-2">
                <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border-transparent text-white ${
                  isError ? 'bg-text-secondary' :
                  result.status === 'success' ? 'bg-success-fg' :
                  result.status === 'danger' ? 'bg-danger-fg' : 'bg-caution-fg'
                }`}>
                  {isError ? <Info className="w-3.5 h-3.5 mr-1" /> :
                   result.status === 'success' ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> :
                   <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                  {isError ? '참고 정보' : result.status === 'success' ? '안전' : result.status === 'danger' ? '위험' : '주의 필요'}
                </div>
                {hasWeekInfo && (
                  <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isError ? 'bg-neutral-bg text-text-secondary' : 'bg-white/60 text-primary'
                  }`}>
                    임신 {pregnancyWeeks}주차 맞춤
                  </div>
                )}
              </div>

              {/* 제품 이미지 */}
              {(result.imageUrl || imageBase64) && (
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/40 border border-white/40 shrink-0 ml-3">
                  <img
                    src={result.imageUrl || imageBase64}
                    alt={result.productName}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}
            </div>

            {/* 헤드라인 */}
            <h1 className={`text-[24px] leading-[32px] font-bold mb-1 ${
              isError ? 'text-text-primary' :
              result.status === 'success' ? 'text-success-fg' :
              result.status === 'danger' ? 'text-danger-fg' : 'text-caution-fg'
            }`}>
              {result.headline}
            </h1>

            {/* 제품명 */}
            <p className={`text-sm font-medium mb-4 ${
              isError ? 'text-text-secondary' :
              result.status === 'success' ? 'text-success-fg/70' :
              result.status === 'danger' ? 'text-danger-fg/70' : 'text-caution-fg/70'
            }`}>
              {result.productName}
            </p>

            {/* 설명 */}
            <p className="text-sm text-text-primary leading-[1.75] tracking-tight">
              {result.description}
            </p>

            {/* 주차별 맞춤 조언 */}
            {hasWeekInfo && result.weekAnalysis && (
              <div className="mt-4 pt-4 border-t border-black/10 w-full space-y-1.5">
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm">✨</span>
                  <p className="text-xs font-bold text-primary">임신 {pregnancyWeeks}주차 맞춤 조언</p>
                </div>
                <p className="text-sm text-text-primary leading-[1.75] tracking-tight">{result.weekAnalysis}</p>
              </div>
            )}

            {/* 주차 입력 CTA */}
            {!hasWeekInfo && user && (
              <button
                onClick={() => setShowWeekModal(true)}
                className="mt-4 w-full flex items-center justify-between px-4 py-3.5 bg-white/75 hover:bg-white/95 border border-white/80 rounded-2xl transition-all shadow-sm group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-lg">✨</div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-text-primary">주차별 맞춤 분석 받기</p>
                    <p className="text-[11px] text-text-secondary mt-0.5">임신 주차를 입력하면 딱 맞는 조언을 드려요</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </CardContent>
        </Card>

        {/* Locked Content Area */}
        <div className="relative">
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
            <section className="space-y-3">
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
            
            <div className="space-y-3">
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
        <section className="space-y-3 mt-6">
          <div>
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
        <section className="pt-3 pb-4">
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

      {/* Pregnancy Weeks Modal — Bottom Sheet Dial */}
      {showWeekModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowWeekModal(false)}
        >
          <div
            className="bg-bg-canvas w-full rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border-subtle rounded-full" />
            </div>

            <div className="px-6 pt-3 pb-2 text-center">
              <h3 className="text-lg font-bold text-text-primary">몇 주차이세요?</h3>
              <p className="text-xs text-text-secondary mt-1">주차에 맞는 맞춤 분석을 드릴게요</p>
            </div>

            {/* Dial */}
            <div className="relative mx-auto w-48 h-[168px] overflow-hidden">
              {/* Top fade */}
              <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-bg-canvas to-transparent pointer-events-none z-10" />
              {/* Bottom fade */}
              <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-bg-canvas to-transparent pointer-events-none z-10" />
              {/* Selection band */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-14 border-y-2 border-primary/30 bg-primary/5 pointer-events-none z-10 rounded-xl" />

              <div
                ref={weekPickerRef}
                onScroll={handlePickerScroll}
                className="h-full overflow-y-scroll"
                style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingTop: 56, paddingBottom: 56 }}
              >
                {Array.from({ length: 42 }, (_, i) => i + 1).map((w) => (
                  <div
                    key={w}
                    style={{ scrollSnapAlign: 'center', height: ITEM_H }}
                    className={`flex items-center justify-center text-2xl font-bold transition-colors ${
                      parseInt(inputWeeks) === w ? 'text-primary' : 'text-text-secondary/40'
                    }`}
                  >
                    {w}주차
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 pb-8 pt-4">
              <Button
                onClick={handleWeekSubmit}
                disabled={isSubmittingWeeks}
                className="w-full font-bold h-12 rounded-2xl text-base"
              >
                {isSubmittingWeeks ? <Loader2 className="w-5 h-5 animate-spin" /> : "저장하기"}
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
