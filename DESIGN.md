# DESIGN.md — 마미스캔 (MamiScan)

> **AI coding agents**: Read this file before writing any UI code. All component, layout, and styling decisions must follow this system.
> Components defined here must be reused via src/components/ui, not reimplemented inline.

---

## 1. Brand Philosophy

마미스캔은 임산부가 마트에서 제품을 집어들 때 느끼는 불안을 없애주는 서비스다. UI는 그 불안을 키우지 않는다. 결과가 주의일 때도 공포 대신 다음 행동을 제안한다.

따뜻하고 신뢰감 있는 인상을 유지하되, 결과 화면에서는 명확성과 판단 근거를 우선한다. 앱이 말하는 느낌보다 곁에서 안내해주는 느낌.

---

## 2. Design Principles

| Principle | Description |
|---|---|
| **Warm but clear** | 따뜻한 색감을 유지하되, 결과 판단은 색+라벨+큰 제목으로 동시에 전달한다 |
| **Calm over alarm** | 위험 결과도 공포를 키우지 않는다. 판단 → 이유 → 다음 행동 순서로 안내한다 |
| **Functional first** | 홈 상단은 소개 배너보다 상태 정보 + 기능 유도가 빠르게 읽히는 구조 우선 |
| **Consistent rhythm** | spacing scale 내 값만 사용한다. 임의 px 값은 쓰지 않는다 |

---

## 3. Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4 (PostCSS), custom tokens via `@theme`
- **Icons**: lucide-react
- **Animation**: motion (Framer Motion)
- **Layout**: Mobile-first, `max-w-md` container, `pb-20` for bottom nav clearance

---

## 4. Color System

### Brand Colors

| Token (Tailwind class) | Hex | Usage |
|---|---|---|
| `bg-primary` / `text-primary` | `#F28C82` | Primary CTA, key emphasis, icons |
| `bg-primary-strong` | `#E06F64` | Active/hover state for primary |
| `bg-secondary` / `text-secondary` | `#9DB7A5` | Secondary category, soft support |
| `bg-secondary-strong` / `text-secondary-strong` | `#6E9E88` | Secondary 강조 텍스트, 진한 세이지 |
| `bg-accent` | `#FAEEE9` | Hero background, tinted surface |
| `bg-bg-canvas` | `#FCFBFA` | App background (outermost) |
| `bg-bg-surface` | `#FFFEFD` | Card, sheet, input surface |
| `border-border-subtle` | `#EEE8E4` | Dividers, card borders |
| `text-text-primary` | `#3E3A39` | Title, body copy |
| `text-text-secondary` | `#7B7672` | Secondary text, meta info |
| `text-text-tertiary` | `#A09A97` | Placeholder, helper |
| `text-text-disabled` | `#C4BEBC` | Disabled state |
| `bg-neutral-bg` / `text-neutral-fg` | `#F3F1F0` / `#7F7A77` | Unknown/unreadable state |

### Semantic State Colors (Result screens)

| State | Background class | Foreground class | When to use |
|---|---|---|---|
| Safe | `bg-success-bg` | `text-success-fg` | 임신 중 일반적으로 안전한 성분/제품 |
| Caution | `bg-caution-bg` | `text-caution-fg` | 주의가 필요하나 금지는 아닌 성분 |
| Danger | `bg-danger-bg` | `text-danger-fg` | 피함 권장 성분/제품 |
| Neutral | `bg-neutral-bg` | `text-neutral-fg` | 정보 부족, 판독 불가 |

### Surface Hierarchy

```
bg-bg-canvas      ← 앱 전체 배경
  └─ bg-bg-surface   ← 카드, 시트, 인풋 (기본 표면)
       └─ bg-accent   ← Hero 카드, tinted 강조 영역
```

Never use raw white (`#ffffff`) for surfaces. Always use the token.

---

## 5. Typography

### Font

```css
font-family: Pretendard, -apple-system, BlinkMacSystemFont, "SF Pro Display",
             "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
```

