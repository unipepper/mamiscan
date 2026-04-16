import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [{ data: transactions }, { data: credits }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('scan_credits')
      .select('id, count, expires_at, transaction_id')
      .eq('user_id', user.id)
      .not('transaction_id', 'is', null),
  ]);

  // 구매 트랜잭션에 lot 현황 연결 (잔여/사용 수량 계산용)
  const creditMap: Record<string, { count: number; expires_at: string }> =
    Object.fromEntries((credits ?? []).map(c => [c.transaction_id, { count: c.count, expires_at: c.expires_at }]));

  const enriched = (transactions ?? []).map(tx => ({
    ...tx,
    lot: creditMap[tx.id] ?? null,
  }));

  return NextResponse.json({ success: true, transactions: enriched });
}
