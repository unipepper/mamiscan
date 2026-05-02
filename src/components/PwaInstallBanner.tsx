'use client';

import { useEffect, useState } from 'react';
import { X, Share, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DAYS = 7;

type Platform = 'android' | 'ios-safari' | 'ios-other' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const isIOS = /iP(hone|ad|od)/.test(ua);
  const isAndroid = /Android/.test(ua);
  if (isIOS) {
    // CriOS=Chrome, FxiOS=Firefox, OPiOS=Opera — 이들은 홈 화면 추가 불가
    const isIOSOther = /CriOS|FxiOS|OPiOS/.test(ua);
    return isIOSOther ? 'ios-other' : 'ios-safari';
  }
  if (isAndroid) return 'android';
  // 데스크탑 Chrome/Edge도 beforeinstallprompt 지원
  return 'android';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone === true)
  );
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ms = parseInt(raw, 10);
    return Date.now() - ms < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function saveDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

// iOS Safari — 홈 화면 추가 안내 바텀시트
function IosSafariBanner({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(62,58,57,0.4)' }}>
      <div
        className="w-full max-w-md bg-bg-surface rounded-t-[32px] px-5 pt-5 pb-8 shadow-lg"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}
      >
        {/* 핸들 */}
        <div className="w-10 h-1 rounded-full bg-border-subtle mx-auto mb-5" />

        {/* 앱 아이콘 + 제목 */}
        <div className="flex items-center gap-3 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="마미스캔" className="w-12 h-12 rounded-[14px] shrink-0" />
          <div>
            <p className="type-title-card text-text-primary">마미스캔을 앱처럼 사용해보세요</p>
            <p className="type-body-brief text-text-secondary mt-0.5">홈 화면에 추가하면 매번 검색하지 않아도 바로 열 수 있어요.</p>
          </div>
        </div>

        {/* 안내 스텝 */}
        <div className="bg-neutral-bg rounded-[20px] p-4 space-y-3 mb-5">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-bg-surface border border-border-subtle flex items-center justify-center shrink-0">
              <Share className="w-3.5 h-3.5 text-text-secondary" />
            </span>
            <p className="type-body-brief text-text-primary">Safari 하단 공유 버튼을 누른 뒤</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-bg-surface border border-border-subtle flex items-center justify-center shrink-0">
              <Plus className="w-3.5 h-3.5 text-text-secondary" />
            </span>
            <p className="type-body-brief text-text-primary"><strong>"홈 화면에 추가"</strong>를 선택해주세요.</p>
          </div>
        </div>

        <Button variant="secondary" size="default" className="w-full" onClick={onClose}>
          나중에 할게요
        </Button>
      </div>
    </div>
  );
}

// iOS Chrome/기타 — Safari로 열기 유도 배너
function IosOtherBanner({ onClose }: { onClose: () => void }) {
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="w-full bg-bg-surface border-b border-border-subtle shadow-sm px-4 py-3">
      <div className="mx-auto max-w-md flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="마미스캔" className="w-10 h-10 rounded-[12px] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="type-title-card text-text-primary leading-snug">앱으로 저장하려면 Safari를 이용해주세요</p>
          <p className="type-caption text-text-secondary mt-0.5">iOS Chrome에서는 홈 화면 추가가 지원되지 않아요.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={currentUrl}
            // x-web-search scheme으로 Safari 강제 오픈은 불가 — 복사 유도가 현실적
            onClick={(e) => {
              e.preventDefault();
              navigator.clipboard?.writeText(currentUrl).catch(() => {});
              alert('주소가 복사됐어요. Safari에 붙여넣기 해주세요.');
            }}
            className="inline-flex items-center gap-1 h-9 px-3 bg-primary text-white rounded-xl text-xs font-medium shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            주소 복사
          </a>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-neutral-bg transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4 text-text-tertiary" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Android/Chrome 상단 배너
function AndroidBanner({
  onInstall,
  onClose,
}: {
  onInstall: () => void;
  onClose: () => void;
}) {
  return (
    <div className="w-full bg-bg-surface border-b border-border-subtle shadow-sm px-4 py-3">
      <div className="mx-auto max-w-md flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="마미스캔" className="w-10 h-10 rounded-[12px] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="type-title-card text-text-primary leading-snug">마미스캔을 앱처럼 사용해보세요</p>
          <p className="type-caption text-text-secondary mt-0.5 truncate">홈 화면에 추가하면 바로 열 수 있어요.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={onInstall}>
            앱 설치하기
          </Button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-neutral-bg transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4 text-text-tertiary" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PwaInstallBanner() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    const p = detectPlatform();
    setPlatform(p);

    if (p === 'ios-safari' || p === 'ios-other') {
      setVisible(true);
      return;
    }

    // Android/Desktop Chrome: beforeinstallprompt 대기
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 이미 설치된 경우 숨김
    window.addEventListener('appinstalled', () => setVisible(false));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleClose = () => {
    saveDismiss();
    setVisible(false);
  };

  if (!visible) return null;

  if (platform === 'ios-safari') {
    return <IosSafariBanner onClose={handleClose} />;
  }

  if (platform === 'ios-other') {
    return <IosOtherBanner onClose={handleClose} />;
  }

  return <AndroidBanner onInstall={handleInstall} onClose={handleClose} />;
}
