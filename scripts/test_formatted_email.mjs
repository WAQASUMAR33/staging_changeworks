
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import the actual email service
// We need to use the absolute path or relative path from this script
import { emailService } from '../src/app/lib/email-service.js';

async function sendFormattedTestEmail() {
  console.log('Initializing formatted email test...');
  
  const targetEmail = 'theitxprts@gmail.com';
  
  // Mock data for the one-time donation email
  const mockData = {
    donor: {
      name: 'IT Experts Test',
      email: targetEmail
    },
    organization: {
      name: 'ChangeWorks Fund',
      email: 'support@changeworksfund.org',
      firstName: 'Sarah',
      lastName: 'Director',
      title: 'Executive Director',
      imageUrl: 'uploads/cw-logo.png', // Assuming this path or similar exists, or logic handles fallback
      ein: '12-3456789',
      address: '5830 E 2nd St. STE 7000 #29896',
      city: 'Casper',
      state: 'WY',
      postalCode: '82609',
      phone: '555-0123'
    },
    dashboardLink: 'https://app.changeworksfund.org/donor/dashboard',
    amount: '10.00',
    donationDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    transactionId: 'TEST-TRX-' + Date.now(),
    paymentMethod: 'Visa ending in 4242',
    campaignName: 'Test Campaign'
  };

  console.log(`Sending formatted one-time donation email to ${targetEmail}...`);
  
  try {
    const result = await emailService.sendOneTimeDonationEmail(mockData);
    
    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('Message ID:', result.messageId);
      console.log('Please check your inbox for the branded "Thanks for Your One-Time Donation" email.');
    } else {
      console.error('❌ Email sending failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error executing email service:', error);
  }
}

sendFormattedTestEmail();
