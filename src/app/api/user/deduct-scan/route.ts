import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deductScan } from '@/lib/entitlement';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await deductScan(supabase, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await supabase.from('scan_usage_logs').insert({
    user_id: user.id,
    type: 'scan_use',
    count: -1,
    entitlement_id: result.entitlementId,
    description: result.description,
  });

  return NextResponse.json({ success: true, type: result.type, entitlementId: result.entitlementId });
}
