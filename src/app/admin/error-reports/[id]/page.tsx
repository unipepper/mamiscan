'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CheckCircle, XCircle, Edit2, Save, X, Sparkles, RefreshCw } from 'lucide-react';

type Ingredient = { name: string; status: string; reason: string };

type AiAnalysis = {
  diagnosis: string;
  evidence: string;
  suggested_changes: {
    status?: string;
    headline?: string;
    description?: string;
    ingredients?: Ingredient[];
  } | null;
};

type ScanHistory = {
  id: number;
  product_name: string;
  status: string;
  result_json: Record<string, unknown>;
  image_url: string | null;
  created_at: string;
};

type Report = {
  id: number;
  body: string;
  status: string;
  admin_note: string | null;
  attachments: string[] | null;
  ai_analysis: AiAnalysis | null;
  ai_confidence: string | null;
  correction_type: string | null;
  ai_analyzed_at: string | null;
  created_at: string;
  scan_history: ScanHistory | null;
};

type ProductCache = {
  cache_key: string;
  status: string;
  result_json: Record<string, unknown>;
  barcode: string | null;
  hit_count: number;
} | null;

const CONFIDENCE_COLOR: Record<string, string> = {
  high:    'text-green-700 bg-green-50 border-green-200',
  medium:  'text-yellow-700 bg-yellow-50 border-yellow-200',
  low:     'text-gray-600 bg-gray-50 border-gray-200',
  unclear: 'text-gray-400 bg-gray-50 border-gray-200',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: '신뢰도 높음', medium: '신뢰도 보통', low: '신뢰도 낮음', unclear: '판단 불가',
};

