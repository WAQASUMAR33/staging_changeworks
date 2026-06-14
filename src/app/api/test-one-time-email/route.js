import { NextResponse } from 'next/server';
import { emailService } from '../../lib/email-service';
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const to = searchParams.get('to');

    if (!to) {
      return NextResponse.json({ 
        error: 'Missing "to" query parameter',
        usage: '/api/test-one-time-email?to=your-email@example.com' 
      }, { status: 400 });
    }

    console.log(`Testing one-time donation email to: ${to}`);

    // Mock data
    const donor = { name: 'Test Donor', email: to };
    const organization = { name: 'Test Organization', email: 'org@example.com', imageUrl: '/imgs/changeworks.png' };
    const dashboardLink = 'https://example.com/dashboard';
    const amount = '50.00';
    const donationDate = new Date().toLocaleDateString();

    const result = await emailService.sendOneTimeDonationEmail({
      donor,
      organization,
      dashboardLink,
      amount,
      donationDate
    });

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'One-time donation test email sent successfully',
        details: result 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to send one-time donation test email', 
        details: result.error 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Test one-time email route error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
