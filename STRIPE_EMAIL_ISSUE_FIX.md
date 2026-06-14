# Stripe Onboarding Email Issue - Fix Guide

## Problem Summary

✅ **Working:**
- GHL location creation: ✅ Working
- Stripe account creation: ✅ Working  
- Onboarding link generation: ✅ Working

❌ **Not Working:**
- Email delivery: ❌ Failing due to SMTP configuration issue

## Root Cause

The email is failing to send because the sender address `noreply@rapidtechpro.com` is being rejected by the SMTP server with the error:

```
450 4.1.8 <noreply@rapidtechpro.com>: Sender address rejected: Domain not found
```

This means the domain `rapidtechpro.com` is not verified or configured with your SMTP server (smtp.hostinger.com).

## Solutions

### Option 1: Fix Email Configuration (Recommended)

Update your `.env.local` file to use a verified sender email address that matches your SMTP server domain:

```env
EMAIL_SERVER_HOST=smtp.hostinger.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@yourdomain.com
EMAIL_SERVER_PASSWORD=your-password
EMAIL_FROM=your-verified-email@yourdomain.com  # Must be verified with Hostinger
```

**Important:** The `EMAIL_FROM` address must:
- Be a valid email address on your Hostinger account
- Have the domain verified with Hostinger
- Match the domain configured in your Hostinger email settings

### Option 2: Retrieve Onboarding Link Without Email

Even if email fails, you can still get the onboarding link using these methods:

#### Method 1: From Signup API Response

The signup API response includes the onboarding link:

```json
{
  "stripeOnboardingLink": "https://connect.stripe.com/setup/e/acct_xxx/xxx",
  "emailSent": "failed - [error message]"
}
```

#### Method 2: Using GET Endpoint

Get the onboarding link for an existing organization:

```bash
# By email
curl http://localhost:3000/api/organization/resend-onboarding-email?email=theitxprts@gmail.com

# By organization ID
curl http://localhost:3000/api/organization/resend-onboarding-email?organizationId=25
```

Response:
```json
{
  "success": true,
  "onboardingLink": "https://connect.stripe.com/setup/e/acct_xxx/xxx",
  "expiresAt": "2026-01-15T15:58:09.000Z",
  "organization": {
    "id": 25,
    "name": "Organization Name",
    "email": "theitxprts@gmail.com"
  }
}
```

#### Method 3: Using POST Endpoint (Resend Email)

Try to resend the email (will return link even if email fails):

```bash
curl -X POST http://localhost:3000/api/organization/resend-onboarding-email \
  -H "Content-Type: application/json" \
  -d '{"email": "theitxprts@gmail.com"}'
```

## Testing

### Test Email Configuration

```bash
node test-email-config.js theitxprts@gmail.com
```

### Test Organization Signup

```bash
node test-organization-signup-stripe.js
```

### Get Onboarding Link for Existing Organization

```bash
# Using email
curl http://localhost:3000/api/organization/resend-onboarding-email?email=theitxprts@gmail.com

# Using organization ID
curl http://localhost:3000/api/organization/resend-onboarding-email?organizationId=25
```

## Current Status

After the fix to `src/app/api/organization/route.js`:
- ✅ Email status now accurately reflects the actual sending result
- ✅ Onboarding link is always included in the response, even if email fails
- ✅ Better error messages for debugging

## Next Steps

1. **Fix EMAIL_FROM address** - Update to a verified email address
2. **Test email sending** - Run `node test-email-config.js` to verify
3. **Re-test signup** - Run `node test-organization-signup-stripe.js` to verify email is sent
4. **Use GET endpoint** - If email still fails, use the GET endpoint to retrieve onboarding links

## Notes

- The onboarding link expires in 1 hour, but you can generate a new one anytime using the resend endpoint
- The Stripe account is created successfully regardless of email status
- The organization signup will succeed even if email fails (email is non-blocking)
