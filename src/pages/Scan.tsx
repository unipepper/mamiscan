import React, { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Camera, X, ScanLine, Image as ImageIcon, Type } from "lucide-react"
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library"
import { cn } from "@/src/lib/utils"
import { useAuth } from "@/src/lib/AuthContext"

export function Scan() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()
  const [scanMode, setScanMode] = useState<"barcode" | "ocr">("barcode")
  const scanModeRef = useRef(scanMode)
  const [isScanning, setIsScanning] = useState(false)
  const isScanningRef = useRef(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true })
    }
  }, [user, isLoading, navigate])

  if (isLoading || !user) {
    return <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  }

  // Keep ref in sync with state
  useEffect(() => {
    scanModeRef.current = scanMode
  }, [scanMode])

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
              
              // Only process barcode if we are in barcode mode
              if (result && !isScanningRef.current && scanModeRef.current === "barcode") {
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
              }
            })
          }
        }
        setCameraError(null)
      } catch (err) {
        if (isMounted) {
          console.error("Error accessing camera:", err)
          setCameraError("카메라 접근 권한이 없거나 카메라를 찾을 수 없습니다.")
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

  const handleCaptureOCR = async () => {
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

        // 서버의 OCR API로 전송
        const response = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64Image })
        })
        
        const data = await response.json()
        console.log("OCR Result:", data)
        
        // 결과 페이지로 이동 (실제로는 data.text를 넘겨서 처리)
        navigate("/result", { state: { ocrText: data.text } })
      }
    } catch (error) {
      console.error("OCR Capture failed:", error)
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

      if (scanMode === "barcode") {
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
              console.error("Barcode decode error:", err)
              alert("바코드를 인식할 수 없습니다. 다른 이미지를 선택해주세요.")
              setIsScanning(false)
              isScanningRef.current = false
            }
          }
          img.src = dataUrl
        } catch (err) {
          console.error(err)
          setIsScanning(false)
          isScanningRef.current = false
        }
      } else {
        try {
          const response = await fetch("/api/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: dataUrl })
          })
          
          const data = await response.json()
          console.log("OCR Result:", data)
          
          navigate("/result", { state: { ocrText: data.text } })
        } catch (error) {
          console.error("OCR upload failed:", error)
          alert("이미지 분석에 실패했습니다.")
          setIsScanning(false)
          isScanningRef.current = false
        }
      }
    }
    reader.readAsDataURL(file)
    
    // Reset input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const holeWidth = scanMode === "ocr" ? 320 : 280;
  const holeHeight = scanMode === "ocr" ? 360 : 280;
  const holeRadius = 24;

  const svgMask = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${holeWidth}' height='${holeHeight}'%3E%3Crect width='${holeWidth}' height='${holeHeight}' rx='${holeRadius}' fill='black'/%3E%3C/svg%3E`;

  const overlayStyle = {
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    WebkitMaskImage: `linear-gradient(black, black), url("${svgMask}")`,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: `100% 100%, ${holeWidth}px ${holeHeight}px`,
    WebkitMaskComposite: 'destination-out',
    maskImage: `linear-gradient(black, black), url("${svgMask}")`,
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize: `100% 100%, ${holeWidth}px ${holeHeight}px`,
    maskComposite: 'exclude',
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white relative overflow-hidden">
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
            
            {/* Mode Toggle */}
            <div className="flex bg-black/40 rounded-full p-1 backdrop-blur-md">
              <button
                onClick={() => setScanMode("barcode")}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center space-x-1",
                  scanMode === "barcode" ? "bg-white text-black" : "text-white/70 hover:text-white"
                )}
              >
                <ScanLine className="w-4 h-4" />
                <span>바코드</span>
              </button>
              <button
                onClick={() => setScanMode("ocr")}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center space-x-1",
                  scanMode === "ocr" ? "bg-white text-black" : "text-white/70 hover:text-white"
                )}
              >
                <Type className="w-4 h-4" />
                <span>성분표</span>
              </button>
            </div>

            <div className="w-10"></div> {/* Spacer for centering */}
          </header>
          {cameraError && (
            <div className="mx-4 mt-2 bg-danger-bg text-danger-fg p-3 rounded-lg text-sm text-center font-medium shadow-lg">
              {cameraError}
            </div>
          )}
        </div>

        {/* Middle Area (Viewfinder) */}
        <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
          <div className={cn("relative transition-all duration-300", scanMode === "ocr" ? "w-[320px] h-[360px]" : "w-[280px] h-[280px]")}>
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-[24px]"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-[24px]"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-[24px]"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-[24px]"></div>
            
            {/* Scanning animation line */}
            {scanMode === "barcode" && (
              <div className="absolute top-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_8px_2px_rgba(242,140,130,0.5)] animate-[scan_2s_ease-in-out_infinite]"></div>
            )}
            
            {isScanning && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center backdrop-blur-md rounded-[24px]">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-medium text-white drop-shadow-md">
                  {scanMode === "barcode" ? "바코드를 분석하고 있어요..." : "성분표 글자를 읽고 있어요..."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Area */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col justify-end pb-12 pointer-events-auto">
          <p className="text-center text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-medium mb-8">
            {scanMode === "barcode" 
              ? <>제품의 바코드를<br />사각형 안에 맞춰주세요</>
              : <>원재료명이 적힌 성분표가<br />잘 보이도록 촬영해 주세요</>
            }
          </p>

          <div className="flex items-center justify-center space-x-8 w-full px-8">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload} 
            />
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
            
            <button 
              onClick={scanMode === "ocr" ? handleCaptureOCR : undefined}
              disabled={isScanning}
              className={cn(
                "w-20 h-20 rounded-full border-4 flex items-center justify-center p-1 transition-transform shadow-xl",
                scanMode === "ocr" ? "border-white hover:scale-105 active:scale-95" : "border-white/60",
                isScanning && "opacity-50 pointer-events-none"
              )}
            >
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center shadow-inner">
                {scanMode === "barcode" ? (
                  <ScanLine className="w-8 h-8 text-black" />
                ) : (
                  <Camera className="w-8 h-8 text-black" />
                )}
              </div>
            </button>
            
            <div className="w-12 flex flex-col items-center space-y-2 opacity-0">
              {/* Placeholder for symmetry */}
              <div className="w-12 h-12"></div>
              <span className="text-xs"></span>
            </div>
          </div>
        </div>
      </div>
      
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
