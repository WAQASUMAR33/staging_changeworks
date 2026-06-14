
import { NextResponse } from 'next/server';
import emailService from '@/app/lib/email-service';
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || 'test@example.com';
    
    console.log('🧪 Testing Round-Up Welcome Email...');
    
    // Mock data
    const donor = {
      name: 'John Doe',
      email: email
    };
    
    const organization = {
      id: 'org_123',
      name: 'Test Organization',
      email: 'org@example.com',
      phone: '123-456-7890',
      imageUrl: '/imgs/changeworks.png' // Test fallback to ChangeWorks logo
    };
    
    const dashboardLink = 'https://app.changeworksfund.org/donor/login';
    
    await emailService.sendWelcomeEmail({
      donor,
      organization,
      dashboardLink
    });
    
    return NextResponse.json({ success: true, message: 'Round-Up Welcome Email sent (check logs)' });
  } catch (error) {
    console.error('❌ Error testing Round-Up Welcome Email:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
