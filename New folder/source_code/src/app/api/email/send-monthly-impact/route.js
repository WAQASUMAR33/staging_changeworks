import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma.jsx";
import emailService from "../../../lib/email-service.jsx";

// GET /api/email/send-monthly-impact - Check email configuration
export async function GET() {
  try {
    const connectionTest = await emailService.verifyConnection();
    const emailConfig = {
      host: process.env.EMAIL_SERVER_HOST,
      port: process.env.EMAIL_SERVER_PORT,
      user: process.env.EMAIL_SERVER_USER,
      from: process.env.EMAIL_FROM,
    };

    return NextResponse.json({
      success: true,
      message: "Email service configuration check",
      emailConfig: {
        host: emailConfig.host,
        port: emailConfig.port,
        from: emailConfig.from,
        configured: !!emailConfig.host && !!emailConfig.port && !!emailConfig.user && !!emailConfig.from
      },
      connectionTest: connectionTest,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking email configuration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check email configuration', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/email/send-monthly-impact - Send monthly impact email to a donor
export async function POST(request) {
  try {
    const { donor_id, organization_id, month, total_amount, dashboard_link } = await request.json();

    if (!donor_id || !organization_id || !month || !total_amount) {
      return NextResponse.json(
        { success: false, error: 'donor_id, organization_id, month, and total_amount are required' },
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
        email: true
      }
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Generate dashboard link if not provided
    const dashboardLink = dashboard_link || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/donor/dashboard?donor_id=${donor.id}`;

    // Send monthly impact email
    const emailResult = await emailService.sendMonthlyImpactEmail({
      donor: {
        name: donor.name,
        email: donor.email
      },
      organization: organization,
      dashboardLink: dashboardLink,
      month: month,
      totalAmount: total_amount
    });

    if (emailResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Monthly impact email sent successfully',
        emailResult: {
          messageId: emailResult.messageId,
          donor: { id: donor.id, name: donor.name, email: donor.email },
          organization: { id: organization.id, name: organization.name },
          month: month,
          totalAmount: total_amount,
          dashboardLink: dashboardLink
        },
        sentAt: new Date().toISOString()
      });
    } else {
      console.error('Failed to send monthly impact email:', emailResult.error);
      return NextResponse.json(
        { success: false, error: 'Failed to send monthly impact email', details: emailResult.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error sending monthly impact email:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send monthly impact email', details: error.message },
      { status: 500 }
    );
  }
}
