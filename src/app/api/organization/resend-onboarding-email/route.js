import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { createStripeAccountLinkDirect } from "../../../lib/stripe-direct-api";
import emailService from "../../../lib/email-service";
import { corsHeaders } from '@/app/lib/cors';

/**
 * POST /api/organization/resend-onboarding-email
 * Resend the Stripe onboarding email to an organization
 * Body: { organizationId: string } or { email: string }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { organizationId, email } = body;

    if (!organizationId && !email) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Either organizationId or email is required' 
        },
        { status: 400 }
      );
    }

    // Find organization
    const organization = organizationId
      ? await prisma.organization.findUnique({ where: { id: organizationId } })
      : await prisma.organization.findUnique({ where: { email } });

    if (!organization) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Organization not found' 
        },
        { status: 404 }
      );
    }

    // Check if organization has a Stripe account
    if (!organization.stripeAccountId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Organization does not have a Stripe account. Please create one first.' 
        },
        { status: 400 }
      );
    }

    // Check if email is configured
    const hasEmailConfig = 
      process.env.EMAIL_SERVER_HOST && 
      process.env.EMAIL_SERVER_PORT && 
      process.env.EMAIL_SERVER_USER && 
      process.env.EMAIL_SERVER_PASSWORD && 
      process.env.EMAIL_FROM;

    if (!hasEmailConfig) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Email server not configured',
          details: 'Please configure email server environment variables',
          onboardingLink: null
        },
        { status: 503 }
      );
    }

    // Generate new onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const refreshUrl = `${baseUrl}/organization/dashboard/stripe-products`;
    const returnUrl = `${baseUrl}/organization/dashboard/stripe-products`;

    console.log('🔄 Generating new onboarding link for organization:', organization.id);
    const linkResult = await createStripeAccountLinkDirect(
      organization.stripeAccountId,
      refreshUrl,
      returnUrl
    );

    if (!linkResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create onboarding link',
          details: linkResult.error 
        },
        { status: 500 }
      );
    }

    const accountLink = linkResult.accountLink;

    // Send email
    console.log('📧 Sending onboarding email to:', organization.email);
    const emailResult = await emailService.sendStripeOnboardingEmail({
      organization: {
        name: organization.name,
        email: organization.email,
        imageUrl: organization.imageUrl
      },
      onboardingUrl: accountLink.url
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send email',
          details: emailResult.error,
          onboardingLink: accountLink.url, // Still return the link so user can access it
          message: 'Email failed but onboarding link is available below'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding email sent successfully',
      email: {
        sent: true,
        recipient: organization.email,
        messageId: emailResult.messageId
      },
      onboardingLink: accountLink.url,
      expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
      organization: {
        id: organization.id,
        name: organization.name,
        email: organization.email
      }
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error resending onboarding email:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/organization/resend-onboarding-email?email=xxx or ?organizationId=xxx
 * Get the onboarding link for an organization (without sending email)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const email = searchParams.get('email');

    if (!organizationId && !email) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Either organizationId or email query parameter is required' 
        },
        { status: 400 }
      );
    }

    // Find organization
    const organization = organizationId
      ? await prisma.organization.findUnique({ where: { id: organizationId } })
      : await prisma.organization.findUnique({ where: { email } });

    if (!organization) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Organization not found' 
        },
        { status: 404 }
      );
    }

    // Check if organization has a Stripe account
    if (!organization.stripeAccountId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Organization does not have a Stripe account' 
        },
        { status: 400 }
      );
    }

    // Generate new onboarding link
    const refreshUrl = 'https://changeworkscollective.org/stripe/refresh';
    const returnUrl = 'https://changeworkscollective.org/stripe/success';

    const linkResult = await createStripeAccountLinkDirect(
      organization.stripeAccountId,
      refreshUrl,
      returnUrl
    );

    if (!linkResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create onboarding link',
          details: linkResult.error 
        },
        { status: 500 }
      );
    }

    const accountLink = linkResult.accountLink;

    return NextResponse.json({
      success: true,
      onboardingLink: accountLink.url,
      expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
      organization: {
        id: organization.id,
        name: organization.name,
        email: organization.email
      }
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error getting onboarding link:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
