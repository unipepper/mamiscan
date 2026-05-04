'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, MessageSquare, Loader2, CheckCircle, ImagePlus, X,
  ChevronRight, ChevronDown, LogIn, MessageCircle, HelpCircle, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';
import { createClient } from '@/lib/supabase/client';

// ─── 상수 ────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'payment',    label: '결제 / 환불' },
  { value: 'scan_error', label: '분석 오류' },
  { value: 'feature',    label: '기능 문의' },
  { value: 'account',    label: '계정 문의' },
  { value: 'other',      label: '기타' },
] as const;

type Category = (typeof CATEGORIES)[number]['value'];

const CATEGORY_LABEL: Record<string, string> = {
  payment:    '결제 / 환불',
  scan_error: '분석 오류',
  feature:    '기능 문의',
  account:    '계정 문의',
  other:      '기타',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  open:        { label: '접수됨',   color: 'text-text-secondary bg-neutral-bg' },
  in_progress: { label: '처리중',   color: 'text-caution bg-caution/10' },
  resolved:    { label: '답변완료', color: 'text-primary bg-primary/10' },
  dismissed:   { label: '완료',     color: 'text-text-tertiary bg-neutral-bg' },
};

const MAX_IMAGES = 3;

const FAQ_ITEMS = [
  {
    q: '스캔 횟수는 어떻게 충전하나요?',
    a: '하단 탭의 [내 정보] → [이용권 구매]에서 5회 이용권 또는 월정액 구독을 구매하실 수 있어요. 첫 가입 시 5회 무료 스캔이 제공됩니다.',
  },
  {
    q: '스캔 결과가 부정확하거나 분석이 안 돼요',
    a: '바코드가 흐리거나 빛 반사가 심한 경우 인식이 어려울 수 있어요. 바코드 위 조명을 조절하거나 카메라를 가까이 대보세요. 성분 분석 오류는 [문의하기]를 통해 제보해 주시면 검토 후 개선할게요.',
  },
  {
    q: '환불은 어떻게 신청하나요?',
    a: '구매 후 스캔 횟수를 사용하지 않은 경우 구매일로부터 7일 이내에 환불 신청이 가능합니다. [내 정보] → [결제 내역]에서 환불 신청 버튼을 누르거나, 아래 [문의하기]로 접수해 주세요.',
  },
  {
    q: '임신 주수를 변경하고 싶어요',
    a: '[내 정보] → 프로필 편집에서 임신 주수를 언제든 변경할 수 있어요. 주수가 바뀌면 이후 스캔 결과의 주차별 위험도 분석이 자동으로 업데이트돼요.',
  },
  {
    q: '카카오/구글 계정을 바꾸고 싶어요',
    a: '현재 소셜 로그인 계정 변경은 직접 지원되지 않아요. 계정을 변경하시려면 기존 계정을 탈퇴하고 새 계정으로 다시 가입해 주셔야 해요. 이용권은 이전되지 않으니 유의해 주세요.',
  },
  {
    q: '회원 탈퇴는 어떻게 하나요?',
    a: '[내 정보] → [계정 설정] → [회원 탈퇴]에서 진행하실 수 있어요. 탈퇴 시 스캔 내역 및 이용권이 모두 삭제되며 복구되지 않으니 신중하게 결정해 주세요.',
  },
];

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Ticket {
  id: number;
  category: string;
  title: string | null;
  body: string;
  status: string;
  admin_note: string | null;
  attachments: string[] | null;
  created_at: string;
  updated_at: string;
}

