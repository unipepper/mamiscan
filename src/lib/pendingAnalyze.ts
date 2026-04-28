/**
 * 바코드 감지 시점에 즉시 시작된 /api/analyze 프리페치를
 * scan 페이지 → result 페이지 간에 공유하기 위한 모듈 레벨 상태.
 *
 * Next.js 클라이언트 사이드 내비게이션 중에는 모듈 스코프가 유지되므로
 * Context나 전역 window 없이도 페이지 간 Promise를 전달할 수 있다.
 */
export const pendingAnalyze: {
  promise: Promise<Response> | null;
  barcode: string | null;
} = { promise: null, barcode: null };
