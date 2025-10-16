import nodemailer from 'nodemailer';

// Email service that reads configuration from environment variables
class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: parseInt(process.env.EMAIL_SERVER_PORT),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Verify email configuration
  async verifyConnection() {
    try {
      await this.transporter.verify();
      return { success: true, message: 'Email configuration verified' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send email with HTML and text content
  async sendEmail({ to, subject, html, text, from = null }) {
    try {
      const mailOptions = {
        from: from || process.env.EMAIL_FROM,
        to: to,
        subject: subject,
        html: html,
        text: text
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: info.messageId,
        message: 'Email sent successfully'
      };
    } catch (error) {
      console.error('Email sending error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send verification email to donor
  async sendVerificationEmail({ donor, verificationToken, verificationLink, organization }) {
    const orgName = organization?.name || 'ChangeWorks Fund';
    const subject = `Welcome to ${orgName}'s round-up community`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${orgName}'s round-up community</title>
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
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .content {
            margin-bottom: 35px;
          }
          .content p {
            margin-bottom: 18px;
            font-size: 16px;
            color: #495057;
          }
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #212529;
            margin-bottom: 25px;
          }
          .verification-box {
            background: linear-gradient(135deg, #E6E6F0 0%, #D3D2E0 100%);
            padding: 25px;
            border-radius: 10px;
            margin: 25px 0;
            border-left: 4px solid #302E56;
            text-align: center;
          }
          .verification-box h3 {
            color: #302E56;
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 18px;
            font-weight: 600;
          }
          .verify-button {
            display: inline-block;
            background: linear-gradient(135deg, #302E56 0%, #4A487A 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(48, 46, 86, 0.3);
            transition: all 0.3s ease;
          }
          .verify-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(48, 46, 86, 0.4);
            color: white;
          }
          .features {
            background-color: #f8f9fa;
            padding: 25px;
            border-radius: 10px;
            margin: 25px 0;
            border-left: 4px solid #302E56;
          }
          .features h3 {
            color: #302E56;
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 18px;
            font-weight: 600;
          }
          .features ul {
            margin: 0;
            padding-left: 20px;
            color: #495057;
          }
          .features li {
            margin-bottom: 8px;
          }
          .footer {
            border-top: 2px solid #e9ecef;
            padding-top: 25px;
            margin-top: 35px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .logo-section {
            text-align: center;
            margin: 30px 0;
          }
          .logo-section img {
            max-width: 200px;
            height: auto;
          }
          .contact-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 25px;
            text-align: center;
          }
          .contact-info h4 {
            color: #302E56;
            margin: 0 0 10px 0;
            font-size: 16px;
          }
          .contact-info p {
            margin: 5px 0;
            color: #495057;
            font-size: 14px;
          }
          .ps-note {
            background: linear-gradient(135deg, #e8f4fd 0%, #d1ecf1 100%);
            border: 1px solid #bee5eb;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #302E56;
          }
          .ps-note p {
            margin: 0;
            color: #0c5460;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${orgName}'s round-up community</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${donor.name},</p>
            
            <p>Thank you for joining ${orgName}'s round-up program. Your everyday purchases will now round up to the nearest dollar, turning your spare change into real change for the people we serve.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" class="verify-button" style="color: white;">Verify Your Email Address</a>
            </div>
            
            <p>You can view your donation activity anytime through your personalized Donor Portal <a href="${verificationLink}" style="color: #302E56; text-decoration: underline;">[Dashboard Link]</a> on ChangeWorks, our platform partner. That's where you'll be able to:</p>
            
            <div class="features">
              <h3>Your Donor Portal Features:</h3>
              <ul>
                <li>Track your monthly round-up totals</li>
                <li>Adjust or pause your contributions at any time</li>
                <li>Download donation records for your own files</li>
              </ul>
            </div>
            
            <p>We're so glad to have you as part of our round-up community, where even pennies can create lasting change.</p>
            
            <p><strong>With gratitude,<br>${orgName} Team</strong></p>
            
            <div class="ps-note">
              <p><strong>P.S.</strong> At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.</p>
            </div>
          </div>
          
          <div class="footer">
            <div class="logo-section">
              <img src="${process.env.NEXT_PUBLIC_BASE_URL}/imgs/changeworks.jpg" alt="ChangeWorks Logo" />
            </div>
            
            <div class="contact-info">
              <h4>ChangeWorks Fund</h4>
              <p>Your trusted platform partner for charitable giving</p>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
              
              <h4>Contact Information</h4>
              <p><strong>Email:</strong> info@rapidtechpro.com</p>
              <p><strong>Phone:</strong> +923474308859</p>
              <p><strong>Address:</strong> NY-123 Younkers, New York</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to ${orgName}'s round-up community

Hello ${donor.name},

Thank you for joining ${orgName}'s round-up program. Your everyday purchases will now round up to the nearest dollar, turning your spare change into real change for the people we serve.

IMPORTANT: Please verify your email address by clicking this link:
${verificationLink}

You can view your donation activity anytime through your personalized Donor Portal [Dashboard Link] on ChangeWorks, our platform partner. That's where you'll be able to:

- Track your monthly round-up totals
- Adjust or pause your contributions at any time
- Download donation records for your own files

We're so glad to have you as part of our round-up community, where even pennies can create lasting change.

With gratitude,
${orgName} Team

P.S. At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.

---
ChangeWorks Fund
Your trusted platform partner for charitable giving

Contact Information:
Email: info@rapidtechpro.com
Phone: +923474308859
Address: NY-123 Younkers, New York
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text
    });
  }

  // Send monthly impact email to donor
  async sendMonthlyImpactEmail({ donor, organization, dashboardLink, month, totalAmount }) {
    const subject = `See what change your change made this month`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Monthly Impact - ${organization.name}</title>
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
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 35px;
          }
          .content p {
            margin-bottom: 18px;
            font-size: 16px;
            color: #495057;
          }
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #212529;
            margin-bottom: 25px;
          }
          .impact-highlight {
            background: linear-gradient(135deg, #302E56 0%, #4A487A 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin: 25px 0;
            text-align: center;
            box-shadow: 0 8px 25px rgba(48, 46, 86, 0.3);
          }
          .impact-highlight h2 {
            margin: 0 0 15px 0;
            font-size: 24px;
            font-weight: 600;
          }
          .impact-amount {
            font-size: 36px;
            font-weight: 700;
            margin: 10px 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .impact-month {
            font-size: 18px;
            opacity: 0.9;
            margin: 0;
          }
          .dashboard-button {
            display: inline-block;
            background: linear-gradient(135deg, #302E56 0%, #4A487A 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 25px 0;
            box-shadow: 0 4px 15px rgba(48, 46, 86, 0.3);
            transition: all 0.3s ease;
          }
          .dashboard-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(48, 46, 86, 0.4);
          }
          .footer {
            border-top: 2px solid #e9ecef;
            padding-top: 25px;
            margin-top: 35px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .signature {
            margin-top: 30px;
            font-style: italic;
            color: #495057;
          }
          .gratitude-section {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 1px solid #ffeaa7;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #ffc107;
          }
          .gratitude-section p {
            margin: 0;
            color: #856404;
            font-weight: 500;
            font-size: 16px;
          }
          .contact-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 25px;
            text-align: center;
          }
          .contact-info h4 {
            color: #302E56;
            margin: 0 0 10px 0;
            font-size: 16px;
          }
          .contact-info p {
            margin: 5px 0;
            color: #495057;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/imgs/changeworks.jpg" alt="ChangeWorks Logo" class="logo">
            <h1>Your Monthly Impact</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${donor.name},</p>
            
            <div class="impact-highlight">
              <h2>Your Impact This Month</h2>
              <div class="impact-amount">$${totalAmount}</div>
              <p class="impact-month">${month}</p>
            </div>
            
            <p>Your everyday purchases made a difference in <strong>${month}</strong>. Altogether, your round-ups added up to <strong>$${totalAmount}</strong> for <strong>${organization.name}</strong>.</p>
            
            <p>If you want to see details of your round-up donations or make changes, log into your Donor Portal <a href="${dashboardLink}" style="color: #302E56; text-decoration: underline;">[Dashboard Link]</a> on ChangeWorks, our platform partner. That's where you can see your giving history, adjust settings, or download your records anytime.</p>
            
            <div style="text-align: center;">
              <a href="${dashboardLink}" class="dashboard-button">Access Your Donor Portal</a>
            </div>
            
            <div class="gratitude-section">
              <p>Thank you for carrying our mission forward with every swipe, tap, and purchase. Small change, month after month, can create lasting change in our community.</p>
            </div>
            
            <div class="signature">
              <p>With gratitude,<br>
              <strong>${organization.name} Team</strong></p>
            </div>
          </div>
          
          <div class="footer">
            <div class="contact-info">
              <h4>ChangeWorks Fund</h4>
              <p>Your trusted platform partner for charitable giving</p>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
              
              <h4>Contact Information</h4>
              <p><strong>Email:</strong> info@rapidtechpro.com</p>
              <p><strong>Phone:</strong> +923474308859</p>
              <p><strong>Address:</strong> NY-123 Younkers, New York</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
See what change your change made this month

Hello ${donor.name},

Your everyday purchases made a difference in ${month}. Altogether, your round-ups added up to $${totalAmount} for ${organization.name}.

If you want to see details of your round-up donations or make changes, log into your Donor Portal [Dashboard Link] on ChangeWorks, our platform partner. That's where you can see your giving history, adjust settings, or download your records anytime.

Access Your Donor Portal: ${dashboardLink}

Thank you for carrying our mission forward with every swipe, tap, and purchase. Small change, month after month, can create lasting change in our community.

With gratitude,
${organization.name} Team

---
ChangeWorks Fund
Your trusted platform partner for charitable giving

Contact Information:
Email: info@rapidtechpro.com
Phone: +923474308859
Address: NY-123 Younkers, New York
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text
    });
  }

  // Send one-time donation confirmation email
  async sendOneTimeDonationEmail({ donor, organization, dashboardLink, amount, donationDate }) {
    const subject = `Thank you for your one-time donation to ${organization.name}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Donation Confirmation - ${organization.name}</title>
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
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 35px;
          }
          .content p {
            margin-bottom: 18px;
            font-size: 16px;
            color: #495057;
          }
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #212529;
            margin-bottom: 25px;
          }
          .donation-highlight {
            background: linear-gradient(135deg, #302E56 0%, #4A487A 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin: 25px 0;
            text-align: center;
            box-shadow: 0 8px 25px rgba(48, 46, 86, 0.3);
          }
          .donation-highlight h2 {
            margin: 0 0 15px 0;
            font-size: 24px;
            font-weight: 600;
          }
          .donation-amount {
            font-size: 36px;
            font-weight: 700;
            margin: 10px 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .donation-date {
            font-size: 18px;
            opacity: 0.9;
            margin: 0;
          }
          .dashboard-button {
            display: inline-block;
            background: linear-gradient(135deg, #302E56 0%, #4A487A 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 25px 0;
            box-shadow: 0 4px 15px rgba(48, 46, 86, 0.3);
            transition: all 0.3s ease;
          }
          .dashboard-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(48, 46, 86, 0.4);
          }
          .footer {
            border-top: 2px solid #e9ecef;
            padding-top: 25px;
            margin-top: 35px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .signature {
            margin-top: 30px;
            font-style: italic;
            color: #495057;
          }
          .gratitude-section {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 1px solid #ffeaa7;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #ffc107;
          }
          .gratitude-section p {
            margin: 0;
            color: #856404;
            font-weight: 500;
            font-size: 16px;
          }
          .contact-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 25px;
            text-align: center;
          }
          .contact-info h4 {
            color: #302E56;
            margin: 0 0 10px 0;
            font-size: 16px;
          }
          .contact-info p {
            margin: 5px 0;
            color: #495057;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/imgs/changeworks.jpg" alt="ChangeWorks Logo" class="logo">
            <h1>Donation Confirmation</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${donor.name},</p>
            
            <div class="donation-highlight">
              <h2>Thank You for Your Donation!</h2>
              <div class="donation-amount">$${amount}</div>
              <p class="donation-date">${donationDate}</p>
            </div>
            
            <p>Your generous one-time donation of <strong>$${amount}</strong> to <strong>${organization.name}</strong> will make a real difference in our community.</p>
            
            <p>If you want to see details of your donation or make changes, log into your Donor Portal <a href="${dashboardLink}" style="color: #302E56; text-decoration: underline;">[Dashboard Link]</a> on ChangeWorks, our platform partner. That's where you can see your giving history, adjust settings, or download your records anytime.</p>
            
            <div style="text-align: center;">
              <a href="${dashboardLink}" class="dashboard-button" style="color: white;">Access Your Donor Portal</a>
            </div>
            
            <div class="gratitude-section">
              <p>Thank you for carrying our mission forward with your generous support. Your contribution helps create lasting change in our community.</p>
            </div>
            
            <div class="signature">
              <p>With gratitude,<br>
              <strong>${organization.name} Team</strong></p>
            </div>
          </div>
          
          <div class="footer">
            <div class="contact-info">
              <h4>ChangeWorks Fund</h4>
              <p>Your trusted platform partner for charitable giving</p>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
              
              <h4>Contact Information</h4>
              <p><strong>Email:</strong> info@rapidtechpro.com</p>
              <p><strong>Phone:</strong> +923474308859</p>
              <p><strong>Address:</strong> NY-123 Younkers, New York</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Thank you for your one-time donation to ${organization.name}

Hello ${donor.name},

Your generous one-time donation of $${amount} to ${organization.name} will make a real difference in our community.

If you want to see details of your donation or make changes, log into your Donor Portal [Dashboard Link] on ChangeWorks, our platform partner. That's where you can see your giving history, adjust settings, or download your records anytime.

Access Your Donor Portal: ${dashboardLink}

Thank you for carrying our mission forward with your generous support. Your contribution helps create lasting change in our community.

With gratitude,
${organization.name} Team

---
ChangeWorks Fund
Your trusted platform partner for charitable giving

Contact Information:
Email: info@rapidtechpro.com
Phone: +923474308859
Address: NY-123 Younkers, New York
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text
    });
  }

  // Send recurring payment confirmation email
  async sendRecurringPaymentEmail({ donor, organization, dashboardLink, amount, paymentDate, nextPaymentDate }) {
    const subject = `Your recurring donation to ${organization.name} has been processed`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recurring Payment Confirmation - ${organization.name}</title>
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
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 35px;
          }
          .content p {
            margin-bottom: 18px;
            font-size: 16px;
            color: #495057;
          }
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #212529;
            margin-bottom: 25px;
          }
          .payment-highlight {
            background: linear-gradient(135deg, #302E56 0%, #4A487A 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin: 25px 0;
            text-align: center;
            box-shadow: 0 8px 25px rgba(48, 46, 86, 0.3);
          }
          .payment-highlight h2 {
            margin: 0 0 15px 0;
            font-size: 24px;
            font-weight: 600;
          }
          .payment-amount {
            font-size: 36px;
            font-weight: 700;
            margin: 10px 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .payment-date {
            font-size: 18px;
            opacity: 0.9;
            margin: 0;
          }
          .next-payment {
            background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
            border: 1px solid #bee5eb;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #17a2b8;
            text-align: center;
          }
          .next-payment p {
            margin: 0;
            color: #0c5460;
            font-weight: 500;
            font-size: 16px;
          }
          .dashboard-button {
            display: inline-block;
            background: linear-gradient(135deg, #302E56 0%, #4A487A 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 25px 0;
            box-shadow: 0 4px 15px rgba(48, 46, 86, 0.3);
            transition: all 0.3s ease;
          }
          .dashboard-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(48, 46, 86, 0.4);
          }
          .footer {
            border-top: 2px solid #e9ecef;
            padding-top: 25px;
            margin-top: 35px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .signature {
            margin-top: 30px;
            font-style: italic;
            color: #495057;
          }
          .gratitude-section {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 1px solid #ffeaa7;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #ffc107;
          }
          .gratitude-section p {
            margin: 0;
            color: #856404;
            font-weight: 500;
            font-size: 16px;
          }
          .contact-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 25px;
            text-align: center;
          }
          .contact-info h4 {
            color: #302E56;
            margin: 0 0 10px 0;
            font-size: 16px;
          }
          .contact-info p {
            margin: 5px 0;
            color: #495057;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/imgs/changeworks.jpg" alt="ChangeWorks Logo" class="logo">
            <h1>Recurring Payment Confirmation</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${donor.name},</p>
            
            <div class="payment-highlight">
              <h2>Payment Processed Successfully!</h2>
              <div class="payment-amount">$${amount}</div>
              <p class="payment-date">${paymentDate}</p>
            </div>
            
            <p>Your recurring donation of <strong>$${amount}</strong> to <strong>${organization.name}</strong> has been processed successfully.</p>
            
            <div class="next-payment">
              <p><strong>Next Payment:</strong> ${nextPaymentDate}</p>
            </div>
            
            <p>If you want to see details of your recurring donations or make changes, log into your Donor Portal <a href="${dashboardLink}" style="color: #302E56; text-decoration: underline;">[Dashboard Link]</a> on ChangeWorks, our platform partner. That's where you can see your giving history, adjust settings, or download your records anytime.</p>
            
            <div style="text-align: center;">
              <a href="${dashboardLink}" class="dashboard-button">Access Your Donor Portal</a>
            </div>
            
            <div class="gratitude-section">
              <p>Thank you for carrying our mission forward with your ongoing support. Your recurring contributions help create lasting change in our community.</p>
            </div>
            
            <div class="signature">
              <p>With gratitude,<br>
              <strong>${organization.name} Team</strong></p>
            </div>
          </div>
          
          <div class="footer">
            <div class="contact-info">
              <h4>ChangeWorks Fund</h4>
              <p>Your trusted platform partner for charitable giving</p>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
              
              <h4>Contact Information</h4>
              <p><strong>Email:</strong> info@rapidtechpro.com</p>
              <p><strong>Phone:</strong> +923474308859</p>
              <p><strong>Address:</strong> NY-123 Younkers, New York</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Your recurring donation to ${organization.name} has been processed

Hello ${donor.name},

Your recurring donation of $${amount} to ${organization.name} has been processed successfully.

Next Payment: ${nextPaymentDate}

If you want to see details of your recurring donations or make changes, log into your Donor Portal [Dashboard Link] on ChangeWorks, our platform partner. That's where you can see your giving history, adjust settings, or download your records anytime.

Access Your Donor Portal: ${dashboardLink}

Thank you for carrying our mission forward with your ongoing support. Your recurring contributions help create lasting change in our community.

With gratitude,
${organization.name} Team

---
ChangeWorks Fund
Your trusted platform partner for charitable giving

Contact Information:
Email: info@rapidtechpro.com
Phone: +923474308859
Address: NY-123 Younkers, New York
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text
    });
  }

  // Send recurring change donation confirmation email
  async sendRecurringChangeDonationEmail({ donor, organization, dashboardLink, amount, donationDate }) {
    const subject = `Your recurring change donation to ${organization.name} is active`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recurring Change Donation Active - ${organization.name}</title>
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
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 35px;
          }
          .content p {
            margin-bottom: 18px;
            font-size: 16px;
            color: #495057;
          }
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #212529;
            margin-bottom: 25px;
          }
          .change-highlight {
            background: linear-gradient(135deg, #302E56 0%, #4A487A 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin: 25px 0;
            text-align: center;
            box-shadow: 0 8px 25px rgba(48, 46, 86, 0.3);
          }
          .change-highlight h2 {
            margin: 0 0 15px 0;
            font-size: 24px;
            font-weight: 600;
          }
          .change-amount {
            font-size: 36px;
            font-weight: 700;
            margin: 10px 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .change-date {
            font-size: 18px;
            opacity: 0.9;
            margin: 0;
          }
          .change-info {
            background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
            border: 1px solid #bee5eb;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #17a2b8;
          }
          .change-info p {
            margin: 0;
            color: #0c5460;
            font-weight: 500;
            font-size: 16px;
          }
          .dashboard-button {
            display: inline-block;
            background: linear-gradient(135deg, #302E56 0%, #4A487A 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 25px 0;
            box-shadow: 0 4px 15px rgba(48, 46, 86, 0.3);
            transition: all 0.3s ease;
          }
          .dashboard-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(48, 46, 86, 0.4);
          }
          .footer {
            border-top: 2px solid #e9ecef;
            padding-top: 25px;
            margin-top: 35px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .signature {
            margin-top: 30px;
            font-style: italic;
            color: #495057;
          }
          .gratitude-section {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 1px solid #ffeaa7;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #ffc107;
          }
          .gratitude-section p {
            margin: 0;
            color: #856404;
            font-weight: 500;
            font-size: 16px;
          }
          .contact-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 25px;
            text-align: center;
          }
          .contact-info h4 {
            color: #302E56;
            margin: 0 0 10px 0;
            font-size: 16px;
          }
          .contact-info p {
            margin: 5px 0;
            color: #495057;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/imgs/changeworks.jpg" alt="ChangeWorks Logo" class="logo">
            <h1>Recurring Change Donation Active</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${donor.name},</p>
            
            <div class="change-highlight">
              <h2>Your Change Donation is Active!</h2>
              <div class="change-amount">$${amount}</div>
              <p class="change-date">Started ${donationDate}</p>
            </div>
            
            <p>Your recurring change donation of <strong>$${amount}</strong> to <strong>${organization.name}</strong> is now active and will automatically round up your everyday purchases.</p>
            
            <div class="change-info">
              <p><strong>How it works:</strong> Every time you make a purchase, the amount will be rounded up to the nearest dollar, and the difference will be donated to ${organization.name}.</p>
            </div>
            
            <p>If you want to see details of your change donations or make changes, log into your Donor Portal <a href="${dashboardLink}" style="color: #302E56; text-decoration: underline;">[Dashboard Link]</a> on ChangeWorks, our platform partner. That's where you can see your giving history, adjust settings, or download your records anytime.</p>
            
            <div style="text-align: center;">
              <a href="${dashboardLink}" class="dashboard-button">Access Your Donor Portal</a>
            </div>
            
            <div class="gratitude-section">
              <p>Thank you for carrying our mission forward with every swipe, tap, and purchase. Small change, month after month, can create lasting change in our community.</p>
            </div>
            
            <div class="signature">
              <p>With gratitude,<br>
              <strong>${organization.name} Team</strong></p>
            </div>
          </div>
          
          <div class="footer">
            <div class="contact-info">
              <h4>ChangeWorks Fund</h4>
              <p>Your trusted platform partner for charitable giving</p>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
              
              <h4>Contact Information</h4>
              <p><strong>Email:</strong> info@rapidtechpro.com</p>
              <p><strong>Phone:</strong> +923474308859</p>
              <p><strong>Address:</strong> NY-123 Younkers, New York</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Your recurring change donation to ${organization.name} is active

Hello ${donor.name},

Your recurring change donation of $${amount} to ${organization.name} is now active and will automatically round up your everyday purchases.

How it works: Every time you make a purchase, the amount will be rounded up to the nearest dollar, and the difference will be donated to ${organization.name}.

If you want to see details of your change donations or make changes, log into your Donor Portal [Dashboard Link] on ChangeWorks, our platform partner. That's where you can see your giving history, adjust settings, or download your records anytime.

Access Your Donor Portal: ${dashboardLink}

Thank you for carrying our mission forward with every swipe, tap, and purchase. Small change, month after month, can create lasting change in our community.

With gratitude,
${organization.name} Team

---
ChangeWorks Fund
Your trusted platform partner for charitable giving

Contact Information:
Email: info@rapidtechpro.com
Phone: +923474308859
Address: NY-123 Younkers, New York
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text
    });
  }

  // Send card failure alert email to donor
  async sendCardFailureAlertEmail({ donor, organization, dashboardLink }) {
    const subject = `ACTION NEEDED: Please update your ${organization.name} round-up card`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Card Update Required - ${organization.name}</title>
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
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 35px;
          }
          .content p {
            margin-bottom: 18px;
            font-size: 16px;
            color: #495057;
          }
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #212529;
            margin-bottom: 25px;
          }
          .alert-box {
            background: linear-gradient(135deg, #E6E6F0 0%, #D3D2E0 100%);
            border: 1px solid #D3D2E0;
            padding: 25px;
            border-radius: 10px;
            margin: 25px 0;
            border-left: 4px solid #302E56;
            text-align: center;
          }
          .alert-box h3 {
            color: #302E56;
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 20px;
            font-weight: 600;
          }
          .alert-box p {
            margin: 0;
            color: #302E56;
            font-weight: 500;
          }
          .update-button {
            display: inline-block;
            background: linear-gradient(135deg, #302E56 0%, #4A487A 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 25px 0;
            box-shadow: 0 4px 15px rgba(48, 46, 86, 0.3);
            transition: all 0.3s ease;
          }
          .update-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(48, 46, 86, 0.4);
          }
          .footer {
            border-top: 2px solid #e9ecef;
            padding-top: 25px;
            margin-top: 35px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .signature {
            margin-top: 30px;
            font-style: italic;
            color: #495057;
          }
          .ps-section {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 1px solid #ffeaa7;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #ffc107;
          }
          .ps-section p {
            margin: 0;
            color: #856404;
            font-weight: 500;
          }
          .contact-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 25px;
            text-align: center;
          }
          .contact-info h4 {
            color: #302E56;
            margin: 0 0 10px 0;
            font-size: 16px;
          }
          .contact-info p {
            margin: 5px 0;
            color: #495057;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/imgs/changeworks.jpg" alt="ChangeWorks Logo" class="logo">
            <h1>Card Update Required</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${donor.name},</p>
            
            <div class="alert-box">
              <h3>⚠️ Card Not Working Alert</h3>
              <p>We noticed your round-up card on file isn't working right now. It's an easy fix — simply update your card details in your Donor Portal on ChangeWorks, our platform partner.</p>
            </div>
            
            <p>When you update your card, your purchases will keep rounding up automatically, and your ongoing support for <strong>${organization.name}</strong> will keep making a difference in the community.</p>
            
            <div style="text-align: center;">
              <a href="${dashboardLink}" class="update-button">Update Your Card Now</a>
            </div>
            
            <p>Thank you for being part of our round-up community. Every swipe, tap, and purchase you make helps carry our mission forward — and we don't want you to miss a single moment of impact.</p>
            
            <div class="signature">
              <p>With gratitude,<br>
              <strong>${organization.name} Team</strong></p>
            </div>
            
            <div class="ps-section">
              <p><strong>P.S.</strong> If you have any questions or need assistance, reply to this email and we'll be glad to help.</p>
            </div>
          </div>
          
          <div class="footer">
            <div class="contact-info">
              <h4>ChangeWorks Fund</h4>
              <p>Your trusted platform partner for charitable giving</p>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
              
              <h4>Contact Information</h4>
              <p><strong>Email:</strong> info@rapidtechpro.com</p>
              <p><strong>Phone:</strong> +923474308859</p>
              <p><strong>Address:</strong> NY-123 Younkers, New York</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
ACTION NEEDED: Please update your ${organization.name} round-up card

Hello ${donor.name},

We noticed your round-up card on file isn't working right now. It's an easy fix — simply update your card details in your Donor Portal on ChangeWorks, our platform partner.

When you update your card, your purchases will keep rounding up automatically, and your ongoing support for ${organization.name} will keep making a difference in the community.

Update Your Card: ${dashboardLink}

Thank you for being part of our round-up community. Every swipe, tap, and purchase you make helps carry our mission forward — and we don't want you to miss a single moment of impact.

With gratitude,
${organization.name} Team

P.S. If you have any questions or need assistance, reply to this email and we'll be glad to help.

---
ChangeWorks Fund
Your trusted platform partner for charitable giving

Contact Information:
Email: info@rapidtechpro.com
Phone: +923474308859
Address: NY-123 Younkers, New York
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text
    });
  }

  // Send final reminder email for card failure
  async sendCardFailureFinalReminderEmail({ donor, organization, dashboardLink }) {
    const subject = `LAST REMINDER: Please update your ${organization.name} round-up card`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Final Reminder - Card Update Required</title>
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
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 35px;
          }
          .content p {
            margin-bottom: 18px;
            font-size: 16px;
            color: #495057;
          }
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #212529;
            margin-bottom: 25px;
          }
          .urgent-box {
            background: linear-gradient(135deg, #E6E6F0 0%, #D3D2E0 100%);
            border: 1px solid #D3D2E0;
            padding: 25px;
            border-radius: 10px;
            margin: 25px 0;
            border-left: 4px solid #302E56;
            text-align: center;
          }
          .urgent-box h3 {
            color: #302E56;
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 20px;
            font-weight: 600;
          }
          .urgent-box p {
            margin: 0;
            color: #302E56;
            font-weight: 500;
          }
          .update-button {
            display: inline-block;
            background: linear-gradient(135deg, #302E56 0%, #4A487A 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 25px 0;
            box-shadow: 0 4px 15px rgba(48, 46, 86, 0.3);
            transition: all 0.3s ease;
          }
          .update-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(48, 46, 86, 0.4);
          }
          .footer {
            border-top: 2px solid #e9ecef;
            padding-top: 25px;
            margin-top: 35px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .signature {
            margin-top: 30px;
            font-style: italic;
            color: #495057;
          }
          .impact-message {
            background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
            border: 1px solid #bee5eb;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #17a2b8;
          }
          .impact-message p {
            margin: 0;
            color: #0c5460;
            font-weight: 500;
          }
          .contact-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 25px;
            text-align: center;
          }
          .contact-info h4 {
            color: #302E56;
            margin: 0 0 10px 0;
            font-size: 16px;
          }
          .contact-info p {
            margin: 5px 0;
            color: #495057;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/imgs/changeworks.jpg" alt="ChangeWorks Logo" class="logo">
            <h1>Final Reminder</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${donor.name},</p>
            
            <div class="urgent-box">
              <h3>🚨 LAST REMINDER</h3>
              <p>Right now, your round-up card on file still isn't working, which means your spare change isn't reaching us — and not reaching the people that together we serve.</p>
            </div>
            
            <p>Please take a moment today to update your card details in your Donor Portal on ChangeWorks, our platform partner.</p>
            
            <div style="text-align: center;">
              <a href="${dashboardLink}" class="update-button">Update Your Card Today</a>
            </div>
            
            <div class="impact-message">
              <p>Your continued support helps us plan ahead and deliver on our mission. Your pennies matter — and when they pause, so does the change you help us make happen.</p>
            </div>
            
            <p>Thank you for updating your card and for being such an important part of our community.</p>
            
            <div class="signature">
              <p>With appreciation,<br>
              <strong>${organization.name} Team</strong></p>
            </div>
          </div>
          
          <div class="footer">
            <div class="contact-info">
              <h4>ChangeWorks Fund</h4>
              <p>Your trusted platform partner for charitable giving</p>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
              
              <h4>Contact Information</h4>
              <p><strong>Email:</strong> info@rapidtechpro.com</p>
              <p><strong>Phone:</strong> +923474308859</p>
              <p><strong>Address:</strong> NY-123 Younkers, New York</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
LAST REMINDER: Please update your ${organization.name} round-up card

Hello ${donor.name},

Right now, your round-up card on file still isn't working, which means your spare change isn't reaching us — and not reaching the people that together we serve.

Please take a moment today to update your card details in your Donor Portal on ChangeWorks, our platform partner.

Update Your Card: ${dashboardLink}

Your continued support helps us plan ahead and deliver on our mission. Your pennies matter — and when they pause, so does the change you help us make happen.

Thank you for updating your card and for being such an important part of our community.

With appreciation,
${organization.name} Team

---
ChangeWorks Fund
Your trusted platform partner for charitable giving

Contact Information:
Email: info@rapidtechpro.com
Phone: +923474308859
Address: NY-123 Younkers, New York
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text
    });
  }

  // Send successful verification email to donor
  async sendVerificationSuccessEmail({ donor, organization, dashboardLink }) {
    const subject = `Welcome to ${organization.name}'s round-up community`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${organization.name}'s round-up community</title>
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
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 35px;
          }
          .content p {
            margin-bottom: 18px;
            font-size: 16px;
            color: #495057;
          }
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #212529;
            margin-bottom: 25px;
          }
          .features {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 25px;
            border-radius: 10px;
            margin: 25px 0;
            border-left: 4px solid #302E56;
          }
          .features h3 {
            color: #302E56;
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 18px;
            font-weight: 600;
          }
          .features ul {
            margin: 0;
            padding-left: 20px;
          }
          .features li {
            margin-bottom: 10px;
            color: #495057;
            font-size: 15px;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #302E56 0%, #0E0061 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 25px 0;
            box-shadow: 0 4px 15px rgba(48, 46, 86, 0.3);
            transition: all 0.3s ease;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(48, 46, 86, 0.4);
          }
          .footer {
            border-top: 2px solid #e9ecef;
            padding-top: 25px;
            margin-top: 35px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .signature {
            margin-top: 30px;
            font-style: italic;
            color: #495057;
          }
          .contact-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 25px;
            text-align: center;
          }
          .contact-info h4 {
            color: #302E56;
            margin: 0 0 10px 0;
            font-size: 16px;
          }
          .contact-info p {
            margin: 5px 0;
            color: #495057;
            font-size: 14px;
          }
          .ps-note {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 20px;
            border-radius: 10px;
            margin: 25px 0;
            border-left: 4px solid #302E56;
            font-style: italic;
            color: #495057;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${(() => {
              const hasImage = organization.imageUrl;
              const imageUrl = organization.imageUrl;
              const baseUrl = process.env.IMAGE_UPLOAD_URL;
              const fallbackUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org';
              
              if (hasImage) {
                const logoUrl = `${baseUrl}/${imageUrl}`;
                return `<img src="${logoUrl}" alt="${organization.name} Logo" class="logo" style="max-width: 150px; height: auto; margin-bottom: 20px;">`;
              } else {
                return `<div style="height: 60px; background: #f8f9fa; border: 1px solid #dee2e6; display: flex; align-items: center; justify-content: center; color: #6c757d; font-size: 14px;">${organization?.name || 'Organization'} Logo</div>`;
              }
            })()}
            <h1>Welcome to ${organization.name}'s round-up community</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${donor.name},</p>
            
            <p>Thank you for joining ${organization.name}'s round-up program. Your everyday purchases will now round up to the nearest dollar, turning your spare change into real change for the people we serve.</p>
            
            <p>You can view your donation activity anytime through your personalized Donor Portal <a href="${dashboardLink}" style="color: #302E56; text-decoration: underline;">[Dashboard Link]</a> on ChangeWorks, our platform partner. That's where you'll be able to:</p>
            
            <div class="features">
              <h3>Your Donor Portal Features:</h3>
              <ul>
                <li>Track your monthly round-up totals</li>
                <li>Adjust or pause your contributions at any time</li>
                <li>Download donation records for your own files</li>
              </ul>
            </div>
            
            <p>We're so glad to have you as part of our round-up community, where even pennies can create lasting change.</p>
            
            <div class="signature">
              <p>With gratitude,<br>
              <strong>${organization.name} Team</strong></p>
            </div>
            
            <div class="ps-note">
              <p><strong>P.S.</strong> At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.</p>
            </div>
          </div>
          
          <div class="footer">
            <div class="contact-info">
              <h4>ChangeWorks Fund</h4>
              <p>Your trusted platform partner for charitable giving</p>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
              
              <h4>Contact Information</h4>
              <p><strong>Email:</strong> info@rapidtechpro.com</p>
              <p><strong>Phone:</strong> +923474308859</p>
              <p><strong>Address:</strong> NY-123 Younkers, New York</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to ${organization.name}'s round-up community

Hello ${donor.name},

Thank you for joining ${organization.name}'s round-up program. Your everyday purchases will now round up to the nearest dollar, turning your spare change into real change for the people we serve.

You can view your donation activity anytime through your personalized Donor Portal [Dashboard Link] on ChangeWorks, our platform partner. That's where you'll be able to:

- Track your monthly round-up totals
- Adjust or pause your contributions at any time
- Download donation records for your own files

We're so glad to have you as part of our round-up community, where even pennies can create lasting change.

With gratitude,
${organization.name} Team

P.S. At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.

---
ChangeWorks Fund
Your trusted platform partner for charitable giving

Contact Information:
Email: info@rapidtechpro.com
Phone: +923474308859
Address: NY-123 Younkers, New York
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text
    });
  }

  // Send welcome/thank you email to donor
  async sendWelcomeEmail({ donor, organization, dashboardLink }) {
    console.log('🔍 Welcome email - Organization data:', {
      id: organization.id,
      name: organization.name,
      imageUrl: organization.imageUrl
    });
    
    const subject = `Welcome to ${organization.name}'s round-up community`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${organization.name}</title>
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
            border-bottom: 3px solid #0E0061;
            padding-bottom: 25px;
            margin-bottom: 35px;
          }
          .header h1 {
            color: #0E0061;
            margin: 0;
            font-size: 32px;
            font-weight: 600;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 35px;
          }
          .content p {
            margin-bottom: 18px;
            font-size: 16px;
            color: #495057;
          }
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #212529;
            margin-bottom: 25px;
          }
          .features {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 25px;
            border-radius: 10px;
            margin: 25px 0;
            border-left: 4px solid #0E0061;
          }
          .features h3 {
            color: #0E0061;
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 18px;
            font-weight: 600;
          }
          .features ul {
            margin: 0;
            padding-left: 20px;
          }
          .features li {
            margin-bottom: 10px;
            color: #495057;
            font-size: 15px;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #0E0061 0%, #0C0055 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 25px 0;
            box-shadow: 0 4px 15px rgba(14, 0, 97, 0.3);
            transition: all 0.3s ease;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(14, 0, 97, 0.4);
          }
          .footer {
            border-top: 2px solid #e9ecef;
            padding-top: 25px;
            margin-top: 35px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .signature {
            margin-top: 30px;
            font-style: italic;
            color: #495057;
          }
          .ps {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 1px solid #ffeaa7;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #ffc107;
          }
          .ps p {
            margin: 0;
            color: #856404;
            font-weight: 500;
          }
          .contact-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 25px;
            text-align: center;
          }
          .contact-info h4 {
            color: #0E0061;
            margin: 0 0 10px 0;
            font-size: 16px;
          }
          .contact-info p {
            margin: 5px 0;
            color: #495057;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${process.env.IMAGE_BACK_URL}/${organization.imageUrl}" alt="ChangeWorks Logo" class="logo" />
            <h1>Welcome to ${organization.name}</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${donor.name},</p>
            
            <p>Thank you for joining <strong>${organization.name}</strong>'s round-up program. Your everyday purchases will now round up to the nearest dollar, turning your spare change into real change for the people we serve.</p>
            
            <p>You can view your donation activity anytime through your personalized Donor Portal <a href="${dashboardLink}" style="color: #0E0061; text-decoration: underline;">[Dashboard Link]</a> on ChangeWorks, our platform partner. That's where you'll be able to:</p>
            
            <div class="features">
              <h3>Your Donor Portal Features:</h3>
              <ul>
                <li>Track your monthly round-up totals</li>
                <li>Adjust or pause your contributions at any time</li>
                <li>Download donation records for your own files</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${dashboardLink}" class="cta-button">Access Your Donor Portal</a>
            </div>
            
            <p>We're so glad to have you as part of our round-up community, where even pennies can create lasting change.</p>
            
            <div class="signature">
              <p>With gratitude,<br>
              <strong>${organization.name} Team</strong></p>
            </div>
            
            <div class="ps">
              <p><strong>P.S.</strong> At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.</p>
            </div>
          </div>
          
          <div class="footer">
            <div class="contact-info">
              <h4>ChangeWorks Fund</h4>
              <p>Your trusted platform partner for charitable giving</p>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
              
              <h4>Contact Information</h4>
              <p><strong>Email:</strong> info@rapidtechpro.com</p>
              <p><strong>Phone:</strong> +923474308859</p>
              <p><strong>Address:</strong> NY-123 Younkers, New York</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to ${organization.name}'s round-up community

Hello ${donor.name},

Thank you for joining ${organization.name}'s round-up program. Your everyday purchases will now round up to the nearest dollar, turning your spare change into real change for the people we serve.

You can view your donation activity anytime through your personalized Donor Portal [Dashboard Link] on ChangeWorks, our platform partner. That's where you'll be able to:

- Track your monthly round-up totals
- Adjust or pause your contributions at any time
- Download donation records for your own files

Access Your Donor Portal: ${dashboardLink}

We're so glad to have you as part of our round-up community, where even pennies can create lasting change.

With gratitude,
${organization.name} Team

P.S. At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.

---
ChangeWorks Fund
Your trusted platform partner for charitable giving

Contact Information:
Email: info@rapidtechpro.com
Phone: +923474308859
Address: NY-123 Younkers, New York
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text
    });
  }

  // Send password reset email
  async sendPasswordResetEmail({ donor, resetToken, resetLink, organization }) {
    const subject = `Reset Your Password - ${organization.name}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #302E56 0%, #0E0061 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .reset-button { background: linear-gradient(135deg, #302E56 0%, #0E0061 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
          .reset-button:hover { background: linear-gradient(135deg, #0E0061 0%, #302E56 100%); }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; }
          .logo { max-width: 150px; height: auto; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${process.env.NEXT_PUBLIC_BASE_URL}/imgs/changeworks.jpg" alt="ChangeWorks Logo" class="logo" />
            <h1>Password Reset Request</h1>
          </div>
          
          <div class="content">
            <h2>Hello ${donor.name},</h2>
            
            <p>You requested a password reset for your donor account with <strong>${organization.name}</strong>.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="reset-button">Reset My Password</a>
            </div>
            
            <p><strong>This link will expire in 1 hour.</strong></p>
            
            <p>If you didn't request this password reset, please ignore this email. Your account remains secure.</p>
            
            <div class="footer">
              <p>Best regards,<br><strong>ChangeWorks Fund Team</strong></p>
              <p>Your trusted platform partner for charitable giving</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Password Reset Request - ${organization.name}

Hello ${donor.name},

You requested a password reset for your donor account with ${organization.name}.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email. Your account remains secure.

Best regards,
ChangeWorks Fund Team
Your trusted platform partner for charitable giving
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text
    });
  }

  // Send organization password reset email
  async sendOrganizationPasswordResetEmail({ organization, resetToken, resetLink }) {
    const subject = `Reset Your Organization Password - ${organization.name}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Organization Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #302E56 0%, #0E0061 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .reset-button { background: linear-gradient(135deg, #302E56 0%, #0E0061 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
          .reset-button:hover { background: linear-gradient(135deg, #0E0061 0%, #302E56 100%); }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; }
          .logo { max-width: 150px; height: auto; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${process.env.NEXT_PUBLIC_BASE_URL}/imgs/changeworks.jpg" alt="ChangeWorks Logo" class="logo" />
            <h1>Organization Password Reset</h1>
          </div>
          
          <div class="content">
            <h2>Hello ${organization.name} Team,</h2>
            
            <p>You requested a password reset for your organization account.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="reset-button">Reset Organization Password</a>
            </div>
            
            <p><strong>This link will expire in 1 hour.</strong></p>
            
            <p>If you didn't request this password reset, please ignore this email. Your account remains secure.</p>
            
            <div class="footer">
              <p>Best regards,<br><strong>ChangeWorks Fund Team</strong></p>
              <p>Your trusted platform partner for charitable giving</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Organization Password Reset - ${organization.name}

Hello ${organization.name} Team,

You requested a password reset for your organization account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email. Your account remains secure.

Best regards,
ChangeWorks Fund Team
Your trusted platform partner for charitable giving
    `;

    return await this.sendEmail({
      to: organization.email,
      subject: subject,
      html: html,
      text: text
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
