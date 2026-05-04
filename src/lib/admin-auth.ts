import { NextResponse } from 'next/server';

type AdminAuthResult =
  | { ok: true; isCron: boolean }
  | { ok: false; response: NextResponse };

/**
 * Admin API 인증 검증.
 *
 * 허용 경로 (우선순위 순):
 * 1. Vercel Cron: Authorization: Bearer <CRON_SECRET>
 * 2. Retool 등 서버 클라이언트: x-api-key: <RETOOL_API_KEY>
 */
export async function verifyAdmin(req: Request): Promise<AdminAuthResult> {
  // 1. Vercel Cron 인증
  const authorization = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    return { ok: true, isCron: true };
  }

  // 2. Retool API Key 인증
  const retoolKey = process.env.RETOOL_API_KEY;
  if (retoolKey && req.headers.get('x-api-key') === retoolKey) {
    return { ok: true, isCron: false };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
  };
}
