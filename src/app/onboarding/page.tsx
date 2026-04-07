'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ScanLine, ShieldCheck, Baby, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SLIDES = [
  {
    icon: ScanLine,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    title: '바코드 하나로\n임산부 식품 안전 확인',
    description: '마트에서 바코드만 찍으면\n먹어도 되는지 바로 알 수 있어요',
    badges: null,
  },
  {
    icon: ShieldCheck,
    iconBg: 'bg-secondary/10',
    iconColor: 'text-secondary',
    title: '공신력 있는 기관\n가이드라인 기반 판정',
    description: '전 세계 주요 의료기관의 임산부\n영양 기준을 바탕으로 분석해요',
    badges: ['식약처', 'FDA', 'WHO', 'ACOG'],
  },
  {
    icon: Baby,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    title: '임신 주차별\n맞춤 조언까지',
    description: '몇 주차인지 알려주면\n지금 시기에 딱 맞는 안전 정보를 드려요',
    badges: null,
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const goNext = () => {
    if (current < SLIDES.length - 1) setCurrent(current + 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 50 && current < SLIDES.length - 1) setCurrent(current + 1);
    if (delta < -50 && current > 0) setCurrent(current - 1);
    touchStartX.current = null;
  };

  const isLast = current === SLIDES.length - 1;

  return (
    <div
      className="flex flex-col flex-1 min-h-screen bg-bg-canvas overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 건너뛰기 */}
      <div className="flex justify-end px-5 pt-5 h-12">
        {!isLast && (
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            건너뛰기
          </button>
        )}
      </div>

      {/* 슬라이드 트랙 */}
      <div className="flex-1 flex flex-col">
        <div className="relative flex-1 overflow-hidden">
          <div
            className="flex h-full transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {SLIDES.map((slide, idx) => {
              const Icon = slide.icon;
              return (
                <div
                  key={idx}
                  className="w-full shrink-0 flex flex-col items-center justify-center px-8 text-center"
                >
                  {/* 아이콘 */}
                  <div className={`w-32 h-32 rounded-full ${slide.iconBg} flex items-center justify-center mb-8`}>
                    <Icon className={`w-14 h-14 ${slide.iconColor}`} />
                  </div>

                  {/* 제목 */}
                  <h1 className="text-[26px] leading-[1.35] font-bold text-text-primary mb-4 whitespace-pre-line">
                    {slide.title}
                  </h1>

                  {/* 부제 */}
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line mb-6">
                    {slide.description}
                  </p>

                  {/* 기관 뱃지 (슬라이드 2) */}
                  {slide.badges && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {slide.badges.map((badge) => (
                        <span
                          key={badge}
                          className="bg-secondary/10 text-secondary text-xs font-semibold rounded-full px-3 py-1"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 하단 영역 */}
        <div className="px-6 pb-10 pt-4 flex flex-col items-center space-y-5">
          {/* 도트 인디케이터 */}
          <div className="flex items-center space-x-2">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === current ? 'bg-primary w-6' : 'bg-border-subtle w-2'
                }`}
              />
            ))}
          </div>

          {/* CTA */}
          {isLast ? (
            <div className="w-full space-y-3">
              <Button className="w-full h-14 text-base font-bold rounded-2xl" onClick={() => router.push('/scan')}>
                무료로 스캔해보기
              </Button>
              <Button variant="outline" className="w-full h-14 text-base font-bold rounded-2xl" onClick={() => router.push('/login')}>
                로그인 / 회원가입
              </Button>
            </div>
          ) : (
            <Button className="w-full h-14 text-base font-bold rounded-2xl" onClick={goNext}>
              다음
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
