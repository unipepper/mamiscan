import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  // 1. 인증 확인
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  // 2. scan-images 버킷에서 해당 유저 파일 전체 삭제
  const { data: files } = await adminSupabase.storage
    .from('scan-images')
    .list(user.id);

  if (files && files.length > 0) {
    const paths = files.map(f => `${user.id}/${f.name}`);
    await adminSupabase.storage.from('scan-images').remove(paths);
  }

  // 3. auth.users 삭제 → public.users CASCADE → 연관 테이블 자동 파기
  //    (transactions는 migration-v6으로 SET NULL 처리되어 보존됨)
  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('[delete-user] auth.admin.deleteUser error:', deleteError.message);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });

  // 세션 쿠키 만료 처리
  const cookieNames = request.cookies.getAll().map((c) => c.name);
  for (const name of cookieNames) {
    if (name.startsWith('sb-')) {
      response.cookies.set(name, '', { maxAge: 0, path: '/' });
    }
  }

  return response;
}
