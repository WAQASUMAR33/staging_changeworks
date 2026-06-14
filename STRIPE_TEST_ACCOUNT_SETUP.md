# Stripe Test Account Setup Guide

This guide will help you set up your Stripe test account keys for development.

## 📋 Required Test Keys

You need **3 environment variables** for Stripe integration:

1. **STRIPE_SECRET_KEY** - Server-side API key (starts with `sk_test_`)
2. **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY** - Client-side key (starts with `pk_test_`)
3. **STRIPE_WEBHOOK_SECRET** - Webhook signing secret (starts with `whsec_`)

## 🔑 Step-by-Step Setup

### Step 1: Get Your Test API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Make sure you're in **Test mode** (toggle in the top right should say "Test mode")
3. In the **API keys** section, you'll see:
   - **Publishable key** (starts with `pk_test_`) → Copy this
   - **Secret key** (starts with `sk_test_`) → Click "Reveal test key" and copy it

### Step 2: Set Up Webhook Secret

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click **"Add endpoint"** or use an existing endpoint
3. Set the endpoint URL to:
   ```
   https://your-domain.com/api/payments/webhook
   ```
   For local development, use [Stripe CLI](https://stripe.com/docs/stripe-cli) or ngrok
4. Select events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. After creating the endpoint, click on it to view details
6. In the **"Signing secret"** section, click **"Reveal"** and copy the secret (starts with `whsec_`)

### Step 3: Update Your .env.local File

Add these variables to your `.env.local` file:

```env
# Stripe Test Account Keys
STRIPE_SECRET_KEY=sk_test_your_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_key_here

# Optional: App URL (for webhooks and redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## ⚠️ Important Notes

### Key Format Validation

- ✅ **STRIPE_SECRET_KEY**: Must start with `sk_test_` (test) or `sk_live_` (production)
- ✅ **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY**: Must start with `pk_test_` (test) or `pk_live_` (production)
- ✅ **STRIPE_WEBHOOK_SECRET**: Must start with `whsec_` (NOT `ed_test_` or anything else)

### Current Issue

Your current `STRIPE_WEBHOOK_SECRET` starts with `ed_test_` which is incorrect. Webhook secrets should start with `whsec_`.

### Local Development with Webhooks

For local development, you have two options:

#### Option 1: Use Stripe CLI (Recommended)

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Login: `stripe login`
3. Forward webhooks: `stripe listen --forward-to localhost:3000/api/payments/webhook`
4. Copy the webhook signing secret that appears (starts with `whsec_`)
5. Add it to your `.env.local` as `STRIPE_WEBHOOK_SECRET`

#### Option 2: Use ngrok

1. Install [ngrok](https://ngrok.com/)
2. Run: `ngrok http 3000`
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. In Stripe Dashboard, create a webhook endpoint with URL: `https://abc123.ngrok.io/api/payments/webhook`
5. Copy the webhook signing secret

## ✅ Verification

After setting up your keys, verify they're working:

1. **Check server logs** - You should see "Stripe initialized successfully" in console
2. **Test payment flow** - Try creating a test payment
3. **Check webhook logs** - In Stripe Dashboard → Webhooks → Your endpoint → View logs

## 🧪 Test Card Numbers

Use these test card numbers in your application:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Use any future expiry date, any 3-digit CVC, and any ZIP code.

## 🔒 Security Reminders

- ✅ Never commit `.env.local` to version control
- ✅ Use test keys for development, live keys only in production
- ✅ Keep your secret keys secure and never share them
- ✅ Rotate keys if they're ever exposed

## 🐛 Troubleshooting

### "Stripe not initialized" error
- Check that `STRIPE_SECRET_KEY` is set and starts with `sk_test_`
- Restart your development server after adding environment variables

### "Invalid publishable key format" error
- Ensure `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts with `pk_test_`
- Make sure there are no extra spaces or quotes around the key

### Webhook signature verification failed
- Verify `STRIPE_WEBHOOK_SECRET` starts with `whsec_`
- Ensure you're using the correct secret for your webhook endpoint
- Check that the webhook URL matches your endpoint

### Products not creating
- Verify `STRIPE_SECRET_KEY` is valid and has proper permissions
- Check server logs for specific Stripe API errors
- Ensure you're using test mode keys in test mode

## 📚 Additional Resources

- [Stripe Test Mode Documentation](https://stripe.com/docs/testing)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)