type View = 'main' | 'form' | 'detail';

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function SupportPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('main');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const handleBack = () => {
    if (view === 'detail' || view === 'form') {
      setView('main');
      setSelectedTicket(null);
    } else {
      router.back();
    }
  };

  const HEADER_TITLE: Record<View, string> = {
    main:   '고객센터',
    form:   '문의하기',
    detail: '문의 상세',
  };

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-nav">
      <header className="safe-top sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-surface/80 backdrop-blur-md border-b border-border-subtle">
        <button
          onClick={handleBack}
          className="p-1 -ml-1 mr-3 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-lg text-text-primary">{HEADER_TITLE[view]}</span>
      </header>

      {view === 'main' && (
        <MainView
          onOpenForm={() => setView('form')}
          onOpenDetail={(ticket) => { setSelectedTicket(ticket); setView('detail'); }}
        />
      )}
      {view === 'form' && (
        <InquiryForm onSubmitSuccess={() => setView('main')} />
      )}
      {view === 'detail' && selectedTicket && (
        <TicketDetail ticket={selectedTicket} />
      )}

      <BottomNav />
    </div>
  );
}

// ─── 메인 뷰 (FAQ + 문의 내역 + FAB) ─────────────────────────────────────────

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
}

function MainView({
  onOpenForm,
  onOpenDetail,
}: {
  onOpenForm: () => void;
  onOpenDetail: (t: Ticket) => void;
}) {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // FAQ + 문의 내역 병렬 fetch
      const [{ data: faqData }, { data: { user } }] = await Promise.all([
        supabase
          .from('faq_items')
          .select('id, question, answer, sort_order')
          .order('sort_order', { ascending: true }),
        supabase.auth.getUser(),
      ]);

      // DB에서 가져온 FAQ가 있으면 사용, 없으면 하드코딩 fallback
      if (faqData && faqData.length > 0) {
        setFaqItems(faqData);
      } else {
        setFaqItems(FAQ_ITEMS.map((item, idx) => ({
          id: idx,
          question: item.q,
          answer: item.a,
          sort_order: idx,
        })));
      }

      if (!user) {
        setIsLoggedIn(false);
        setTicketsLoading(false);
        return;
      }
      setIsLoggedIn(true);
      const { data } = await supabase
        .from('customer_inquiries')
        .select('*')
        .order('created_at', { ascending: false });
      setTickets(data ?? []);
      setTicketsLoading(false);
    })();
  }, []);

  return (
    <>
      <main className="px-4 py-6 space-y-8">

        {/* ── 자주 묻는 질문 ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <HelpCircle className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-text-primary">자주 묻는 질문</h2>
          </div>

          <div className="space-y-2">
            {faqItems.map((item, idx) => (
              <Card
                key={item.id}
                className="bg-bg-surface border-border-subtle shadow-none overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                >
                  <span className="text-sm font-medium text-text-primary pr-2">{item.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-text-tertiary shrink-0 transition-transform duration-200 ${
                      openFaq === idx ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4">
                    <div className="border-t border-border-subtle pt-3">
                      <p className="text-sm text-text-secondary leading-relaxed">{item.answer}</p>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* ── 내 문의 내역 ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <MessageCircle className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-text-primary">내 문의 내역</h2>
          </div>

          {ticketsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !isLoggedIn ? (
            <Card className="bg-bg-surface border-border-subtle shadow-none">
              <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 bg-neutral-bg rounded-full flex items-center justify-center">
                  <LogIn className="w-6 h-6 text-text-tertiary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">로그인이 필요해요</p>
                  <p className="text-xs text-text-secondary mt-0.5">로그인하면 문의 내역과 답변을 확인할 수 있어요.</p>
                </div>
                <Button
                  className="w-full h-10 text-sm"
                  onClick={() => router.push('/login')}
                >
                  로그인하기
                </Button>
              </CardContent>
            </Card>
          ) : tickets.length === 0 ? (
            <Card className="bg-bg-surface border-border-subtle shadow-none">
              <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 bg-neutral-bg rounded-full flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-text-tertiary" />
                </div>
                <p className="text-sm text-text-secondary">아직 남긴 문의가 없어요</p>
                <p className="text-xs text-text-tertiary">궁금한 점은 아래 버튼으로 문의해 주세요.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {tickets.map(ticket => {
                const status = STATUS_META[ticket.status] ?? STATUS_META.open;
                const hasReply = !!ticket.admin_note;
                const preview = ticket.title
                  ? ticket.title
                  : ticket.body.slice(0, 50) + (ticket.body.length > 50 ? '…' : '');

                return (
                  <Card
                    key={ticket.id}
                    onClick={() => onOpenDetail(ticket)}
                    className="bg-bg-surface border-border-subtle shadow-sm cursor-pointer hover:bg-neutral-bg transition-colors"
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-text-tertiary bg-neutral-bg px-2 py-0.5 rounded-full">
                            {CATEGORY_LABEL[ticket.category] ?? ticket.category}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                            {status.label}
                          </span>
                          {hasReply && (
                            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              답변 도착
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-text-primary truncate">{preview}</p>
                        <p className="text-xs text-text-tertiary">{formatDate(ticket.created_at)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0 mt-1" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* FAB 여백 */}
        <div className="h-4" />
      </main>

      {/* 문의하기 FAB */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+12px)] left-1/2 -translate-x-1/2 w-full max-w-[428px] px-4 pointer-events-none z-40">
        <button
          onClick={onOpenForm}
          className="pointer-events-auto ml-auto flex items-center gap-2 bg-primary text-white text-sm font-medium px-5 py-3 rounded-full shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          문의하기
        </button>
      </div>
    </>
  );
}

