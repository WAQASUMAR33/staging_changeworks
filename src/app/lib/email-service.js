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
      const fromAddress = from || process.env.EMAIL_FROM || 'info@changeworksfund.org';
      
      console.log('📧 Sending email:', {
        to,
        subject,
        from: fromAddress,
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT
      });

      const mailOptions = {
        from: fromAddress,
        to: to,
        subject: subject,
        html: html,
        text: text
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent info:', info.messageId);

      return {
        success: true,
        messageId: info.messageId,
        message: 'Email sent successfully'
      };
    } catch (error) {
      console.error('❌ Email sending error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper to resolve logo URL
  getOrganizationLogoUrl(organization) {
    if (!organization?.imageUrl) return null;
    if (organization.imageUrl.startsWith('http')) return organization.imageUrl;
    
    // Check if it's a static asset (starts with /imgs/)
    // If so, use the app base URL
    if (organization.imageUrl.startsWith('/imgs/')) {
      let appBase = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
      if (!/^https?:\/\//i.test(appBase)) appBase = `https://${appBase}`;
      const cleanBase = appBase.endsWith('/') ? appBase.slice(0, -1) : appBase;
      return `${cleanBase}${organization.imageUrl}`;
    }

    // For uploaded images, use NEXT_PUBLIC_IMAGE_BACK_URL
    if (process.env.NEXT_PUBLIC_IMAGE_BACK_URL) {
       let imageBase = process.env.NEXT_PUBLIC_IMAGE_BACK_URL;
       const cleanBase = imageBase.endsWith('/') ? imageBase.slice(0, -1) : imageBase;
       const cleanPath = organization.imageUrl.startsWith('/') ? organization.imageUrl : `/${organization.imageUrl}`;
       return `${cleanBase}${cleanPath}`;
    }

    // Fallback to app URL if image back URL is not set
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
    if (!/^https?:\/\//i.test(baseUrl)) {
      baseUrl = `https://${baseUrl}`;
    }
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = organization.imageUrl.startsWith('/') ? organization.imageUrl : `/${organization.imageUrl}`;
    
    return `${cleanBase}${cleanPath}`;
  }

  // Helper to resolve ChangeWorks logo URL
  getChangeWorksLogoUrl() {
    let appBase = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
    if (!/^https?:\/\//i.test(appBase)) appBase = `https://${appBase}`;
    const cleanBase = appBase.endsWith('/') ? appBase.slice(0, -1) : appBase;
    return `${cleanBase}/imgs/changeworks.png`;
  }

  // Helper to generate consistent footer
  getFooterHtml() {
    const changeWorksLogoUrl = this.getChangeWorksLogoUrl();
    return `
      <!-- Footer -->
      <div style="margin-top: 40px; color: #6c757d; font-family: sans-serif;">
        <!-- Top Section: Left Aligned -->
        <div style="text-align: left; margin-bottom: 30px;">
            <p style="font-size: 12px; font-style: italic; color: #333; margin-bottom: 20px; border-top: 0; padding-top: 0;">
                This message was sent to help protect your account. Please do not reply directly to this email.
            </p>
            
            <div style="margin-bottom: 10px;">
                 <img src="${changeWorksLogoUrl}" alt="ChangeWorks Fund" style="max-height: 50px; height: auto; display: block;">
            </div>

            <h3 style="margin: 0 0 5px 0; color: #000; font-size: 16px; font-weight: 700;"><strong>ChangeWorks Fund</strong></h3>
            <p style="margin: 0 0 3px 0; font-size: 14px; color: #333;"><a href="https://changeworksfund.org" style="color: #0056b3; text-decoration: none;">ChangeWorksFund.Org</a></p>
            <p style="margin: 0; font-size: 14px; color: #333;">Your trusted platform partner for charitable giving</p>
        </div>

        <!-- Divider -->
        <div style="border-top: 1px solid #ccc; margin: 30px 0;"></div>

        <!-- Bottom Section: Centered -->
        <div style="text-align: center; font-size: 12px; color: #333;">
            <p style="font-weight: bold; margin-bottom: 10px; color: #302E56;">Contact Information</p>
            <p style="margin-bottom: 5px;">Email: <a href="mailto:support@changeworksfund.org" style="color: #0056b3; text-decoration: none;">support@changeworksfund.org</a></p>
            <p style="margin-bottom: 5px;">5830 E 2nd St. STE 7000 #29896</p>
            <p style="margin-bottom: 20px;">Casper, WY 82609</p>
            <p><a href="#" style="color: #0056b3; text-decoration: none;">Unsubscribe</a></p>
        </div>
      </div>
    `;
  }

  // Centralized HTML generator
  generateEmailHtml(content, organization, title = '', showOrgName = true, showFooter = true) {
    const logoUrl = this.getOrganizationLogoUrl(organization);
    const orgName = organization?.name || 'ChangeWorks Fund';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f3f2ef; /* Light gray background */
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          }
          /* Button style for compatibility */
          .button {
            display: inline-block;
            background-color: #302E56;
            color: #ffffff !important;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 24px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
          }
          .button:hover {
            background-color: #201e3b;
          }
          /* List styling */
          ul {
            padding-left: 20px;
            margin-bottom: 1.5em;
          }
          li {
            margin-bottom: 8px;
          }
          /* Highlight box */
          .highlight-box {
            background-color: #f8f9fa;
            border-left: 4px solid #302E56;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
          }
          /* Media Query for mobile */
          @media only screen and (max-width: 600px) {
            .main-table {
              width: 100% !important;
            }
            .content-cell {
              padding: 20px !important;
            }
          }
        </style>
      </head>
      <body style="background-color: #f3f2ef; margin: 0; padding: 0;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f2ef;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <!-- Main Card -->
              <table class="main-table" role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden; margin: 0 auto;">
                <tr>
                  <td class="content-cell" style="padding: 40px; text-align: left; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 16px; color: #333; line-height: 1.6;">
                    ${organization && showOrgName ? `
                      <div style="text-align: center; margin-bottom: 30px;">
                        ${logoUrl ? `<img src="${logoUrl}" alt="${orgName}" style="max-height: 120px; max-width: 250px; height: auto; border: 0; display: inline-block; margin-bottom: 15px;">` : ''}
                        ${showOrgName ? `<h2 style="color: #302E56; margin: 0; font-size: 24px; font-weight: 700;">${orgName}</h2>` : ''}
                      </div>
                    ` : ''}
                    
                    ${content}
                  </td>
                </tr>
              </table>
              
              ${showFooter ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="margin: 0 auto;"><tr><td style="padding: 0 40px;">${this.getFooterHtml()}</td></tr></table>` : ''}
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  // Send Round-Up Welcome Email
  async sendWelcomeEmail({ donor, organization, dashboardLink }) {
    const orgName = organization?.name || 'ChangeWorks Fund';
    const subject = `Welcome to ${orgName}'s Round-Up Community`;

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        ${organization?.imageUrl ? `<img src="${this.getOrganizationLogoUrl(organization)}" alt="${orgName}" style="max-height: 120px; max-width: 250px; height: auto;">` : `<h2 style="color: #302E56; margin: 0;">${orgName}</h2>`}
      </div>
      
      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello ${donor.name},</p>
      
      <p>Thank you for joining ${orgName}'s round-up program! Your everyday purchases will now round up to the nearest dollar, turning your spare change into real change for the people we serve.</p>
      
      <p>You can view your donation activity anytime through your personalized <a href="${dashboardLink}" style="color: #302E56; text-decoration: underline;">Donor Portal</a> on ChangeWorks, our platform partner. That's where you'll be able to:</p>
      
      <ul style="color: #495057;">
        <li>Track your monthly round-up totals</li>
        <li>Adjust or pause your contributions at any time</li>
        <li>Download donation records for your own files</li>
      </ul>
      
      <p>We're so glad to have you as part of our round-up community, where even pennies can add up to create lasting change.</p>
      
      <p style="margin-top: 30px;">
        With gratitude,<br>
        <strong>${orgName}</strong>
      </p>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6c757d;"><strong>P.S.</strong> At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.</p>

      ${this.getFooterHtml()}
    `;

    const html = this.generateEmailHtml(content, organization, subject, false, false);

    const text = `
Welcome to ${orgName}'s Round-Up Community

Hello ${donor.name},

Thank you for joining ${orgName}'s round-up program! Your everyday purchases will now round up to the nearest dollar, turning your spare change into real change for the people we serve.

You can view your donation activity anytime through your personalized Donor Portal on ChangeWorks, our platform partner. That's where you'll be able to:
- Track your monthly round-up totals
- Adjust or pause your contributions at any time
- Download donation records for your own files

Donor Portal: ${dashboardLink}

We're so glad to have you as part of our round-up community, where even pennies can add up to create lasting change.

With gratitude,
${orgName}

P.S. At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.

Contact Information
Email: support@changeworksfund.org
5830 E 2nd St. STE 7000 #29896
Casper, WY 82609
Unsubscribe
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${organization?.name || 'ChangeWorks Fund'}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send admin password reset email
  async sendAdminPasswordResetEmail({ email, name, resetLink }) {
    const subject = 'Reset your ChangeWorks Admin Password';

    const changeWorksLogoUrl = this.getChangeWorksLogoUrl();

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${changeWorksLogoUrl}" alt="ChangeWorks" style="max-height: 80px; max-width: 220px; height: auto; border: 0; display: inline-block; margin-bottom: 12px;">
        <h2 style="color: #302E56; margin: 0; font-size: 22px; font-weight: 700;">ChangeWorks</h2>
      </div>

      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello ${name || 'Admin'},</p>

      <p>We received a request to reset the password for your ChangeWorks admin account associated with <strong>${email}</strong>.</p>

      <p>Click the button below to set a new password. This link will expire in <strong>1 hour</strong> for security reasons.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" class="button">Reset My Password</a>
      </div>

      <p style="font-size: 14px; color: #6c757d;">If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.</p>

      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>Best regards,<br><strong>The ChangeWorks Team</strong></p>
      </div>
    `;

    const brandingOrg = { name: 'ChangeWorks', imageUrl: '/imgs/changeworks.png' };
    const html = this.generateEmailHtml(content, brandingOrg, subject, false);

    const text = `
Reset your ChangeWorks Admin Password

Hello ${name || 'Admin'},

We received a request to reset the password for your ChangeWorks admin account (${email}).

Click the link below to set a new password (expires in 1 hour):
${resetLink}

If you did not request this, you can safely ignore this email.

Best regards,
The ChangeWorks Team
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
      from: `"ChangeWorks" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send admin verification email
  async sendAdminVerificationEmail({ email, name, verificationLink }) {
    const subject = 'Verify your ChangeWorks Admin Email';
    
    const content = `
      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello ${name || 'Admin'},</p>
      
      <p>Welcome to ChangeWorks! To complete your admin account setup, please verify your email address by clicking the button below.</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${verificationLink}" class="button">Verify Email Address</a>
      </div>
      
      <p>If you did not create an account, you can safely ignore this email.</p>
      
      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>Best regards,<br>ChangeWorks Team</p>
      </div>
    `;

    // No organization specific branding for super/admin usually, but we can pass null or a default context
    const html = this.generateEmailHtml(content, null, subject);
    
    const text = `
Verify your ChangeWorks Admin Email

Hello ${name || 'Admin'},

Welcome to ChangeWorks! To complete your admin account setup, please verify your email address by clicking the link below:

${verificationLink}

If you did not create an account, you can safely ignore this email.

Best regards,
ChangeWorks Team
    `;

    return await this.sendEmail({
      to: email,
      subject: subject,
      html: html,
      text: text
    });
  }

  // Send verification email to donor
  async sendVerificationEmail({ donor, verificationToken, verificationLink, organization }) {
    const orgName = organization?.name || 'ChangeWorks';
    const subject = `Welcome to ${orgName}'s Donation Community`;

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        ${organization?.imageUrl ? `<img src="${this.getOrganizationLogoUrl(organization)}" alt="${orgName}" style="max-height: 120px; max-width: 250px; height: auto;">` : (orgName !== 'ChangeWorks' ? `<h2 style="color: #302E56; margin: 0;">${orgName}</h2>` : '')}
      </div>

      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello ${donor.name}</p>
      
      <p>Thank you for supporting our work financially with your donation. Your generosity truly matters to us, and we want giving to feel simple and effortless.</p>
      
      <p>That's why you have your own donor dashboard with our trusted donation platform partner, ChangeWorks. It puts everything you need in one place:</p>
      
      <ul style="color: #495057;">
        <li><strong>See your monthly donation totals</strong> whenever you'd like</li>
        <li><strong>Adjust or pause your contributions</strong> if your needs change</li>
        <li><strong>Download your donation records</strong> for easy reference or tax time</li>
      </ul>

      <p>You can visit your dashboard anytime once your verify your email using the link below:</p>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${verificationLink}" class="button">VERIFY YOUR EMAIL HERE</a>
      </div>

      <p>If you ever have a question or just want to reach out, we'd love to hear from you. We're grateful to have you with us.</p>

      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>Warm regards,<br>
        <strong>The ${orgName} Team</strong></p>
      </div>

      <p style="margin-top: 20px; font-size: 14px; color: #6c757d;"><strong>P.S.</strong> At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.</p>

      ${this.getFooterHtml()}
    `;

    // Note: We're passing false for showOrgName in generateEmailHtml because we handle the header manually in the content
    // to match the specific layout requested (Org Logo -> Hello!)
    // We also pass false for showFooter because we handle the footer manually in the content
    const html = this.generateEmailHtml(content, null, subject, false, false);

    const text = `
Welcome to ${orgName}'s Donation Community

Hello ${donor.name}

Thank you for supporting our work financially with your donation. Your generosity truly matters to us, and we want giving to feel simple and effortless.

That's why you have your own donor dashboard with our trusted donation platform partner, ChangeWorks. It puts everything you need in one place:
- See your monthly donation totals whenever you'd like
- Adjust or pause your contributions if your needs change
- Download your donation records for easy reference or tax time

You can visit your dashboard anytime once your verify your email using the link below:

VERIFY YOUR EMAIL HERE: ${verificationLink}

If you ever have a question or just want to reach out, we'd love to hear from you. We're grateful to have you with us.

Warm regards,
The ${orgName} Team

P.S. At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.

ChangeWorks Fund
ChangeWorksFund.Org
Your trusted platform partner for charitable giving

Contact Information
Email: support@changeworksfund.org
5830 E 2nd St. STE 7000 #29896
Casper, WY 82609

Unsubscribe
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${organization?.name || 'ChangeWorks Fund'}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send monthly impact email to donor
  async sendMonthlyImpactEmail({ donor, organization, dashboardLink, month, totalAmount }) {
    const subject = `See what change your change made this month`;
    
    const content = `
      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello ${donor.name},</p>
      
      <div style="background: linear-gradient(135deg, #302E56 0%, #4A487A 100%); color: white; padding: 30px; border-radius: 15px; margin: 25px 0; text-align: center; box-shadow: 0 8px 25px rgba(48, 46, 86, 0.3);">
        <h2 style="margin: 0 0 15px 0; font-size: 24px; font-weight: 600;">Your Impact This Month</h2>
        <div style="font-size: 36px; font-weight: 700; margin: 10px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">$${totalAmount}</div>
        <p style="font-size: 18px; opacity: 0.9; margin: 0;">${month}</p>
      </div>
      
      <p>Your everyday purchases made a difference in <strong>${month}</strong>. Altogether, your round-ups added up to <strong>$${totalAmount}</strong> for <strong>${organization.name}</strong>.</p>
      
      <p>If you want to see details of your round-up donations or make changes, log into your Donor Portal <a href="${dashboardLink}" style="color: #302E56; text-decoration: underline;">[Dashboard Link]</a> on ChangeWorks, our platform partner. That's where you can see your giving history, adjust settings, or download your records anytime.</p>
      
      <div style="text-align: center;">
        <a href="${dashboardLink}" class="button">Access Your Donor Portal</a>
      </div>
      
      <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0; color: #856404; font-weight: 500; font-size: 16px;">Thank you for carrying our mission forward with every swipe, tap, and purchase. Small change, month after month, can create lasting change in our community.</p>
      </div>
      
      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>With gratitude,<br>
        <strong>${organization.name} Team</strong></p>
      </div>
      
      ${this.getFooterHtml()}
    `;

    const html = this.generateEmailHtml(content, organization, 'Your Monthly Impact', true, false);

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
Email: support@changeworksfund.org

Address: 5830 E 2nd St. STE 7000 #29896, Casper, WY 82609
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${organization?.name || 'ChangeWorks Fund'}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send recurring donation confirmation email
  async sendRecurringDonationEmail({ donor, organization, amount, startDate, transactionId, dashboardLink, campaignName, paymentMethod, receiptNumber }) {
    const subject = `Thanks for Your Recurring Monthly Donation to ${organization.name}`;

    const formattedDate = new Date(startDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedTime = new Date(startDate).toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit'
    }) + ' EST';

    const directorName = (organization?.firstName && organization?.lastName) 
      ? `${organization.firstName} ${organization.lastName}` 
      : 'Organization Director';
      
    const ein = organization?.ein || '99-XXXXXXX';
    const safeCampaign = campaignName || 'General Campaign';
    const safePaymentMethod = paymentMethod || 'Card ending in XXXX';
    const safeReceiptNumber = receiptNumber || transactionId;

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        ${organization?.imageUrl ? `<img src="${this.getOrganizationLogoUrl(organization)}" alt="${organization.name}" style="max-height: 80px; max-width: 200px; height: auto;">` : `<h2 style="color: #302E56; margin: 0;">${organization.name}</h2>`}
      </div>

      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello!</p>

      <p>Thank you for your generous recurring monthly donation to ${organization.name}. Your support helps ensure we can continue showing up for people when help is needed.</p>

      <p>Your contribution strengthens our ability to provide timely assistance, respond to changing needs, and operate with care and consistency. Support like yours allows us to focus on what matters most: putting resources to work where they can do the most good.</p>

      <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 30px;">Your donation details</h3>
      <ul style="list-style: none; padding: 0;">
        <li style="margin-bottom: 8px;"><strong>Organization:</strong> ${organization.name}</li>
        <li style="margin-bottom: 8px;"><strong>Campaign:</strong> ${safeCampaign}</li>
        <li style="margin-bottom: 8px;"><strong>Donor:</strong> ${donor.name}</li>
        <li style="margin-bottom: 8px;"><strong>Amount:</strong> $${amount} (monthly)</li>
        <li style="margin-bottom: 8px;"><strong>Impact:</strong> Your donation supports our core mission.</li>
        <li style="margin-bottom: 8px;"><strong>Period:</strong> ${formattedDate}</li>
        <li style="margin-bottom: 8px;"><strong>Receipt #:</strong> ${safeReceiptNumber}</li>
        <li style="margin-bottom: 8px;"><strong>Date:</strong> ${formattedDate} at ${formattedTime}</li>
        <li style="margin-bottom: 8px;"><strong>Payment method:</strong> ${safePaymentMethod}</li>
      </ul>

      <p style="margin-top: 30px;">You can access your donor account at any time to update your contribution amount, change your payment method, or pause or resume recurring donations. Step-by-step instructions are available through our trusted donation partner, ChangeWorks.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardLink}" class="button">CLICK HERE TO ACCESS YOUR DONOR DASHBOARD</a>
      </div>

      <p>At ${organization.name}, our mission is straightforward: to use every contribution responsibly and thoughtfully in support of the people and communities we serve. We're grateful for your trust and would be glad to keep you informed about the impact of your giving.</p>

      <p style="font-size: 14px; color: #6c757d; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        ${organization.name} is a registered 501(c)(3) nonprofit organization in the United States (EIN: ${ein}). Your donation may be tax-deductible; please consult a tax professional regarding your specific situation.
      </p>

      <p style="margin-top: 20px;">
        With sincere gratitude,<br>
        <strong>${directorName}</strong>
      </p>

      ${this.getFooterHtml()}
    `;

    // Note: We're passing false for showOrgName in generateEmailHtml because we handle the header manually in the content
    // to match the specific layout requested (Org Logo -> Hello!)
    // We also pass false for showFooter because we handle the footer manually in the content
    const html = this.generateEmailHtml(content, organization, subject, false, false);

    const text = `
Subject: ${subject}

Hello!

Thank you for your generous recurring monthly donation to ${organization.name}. Your support helps ensure we can continue showing up for people when help is needed.

Your contribution strengthens our ability to provide timely assistance, respond to changing needs, and operate with care and consistency. Support like yours allows us to focus on what matters most: putting resources to work where they can do the most good.

Your donation details
Organization: ${organization.name}
Campaign: ${safeCampaign}
Donor: ${donor.name}
Amount: $${amount} (monthly)
Impact: Your donation supports our core mission.
Period: ${formattedDate}
Receipt #: ${safeReceiptNumber}
Date: ${formattedDate} at ${formattedTime}
Payment method: ${safePaymentMethod}

You can access your donor account at any time to update your contribution amount, change your payment method, or pause or resume recurring donations. Step-by-step instructions are available through our trusted donation partner, ChangeWorks.

CLICK HERE TO ACCESS YOUR DONOR DASHBOARD: ${dashboardLink}

At ${organization.name}, our mission is straightforward: to use every contribution responsibly and thoughtfully in support of the people and communities we serve. We're grateful for your trust and would be glad to keep you informed about the impact of your giving.

${organization.name} is a registered 501(c)(3) nonprofit organization in the United States (EIN: ${ein}). Your donation may be tax-deductible; please consult a tax professional regarding your specific situation.

With sincere gratitude,
${directorName}

ChangeWorks
Your trusted platform partner for charitable giving

Contact Information
Email: support@changeworksfund.org
5830 E 2nd St. STE 7000 #29896
Casper, WY 82609
Unsubscribe
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${organization.name}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send one-time donation confirmation email
  async sendOneTimeDonationEmail({ donor, organization, dashboardLink, amount, donationDate, transactionId, paymentMethod, campaignName }) {
    const subject = `Thanks for Your One-Time Donation to ${organization.name}`;
    
    // Logic for Director Name
    const directorName = (organization?.firstName && organization?.lastName) 
      ? `${organization.firstName} ${organization.lastName}` 
      : 'Organization Director';

    const ein = organization?.ein || '99-XXXXXXX';
    const safeCampaign = campaignName || 'General Campaign';
    const safePaymentMethod = paymentMethod || 'Card ending in XXXX';
    const safeReceiptNumber = transactionId || 'N/A';
    
    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        ${organization?.imageUrl ? `<img src="${this.getOrganizationLogoUrl(organization)}" alt="${organization.name}" style="max-height: 80px; max-width: 200px; height: auto;">` : `<h2 style="color: #302E56; margin: 0;">${organization.name}</h2>`}
      </div>

      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello! ${donor.name}</p>
      
      <p>Thank you for your generous donation to ${organization.name}. Your support helps ensure we can continue showing up for people when help is needed.</p>
      
      <p>Your contribution strengthens our ability to provide timely assistance, respond to changing needs, and operate with care and consistency. Support like yours allows us to focus on what matters most: putting resources to work where they can do the most good.</p>
      
      <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 30px;">Your donation details</h3>
      
      <ul style="list-style: none; padding: 0;">
        <li style="margin-bottom: 8px;"><strong>Organization:</strong> ${organization.name}</li>
        <li style="margin-bottom: 8px;"><strong>Campaign:</strong> ${safeCampaign}</li>
        <li style="margin-bottom: 8px;"><strong>Donor:</strong> ${donor.name}</li>
        <li style="margin-bottom: 8px;"><strong>Amount:</strong> $${amount}</li>
        <li style="margin-bottom: 8px;"><strong>Impact:</strong> Your donation supports our core mission.</li>
        <li style="margin-bottom: 8px;"><strong>Period:</strong> ${donationDate}</li>
        <li style="margin-bottom: 8px;"><strong>Receipt #:</strong> ${safeReceiptNumber}</li>
        <li style="margin-bottom: 8px;"><strong>Date:</strong> ${donationDate}</li>
        <li style="margin-bottom: 8px;"><strong>Payment method:</strong> ${safePaymentMethod}</li>
      </ul>
      
      <p style="margin-top: 30px;">You can access your donor account at any time to update your contribution amount, change your payment method, or resume donations. Step-by-step instructions are available through our trusted donation partner, ChangeWorks.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardLink}" class="button">CLICK HERE TO ACCESS YOUR DONOR DASHBOARD</a>
      </div>
      
      <p>At ${organization.name}, our mission is straightforward: to use every contribution responsibly and thoughtfully in support of the people and communities we serve. We're grateful for your trust and would be glad to keep you informed about the impact of your giving.</p>
      
      <p style="font-size: 14px; color: #6c757d; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        ${organization.name} is a registered 501(c)(3) nonprofit organization in the United States (EIN: ${ein}). Your donation may be tax-deductible; please consult a tax professional regarding your specific situation.
      </p>
      
      <p style="margin-top: 20px;">
        With sincere gratitude,<br>
        <strong>${directorName}</strong>
      </p>

      ${this.getFooterHtml()}
    `;

    // Pass false for showOrgName and showFooter because we handle them manually
    const html = this.generateEmailHtml(content, organization, subject, false, false);

    const text = `
Thanks for Your One-Time Donation to ${organization.name}

Dear ${donor.name},

Thank you for your generous donation to ${organization.name}. Your support helps ensure we can continue showing up for people when help is needed.

Your contribution strengthens our ability to provide timely assistance, respond to changing needs, and operate with care and consistency. Support like yours allows us to focus on what matters most: putting resources to work where they can do the most good.

Your donation details
Organization: ${organization.name}
Campaign: ${safeCampaign}
Donor: ${donor.name}
Amount: $${amount}
Impact: Your donation supports our core mission.
Period: ${donationDate}
Receipt #: ${safeReceiptNumber}
Date: ${donationDate}
Payment method: ${safePaymentMethod}

You can access your donor account at any time to update your contribution amount, change your payment method, or resume donations. Step-by-step instructions are available through our trusted donation partner, ChangeWorks.

CLICK HERE TO ACCESS YOUR DONOR DASHBOARD: ${dashboardLink}

At ${organization.name}, our mission is straightforward: to use every contribution responsibly and thoughtfully in support of the people and communities we serve. We're grateful for your trust and would be glad to keep you informed about the impact of your giving.

${organization.name} is a registered 501(c)(3) nonprofit organization in the United States (EIN: ${ein}). Your donation may be tax-deductible; please consult a tax professional regarding your specific situation.

With sincere gratitude,
${directorName}

ChangeWorks
Your trusted platform partner for charitable giving

Contact Information
Email: support@changeworksfund.org
5830 E 2nd St. STE 7000 #29896
Casper, WY 82609
Unsubscribe
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${organization.name}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send recurring payment confirmation email
  async sendRecurringPaymentEmail({ donor, organization, dashboardLink, amount, paymentDate, nextPaymentDate }) {
    const subject = `Your recurring donation to ${organization.name} has been processed`;
    
    const content = `
      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello ${donor.name},</p>
      
      <div style="background: linear-gradient(135deg, #302E56 0%, #4A487A 100%); color: white; padding: 30px; border-radius: 15px; margin: 25px 0; text-align: center; box-shadow: 0 8px 25px rgba(48, 46, 86, 0.3);">
        <h2 style="margin: 0 0 15px 0; font-size: 24px; font-weight: 600; color: white;">Payment Processed Successfully!</h2>
        <div style="font-size: 36px; font-weight: 700; margin: 10px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">$${amount}</div>
        <p style="font-size: 18px; opacity: 0.9; margin: 0; color: white;">${paymentDate}</p>
      </div>
      
      <p>Your recurring donation of <strong>$${amount}</strong> to <strong>${organization.name}</strong> has been processed successfully.</p>
      
      <div style="background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%); border: 1px solid #bee5eb; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #17a2b8; text-align: center;">
        <p style="margin: 0; color: #0c5460; font-weight: 500; font-size: 16px;"><strong>Next Payment:</strong> ${nextPaymentDate}</p>
      </div>
      
      <p>If you want to see details of your recurring donations or make changes, log into your Donor Portal <a href="${dashboardLink}" style="color: #302E56; text-decoration: underline;">[Dashboard Link]</a> on ChangeWorks, our platform partner. That's where you can see your giving history, adjust settings, or download your records anytime.</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${dashboardLink}" class="button">Access Your Donor Portal</a>
      </div>
      
      <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0; color: #856404; font-weight: 500; font-size: 16px;">Thank you for carrying our mission forward with your ongoing support. Your recurring contributions help create lasting change in our community.</p>
      </div>
      
      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>With gratitude,<br>
        <strong>${organization.name} Team</strong></p>
      </div>
      
      ${this.getFooterHtml()}
    `;

    const html = this.generateEmailHtml(content, organization, subject, true, false);

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
Email: support@changeworksfund.org

Address: 5830 E 2nd St. STE 7000 #29896, Casper, WY 82609
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${organization.name}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send recurring change donation confirmation email
  async sendRecurringChangeDonationEmail({ donor, organization, dashboardLink, amount, donationDate }) {
    const subject = `Your recurring change donation to ${organization.name} is active`;
    // Format amount to handle "Round Up" text or numeric values
    const formattedAmount = isNaN(amount) ? amount : `$${amount}`;
    
    const content = `
      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello ${donor.name},</p>
      
      <div style="background: linear-gradient(135deg, #302E56 0%, #4A487A 100%); color: white; padding: 30px; border-radius: 15px; margin: 25px 0; text-align: center; box-shadow: 0 8px 25px rgba(48, 46, 86, 0.3);">
        <h2 style="margin: 0 0 15px 0; font-size: 24px; font-weight: 600;">Your Change Donation is Active!</h2>
        <div style="font-size: 36px; font-weight: 700; margin: 10px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${formattedAmount}</div>
        <p style="font-size: 18px; opacity: 0.9; margin: 0;">Started ${donationDate}</p>
      </div>
      
      <p>Your recurring change donation of <strong>${formattedAmount}</strong> to <strong>${organization.name}</strong> is now active and will automatically round up your everyday purchases.</p>
      
      <div style="background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%); border: 1px solid #bee5eb; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #17a2b8;">
        <p style="margin: 0; color: #0c5460; font-weight: 500; font-size: 16px;"><strong>How it works:</strong> Every time you make a purchase, the amount will be rounded up to the nearest dollar, and the difference will be donated to ${organization.name}.</p>
      </div>
      
      <p>If you want to see details of your change donations or make changes, log into your Donor Portal <a href="${dashboardLink}" style="color: #302E56; text-decoration: underline;">[Dashboard Link]</a> on ChangeWorks, our platform partner. That's where you can see your giving history, adjust settings, or download your records anytime.</p>
      
      <div style="text-align: center;">
        <a href="${dashboardLink}" class="button">Access Your Donor Portal</a>
      </div>
      
      <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0; color: #856404; font-weight: 500; font-size: 16px;">Thank you for carrying our mission forward with every swipe, tap, and purchase. Small change, month after month, can create lasting change in our community.</p>
      </div>
      
      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>With gratitude,<br>
        <strong>${organization.name} Team</strong></p>
      </div>
      
      ${this.getFooterHtml()}
    `;

    const html = this.generateEmailHtml(content, organization, subject, true, false);

    const text = `
Your recurring change donation to ${organization.name} is active

Hello ${donor.name},

Your recurring change donation of ${formattedAmount} to ${organization.name} is now active and will automatically round up your everyday purchases.

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
Email: support@changeworksfund.org

Address: 5830 E 2nd St. STE 7000 #29896, Casper, WY 82609
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${organization.name}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send card failure alert email to donor
  async sendCardFailureAlertEmail({ donor, organization, dashboardLink }) {
    const subject = `ACTION NEEDED: Please update your ${organization.name} round-up card`;
    
    const content = `
      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello ${donor.name},</p>
      
      <div style="background: linear-gradient(135deg, #E6E6F0 0%, #D3D2E0 100%); border: 1px solid #D3D2E0; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #302E56; text-align: center;">
        <h3 style="color: #302E56; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: 600;">⚠️ Card Not Working Alert</h3>
        <p style="margin: 0; color: #302E56; font-weight: 500;">We noticed your round-up card on file isn't working right now. It's an easy fix — simply update your card details in your Donor Portal on ChangeWorks, our platform partner.</p>
      </div>
      
      <p style="margin-bottom: 18px; font-size: 16px; color: #495057;">When you update your card, your purchases will keep rounding up automatically, and your ongoing support for <strong>${organization.name}</strong> will keep making a difference in the community.</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${dashboardLink}" style="display: inline-block; background: linear-gradient(135deg, #302E56 0%, #4A487A 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 15px rgba(48, 46, 86, 0.3);">Update Your Card Now</a>
      </div>
      
      <p style="margin-bottom: 18px; font-size: 16px; color: #495057;">Thank you for being part of our round-up community. Every swipe, tap, and purchase you make helps carry our mission forward — and we don't want you to miss a single moment of impact.</p>
      
      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>With gratitude,<br>
        <strong>${organization.name} Team</strong></p>
      </div>
      
      <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0; color: #856404; font-weight: 500;"><strong>P.S.</strong> If you have any questions or need assistance, reply to this email and we'll be glad to help.</p>
      </div>
    `;

    const html = this.generateEmailHtml(content, organization, subject);

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
Email: support@changeworksfund.org
Address: 5830 E 2nd St. STE 7000 #29896, Casper, WY 82609
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${organization.name}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send final reminder email for card failure
  async sendCardFailureFinalReminderEmail({ donor, organization, dashboardLink }) {
    const subject = `LAST REMINDER: Please update your ${organization.name} round-up card`;
    
    const content = `
      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello ${donor.name},</p>
      
      <div style="background: linear-gradient(135deg, #E6E6F0 0%, #D3D2E0 100%); border: 1px solid #D3D2E0; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #302E56; text-align: center;">
        <h3 style="color: #302E56; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: 600;">🚨 LAST REMINDER</h3>
        <p style="margin: 0; color: #302E56; font-weight: 500;">Right now, your round-up card on file still isn't working, which means your spare change isn't reaching us — and not reaching the people that together we serve.</p>
      </div>
      
      <p style="margin-bottom: 18px; font-size: 16px; color: #495057;">Please take a moment today to update your card details in your Donor Portal on ChangeWorks, our platform partner.</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${dashboardLink}" style="display: inline-block; background: linear-gradient(135deg, #302E56 0%, #4A487A 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 15px rgba(48, 46, 86, 0.3);">Update Your Card Today</a>
      </div>
      
      <div style="background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%); border: 1px solid #bee5eb; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #17a2b8;">
        <p style="margin: 0; color: #0c5460; font-weight: 500;">Your continued support helps us plan ahead and deliver on our mission. Your pennies matter — and when they pause, so does the change you help us make happen.</p>
      </div>
      
      <p style="margin-bottom: 18px; font-size: 16px; color: #495057;">Thank you for updating your card and for being such an important part of our community.</p>
      
      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>With appreciation,<br>
        <strong>${organization.name} Team</strong></p>
      </div>
    `;

    const html = this.generateEmailHtml(content, organization, subject);

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
Email: support@changeworksfund.org
Address: 5830 E 2nd St. STE 7000 #29896, Casper, WY 82609
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${organization.name}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send successful verification email to donor
  async sendVerificationSuccessEmail({ donor, organization, dashboardLink }) {
    const orgName = organization?.name || 'ChangeWorks Fund';
    const subject = `Welcome to ${orgName}'s Round-Up Community`;
    
    const content = `
      <h1 style="color: #302E56; font-size: 24px; margin-bottom: 20px;">Welcome to ${orgName}'s Round-Up Community</h1>
      
      <p>Hello ${donor.name},</p>
      
      <p>Thank you for joining ${orgName}'s round-up program. Your everyday purchases will now round up to the nearest dollar, turning your spare change into real change for the people we serve.</p>
      
      <p>You can view your donation activity anytime through your personalized <a href="${dashboardLink}" style="color: #302E56; text-decoration: underline;">Donor Portal</a> on ChangeWorks, our platform partner. That's where you'll be able to:</p>
      
      <div class="highlight-box">
        <h3 style="color: #302E56; margin-top: 0;">Your Donor Portal Features:</h3>
        <ul>
          <li>Track your monthly round-up totals</li>
          <li>Adjust or pause your contributions at any time</li>
          <li>Download donation records for your own files</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${dashboardLink}" class="button">Access Your Donor Portal</a>
      </div>
      
      <p>We're so glad to have you as part of our round-up community, where even pennies can create lasting change.</p>
      
      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>With gratitude,<br>
        <strong>${orgName} Team</strong></p>
      </div>
      
      <div class="highlight-box" style="background: #e8f4fd; border-left-color: #302E56;">
        <p style="margin: 0; color: #302E56;"><strong>P.S.</strong> At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.</p>
      </div>
      
      ${this.getFooterHtml()}
    `;

    const html = this.generateEmailHtml(content, organization, subject, true, false);

    const text = `
Welcome to ${orgName}'s Round-Up Community

Hello ${donor.name},

Thank you for joining ${orgName}'s round-up program. Your everyday purchases will now round up to the nearest dollar, turning your spare change into real change for the people we serve.

You can view your donation activity anytime through your personalized Donor Portal on ChangeWorks, our platform partner. That's where you'll be able to:

- Track your monthly round-up totals
- Adjust or pause your contributions at any time
- Download donation records for your own files

Access Your Donor Portal: ${dashboardLink}

We're so glad to have you as part of our round-up community, where even pennies can create lasting change.

With gratitude,
${orgName} Team

P.S. At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.

---
ChangeWorks Fund
Your trusted platform partner for charitable giving

Contact Information:
Email: support@changeworksfund.org
Address: 5830 E 2nd St. STE 7000 #29896, Casper, WY 82609
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${orgName}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }



  // Send password reset email
  async sendPasswordResetEmail({ donor, resetToken, resetLink, organization }) {
    const orgName = organization?.name || 'ChangeWorks Fund';
    const subject = `Reset your password for your ${orgName} donor account`;
    
    const directorName = (organization?.firstName && organization?.lastName) 
      ? `${organization.firstName} ${organization.lastName}` 
      : 'Organization Director';

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        ${organization?.imageUrl ? `<img src="${this.getOrganizationLogoUrl(organization)}" alt="${orgName}" style="max-height: 120px; max-width: 250px; height: auto;">` : ((orgName !== 'ChangeWorks' && orgName !== 'ChangeWorks Fund') ? `<h2 style="color: #302E56; margin: 0;">${orgName}</h2>` : '')}
      </div>

      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello! ${donor.name}</p>
      
      <p>We received a request to reset the password for your ${orgName} donor account.</p>
      
      <p>To keep your information secure, you'll need to create a new password before you can access your ChangeWorks donor dashboard. The process is quick and should take less than a minute.</p>
      
      <p style="margin-bottom: 10px;">What you can do once you're logged in:</p>
      <ul style="color: #495057;">
        <li>View and manage your donation activity</li>
        <li>Update payment details or giving preferences</li>
        <li>Download donation records for your files</li>
      </ul>
      
      <p>To reset your password, click the button below and follow the on-screen steps. This link will expire for security reasons.</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${resetLink}" class="button">CLICK HERE TO RESET YOUR PASSWORD</a>
      </div>
      
      <p>If you didn't request a password reset, you can safely ignore this email. No changes will be made to your account.</p>
      
      <p>If you need help at any point, support is available through our trusted donation partner, ChangeWorks: <a href="mailto:support@changeworksfund.org" style="color: #302E56;">support@changeworksfund.org</a></p>
      
      <p>Thank you for being part of ${orgName} and for the support you provide to our work.</p>
      
      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>With appreciation,</p>
        <p><strong>${directorName}</strong><br>
        ${(orgName !== 'ChangeWorks' && orgName !== 'ChangeWorks Fund') ? orgName : ''}</p>
      </div>

      <p style="font-size: 12px; color: #999; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">This message was sent to help protect your account. Please do not reply directly to this email.</p>

      <div style="margin-top: 20px; margin-bottom: 20px;">
        <img src="${this.getChangeWorksLogoUrl()}" alt="ChangeWorks" style="max-height: 40px; height: auto; display: block; margin-bottom: 10px;">
        <h3 style="color: #302E56; margin: 0; font-size: 18px;">ChangeWorks</h3>
        <p style="color: #6c757d; margin: 5px 0 0; font-size: 14px;">Your trusted platform partner for charitable giving</p>
      </div>

      <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; color: #6c757d; font-size: 14px; text-align: center;">
        
        <p style="margin-bottom: 10px; font-weight: 600; color: #302E56;">Contact Information</p>
        <p style="margin-bottom: 5px;">Email: <a href="mailto:support@changeworksfund.org" style="color: #6c757d; text-decoration: none;">support@changeworksfund.org</a></p>
        <p style="margin-bottom: 5px;">5830 E 2nd St. STE 7000 #29896</p>
        <p style="margin-bottom: 20px;">Casper, WY 82609</p>
        
        <p><a href="#" style="color: #999; text-decoration: underline; font-size: 12px;">Unsubscribe</a></p>
      </div>
    `;

    // Note: We're passing false for showOrgName in generateEmailHtml because we handle the header manually in the content
    // to match the specific layout requested (Org Logo -> Hello!)
    // We also pass false for showFooter because we handle the footer manually in the content
    const html = this.generateEmailHtml(content, organization, subject, false, false);

    const text = `
Subject: ${subject}

Hello! ${donor.name}

We received a request to reset the password for your ${orgName} donor account.

To keep your information secure, you'll need to create a new password before you can access your ChangeWorks donor dashboard. The process is quick and should take less than a minute.

What you can do once you're logged in:
- View and manage your donation activity
- Update payment details or giving preferences
- Download donation records for your files

To reset your password, click the button below and follow the on-screen steps. This link will expire for security reasons.

CLICK HERE TO RESET YOUR PASSWORD: ${resetLink}

If you didn't request a password reset, you can safely ignore this email. No changes will be made to your account.

If you need help at any point, support is available through our trusted donation partner, ChangeWorks: support@changeworksfund.org

Thank you for being part of ${orgName} and for the support you provide to our work.

With appreciation,
${directorName}
${(orgName !== 'ChangeWorks' && orgName !== 'ChangeWorks Fund') ? orgName : ''}

This message was sent to help protect your account. Please do not reply directly to this email.

ChangeWorks
Your trusted platform partner for charitable giving

Contact Information
Email: support@changeworksfund.org
5830 E 2nd St. STE 7000 #29896
Casper, WY 82609
Unsubscribe
    `;

    return await this.sendEmail({
      to: donor.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${orgName}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send organization password reset email
  async sendOrganizationPasswordResetEmail({ organization, resetToken, resetLink }) {
    const subject = `Reset your ChangeWorks account password`;
    
    // ChangeWorks branding for this email
    const brandingOrg = {
      name: 'ChangeWorks',
      imageUrl: '/imgs/changeworks.png'
    };

    const adminName = (organization.firstName && organization.lastName) 
      ? `${organization.firstName} ${organization.lastName}` 
      : `${organization.name} Admin`;

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${this.getChangeWorksLogoUrl()}" alt="ChangeWorks" style="max-height: 120px; max-width: 250px; height: auto; border: 0; display: inline-block;">
      </div>

      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Dear ${adminName},</p>
      
      <p>We received a request to reset the password for your ChangeWorks organization admin account.</p>
      
      <p>To protect your account and donor data, you'll need to create a new password before accessing your admin dashboard. The process is quick and should take less than a minute.</p>
      
      <div class="highlight-box">
        <h3 style="color: #302E56; margin-top: 0;">What you can do once you're logged in</h3>
        <ul>
          <li>View and manage donation activity across campaigns</li>
          <li>Access reports, payouts, and donor insights</li>
          <li>Update organization settings and user permissions</li>
        </ul>
      </div>
      
      <p>To reset your password, click the button below and follow the on-screen steps. For security reasons, this link will expire.</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${resetLink}" class="button">CLICK HERE TO RESET YOUR PASSWORD</a>
      </div>
      
      <p>If you did not request a password reset, you can safely ignore this email. No changes will be made to your account.</p>
      
      <p>If you need assistance at any point, the ChangeWorks support team is here to help: <a href="mailto:support@changeworksfund.org" style="color: #302E56;">support@changeworksfund.org</a></p>

      <p>Thank you for partnering with ChangeWorks and for the work you do every day.</p>
      
      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>With appreciation,<br>
        <strong>The ChangeWorks Team</strong></p>
      </div>

      <p style="font-size: 12px; color: #999; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">This message was sent to help protect your account. Please do not reply directly to this email.</p>

      <div style="margin-top: 20px; margin-bottom: 20px;">
        <img src="${this.getChangeWorksLogoUrl()}" alt="ChangeWorks" style="max-height: 40px; height: auto; display: block; margin-bottom: 10px;">
        <h3 style="color: #302E56; margin: 0; font-size: 18px;">ChangeWorks</h3>
        <p style="color: #6c757d; margin: 5px 0 0; font-size: 14px;">Your trusted platform partner for charitable giving</p>
      </div>

      <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; color: #6c757d; font-size: 14px; text-align: center;">
        
        <p style="margin-bottom: 10px; font-weight: 600; color: #302E56;">Contact Information</p>
        <p style="margin-bottom: 5px;">Email: <a href="mailto:support@changeworksfund.org" style="color: #6c757d; text-decoration: none;">support@changeworksfund.org</a></p>
        <p style="margin-bottom: 5px;">5830 E 2nd St. STE 7000 #29896</p>
        <p style="margin-bottom: 20px;">Casper, WY 82609</p>
        
        <p><a href="#" style="color: #999; text-decoration: underline; font-size: 12px;">Unsubscribe</a></p>
      </div>
    `;

    // We pass false for showOrgName in generateEmailHtml because we handle the header manually in the content
    // We also pass false for showFooter because we handle the footer manually in the content
    const html = this.generateEmailHtml(content, brandingOrg, subject, false, false);

    const text = `
Reset your ChangeWorks account password

Dear ${adminName},

We received a request to reset the password for your ChangeWorks organization admin account.

To protect your account and donor data, you'll need to create a new password before accessing your admin dashboard. The process is quick and should take less than a minute.

What you can do once you're logged in:
- View and manage donation activity across campaigns
- Access reports, payouts, and donor insights
- Update organization settings and user permissions

To reset your password, click the link below and follow the on-screen steps. For security reasons, this link will expire.

CLICK HERE TO RESET YOUR PASSWORD: ${resetLink}

If you did not request a password reset, you can safely ignore this email. No changes will be made to your account.

If you need assistance at any point, the ChangeWorks support team is here to help: support@changeworksfund.org

Thank you for partnering with ChangeWorks and for the work you do every day.

With appreciation,
The ChangeWorks Team

This message was sent to help protect your account. Please do not reply directly to this email.

ChangeWorks
Your trusted platform partner for charitable giving

Contact Information
Email: support@changeworksfund.org
5830 E 2nd St. STE 7000 #29896
Casper, WY 82609

Unsubscribe
    `;

    return await this.sendEmail({
      to: organization.email,
      subject: subject,
      html: html,
      text: text,
      from: `"${organization.name}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send Organization Welcome Email
  async sendOrganizationWelcomeEmail({ organization, dashboardLink }) {
    console.log('📧 Sending Organization Welcome Email to:', organization.email);
    const subject = `Welcome to your ChangeWorks partnership!`;
    const adminName = (organization.firstName && organization.lastName) 
      ? `${organization.firstName} ${organization.lastName}` 
      : organization.name;
    
    // Always use ChangeWorks branding for this email
    const brandingOrg = {
      name: 'ChangeWorks',
      imageUrl: '/imgs/changeworks.png'
    };

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${this.getChangeWorksLogoUrl()}" alt="ChangeWorks" style="max-height: 120px; max-width: 250px; height: auto; border: 0; display: inline-block;">
      </div>

      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Dear ${adminName},</p>
      
      <p>Welcome to <strong>ChangeWorks.</strong> We're excited to have you on board and look forward to supporting your organization's fundraising efforts.</p>
      
      <p>Your ChangeWorks account is now active, giving you access to a secure admin dashboard where you can manage donations, track activity, and stay connected with your supporters. Everything is designed to be straightforward, flexible, and easy to manage.</p>
      
      <div class="highlight-box">
        <h3 style="color: #302E56; margin-top: 0;"><strong>What you can do from your admin dashboard:</strong></h3>
        <ul>
          <li>View donation activity across campaigns in real time</li>
          <li>Access reports, payouts, and donor summaries</li>
          <li>Manage organization settings and user permissions</li>
        </ul>
      </div>
      
      <p>You can log in anytime using the link below to get started.</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${dashboardLink}" class="button">CLICK HERE TO ACCESS YOUR ADMIN DASHBOARD</a>
      </div>
      
      <p>Also attached below is a partnership agreement for you to sign that details our joint venture. Kindly sign and return it so we can continue your onboarding process.</p>
      
      <p>If you have questions as you get set up or need help along the way, your ChangeWorks support team is here for you. Reach out anytime to our support team: <a href="mailto:support@changeworksfund.org" style="color: #302E56;">support@changeworksfund.org</a> or visit our website to schedule a virtual meeting: <a href="https://www.changeworksfund.org" style="color: #302E56;">www.changeworksfund.org</a></p>
      
      <p>Thank you for choosing ChangeWorks and for the work you do to support your community!</p>
      
      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>With appreciation,<br>
        <strong>The ChangeWorks Team</strong></p>
      </div>
    `;

    // Pass false for showOrgName to suppress the header title "ChangeWorks"
    const html = this.generateEmailHtml(content, brandingOrg, subject, false);

    const text = `
Welcome to your ChangeWorks partnership!

Dear ${adminName},

Welcome to ChangeWorks. We're excited to have you on board and look forward to supporting your organization's fundraising efforts.

Your ChangeWorks account is now active, giving you access to a secure admin dashboard where you can manage donations, track activity, and stay connected with your supporters. Everything is designed to be straightforward, flexible, and easy to manage.

What you can do from your admin dashboard:
- View donation activity across campaigns in real time
- Access reports, payouts, and donor summaries
- Manage organization settings and user permissions

You can log in anytime using the link below to get started.

CLICK HERE TO ACCESS YOUR ADMIN DASHBOARD: ${dashboardLink}

Also attached below is a partnership agreement for you to sign that details our joint venture. Kindly sign and return it so we can continue your onboarding process.

If you have questions as you get set up or need help along the way, your ChangeWorks support team is here for you. Reach out anytime to our support team: support@changeworksfund.org or visit our website to schedule a virtual meeting: www.changeworksfund.org

Thank you for choosing ChangeWorks and for the work you do to support your community!

With appreciation,
The ChangeWorks Team

Your trusted platform partner for charitable giving

________________________________________Contact Information
Email: support@changeworksfund.org
5830 E 2nd St. STE 7000 #29896
Casper, WY 82609
Unsubscribe
    `;

    return await this.sendEmail({
      to: organization.email,
      subject: subject,
      html: html,
      text: text,
      from: `"ChangeWorks" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`
    });
  }

  // Send Stripe onboarding link email to organization
  async sendStripeOnboardingEmail({ organization, onboardingUrl }) {
    const subject = `Complete Your Stripe Account Setup - ${organization.name}`;
    
    // ChangeWorks branding for this email
    const brandingOrg = {
      name: 'ChangeWorks',
      imageUrl: '/imgs/changeworks.png'
    };

    const content = `
      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello ${organization.name} Team,</p>
      
      <p>Your organization account has been successfully created! To start receiving payments, you need to complete your Stripe account onboarding.</p>
      
      <div class="highlight-box">
        <h3 style="color: #302E56; margin-top: 0;">What you'll need:</h3>
        <ul>
          <li>Business information (name, address, tax ID)</li>
          <li>Bank account details for payouts</li>
          <li>Identity verification documents</li>
        </ul>
      </div>
      
      <p>Click the button below to complete your Stripe account setup:</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${onboardingUrl}" class="button">Complete Stripe Onboarding</a>
      </div>
      
      <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0; color: #856404; font-weight: 500;"><strong>Important:</strong> This link will expire in 1 hour. If you need a new link, please contact support.</p>
      </div>
      
      <p>If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>
      
      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>Best regards,<br>
        <strong>ChangeWorks Fund Team</strong></p>
      </div>
    `;

    const html = this.generateEmailHtml(content, brandingOrg, subject);

    const text = `
Complete Your Stripe Account Setup - ${organization.name}

Hello ${organization.name} Team,

Your organization account has been successfully created! To start receiving payments, you need to complete your Stripe account onboarding.

What you'll need:
- Business information (name, address, tax ID)
- Bank account details for payouts
- Identity verification documents

Click the link below to complete your Stripe account setup:
${onboardingUrl}

Important: This link will expire in 1 hour. If you need a new link, please contact support.

If you have any questions or need assistance, please don't hesitate to reach out to our support team.

Best regards,
ChangeWorks Fund Team
Your trusted platform partner for charitable giving
    `;

    return await this.sendEmail({
      to: organization.email,
      subject: subject,
      html: html,
      text: text,
      from: `"ChangeWorks" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`
    });
  }

  // Send auto-created account credentials to a new donor (iroundup flow)
  async sendDonorCredentialsEmail({ donor, organization, password, loginLink }) {
    const orgName = organization?.name || 'ChangeWorks Fund';
    const subject = `Your ${orgName} donor account has been created`;

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        ${organization?.imageUrl
          ? `<img src="${this.getOrganizationLogoUrl(organization)}" alt="${orgName}" style="max-height: 120px; max-width: 250px; height: auto;">`
          : `<h2 style="color: #302E56; margin: 0;">${orgName}</h2>`}
      </div>

      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 25px;">Hello ${donor.name},</p>

      <p>A donor account has been created for you on <strong>ChangeWorks</strong>, the giving platform for <strong>${orgName}</strong>. Use the credentials below to log in and complete your round-up setup.</p>

      <div style="background-color: #f8f9fa; border-left: 4px solid #302E56; padding: 20px 24px; border-radius: 6px; margin: 24px 0;">
        <p style="margin: 0 0 10px 0; font-size: 15px;"><strong>Email:</strong> ${donor.email}</p>
        <p style="margin: 0; font-size: 15px;"><strong>Password:</strong> <span style="font-family: monospace; font-size: 16px; letter-spacing: 1px;">${password}</span></p>
      </div>

      <p>We recommend changing your password after your first login from your profile settings.</p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${loginLink}" class="button">Log In to Your Donor Portal</a>
      </div>

      <p>If you have any questions, reach us at <a href="mailto:support@changeworksfund.org" style="color: #302E56;">support@changeworksfund.org</a>.</p>

      <div style="margin-top: 30px; font-style: italic; color: #495057;">
        <p>With gratitude,<br><strong>${orgName} &amp; The ChangeWorks Team</strong></p>
      </div>

      ${this.getFooterHtml()}
    `;

    const html = this.generateEmailHtml(content, null, subject, false, false);

    const text = `
Hello ${donor.name},

A donor account has been created for you on ChangeWorks, the giving platform for ${orgName}.

Email: ${donor.email}
Password: ${password}

Log in here: ${loginLink}

We recommend changing your password after your first login.

With gratitude,
${orgName} & The ChangeWorks Team

Contact: support@changeworksfund.org
    `.trim();

    return await this.sendEmail({
      to: donor.email,
      subject,
      html,
      text,
      from: `"${orgName}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }

  // Send monthly donation summary email to donor (last day of month)
  async sendMonthlyDonationSummaryEmail({ donor, organization, month, totalAmount, donations, dashboardLink }) {
    const orgName = organization?.name || 'ChangeWorks';
    const subject = `Your ${month} Donation Summary – ${orgName}`;

    // Build donation rows HTML
    const donationRows = donations.map((d, i) => {
      const date = new Date(d.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const amount = parseFloat(d.amount).toFixed(2);
      const bg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
      return `
        <tr style="background-color: ${bg};">
          <td style="padding: 12px 16px; font-size: 14px; color: #333; border-bottom: 1px solid #e9ecef;">${date}</td>
          <td style="padding: 12px 16px; font-size: 14px; color: #333; border-bottom: 1px solid #e9ecef;">${d.type || 'Donation'}</td>
          <td style="padding: 12px 16px; font-size: 14px; color: #333; border-bottom: 1px solid #e9ecef;">${d.description || '—'}</td>
          <td style="padding: 12px 16px; font-size: 14px; color: #333; border-bottom: 1px solid #e9ecef; text-align: right; font-weight: 600;">$${amount}</td>
        </tr>
      `;
    }).join('');

    const content = `
      <p style="font-size: 18px; font-weight: 500; color: #212529; margin-bottom: 8px;">Dear ${donor.name},</p>

      <p style="color: #495057; margin-bottom: 28px;">Here is a summary of your donations to <strong>${orgName}</strong> for the month of <strong>${month}</strong>. Thank you for your continued generosity and support.</p>

      <!-- Monthly Total Banner -->
      <div style="background: linear-gradient(135deg, #302E56 0%, #4A487A 100%); color: white; padding: 28px 32px; border-radius: 12px; margin: 24px 0; text-align: center; box-shadow: 0 6px 20px rgba(48,46,86,0.25);">
        <p style="margin: 0 0 6px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85;">Total Donated in ${month}</p>
        <div style="font-size: 42px; font-weight: 700; letter-spacing: -1px;">$${parseFloat(totalAmount).toFixed(2)}</div>
        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.8;">${donations.length} donation${donations.length !== 1 ? 's' : ''} this month</p>
      </div>

      <!-- Donation Table -->
      <h3 style="color: #302E56; font-size: 16px; font-weight: 700; margin: 28px 0 12px 0; border-bottom: 2px solid #302E56; padding-bottom: 8px;">Donation Breakdown</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #302E56;">
            <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">Date</th>
            <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">Type</th>
            <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
            <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${donationRows}
          <tr style="background-color: #f1f0fb;">
            <td colspan="3" style="padding: 14px 16px; font-size: 15px; font-weight: 700; color: #302E56;">Total</td>
            <td style="padding: 14px 16px; font-size: 15px; font-weight: 700; color: #302E56; text-align: right;">$${parseFloat(totalAmount).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin-top: 28px; color: #495057;">You can view your full giving history, download records, and manage your donations anytime from your Donor Portal.</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${dashboardLink}" class="button">View My Donor Portal</a>
      </div>

      <div style="margin-top: 28px; color: #495057; font-style: italic; border-top: 1px solid #e9ecef; padding-top: 20px;">
        <p>With gratitude,<br><strong>${orgName} Team</strong></p>
      </div>

      ${this.getFooterHtml()}
    `;

    // Plain text fallback
    const donationLines = donations.map((d, i) => {
      const date = new Date(d.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return `  ${i + 1}. ${date} | ${d.type || 'Donation'} | ${d.description || 'N/A'} | $${parseFloat(d.amount).toFixed(2)}`;
    }).join('\n');

    const text = `
Your ${month} Donation Summary – ${orgName}

Dear ${donor.name},

Here is a summary of your donations to ${orgName} for ${month}.

Total Donated: $${parseFloat(totalAmount).toFixed(2)}

Donation Breakdown:
${donationLines}

View your full history: ${dashboardLink}

With gratitude,
${orgName} Team
    `.trim();

    return await this.sendEmail({
      to: donor.email,
      subject,
      html: this.generateEmailHtml(content, organization, subject, true, false),
      text,
      from: `"${orgName}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
