'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, Loader2, CheckCircle, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';

const CATEGORIES = [
  { value: 'payment', label: '결제 / 환불' },
  { value: 'scan_error', label: '분석 오류' },
  { value: 'feature', label: '기능 문의' },
  { value: 'account', label: '계정 문의' },
  { value: 'other', label: '기타' },
] as const;

type Category = (typeof CATEGORIES)[number]['value'];

const MAX_IMAGES = 3;

export default function SupportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<Category | ''>('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = category !== '' && body.trim().length > 0 && !isSubmitting;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_IMAGES - images.length;
    const newFiles = files.slice(0, remaining);
    if (newFiles.length === 0) return;

    setImages(prev => [...prev, ...newFiles]);
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1) 이미지 업로드
      const attachmentUrls: string[] = [];
      for (const file of images) {
        const fd = new FormData();
        fd.append('file', file);
        const uploadRes = await fetch('/api/support/upload', { method: 'POST', body: fd });
        if (!uploadRes.ok) {
          setErrorMsg('이미지 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        const { url } = await uploadRes.json();
        attachmentUrls.push(url);
      }

      // 2) 티켓 제출
      const res = await fetch('/api/support/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'inquiry',
          category,
          title: title.trim() || undefined,
          body: body.trim(),
          attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined,
        }),
      });

      if (!res.ok) {
        setErrorMsg('문의 접수에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }

      setSubmitted(true);
    } catch {
      setErrorMsg('네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col flex-1 bg-bg-canvas pb-20">
        <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
          <button onClick={() => router.back()} className="p-1 -ml-1 mr-3 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-lg text-text-primary">고객센터</span>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-3">문의가 접수되었어요</h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-10">소중한 의견 감사합니다.<br />빠른 시일 내에 검토 후 답변드릴게요.</p>
          <Button className="w-full font-bold h-12 rounded-2xl" onClick={() => router.back()}>
            돌아가기
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-20">
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <button onClick={() => router.back()} className="p-1 -ml-1 mr-3 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-lg text-text-primary">고객센터</span>
      </header>

      <main className="px-4 py-6 space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-text-primary">무엇이든 물어보세요</h2>
            <p className="text-xs text-text-secondary mt-0.5">문의 내용을 남겨주시면 검토 후 답변드려요.</p>
          </div>
        </div>

        {/* 카테고리 */}
        <section className="space-y-2">
          <label className="text-sm font-semibold text-text-primary px-1">
            문의 유형 <span className="text-danger-fg">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-colors ${
                  category === cat.value
                    ? 'bg-primary text-white border-primary'
                    : 'bg-bg-surface border-border-subtle text-text-secondary hover:border-primary/50 hover:text-text-primary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </section>

        {/* 제목 (선택) */}
        <section className="space-y-2">
          <label className="text-sm font-semibold text-text-primary px-1">제목 (선택)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="문의 제목을 간략히 적어주세요"
            maxLength={100}
            className="w-full px-4 py-3 bg-bg-surface border border-border-subtle rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-colors"
          />
        </section>

        {/* 내용 */}
        <section className="space-y-2">
          <label className="text-sm font-semibold text-text-primary px-1">
            문의 내용 <span className="text-danger-fg">*</span>
          </label>
          <Card className="bg-bg-surface border-border-subtle shadow-none">
            <CardContent className="p-0">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="문의하실 내용을 자세히 적어주세요."
                maxLength={2000}
                className="w-full h-36 px-4 py-3 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none"
              />
              <div className="px-4 pb-3 text-right">
                <span className="text-xs text-text-tertiary">{body.length} / 2000</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 이미지 첨부 */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <label className="text-sm font-semibold text-text-primary">스크린샷 첨부 (선택)</label>
            <span className="text-xs text-text-tertiary">{images.length} / {MAX_IMAGES}</span>
          </div>

          <div className="flex gap-2 flex-wrap">
            {previews.map((src, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden bg-neutral-bg border border-border-subtle shrink-0">
                <img src={src} alt={`첨부 ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}

            {images.length < MAX_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-border-subtle flex flex-col items-center justify-center gap-1 text-text-tertiary hover:border-primary/50 hover:text-primary transition-colors shrink-0"
              >
                <ImagePlus className="w-5 h-5" />
                <span className="text-xs">추가</span>
              </button>
            )}
          </div>

          <p className="text-xs text-text-tertiary px-1">최대 {MAX_IMAGES}장 · JPG, PNG, WEBP (5MB 이하)</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/gif"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </section>

        {errorMsg && (
          <p className="text-sm text-danger-fg px-1">{errorMsg}</p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full font-bold h-12 rounded-2xl"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '문의 접수하기'}
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}