Load via: `@font-face` with Pretendard Variable or CDN (`cdn.jsdelivr.net/gh/orioncactus/pretendard`).

### Type Scale

| Role | Size | Line-height | Weight | Class |
|---|---:|---:|---:|---|
| `display.md` | 26px | 35px | 700 | `type-display-md` |
| `title.lg` | 22px | 30px | 600 | `type-title-lg` |
| `title.md` | 18px | 26px | 600 | `type-title-md` |
| `title.card` | 16px | 24px | 600 | `type-title-card` |
| `body.contents` | 16px | 26px | 500 | `type-body-contents` |
| `body.brief` | 14px | 21px | 400 | `type-body-brief` |
| `label.md` | 13px | 18px | 600 | `type-label-md` |
| `caption` | 12px | 17px | 500 | `type-caption` |

### Rules
- 홈 메인 CTA 문구: `type-display-md`
- 결과 상태 제목: `type-display-md`
- 페이지 타이틀 (h1): `type-title-lg`
- 섹션 제목: `type-title-md`
- 카드 제목: `type-title-card`
- 훑어보는 설명문 (카드 설명, 상태 요약): `type-body-brief`
- 읽어야 하는 본문 (결과 상세, 성분 설명): `type-body-contents`
- 메타 정보, 배지 라벨: `type-label-md` or `type-caption`

---

## 6. Spacing Scale

Only use values from this scale. No arbitrary px values.

| Token | Value | Tailwind |
|---|---:|---|
| `space.1` | 4px | `gap-1`, `p-1` |
| `space.2` | 8px | `gap-2`, `p-2` |
| `space.3` | 12px | `gap-3`, `p-3` |
| `space.4` | 16px | `gap-4`, `p-4` |
| `space.5` | 20px | `gap-5`, `p-5` |
| `space.6` | 24px | `gap-6`, `p-6` |
| `space.8` | 32px | `gap-8`, `p-8` |
| `space.10` | 40px | `gap-10`, `p-10` |

### Key Spacing Rules
- 카드 내부 기본 padding: `p-4` or `p-5`
- 카드 간 간격: `gap-4` ~ `gap-6`
- 섹션 간 간격: `py-6`
- 홈 인삿말 → info chip: `space-y-2`
- 홈 info chip → hero: `pt-4`
- 홈 hero 내부: `px-6 pt-6 pb-5`
- 홈 hero 라벨 → 헤드라인: `mt-1`
- 홈 hero 헤드라인 → 설명문: `mb-4`
- 홈 hero 설명문 → CTA: `mb-6`
- 홈 hero CTA → 검색: `mt-3`
- 라벨 → 헤드라인: `mb-1`
- 헤드라인 → 설명문: `mb-2`
- 설명문 → CTA: `mb-5`

---

## 7. Radius

| Usage | Value | Tailwind |
|---|---|---|
| Pills, micro badges | 8px | `rounded-lg` |
| Inputs, small buttons | 12px | `rounded-xl` |
| Standard buttons | 16px | `rounded-2xl` |
| Small cards | 20px | `rounded-[20px]` |
| Standard cards | 24px | `rounded-[24px]` |
| Hero / result summary card | 28px | `rounded-[28px]` |
| Modal shell | 32px | `rounded-[32px]` |

---

## 8. Shadow

| Usage | Value | Tailwind |
|---|---|---|
| Small elevation | `0 4px 12px rgba(62,58,57,0.04)` | `shadow-sm` (override in globals) |
| Standard cards | `0 6px 18px rgba(62,58,57,0.04)` | `shadow-md` |
| Shell, large surfaces | `0 10px 30px rgba(62,58,57,0.05)` | `shadow-lg` |
| Flat / pills | none | `shadow-none` |

---

## 9. Components

### Large Button (단독 CTA)
```tsx
// 단독으로 임팩트가 필요한 CTA — h-14, text-base, font-semibold, shadow-lg
<Button size="lg" className="w-full gap-2">
  <Scan className="w-5 h-5" />
  5초 안에 확인하기
</Button>
```

