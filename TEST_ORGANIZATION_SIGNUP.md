# Test: Organization Signup with Stripe Products

## Quick Test Guide

### Step 1: Check Environment Variables

Ensure these are set in your `.env` file:

```bash
# Required for Stripe product creation
STRIPE_SECRET_KEY=sk_test_... or sk_live_...

# Optional - for GHL integration
GHL_AGENCY_API_KEY=...
CHANGEWORKS_LOCAION_ID=...
CHANGEWORKS_LOCATION_API_KEY=...
```

### Step 2: Verify Database Schema

Run this command to ensure the schema is up to date:

```bash
npx prisma db push
```

Expected output:
```
✔ Your database is now in sync with your Prisma schema.
```

### Step 3: Start Development Server

```bash
npm run dev
```

### Step 4: Test Organization Signup

1. **Navigate to:**
   ```
   http://localhost:3000/organization/signup
   ```

2. **Fill in Step 1 (Basic Information):**
   - Organization Name: `Test Charity 2024`
   - Email: `test@charity2024.org`
   - Phone: `+1-555-0123`
   - Website: `https://testcharity.org` (optional)
   - Click "Next Step"

3. **Fill in Step 2 (Address Information):**
   - Street Address: `123 Charity Lane`
   - City: `New York`
   - State: `NY`
   - Country: `US` (default)
   - Postal Code: `10001`
   - Click "Next Step"

4. **Fill in Step 3 (Organization Login):**
   - Organization Password: `TestPass123!`
   - Confirm Password: `TestPass123!`
   - Upload Logo: (optional)
   - Click "Create Account"

5. **Wait for completion**
   - You should see a loading spinner
   - The page will redirect to login on success

### Step 5: Verify in Console

Check your terminal/console for these log messages:

```
✅ Organization created successfully
🔵 Creating 3 Stripe products for organization: [ID]
✅ Created Stripe Product 1 (One-Time): prod_...
✅ Created Stripe Product 2 (Monthly): prod_...
✅ Created Stripe Product 3 (Round-Up): prod_...
✅ Created Default Price for Product 1: price_...
✅ Created Default Price for Product 2: price_...
✅ Created Default Price for Product 3: price_...
✅ Stripe products created and stored successfully
  - Product 1 (One-Time): prod_...
  - Product 2 (Monthly): prod_...
  - Product 3 (Round-Up): prod_...
```

### Step 6: Verify in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/test/products
2. Search for: `Test Charity 2024`
3. You should see 3 products:
   - ✅ `Test Charity 2024 - One-Time Donation`
   - ✅ `Test Charity 2024 - Monthly Donation`
   - ✅ `Test Charity 2024 - Round-Up Program`

### Step 7: Verify in Database

**Option A: Using Prisma Studio**
```bash
npx prisma studio
```
- Navigate to `Organization` table
- Find the record with email `test@charity2024.org`
- Check that these fields are populated:
  - `stripeProductId1`
  - `stripeProductId2`
  - `stripeProductId3`

**Option B: Using SQL Query**
```sql
SELECT 
  id,
  name,
  email,
  stripeProductId1 as 'Product 1 (One-Time)',
  stripeProductId2 as 'Product 2 (Monthly)',
  stripeProductId3 as 'Product 3 (Round-Up)',
  created_at
FROM organizations
WHERE email = 'test@charity2024.org';
```

Expected result:
```
| id  | name               | email                  | Product 1    | Product 2    | Product 3    |
|-----|--------------------|------------------------|--------------|--------------|--------------|
| 123 | Test Charity 2024  | test@charity2024.org   | prod_ABC123  | prod_DEF456  | prod_GHI789  |
```

---

## Expected Results

### ✅ Success Criteria

1. **Organization Created**
   - Record exists in `organizations` table
   - Email is unique
   - Password is hashed

2. **GHL Account Created** (if configured)
   - Record exists in `ghl_accounts` table
   - `ghlId` is populated in organization record

3. **Stripe Products Created**
   - 3 products visible in Stripe Dashboard
   - All products have correct naming format
   - Products include organization metadata

4. **Product IDs Stored**
   - `stripeProductId1` is populated
   - `stripeProductId2` is populated
   - `stripeProductId3` is populated

5. **Redirect to Login**
   - User is redirected to `/organization/login`
   - Success message is displayed

---

## Troubleshooting

### ❌ Issue: "Stripe service not available"

**Symptoms:**
- Console shows: `⚠️ Stripe not configured`
- Products are not created
- Organization is still created successfully

**Solution:**
1. Check `.env` file has `STRIPE_SECRET_KEY`
2. Restart development server
3. Try signup again

### ❌ Issue: Products created but IDs not saved

**Symptoms:**
- Products visible in Stripe Dashboard
- Database fields are `NULL`

**Solution:**
1. Check database connection
2. Verify schema is up to date: `npx prisma db push`
3. Check console for database errors

### ❌ Issue: Signup fails completely

**Symptoms:**
- Error message displayed
- No organization created
- No products created

**Solution:**
1. Check browser console for errors
2. Check server logs for error details
3. Verify all required fields are filled
4. Check database connection

---

## API Testing with Postman/cURL

### Test Endpoint Directly

```bash
curl -X POST http://localhost:3000/api/organization \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Charity",
    "email": "apitest@charity.org",
    "phone": "+1-555-9999",
    "address": "456 API Street",
    "city": "Boston",
    "state": "MA",
    "country": "US",
    "postalCode": "02101",
    "orgPassword": "TestPass123!",
    "confirmOrgPassword": "TestPass123!"
  }'
```

### Expected Response

```json
{
  "message": "Organization registered successfully",
  "organization": {
    "id": 124,
    "name": "API Test Charity",
    "email": "apitest@charity.org",
    "ghlId": "location_id_here",
    "stripeProductId1": "prod_ABC123",
    "stripeProductId2": "prod_DEF456",
    "stripeProductId3": "prod_GHI789"
  },
  "ghlAccount": { ... },
  "stripeProducts": {
    "product1": {
      "id": "prod_ABC123",
      "name": "API Test Charity - One-Time Donation",
      "priceId": "price_123"
    },
    "product2": {
      "id": "prod_DEF456",
      "name": "API Test Charity - Monthly Donation",
      "priceId": "price_456"
    },
    "product3": {
      "id": "prod_GHI789",
      "name": "API Test Charity - Round-Up Program",
      "priceId": "price_789"
    }
  }
}
```

---

## Performance Notes

### Timing
- Organization creation: ~100ms
- GHL account creation: ~2-3 seconds (if configured)
- **Stripe product creation: ~3-5 seconds** ⏱️
- Total signup time: ~5-8 seconds

### Optimization Tips
- Products are created sequentially for reliability
- Consider parallel creation for faster performance
- Add loading indicators for better UX

---

## Clean Up Test Data

### Remove Test Organization

```sql
-- Get the organization ID first
SELECT id FROM organizations WHERE email = 'test@charity2024.org';

-- Delete related records (if any)
DELETE FROM ghl_accounts WHERE organization_id = [ID];

-- Delete the organization
DELETE FROM organizations WHERE id = [ID];
```

### Remove Stripe Products

1. Go to Stripe Dashboard
2. Find the test products
3. Archive each product
4. Or use Stripe CLI:
   ```bash
   stripe products delete prod_ABC123
   stripe products delete prod_DEF456
   stripe products delete prod_GHI789
   ```

---

## Status: Ready for Testing ✅

The organization signup flow with Stripe product creation is complete and ready for testing.



