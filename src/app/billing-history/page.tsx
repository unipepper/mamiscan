'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Receipt, MinusCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Entitlement {
  id: string;
  type: 'scan5' | 'monthly' | 'trial' | 'admin';
  status: 'pending' | 'active' | 'expired';
  scan_count: number | null;
  started_at: string | null;
  expires_at: string;
}

interface Transaction {
  id: string;
  type: 'purchase' | 'trial';
  price_krw: number;
  description: string;
  created_at: string;
  status: 'completed' | 'refunded' | 'refund_pending' | 'refund_rejected';
  entitlement: Entitlement | null;
}

interface ScanLog {
  id: string;
  type: string;
  count: number;
  entitlement_id: string;
  description: string;
  created_at: string;
}

interface ScanHistory {
  id: string;
  entitlement_id: string;
  product_name: string;
  status: string;
  created_at: string;
}

export default function BillingHistoryPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [scanHistories, setScanHistories] = useState<ScanHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string> | null>(new Set()); // empty Set = all collapsed
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refundReason, setRefundReason] = useState<'mind_change' | 'not_useful' | 'ux_issue' | 'scan_quality' | 'price' | 'other'>('mind_change');
  const [refundDetail, setRefundDetail] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundMessage, setRefundMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/user/transactions');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions);
        setScanLogs(data.scanLogs ?? []);
        setScanHistories(data.scanHistories ?? []);
      } else throw new Error('api error');
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
        body: JSON.stringify({ transactionId: selectedTx.id, reason: refundReason, detail: refundDetail.trim() || undefined }),
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

  // purchase_grant 로그에서 원래 지급 횟수 조회
  // migration으로 생성된 grant 로그가 count=0인 경우 대비: scan_use 수 + 잔여로 계산
  const getGrantCount = (ent: Entitlement): number => {
    const entId = String(ent.id);
    const grantLog = scanLogs.find(
      l => String(l.entitlement_id) === entId &&
           (l.type === 'purchase_grant' || l.type === 'trial_grant' || l.type === 'admin_grant')
    );
    if (grantLog && Math.abs(grantLog.count) > 0) return Math.abs(grantLog.count);
    // grant 로그가 없거나 0인 경우: 사용 로그 수 + 잔여로 역산
    const usedFromLogs = scanLogs.filter(
      l => String(l.entitlement_id) === entId && l.type === 'scan_use'
    ).length;
    const fromLogs = (ent.scan_count ?? 0) + usedFromLogs;
    if (fromLogs > 0) return fromLogs;
    // 최종 fallback: 이용권 타입 기본값 (migration 데이터 불일치 대비)
    if (ent.type === 'scan5') return 5;
    if (ent.type === 'trial') return 3;
    return 0;
  };

  // 이용권 타입별 지급 횟수 표시
  const getAmountDisplay = (tx: Transaction) => {
    if (!tx.entitlement) return '-';
    if (tx.entitlement.type === 'monthly') return '무제한';
    return `+${getGrantCount(tx.entitlement)}회`;
  };

  const getAmountColor = (status: string) => {
    if (status === 'refunded') return 'text-text-disabled line-through';
    return 'text-primary';
  };

  // 이 결제에 연결된 이용권의 scan_use 로그 (grant 횟수 역산용)
  const getScanLogsForTx = (tx: Transaction): ScanLog[] => {
    if (!tx.entitlement) return [];
    const entId = String(tx.entitlement.id);
    return scanLogs
      .filter(l => String(l.entitlement_id) === entId && l.type === 'scan_use')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // 이 결제에 연결된 이용권의 스캔 상품 내역 (product_name 있는 것)
  const getScanHistoriesForTx = (tx: Transaction): ScanHistory[] => {
    if (!tx.entitlement) return [];
    const entId = String(tx.entitlement.id);
    return scanHistories
      .filter(h => String(h.entitlement_id) === entId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const base = prev ?? new Set(transactions.map(t => t.id));
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas min-h-screen">
      <header className="safe-top sticky top-0 z-40 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <span className="font-medium ml-2 text-text-primary">스캔권 구매/사용 내역</span>
      </header>

      <main className="px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-20">
            <p className="text-text-secondary font-medium">내역을 불러오지 못했어요.</p>
            <Button variant="link" onClick={() => { setFetchError(false); setIsLoading(true); fetchTransactions(); }} className="mt-3 text-primary">
              다시 시도
            </Button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20">
            <Receipt className="w-12 h-12 text-border-subtle mx-auto mb-4" />
            <p className="text-text-secondary font-medium">이용 내역이 없어요.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 현재 이용권 요약 */}
            {(() => {
              const activeMonthly = transactions.find(tx => tx.entitlement?.type === 'monthly' && tx.entitlement?.status === 'active');
              const activeScanCount = transactions.reduce((sum, tx) => {
                const ent = tx.entitlement;
                if (ent && ['scan5', 'trial', 'admin'].includes(ent.type) && ent.status === 'active') {
                  return sum + (ent.scan_count ?? 0);
                }
                return sum;
              }, 0);
              const pendingScanCount = transactions.reduce((sum, tx) => {
                const ent = tx.entitlement;
                if (ent && ['scan5', 'trial', 'admin'].includes(ent.type) && ent.status === 'pending') {
                  return sum + (ent.scan_count ?? 0);
                }
                return sum;
              }, 0);
              const hasSummary = activeMonthly || activeScanCount > 0;
              if (!hasSummary) return null;
              return (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                  <p className="text-xs text-primary">현재 이용 중인 스캔권</p>
                  {activeMonthly && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-primary">무제한 스캔권</span>
                      <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">사용 중</span>
                    </div>
                  )}
                  {activeScanCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-primary">보유 중인 스캔권</span>
                      <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">{activeScanCount}회 사용 가능</span>
                    </div>
                  )}
                  {activeMonthly && pendingScanCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">대기 중인 스캔권</span>
                      <span className="text-xs font-medium text-text-secondary bg-neutral-bg px-2 py-0.5 rounded-full">무제한 만료 후 {pendingScanCount}회 사용 가능</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {transactions.map((tx) => {
              const ent = tx.entitlement;
              const isScanTx = ent?.type === 'scan5' || ent?.type === 'trial' || ent?.type === 'admin';
              const isMonthlyTx = ent?.type === 'monthly';
              const useLogs = getScanLogsForTx(tx);
              const scanHistoriesForTx = getScanHistoriesForTx(tx);
              const totalCount = isScanTx && ent ? getGrantCount(ent) : null;
              const usedCount = totalCount != null ? totalCount - (ent?.scan_count ?? 0) : 0;
              const isExpanded = expandedIds === null || expandedIds.has(tx.id);
              const isActiveEnt = ent?.status === 'active' && tx.status !== 'refunded' &&
                new Date(ent.expires_at) > new Date() &&
                (isMonthlyTx || (ent.scan_count ?? 0) > 0);

              return (
                <div key={tx.id} className={`border rounded-xl p-4 shadow-sm flex flex-col ${isActiveEnt ? 'bg-primary/5 border-primary/40' : 'bg-bg-surface border-border-subtle'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-bg-canvas p-2 rounded-full">
                        <Receipt className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${tx.status === 'refunded' ? 'text-text-disabled line-through' : 'text-text-primary'}`}>
                          {tx.description}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          {new Date(tx.created_at).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className={`font-semibold ${getAmountColor(tx.status)}`}>{getAmountDisplay(tx)}</div>
                  </div>

                  {/* 횟수권 사용 현황 — 닷 시각화 */}
                  {isScanTx && totalCount != null && ent && tx.status !== 'refunded' && (
                    <div className="mt-3 pt-3 border-t border-border-subtle">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-text-secondary">사용 현황</p>
                        {(() => {
                          const isExpired = new Date(ent.expires_at) < new Date();
                          const isDepleted = ent.scan_count === 0;
                          if (isDepleted) return <span className="text-xs px-2 py-0.5 rounded-full text-text-disabled bg-neutral-bg">소진</span>;
                          if (isExpired) return <span className="text-xs px-2 py-0.5 rounded-full text-danger-fg bg-danger-bg">만료</span>;
                          if (ent.status === 'pending') return <span className="text-xs px-2 py-0.5 rounded-full text-caution bg-caution/10">대기 중</span>;
                          return <span className="text-xs px-2 py-0.5 rounded-full text-primary bg-primary/10">이용 중</span>;
                        })()}
                      </div>
                      <div className="flex gap-2 mb-2">
                        {Array.from({ length: totalCount }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-4 h-4 rounded-full border-2 transition-all ${
                              i < usedCount
                                ? 'bg-primary border-primary'
                                : 'bg-transparent border-border-subtle'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-text-secondary">사용 <strong className="text-text-primary">{usedCount}회</strong></span>
                        <span className="text-text-secondary">잔여 <strong className={ent.scan_count === 0 ? 'text-danger-fg' : 'text-primary'}>{ent.scan_count}회</strong></span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary">이용 기한</span>
                        <span className={new Date(ent.expires_at) < new Date() ? 'text-danger-fg font-medium' : 'text-text-primary'}>
                          {new Date(ent.expires_at) < new Date()
                            ? `${new Date(ent.expires_at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (만료)`
                            : `${new Date(ent.expires_at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}까지`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 무제한 이용권 상태 */}
                  {isMonthlyTx && ent && tx.status !== 'refunded' && (() => {
                    const statusLabel = ent.status === 'active' ? '이용 중' : ent.status === 'pending' ? '미사용' : '만료';
                    const statusColor = ent.status === 'active' ? 'text-primary bg-primary/10' : ent.status === 'pending' ? 'text-caution bg-caution/10' : 'text-text-disabled bg-neutral-bg';
                    const fmtDate = (d: string) => new Date(d).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const startedAt = ent.started_at ?? (ent.status !== 'pending' ? tx.created_at : null);
                    return (
                      <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-secondary">스캔권 상태</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-secondary">이용 기간</span>
                          <span className="text-xs text-text-primary">
                            {ent.status === 'pending'
                              ? '첫 스캔 시 30일'
                              : startedAt
                                ? `${fmtDate(startedAt)} ~ ${fmtDate(ent.expires_at)}`
                                : fmtDate(ent.expires_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 스캔 사용 내역 */}
                  {(isScanTx || isMonthlyTx) && ent && tx.status !== 'refunded' && scanHistoriesForTx.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border-subtle">
                      <Button
                        variant="ghost"
                        onClick={() => toggleExpanded(tx.id)}
                        className="w-full justify-between h-auto text-xs text-text-secondary mb-2 px-0"
                      >
                        <span className="font-medium">스캔 사용 내역</span>
                        <span>{isExpanded ? '▲ 접기' : '▼ 펼치기'}</span>
                      </Button>
                      {isExpanded && (
                        <div className="space-y-1.5">
                          {scanHistoriesForTx.map((h) => (
                            <div key={h.id} className="flex items-center justify-between py-1.5 px-2.5 bg-bg-canvas rounded-lg">
                              <div className="flex items-center space-x-2">
                                <MinusCircle className="w-3.5 h-3.5 text-secondary shrink-0" />
                                <span className="text-xs text-text-primary">{h.product_name}</span>
                              </div>
                              <span className="text-xs text-text-secondary shrink-0 ml-2">
                                {new Date(h.created_at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 환불 버튼 (무료 지급 항목은 환불 대상 아님) */}
                  {tx.type !== 'trial' && tx.price_krw > 0 && (
                    <div className="mt-3 pt-3 border-t border-border-subtle flex justify-end items-center">
                      {tx.status === 'refunded' ? (
                        <span className="text-xs text-danger-fg bg-danger-bg px-2 py-1 rounded-md">환불 완료</span>
                      ) : tx.status === 'refund_pending' ? (
                        <span className="text-xs text-caution-fg bg-caution-bg px-2 py-1 rounded-md">환불 검토 중</span>
                      ) : tx.status === 'refund_rejected' ? (
                        <span className="text-xs text-text-secondary bg-neutral-bg px-2 py-1 rounded-md">환불 거절</span>
                      ) : usedCount > 0 || (isMonthlyTx && ent?.status !== 'pending') ? (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-neutral-bg px-3 py-1.5 rounded-lg">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>1회 이상 사용한 스캔권은 환불이 불가해요</span>
                        </div>
                      ) : (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => { setSelectedTx(tx); setRefundReason('mind_change'); setRefundDetail(''); setRefundMessage(null); setIsRefundModalOpen(true); }}
                        >
                          환불 요청
                        </Button>
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
              <h3 className="text-lg font-semibold text-text-primary">환불 신청</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsRefundModalOpen(false)} className="h-8 w-8">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-5 space-y-5">
              <div className="bg-bg-canvas rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-text-secondary">상품명</span>
                  <span className="text-sm text-text-primary">{selectedTx.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-text-secondary">결제 금액</span>
                  <span className="text-sm font-medium">{(selectedTx.price_krw || 0).toLocaleString()}원</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border-subtle">
                  <span className="text-xs text-text-primary">환불 예정 금액</span>
                  <span className="text-sm text-primary">{(selectedTx.price_krw || 0).toLocaleString()}원</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-text-primary">환불 사유를 선택해주세요</p>
                {([
                  { value: 'mind_change',  label: '단순 변심',            subs: null },
                  { value: 'not_useful',   label: '기능 불일치',      subs: [
                    { value: 'db_coverage',      label: '스캔 가능한 제품이 너무 적어요' },
                    { value: 'analysis_shallow', label: '성분 분석 내용이 너무 단순해요' },
                    { value: 'no_personalization', label: '아이 월령/나이에 맞는 정보가 없어요' },
                    { value: 'allergy_lacking',  label: '알레르기 정보가 부족해요' },
                    { value: 'competitor_has_it', label: '비슷한 앱에서 이미 제공하는 기능이에요' },
                  ]},
                  { value: 'ux_issue',     label: '이용 불편',          subs: [
                    { value: 'scan_fails',   label: '바코드 스캔이 잘 안 돼요' },
                    { value: 'ui_complex',   label: '화면 구성이 복잡해요' },
                    { value: 'hard_to_find', label: '원하는 정보를 찾기 어려워요' },
                    { value: 'app_slow',     label: '앱이 느리거나 자주 멈춰요' },
                  ]},
                  { value: 'scan_quality', label: '스캔 결과 불만족', subs: null },
                  { value: 'price',        label: '가격 부담',       subs: null },
                  { value: 'other',        label: '기타',                        subs: null },
                ] as const).map(({ value, label, subs }) => (
                  <div key={value}>
                    <label className="flex items-center space-x-3 p-3 border border-border-subtle rounded-xl cursor-pointer hover:bg-bg-canvas transition-colors">
                      <input type="radio" name="refundReason" value={value} checked={refundReason === value} onChange={() => { setRefundReason(value as 'mind_change' | 'not_useful' | 'ux_issue' | 'scan_quality' | 'price' | 'other'); setRefundDetail(''); }} />
                      <p className="text-sm font-medium text-text-primary">{label}</p>
                    </label>
                    {refundReason === value && subs && (
                      <div className="mt-2 ml-4 space-y-2">
                        <p className="text-xs text-text-secondary">어떤 점이 아쉬우셨나요? <span className="text-text-disabled">(선택사항)</span></p>
                        {subs.map(sub => (
                          <label key={sub.value} className="flex items-center space-x-2.5 px-3 py-2.5 border border-border-subtle rounded-lg cursor-pointer hover:bg-bg-canvas transition-colors">
                            <input type="radio" name="refundDetail" value={sub.value} checked={refundDetail === sub.value} onChange={() => setRefundDetail(sub.value)} />
                            <p className="text-sm text-text-primary">{sub.label}</p>
                          </label>
                        ))}
                      </div>
                    )}
                    {refundReason === value && value === 'other' && (
                      <textarea
                        value={refundDetail}
                        onChange={e => setRefundDetail(e.target.value)}
                        placeholder="어떤 점이 아쉬우셨나요? (선택사항)"
                        maxLength={300}
                        rows={3}
                        className="mt-2 w-full text-sm text-text-primary placeholder:text-text-secondary bg-bg-canvas border border-border-subtle rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-primary"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="bg-neutral-bg rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary leading-relaxed">스캔권을 1회 이상 사용했거나 이용이 시작된 이후에는 환불이 불가합니다.</p>
              </div>
              {refundMessage && (
                <div className={`p-3 rounded-lg text-sm font-medium text-center ${refundMessage.type === 'success' ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg'}`}>
                  {refundMessage.text}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border-subtle flex space-x-3 bg-bg-canvas">
              <Button variant="outline" className="flex-1" onClick={() => setIsRefundModalOpen(false)} disabled={isRefunding}>닫기</Button>
              <Button className="flex-1" onClick={handleRefundSubmit} disabled={isRefunding || refundMessage?.type === 'success'}>
                {isRefunding ? '처리 중...' : '환불 요청하기'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
