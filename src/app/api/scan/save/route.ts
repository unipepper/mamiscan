import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deductScan } from '@/lib/entitlement';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { productName, status, resultJson, imageBase64 } = await req.json();

  // ── 1. 이용권 차감 ──────────────────────────────────────────────
  const deductResult = await deductScan(supabase, user.id);
  if (!deductResult.ok) {
    return NextResponse.json({ error: deductResult.error }, { status: deductResult.status });
  }

  const { entitlementId, type: usageType, description: usageDescription } = deductResult;

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
  const { error: logError } = await supabase.from('scan_usage_logs').insert({
    user_id: user.id,
    type: 'scan_use',
    count: -1,
    entitlement_id: entitlementId,
    scan_history_id: historyId,
    description: usageDescription,
  });

  if (logError) {
    console.error('scan_usage_logs insert error:', logError);
  }

  return NextResponse.json({ success: true, historyId, imagePath, type: usageType, entitlementId });
}
