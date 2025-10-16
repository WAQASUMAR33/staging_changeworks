import { NextResponse } from 'next/server';

export function middleware(request) {
  console.log('🔍 Middleware executing for:', request.nextUrl.pathname);
  
  // Only apply to admin routes (except secure-portal)
  if (request.nextUrl.pathname.startsWith('/admin') && 
      !request.nextUrl.pathname.startsWith('/admin/secure-portal')) {
    
    console.log('🔍 Admin route detected, checking authentication...');
    
    // Check for admin token in cookies or headers
    const adminToken = request.cookies.get('adminToken')?.value || 
                      request.headers.get('authorization')?.replace('Bearer ', '');
    
    console.log('🔍 Admin token found:', !!adminToken);
    console.log('🔍 Cookies:', request.cookies.getAll());
    console.log('🔍 Headers:', request.headers.get('authorization'));
    
    // For client-side navigation, let the admin layout handle authentication
    // Only redirect server-side requests without tokens
    if (!adminToken && request.headers.get('accept')?.includes('text/html')) {
      console.log('❌ No admin token found for server-side request, redirecting to login');
      return NextResponse.redirect(new URL('/admin/secure-portal', request.url));
    }
    
    console.log('✅ Admin token found or client-side navigation, allowing access');
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin',
    '/admin/((?!secure-portal).)*'
  ]
};
