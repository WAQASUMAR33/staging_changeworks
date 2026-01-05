# Organization Signup - Stripe Product Creation Flow

## Overview

When an organization signs up, the system now automatically creates **3 custom Stripe products** for that organization. These products are stored in the database and can be used for various donation types.

---

## Flow Diagram

```
1. Organization fills signup form
   ↓
2. Organization created in database
   ↓
3. GHL (GoHighLevel) account created
   ↓
4. 3 Stripe products created ✨ NEW
   ↓
5. Product IDs stored in organization record
   ↓
6. Organization redirected to login
```

---

## The 3 Stripe Products

### Product 1: One-Time Donation
- **Name**: `{Organization Name} - One-Time Donation`
- **Type**: Service
- **Purpose**: For one-time donations from donors
- **Default Price**: $10.00 (reference price, can be customized)
- **Stored in**: `organization.stripeProductId1`

### Product 2: Monthly Recurring Donation
- **Name**: `{Organization Name} - Monthly Donation`
- **Type**: Service
- **Purpose**: For monthly recurring donations
- **Default Price**: $25.00/month
- **Stored in**: `organization.stripeProductId2`

### Product 3: Round-Up Program
- **Name**: `{Organization Name} - Round-Up Program`
- **Type**: Service
- **Purpose**: For Plaid-integrated round-up donations
- **Default Price**: $1.00 (minimum round-up)
- **Stored in**: `organization.stripeProductId3`

---

## Database Schema Changes

### Organization Table - New Fields

```prisma
model Organization {
  // ... existing fields
  stripeProductId1  String?  @db.VarChar(255) @map("stripe_product_id_1")
  stripeProductId2  String?  @db.VarChar(255) @map("stripe_product_id_2")
  stripeProductId3  String?  @db.VarChar(255) @map("stripe_product_id_3")
  // ... other fields
}
```

---

## Implementation Details

### 1. Helper Functions (`src/app/lib/stripe-products.js`)

#### `createOrganizationStripeProducts(organization)`
Creates 3 Stripe products for the organization.

**Parameters:**
- `organization.id` - Organization ID
- `organization.name` - Organization name
- `organization.email` - Organization email

**Returns:**
```javascript
{
  product1: { id, name, description, metadata, ... },
  product2: { id, name, description, metadata, ... },
  product3: { id, name, description, metadata, ... }
}
```

#### `createDefaultPricesForProducts(products, organization)`
Creates default prices for each product.

**Parameters:**
- `products` - The 3 products created
- `organization` - Organization details

**Returns:**
```javascript
{
  price1: { id, unit_amount, currency, ... },
  price2: { id, unit_amount, currency, recurring, ... },
  price3: { id, unit_amount, currency, ... }
}
```

---

### 2. API Endpoint (`src/app/api/organization/route.js`)

The `POST /api/organization` endpoint now:

1. ✅ Creates organization in database
2. ✅ Creates GHL account (if configured)
3. ✅ **Creates 3 Stripe products** (NEW)
4. ✅ **Stores product IDs in database** (NEW)
5. ✅ Returns complete organization data with Stripe product IDs

**Response Example:**
```json
{
  "message": "Organization registered successfully",
  "organization": {
    "id": 123,
    "name": "Example Charity",
    "email": "charity@example.com",
    "ghlId": "ghl_location_id",
    "stripeProductId1": "prod_ABC123",
    "stripeProductId2": "prod_DEF456",
    "stripeProductId3": "prod_GHI789"
  },
  "ghlAccount": { ... },
  "stripeProducts": {
    "product1": {
      "id": "prod_ABC123",
      "name": "Example Charity - One-Time Donation",
      "priceId": "price_123"
    },
    "product2": {
      "id": "prod_DEF456",
      "name": "Example Charity - Monthly Donation",
      "priceId": "price_456"
    },
    "product3": {
      "id": "prod_GHI789",
      "name": "Example Charity - Round-Up Program",
      "priceId": "price_789"
    }
  }
}
```

---

## Error Handling

### Graceful Degradation
- ✅ If Stripe is not configured, signup continues without Stripe products
- ✅ If Stripe product creation fails, signup still succeeds
- ✅ Error is logged but doesn't block organization creation
- ✅ Products can be created manually later if needed

