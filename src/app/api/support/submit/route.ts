import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeErrorReport } from '@/lib/ai/error-report-analyzer';
import { refundScan } from '@/lib/entitlement';

type InquiryBody = {
  type: 'inquiry';
  category: 'payment' | 'scan_error' | 'feature' | 'account' | 'other';
  title?: string;
  body: string;
  attachments?: string[];
};

type ErrorReportBody = {
  type: 'error_report';
  body: string;
  scanHistoryId?: number;
  attachments?: string[];
  correctProductName?: string;
  rescanResult?: {
    status: string;
    productName: string;
    headline: string;
    description: string;
    ingredients: { name: string; status: string; reason: string }[];
    weekAnalysis?: string;
  };
};

type SupportSubmitBody = InquiryBody | ErrorReportBody;

export async function POST(req: Request) {
  let payload: SupportSubmitBody;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { type, body, attachments } = payload;

  if (!type || !['inquiry', 'error_report'].includes(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }
  if (type === 'inquiry') {
    const { category } = payload as InquiryBody;
    if (!category || !['payment', 'scan_error', 'feature', 'account', 'other'].includes(category)) {
      return NextResponse.json({ error: 'invalid_category' }, { status: 400 });
    }
  }
  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    return NextResponse.json({ error: 'body_required' }, { status: 400 });
  }
  if (body.trim().length > 2000) {
    return NextResponse.json({ error: 'body_too_long' }, { status: 400 });
  }

  // 세션에서 사용자 ID 추출 (비로그인이면 null로 처리)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // RLS 우회 삽입 — 비로그인 사용자도 제출 가능하므로 Service Role 사용
  const adminSupabase = createAdminClient();

  const attachmentsValue = attachments && attachments.length > 0 ? attachments : null;

  if (type === 'inquiry') {
    const { category, title } = payload as InquiryBody;
    const { error } = await adminSupabase.from('customer_inquiries').insert({
      user_id: user?.id ?? null,
      category,
      title: title?.trim() || null,
      body: body.trim(),
      attachments: attachmentsValue,
    });
    if (error) {
      console.error('[support/submit] customer_inquiries insert error:', error);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }
  } else {
    const { scanHistoryId, correctProductName, rescanResult } = payload as ErrorReportBody;

    // 유저가 재분석 결과를 확인했으면 ai_analysis에 저장
    const aiAnalysis = rescanResult
      ? {
          diagnosis: correctProductName
            ? `유저 제보 정확한 제품명: "${correctProductName}" — 재분석 결과`
            : '유저 요청 재분석 결과',
          evidence: `Google Search grounding 기반 재분석. 제품명: ${rescanResult.productName}`,
          suggested_changes: {
            status:      rescanResult.status,
            headline:    rescanResult.headline,
            description: rescanResult.description,
            ingredients: rescanResult.ingredients,
          },
        }
      : null;

    const { data: inserted, error } = await adminSupabase
      .from('scan_error_reports')
      .insert({
        user_id: user?.id ?? null,
        body: body.trim(),
        scan_history_id: scanHistoryId ?? null,
        attachments: attachmentsValue,
        correct_product_name: correctProductName?.trim() || null,
        user_rescan_result: rescanResult ?? null,
        ...(aiAnalysis && {
          ai_analysis: aiAnalysis,
          ai_confidence: 'high',
          correction_type: 'status_change',
          ai_analyzed_at: new Date().toISOString(),
        }),
      })
      .select('id')
      .single();
    if (error || !inserted) {
      console.error('[support/submit] scan_error_reports insert error:', error);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }

    const reportId = inserted.id;

    // scan_history: 검토 중 표시 + error_report_id 연결
    if (scanHistoryId) {
      const { data: history } = await adminSupabase
        .from('scan_history')
        .select('product_name, entitlement_id')
        .eq('id', scanHistoryId)
        .maybeSingle();

      await adminSupabase
        .from('scan_history')
        .update({ is_under_review: true, error_report_id: reportId })
        .eq('id', scanHistoryId);

      // catalog 캐시 무효화
      if (history?.product_name) {
        await adminSupabase
          .from('catalog')
          .delete()
          .eq('product_name', history.product_name);
      }

      // 스캔권 환불 (로그인 유저 + 횟수권인 경우)
      if (user && history?.entitlement_id) {
        await refundScan(supabase, user.id, history.entitlement_id);
        await adminSupabase.from('scan_usage_logs').insert({
          user_id: user.id,
          type: 'scan_refund',
          count: 1,
          entitlement_id: history.entitlement_id,
          scan_history_id: scanHistoryId,
          description: '오류 제보 환불',
        });
      }

      // 재분석 결과 없으면 백그라운드 AI 분석 실행
      if (!rescanResult) {
        after(async () => {
          await analyzeErrorReport(reportId);
        });
      }
    }

    return NextResponse.json({ success: true, reportId });
  }

  return NextResponse.json({ success: true });
}