### Primary Button
```tsx
// Full-width CTA (결과 화면, 설정 저장 등 일반 CTA)
<button className="w-full h-12 bg-primary text-white rounded-2xl text-sm font-semibold shadow-md active:bg-primary-strong transition-colors">
  저장하기
</button>

// Icon + text variant
<button className="w-full h-12 bg-primary text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2">
  <Scan className="w-5 h-5" />
  바코드 스캔하기
</button>
```

### Secondary Button
```tsx
<button className="h-10 px-4 bg-bg-surface border border-border-subtle rounded-2xl text-sm font-medium text-text-primary hover:bg-neutral-bg transition-colors">
  대체 제품 보기
</button>
```

### Card — Default
```tsx
<div className="bg-bg-surface border border-border-subtle rounded-[24px] shadow-[0_6px_18px_rgba(62,58,57,0.04)] p-5">
  {/* content */}
</div>
```

### Card — Tinted Hero (홈, 결과 요약)
```tsx
<div className="bg-accent rounded-[28px] p-6 relative overflow-hidden">
  {/* content */}
</div>
```

### Card — Dense (결과 상세, 성분 리스트)
```tsx
<div className="bg-bg-surface border border-border-subtle rounded-[24px] p-4 space-y-3">
  {/* tight information blocks */}
</div>
```

### State Badge
```tsx
// success / caution / danger / neutral
<span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold bg-success-bg text-success-fg">
  안전
</span>
<span className="... bg-caution-bg text-caution-fg">주의</span>
<span className="... bg-danger-bg text-danger-fg">피함 권장</span>
<span className="... bg-neutral-bg text-neutral-fg">정보 부족</span>
```

### Info Chip (상태 정보 — 임신 주차, 남은 스캔)
```tsx
<button className="flex-1 flex items-center gap-3 bg-bg-surface border border-border-subtle rounded-xl px-3 py-3 hover:bg-neutral-bg transition-colors">
  <Icon className="w-4 h-4 text-primary shrink-0" />
  <div className="text-left min-w-0">
    <p className="text-xs text-text-secondary leading-none mb-1.5">라벨</p>
    <p className="text-base font-bold text-text-primary leading-none truncate">값</p>
  </div>
</button>
```

### Header
```tsx
<header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-bg-surface/80 backdrop-blur-md">
  <div className="flex h-14 items-center justify-between px-4">
    <span className="font-bold text-lg text-text-primary tracking-tight">마미스캔</span>
  </div>
</header>
```

### Bottom Navigation
```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-bg-surface/90 backdrop-blur-md">
  <div className="flex h-16 max-w-md mx-auto">
    {/* 4 tabs: 홈 / 스캔 / 히스토리 / 내 정보 */}
  </div>
</nav>
```

### Loading Spinner
```tsx
<div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
```

---

## 10. Page Layout Template

```tsx
// Every page
<div className="flex flex-col flex-1 bg-bg-canvas pb-20">
  <Header />
  
  {/* page content */}
  <main className="flex-1 px-4 space-y-4">
    {/* ... */}
  </main>
  
  <BottomNav />
</div>
```

---

## 11. Page-level Surface Rules

| Screen | Hero/Top | Cards | Bottom Action |
|---|---|---|---|
| Home | `surface.tinted` (bg-accent) | `surface.default` | — |
| Scan | minimal, camera-focused | — | primary CTA |
| Result | `surface.tinted` summary | `surface.dense` details | secondary actions |
| History | — | `surface.default` list | — |
| Settings | — | `surface.default` | primary save CTA |

### Home Page Layout (확정 구조)

