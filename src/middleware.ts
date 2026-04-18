import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 약관 동의 강제: 로그인됐지만 미동의 유저가 약관/auth 관련 경로 외 접근 시 차단
  const isTermsExempt =
    pathname.startsWith('/signup/') ||
    pathname.startsWith('/login') ||
    pathname === '/';
  if (user && !isTermsExempt) {
    const termsAgreed = user.user_metadata?.terms_agreed === true;
    if (!termsAgreed) {
      return NextResponse.redirect(new URL('/signup/terms', request.url));
    }
  }

  // 로그인 필요 경로 (/scan은 비로그인 3회 체험 허용 — 페이지 내부에서 제한)
  const protectedPaths = ['/history', '/settings', '/payment'];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 이미 로그인된 상태에서 /login 접근 → 홈으로
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/callback).*)'],
};
