'use client';

// 비교용 페이지 — Cal.com 스타일 적용
// 변경점: 색상 100% 유지, negative letter-spacing 강화, shadow 선명화, spacing 확대, radius 소폭 축소

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AlertTriangle, CheckCircle, Info, ChevronRight, ShoppingBag, Lock, Loader2, Flag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { compressThumbnail } from '@/lib/compressImage';
import { pendingAnalyze } from '@/lib/pendingAnalyze';
import { Suspense } from 'react';
import LoadingTips from '@/components/LoadingTips';

function splitHeadline(headline: string): React.ReactNode {
  const match = headline.match(/^(.+?(?:로 인해|으로 인해|므로|어서|아서|이라서|해서|니까|으니까|아|어))\s+(.+)$/);
  if (match) return <>{match[1]}<br />{match[2]}</>;
  return headline;
}

function cleanBrand(brand: string): string {
  return brand
    .replace(/^주식회사\s+/i, '')
    .replace(/\s+주식회사$/i, '')
    .replace(/^\(주\)\s*/i, '')
    .replace(/\s*\(주\)$/i, '')
    .replace(/^㈜\s*/, '')
    .replace(/\s*㈜$/, '')
    .replace(/^유한회사\s+/i, '')
    .replace(/\s+유한회사$/i, '')
    .trim();
}

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const barcode = searchParams.get('barcode') || null;

  const [authUser, setAuthUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [scanHistoryId, setScanHistoryId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showWeekModal, setShowWeekModal] = useState(false);
  const [inputWeeks, setInputWeeks] = useState('12');
  const [isSubmittingWeeks, setIsSubmittingWeeks] = useState(false);
  const weekPickerRef = useRef<HTMLDivElement>(null);
  const hasAnalyzedRef = useRef(false);
  const ITEM_H = 56;

  const [scanImage, setScanImage] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const hasFetchedImageRef = useRef(false);

  useEffect(() => {
    if (hasFetchedImageRef.current) return;
    hasFetchedImageRef.current = true;
    const img = sessionStorage.getItem('scanImage');
    if (img) {
      sessionStorage.removeItem('scanImage');
      setScanImage(img);
    }
    setImageReady(true);
  }, []);

  useEffect(() => {
    if (showWeekModal) {
      setTimeout(() => {
        if (weekPickerRef.current) {
          weekPickerRef.current.scrollTop = (parseInt(inputWeeks) - 1) * ITEM_H;
        }
      }, 50);
    }
  }, [showWeekModal]);

  useEffect(() => {
    if (!imageReady) return;
    if (hasAnalyzedRef.current) return;
    hasAnalyzedRef.current = true;

    const supabase = createClient();

    const authPromise = supabase.auth.getUser().then(async ({ data: { user } }) => {
      setAuthUser(user);
      if (user) {
        const now = new Date().toISOString();
        const [{ data: profData }, { data: activeSub }] = await Promise.all([
          supabase.from('users').select('id, pregnancy_weeks').eq('id', user.id).single(),
          supabase.from('user_entitlements').select('id').eq('user_id', user.id).eq('type', 'monthly').eq('status', 'active').gt('expires_at', now).maybeSingle(),
        ]);
        setUserProfile({ ...profData, isActive: !!activeSub });
        return { user, prof: profData };
      }
      return { user: null, prof: null };
    });

    const existing = sessionStorage.getItem('resultData');
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        sessionStorage.removeItem('resultData');
        setResult(parsed);

        if (parsed.userImageUrl && !parsed.userImageUrl.startsWith('http')) {
          const supabaseClient = createClient();
          supabaseClient.storage
            .from('scan-images')
            .createSignedUrl(parsed.userImageUrl, 3600)
            .then(({ data }) => {
              if (data?.signedUrl) {
                setSavedImageUrl(data.signedUrl);
                setResult((r: any) => r ? { ...r, userImageUrl: data.signedUrl } : r);
              }
            });
        } else if (parsed.userImageUrl) {
          setSavedImageUrl(parsed.userImageUrl);
        }
      } catch { }
      authPromise.finally(() => setIsLoading(false));
      return;
    }

    if (!barcode && !scanImage) {
      setError('스캔 데이터가 없어요. 다시 촬영해 주세요.');
      setIsLoading(false);
      return;
    }

    const hasPrefetch = barcode && pendingAnalyze.barcode === barcode && pendingAnalyze.promise;
    const analyzePromise = hasPrefetch
      ? pendingAnalyze.promise!.finally(() => { pendingAnalyze.promise = null; pendingAnalyze.barcode = null; })
      : fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode: barcode || null,
            imageBase64: scanImage || null,
          }),
        });

    (async () => {
      try {
        const res = await analyzePromise;
        if (!res.ok) throw new Error('Server error');
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Analysis failed');

        const parsedResult = data.result;
        setResult(parsedResult);
        setIsLoading(false);

        authPromise.then(async ({ user, prof }) => {
          if (data.fromCache && data.needsWeekAnalysis && data.productName) {
            fetch('/api/analyze/week', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productName: data.productName,
                pregnancyWeeks: prof?.pregnancy_weeks,
              }),
            })
              .then(r => r.json())
              .then(weekData => {
                if (weekData.weekAnalysis) {
                  setResult((prev: any) => prev ? { ...prev, weekAnalysis: weekData.weekAnalysis } : prev);
                }
              })
              .catch(() => {});
            return;
          }

          if (!parsedResult.status?.startsWith('error_')) {
            if (!user) {
              const current = parseInt(localStorage.getItem('mamiscan_guest_scans') || '0', 10);
              localStorage.setItem('mamiscan_guest_scans', String(current + 1));
            } else {
              const thumbnail = scanImage
                ? await compressThumbnail(scanImage).catch(() => null)
                : null;

              const resultToSave = barcode
                ? { ...parsedResult, detectedBarcode: barcode }
                : parsedResult;

              const saveRes = await fetch('/api/scan/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productName: (parsedResult.brand?.trim() ? `${cleanBrand(parsedResult.brand)} ${parsedResult.productName}` : parsedResult.productName) || '알 수 없는 제품',
                  status: parsedResult.status,
                  resultJson: resultToSave,
                  imageBase64: thumbnail,
                }),
              }).catch(() => null);

              if (saveRes?.status === 403) {
                router.replace('/pricing');
                return;
              }

              if (saveRes?.ok) {
                const saveData = await saveRes.json().catch(() => null);
                if (saveData?.imagePath) {
                  setSavedImageUrl(saveData.imagePath);
                  setResult((r: any) => r ? { ...r, userImageUrl: saveData.imagePath } : r);
                }
                if (saveData?.historyId) {
                  setScanHistoryId(saveData.historyId);
                }
              }
            }
          }
        }).catch(() => {});
      } catch {
        setError('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
        setIsLoading(false);
      }
    })();
  }, [barcode, scanImage, imageReady]);

  const displayImageSrc = scanImage ?? result?.userImageUrl ?? null;
  const pregnancyWeeks = userProfile?.pregnancy_weeks;
  const hasWeekInfo = pregnancyWeeks !== undefined && pregnancyWeeks !== null;

  const handleWeekSubmit = async () => {
    const weeks = parseInt(inputWeeks, 10);
    if (isNaN(weeks) || weeks < 1 || weeks > 42) return;
    setIsSubmittingWeeks(true);
    try {
      const res = await fetch('/api/user/pregnancy-weeks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeks }),
      });
      const data = await res.json();
      if (data.success) {
        setUserProfile((prev: any) => ({ ...prev, pregnancy_weeks: weeks }));
        setShowWeekModal(false);
        setToastMessage('임신 주차가 설정되었습니다. 다시 스캔하시면 맞춤 결과를 볼 수 있어요!');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } finally {
      setIsSubmittingWeeks(false);
    }
  };

  const handleReportSubmit = async () => {
    if (!reportText.trim()) return;
    setIsSubmittingReport(true);
    try {
      const res = await fetch('/api/support/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'error_report',
          category: 'scan_error',
          body: reportText.trim(),
          scanHistoryId: scanHistoryId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error('submit_failed');
      setShowReportModal(false);
      setReportText('');
      setToastMessage('소중한 의견이 정상적으로 접수되었습니다. 감사합니다!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage('오류 제보 접수에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas items-center justify-center min-h-screen px-6">
        <div className="flex items-center gap-1.5 mb-8">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-text-tertiary animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <LoadingTips />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas items-center justify-center min-h-screen px-6">
        <div className="bg-danger-bg p-4 rounded-full mb-6"><AlertTriangle className="w-12 h-12 text-danger-fg" /></div>
        <h2 className="text-xl font-bold text-text-primary mb-2 text-center">분석에 실패했어요</h2>
        <p className="text-text-secondary font-medium mb-8 text-center">{error}</p>
        <div className="flex flex-col w-full max-w-xs space-y-3">
          <button
            onClick={() => router.back()}
            className="w-full h-12 bg-primary text-white rounded-xl text-sm font-medium flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(242,140,130,0.3)] hover:bg-primary-strong transition-colors"
          >다시 촬영하기</button>
          <button
            onClick={() => router.push('/home')}
            className="w-full h-12 bg-bg-surface border border-border-subtle text-text-primary rounded-xl text-sm font-medium flex items-center justify-center hover:bg-neutral-bg transition-colors"
          >홈으로 돌아가기</button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const isError = result.status.startsWith('error_');
  const displayProductName = result.brand?.trim()
    ? `${cleanBrand(result.brand)} ${result.productName}`
    : result.productName;

  if (isError && (result.status === 'error_image_quality' || !(result.productName && result.productName.trim()))) {
    const errorConfig: Record<string, { head: string; body: string; primaryLabel: string; primaryAction: () => void; secondaryLabel?: string; secondaryAction?: () => void }> = {
      error_future_category: {
        head: '아직 이 제품은 확인하기 어려워요',
        body: '화장품은 곧 정식 지원할게요!',
        primaryLabel: '다른 제품 스캔하기',
        primaryAction: () => router.push('/scan'),
        secondaryLabel: '홈으로',
        secondaryAction: () => router.push('/home'),
      },
      error_food_estimate: {
        head: '음식 사진도 분석할 수 있어요',
        body: '성분 표기가 없어 AI 추정 기반이에요. 더 정확한 분석을 위해 포장지가 보이도록 다시 찍어주세요.',
        primaryLabel: '다시 촬영하기',
        primaryAction: () => router.back(),
        secondaryLabel: '홈으로',
        secondaryAction: () => router.push('/home'),
      },
      error_unsupported_category: {
        head: '이 종류는 마미스캔이 판정하기 어려워요',
        body: '처방약은 성분 판정 기준이 달라 지원하지 않아요. 담당 의사 또는 약사에게 문의해 주세요.',
        primaryLabel: '다른 제품 스캔하기',
        primaryAction: () => router.push('/scan'),
        secondaryLabel: '홈으로',
        secondaryAction: () => router.push('/home'),
      },
      error_image_quality: {
        head: '제품이 잘 안 보여요',
        body: '제품 하나만 가까이서, 밝은 곳에서 다시 찍어주세요.',
        primaryLabel: '다시 촬영하기',
        primaryAction: () => router.back(),
        secondaryLabel: '홈으로',
        secondaryAction: () => router.push('/home'),
      },
      error_db_mismatch: {
        head: '아직 데이터베이스에 없는 제품이에요',
        body: '바코드는 읽었는데 아직 이 제품 정보가 없어요. 제품 이미지를 다시 찍으면 분석할 수 있어요.',
        primaryLabel: '제품 이미지로 다시 스캔',
        primaryAction: () => router.push('/scan'),
        secondaryLabel: '홈으로',
        secondaryAction: () => router.push('/home'),
      },
    };
    const cfg = errorConfig[result.status] ?? {
      head: '분석에 실패했어요',
      body: '다시 시도해 주세요.',
      primaryLabel: '다시 촬영하기',
      primaryAction: () => router.back(),
    };
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas items-center justify-center min-h-screen px-6">
        <div className="bg-neutral-bg p-4 rounded-full mb-6"><Info className="w-12 h-12 text-text-secondary" /></div>
        <h2 className="text-xl font-bold text-text-primary mb-2 text-center">{cfg.head}</h2>
        <p className="text-text-secondary font-medium mb-8 text-center leading-relaxed">{cfg.body}</p>
        <div className="flex flex-col w-full max-w-xs space-y-3">
          <button
            onClick={cfg.primaryAction}
            className="w-full h-12 bg-primary text-white rounded-xl text-sm font-medium flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(242,140,130,0.3)] hover:bg-primary-strong transition-colors"
          >{cfg.primaryLabel}</button>
          {cfg.secondaryLabel && (
            <button
              onClick={cfg.secondaryAction}
              className="w-full h-12 bg-bg-surface border border-border-subtle text-text-primary rounded-xl text-sm font-medium flex items-center justify-center hover:bg-neutral-bg transition-colors"
            >{cfg.secondaryLabel}</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-24">
      {/* ── Header: Cal.com 방식 — bg-canvas 기반 ── */}
      <header className="safe-top sticky top-0 z-50 flex items-center justify-between h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-text-primary"><ArrowLeft className="w-6 h-6" /></button>
          <span className="font-bold ml-2 text-text-primary">분석 결과</span>
        </div>
        <button onClick={() => setShowReportModal(true)} className="px-2 py-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          오류 제보
        </button>
      </header>

      <main className="px-4 py-5 space-y-5">
        {isError && (
          <div className="bg-neutral-bg border border-border-subtle rounded-xl p-4 flex items-start space-x-3 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]">
            <Info className="w-5 h-5 text-text-secondary shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-1">
                {result.status === 'error_food_estimate' ? '성분 표기가 없어 AI 추정 기반이에요' :
                  result.status === 'error_future_category' ? '아직 이 카테고리는 준비 중이에요' :
                  result.status === 'error_unsupported_category' ? '이 종류는 마미스캔이 판정하기 어려워요' :
                  result.status === 'error_image_quality' ? '사진이 선명하지 않아 정확하지 않을 수 있어요' :
                  '데이터베이스에 없는 제품이에요'}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                {result.status === 'error_food_estimate' ? '아래 정보는 참고용으로만 활용해주세요. 더 정확한 분석은 포장지가 보이도록 다시 찍어주세요.' :
                  result.status === 'error_future_category' ? '아래 정보는 참고용이에요. 곧 화장품도 정식 지원할게요!' :
                  result.status === 'error_unsupported_category' ? '처방약은 성분 기준이 달라요. 담당 의료진에게 문의하세요.' :
                  result.status === 'error_image_quality' ? '제품 하나만 가까이서, 밝은 곳에서 다시 찍어주시면 더 정확해요.' :
                  '이미지 기반으로 분석한 참고용 정보예요. 정확한 확인은 다시 스캔해 주세요.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Result Summary Card: Cal.com 방식 — 선명 shadow, 토큰 색상 유지 ── */}
        <div className={`rounded-[28px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] ${
          isError ? 'bg-neutral-bg border border-border-subtle' :
          result.status === 'success' ? 'bg-success-bg' :
          result.status === 'danger' ? 'bg-danger-bg' : 'bg-caution-bg'
        }`}>
          <div className="p-7 flex flex-col">
            {/* 배지 + 헤드라인 + 제품명 */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center flex-wrap gap-2">
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white ${
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
                  <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${isError ? 'bg-neutral-bg text-text-secondary' : 'bg-white/60 text-primary'}`}>
                    임신 {pregnancyWeeks}주차 맞춤
                  </div>
                )}
              </div>
              {!displayImageSrc && result.imageUrl && (
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/40 border border-white/40 shrink-0 ml-3">
                  <img src={result.imageUrl} alt={result.productName} className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
            <h1 className={`text-[24px] font-bold mb-1 break-keep ${
              isError ? 'text-text-primary' :
              result.status === 'success' ? 'text-success-fg' :
              result.status === 'danger' ? 'text-danger-fg' : 'text-caution-fg'
            }`}>{splitHeadline(result.headline)}</h1>
            <p className={`text-sm font-medium ${displayImageSrc ? 'mb-3' : 'mb-4'} ${
              isError ? 'text-text-secondary' :
              result.status === 'success' ? 'text-success-fg/70' :
              result.status === 'danger' ? 'text-danger-fg/70' : 'text-caution-fg/70'
            }`}>{displayProductName}</p>

            {displayImageSrc && (
              <div className="-mx-7 mb-4 overflow-hidden">
                <img
                  src={displayImageSrc}
                  alt="촬영 이미지"
                  className="w-full aspect-square object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                />
              </div>
            )}

            <div className="space-y-2.5">
              {result.description.split('\n').filter(Boolean).map((line: string, i: number) => (
                <p key={i} className="text-sm text-text-primary break-keep">{line}</p>
              ))}
            </div>

            {hasWeekInfo && result.weekAnalysis && (
              <div className="mt-4 pt-4 border-t border-black/10 space-y-1.5">
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm">✨</span>
                  <p className="text-xs font-medium text-primary">임신 {pregnancyWeeks}주차 맞춤 조언</p>
                </div>
                <p className="text-sm text-text-primary break-keep">{result.weekAnalysis}</p>
              </div>
            )}

            {!hasWeekInfo && authUser && (
              <button
                onClick={() => setShowWeekModal(true)}
                className="mt-4 w-full flex items-center justify-between px-4 py-3.5 bg-white/75 hover:bg-white/95 border border-white/80 rounded-xl transition-all shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-lg">✨</div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-text-primary">주차별 맞춤 분석 받기</p>
                    <p className="text-xs text-text-secondary mt-0.5">임신 주차를 입력하면 딱 맞는 조언을 드려요</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-primary shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* ── Locked / Detail ── */}
        <div className="relative">
          {!authUser && (
            <div className="absolute inset-0 z-20 flex flex-col items-center pt-12 pb-8 bg-gradient-to-b from-transparent via-bg-canvas/60 to-bg-canvas backdrop-blur-[2px]">
              <div className="bg-white/95 p-6 rounded-[28px] shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] border border-border-subtle flex flex-col items-center max-w-[280px] text-center sticky top-32">
                <div className="bg-primary/10 p-3 rounded-full mb-3"><Lock className="w-6 h-6 text-primary" /></div>
                <h3 className="font-bold text-text-primary mb-2">회원 전용 기능</h3>
                <p className="text-sm text-text-secondary mb-4 leading-relaxed">상세 성분 분석부터 주차별 맞춤 가이드까지 모두 확인해보세요.</p>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full h-10 bg-primary text-white rounded-xl text-sm font-medium flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(242,140,130,0.3)] hover:bg-primary-strong transition-colors"
                >로그인 / 회원가입 하기</button>
              </div>
            </div>
          )}

          <div className={!authUser ? 'opacity-30 pointer-events-none select-none overflow-hidden max-h-[400px]' : ''}>
            {/* ── Ingredients ── */}
            {!isError && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[18px] font-bold text-text-primary">어떤 성분/특징 때문인가요?</h2>
                  {hasWeekInfo && <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-md font-bold">{pregnancyWeeks}주차 기준</span>}
                </div>
                <div className="space-y-3">
                  {!authUser ? (
                    <>
                      {['주의 성분 A', '위험 성분 B'].map((name, i) => (
                        <div key={name} className="bg-bg-surface border border-border-subtle rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-text-primary">{name}</span>
                              <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${i === 0 ? 'bg-caution-fg' : 'bg-danger-fg'}`}>
                                {i === 0 ? '주의' : '위험'}
                              </div>
                            </div>
                            <div className="bg-neutral-bg rounded-lg p-3 mt-3">
                              <p className="text-sm text-text-secondary leading-relaxed">임산부에게 영향을 줄 수 있는 성분으로 섭취량 조절이 필요합니다.</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : result.ingredients?.filter((i: any) => i.status !== 'success').length > 0 ? (
                    result.ingredients.filter((i: any) => i.status !== 'success').map((ingredient: any, idx: number) => (
                      <div key={idx} className="bg-bg-surface border border-border-subtle rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-text-primary">{ingredient.name}</span>
                            <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${ingredient.status === 'caution' ? 'bg-caution-fg' : 'bg-danger-fg'}`}>
                              {ingredient.status === 'caution' ? '주의' : '위험'}
                            </div>
                          </div>
                          <div className="bg-neutral-bg rounded-lg p-3 mt-3">
                            <p className="text-sm text-text-secondary leading-relaxed break-keep">{ingredient.reason}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-bg-surface border border-border-subtle rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
                      <div className="p-6 text-center">
                        <CheckCircle className="w-8 h-8 text-success-fg mx-auto mb-3" />
                        <p className="text-text-primary font-bold">주의해야 할 성분이나 특징이 발견되지 않았어요.</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Alternatives ── */}
            <section className="space-y-3 mt-6">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[18px] font-bold text-text-primary">안전한 대체 제품</h2>
                <span className="text-xs text-text-secondary bg-neutral-bg px-2 py-1 rounded-md font-bold">광고 아님</span>
              </div>
              <p className="text-sm text-text-secondary px-1">주의할 특징이 없는 비슷한 제품을 찾아봤어요.</p>
              <div className="relative">
                <div className={!authUser ? 'opacity-30 blur-[3px] pointer-events-none select-none grid gap-3' : 'grid gap-3'}>
                  {result.alternatives?.length > 0 ? result.alternatives.map((alt: any, idx: number) => (
                    <div key={idx} className="bg-bg-surface border border-border-subtle rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
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
                  )) : (
                    <div className="bg-bg-surface border border-border-subtle rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
                      <div className="p-6 text-center">
                        <p className="text-text-secondary text-sm">아직 검증된 대체 제품 데이터를 모으고 있어요.</p>
                        <p className="text-text-secondary text-xs mt-1">업데이트되면 여기서 바로 확인할 수 있어요!</p>
                      </div>
                    </div>
                  )}
                </div>
                {!authUser && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
                    <div className="bg-primary/10 p-3 rounded-full mb-3"><Lock className="w-6 h-6 text-primary" /></div>
                    <h3 className="font-bold text-text-primary mb-2">회원 전용 기능</h3>
                    <p className="text-sm text-text-secondary mb-4">로그인하면 안전한 대체 제품을 확인할 수 있어요.</p>
                    <button
                      onClick={() => router.push('/login')}
                      className="h-10 px-5 bg-primary text-white rounded-xl text-sm font-medium shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(242,140,130,0.3)] hover:bg-primary-strong transition-colors"
                    >로그인 / 회원가입</button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* ── Disclaimer ── */}
        <section className="pt-3 pb-4">
          <div className="bg-neutral-bg border border-border-subtle rounded-xl p-4 flex items-start space-x-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <Info className="w-5 h-5 text-text-secondary shrink-0 mt-0.5" />
            <p className="text-[12px] leading-[1.7] text-text-secondary">
              본 서비스의 분석 결과는 식약처 및 관련 기관의 가이드라인을 바탕으로 제공되나, <strong>의료적 진단이나 조언을 대체할 수 없습니다.</strong> 불안하다면 담당 의료진의 안내를 우선해 주세요.
            </p>
          </div>
        </section>
      </main>

      {/* ── Bottom Action Panel ── */}
      <div className="safe-bottom fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 px-4 pt-4 bg-bg-surface border-t border-border-subtle z-50">
        <div className="flex space-x-3">
          <button
            onClick={() => router.push('/home')}
            className="flex-1 h-11 bg-bg-surface border border-border-subtle text-text-primary rounded-xl text-sm font-medium flex items-center justify-center hover:bg-neutral-bg transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >홈으로</button>
          <button
            onClick={() => router.push('/scan')}
            className="flex-1 h-11 bg-primary text-white rounded-xl text-sm font-medium flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(242,140,130,0.3)] hover:bg-primary-strong transition-colors"
          >다른 제품 스캔</button>
        </div>
      </div>

      {/* ── Report Modal ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-canvas w-full max-w-sm rounded-[28px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] border border-border-subtle relative">
            <button onClick={() => setShowReportModal(false)} className="absolute top-4 right-4 p-1 text-text-secondary hover:text-text-primary">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center">
              <Flag className="w-5 h-5 mr-2 text-primary" />정보 오류 제보
            </h3>
            <p className="text-sm text-text-secondary mb-4 leading-relaxed">AI가 분석한 결과가 실제 제품과 다르다면 알려주세요.</p>

            <div className="mb-4 rounded-xl bg-neutral-bg border border-border-subtle p-3 flex items-center gap-3">
              {(displayImageSrc || savedImageUrl) ? (
                <img
                  src={displayImageSrc ?? savedImageUrl!}
                  alt="촬영 이미지"
                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-xs text-text-tertiary mb-0.5">연결된 분석 결과</p>
                <p className="text-sm font-bold text-text-primary truncate">
                  {result.productName || '알 수 없는 제품'}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">이 분석에 대한 오류를 제보합니다</p>
              </div>
            </div>

            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="예: 이 제품은 떡볶이 스낵이 아니라 감자칩입니다."
              className="w-full h-24 px-3 py-2 bg-bg-surface border border-border-subtle rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none mb-4"
            />
            <button
              onClick={handleReportSubmit}
              disabled={isSubmittingReport}
              className="w-full h-11 bg-primary text-white rounded-xl text-sm font-medium flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(242,140,130,0.3)] hover:bg-primary-strong transition-colors disabled:opacity-50"
            >
              {isSubmittingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : '제보하기'}
            </button>
          </div>
        </div>
      )}

      {/* ── Week Modal ── */}
      {showWeekModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowWeekModal(false)}>
          <div className="bg-bg-canvas w-full rounded-t-[28px] shadow-[0_-2px_8px_rgba(0,0,0,0.08),0_-8px_24px_rgba(0,0,0,0.06)] border-t border-border-subtle" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-border-subtle rounded-full" /></div>
            <div className="px-6 pt-3 pb-2 text-center">
              <h3 className="text-lg font-bold text-text-primary">몇 주차이세요?</h3>
              <p className="text-xs text-text-secondary mt-1">주차에 맞는 맞춤 분석을 드릴게요</p>
            </div>
            <div className="relative mx-auto w-48 h-[168px] overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-bg-canvas to-transparent pointer-events-none z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-bg-canvas to-transparent pointer-events-none z-10" />
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-14 border-y-2 border-primary/30 bg-primary/5 pointer-events-none z-10 rounded-xl" />
              <div
                ref={weekPickerRef}
                onScroll={() => {
                  if (weekPickerRef.current) {
                    const idx = Math.round(weekPickerRef.current.scrollTop / ITEM_H);
                    setInputWeeks(String(Math.min(42, Math.max(1, idx + 1))));
                  }
                }}
                className="h-full overflow-y-scroll"
                style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', paddingTop: 56, paddingBottom: 56 }}
              >
                {Array.from({ length: 42 }, (_, i) => i + 1).map((w) => (
                  <div
                    key={w}
                    style={{ scrollSnapAlign: 'center', height: ITEM_H }}
                    className={`flex items-center justify-center text-2xl font-bold transition-colors ${parseInt(inputWeeks) === w ? 'text-primary' : 'text-text-secondary/40'}`}
                  >
                    {w}주차
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-8 pt-4">
              <button
                onClick={handleWeekSubmit}
                disabled={isSubmittingWeeks}
                className="w-full h-12 bg-primary text-white rounded-xl text-base font-medium flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(242,140,130,0.3)] hover:bg-primary-strong transition-colors disabled:opacity-50"
              >
                {isSubmittingWeeks ? <Loader2 className="w-5 h-5 animate-spin" /> : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center px-4 z-[70]">
          <div className="bg-gray-800/90 text-white px-4 py-3 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md text-sm font-bold flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-success-fg" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultPageCal() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-bg-canvas">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResultContent />
    </Suspense>
  );
}
