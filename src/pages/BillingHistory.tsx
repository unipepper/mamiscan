import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Receipt, PlusCircle, MinusCircle, Gift, AlertCircle, X } from "lucide-react";
import { useAuth } from "@/src/lib/AuthContext";
import { Button } from "@/src/components/ui/button";

interface Transaction {
  id: number;
  type: 'purchase' | 'usage' | 'bonus';
  amount: number;
  price_krw: number;
  description: string;
  created_at: string;
  status: 'completed' | 'refunded' | 'refund_pending' | 'refund_rejected';
  hasUsage?: boolean;
}

export function BillingHistory() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Refund Modal State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refundReason, setRefundReason] = useState<'simple' | 'duplicate' | 'error'>('simple');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundMessage, setRefundMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/user/transactions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    fetchTransactions();
  }, [user, navigate]);

  const handleRefundClick = (tx: Transaction) => {
    setSelectedTx(tx);
    setRefundReason('simple');
    setRefundMessage(null);
    setIsRefundModalOpen(true);
  };

  const handleRefundSubmit = async () => {
    if (!selectedTx) return;
    
    setIsRefunding(true);
    setRefundMessage(null);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/user/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: selectedTx.id,
          reason: refundReason
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setRefundMessage({ type: 'success', text: data.message });
        if (data.user) {
          updateUser(data.user);
        }
        // Refresh transactions
        fetchTransactions();
        
        // Close modal after 2 seconds on success
        setTimeout(() => {
          setIsRefundModalOpen(false);
          setSelectedTx(null);
        }, 2000);
      } else {
        setRefundMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setRefundMessage({ type: 'error', text: "환불 처리 중 오류가 발생했습니다." });
    } finally {
      setIsRefunding(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <Receipt className="w-5 h-5 text-primary" />;
      case 'usage':
        return <MinusCircle className="w-5 h-5 text-secondary" />;
      case 'bonus':
        return <Gift className="w-5 h-5 text-green-500" />;
      default:
        return <Receipt className="w-5 h-5 text-gray-500" />;
    }
  };

  const getAmountDisplay = (transaction: Transaction) => {
    if (transaction.type === 'usage') {
      return transaction.amount === 0 ? '무제한' : `${transaction.amount}회`;
    }
    return transaction.amount === 0 ? '무제한' : `+${transaction.amount}회`;
  };

  const getAmountColor = (type: string, status: string) => {
    if (status === 'refunded') return 'text-text-disabled line-through';
    switch (type) {
      case 'purchase':
      case 'bonus':
        return 'text-primary';
      case 'usage':
        return 'text-secondary';
      default:
        return 'text-text-primary';
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas min-h-screen relative">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-primary">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-medium ml-2 text-text-primary">이용권 구매/사용 내역</span>
      </header>

      <main className="px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20">
            <Receipt className="w-12 h-12 text-border-subtle mx-auto mb-4" />
            <p className="text-text-secondary font-medium">이용 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-bg-canvas p-2 rounded-full">
                      {getIcon(tx.type)}
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${tx.status === 'refunded' ? 'text-text-disabled line-through' : 'text-text-primary'}`}>
                        {tx.description}
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        {new Date(tx.created_at).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className={`font-bold ${getAmountColor(tx.type, tx.status)}`}>
                    {getAmountDisplay(tx)}
                  </div>
                </div>
                
                {/* Refund Status / Button */}
                {tx.type === 'purchase' && (
                  <div className="mt-4 pt-3 border-t border-border-subtle flex justify-end items-center">
                    {tx.status === 'refunded' ? (
                      <span className="text-xs font-bold text-danger-fg bg-danger-bg px-2 py-1 rounded-md">환불 완료</span>
                    ) : tx.status === 'refund_pending' ? (
                      <span className="text-xs font-bold text-caution-fg bg-caution-bg px-2 py-1 rounded-md">환불 검토 중</span>
                    ) : tx.status === 'refund_rejected' ? (
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-text-secondary bg-neutral-bg px-2 py-1 rounded-md mb-1">환불 거절</span>
                        <span className="text-[10px] text-text-tertiary">사유: PG사 승인 거절 (카드 한도 초과 등)</span>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleRefundClick(tx)}
                        className="text-xs font-medium text-text-secondary hover:text-text-primary underline underline-offset-2"
                      >
                        환불 요청
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Refund Modal */}
      {isRefundModalOpen && selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <h3 className="font-bold text-lg text-text-primary">결제 취소 / 환불</h3>
              <button 
                onClick={() => setIsRefundModalOpen(false)}
                className="p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-bg-canvas transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-5">
              <div className="bg-bg-canvas rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-secondary">상품명</span>
                  <span className="text-sm font-bold text-text-primary">{selectedTx.description}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-secondary">결제 금액</span>
                  <span className="text-sm font-medium text-text-primary">{(selectedTx.price_krw || 0).toLocaleString()}원</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border-subtle">
                  <span className="text-xs font-bold text-text-primary">환불 예정 금액</span>
                  <span className="text-sm font-bold text-primary">{(selectedTx.price_krw || 0).toLocaleString()}원</span>
                </div>
              </div>

              {selectedTx.hasUsage ? (
                <div className="bg-danger-bg/50 rounded-xl p-4 border border-danger-bg">
                  <p className="text-sm font-bold text-danger-fg mb-1">환불 불가</p>
                  <p className="text-xs text-danger-fg/80">이용권을 1회 이상 사용했거나, 이용이 시작된 이후에는 환불이 불가합니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-text-primary">환불 사유를 선택해주세요</p>
                  
                  <label className="flex items-start space-x-3 p-3 border border-border-subtle rounded-xl cursor-pointer hover:bg-bg-canvas transition-colors">
                    <input 
                      type="radio" 
                      name="refundReason" 
                      value="simple" 
                      checked={refundReason === 'simple'} 
                      onChange={() => setRefundReason('simple')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-text-primary">단순 변심 / 결제 취소</p>
                      <p className="text-xs text-text-secondary mt-1">첫 사용 전, 유효기간 시작 전인 경우 즉시 전액 환불됩니다.</p>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 p-3 border border-border-subtle rounded-xl cursor-pointer hover:bg-bg-canvas transition-colors">
                    <input 
                      type="radio" 
                      name="refundReason" 
                      value="duplicate" 
                      checked={refundReason === 'duplicate'} 
                      onChange={() => setRefundReason('duplicate')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-text-primary">중복 결제 / 장애 결제</p>
                      <p className="text-xs text-text-secondary mt-1">운영자 확인 후 전액 환불 처리됩니다. (영업일 기준 1~2일 소요)</p>
                    </div>
                  </label>
                </div>
              )}

              <div className="bg-neutral-bg rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
                <div className="text-xs text-text-secondary leading-relaxed">
                  <p>• 카드결제 건에 한해 환불을 지원합니다.</p>
                  <p>• 이용권은 사용 이력이 없는 경우에만 전액 환불할 수 있습니다.</p>
                  <p>• 이용권을 1회 이상 사용했거나, 이용이 시작된 이후에는 환불이 불가합니다.</p>
                </div>
              </div>

              {refundMessage && (
                <div className={`p-3 rounded-lg text-sm font-medium text-center ${
                  refundMessage.type === 'success' ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg'
                }`}>
                  {refundMessage.text}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border-subtle flex space-x-3 bg-bg-canvas">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl"
                onClick={() => setIsRefundModalOpen(false)}
                disabled={isRefunding || refundMessage?.type === 'success'}
              >
                닫기
              </Button>
              <Button 
                className="flex-1 rounded-xl font-bold"
                onClick={handleRefundSubmit}
                disabled={isRefunding || refundMessage?.type === 'success' || selectedTx.hasUsage}
              >
                {isRefunding ? '처리 중...' : '환불 요청하기'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
