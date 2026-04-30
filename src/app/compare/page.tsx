'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronRight, ShoppingBag, Scan } from 'lucide-react';

// ── 목업 데이터 ──────────────────────────────────────────────
const MOCK = {
  status: 'caution' as const,
  productName: '몬스터 에너지 울트라 355ml',
  brand: '한국코카콜라',
  description: '이 제품에는 카페인이 1캔(355ml) 기준 142mg 포함되어 있어요.\n임산부 카페인 하루 권장량은 200mg 이하이므로, 다른 카페인 음료와 함께 드시면 초과할 수 있어요.',
  weekAnalysis: '현재 임신 14주차에는 태아의 신경계가 발달하는 시기예요. 카페인은 태반을 통과하므로 가능하면 카페인이 없는 음료로 대체해보세요.',
  ingredients: [
    { name: '카페인', reason: '임산부 일일 권장 섭취량(200mg)에 근접한 수준이에요. 다른 식품의 카페인과 합산해서 확인해주세요.' },
    { name: '타우린', reason: '고함량 타우린 보충제는 임신 중 안전성 데이터가 부족해요. 식품 수준의 섭취는 일반적으로 문제없지만 과량은 피하는 게 좋아요.' },
  ],
  alternatives: [
    { brand: '동아오츠카', name: '포카리스웨트 340ml' },
    { brand: '롯데칠성', name: '트레비 레몬 350ml' },
  ],
};

