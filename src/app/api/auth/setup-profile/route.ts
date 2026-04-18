import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const name: string | undefined = body.name?.trim() || undefined;
  const pregnancyWeeks: number | undefined = body.pregnancy_weeks
    ? Number(body.pregnancy_weeks)
    : undefined;

  // 입력값이 없으면 DB 호출 없이 성공 반환
  if (!name && !pregnancyWeeks) {
    return NextResponse.json({ ok: true });
  }

  const updates: Record<string, string | number> = {};
  if (name) updates.name = name;
  if (pregnancyWeeks) updates.pregnancy_weeks = pregnancyWeeks;

  const { error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id);

  if (updateError) {
    console.error('[setup-profile] update error:', updateError.message);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
