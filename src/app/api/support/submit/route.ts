import { NextResponse, after } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
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
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch { /* Server Component에서는 무시 */ }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // service role key로 RLS 우회하여 삽입
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

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
        ai_status: scanHistoryId ? 'pending' : 'not_applicable',
      })
      .select('id')
      .single();
    if (error || !inserted) {
      console.error('[support/submit] scan_error_reports insert error:', error);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }

    // scan_history_id가 있으면 백그라운드에서 AI 분석 실행
    if (scanHistoryId) {
      const reportId = inserted.id;
      after(async () => {
        await analyzeErrorReport(reportId);
      });
    }
  }

  return NextResponse.json({ success: true });
}
