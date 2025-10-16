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
    
    if (!adminToken) {
      console.log('❌ No admin token found, redirecting to login');
      // Redirect to admin login if no token
      return NextResponse.redirect(new URL('/admin/secure-portal', request.url));
    }
    
    console.log('✅ Admin token found, allowing access');
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};
