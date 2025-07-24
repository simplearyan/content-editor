// middleware.ts
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: ['/editor/:path*', '/api/admin/:path*'], // Apply middleware to editor and admin API routes
};

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // If there's no token, redirect to login
  if (!token) {
    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // If token exists but user is not admin, redirect to unauthorized
  if (!token.isAdmin) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // If authenticated and admin, continue
  return NextResponse.next();
}