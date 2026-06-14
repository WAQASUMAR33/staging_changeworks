/**
 * Test: Monthly Donation Summary Email
 *
 * Looks up donor dilwaq22@gmail.com, fetches their real transactions for the
 * current month (falls back to mock data if none found), then sends the
 * monthly donation summary email so you can verify layout and org branding.
 *
 * Run:
 *   node scripts/test-monthly-donation-summary-email.js
 *
 * Override donor email:
 *   DONOR_EMAIL=other@example.com node scripts/test-monthly-donation-summary-email.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

const DONOR_EMAIL = process.env.DONOR_EMAIL || 'dilwaq22@gmail.com';

// ─── Nodemailer transport ─────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
  tls: { rejectUnauthorized: false },
});

// ─── Helpers (mirrors email-service.js) ──────────────────────────────────────
function getAppBase() {
  let base = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base.replace(/\/$/, '');
}

function getOrgLogoUrl(organization) {
  if (!organization?.imageUrl) return null;
  if (organization.imageUrl.startsWith('http')) return organization.imageUrl;
  const base = process.env.NEXT_PUBLIC_IMAGE_BACK_URL || getAppBase();
  const cleanBase = base.replace(/\/$/, '');
  const cleanPath = organization.imageUrl.startsWith('/') ? organization.imageUrl : `/${organization.imageUrl}`;
  return `${cleanBase}${cleanPath}`;
}

function buildEmailHtml({ donor, organization, month, totalAmount, donations, dashboardLink }) {
  const orgName    = organization?.name || 'ChangeWorks';
  const logoUrl    = getOrgLogoUrl(organization);
  const changeWorksLogo = `${getAppBase()}/imgs/changeworks.png`;

  // Donation table rows
  const donationRows = donations.map((d, i) => {
    const date   = new Date(d.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const amount = parseFloat(d.amount).toFixed(2);
    const bg     = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
    return `
      <tr style="background-color:${bg};">
        <td style="padding:12px 16px;font-size:14px;color:#333;border-bottom:1px solid #e9ecef;">${date}</td>
        <td style="padding:12px 16px;font-size:14px;color:#333;border-bottom:1px solid #e9ecef;">${d.type || 'Donation'}</td>
        <td style="padding:12px 16px;font-size:14px;color:#333;border-bottom:1px solid #e9ecef;">${d.description || '—'}</td>
        <td style="padding:12px 16px;font-size:14px;color:#333;border-bottom:1px solid #e9ecef;text-align:right;font-weight:600;">$${amount}</td>
      </tr>`;
  }).join('');

  const total = parseFloat(totalAmount).toFixed(2);

  const footer = `
    <div style="margin-top:40px;color:#6c757d;font-family:sans-serif;">
      <div style="text-align:left;margin-bottom:30px;">
        <p style="font-size:12px;font-style:italic;color:#333;margin-bottom:20px;">
          This message was sent to help protect your account. Please do not reply directly to this email.
        </p>
        <div style="margin-bottom:10px;">
          <img src="${changeWorksLogo}" alt="ChangeWorks" style="max-height:50px;height:auto;display:block;">
        </div>
        <h3 style="margin:0 0 5px 0;color:#000;font-size:16px;font-weight:bold;">ChangeWorks</h3>
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

  const content = `
    <p style="font-size:18px;font-weight:500;color:#212529;margin-bottom:8px;">Dear ${donor.name},</p>
    <p style="color:#495057;margin-bottom:28px;">Here is a summary of your donations to <strong>${orgName}</strong> for the month of <strong>${month}</strong>. Thank you for your continued generosity and support.</p>

    <!-- Monthly Total Banner -->
    <div style="background:linear-gradient(135deg,#302E56 0%,#4A487A 100%);color:white;padding:28px 32px;border-radius:12px;margin:24px 0;text-align:center;box-shadow:0 6px 20px rgba(48,46,86,0.25);">
      <p style="margin:0 0 6px 0;font-size:14px;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">Total Donated in ${month}</p>
      <div style="font-size:42px;font-weight:700;letter-spacing:-1px;">$${total}</div>
      <p style="margin:8px 0 0 0;font-size:14px;opacity:0.8;">${donations.length} donation${donations.length !== 1 ? 's' : ''} this month</p>
    </div>

    <!-- Donation Table -->
    <h3 style="color:#302E56;font-size:16px;font-weight:700;margin:28px 0 12px 0;border-bottom:2px solid #302E56;padding-bottom:8px;">Donation Breakdown</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e9ecef;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background-color:#302E56;">
          <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Date</th>
          <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Type</th>
          <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
          <th style="padding:12px 16px;text-align:right;font-size:12px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${donationRows}
        <tr style="background-color:#f1f0fb;">
          <td colspan="3" style="padding:14px 16px;font-size:15px;font-weight:700;color:#302E56;">Total</td>
          <td style="padding:14px 16px;font-size:15px;font-weight:700;color:#302E56;text-align:right;">$${total}</td>
        </tr>
      </tbody>
    </table>

    <p style="margin-top:28px;color:#495057;">You can view your full giving history, download records, and manage your donations anytime from your Donor Portal.</p>

    <div style="text-align:center;margin:24px 0;">
      <a href="${dashboardLink}" style="display:inline-block;background-color:#302E56;color:#fff;padding:12px 24px;text-decoration:none;border-radius:24px;font-weight:600;">View My Donor Portal</a>
    </div>

    <div style="margin-top:28px;color:#495057;font-style:italic;border-top:1px solid #e9ecef;padding-top:20px;">
      <p>With gratitude,<br><strong>${orgName} Team</strong></p>
    </div>

    ${footer}
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your ${month} Donation Summary</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f3f2ef;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f2ef;">
        <tr>
          <td align="center" style="padding:40px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600"
              style="background-color:#ffffff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);overflow:hidden;margin:0 auto;">
              <tr>
                <td style="padding:40px;text-align:left;font-size:16px;color:#333;line-height:1.6;">
                  <!-- Org Header -->
                  <div style="text-align:center;margin-bottom:30px;">
                    ${logoUrl
                      ? `<img src="${logoUrl}" alt="${orgName}" style="max-height:120px;max-width:250px;height:auto;border:0;display:inline-block;margin-bottom:15px;">`
                      : ''}
                    <h2 style="color:#302E56;margin:0;font-size:24px;font-weight:700;">${orgName}</h2>
                  </div>
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

function buildPlainText({ donor, organization, month, totalAmount, donations, dashboardLink }) {
  const orgName = organization?.name || 'ChangeWorks';
  const lines = donations.map((d, i) => {
    const date = new Date(d.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return `  ${i + 1}. ${date} | ${d.type || 'Donation'} | ${d.description || 'N/A'} | $${parseFloat(d.amount).toFixed(2)}`;
  }).join('\n');

  return `
Your ${month} Donation Summary – ${orgName}

Dear ${donor.name},

Here is a summary of your donations to ${orgName} for ${month}.

Total Donated: $${parseFloat(totalAmount).toFixed(2)}

Donation Breakdown:
${lines}

View your full history: ${dashboardLink}

With gratitude,
${orgName} Team
  `.trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Monthly Donation Summary – Test Email ===');
  console.log('Donor email:', DONOR_EMAIL);

  // 1. Look up donor
  const donor = await prisma.donor.findUnique({
    where: { email: DONOR_EMAIL },
    include: {
      organization: true,
      subscriptions: {
        include: { organization: true },
        take: 1,
        orderBy: { created_at: 'desc' },
      },
    },
  });

  if (!donor) {
    console.error('❌ Donor not found:', DONOR_EMAIL);
    process.exit(1);
  }

  console.log('\n✅ Donor found:', donor.name);
  console.log('   organization_id :', donor.organization_id ?? 'NULL');
  console.log('   direct org      :', donor.organization?.name ?? 'none');
  console.log('   subscription org:', donor.subscriptions?.[0]?.organization?.name ?? 'none');

  // Resolve org
  const organization = donor.organization || donor.subscriptions?.[0]?.organization || null;
  console.log('\n✅ Resolved org:', organization?.name ?? 'ChangeWorks (fallback)');

  // 2. Fetch real transactions for current month
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const monthLabel = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

  const realTx = await prisma.donorTransaction.findMany({
    where: {
      donor_id: donor.id,
      ...(organization ? { organization_id: organization.id } : {}),
      created_at: { gte: monthStart, lte: monthEnd },
    },
    orderBy: { created_at: 'asc' },
  });

  let donations;
  let usedMock = false;

  if (realTx.length > 0) {
    console.log(`\n✅ Found ${realTx.length} real transaction(s) for ${monthLabel}`);
    donations = realTx.map(tx => ({
      date:        tx.created_at,
      type:        tx.transaction_type,
      description: tx.payment_method || tx.transaction_type,
      amount:      tx.amount,
    }));
  } else {
    usedMock = true;
    console.log(`\n⚠️  No real transactions found for ${monthLabel} — using mock data`);
    donations = [
      { date: new Date(now.getFullYear(), now.getMonth(), 5),  type: 'Round-Up',         description: 'Card round-up',      amount: 12.47 },
      { date: new Date(now.getFullYear(), now.getMonth(), 11), type: 'One-Time Donation', description: 'Direct donation',    amount: 50.00 },
      { date: new Date(now.getFullYear(), now.getMonth(), 18), type: 'Round-Up',         description: 'Card round-up',      amount: 8.93 },
      { date: new Date(now.getFullYear(), now.getMonth(), 25), type: 'Recurring',        description: 'Monthly donation',   amount: 25.00 },
    ];
  }

  const totalAmount = donations.reduce((sum, d) => sum + parseFloat(d.amount), 0);
  const dashboardLink = `${getAppBase()}/donor/login`;

  // 3. Build and send email
  const orgName  = organization?.name || 'ChangeWorks';
  const from     = `"${orgName}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`;
  const subject  = `Your ${monthLabel} Donation Summary – ${orgName}`;

  console.log('\n📧 Email details:');
  console.log('   To         :', donor.email);
  console.log('   From       :', from);
  console.log('   Subject    :', subject);
  console.log('   Month      :', monthLabel);
  console.log('   Donations  :', donations.length, usedMock ? '(mock)' : '(real)');
  console.log('   Total      : $' + totalAmount.toFixed(2));

  const html = buildEmailHtml({ donor, organization, month: monthLabel, totalAmount, donations, dashboardLink });
  const text = buildPlainText({ donor, organization, month: monthLabel, totalAmount, donations, dashboardLink });

  console.log('\nSending email...');
  const info = await transporter.sendMail({ to: donor.email, from, subject, html, text });

  console.log('\n✅ Email sent! Message ID:', info.messageId);
  console.log('   Check inbox:', donor.email);
  if (usedMock) {
    console.log('\n💡 Tip: No real transactions were found for this month.');
    console.log('   The email was sent with mock donation data for preview purposes.');
  }
}

main()
  .catch(err => { console.error('\n❌ Error:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
