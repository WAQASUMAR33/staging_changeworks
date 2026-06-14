import { NextResponse } from "next/server";
import emailService from "@/app/lib/email-service";
import { corsHeaders } from '@/app/lib/cors';

// POST /api/email/test-recurring-donation
// Test the recurring donation email functionality
export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Recipient email (email) is required' },
        { status: 400 }
      );
    }
    
    // Verify connection first
    const verifyResult = await emailService.verifyConnection();
    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, error: 'Email service connection failed', details: verifyResult.error },
        { status: 500 }
      );
    }

    // Mock data for recurring donation
    const mockData = {
      donor: {
        name: "Test Donor",
        email: email
      },
      organization: {
        name: "Test Organization",
        email: "contact@testorg.com",
        phone: "555-0123",
        address: "123 Charity Lane",
        city: "Hopeville",
        state: "NY",
        postalCode: "10001",
        imageUrl: "/imgs/changeworks.png", // Use a local image or absolute URL if available
        firstName: "John",
        lastName: "Director",
        ein: "12-3456789"
      },
      amount: 50.00,
      startDate: new Date(),
      transactionId: `test_sub_${Date.now()}`,
      dashboardLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org'}/donor/login`,
      campaignName: "Test Campaign",
      paymentMethod: "Card ending in 4242",
      receiptNumber: `REC-${Date.now()}`
    };

    console.log('🧪 Testing recurring donation email with data:', mockData);

    const result = await emailService.sendRecurringDonationEmail(mockData);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Recurring donation test email sent successfully',
        data: result
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to send email', details: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Error in test route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
