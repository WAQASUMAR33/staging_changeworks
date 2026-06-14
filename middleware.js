import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight — must respond before any other logic
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // Admin route authentication check
  if (pathname.startsWith('/changeworksadmin') &&
      !pathname.startsWith('/changeworksadmin/login')) {

    const adminToken = request.cookies.get('adminToken')?.value ||
                      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!adminToken && request.headers.get('accept')?.includes('text/html')) {
      return NextResponse.redirect(new URL('/changeworksadmin/login', request.url));
    }
  }

  // Attach CORS headers to every response so actual requests also pass
  const response = NextResponse.next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export const config = {
  matcher: ['/(api)(.*)', '/changeworksadmin', '/changeworksadmin/((?!login).)*'],
};
