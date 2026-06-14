/**
 * Test script: donor auto-create email (GHL payment welcome email)
 *
 * Mirrors exactly what maybeCreateDonorAccount() sends after a successful
 * Stripe payment_intent.succeeded webhook.
 *
 * Run:
 *   node scripts/test-donor-auto-create.js
 *
 * Override recipient (send to your inbox instead of creating a real donor):
 *   SEND_TO=you@example.com node scripts/test-donor-auto-create.js
 *
 * Use a specific org by locationId:
 *   TEST_GHL_LOCATION_ID=xyz node scripts/test-donor-auto-create.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

const TEST_EMAIL = 'm3xtraders@gmail.com';
const TEST_NAME  = 'M3x Traders';
const TEST_PHONE = null;
// Optional: override where the test email is delivered (keeps the test donor from being created)
const SEND_TO    = process.env.SEND_TO || null;
// Optional: resolve org branding by GHL locationId
const TEST_LOCATION_ID = process.env.TEST_GHL_LOCATION_ID || null;

// ─── Nodemailer transport ─────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
  tls: { rejectUnauthorized: false },
});

// ─── Email helpers (mirrors email-service.js) ────────────────────────────────
function getAppBase() {
  let base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base.replace(/\/$/, '');
}

function getOrgLogoUrl(organization) {
  if (!organization?.imageUrl) return null;
  if (organization.imageUrl.startsWith('http')) return organization.imageUrl;
  if (organization.imageUrl.startsWith('/imgs/')) {
    return `${getAppBase()}${organization.imageUrl}`;
  }
  if (process.env.NEXT_PUBLIC_IMAGE_BACK_URL) {
    const cleanBase = process.env.NEXT_PUBLIC_IMAGE_BACK_URL.replace(/\/$/, '');
    const cleanPath = organization.imageUrl.startsWith('/') ? organization.imageUrl : `/${organization.imageUrl}`;
    return `${cleanBase}${cleanPath}`;
  }
  const cleanBase = getAppBase();
  const cleanPath = organization.imageUrl.startsWith('/') ? organization.imageUrl : `/${organization.imageUrl}`;
  return `${cleanBase}${cleanPath}`;
}

function getFooterHtml() {
  const changeWorksLogoUrl = `${getAppBase()}/imgs/changeworks.png`;
  return `
    <div style="margin-top:40px;color:#6c757d;font-family:sans-serif;">
      <div style="text-align:left;margin-bottom:30px;">
        <p style="font-size:12px;font-style:italic;color:#333;margin-bottom:20px;">
          This message was sent to help protect your account. Please do not reply directly to this email.
        </p>
        <div style="margin-bottom:10px;">
          <img src="${changeWorksLogoUrl}" alt="ChangeWorks Fund" style="max-height:50px;height:auto;display:block;">
        </div>
        <h3 style="margin:0 0 5px 0;color:#000;font-size:16px;font-weight:700;"><strong>ChangeWorks Fund</strong></h3>
        <p style="margin:0 0 3px 0;font-size:14px;color:#333;"><a href="https://changeworksfund.org" style="color:#0056b3;text-decoration:none;">ChangeWorksFund.Org</a></p>
        <p style="margin:0;font-size:14px;color:#333;">Your trusted platform partner for charitable giving</p>
      </div>
      <div style="border-top:1px solid #ccc;margin:30px 0;"></div>
      <div style="text-align:center;font-size:12px;color:#333;">
        <p style="font-weight:bold;margin-bottom:10px;color:#302E56;">Contact Information</p>
        <p style="margin-bottom:5px;">Email: <a href="mailto:support@changeworksfund.org" style="color:#0056b3;text-decoration:none;">support@changeworksfund.org</a></p>
        <p style="margin-bottom:5px;">5830 E 2nd St. STE 7000 #29896</p>
        <p style="margin-bottom:20px;">Casper, WY 82609</p>
        <p><a href="#" style="color:#0056b3;text-decoration:none;">Unsubscribe</a></p>
      </div>
    </div>`;
}

function wrapEmailHtml(content, title) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin:0;padding:0;background-color:#f3f2ef;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; }
    .button { display:inline-block;background-color:#302E56;color:#ffffff!important;padding:12px 24px;text-decoration:none;border-radius:24px;font-weight:600;margin:20px 0;text-align:center; }
    ul { padding-left:20px;margin-bottom:1.5em; }
    li { margin-bottom:8px; }
    @media only screen and (max-width:600px) { .main-table{width:100%!important} .content-cell{padding:20px!important} }
  </style>
</head>
<body style="background-color:#f3f2ef;margin:0;padding:0;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f2ef;">
    <tr>
      <td align="center" style="padding:40px 0;">
        <table class="main-table" role="presentation" border="0" cellpadding="0" cellspacing="0" width="600"
          style="background-color:#ffffff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);overflow:hidden;margin:0 auto;">
          <tr>
            <td class="content-cell" style="padding:40px;text-align:left;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:16px;color:#333;line-height:1.6;">
              ${content}
            </td>
          </tr>
        </table>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="margin:0 auto;">
          <tr><td style="padding:0 40px;">${getFooterHtml()}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n========================================');
  console.log('  Donor Auto-Create Email Test');
  console.log('========================================\n');

  // Step 1: Email config
  console.log('Step 1: Verifying email config...');
  console.log('  HOST :', process.env.EMAIL_SERVER_HOST || '❌ NOT SET');
  console.log('  PORT :', process.env.EMAIL_SERVER_PORT || '❌ NOT SET');
  console.log('  USER :', process.env.EMAIL_SERVER_USER || '❌ NOT SET');
  console.log('  PASS :', process.env.EMAIL_SERVER_PASSWORD ? '✅ SET' : '❌ NOT SET');
  console.log('  IMAGE_BACK_URL:', process.env.NEXT_PUBLIC_IMAGE_BACK_URL || '(not set)');
  try {
    await transporter.verify();
    console.log('  ✅ Email connection verified\n');
  } catch (e) {
    console.error('  ❌ Email connection FAILED:', e.message, '\n');
  }

  // Step 2: Org lookup
  console.log('Step 2: Org lookup from locationId:', TEST_LOCATION_ID || '(none — will pick first org)');
  let organization = null;
  if (TEST_LOCATION_ID) {
    organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { ghlId: TEST_LOCATION_ID },
          { ghlAccounts: { some: { ghl_location_id: TEST_LOCATION_ID } } },
        ],
      },
      select: { id: true, name: true, imageUrl: true },
    });
    if (organization) {
      console.log('  ✅ Found org:', organization.name, '(id:', organization.id, ')');
    } else {
      console.log('  ⚠️  No org found for locationId:', TEST_LOCATION_ID);
    }
  } else {
    organization = await prisma.organization.findFirst({
      where: { ghlId: { not: null } },
      select: { id: true, name: true, imageUrl: true },
    });
    if (organization) {
      console.log('  ℹ️  Using first org with ghlId:', organization.name, '(id:', organization.id, ')');
    } else {
      console.log('  ⚠️  No org found — will use ChangeWorks fallback branding');
    }
  }

  // Step 3: Build email parameters
  const name    = TEST_NAME?.trim() || TEST_EMAIL.split('@')[0];
  const orgName = organization?.name || 'ChangeWorks';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
  const logoUrl = getOrgLogoUrl(organization);
  const loginUrl = `${baseUrl}/donor/login`;
  // Use a dummy password for preview (real one is generated per-donor)
  const testPassword = 'TempPass123';

  console.log('\nStep 3: Email parameters');
  console.log('  Donor name      :', name);
  console.log('  Donor email     :', TEST_EMAIL);
  console.log('  Org name        :', orgName);
  console.log('  Logo URL        :', logoUrl || '(none — will show org name as text)');
  console.log('  Login URL       :', loginUrl);

  // Step 4: Build email (exact mirror of webhook)
  const subject = `Welcome to ${orgName}'s Donation Community`;

  const content = `
    <div style="text-align:center;margin-bottom:30px;">
      ${logoUrl ? `<img src="${logoUrl}" alt="${orgName}" style="max-height:100px;max-width:220px;height:auto;border:0;display:block;margin:0 auto 12px auto;">` : ''}
      <h2 style="color:#302E56;margin:0;font-size:22px;font-weight:700;">${orgName}</h2>
    </div>

    <p style="font-size:18px;font-weight:500;color:#212529;margin-bottom:20px;">Hello ${name}</p>

    <p>Thank you for supporting our work financially with your donation. Your generosity truly matters to us, and we want giving to feel simple and effortless.</p>

    <p>That's why you have your own donor dashboard with our trusted donation platform partner, <strong>ChangeWorks</strong>. It puts everything you need in one place:</p>

    <ul style="color:#495057;">
      <li><strong>See your monthly donation totals</strong> whenever you'd like</li>
      <li><strong>Adjust or pause your contributions</strong> if your needs change</li>
      <li><strong>Download your donation records</strong> for easy reference or tax time</li>
    </ul>

    <p>Your account has been created. Here are your login credentials:</p>

    <div style="background-color:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:20px 24px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#6c757d;width:120px;">Email</td>
          <td style="padding:6px 0;font-size:15px;color:#212529;font-weight:600;">${TEST_EMAIL}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#6c757d;">Password</td>
          <td style="padding:6px 0;font-size:15px;color:#212529;font-weight:600;">${testPassword}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="${loginUrl}" style="display:inline-block;background-color:#302E56;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:24px;font-weight:600;font-size:15px;letter-spacing:.02em;">LOGIN TO YOUR DASHBOARD</a>
    </div>

    <p>If you ever have a question or just want to reach out, we'd love to hear from you. We're grateful to have you with us.</p>

    <div style="margin-top:30px;font-style:italic;color:#495057;">
      <p>Warm regards,<br><strong>The ${orgName} Team</strong></p>
    </div>

    <p style="margin-top:20px;font-size:14px;color:#6c757d;"><strong>P.S.</strong> At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.</p>
  `;

  const html = wrapEmailHtml(content, subject);

  const text = `Welcome to ${orgName}'s Donation Community\n\nHello ${name},\n\nThank you for supporting our work financially with your donation. Your generosity truly matters to us, and we want giving to feel simple and effortless.\n\nThat's why you have your own donor dashboard with our trusted donation platform partner, ChangeWorks. It puts everything you need in one place:\n- See your monthly donation totals whenever you'd like\n- Adjust or pause your contributions if your needs change\n- Download your donation records for easy reference or tax time\n\nYour account is ready. Here are your login credentials:\nEmail: ${TEST_EMAIL}\nPassword: ${testPassword}\n\nLogin to your dashboard: ${loginUrl}\n\nIf you ever have a question or just want to reach out, we'd love to hear from you. We're grateful to have you with us.\n\nWarm regards,\nThe ${orgName} Team\n\nP.S. At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.`;

  // Step 5: Send
  const recipient = SEND_TO || TEST_EMAIL;
  console.log('\nStep 4: Sending email...');
  console.log('  To      :', recipient, SEND_TO ? '(SEND_TO override)' : '');
  console.log('  Subject :', subject);

  try {
    const info = await transporter.sendMail({
      from: `"${orgName}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
      to: recipient,
      subject,
      html,
      text,
    });
    console.log('\n  ✅ Email sent! MessageId:', info.messageId);
    console.log('  Check inbox:', recipient);
  } catch (e) {
    console.error('\n  ❌ Email send FAILED:', e.message);
  }

  console.log('\n========================================');
  console.log('  Test Complete');
  console.log('========================================\n');

  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