const STATUS_KR: Record<string, string> = {
  success: '안전', caution: '주의', danger: '위험',
};

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'success' ? 'bg-green-100 text-green-800'
    : status === 'caution' ? 'bg-yellow-100 text-yellow-800'
    : status === 'danger'  ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${cls}`}>
      {STATUS_KR[status] ?? status}
    </span>
  );
}

function IngredientList({ ingredients }: { ingredients: Ingredient[] }) {
  return (
    <ul className="space-y-1.5 mt-2">
      {ingredients.map((ing, i) => (
        <li key={i} className="text-xs bg-gray-50 rounded px-3 py-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={ing.status} />
            <span className="font-medium text-gray-800">{ing.name}</span>
          </div>
          <p className="text-gray-500 mt-1">{ing.reason}</p>
        </li>
      ))}
    </ul>
  );
}

export default function ErrorReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [secret, setSecret] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [productCache, setProductCache] = useState<ProductCache>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [isApplying, setIsApplying] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isRequestingAI, setIsRequestingAI] = useState(false);
  const [actionResult, setActionResult] = useState<string>('');

  // 관리자 편집 모드 (suggested_changes를 직접 수정 가능)
  const [editMode, setEditMode] = useState(false);
  const [editedChanges, setEditedChanges] = useState<string>('');
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_secret');
    if (!saved) {
      router.replace('/admin/error-reports');
      return;
    }
    setSecret(saved);
  }, [router]);

  useEffect(() => {
    if (!secret) return;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/error-reports/${id}`, {
          headers: { 'x-admin-secret': secret },
        });
        if (res.status === 403) {
          router.replace('/admin/error-reports');
          return;
        }
        const json = await res.json();
        const r: Report = json.report;
        setReport(r);
        setProductCache(json.productCache ?? null);
        setAdminNote(r.admin_note ?? '');
        // 편집용 초기값: AI 제안
        if (r.ai_analysis?.suggested_changes) {
          setEditedChanges(JSON.stringify(r.ai_analysis.suggested_changes, null, 2));
        }
      } catch {
        setError('데이터를 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [secret, id, router]);

  async function handleApply(useEdited: boolean) {
    if (!report) return;
    setIsApplying(true);
    setActionResult('');
    try {
      let changes: Record<string, unknown>;
      if (useEdited) {
        changes = JSON.parse(editedChanges);
      } else {
        changes = report.ai_analysis?.suggested_changes ?? {};
      }

      const res = await fetch(`/api/admin/error-reports/${id}/apply-correction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret,
        },
        body: JSON.stringify({ approved_changes: changes, admin_note: adminNote || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionResult(`오류: ${json.error}`);
        return;
      }
      setActionResult('수정이 products 캐시에 반영됐습니다.');
      setReport(prev => prev ? { ...prev, status: 'resolved' } : prev);
    } catch {
      setActionResult('요청 실패');
    } finally {
      setIsApplying(false);
    }
  }

  async function handleDismiss() {
    setIsDismissing(true);
    setActionResult('');
    try {
      const res = await fetch(`/api/admin/error-reports/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret,
        },
        body: JSON.stringify({ status: 'dismissed', admin_note: adminNote || undefined }),
      });
      if (!res.ok) {
        setActionResult('거부 처리 실패');
        return;
      }
      setActionResult('제보가 거부됐습니다.');
      setReport(prev => prev ? { ...prev, status: 'dismissed' } : prev);
    } catch {
      setActionResult('요청 실패');
    } finally {
      setIsDismissing(false);
    }
  }

  async function handleRequestAI() {
    setIsRequestingAI(true);
    setActionResult('');
    try {
      const res = await fetch(`/api/admin/error-reports/${id}`, {
        method: 'POST',
        headers: { 'x-admin-secret': secret },
      });
      const json = await res.json();
      if (!res.ok) {
        setActionResult(`AI 분석 실패: ${json.error}`);
        return;
      }
      // 분석 결과를 리포트에 반영
      const d = json.data;
      setReport(prev => prev ? {
        ...prev,
        ai_analysis: d.ai_analysis,
        ai_confidence: d.ai_confidence,
        correction_type: d.correction_type,
        ai_analyzed_at: d.ai_analyzed_at,
      } : prev);
      if (d.ai_analysis?.suggested_changes) {
        setEditedChanges(JSON.stringify(d.ai_analysis.suggested_changes, null, 2));
      }
      setActionResult('AI 분석이 완료됐습니다.');
    } catch {
      setActionResult('AI 분석 요청 실패');
    } finally {
      setIsRequestingAI(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-red-500 text-sm">{error || '제보를 찾을 수 없습니다.'}</p>
        <button onClick={() => router.back()} className="text-sm text-blue-600 underline">뒤로</button>
      </div>
    );
  }

  const scanHistory = report.scan_history;
  const resultJson = scanHistory?.result_json as Record<string, unknown> | undefined;
  const currentIngredients = (
    productCache?.result_json?.ingredients ??
    resultJson?.ingredients ??
    []
  ) as Ingredient[];

  const suggestedChanges = report.ai_analysis?.suggested_changes;
  const isResolved = report.status === 'resolved';
  const isDismissed = report.status === 'dismissed';
  const isActioned = isResolved || isDismissed;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              오류 제보 #{report.id}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(report.created_at).toLocaleString('ko-KR')}
            </p>
          </div>
          <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${
            isResolved  ? 'bg-green-100 text-green-700' :
            isDismissed ? 'bg-gray-100 text-gray-500'   :
            report.status === 'open' ? 'bg-blue-100 text-blue-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {isResolved ? '해결됨' : isDismissed ? '거부됨' : report.status === 'open' ? '미처리' : '처리 중'}
          </span>
        </div>

        {/* 3-panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* 패널 1: 유저 제보 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">유저 제보</h2>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{report.body}</p>
            {report.attachments && report.attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-400 font-medium">첨부 이미지</p>
                {report.attachments.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer"
                    className="block text-xs text-blue-500 underline truncate">
                    첨부 {i + 1}
                  </a>
                ))}
              </div>
            )}
            {scanHistory?.image_url && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 font-medium mb-1">스캔 이미지</p>
                <img src={scanHistory.image_url} alt="스캔 이미지"
                  className="rounded-lg w-full object-contain max-h-48 bg-gray-50" />
              </div>
            )}
          </div>

          {/* 패널 2: 현재 분석 결과 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">현재 분석 결과 (수정 전)</h2>
            {scanHistory ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-gray-900 text-sm">{scanHistory.product_name}</span>
                  <StatusBadge status={productCache?.status ?? scanHistory.status} />
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  {(resultJson?.headline as string) ?? ''}
                </p>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  {(resultJson?.description as string) ?? ''}
                </p>
                <IngredientList ingredients={currentIngredients} />
                {productCache && (
                  <p className="text-xs text-gray-300 mt-3">
                    cache_key: {productCache.cache_key} · 조회 {productCache.hit_count}회
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">스캔 이력이 연결되지 않았습니다.</p>
            )}
          </div>

          {/* 패널 3: AI 분석 & 수정 제안 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">AI 분석 & 수정 제안</h2>
              <button
                onClick={handleRequestAI}
                disabled={isRequestingAI}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRequestingAI
                  ? <><RefreshCw className="w-3 h-3 animate-spin" /> 분석 중...</>
                  : <><Sparkles className="w-3 h-3" />{report.ai_analyzed_at ? 'AI 재분석' : 'AI 제안 요청'}</>
                }
              </button>
            </div>

            {!report.ai_analyzed_at ? (
              <p className="text-sm text-gray-400">아직 AI 분석이 실행되지 않았습니다.</p>
            ) : report.ai_analysis ? (
              <>
                {/* 신뢰도 배지 */}
                {report.ai_confidence && (
                  <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border mb-3 ${CONFIDENCE_COLOR[report.ai_confidence] ?? ''}`}>
                    {CONFIDENCE_LABEL[report.ai_confidence] ?? report.ai_confidence}
                  </span>
                )}

                {/* 진단 */}
                <div className="mb-3">
                  <p className="text-xs text-gray-400 font-medium mb-0.5">진단</p>
                  <p className="text-sm text-gray-800">{report.ai_analysis.diagnosis}</p>
                </div>

                {/* 근거 */}
                <div className="mb-3">
                  <p className="text-xs text-gray-400 font-medium mb-0.5">근거</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{report.ai_analysis.evidence}</p>
                </div>

                {/* 수정 제안 */}
                {suggestedChanges ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400 font-medium">수정 제안</p>
                      {!isActioned && (
                        <button
                          onClick={() => {
                            if (!editMode) {
                              setEditedChanges(JSON.stringify(suggestedChanges, null, 2));
                            }
                            setEditMode(v => !v);
                          }}
                          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                        >
                          {editMode ? <><X className="w-3 h-3" /> 취소</> : <><Edit2 className="w-3 h-3" /> 편집</>}
                        </button>
                      )}
                    </div>

                    {editMode ? (
                      <textarea
                        value={editedChanges}
                        onChange={e => setEditedChanges(e.target.value)}
                        rows={10}
                        className="w-full text-xs font-mono border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                      />
                    ) : (
                      <div className="space-y-2">
                        {suggestedChanges.status && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-14 shrink-0">판정</span>
                            <StatusBadge status={suggestedChanges.status} />
                          </div>
                        )}
                        {suggestedChanges.headline && (
                          <div>
                            <span className="text-xs text-gray-400">헤드라인</span>
                            <p className="text-xs text-gray-800 mt-0.5">{suggestedChanges.headline}</p>
                          </div>
                        )}
                        {suggestedChanges.ingredients && (
                          <>
                            <span className="text-xs text-gray-400">성분 변경</span>
                            <IngredientList ingredients={suggestedChanges.ingredients} />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">
                      {report.correction_type === 'user_error'
                        ? '앱 분석 결과가 정확합니다. 수정 불필요.'
                        : '데이터만으로 수정 제안을 생성하기 어렵습니다.'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">AI 분석 결과 없음</p>
            )}
          </div>
        </div>

        {/* 어드민 메모 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">어드민 메모 (내부용)</label>
          <textarea
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            disabled={isActioned}
            placeholder="처리 내용, 참고사항 등 내부 메모를 작성하세요."
            rows={2}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        {/* 액션 결과 메시지 */}
        {actionResult && (
          <div className="bg-blue-50 text-blue-700 rounded-lg px-4 py-3 text-sm mb-4">
            {actionResult}
          </div>
        )}

        {/* 액션 버튼 */}
        {!isActioned && (
          <div className="flex flex-wrap gap-3">
            {suggestedChanges && (
              <>
                <button
                  onClick={() => handleApply(false)}
                  disabled={isApplying}
                  className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  AI 제안 승인
                </button>
                {editMode && (
                  <button
                    onClick={() => handleApply(true)}
                    disabled={isApplying}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    수정 후 승인
                  </button>
                )}
              </>
            )}
            <button
              onClick={handleDismiss}
              disabled={isDismissing}
              className="flex items-center gap-2 bg-white text-gray-600 border border-gray-200 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              거부
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
