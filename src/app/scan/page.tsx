'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X, ScanLine, Image as ImageIcon, Info, Lock, RefreshCw, MoreVertical, ShieldCheck } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface UserProfile {
  subscription_status: string;
}

export default function ScanPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [remainingScans, setRemainingScans] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const isScanningRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [guestScansUsed, setGuestScansUsed] = useState(0);

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
      if (user) {
        const [{ data: prof }, { data: credits }] = await Promise.all([
          supabase.from('users').select('subscription_status').eq('id', user.id).single(),
          supabase.from('scan_credits').select('count').eq('user_id', user.id).gt('expires_at', new Date().toISOString()),
        ]);
        setUserProfile(prof);
        setRemainingScans(credits?.reduce((s: number, c: any) => s + c.count, 0) ?? 0);
      }
    });
  }, []);

  const isActive = userProfile?.subscription_status === 'active';
  const guestRemaining = GUEST_LIMIT - guestScansUsed;
  const hasCredits = authUser ? (isActive || remainingScans > 0) : guestRemaining > 0;

  const handleNoCredits = () => {
    if (!authUser) {
      setToastMessage('무료 체험 3회를 모두 사용했어요. 로그인하고 계속 이용해보세요!');
      setTimeout(() => { setToastMessage(null); router.push('/login'); }, 2000);
    } else {
      setToastMessage('남은 스캔 횟수가 없어요. 이용권을 충전해주세요.');
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
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!isMounted) { stream.getTracks().forEach(t => t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          try { await videoRef.current.play(); } catch (e: any) { if (e.name !== 'AbortError') console.error(e); }
          if (isMounted) {
            codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
              if (!isMounted) return;
              if (result && !isScanningRef.current) {
                const barcode = result.getText().trim();
                if (!barcode || barcode.length < 8) return; // 빈 문자열 또는 부분 읽기 무시 (EAN/UPC 최소 8자리)
                if (!hasCredits) { handleNoCredits(); return; }
                isScanningRef.current = true;
                setIsScanning(true);
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
    if (!hasCredits) { handleNoCredits(); return; }
    isScanningRef.current = true;
    setIsScanning(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        sessionStorage.setItem('scanImage', base64Image);
        router.push('/result');
      }
    } catch {
      setIsScanning(false);
      isScanningRef.current = false;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isScanningRef.current) return;
    if (!hasCredits) { handleNoCredits(); return; }
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

  const holeWidth = 320, holeHeight = 380, holeRadius = 24, yOffset = '60px';
  const svgMask = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${holeWidth}' height='${holeHeight}'%3E%3Crect width='${holeWidth}' height='${holeHeight}' rx='${holeRadius}' fill='black'/%3E%3C/svg%3E`;
  const overlayStyle = {
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    WebkitMaskImage: `linear-gradient(black, black), url("${svgMask}")`,
    WebkitMaskPosition: `center calc(50% - ${yOffset})`, WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: `100% 100%, ${holeWidth}px ${holeHeight}px`, WebkitMaskComposite: 'destination-out',
    maskImage: `linear-gradient(black, black), url("${svgMask}")`,
    maskPosition: `center calc(50% - ${yOffset})`, maskRepeat: 'no-repeat',
    maskSize: `100% 100%, ${holeWidth}px ${holeHeight}px`, maskComposite: 'exclude',
  };

  return (
    <div className="flex flex-col flex-1 bg-black text-white relative overflow-hidden">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover z-0" />
      <div className="absolute inset-0 z-10 pointer-events-none transition-all duration-300" style={overlayStyle} />

      <div className="absolute inset-0 z-20 pointer-events-none">
        {/* Top */}
        <div className="absolute top-0 left-0 right-0 flex flex-col pointer-events-auto">
          <header className="flex items-center justify-between p-4">
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
        </div>

        {/* Viewfinder */}
        <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
          <div className="relative w-[320px] h-[380px] -translate-y-[60px]">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-[24px]" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-[24px]" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-[24px]" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-[24px]" />
            <div className="absolute top-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_8px_2px_rgba(242,140,130,0.5)] animate-[scan_2s_ease-in-out_infinite]" />
            {isScanning && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center backdrop-blur-md rounded-[24px]">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium text-white drop-shadow-md">분석하고 있어요...</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col justify-end pb-8 pointer-events-auto">
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
                onClick={() => fileInputRef.current?.click()}
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

      {/* Permission Guide Modal */}
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

      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}
