import dotenv from 'dotenv';
dotenv.config();

async function test() {
  console.log('EMAIL_SERVER_HOST:', process.env.EMAIL_SERVER_HOST);
  const { emailService } = await import('./src/app/lib/email-service.js');
  
  console.log('Starting one-time donation email test...');
  try {
    const result = await emailService.sendOneTimeDonationEmail({
        donor: { name: 'Test User', email: 'theitxprts@gmail.com' },
        organization: { name: 'ChangeWorks Test', email: 'support@changeworks.org' },
        dashboardLink: 'https://app.changeworksfund.org/donor/dashboard',
        amount: '10.00',
        donationDate: new Date().toLocaleDateString()
    });
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