// ── Notion 스타일 ─────────────────────────────────────────────
function NotionView({ section }: { section: 'result' | 'home' }) {
  if (section === 'home') {
    return (
      <div className="flex flex-col flex-1 bg-[#FCFBFA] pb-8">
        <header className="sticky top-0 z-50 w-full border-b border-[rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-md">
          <div className="flex h-14 items-center px-4">
            <span className="font-bold text-lg text-[rgba(0,0,0,0.95)]">마미스캔</span>
          </div>
        </header>
        <div className="px-4 pt-4 pb-6">
          <div className="bg-accent rounded-[28px] p-6 shadow-[0_4px_18px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.027),0_0.8px_3px_rgba(0,0,0,0.02)] border border-[rgba(0,0,0,0.05)] relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-start">
              <span className="text-sm font-semibold text-primary mb-1">제품을 스캔하고</span>
              <h1 className="text-[26px] leading-[35px] font-bold text-[rgba(0,0,0,0.95)] mb-2">
                지금 먹어도 되는지<br />바로 확인해보세요
              </h1>
              <p className="text-sm text-[#615d59] mb-5 leading-relaxed">
                임산부 기준 성분 분석부터<br />안전한 대체 제품 추천까지 5초면 충분해요.
              </p>
              <button className="w-full h-12 bg-primary text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(242,140,130,0.35)]">
                <Scan className="w-5 h-5" />5초 안에 확인하기
              </button>
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-10">
              <Scan className="w-40 h-40 text-primary" />
            </div>
          </div>
        </div>
        <section className="px-4 space-y-4">
          <h2 className="text-[22px] leading-[30px] font-bold text-[rgba(0,0,0,0.95)] px-1">마미스캔이 도와드릴게요</h2>
          {[
            { title: '바코드 스캔', desc: '마트에서 고민될 때, 제품 바코드나 식료품을 찍으면 바로 분석해드려요.' },
            { title: '주차별 맞춤 판단', desc: '현재 임신 주차에 맞춰 주의해야 할 성분을 꼼꼼하게 체크해드려요.' },
          ].map(({ title, desc }) => (
            <div key={title} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[16px] shadow-[0_4px_18px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.027),0_0.8px_3px_rgba(0,0,0,0.02)] p-5">
              <h3 className="text-lg font-bold text-[rgba(0,0,0,0.95)] mb-1">{title}</h3>
              <p className="text-sm text-[#615d59] leading-relaxed">{desc}</p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-[#FCFBFA] pb-24">
      <header className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 bg-white/80 backdrop-blur-md border-b border-[rgba(0,0,0,0.06)]">
        <span className="font-semibold text-[rgba(0,0,0,0.95)]">분석 결과</span>
        <span className="px-2 py-1 text-sm text-[#615d59]">오류 제보</span>
      </header>
      <main className="px-4 py-5 space-y-4">
        {/* Summary */}
        <div className="rounded-[28px] border overflow-hidden shadow-[0_4px_18px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.027),0_0.8px_3px_rgba(0,0,0,0.02)] bg-caution-bg border-[rgba(168,120,31,0.15)]">
          <div className="p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white bg-caution-fg">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />주의 필요
              </span>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border bg-white/60 border-white/40 text-primary">
                임신 14주차 맞춤
              </span>
            </div>
            <h1 className="text-[24px] leading-[32px] font-bold mb-1 break-keep text-caution-fg">
              카페인 함량이 높아서<br />하루 1캔 이내로 제한해주세요
            </h1>
            <p className="text-sm font-medium mb-4 text-caution-fg/70">한국코카콜라 몬스터 에너지 울트라 355ml</p>
            <div className="space-y-2.5">
              {MOCK.description.split('\n').map((line, i) => (
                <p key={i} className="text-sm text-[rgba(0,0,0,0.75)] break-keep">{line}</p>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-black/10 space-y-1.5">
              <p className="text-xs font-medium text-primary">✨ 임신 14주차 맞춤 조언</p>
              <p className="text-sm text-[rgba(0,0,0,0.75)] break-keep">{MOCK.weekAnalysis}</p>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <h2 className="text-[18px] font-bold text-[rgba(0,0,0,0.95)] px-1">어떤 성분 때문인가요?</h2>
        {MOCK.ingredients.map((ing, i) => (
          <div key={i} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[rgba(0,0,0,0.95)]">{ing.name}</span>
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white bg-caution-fg">주의</span>
              </div>
              <div className="bg-[#f6f5f4] rounded-lg p-3 mt-2">
                <p className="text-sm text-[#615d59] leading-relaxed break-keep">{ing.reason}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Alternatives */}
        <h2 className="text-[18px] font-bold text-[rgba(0,0,0,0.95)] px-1 pt-1">안전한 대체 제품</h2>
        {MOCK.alternatives.map((alt, i) => (
          <div key={i} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-[#f6f5f4] rounded-[10px] flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5 text-[#615d59]" />
                </div>
                <div>
                  <p className="text-xs text-[#a39e98] mb-0.5">{alt.brand}</p>
                  <p className="font-semibold text-[rgba(0,0,0,0.95)] text-sm">{alt.name}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#a39e98]" />
            </div>
          </div>
        ))}
      </main>

      {/* Bottom bar */}
      <div className="fixed bottom-0 w-full max-w-sm left-1/2 -translate-x-1/2 p-4 bg-white/90 backdrop-blur-md border-t border-[rgba(0,0,0,0.06)]">
        <div className="flex gap-3">
          <button className="flex-1 h-11 bg-[#f6f5f4] border border-[rgba(0,0,0,0.08)] text-[rgba(0,0,0,0.95)] rounded-lg text-sm font-medium flex items-center justify-center">홈으로</button>
          <button className="flex-1 h-11 bg-primary text-white rounded-lg text-sm font-medium flex items-center justify-center shadow-[0_2px_8px_rgba(242,140,130,0.35)]">다른 제품 스캔</button>
        </div>
      </div>
    </div>
  );
}

// ── Cal.com 스타일 ────────────────────────────────────────────
function CalView({ section }: { section: 'result' | 'home' }) {
  if (section === 'home') {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas pb-8">
        <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-bg-surface/80 backdrop-blur-md">
          <div className="flex h-14 items-center px-4">
            <span className="font-bold text-lg text-text-primary">마미스캔</span>
          </div>
        </header>
        <div className="px-4 pt-4 pb-6">
          <div className="bg-accent rounded-[28px] p-7 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-start">
              <span className="text-sm font-semibold text-primary mb-1">제품을 스캔하고</span>
              <h1 className="text-[26px] leading-[35px] font-bold text-text-primary mb-2">
                지금 먹어도 되는지<br />바로 확인해보세요
              </h1>
              <p className="text-sm text-text-secondary mb-5 leading-relaxed">
                임산부 기준 성분 분석부터<br />안전한 대체 제품 추천까지 5초면 충분해요.
              </p>
              <button className="w-full h-12 bg-primary text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(242,140,130,0.3)]">
                <Scan className="w-5 h-5" />5초 안에 확인하기
              </button>
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-10">
              <Scan className="w-40 h-40 text-primary" />
            </div>
          </div>
        </div>
        <section className="px-4 space-y-5">
          <h2 className="text-[22px] leading-[30px] font-bold text-text-primary px-1">마미스캔이 도와드릴게요</h2>
          {[
            { title: '바코드 스캔', desc: '마트에서 고민될 때, 제품 바코드나 식료품을 찍으면 바로 분석해드려요.' },
            { title: '주차별 맞춤 판단', desc: '현재 임신 주차에 맞춰 주의해야 할 성분을 꼼꼼하게 체크해드려요.' },
          ].map(({ title, desc }) => (
            <div key={title} className="bg-bg-surface border border-border-subtle rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)] p-5">
              <h3 className="text-[18px] font-bold text-text-primary mb-1">{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-24">
      <header className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <span className="font-bold text-text-primary">분석 결과</span>
        <span className="px-2 py-1 text-sm text-text-secondary">오류 제보</span>
      </header>
      <main className="px-4 py-5 space-y-5">
        {/* Summary */}
        <div className="rounded-[28px] overflow-hidden bg-caution-bg shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="p-7 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white bg-caution-fg">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />주의 필요
              </span>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-white/60 text-primary">
                임신 14주차 맞춤
              </span>
            </div>
            <h1 className="text-[24px] leading-[32px] font-bold mb-1 break-keep text-caution-fg">
              카페인 함량이 높아서<br />하루 1캔 이내로 제한해주세요
            </h1>
            <p className="text-sm font-medium mb-4 text-caution-fg/70">한국코카콜라 몬스터 에너지 울트라 355ml</p>
            <div className="space-y-2.5">
              {MOCK.description.split('\n').map((line, i) => (
                <p key={i} className="text-sm text-text-primary break-keep">{line}</p>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-black/10 space-y-1.5">
              <p className="text-xs font-medium text-primary">✨ 임신 14주차 맞춤 조언</p>
              <p className="text-sm text-text-primary break-keep">{MOCK.weekAnalysis}</p>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <h2 className="text-[18px] font-bold text-text-primary px-1">어떤 성분 때문인가요?</h2>
        {MOCK.ingredients.map((ing, i) => (
          <div key={i} className="bg-bg-surface border border-border-subtle rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-text-primary">{ing.name}</span>
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white bg-caution-fg">주의</span>
              </div>
              <div className="bg-neutral-bg rounded-lg p-3 mt-2">
                <p className="text-sm text-text-secondary leading-relaxed break-keep">{ing.reason}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Alternatives */}
        <h2 className="text-[18px] font-bold text-text-primary px-1 pt-1">안전한 대체 제품</h2>
        {MOCK.alternatives.map((alt, i) => (
          <div key={i} className="bg-bg-surface border border-border-subtle rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-neutral-bg rounded-lg flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5 text-text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-0.5">{alt.brand}</p>
                  <p className="font-bold text-text-primary text-sm">{alt.name}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-secondary" />
            </div>
          </div>
        ))}
      </main>

      {/* Bottom bar */}
      <div className="fixed bottom-0 w-full max-w-sm left-1/2 -translate-x-1/2 p-4 bg-bg-surface border-t border-border-subtle">
        <div className="flex gap-3">
          <button className="flex-1 h-11 bg-bg-surface border border-border-subtle text-text-primary rounded-xl text-sm font-medium flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">홈으로</button>
          <button className="flex-1 h-11 bg-primary text-white rounded-xl text-sm font-medium flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(242,140,130,0.3)]">다른 제품 스캔</button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
type Style = 'notion' | 'cal';
type Section = 'result' | 'home';

export default function ComparePage() {
  const [style, setStyle] = useState<Style>('notion');
  const [section, setSection] = useState<Section>('result');

  return (
    <div className="min-h-screen bg-[#e8e4df] flex flex-col items-center">
      {/* 컨트롤 바 */}
      <div className="w-full max-w-sm sticky top-0 z-[100] bg-[#e8e4df] px-4 pt-4 pb-3 space-y-2">
        {/* 화면 선택 */}
        <div className="flex gap-2 bg-white/60 rounded-xl p-1">
          {(['result', 'home'] as Section[]).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                section === s ? 'bg-white text-[rgba(0,0,0,0.9)] shadow-sm' : 'text-[#615d59]'
              }`}
            >
              {s === 'result' ? '결과 화면' : '홈 화면'}
            </button>
          ))}
        </div>

        {/* 스타일 전환 — 큰 토글 */}
        <div className="flex gap-2 bg-white/60 rounded-xl p-1">
          <button
            onClick={() => setStyle('notion')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              style === 'notion'
                ? 'bg-[rgba(0,0,0,0.85)] text-white shadow'
                : 'text-[#615d59] hover:text-[rgba(0,0,0,0.9)]'
            }`}
          >
            Notion 스타일
          </button>
          <button
            onClick={() => setStyle('cal')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              style === 'cal'
                ? 'bg-[rgba(0,0,0,0.85)] text-white shadow'
                : 'text-[#615d59] hover:text-[rgba(0,0,0,0.9)]'
            }`}
          >
            Cal.com 스타일
          </button>
        </div>
      </div>

      {/* 폰 프레임 */}
      <div className="w-full max-w-sm flex-1 relative">
        <div className="bg-white rounded-[32px] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.15)] min-h-[600px] flex flex-col relative mx-4 mb-8">
          {style === 'notion'
            ? <NotionView section={section} />
            : <CalView section={section} />
          }
        </div>
      </div>
    </div>
  );
}
