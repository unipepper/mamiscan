import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { guestUsed } = await req.json();
  if (typeof guestUsed !== 'number' || guestUsed <= 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const adminSupabase = createAdminClient();

  const now = new Date().toISOString();
  const { data: trial } = await adminSupabase
    .from('user_entitlements')
    .select('id, scan_count')
    .eq('user_id', user.id)
    .eq('type', 'trial')
    .eq('status', 'active')
    .gt('expires_at', now)
    .maybeSingle();

  if (!trial) return NextResponse.json({ ok: true, skipped: true });

  const newCount = Math.max(0, trial.scan_count - guestUsed);
  await adminSupabase
    .from('user_entitlements')
    .update({ scan_count: newCount })
    .eq('id', trial.id);

  return NextResponse.json({ ok: true, newCount });
}
