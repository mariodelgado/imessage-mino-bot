import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Password for accessing the site (set this in environment variables for production)
const SITE_PASSWORD = process.env.SITE_PASSWORD || 'mino2025';
const AUTH_COOKIE_NAME = 'mino-auth';
const AUTH_COOKIE_VALUE = 'authenticated';

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/author',        // Snap App Author tool
  '/api/auth',      // Auth endpoint
  '/api/author',    // Author API
  '/api/cron',      // Cron jobs
  '/api/snap-apps', // External API access
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);

  if (authCookie?.value === AUTH_COOKIE_VALUE) {
    // User is authenticated, add anti-scraping headers
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  }

  // Redirect to login page
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
