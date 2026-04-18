import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { productName, status, resultJson, imageBase64 } = await req.json();

  // ── 1. 이용권 차감 ──────────────────────────────────────────────
  const now = new Date().toISOString();

  // 활성 무제한 이용권
  const { data: activeSub } = await supabase
    .from('user_entitlements')
    .select('id, expires_at')
    .eq('user_id', user.id)
    .eq('type', 'monthly')
    .eq('status', 'active')
    .gt('expires_at', now)
    .maybeSingle();

  let entitlementId: string;
  let usageType: 'subscription' | 'scan';
  let usageDescription: string;

  if (activeSub) {
    entitlementId = activeSub.id;
    usageType = 'subscription';
    usageDescription = '스캔 사용 (무제한)';
  } else {
    // FIFO: 만료 임박 순으로 횟수권 차감
    const { data: scanRights } = await supabase
      .from('user_entitlements')
      .select('id, scan_count')
      .eq('user_id', user.id)
      .in('type', ['trial', 'scan5'])
      .eq('status', 'active')
      .gt('expires_at', now)
      .gt('scan_count', 0)
      .order('expires_at', { ascending: true })
      .limit(1);

    if (!scanRights || scanRights.length === 0) {
      // 대기 중인 무제한 이용권 첫 스캔으로 활성화
      const { data: pendingSub } = await supabase
        .from('user_entitlements')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'monthly')
        .eq('status', 'pending')
        .maybeSingle();

      if (!pendingSub) {
        return NextResponse.json({ error: 'no_scans' }, { status: 403 });
      }

      const startedAt = new Date();
      const expiresAt = new Date(startedAt);
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase
        .from('user_entitlements')
        .update({ status: 'active', started_at: startedAt.toISOString(), expires_at: expiresAt.toISOString() })
        .eq('id', pendingSub.id);

      entitlementId = pendingSub.id;
      usageType = 'subscription';
      usageDescription = '스캔 사용 (무제한 첫 사용)';
    } else {
      const scanRight = scanRights[0];
      const { error: updateError } = await supabase
        .from('user_entitlements')
        .update({ scan_count: scanRight.scan_count! - 1 })
        .eq('id', scanRight.id);

      if (updateError) {
        return NextResponse.json({ error: 'db_error' }, { status: 500 });
      }

      entitlementId = scanRight.id;
      usageType = 'scan';
      usageDescription = '스캔 사용';
    }
  }

  // ── 2. scan_history INSERT ──────────────────────────────────────
  const { data: inserted, error: insertError } = await supabase
    .from('scan_history')
    .insert({
      user_id: user.id,
      product_name: productName,
      status,
      result_json: JSON.stringify(resultJson),
      entitlement_id: entitlementId,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  const historyId = inserted.id;

  // ── 3. 이미지 업로드 ────────────────────────────────────────────
  let imagePath: string | null = null;

  if (imageBase64) {
    try {
      const [header, data] = imageBase64.split(',');
      const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
      const binary = Buffer.from(data, 'base64');
      const path = `${user.id}/${historyId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('scan-images')
        .upload(path, binary, { contentType: mime, upsert: true });

      if (!uploadError) {
        await supabase.from('scan_history').update({ image_url: path }).eq('id', historyId);
        imagePath = path;
      }
    } catch {
      // 업로드 실패 시 비차단 계속
    }
  }

  // ── 4. scan_usage_logs INSERT (scan_history_id 포함) ────────────
  await supabase.from('scan_usage_logs').insert({
    user_id: user.id,
    type: 'scan_use',
    count: -1,
    entitlement_id: entitlementId,
    scan_history_id: historyId,
    description: usageDescription,
  });

  return NextResponse.json({ success: true, historyId, imagePath, type: usageType, entitlementId });
}
