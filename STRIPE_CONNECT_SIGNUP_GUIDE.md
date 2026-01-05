# Stripe Connect Account Creation in Organization Signup

## ✅ What Was Added

I've added **Stripe Connect account creation** to the organization signup flow. Organizations can now optionally create a Stripe Connect Express account during registration.

---

## 🎯 Features

### 1. **Optional Stripe Connect Account Creation**
   - Checkbox option in signup form (Step 3)
   - Creates Stripe Express account automatically
   - Stores account ID in database
   - Generates onboarding link for later completion

### 2. **Automatic Setup**
   - Express account type (simplest, best for most use cases)
   - Pre-configured with payment capabilities
   - Business profile with organization details
   - Metadata for tracking

### 3. **Database Integration**
   - New `stripeAccountId` field in Organization table
   - Account ID stored automatically after creation
   - Can be retrieved later for payment processing

---

## 📍 How to Use

### During Signup:

1. **Fill out organization signup form** (Steps 1-2)
2. **In Step 3 (Organization Login):**
   - Set organization password
   - **Check the box:** "Create Stripe Connect Account"
   - Complete signup

3. **After Signup:**
   - Stripe Connect account is created automatically
   - Account ID is stored in database
   - Onboarding link is generated (can be accessed later)

---

## 🔧 Technical Details

### Files Created/Modified:

#### 1. **`src/app/lib/stripe-connect.js`** (NEW)
   - `createStripeConnectAccount()` - Creates Express account
   - `getStripeAccountOnboardingLink()` - Gets onboarding URL
   - `getStripeConnectAccount()` - Retrieves account details

#### 2. **`prisma/schema.prisma`** (MODIFIED)
   - Added `stripeAccountId String?` field to Organization model

#### 3. **`src/app/api/organization/route.js`** (MODIFIED)
   - Added `createStripeAccount` to validation schema
   - Integrated Stripe Connect account creation
   - Returns account info in response

#### 4. **`src/app/organization/signup/page.js`** (MODIFIED)
   - Added `createStripeAccount` to form state
   - Added checkbox UI in Step 3
   - Includes option in form submission

---

## 📊 API Response

After successful signup with Stripe Connect account:

```json
{
  "message": "Organization registered successfully",
  "organization": {
    "id": 123,
    "name": "Example Org",
    "email": "org@example.com",
    "stripeAccountId": "acct_ABC123xyz",
    ...
  },
  "stripeAccount": {
    "id": "acct_ABC123xyz",
    "type": "express",
    "onboardingUrl": "https://connect.stripe.com/setup/..."
  },
  ...
}
```

---

## 🎨 UI Component

### Checkbox Location:
- **Step 3:** Organization Login
- **Position:** After password fields, before logo upload
- **Style:** Blue background box with credit card icon

### Visual:
```
┌─────────────────────────────────────────┐
│ ☑ Create Stripe Connect Account        │
│ 💳                                      │
│ Create a Stripe Connect account to     │
│ receive payments directly. You'll     │
│ complete onboarding after registration.│
└─────────────────────────────────────────┘
```

---

## 🔒 Stripe Connect Account Details

### Account Type: **Express**
- Simplest setup
- Best for most organizations
- Quick onboarding process

### Capabilities Enabled:
- ✅ **Card Payments** - Accept credit/debit cards
- ✅ **Transfers** - Receive payments directly

### Business Profile:
- Organization name
- Email (support email)
- Phone (if provided)
- Website (if provided)
- MCC Code: 8398 (Charitable Organizations)

---

## 📝 Onboarding Process

### After Account Creation:

1. **Account is created** with basic info
2. **Onboarding link is generated** (stored in response)
3. **Organization completes onboarding later:**
   - Bank account details
   - Business verification
   - Tax information
   - Identity verification

### Accessing Onboarding:

```javascript
// Get onboarding link
const response = await fetch('/api/organization/stripe-onboarding', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

const { onboardingUrl } = await response.json();
// Redirect user to onboardingUrl
```

---

## 🚀 Use Cases

### 1. **Direct Payment Processing**
   - Organizations receive payments directly
   - No platform fees (Stripe Connect fees apply)
   - Full control over payment flow

### 2. **Marketplace/Platform Model**
   - Platform can split payments
   - Transfer funds to organization accounts
   - Track transactions per organization

### 3. **Multi-Organization Support**
   - Each organization has own Stripe account
   - Isolated payment processing
   - Independent financial management

---

## ⚙️ Configuration

### Required Environment Variables:

```env
STRIPE_SECRET_KEY=sk_test_...  # Stripe secret key
NEXT_PUBLIC_APP_URL=http://localhost:3000  # For onboarding links
```

### Optional:
- `STRIPE_CONNECT_CLIENT_ID` - For OAuth flow (if needed)

---

## 🔍 Database Schema

### Organization Table:

```sql
ALTER TABLE organizations 
ADD COLUMN stripe_account_id VARCHAR(255) NULL;
```

### Prisma Schema:

```prisma
model Organization {
  ...
  stripeAccountId   String?  @db.VarChar(255) @map("stripe_account_id")
  ...
}
```

---

## ✅ Testing Checklist

- [ ] Sign up new organization
- [ ] Check "Create Stripe Connect Account" checkbox
- [ ] Complete signup
- [ ] Verify account created in Stripe Dashboard
- [ ] Check `stripeAccountId` in database
- [ ] Verify onboarding link in response
- [ ] Test without checkbox (should not create account)
- [ ] Test with Stripe not configured (should skip gracefully)

---

## 🐛 Error Handling

### Graceful Degradation:
- ✅ If Stripe not configured → Skips account creation
- ✅ If account creation fails → Organization still created
- ✅ Errors logged but don't block signup
- ✅ Organization can create account later via UI

### Common Issues:

1. **"Stripe is not configured"**
   - Solution: Add `STRIPE_SECRET_KEY` to environment variables

2. **"Failed to create account"**
   - Check Stripe API key permissions
   - Verify country code is valid (2-letter ISO)
   - Check Stripe account limits

3. **"Onboarding link creation failed"**
   - Non-critical error
   - Account still created
   - Link can be generated later

---

## 📚 Related Documentation

- **Stripe Connect Docs:** https://stripe.com/docs/connect
- **Express Accounts:** https://stripe.com/docs/connect/express-accounts
- **Onboarding:** https://stripe.com/docs/connect/express-accounts#account-onboarding

---

## 🎉 Summary

Organizations can now:
- ✅ **Optionally create Stripe Connect accounts** during signup
- ✅ **Receive payments directly** to their Stripe account
- ✅ **Complete onboarding later** via generated link
- ✅ **Manage payments independently** from the platform

**The feature is ready to use!** 🚀


