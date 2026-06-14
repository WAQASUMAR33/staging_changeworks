
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

async function simulateWebhook() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Error: STRIPE_WEBHOOK_SECRET not found in .env');
    process.exit(1);
  }

  const payload = {
    id: 'evt_test_webhook_' + Date.now(),
    object: 'event',
    type: 'payment_intent.succeeded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pi_test_' + Date.now(),
        object: 'payment_intent',
        amount: 1000, // $10.00
        amount_received: 1000,
        currency: 'usd',
        status: 'succeeded',
        receipt_url: 'https://pay.stripe.com/receipts/test',
        payment_method: 'pm_test_card',
        payment_method_details: {
          card: {
            last4: '4242'
          }
        },
        metadata: {
          donor_id: '1', // Ensure this ID exists in your local DB
          organization_id: '1', // Ensure this ID exists in your local DB
          transaction_type: 'one_time',
          campaign_name: 'Webhook Simulation'
        },
        created: Math.floor(Date.now() / 1000)
      }
    }
  };

  const payloadString = JSON.stringify(payload, null, 2);
  const timestamp = Math.floor(Date.now() / 1000);
  
  const signedPayload = `${timestamp}.${payloadString}`;
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(signedPayload);
  const signature = hmac.digest('hex');
  const stripeSignature = `t=${timestamp},v1=${signature}`;

  console.log('Simulating Stripe Webhook...');
  console.log(`Endpoint: http://localhost:3000/api/payments/webhook`);
  console.log(`Event Type: ${payload.type}`);
  console.log(`Payment Intent: ${payload.data.object.id}`);

  try {
    const response = await axios.post('http://localhost:3000/api/payments/webhook', payload, {
      headers: {
        'Stripe-Signature': stripeSignature,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response Status:', response.status);
    console.log('Response Data:', response.data);
    
    if (response.status === 200) {
        console.log('✅ Webhook accepted successfully.');
        console.log('Check your application logs (Terminal 4?) to see if email sending was triggered.');
    }
  } catch (error) {
    console.error('❌ Webhook request failed:', error.message);
    if (error.response) {
      console.error('Response Data:', error.response.data);
    }
  }
}

simulateWebhook();