// ─── 문의 작성 폼 ─────────────────────────────────────────────────────────────

function InquiryForm({ onSubmitSuccess }: { onSubmitSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<Category | ''>('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

      onSubmitSuccess();
    } catch {
      setErrorMsg('네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="px-4 py-6 space-y-6">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-text-primary">무엇이든 물어보세요</h2>
          <p className="text-xs text-text-secondary mt-0.5">문의 내용을 남겨주시면 검토 후 답변드려요.</p>
        </div>
      </div>

      {/* 카테고리 */}
      <section className="space-y-2">
        <label className="text-sm font-medium text-text-primary px-1">
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
        <label className="text-sm font-medium text-text-primary px-1">제목 (선택)</label>
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
        <label className="text-sm font-medium text-text-primary px-1">
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
        className="w-full h-12"
      >
        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '문의 접수하기'}
      </Button>
    </main>
  );
}

// ─── 티켓 상세 뷰 ─────────────────────────────────────────────────────────────

function TicketDetail({ ticket }: { ticket: Ticket }) {
  const status = STATUS_META[ticket.status] ?? STATUS_META.open;

  return (
    <main className="px-4 py-6 space-y-5">
      {/* 메타 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-text-tertiary bg-neutral-bg px-2 py-0.5 rounded-full">
            {CATEGORY_LABEL[ticket.category] ?? ticket.category}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
            {status.label}
          </span>
        </div>
        {ticket.title && (
          <h2 className="text-base font-semibold text-text-primary leading-snug">{ticket.title}</h2>
        )}
        <p className="text-xs text-text-tertiary">{formatDate(ticket.created_at)}</p>
      </div>

      <div className="border-t border-border-subtle" />

      {/* 문의 내용 */}
      <section className="space-y-2">
        <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">문의 내용</p>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{ticket.body}</p>
      </section>

      {/* 첨부 이미지 */}
      {ticket.attachments && ticket.attachments.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">첨부 이미지</p>
          <div className="flex gap-2 flex-wrap">
            {ticket.attachments.map((url, idx) => (
              <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`첨부 ${idx + 1}`}
                  className="w-20 h-20 rounded-xl object-cover border border-border-subtle"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* 관리자 답변 */}
      {ticket.admin_note ? (
        <section className="space-y-2">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">관리자 답변</p>
          <div className="border-l-2 border-primary bg-primary/5 rounded-r-xl px-4 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">마미스캔 고객센터</span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {ticket.admin_note}
            </p>
          </div>
        </section>
      ) : (
        <section>
          <div className="flex items-center gap-2 px-4 py-3 bg-neutral-bg rounded-xl">
            <Loader2 className="w-4 h-4 text-text-tertiary" />
            <p className="text-sm text-text-secondary">답변을 준비 중이에요. 빠른 시일 내에 답변드릴게요.</p>
          </div>
        </section>
      )}
    </main>
  );
}
