import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Receipt, PlusCircle, MinusCircle, Gift } from "lucide-react";
import { useAuth } from "@/src/lib/AuthContext";

interface Transaction {
  id: number;
  type: 'purchase' | 'usage' | 'bonus';
  amount: number;
  description: string;
  created_at: string;
}

export function BillingHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

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

    fetchTransactions();
  }, [user, navigate]);

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

  const getAmountColor = (type: string) => {
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
    <div className="flex flex-col flex-1 bg-bg-canvas min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-canvas/80 backdrop-blur-md border-b border-border-subtle">
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
              <div key={tx.id} className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="bg-bg-canvas p-2 rounded-full">
                    {getIcon(tx.type)}
                  </div>
                  <div>
                    <p className="font-bold text-text-primary text-sm">{tx.description}</p>
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
                <div className={`font-bold ${getAmountColor(tx.type)}`}>
                  {getAmountDisplay(tx)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
