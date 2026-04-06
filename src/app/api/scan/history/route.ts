import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: history } = await supabase
    .from('scan_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return NextResponse.json({ success: true, history: history ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { productName, status, resultJson } = await req.json();

  await supabase.from('scan_history').insert({
    user_id: user.id,
    product_name: productName,
    status,
    result_json: JSON.stringify(resultJson),
  });

  return NextResponse.json({ success: true });
}
