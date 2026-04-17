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

  const { productName, status, resultJson, imageBase64, entitlementId } = await req.json();

  // 1. scan_history INSERT → id 획득
  const { data: inserted, error: insertError } = await supabase
    .from('scan_history')
    .insert({
      user_id: user.id,
      product_name: productName,
      status,
      result_json: JSON.stringify(resultJson),
      ...(entitlementId != null ? { entitlement_id: entitlementId } : {}),
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ success: true }); // 이미지 없이 계속
  }

  const historyId = inserted.id;
  let imagePath: string | null = null;

  // 2. 이미지가 있으면 Storage에 업로드
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
        // 3. image_url 업데이트
        await supabase
          .from('scan_history')
          .update({ image_url: path })
          .eq('id', historyId);
        imagePath = path;
      }
    } catch {
      // 업로드 실패 시 이미지 없이 계속 (비차단)
    }
  }

  return NextResponse.json({ success: true, historyId, imagePath });
}
