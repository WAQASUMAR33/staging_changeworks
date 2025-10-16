import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma.jsx";
import { emailService } from "../../../lib/email-service.jsx";

// POST /api/email/send-welcome - Send welcome email to donor
export async function POST(request) {
  try {
    const body = await request.json();
    const { donor_id, organization_id, dashboard_link } = body;

    // Validate required fields
    if (!donor_id || !organization_id) {
      return NextResponse.json(
        { success: false, error: 'donor_id and organization_id are required' },
        { status: 400 }
      );
    }

    // Fetch donor information
    const donor = await prisma.donor.findUnique({
      where: { id: parseInt(donor_id) },
      select: { 
        id: true, 
        name: true, 
        email: true
      }
    });

    if (!donor) {
      return NextResponse.json(
        { success: false, error: 'Donor not found' },
        { status: 404 }
      );
    }

    // Fetch organization information
    const organization = await prisma.organization.findUnique({
      where: { id: parseInt(organization_id) },
      select: { 
        id: true, 
        name: true, 
        email: true,
        imageUrl: true
      }
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Generate dashboard link if not provided
    const dashboardLink = dashboard_link || `${process.env.NEXT_PUBLIC_BASE_URL}/donor/dashboard?donor_id=${donor.id}`;

    // Send welcome email
    const emailResult = await emailService.sendWelcomeEmail({
      donor: {
        name: donor.name,
        email: donor.email
      },
      organization: organization,
      dashboardLink: dashboardLink
    });

    if (emailResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Welcome email sent successfully',
        emailResult: {
          messageId: emailResult.messageId,
          donor: {
            id: donor.id,
            name: donor.name,
            email: donor.email
          },
          organization: {
            id: organization.id,
            name: organization.name
          },
          dashboardLink: dashboardLink
        },
        sentAt: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send welcome email', 
          details: emailResult.error,
          donor: {
            id: donor.id,
            name: donor.name,
            email: donor.email
          },
          organization: {
            id: organization.id,
            name: organization.name
          }
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error sending welcome email:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send welcome email', details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/email/send-welcome - Test email configuration
export async function GET(request) {
  try {
    // Test email configuration
    const configTest = await emailService.verifyConnection();
    
    return NextResponse.json({
      success: true,
      message: 'Email service configuration check',
      emailConfig: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        from: process.env.EMAIL_FROM,
        configured: !!(process.env.EMAIL_SERVER_HOST && process.env.EMAIL_SERVER_PORT && process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD && process.env.EMAIL_FROM)
      },
      connectionTest: configTest,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Email config check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check email configuration', details: error.message },
      { status: 500 }
    );
  }
}
