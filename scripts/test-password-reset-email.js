/**
 * Test: password reset email org-name header
 * Looks up a donor by email, resolves their org via direct link or subscriptions,
 * then sends the password reset email so you can verify the From header in your inbox.
 *
 * Run:
 *   node scripts/test-password-reset-email.js
 * or with a specific donor email:
 *   DONOR_EMAIL=dilwaq22@gmail.com node scripts/test-password-reset-email.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

const DONOR_EMAIL = process.env.DONOR_EMAIL || 'theitxprts@gmail.com';

// ─── Minimal EmailService replica (mirrors src/app/lib/email-service.js) ──────
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

async function sendTestResetEmail({ donor, organization }) {
  const orgName = organization?.name || 'ChangeWorks Fund';
  const fromHeader = `"${orgName}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`;
  const subject = `Reset your password for your ${orgName} donor account`;
  const resetLink = 'https://app.changeworksfund.org/donor/reset-password?token=TEST_TOKEN_123';

  console.log('\n📧 Email details:');
  console.log('   To     :', donor.email);
  console.log('   From   :', fromHeader);   // <-- this is what appears as the header in inbox
  console.log('   Subject:', subject);

  const info = await transporter.sendMail({
    to: donor.email,
    from: fromHeader,
    subject,
    text: `Hello ${donor.name},\n\nThis is a test password reset email.\n\nReset link: ${resetLink}\n\nSent by: ${orgName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #302E56;">${orgName}</h2>
        <p>Hello <strong>${donor.name}</strong>,</p>
        <p>This is a <strong>test</strong> password reset email to verify the sender header.</p>
        <p>The <em>From</em> header in your inbox should show: <strong>${orgName}</strong></p>
        <div style="margin: 30px 0;">
          <a href="${resetLink}" style="background:#302E56;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">
            Reset Password (test link)
          </a>
        </div>
        <p style="color:#999;font-size:12px;">Sent via ChangeWorks test script</p>
      </div>
    `,
  });

  return info.messageId;
}

async function main() {
  console.log('=== Password Reset Email – Org Header Test ===');
  console.log('Donor email:', DONOR_EMAIL);

  // 1. Look up donor + org (mirrors the fixed forgot-password route)
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

  // 2. Resolve org — same priority as the fixed route
  const organization = donor.organization
    || donor.subscriptions?.[0]?.organization
    || null;

  if (!organization) {
    console.warn('\n⚠️  No organization found for this donor — email will show "ChangeWorks Fund"');
  } else {
    console.log('\n✅ Resolved org name:', organization.name);
  }

  // 3. Send test email
  console.log('\nSending email...');
  const messageId = await sendTestResetEmail({ donor, organization });
  console.log('\n✅ Email sent! Message ID:', messageId);
  console.log('\nCheck your inbox — the From header should show:', organization?.name || 'ChangeWorks Fund');
}

main()
  .catch((err) => { console.error('❌ Error:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
