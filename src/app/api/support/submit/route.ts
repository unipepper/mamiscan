import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeErrorReport } from '@/lib/ai/error-report-analyzer';

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
    const { scanHistoryId } = payload as ErrorReportBody;
    const { data: inserted, error } = await adminSupabase
      .from('scan_error_reports')
      .insert({
        user_id: user?.id ?? null,
        body: body.trim(),
        scan_history_id: scanHistoryId ?? null,
        attachments: attachmentsValue,
      })
      .select('id')
      .single();
    if (error || !inserted) {
      console.error('[support/submit] scan_error_reports insert error:', error);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }

    // scan_history_id가 있으면 products 캐시 무효화 + 백그라운드 AI 분석 실행
    if (scanHistoryId) {
      const { data: history } = await adminSupabase
        .from('scan_history')
        .select('product_name')
        .eq('id', scanHistoryId)
        .maybeSingle();

      if (history?.product_name) {
        await adminSupabase
          .from('catalog')
          .delete()
          .eq('product_name', history.product_name);
      }

      const reportId = inserted.id;
      after(async () => {
        await analyzeErrorReport(reportId);
      });
    }
  }

  return NextResponse.json({ success: true });
}
