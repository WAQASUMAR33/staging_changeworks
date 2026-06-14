
const nodemailer = require('nodemailer');

async function sendTestEmail() {
  console.log('Initializing email test...');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: 'noreply@mg.changeworksfund.org',
      pass: 'YOUR_MAILGUN_API_KEY',
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const targetEmail = 'theitxprts@gmail.com';
  const orgName = 'ChangeWorks Fund (Test)';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Test Email</title>
    </head>
    <body>
      <h1>Test Email from ChangeWorks</h1>
      <p>This is a test email sent to ${targetEmail}.</p>
      <p>If you received this, the SMTP configuration is working correctly.</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: 'noreply@mg.changeworksfund.org',
    to: targetEmail,
    subject: `Test Email for ${targetEmail}`,
    html: html,
    text: `Test Email from ChangeWorks. This is a test email sent to ${targetEmail}.`
  };

  try {
    console.log(`Sending email to ${targetEmail}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    console.log('Test completed successfully.');
  } catch (error) {
    console.error('Error occurred while sending email:', error);
  }
}

sendTestEmail();
