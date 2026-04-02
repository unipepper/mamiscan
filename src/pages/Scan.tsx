import React, { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Camera, X, ScanLine, Image as ImageIcon, Info, Lock, RefreshCw, MoreVertical } from "lucide-react"
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library"
import { cn } from "@/src/lib/utils"
import { useAuth } from "@/src/lib/AuthContext"

export function Scan() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isScanning, setIsScanning] = useState(false)
  const isScanningRef = useRef(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [showPermissionGuide, setShowPermissionGuide] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader()
    codeReaderRef.current = codeReader
    let stream: MediaStream | null = null
    let isMounted = true

    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        })
        
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop())
          return
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute("playsinline", "true")
          
          try {
            await videoRef.current.play()
          } catch (playErr: any) {
            // Ignore AbortError which happens if the component unmounts or srcObject changes
            if (playErr.name !== 'AbortError') {
              console.error("Error playing video:", playErr)
            }
          }
          
          // Start continuous scanning loop once
          if (isMounted) {
            codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
              if (!isMounted) return
              
              // Process barcode if found
              if (result && !isScanningRef.current) {
                isScanningRef.current = true
                setIsScanning(true)
                console.log("Scanned Barcode:", result.getText())
                
                setTimeout(() => {
                  navigate("/result")
                }, 1500)
              }
              
              if (err && !(err instanceof NotFoundException)) {
                // Ignore "Video stream has ended" error which happens during cleanup
                if (err.message && err.message.includes("Video stream has ended")) {
                  return
                }
                console.error("Scan error:", err)
                if (isMounted) {
                  setToastMessage("바코드 인식 중 오류가 발생했습니다. 다시 시도해 주세요.")
                  setTimeout(() => setToastMessage(null), 3000)
                }
              }
            })
          }
        }
        setCameraError(null)
      } catch (err: any) {
        if (isMounted) {
          console.error("Error accessing camera:", err)
          if (err.name === 'NotAllowedError' || err.message === 'Permission denied') {
            setCameraError("카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용하거나 '앨범에서 선택'을 이용해 주세요.")
          } else {
            setCameraError("카메라를 찾을 수 없거나 접근할 수 없습니다. '앨범에서 선택'을 이용해 주세요.")
          }
        }
      }
    }

    setupCamera()

    return () => {
      isMounted = false
      codeReader.reset() // This stops the decoding and the stream tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [navigate])

  const handleCapture = async () => {
    if (isScanningRef.current || !videoRef.current) return
    isScanningRef.current = true
    setIsScanning(true)

    try {
      // 비디오 프레임을 캔버스에 그려서 Base64 이미지로 변환
      const canvas = document.createElement("canvas")
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext("2d")
      
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        const base64Image = canvas.toDataURL("image/jpeg", 0.8)

        // 결과 페이지로 이동 (이미지를 넘겨서 처리)
        navigate("/result", { state: { imageBase64: base64Image } })
      }
    } catch (error) {
      console.error("Capture failed:", error)
      setIsScanning(false)
      isScanningRef.current = false
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (isScanningRef.current) return
    isScanningRef.current = true
    setIsScanning(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string
      if (!dataUrl) {
        setIsScanning(false)
        isScanningRef.current = false
        return
      }

      try {
        if (!codeReaderRef.current) {
          codeReaderRef.current = new BrowserMultiFormatReader()
        }
        const img = new Image()
        img.onload = async () => {
          try {
            const result = await codeReaderRef.current!.decodeFromImageElement(img)
            console.log("Scanned Barcode from image:", result.getText())
            setTimeout(() => {
              navigate("/result")
            }, 1500)
          } catch (err) {
            // 바코드를 찾을 수 없으면 식료품 이미지로 간주
            console.log("No barcode found, treating as food image...")
            setToastMessage("바코드를 찾지 못해 식료품 AI 분석으로 전환합니다.")
            setTimeout(() => {
              navigate("/result", { state: { imageBase64: dataUrl } })
            }, 2000)
          }
        }
        img.src = dataUrl
      } catch (err) {
        console.error(err)
        setIsScanning(false)
        isScanningRef.current = false
      }
    }
    reader.readAsDataURL(file)
    
    // Reset input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const holeWidth = 320;
  const holeHeight = 380;
  const holeRadius = 24;
  const yOffset = '60px';

  const svgMask = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${holeWidth}' height='${holeHeight}'%3E%3Crect width='${holeWidth}' height='${holeHeight}' rx='${holeRadius}' fill='black'/%3E%3C/svg%3E`;

  const overlayStyle = {
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    WebkitMaskImage: `linear-gradient(black, black), url("${svgMask}")`,
    WebkitMaskPosition: `center calc(50% - ${yOffset})`,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: `100% 100%, ${holeWidth}px ${holeHeight}px`,
    WebkitMaskComposite: 'destination-out',
    maskImage: `linear-gradient(black, black), url("${svgMask}")`,
    maskPosition: `center calc(50% - ${yOffset})`,
    maskRepeat: 'no-repeat',
    maskSize: `100% 100%, ${holeWidth}px ${holeHeight}px`,
    maskComposite: 'exclude',
  };

  return (
    <div className="flex flex-col flex-1 bg-black text-white relative overflow-hidden">
      {/* Camera Feed Background (Z-index 0) */}
      <video 
        ref={videoRef}
        autoPlay 
        playsInline 
        muted 
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Layer 1: Blurred Overlay with Hole (No dimming) */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none transition-all duration-300"
        style={overlayStyle}
      />

      {/* Layer 2: UI Elements (Z-index 20) */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        
        {/* Top Area */}
        <div className="absolute top-0 left-0 right-0 flex flex-col pointer-events-auto">
          <header className="flex items-center justify-between p-4">
            <button 
              onClick={() => navigate("/")}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-md"
            >
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={() => setCameraError(prev => prev ? null : "카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용하거나 '앨범에서 선택'을 이용해 주세요.")}
              className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold rounded-full pointer-events-auto transition-colors backdrop-blur-md"
            >
              에러 UI 테스트
            </button>
          </header>
          {cameraError && (
            <div className="mx-4 mt-2 bg-danger-bg text-danger-fg p-3 rounded-lg text-sm text-center font-medium shadow-lg flex flex-col items-center space-y-2 pointer-events-auto">
              <span>{cameraError}</span>
              <button 
                onClick={() => setShowPermissionGuide(true)}
                className="flex items-center space-x-1 bg-black/10 px-3 py-1.5 rounded-full hover:bg-black/20 transition-colors"
              >
                <Info className="w-4 h-4" />
                <span>카메라 허용 방법 보기</span>
              </button>
            </div>
          )}
        </div>

        {/* Middle Area (Viewfinder) */}
        <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
          <div className="relative transition-all duration-300 w-[320px] h-[380px] -translate-y-[60px]">
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-[24px]"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-[24px]"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-[24px]"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-[24px]"></div>
            
            {/* Scanning animation line */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_8px_2px_rgba(242,140,130,0.5)] animate-[scan_2s_ease-in-out_infinite]"></div>
            
            {isScanning && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center backdrop-blur-md rounded-[24px]">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-medium text-white drop-shadow-md">
                  분석하고 있어요...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Area */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col justify-end pb-12 pointer-events-auto">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="absolute bottom-36 left-0 right-0 flex justify-center px-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload} 
            />
            
            <div className="absolute left-8 flex items-center justify-center">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className={cn(
                  "flex flex-col items-center space-y-2 text-white hover:text-gray-200 transition-colors drop-shadow-lg",
                  isScanning && "opacity-50 pointer-events-none"
                )}
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
              className={cn(
                "w-20 h-20 rounded-full border-4 flex items-center justify-center p-1 transition-transform shadow-xl border-white hover:scale-105 active:scale-95",
                isScanning && "opacity-50 pointer-events-none"
              )}
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
          <div className="bg-white text-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setShowPermissionGuide(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <Camera className="w-5 h-5 mr-2 text-primary" />
              카메라 권한 허용 가이드
            </h3>
            
            <div className="space-y-6 text-sm text-gray-600 overflow-y-auto max-h-[60vh] pr-2">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">📱 아이폰 (Safari)</h4>
                <div className="bg-gray-50 rounded-lg p-3 mb-3 flex items-center justify-center border border-gray-100">
                  <div className="bg-white rounded-md px-3 py-2 flex items-center shadow-sm w-full max-w-[220px] justify-between border border-gray-200">
                    <span className="text-base font-serif font-bold text-blue-500">aA</span>
                    <span className="text-xs text-gray-400">mamascan.com</span>
                    <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </div>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>주소창 왼쪽의 <strong>'aA'</strong> 아이콘 터치</li>
                  <li><strong>'웹사이트 설정'</strong> 터치</li>
                  <li>카메라를 <strong>'허용'</strong>으로 변경 후 새로고침</li>
                </ol>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">📱 안드로이드 (Chrome)</h4>
                <div className="bg-gray-50 rounded-lg p-3 mb-3 flex items-center justify-center border border-gray-100">
                  <div className="bg-white rounded-full px-3 py-2 flex items-center shadow-sm w-full max-w-[220px] border border-gray-200">
                    <Lock className="w-3.5 h-3.5 text-gray-700 mr-2" />
                    <span className="text-xs text-gray-400 flex-1 text-center">mamascan.com</span>
                    <MoreVertical className="w-3.5 h-3.5 text-gray-400 ml-2" />
                  </div>
                </div>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>주소창 왼쪽의 <strong>자물쇠 모양</strong> 아이콘 터치</li>
                  <li><strong>'권한'</strong> 메뉴 선택</li>
                  <li>카메라를 <strong>'허용'</strong>으로 변경 후 새로고침</li>
                </ol>
              </div>
              
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  권한 허용이 어려우신 경우, 하단의 <strong>'앨범에서 선택'</strong> 버튼을 눌러 기존 사진을 업로드하실 수 있습니다.
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowPermissionGuide(false)}
              className="w-full mt-6 bg-primary text-white font-medium py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
            >
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
  )
}
