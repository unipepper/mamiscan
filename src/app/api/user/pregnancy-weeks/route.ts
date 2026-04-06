import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { weeks } = await req.json();
  if (!weeks || typeof weeks !== 'number' || weeks < 1 || weeks > 42) {
    return NextResponse.json({ error: 'invalid_weeks' }, { status: 400 });
  }

  const { error } = await supabase
    .from('users')
    .update({ pregnancy_weeks: weeks })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });

  return NextResponse.json({ success: true });
}
