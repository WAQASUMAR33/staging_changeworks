# Stripe Webhook Setup Guide

## Issue Identified
Stripe payments are being created successfully, but the webhook that updates payment status to "completed" is not being triggered automatically. This results in payments staying in "pending" status in the database.

## Root Cause
The Stripe webhook endpoint is not properly configured in the Stripe dashboard or not accessible from Stripe's servers.

## Solution Steps

### 1. Configure Webhook in Stripe Dashboard

1. **Login to Stripe Dashboard**
   - Go to https://dashboard.stripe.com/
   - Navigate to **Developers** → **Webhooks**

2. **Create New Webhook Endpoint**
   - Click **"Add endpoint"**
   - **Endpoint URL**: `https://app.changeworksfund.org/api/payments/webhook`
   - **Description**: "ChangeWorks Payment Webhooks"

3. **Select Events to Listen For**
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `payment_intent.processing`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

4. **Get Webhook Secret**
   - After creating the webhook, click on it
   - Go to **"Signing secret"** section
   - Copy the webhook secret (starts with `whsec_`)
   - Add it to your environment variables

### 2. Environment Variables

Add these to your `.env` file:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 3. Test Webhook

You can test the webhook using the debug endpoint:

```bash
# Test webhook simulation
POST /api/debug/test-payment-webhook
{
  "payment_intent_id": "pi_xxx",
  "donor_id": 14,
  "organization_id": 1,
  "amount": 50
}
```

### 4. Check Webhook Status

```bash
# Check recent transactions
GET /api/debug/check-transactions
```

## Manual Payment Confirmation (Backup)

If webhooks continue to fail, you can manually confirm payments using the test endpoint above.

## Troubleshooting

### Webhook Not Receiving Events
1. Check if the webhook URL is accessible from the internet
2. Verify the webhook secret is correct
3. Check Stripe dashboard for webhook delivery logs
4. Ensure the endpoint returns 200 status code

### Common Issues
- **404 Error**: Webhook URL not accessible
- **401 Error**: Invalid webhook secret
- **500 Error**: Server error in webhook processing

## Current Status
- ✅ Payment intents created successfully
- ✅ Webhook code works (tested with simulation)
- ❌ Stripe webhooks not configured/accessible
- ✅ Manual confirmation works as backup
