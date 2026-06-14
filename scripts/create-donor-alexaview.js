/**
 * One-time script: manually create donor account for alexaview.com@gmail.com
 *
 * This donor made a live GHL payment (pi_3TOLHhPI3VSTrOIy01jmJ7Zr, $100)
 * via Vallarta Cares (locationId: dRUbbKnllFf5kqw6hId3) but the Stripe
 * payment_intent.succeeded webhook was never received, so no account was created.
 *
 * Run:
 *   node scripts/create-donor-alexaview.js
 *
 * Dry-run (skips DB write + email send):
 *   DRY_RUN=1 node scripts/create-donor-alexaview.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

const DONOR_EMAIL    = 'alexaview.com@gmail.com';
const DONOR_NAME     = null; // will be resolved from GHL or default to 'Donor'
const LOCATION_ID    = 'dRUbbKnllFf5kqw6hId3'; // Vallarta Cares
const DRY_RUN        = process.env.DRY_RUN === '1';

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

function getAppBase() {
  let base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base.replace(/\/$/, '');
}

function getOrgLogoUrl(org) {
  if (!org?.imageUrl) return null;
  if (org.imageUrl.startsWith('http')) return org.imageUrl;
  const cleanBase = process.env.NEXT_PUBLIC_IMAGE_BACK_URL?.replace(/\/$/, '') || getAppBase();
  const cleanPath = org.imageUrl.startsWith('/') ? org.imageUrl : `/${org.imageUrl}`;
  return `${cleanBase}${cleanPath}`;
}

function getFooterHtml() {
  const logoUrl = `${getAppBase()}/imgs/changeworks.png`;
  return `
    <div style="margin-top:40px;color:#6c757d;font-family:sans-serif;">
      <div style="text-align:left;margin-bottom:30px;">
        <p style="font-size:12px;font-style:italic;color:#333;margin-bottom:20px;">
          This message was sent to help protect your account. Please do not reply directly to this email.
        </p>
        <div style="margin-bottom:10px;">
          <img src="${logoUrl}" alt="ChangeWorks Fund" style="max-height:50px;height:auto;display:block;">
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

function buildEmailHtml(name, email, orgName, logoUrl, loginUrl, password) {
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

    <p>Your account is ready. Here are your login credentials:</p>

    <div style="background-color:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:20px 24px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#6c757d;width:120px;">Email</td>
          <td style="padding:6px 0;font-size:15px;color:#212529;font-weight:600;">${email}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#6c757d;">Password</td>
          <td style="padding:6px 0;font-size:15px;color:#212529;font-weight:600;">${password}</td>
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

    ${getFooterHtml()}
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${orgName}'s Donation Community</title>
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
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function run() {
  console.log('\n========================================');
  console.log('  Manual Donor Creation: alexaview.com@gmail.com');
  console.log(DRY_RUN ? '  MODE: DRY RUN (no DB/email writes)' : '  MODE: LIVE');
  console.log('========================================\n');

  // 1. Check if donor already exists
  const existing = await prisma.donor.findFirst({
    where: { email: DONOR_EMAIL.toLowerCase() },
    select: { id: true, name: true, email: true },
  });
  if (existing) {
    console.log('✅ Donor already exists:', existing);
    await prisma.$disconnect();
    return;
  }
  console.log('❌ Donor not found — will create.\n');

  // 2. Resolve org
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { ghlId: LOCATION_ID },
        { ghlAccounts: { some: { ghl_location_id: LOCATION_ID } } },
      ],
    },
    select: { id: true, name: true, imageUrl: true },
  });
  console.log('Org:', org ? `${org.name} (id: ${org.id})` : `NOT FOUND for locationId ${LOCATION_ID}`);

  const orgName  = org?.name || 'ChangeWorks';
  const logoUrl  = getOrgLogoUrl(org);
  const baseUrl  = getAppBase();
  const loginUrl = `${baseUrl}/donor/login`;

  // 3. Generate credentials
  const rawPassword   = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  const hashedPassword = await bcrypt.hash(rawPassword, 12);
  const email = DONOR_EMAIL.toLowerCase().trim();
  const name  = DONOR_NAME || 'Donor';

  console.log('\nDonor details:');
  console.log('  Name     :', name);
  console.log('  Email    :', email);
  console.log('  Password :', rawPassword, '(plain — will hash in DB)');
  console.log('  Org ID   :', org?.id ?? 'none');

  // 4. Create donor in DB
  if (!DRY_RUN) {
    const donor = await prisma.donor.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: null,
        country: 'US',
        status: true,
        ...(org ? { organization_id: org.id } : {}),
      },
    });
    console.log('\n✅ Donor created (id:', donor.id, ')');
  } else {
    console.log('\n[DRY RUN] Skipping donor DB create.');
  }

  // 5. Send welcome email
  const subject = `Welcome to ${orgName}'s Donation Community`;
  const html    = buildEmailHtml(name, email, orgName, logoUrl, loginUrl, rawPassword);
  const text    = `Welcome to ${orgName}'s Donation Community\n\nHello ${name},\n\nYour donor account is ready.\n\nEmail: ${email}\nPassword: ${rawPassword}\n\nLogin: ${loginUrl}\n\nWarm regards,\nThe ${orgName} Team`;

  console.log('\nSending welcome email to:', email);
  console.log('Subject:', subject);

  if (!DRY_RUN) {
    try {
      await transporter.verify();
      const info = await transporter.sendMail({
        from: `"${orgName}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
        to: email,
        subject,
        html,
        text,
      });
      console.log('✅ Email sent! MessageId:', info.messageId);
    } catch (e) {
      console.error('❌ Email send FAILED:', e.message);
    }
  } else {
    console.log('[DRY RUN] Skipping email send.');
  }

  console.log('\n========================================');
  console.log('  Done');
  console.log('========================================\n');

  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
