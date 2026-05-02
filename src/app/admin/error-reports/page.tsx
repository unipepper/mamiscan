'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle, Clock, XCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ReportItem = {
  id: number;
  body: string;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  ai_confidence: 'high' | 'medium' | 'low' | 'unclear' | null;
  correction_type: string | null;
  ai_analyzed_at: string | null;
  created_at: string;
  scan_history: {
    product_name: string;
    status: string;
  } | null;
};

const CONFIDENCE_LABEL: Record<string, { label: string; color: string }> = {
  high:    { label: '확실', color: 'bg-green-100 text-green-800' },
  medium:  { label: '보통', color: 'bg-yellow-100 text-yellow-800' },
  low:     { label: '낮음', color: 'bg-gray-100 text-gray-600' },
  unclear: { label: '불명확', color: 'bg-gray-100 text-gray-400' },
};

const CORRECTION_LABEL: Record<string, string> = {
  status_change:          '판정 오류',
  ingredient_correction:  '성분 오류',
  product_name:           '제품명 오류',
  unverifiable:           '검증 불가',
  user_error:             '유저 오해',
};

const STATUS_ICON = {
  open:        <Clock className="w-4 h-4 text-blue-500" />,
  in_progress: <RefreshCw className="w-4 h-4 text-yellow-500" />,
  resolved:    <CheckCircle className="w-4 h-4 text-green-500" />,
  dismissed:   <XCircle className="w-4 h-4 text-gray-400" />,
};

export default function ErrorReportsPage() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [correctionFilter, setCorrectionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 어드민 시크릿은 sessionStorage에 보관 (탭 닫으면 소멸)
  useEffect(() => {
    const saved = sessionStorage.getItem('admin_secret');
    if (saved) setSecret(saved);
  }, []);

  const fetchReports = useCallback(async (adminSecret: string, p: number, status: string, correction: string) => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (status) params.set('status', status);
      if (correction) params.set('correction_type', correction);

      const res = await fetch(`/api/admin/error-reports?${params}`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (res.status === 403) {
        setSecret('');
        sessionStorage.removeItem('admin_secret');
        setError('시크릿이 올바르지 않습니다.');
        return;
      }
      const json = await res.json();
      setReports(json.data ?? []);
      setTotal(json.pagination?.total ?? 0);
      setTotalPages(json.pagination?.totalPages ?? 1);
    } catch {
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (secret) {
      fetchReports(secret, page, statusFilter, correctionFilter);
    }
  }, [secret, page, statusFilter, correctionFilter, fetchReports]);

  if (!secret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
          <h1 className="text-lg font-bold mb-4">어드민 인증</h1>
          <input
            type="password"
            placeholder="Admin Secret"
            value={secretInput}
            onChange={e => setSecretInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                sessionStorage.setItem('admin_secret', secretInput);
                setSecret(secretInput);
              }
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
          <Button
            onClick={() => {
              sessionStorage.setItem('admin_secret', secretInput);
              setSecret(secretInput);
            }}
            className="w-full"
          >
            확인
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">오류 제보 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">총 {total}건</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchReports(secret, page, statusFilter, correctionFilter)} className="gap-1.5 text-text-secondary">
            <RefreshCw className="w-4 h-4" />
            새로고침
          </Button>
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
          >
            <option value="">전체 상태</option>
            <option value="open">미처리</option>
            <option value="in_progress">처리 중</option>
            <option value="resolved">해결됨</option>
            <option value="dismissed">무시됨</option>
          </select>
          <select
            value={correctionFilter}
            onChange={e => { setCorrectionFilter(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
          >
            <option value="">전체 유형</option>
            <option value="status_change">판정 오류</option>
            <option value="ingredient_correction">성분 오류</option>
            <option value="product_name">제품명 오류</option>
            <option value="unverifiable">검증 불가</option>
            <option value="user_error">유저 오해</option>
          </select>
        </div>

        {/* 오류 */}
        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
        )}

        {/* 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400 text-sm">불러오는 중...</div>
          ) : reports.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">제보가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {reports.map(r => {
                const conf = r.ai_confidence ? CONFIDENCE_LABEL[r.ai_confidence] : null;
                const corrLabel = r.correction_type ? CORRECTION_LABEL[r.correction_type] : null;
                const scanStatus = r.scan_history?.status;

                return (
                  <li key={r.id}>
                    <Button
                      variant="ghost"
                      onClick={() => router.push(`/admin/error-reports/${r.id}`)}
                      className="w-full justify-start gap-4 px-5 py-4 h-auto text-left rounded-none"
                    >
                      {/* 상태 아이콘 */}
                      <span className="shrink-0">
                        {STATUS_ICON[r.status] ?? <AlertTriangle className="w-4 h-4 text-gray-400" />}
                      </span>

                      {/* 제보 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {r.scan_history?.product_name ?? '제품 정보 없음'}
                          </span>
                          {scanStatus && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              scanStatus === 'success' ? 'bg-green-100 text-green-700' :
                              scanStatus === 'caution'  ? 'bg-yellow-100 text-yellow-700' :
                              scanStatus === 'danger'   ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {scanStatus === 'success' ? '안전' : scanStatus === 'caution' ? '주의' : scanStatus === 'danger' ? '위험' : scanStatus}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{r.body}</p>
                      </div>

                      {/* 배지들 */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!r.ai_analyzed_at && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">분석 중</span>
                        )}
                        {conf && (
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${conf.color}`}>
                            {conf.label}
                          </span>
                        )}
                        {corrLabel && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {corrLabel}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(r.created_at).toLocaleDateString('ko-KR')}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              이전
            </Button>
            <span className="px-3 py-1.5 text-sm text-text-secondary">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              다음
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