```
Header (sticky)
Top Utility Area (pt-6, space-y-2)
  - 로그인: 인삿말(text-lg font-semibold) + Info Chips (gap-2)
  - 비로그인: 로그인 유도 배너
Hero Section (pt-4 pb-4)
  - bg-accent rounded-[28px], px-6 pt-6 pb-5
  - 라벨 → 헤드라인(mt-1 mb-4) → 설명(mb-6) → CTA → 검색(mt-3)
Recent Scans (로그인 + 히스토리 있을 때, pt-6 pb-6)
  - bg-bg-surface border rounded-[24px], divider rows
Feature Section (비로그인 또는 히스토리 없을 때, pt-4 pb-6 space-y-2)
  - 섹션 타이틀: text-lg font-semibold (인삿말과 동일 레벨)
  - 단일 카드 bg-bg-surface border rounded-[24px] + divider rows
  - 아이콘 bg: 명시적 hex값 사용 (동적 Tailwind 클래스 금지)
  - 카드 타이틀: `text-base font-semibold`, 설명 본문: `type-body-brief text-text-secondary`
Trust Section (py-6 bg-neutral-bg)
  - 섹션 구분: bg-neutral-bg로 배경색 차별화, 별도 divider 없음
  - text-center, MFDS/FDA/CDC 로고 grayscale opacity-50
Footer
BottomNav (fixed)
```

---

## 12. UX Writing Rules

Tone: 당근식 — 가깝고 따뜻하게, 쉽고 편하게, 생활 밀착형

### Do
- `한 번 더 확인해 주세요`
- `이렇게 해보세요`
- `불안하다면 담당 의료진과 함께 확인해 보세요`
- `대체 제품을 먼저 검토해보는 편이 좋아요`
- 결과: `주의해서 확인해 주세요` (주의 상태)

### Don't
- `위험합니다` — 단정형 금지
- `절대 사용하면 안 됩니다`
- `문제가 생길 수 있습니다`
- `반드시 병원에 가세요`

### Home Top Copy Pattern
```
[짧은 라벨]       → "지금 먹어도 되는지"
[행동 헤드라인]   → "바로 확인해보세요"
[1문장 설명]      → "임산부 기준 성분 분석을 5초면 할 수 있어요."
[Primary CTA]     → "바코드 스캔하기"
```

---

## 13. Anti-patterns (하지 말 것)

- raw `#ffffff` 배경 직접 사용 → `bg-bg-surface` 사용
- spacing scale 외 임의 px 값 (e.g. `mt-[13px]`)
- 결과 상태를 색상 하나로만 전달 → 반드시 색 + 라벨 + 텍스트 조합
- 홈 상단에 긴 브랜드 슬로건 배너 → 상태 정보 + 기능 유도 구조 우선
- Primary CTA를 같은 화면에 2개 이상 사용
- `text-red-500` 같은 기본 Tailwind 시멘틱 색상 → `text-danger-fg` 등 토큰 사용
- 동적 Tailwind 클래스 interpolation (e.g. `` `bg-${color}/10` ``) → Tailwind JIT purge로 렌더링 안 됨. 명시적 클래스 문자열 사용
- 섹션 구분에 `h-px` 또는 `h-2/h-3 bg-neutral-bg` 띠 → 배경색 토큰(`bg-neutral-bg`)으로 섹션 자체를 구분

---

## 14. Globals CSS Token Reference

Defined in `src/app/globals.css` via `@theme`:

```css
--color-primary: #F28C82;
--color-primary-strong: #E06F64;
--color-secondary: #9DB7A5;
--color-accent: #FAEEE9;
--color-bg-canvas: #FCFBFA;
--color-bg-surface: #FFFEFD;
--color-border-subtle: #EEE8E4;
--color-text-primary: #3E3A39;
--color-text-secondary: #7B7672;
--color-text-tertiary: #A09A97;
--color-text-disabled: #C4BEBC;
--color-neutral-bg: #F3F1F0;
--color-neutral-fg: #7F7A77;
--color-success-bg: #EAF4EC;
--color-success-fg: #5B8661;
--color-caution-bg: #FFF5E4;
--color-caution-fg: #A8781F;
--color-danger-bg: #FCE8E6;
--color-danger-fg: #B85750;
```
