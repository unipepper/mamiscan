'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Receipt, MinusCircle, Gift, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Lot {
  count: number;
  expires_at: string;
}

interface Transaction {
  id: string;
  type: 'purchase' | 'deduct' | 'trial';
  amount: number;
  count: number | null;
  price_krw: number;
  description: string;
  created_at: string;
  status: 'completed' | 'refunded' | 'refund_pending' | 'refund_rejected';
  lot: Lot | null;
}

export default function BillingHistoryPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [expandedDeducts, setExpandedDeducts] = useState<Set<string> | null>(null); // null = all expanded
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refundReason, setRefundReason] = useState<'simple' | 'duplicate'>('simple');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundMessage, setRefundMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/user/transactions');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      if (data.success) setTransactions(data.transactions);
      else throw new Error('api error');
    } catch {
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleRefundSubmit = async () => {
    if (!selectedTx) return;
    setIsRefunding(true);
    setRefundMessage(null);
    try {
      const res = await fetch('/api/user/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: selectedTx.id, reason: refundReason }),
      });
      const data = await res.json();
      if (data.success) {
        setRefundMessage({ type: 'success', text: data.message });
        fetchTransactions();
        setTimeout(() => { setIsRefundModalOpen(false); setSelectedTx(null); }, 2000);
      } else {
        setRefundMessage({ type: 'error', text: data.message });
      }
    } catch {
      setRefundMessage({ type: 'error', text: '환불 처리 중 오류가 발생했습니다.' });
    } finally {
      setIsRefunding(false);
    }
  };

  const getIcon = (type: string) => {
    if (type === 'deduct') return <MinusCircle className="w-5 h-5 text-secondary" />;
    if (type === 'bonus') return <Gift className="w-5 h-5 text-green-500" />;
    return <Receipt className="w-5 h-5 text-primary" />;
  };

  const getAmountDisplay = (tx: Transaction) => {
    if (tx.type === 'deduct') return tx.count != null ? `-${Math.abs(tx.count)}회` : '-1회';
    if (tx.count != null) return `+${tx.count}회`;
    // count 없는 레거시 데이터: description에서 파싱
    if (tx.description?.includes('무제한')) return '무제한';
    const match = tx.description?.match(/(\d+)회/);
    return match ? `+${match[1]}회` : '-';
  };

  const getAmountColor = (type: string, status: string) => {
    if (status === 'refunded') return 'text-text-disabled line-through';
    if (type === 'purchase' || type === 'bonus') return 'text-primary';
    if (type === 'deduct') return 'text-secondary';
    return 'text-text-primary';
  };

  // 구매 트랜잭션별 연관 차감 내역: 구매 순서 기준 chronological 그룹핑
  const getDeductsForPurchase = (tx: Transaction) => {
    const purchases = [...transactions]
      .filter(t => t.type === 'purchase')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const idx = purchases.findIndex(p => p.id === tx.id);
    const from = new Date(tx.created_at).getTime();
    const to = purchases[idx + 1] ? new Date(purchases[idx + 1].created_at).getTime() : Infinity;
    return transactions
      .filter(t => t.type === 'deduct' && new Date(t.created_at).getTime() >= from && new Date(t.created_at).getTime() < to)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const toggleDeducts = (id: string) => {
    setExpandedDeducts(prev => {
      // null = all expanded → 첫 toggle 시 현재 모든 purchase ID를 Set으로 초기화
      const base = prev ?? new Set(transactions.filter(t => t.type === 'purchase').map(t => t.id));
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas min-h-screen">
      <header className="sticky top-0 z-40 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-text-primary">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-medium ml-2 text-text-primary">이용권 구매/사용 내역</span>
      </header>

      <main className="px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-20">
            <p className="text-text-secondary font-medium">내역을 불러오지 못했어요.</p>
            <button onClick={() => { setFetchError(false); setIsLoading(true); fetchTransactions(); }} className="mt-3 text-sm text-primary underline underline-offset-2">
              다시 시도
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20">
            <Receipt className="w-12 h-12 text-border-subtle mx-auto mb-4" />
            <p className="text-text-secondary font-medium">이용 내역이 없어요.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.filter(tx => tx.type !== 'deduct').map((tx) => {
              const deducts = tx.type === 'purchase' ? getDeductsForPurchase(tx) : [];
              const isExpanded = expandedDeducts === null || expandedDeducts.has(tx.id);
              const usedCount = tx.count != null && tx.lot != null ? tx.count - tx.lot.count : null;
              return (
                <div key={tx.id} className="bg-bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-bg-canvas p-2 rounded-full">{getIcon(tx.type)}</div>
                      <div>
                        <p className={`font-bold text-sm ${tx.status === 'refunded' ? 'text-text-disabled line-through' : 'text-text-primary'}`}>
                          {tx.description}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          {new Date(tx.created_at).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className={`font-bold ${getAmountColor(tx.type, tx.status)}`}>{getAmountDisplay(tx)}</div>
                  </div>

                  {/* 사용 현황 — 닷 시각화 */}
                  {tx.type === 'purchase' && tx.count != null && tx.lot && tx.status !== 'refunded' && (
                    <div className="mt-3 pt-3 border-t border-border-subtle">
                      <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
                        <span>사용 현황</span>
                        <span>{new Date(tx.lot.expires_at) < new Date() ? '만료' : `${new Date(tx.lot.expires_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 만료`}</span>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {Array.from({ length: tx.count }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-4 h-4 rounded-full border-2 transition-all ${
                              i < (usedCount ?? 0)
                                ? 'bg-primary border-primary'
                                : 'bg-transparent border-border-subtle'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">사용 <strong className="text-text-primary">{usedCount}회</strong></span>
                        <span className="text-text-secondary">잔여 <strong className={tx.lot.count === 0 ? 'text-danger-fg' : 'text-primary'}>{tx.lot.count}회</strong></span>
                      </div>
                    </div>
                  )}

                  {/* 스캔 사용 내역 — deduct 트랜잭션이 있을 때만 표시 */}
                  {tx.type === 'purchase' && tx.count != null && tx.lot && tx.status !== 'refunded' && deducts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border-subtle">
                      <button
                        onClick={() => toggleDeducts(tx.id)}
                        className="flex items-center justify-between w-full text-xs text-text-secondary mb-2"
                      >
                        <span className="font-medium">스캔 사용 내역</span>
                        <span>{isExpanded ? '▲ 접기' : '▼ 펼치기'}</span>
                      </button>
                      {isExpanded && (
                        <div className="space-y-1.5">
                          {deducts.map((d) => (
                            <div key={d.id} className="flex items-center justify-between py-1.5 px-2.5 bg-bg-canvas rounded-lg">
                              <div className="flex items-center space-x-2">
                                <MinusCircle className="w-3.5 h-3.5 text-secondary shrink-0" />
                                <span className="text-xs text-text-primary">{d.description}</span>
                              </div>
                              <span className="text-xs text-text-secondary">
                                {new Date(d.created_at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 환불 버튼 */}
                  {tx.type === 'purchase' && (
                    <div className="mt-3 pt-3 border-t border-border-subtle flex justify-end items-center">
                      {tx.status === 'refunded' ? (
                        <span className="text-xs font-bold text-danger-fg bg-danger-bg px-2 py-1 rounded-md">환불 완료</span>
                      ) : tx.status === 'refund_pending' ? (
                        <span className="text-xs font-bold text-caution-fg bg-caution-bg px-2 py-1 rounded-md">환불 검토 중</span>
                      ) : tx.status === 'refund_rejected' ? (
                        <span className="text-xs font-bold text-text-secondary bg-neutral-bg px-2 py-1 rounded-md">환불 거절</span>
                      ) : (usedCount ?? 0) > 0 ? (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-neutral-bg px-3 py-1.5 rounded-lg">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>1회 이상 사용한 이용권은 환불이 불가해요</span>
                        </div>
                      ) : (
                        <button onClick={() => { setSelectedTx(tx); setRefundReason('simple'); setRefundMessage(null); setIsRefundModalOpen(true); }} className="text-xs font-medium text-text-secondary hover:text-text-primary underline underline-offset-2">
                          환불 요청
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Refund Modal */}
      {isRefundModalOpen && selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <h3 className="font-bold text-lg text-text-primary">결제 취소 / 환불</h3>
              <button onClick={() => setIsRefundModalOpen(false)} className="p-1 text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="bg-bg-canvas rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-text-secondary">상품명</span>
                  <span className="text-sm font-bold text-text-primary">{selectedTx.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-text-secondary">결제 금액</span>
                  <span className="text-sm font-medium">{(selectedTx.price_krw || 0).toLocaleString()}원</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border-subtle">
                  <span className="text-xs font-bold text-text-primary">환불 예정 금액</span>
                  <span className="text-sm font-bold text-primary">{(selectedTx.price_krw || 0).toLocaleString()}원</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-bold text-text-primary">환불 사유를 선택해주세요</p>
                {[
                  { value: 'simple', label: '단순 변심 / 결제 취소', desc: '첫 사용 전인 경우 즉시 전액 환불됩니다.' },
                  { value: 'duplicate', label: '중복 결제 / 장애 결제', desc: '운영자 확인 후 전액 환불됩니다. (1~2일 소요)' },
                ].map(({ value, label, desc }) => (
                  <label key={value} className="flex items-start space-x-3 p-3 border border-border-subtle rounded-xl cursor-pointer hover:bg-bg-canvas transition-colors">
                    <input type="radio" name="refundReason" value={value} checked={refundReason === value} onChange={() => setRefundReason(value as any)} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{label}</p>
                      <p className="text-xs text-text-secondary mt-1">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="bg-neutral-bg rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary leading-relaxed">이용권을 1회 이상 사용했거나 이용이 시작된 이후에는 환불이 불가합니다.</p>
              </div>
              {refundMessage && (
                <div className={`p-3 rounded-lg text-sm font-medium text-center ${refundMessage.type === 'success' ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg'}`}>
                  {refundMessage.text}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border-subtle flex space-x-3 bg-bg-canvas">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsRefundModalOpen(false)} disabled={isRefunding}>닫기</Button>
              <Button className="flex-1 rounded-xl font-bold" onClick={handleRefundSubmit} disabled={isRefunding || refundMessage?.type === 'success'}>
                {isRefunding ? '처리 중...' : '환불 요청하기'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
