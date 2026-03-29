import { useNavigate } from "react-router-dom"
import { ArrowLeft, Clock, Search, Filter, Lock } from "lucide-react"
import { Card, CardContent } from "@/src/components/ui/card"
import { Badge } from "@/src/components/ui/badge"
import { useAuth } from "@/src/lib/AuthContext"
import { useEffect } from "react"
import { Button } from "@/src/components/ui/button"

export function History() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true })
    }
  }, [user, isLoading, navigate])

  const historyData = [
    { id: 1, date: "오늘", items: [
      { name: "매콤달콤 떡볶이 스낵", brand: "오리온", status: "caution", time: "오후 2:30" },
      { name: "유기농 바나나 우유", brand: "상하목장", status: "success", time: "오전 10:15" },
    ]},
    { id: 2, date: "어제", items: [
      { name: "무알콜 맥주 제로", brand: "하이트", status: "success", time: "오후 8:45" },
      { name: "매운 불닭 볶음면", brand: "삼양", status: "danger", time: "오후 1:20" },
    ]},
    { id: 3, date: "3월 20일", items: [
      { name: "디카페인 아메리카노", brand: "스타벅스", status: "caution", time: "오전 9:00" },
    ]}
  ]

  const isPremium = user?.subscription_status === 'premium'
  const displayData = isPremium ? historyData : historyData.slice(0, 1)

  if (isLoading || !user) {
    return <div className="min-h-screen bg-bg-canvas flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <span className="font-bold text-lg text-text-primary">스캔 히스토리</span>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Search & Filter */}
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input 
              type="text" 
              placeholder="제품명 검색" 
              className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button className="p-2 bg-bg-surface border border-border-subtle rounded-lg text-text-secondary hover:bg-neutral-bg transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* History List */}
        <div className="space-y-6">
          {displayData.map((group) => (
            <section key={group.id} className="space-y-3">
              <h3 className="text-sm font-bold text-text-secondary px-1">{group.date}</h3>
              <div className="grid gap-3">
                {group.items.map((item, idx) => (
                  <Card 
                    key={idx} 
                    className="bg-bg-surface border-border-subtle shadow-sm hover:bg-neutral-bg transition-colors cursor-pointer"
                    onClick={() => navigate("/result")}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-2 h-10 rounded-full ${
                          item.status === 'success' ? 'bg-success-fg' : 
                          item.status === 'caution' ? 'bg-caution-fg' : 'bg-danger-fg'
                        }`} />
                        <div>
                          <p className="text-xs text-text-secondary mb-0.5">{item.brand}</p>
                          <p className="font-semibold text-text-primary text-sm">{item.name}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent text-white ${item.status === 'success' ? 'bg-success-fg hover:bg-success-fg/80' : item.status === 'caution' ? 'bg-caution-fg hover:bg-caution-fg/80' : 'bg-danger-fg hover:bg-danger-fg/80'}`}>
                          {item.status === 'success' ? '안전' : item.status === 'caution' ? '주의' : '위험'}
                        </div>
                        <span className="text-[10px] text-text-secondary">{item.time}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}

          {!isPremium && (
            <div className="mt-8 p-6 bg-accent/50 border border-primary/20 rounded-xl text-center space-y-4">
              <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-base font-bold text-text-primary">
                과거 히스토리가 궁금하신가요?
              </h3>
              <p className="text-sm text-text-secondary">
                프리미엄 플랜을 구독하시면 무제한 스캔 히스토리를 확인하실 수 있습니다.
              </p>
              <Button 
                className="w-full font-bold mt-2"
                onClick={() => navigate("/pricing")}
              >
                프리미엄 혜택 알아보기
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
