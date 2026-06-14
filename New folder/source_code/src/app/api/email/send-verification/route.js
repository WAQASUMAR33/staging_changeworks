import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma.jsx";
import emailService from "../../../lib/email-service.jsx";

// GET /api/email/send-verification - Check email configuration
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

// POST /api/email/send-verification - Send verification email to a donor
export async function POST(request) {
  try {
    const { donor_id, verification_token, verification_link } = await request.json();

    if (!donor_id || !verification_token || !verification_link) {
      return NextResponse.json(
        { success: false, error: 'donor_id, verification_token, and verification_link are required' },
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

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail({
      donor: {
        name: donor.name,
        email: donor.email
      },
      verificationToken: verification_token,
      verificationLink: verification_link
    });

    if (emailResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Verification email sent successfully',
        emailResult: {
          messageId: emailResult.messageId,
          donor: { id: donor.id, name: donor.name, email: donor.email },
          verificationToken: verification_token,
          verificationLink: verification_link
        },
        sentAt: new Date().toISOString()
      });
    } else {
      console.error('Failed to send verification email:', emailResult.error);
      return NextResponse.json(
        { success: false, error: 'Failed to send verification email', details: emailResult.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error sending verification email:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send verification email', details: error.message },
      { status: 500 }
    );
  }
}
