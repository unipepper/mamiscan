'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X, ScanLine, Image as ImageIcon, Info, Lock, RefreshCw, MoreVertical, ShieldCheck } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface UserProfile {
  isActive: boolean;
}

export default function ScanPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [remainingScans, setRemainingScans] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const isScanningRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [albumPermissionHint, setAlbumPermissionHint] = useState(false);
  const [showAlbumPermissionGuide, setShowAlbumPermissionGuide] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bottomControlsRef = useRef<HTMLDivElement>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [guestScansUsed, setGuestScansUsed] = useState(0);

  // 카메라 콜백은 [] deps useEffect 안에서 실행되므로 state 클로저가 stale해짐.
  // ref로 최신값을 항상 참조한다.
  const authUserRef = useRef<any>(null);
  const isActiveRef = useRef(false);
  const remainingScansRef = useRef(0);

  const GUEST_LIMIT = 3;
  const GUEST_KEY = 'mamiscan_guest_scans';

  useEffect(() => {
    const used = parseInt(localStorage.getItem(GUEST_KEY) || '0', 10);
    setGuestScansUsed(used);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setAuthUser(user);
      authUserRef.current = user;
      if (user) {
        const now = new Date().toISOString();
        const [{ data: scanRights }, { data: activeSub }] = await Promise.all([
          supabase.from('user_entitlements').select('scan_count').eq('user_id', user.id).in('type', ['scan5', 'trial', 'admin']).eq('status', 'active').gt('expires_at', now).gt('scan_count', 0),
          supabase.from('user_entitlements').select('id').eq('user_id', user.id).eq('type', 'monthly').eq('status', 'active').gt('expires_at', now).maybeSingle(),
        ]);
        const active = !!activeSub;
        const scans = scanRights?.reduce((s: number, c: any) => s + c.scan_count, 0) ?? 0;
        setUserProfile({ isActive: active });
        isActiveRef.current = active;
        setRemainingScans(scans);
        remainingScansRef.current = scans;
      }
    });
  }, []);

  const isActive = userProfile?.isActive ?? false;
  const guestRemaining = GUEST_LIMIT - guestScansUsed;
  const hasScans = authUser ? (isActive || remainingScans > 0) : guestRemaining > 0;

  const handleNoScans = () => {
    if (!authUser) {
      setToastMessage('무료 체험 3회를 모두 사용했어요. 로그인하고 계속 이용해보세요!');
      setTimeout(() => { setToastMessage(null); router.push('/login'); }, 2000);
    } else {
      setToastMessage('남은 스캔 횟수가 없어요. 스캔권을 충전해주세요.');
      setTimeout(() => { setToastMessage(null); router.push('/pricing'); }, 2000);
    }
  };

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;
    let stream: MediaStream | null = null;
    let isMounted = true;

    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (!isMounted) { stream.getTracks().forEach(t => t.stop()); return; }
        // 초점 및 줌 최적화 (지원 기기에서 근접 촬영 시 흐림 방지)
        try {
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities() as any;
          const advanced: Record<string, unknown>[] = [];
          if (capabilities.focusMode?.includes('continuous')) {
            advanced.push({ focusMode: 'continuous' });
          }
          if (capabilities.zoom && capabilities.zoom.max >= 1.5) {
            advanced.push({ zoom: 1.5 });
          }
          if (advanced.length > 0) {
            await (track.applyConstraints as any)({ advanced });
          }
        } catch {}
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          try { await videoRef.current.play(); } catch (e: any) { if (e.name !== 'AbortError') console.error(e); }
          if (isMounted) {
            codeReader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
              if (!isMounted) return;
              if (result && !isScanningRef.current) {
                const barcode = result.getText().trim();
                console.log('[scan] barcode detected:', barcode, '| format:', result.getBarcodeFormat());
                if (!barcode || barcode.length < 8) return; // 빈 문자열 또는 부분 읽기 무시 (EAN/UPC 최소 8자리)
                const currentUser = authUserRef.current;
                const canScan = currentUser
                  ? (isActiveRef.current || remainingScansRef.current > 0)
                  : (GUEST_LIMIT - parseInt(localStorage.getItem(GUEST_KEY) || '0', 10)) > 0;
                if (!canScan) {
                  if (!currentUser) {
                    setToastMessage('무료 체험 3회를 모두 사용했어요. 로그인하고 계속 이용해보세요!');
                    setTimeout(() => { setToastMessage(null); router.push('/login'); }, 2000);
                  } else {
                    setToastMessage('남은 스캔 횟수가 없어요. 스캔권을 충전해주세요.');
                    setTimeout(() => { setToastMessage(null); router.push('/pricing'); }, 2000);
                  }
                  return;
                }
                isScanningRef.current = true;
                setIsScanning(true);
                videoRef.current?.pause();
                // 바코드 감지와 동시에 콘텐츠 영역 크롭 캡처 (DB 미스 시 Gemini 폴백용)
                try {
                  if (videoRef.current && videoRef.current.videoWidth > 0) {
                    const cropped = captureContentArea(videoRef.current, 0.6);
                    if (cropped) sessionStorage.setItem('scanImage', cropped);
                  }
                } catch {}
                setTimeout(() => router.push('/result?barcode=' + encodeURIComponent(barcode)), 1500);
              }
              if (err && !(err instanceof NotFoundException)) {
                if (err.message?.includes('Video stream has ended')) return;
                if (isMounted) {
                  setToastMessage('바코드 인식 중 오류가 발생했습니다. 다시 시도해 주세요.');
                  setTimeout(() => setToastMessage(null), 3000);
                }
              }
            });
          }
        }
        setCameraError(null);
      } catch (err: any) {
        if (!isMounted) return;
        if (err.name === 'NotAllowedError' || err.message === 'Permission denied') {
          setCameraError("카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용하거나 '앨범에서 선택'을 이용해 주세요.");
        } else {
          setCameraError("카메라를 이용할 수 없어요. '앨범에서 선택'을 이용해 주세요.");
        }
      }
    }

    setupCamera();
    return () => {
      isMounted = false;
      codeReader.reset();
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  const handleCapture = async () => {
    if (isScanningRef.current || !videoRef.current) return;
    if (!hasScans) { handleNoScans(); return; }
    isScanningRef.current = true;
    setIsScanning(true);
    videoRef.current.pause();
    console.log('[scan] camera button pressed → image-only path (no barcode detected by ZXing)');
    try {
      const cropped = captureContentArea(videoRef.current, 0.8);
      if (cropped) {
        sessionStorage.setItem('scanImage', cropped);
        router.push('/result');
      }
    } catch {
      setIsScanning(false);
      isScanningRef.current = false;
      videoRef.current?.play();
    }
  };

  const handleAlbumButtonClick = () => {
    if (isScanningRef.current) return;
    const handleFocus = () => {
      setTimeout(() => {
        if (!isScanningRef.current) {
          setAlbumPermissionHint(true);
          setTimeout(() => setAlbumPermissionHint(false), 6000);
        }
      }, 500);
    };
    window.addEventListener('focus', handleFocus, { once: true });
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isScanningRef.current) return;
    setAlbumPermissionHint(false);
    if (!hasScans) { handleNoScans(); return; }
    isScanningRef.current = true;
    setIsScanning(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) { setIsScanning(false); isScanningRef.current = false; return; }
      try {
        if (!codeReaderRef.current) codeReaderRef.current = new BrowserMultiFormatReader();
        const img = new Image();
        img.onload = async () => {
          try {
            const result = await codeReaderRef.current!.decodeFromImageElement(img);
            const barcode = result.getText();
            setTimeout(() => router.push('/result?barcode=' + encodeURIComponent(barcode)), 1500);
          } catch {
            setToastMessage('바코드를 찾지 못해 식료품 AI 분석으로 전환합니다.');
            sessionStorage.setItem('scanImage', dataUrl);
            setTimeout(() => router.push('/result'), 2000);
          }
        };
        img.src = dataUrl;
      } catch {
        setIsScanning(false);
        isScanningRef.current = false;
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  /**
   * 헤더 아래 ~ 하단 컨트롤 위 영역만 크롭해 base64 반환
   * object-cover 비디오의 스케일을 역산해 정확한 비디오 픽셀 좌표로 매핑
   */
  function captureContentArea(video: HTMLVideoElement, quality = 0.8): string | null {
    const displayW = window.innerWidth;
    const displayH = window.innerHeight;
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    if (!videoW || !videoH) return null;

    const scale = Math.max(displayW / videoW, displayH / videoH);
    const offsetX = (videoW * scale - displayW) / 2;
    const offsetY = (videoH * scale - displayH) / 2;

    const topCss    = headerRef.current?.getBoundingClientRect().bottom ?? 64;
    const bottomCss = bottomControlsRef.current?.getBoundingClientRect().top ?? (displayH - 260);

    const srcX = offsetX / scale;
    const srcY = (topCss + offsetY) / scale;
    const srcW = displayW / scale;
    const srcH = (bottomCss - topCss) / scale;

    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(srcW);
    canvas.height = Math.round(srcH);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover z-0" />
      <div className="absolute inset-0 z-20 pointer-events-none">
        {/* Top */}
        <div className="absolute top-0 left-0 right-0 flex flex-col pointer-events-auto">
          <header ref={headerRef} className="flex items-center justify-between p-4">
            <button onClick={() => router.push('/home')} className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-md">
              <X className="w-6 h-6" />
            </button>
          </header>
          {cameraError && (
            <div className="mx-4 mt-2 bg-danger-bg text-danger-fg p-3 rounded-lg text-sm text-center font-medium shadow-lg flex flex-col items-center space-y-2 pointer-events-auto">
              <span>{cameraError}</span>
              <button onClick={() => setShowPermissionGuide(true)} className="flex items-center space-x-1 bg-black/10 px-3 py-1.5 rounded-full hover:bg-black/20 transition-colors">
                <Info className="w-4 h-4" />
                <span>카메라 허용 방법 보기</span>
              </button>
            </div>
          )}
          {albumPermissionHint && (
            <div className="mx-4 mt-2 bg-danger-bg text-danger-fg p-3 rounded-lg text-sm text-center font-medium shadow-lg flex flex-col items-center space-y-2 pointer-events-auto">
              <span>앨범에 접근할 수 없나요? 사진 접근 권한을 확인해주세요.</span>
              <button onClick={() => setShowAlbumPermissionGuide(true)} className="flex items-center space-x-1 bg-black/10 px-3 py-1.5 rounded-full hover:bg-black/20 transition-colors">
                <Info className="w-4 h-4" />
                <span>앨범 허용 방법 보기</span>
              </button>
            </div>
          )}
        </div>

        {/* Scanning overlay */}
        {isScanning && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-white drop-shadow-md">분석하고 있어요...</p>
          </div>
        )}

        {/* Bottom */}
        <div ref={bottomControlsRef} className="absolute bottom-0 left-0 right-0 flex flex-col justify-end pointer-events-auto" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
          <div className="px-4 mb-6">
            {!authUser ? (
              <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center justify-between cursor-pointer" onClick={() => router.push('/login')}>
                <div className="flex items-center space-x-2">
                  <ScanLine className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-white">
                    {guestRemaining > 0
                      ? <>무료 체험 남은 횟수: <strong className="text-primary">{guestRemaining}회</strong></>
                      : '무료 체험 3회를 모두 사용했어요'}
                  </span>
                </div>
                <span className="text-xs font-bold text-black bg-primary px-2 py-1 rounded-full shadow-sm">로그인</span>
              </div>
            ) : isActive ? (
              <div className="bg-primary/80 backdrop-blur-md border border-primary/20 rounded-xl p-3 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">무제한 스캔 이용 중</span>
              </div>
            ) : (
              <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center justify-between cursor-pointer" onClick={() => router.push('/pricing')}>
                <div className="flex items-center space-x-2">
                  <ScanLine className="w-4 h-4 text-secondary" />
                  <span className="text-sm font-medium text-white">남은 횟수: <strong className="text-secondary">{remainingScans}회</strong></span>
                </div>
                <span className="text-xs font-bold text-black bg-secondary px-2 py-1 rounded-full shadow-sm">충전하기</span>
              </div>
            )}
          </div>

          {toastMessage && (
            <div className="absolute bottom-36 left-0 right-0 flex justify-center px-4 z-50">
              <div className="bg-gray-800/90 text-white px-4 py-3 rounded-xl shadow-lg backdrop-blur-md text-sm font-medium flex items-center space-x-2">
                <Info className="w-4 h-4 text-primary" />
                <span>{toastMessage}</span>
              </div>
            </div>
          )}

          <p className="text-center text-base text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-medium mb-10">
            바코드를 스캔하거나<br />식료품을 촬영해 주세요
          </p>

          <div className="relative flex items-center justify-center w-full px-8">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
            <div className="absolute left-8 flex items-center justify-center">
              <button
                onClick={handleAlbumButtonClick}
                disabled={isScanning}
                className={cn('flex flex-col items-center space-y-2 text-white hover:text-gray-200 transition-colors drop-shadow-lg', isScanning && 'opacity-50 pointer-events-none')}
              >
                <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">앨범에서 선택</span>
              </button>
            </div>
            <button
              onClick={handleCapture}
              disabled={isScanning}
              className={cn('w-20 h-20 rounded-full border-4 flex items-center justify-center p-1 transition-transform shadow-xl border-white hover:scale-105 active:scale-95', isScanning && 'opacity-50 pointer-events-none')}
            >
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center shadow-inner">
                <Camera className="w-8 h-8 text-black" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Camera Permission Guide Modal */}
      {showPermissionGuide && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="bg-white text-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowPermissionGuide(false)} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <Camera className="w-5 h-5 mr-2 text-primary" />
              카메라 권한 허용 가이드
            </h3>
            <div className="space-y-5 text-sm text-gray-600 overflow-y-auto max-h-[60vh]">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">📱 아이폰 (Safari)</h4>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>주소창 왼쪽의 <strong>'aA'</strong> 아이콘 터치</li>
                  <li><strong>'웹사이트 설정'</strong> 터치</li>
                  <li>카메라를 <strong>'허용'</strong>으로 변경 후 새로고침</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">📱 안드로이드 (Chrome)</h4>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>주소창 왼쪽의 <strong>자물쇠 모양</strong> 아이콘 터치</li>
                  <li><strong>'권한'</strong> 메뉴 선택</li>
                  <li>카메라를 <strong>'허용'</strong>으로 변경 후 새로고침</li>
                </ol>
              </div>
              <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                권한 허용이 어려우신 경우, <strong>'앨범에서 선택'</strong> 버튼으로 기존 사진을 업로드하실 수 있습니다.
              </p>
            </div>
            <button onClick={() => setShowPermissionGuide(false)} className="w-full mt-5 bg-primary text-white font-medium py-2.5 rounded-xl hover:bg-primary-strong transition-colors">
              확인
            </button>
          </div>
        </div>
      )}

      {/* Album Permission Guide Modal */}
      {showAlbumPermissionGuide && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="bg-white text-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowAlbumPermissionGuide(false)} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <ImageIcon className="w-5 h-5 mr-2 text-primary" />
              앨범 접근 권한 허용 가이드
            </h3>
            <div className="space-y-5 text-sm text-gray-600 overflow-y-auto max-h-[60vh]">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">📱 아이폰 (Safari)</h4>
                <ol className="list-decimal pl-4 space-y-1">
                  <li><strong>설정 앱</strong> 열기</li>
                  <li><strong>'개인 정보 보호 및 보안'</strong> → <strong>'사진'</strong> 터치</li>
                  <li>Safari를 찾아 <strong>'모든 사진'</strong> 또는 <strong>'선택된 사진'</strong>으로 변경</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">📱 안드로이드 (Chrome)</h4>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>주소창 왼쪽의 <strong>자물쇠 모양</strong> 아이콘 터치</li>
                  <li><strong>'권한'</strong> 메뉴 선택</li>
                  <li>사진/미디어를 <strong>'허용'</strong>으로 변경 후 새로고침</li>
                </ol>
              </div>
              <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                앨범 접근이 계속 어려우신 경우, 카메라로 직접 촬영하거나 브라우저에서 파일 앱을 통해 이미지를 선택해 보세요.
              </p>
            </div>
            <button onClick={() => setShowAlbumPermissionGuide(false)} className="w-full mt-5 bg-primary text-white font-medium py-2.5 rounded-xl hover:bg-primary-strong transition-colors">
              확인
            </button>
          </div>
        </div>
      )}


    </div>
  );
}