### Console Logs
```
🔵 Creating 3 Stripe products for organization: 123
✅ Created Stripe Product 1 (One-Time): prod_ABC123
✅ Created Stripe Product 2 (Monthly): prod_DEF456
✅ Created Stripe Product 3 (Round-Up): prod_GHI789
✅ Created Default Price for Product 1: price_123
✅ Created Default Price for Product 2: price_456
✅ Created Default Price for Product 3: price_789
✅ Stripe products created and stored successfully
```

---

## Testing the Flow

### Prerequisites
1. ✅ Stripe account configured
2. ✅ `STRIPE_SECRET_KEY` environment variable set
3. ✅ Database schema updated (`npx prisma db push`)

### Test Steps

1. **Navigate to Organization Signup**
   ```
   http://localhost:3000/organization/signup
   ```

2. **Fill in the form:**
   - Organization Name: "Test Charity"
   - Email: "test@charity.org"
   - Phone: "+1234567890"
   - Address: "123 Main St"
   - City: "New York"
   - State: "NY"
   - Postal Code: "10001"
   - Password: "password123"

3. **Submit the form**

4. **Check the console logs** for:
   ```
   🔵 Creating 3 Stripe products for organization: [ID]
   ✅ Created Stripe Product 1 (One-Time): prod_...
   ✅ Created Stripe Product 2 (Monthly): prod_...
   ✅ Created Stripe Product 3 (Round-Up): prod_...
   ```

5. **Verify in Stripe Dashboard:**
   - Go to https://dashboard.stripe.com/products
   - Search for "Test Charity"
   - Should see 3 products created

6. **Verify in Database:**
   ```sql
   SELECT id, name, stripeProductId1, stripeProductId2, stripeProductId3
   FROM organizations
   WHERE email = 'test@charity.org';
   ```

---

## Using the Products

### For One-Time Donations
```javascript
const organization = await prisma.organization.findUnique({
  where: { id: organizationId }
});

const productId = organization.stripeProductId1;
// Use this product ID to create payment intents
```

### For Monthly Subscriptions
```javascript
const organization = await prisma.organization.findUnique({
  where: { id: organizationId }
});

const productId = organization.stripeProductId2;
// Use this product ID to create subscriptions
```

### For Round-Up Program
```javascript
const organization = await prisma.organization.findUnique({
  where: { id: organizationId }
});

const productId = organization.stripeProductId3;
// Use this product ID for Plaid round-up donations
```

---

## Customization

### Changing Default Prices
Edit `src/app/lib/stripe-products.js`:

```javascript
// Product 1: One-Time Donation
unit_amount: 1000, // $10.00 → Change to desired amount

// Product 2: Monthly Recurring
unit_amount: 2500, // $25.00 → Change to desired amount

// Product 3: Round-Up
unit_amount: 100, // $1.00 → Change to desired amount
```

### Adding More Products
1. Add new field to schema: `stripeProductId4`
2. Update `createOrganizationStripeProducts()` to create 4th product
3. Update organization creation to store 4th product ID

---

## Troubleshooting

### Issue: "Stripe service not available"
**Solution**: Set `STRIPE_SECRET_KEY` in `.env` file
```bash
STRIPE_SECRET_KEY=sk_test_...
```

### Issue: Products not created but signup succeeds
**Cause**: Stripe error occurred but was caught gracefully
**Solution**: Check console logs for error details. Products can be created manually later.

### Issue: Product IDs not saved to database
**Cause**: Database update failed after product creation
**Solution**: Check database connection and schema. Products exist in Stripe but need to be linked manually.

---

## Benefits

✅ **Automated Setup** - No manual Stripe product creation needed
✅ **Consistent Naming** - All products follow same naming convention
✅ **Organization-Specific** - Each organization has their own products
✅ **Metadata Tracking** - Products include organization metadata
✅ **Ready to Use** - Products are immediately available for donations
✅ **Graceful Failure** - Signup succeeds even if Stripe fails

---

## Next Steps

1. ✅ Test with real Stripe account
2. ✅ Verify products appear in Stripe Dashboard
3. ✅ Test donation flows using these products
4. ✅ Add product management UI for organizations
5. ✅ Allow organizations to customize product names/prices

---

## Status: ✅ COMPLETE

All 3 Stripe products are now automatically created during organization signup and stored in the database.



