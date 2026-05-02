import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { weeks } = await req.json();
    if (!weeks || typeof weeks !== 'number' || weeks < 1 || weeks > 42) {
      return NextResponse.json({ error: 'invalid_weeks' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { error } = await supabase
      .from('users')
      .update({ pregnancy_weeks: weeks })
      .eq('id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[user/pregnancy-weeks] error:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
