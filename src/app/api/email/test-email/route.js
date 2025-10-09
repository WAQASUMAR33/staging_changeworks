import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// POST /api/email/test-email - Send a test email
export async function POST(request) {
  try {
    const body = await request.json();
    const { to, subject, message } = body;

    // Validate input
    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Recipient email (to) is required' },
        { status: 400 }
      );
    }

    // Check if email configuration is available
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
          details: 'Please configure the following environment variables: EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_SERVER_USER, EMAIL_SERVER_PASSWORD, EMAIL_FROM',
          emailConfig: {
            host: process.env.EMAIL_SERVER_HOST ? 'Set' : 'Missing',
            port: process.env.EMAIL_SERVER_PORT ? 'Set' : 'Missing',
            user: process.env.EMAIL_SERVER_USER ? 'Set' : 'Missing',
            password: process.env.EMAIL_SERVER_PASSWORD ? 'Set' : 'Missing',
            from: process.env.EMAIL_FROM ? 'Set' : 'Missing',
          }
        },
        { status: 503 }
      );
    }

    // Create transport
    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection
    try {
      await transport.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('❌ SMTP connection verification failed:', verifyError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'SMTP connection failed',
          details: verifyError.message,
          emailConfig: {
            host: process.env.EMAIL_SERVER_HOST,
            port: process.env.EMAIL_SERVER_PORT,
            user: process.env.EMAIL_SERVER_USER,
            from: process.env.EMAIL_FROM
          }
        },
        { status: 500 }
      );
    }

    // Default subject and message
    const emailSubject = subject || 'Test Email from ChangeWorks';
    const emailMessage = message || 'This is a test email to verify email functionality is working correctly.';

    // Send email
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: to,
      subject: emailSubject,
      text: emailMessage,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${emailSubject}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .container {
              background-color: #ffffff;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              border: 1px solid #e9ecef;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #302E56;
              padding-bottom: 25px;
              margin-bottom: 35px;
            }
            .header h1 {
              color: #302E56;
              margin: 0;
              font-size: 32px;
              font-weight: 600;
            }
            .content {
              margin-bottom: 35px;
            }
            .content p {
              margin-bottom: 18px;
              font-size: 16px;
              color: #495057;
            }
            .test-box {
              background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
              border: 1px solid #c3e6cb;
              padding: 25px;
              border-radius: 10px;
              margin: 25px 0;
              border-left: 4px solid #28a745;
              text-align: center;
            }
            .test-box h3 {
              color: #155724;
              margin-top: 0;
              margin-bottom: 15px;
              font-size: 20px;
              font-weight: 600;
            }
            .test-box p {
              margin: 0;
              color: #155724;
              font-weight: 500;
            }
            .footer {
              border-top: 2px solid #e9ecef;
              padding-top: 25px;
              margin-top: 35px;
              text-align: center;
              color: #6c757d;
              font-size: 14px;
            }
            .info-table {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .info-table table {
              width: 100%;
              border-collapse: collapse;
            }
            .info-table td {
              padding: 8px;
              border-bottom: 1px solid #dee2e6;
            }
            .info-table td:first-child {
              font-weight: 600;
              color: #302E56;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Test Email</h1>
            </div>
            
            <div class="content">
              <div class="test-box">
                <h3>🎉 Email System Working!</h3>
                <p>If you're reading this, your email configuration is working correctly.</p>
              </div>
              
              <p><strong>Message:</strong></p>
              <p>${emailMessage}</p>
              
              <div class="info-table">
                <table>
                  <tr>
                    <td>Sent From:</td>
                    <td>${process.env.EMAIL_FROM}</td>
                  </tr>
                  <tr>
                    <td>Sent To:</td>
                    <td>${to}</td>
                  </tr>
                  <tr>
                    <td>Sent At:</td>
                    <td>${new Date().toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>Email Server:</td>
                    <td>${process.env.EMAIL_SERVER_HOST}:${process.env.EMAIL_SERVER_PORT}</td>
                  </tr>
                </table>
              </div>
              
              <p>This is a test email from the ChangeWorks platform to verify that email functionality is configured correctly.</p>
            </div>
            
            <div class="footer">
              <p style="color: #6c757d; font-size: 14px;">
                ChangeWorks Fund - Email System Test<br>
                This is an automated test message.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('✅ Test email sent successfully:', info.messageId);

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      emailInfo: {
        messageId: info.messageId,
        to: to,
        from: process.env.EMAIL_FROM,
        subject: emailSubject,
        sentAt: new Date().toISOString()
      },
      emailConfig: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        from: process.env.EMAIL_FROM,
        secure: false
      }
    });

  } catch (error) {
    console.error('❌ Error sending test email:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to send test email', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// GET /api/email/test-email - Check email configuration
export async function GET(request) {
  try {
    const hasEmailConfig = 
      process.env.EMAIL_SERVER_HOST && 
      process.env.EMAIL_SERVER_PORT && 
      process.env.EMAIL_SERVER_USER && 
      process.env.EMAIL_SERVER_PASSWORD && 
      process.env.EMAIL_FROM;

    const emailConfig = {
      host: process.env.EMAIL_SERVER_HOST || 'Not configured',
      port: process.env.EMAIL_SERVER_PORT || 'Not configured',
      user: process.env.EMAIL_SERVER_USER ? 'Configured (hidden)' : 'Not configured',
      password: process.env.EMAIL_SERVER_PASSWORD ? 'Configured (hidden)' : 'Not configured',
      from: process.env.EMAIL_FROM || 'Not configured',
      configured: hasEmailConfig
    };

    if (!hasEmailConfig) {
      return NextResponse.json({
        success: false,
        message: 'Email server not fully configured',
        emailConfig: emailConfig,
        instructions: 'Please set the following environment variables: EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_SERVER_USER, EMAIL_SERVER_PASSWORD, EMAIL_FROM'
      }, { status: 200 });
    }

    // Test SMTP connection
    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    try {
      await transport.verify();
      return NextResponse.json({
        success: true,
        message: 'Email server configuration is valid and connection successful',
        emailConfig: emailConfig,
        connectionTest: 'PASSED ✅'
      });
    } catch (verifyError) {
      return NextResponse.json({
        success: false,
        message: 'Email server configuration exists but connection failed',
        emailConfig: emailConfig,
        connectionTest: 'FAILED ❌',
        error: verifyError.message
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error checking email configuration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check email configuration', details: error.message },
      { status: 500 }
    );
  }
}

