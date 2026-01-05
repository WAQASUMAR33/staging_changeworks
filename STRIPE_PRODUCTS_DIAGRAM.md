# Organization Signup - Stripe Products Flow Diagram

## Visual Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ORGANIZATION SIGNUP FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  User Fills     │
│  Signup Form    │
│                 │
│  • Name         │
│  • Email        │
│  • Phone        │
│  • Address      │
│  • Password     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  POST Request   │
│  to /api/       │
│  organization   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND PROCESSING                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 1: Validate Input                                             │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ ✓ Check email format                                      │      │
│  │ ✓ Validate password match                                 │      │
│  │ ✓ Check required fields                                   │      │
│  └──────────────────────────────────────────────────────────┘      │
│                           ↓                                          │
│  STEP 2: Create Organization in Database                            │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ INSERT INTO organizations                                 │      │
│  │ • name, email, phone, address                             │      │
│  │ • hashed password                                          │      │
│  │ • status = true                                            │      │
│  └──────────────────────────────────────────────────────────┘      │
│                           ↓                                          │
│  STEP 3: Create GHL Account (Optional)                              │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ IF GHL_AGENCY_API_KEY configured:                         │      │
│  │   • Create GHL sub-account                                │      │
│  │   • Save GHL location ID                                  │      │
│  │   • Store GHL API key                                     │      │
│  │ ELSE:                                                      │      │
│  │   • Skip (graceful degradation)                           │      │
│  └──────────────────────────────────────────────────────────┘      │
│                           ↓                                          │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │          STEP 4: Create 3 Stripe Products ✨ NEW           │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │                                                             │    │
│  │  IF STRIPE_SECRET_KEY configured:                          │    │
│  │                                                             │    │
│  │  ┌─────────────────────────────────────────────────────┐  │    │
│  │  │  Product 1: One-Time Donation                        │  │    │
│  │  │  ┌────────────────────────────────────────────────┐ │  │    │
│  │  │  │ Name: "{Org Name} - One-Time Donation"         │ │  │    │
│  │  │  │ Type: Service                                   │ │  │    │
│  │  │  │ Metadata: org_id, org_name, product_type       │ │  │    │
│  │  │  │ → Returns: prod_ABC123                         │ │  │    │
│  │  │  └────────────────────────────────────────────────┘ │  │    │
│  │  │  ┌────────────────────────────────────────────────┐ │  │    │
│  │  │  │ Default Price: $10.00                          │ │  │    │
│  │  │  │ → Returns: price_123                           │ │  │    │
│  │  │  └────────────────────────────────────────────────┘ │  │    │
│  │  └─────────────────────────────────────────────────────┘  │    │
│  │                        ↓                                    │    │
│  │  ┌─────────────────────────────────────────────────────┐  │    │
│  │  │  Product 2: Monthly Recurring Donation              │  │    │
│  │  │  ┌────────────────────────────────────────────────┐ │  │    │
│  │  │  │ Name: "{Org Name} - Monthly Donation"          │ │  │    │
│  │  │  │ Type: Service                                   │ │  │    │
│  │  │  │ Metadata: org_id, org_name, product_type       │ │  │    │
│  │  │  │ → Returns: prod_DEF456                         │ │  │    │
│  │  │  └────────────────────────────────────────────────┘ │  │    │
│  │  │  ┌────────────────────────────────────────────────┐ │  │    │
│  │  │  │ Default Price: $25.00/month                    │ │  │    │
│  │  │  │ Recurring: monthly                             │ │  │    │
│  │  │  │ → Returns: price_456                           │ │  │    │
│  │  │  └────────────────────────────────────────────────┘ │  │    │
│  │  └─────────────────────────────────────────────────────┘  │    │
│  │                        ↓                                    │    │
│  │  ┌─────────────────────────────────────────────────────┐  │    │
│  │  │  Product 3: Round-Up Program                        │  │    │
│  │  │  ┌────────────────────────────────────────────────┐ │  │    │
│  │  │  │ Name: "{Org Name} - Round-Up Program"          │ │  │    │
│  │  │  │ Type: Service                                   │ │  │    │
│  │  │  │ Metadata: org_id, org_name, product_type       │ │  │    │
│  │  │  │ → Returns: prod_GHI789                         │ │  │    │
│  │  │  └────────────────────────────────────────────────┘ │  │    │
│  │  │  ┌────────────────────────────────────────────────┐ │  │    │
│  │  │  │ Default Price: $1.00                           │ │  │    │
│  │  │  │ → Returns: price_789                           │ │  │    │
│  │  │  └────────────────────────────────────────────────┘ │  │    │
│  │  └─────────────────────────────────────────────────────┘  │    │
│  │                                                             │    │
│  │  ELSE:                                                      │    │
│  │    • Skip (graceful degradation)                           │    │
│  │    • Log warning message                                   │    │
│  │                                                             │    │
│  └────────────────────────────────────────────────────────────┘    │
│                           ↓                                          │
│  STEP 5: Update Organization with Product IDs                       │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ UPDATE organizations SET                                  │      │
│  │   stripeProductId1 = 'prod_ABC123'                        │      │
│  │   stripeProductId2 = 'prod_DEF456'                        │      │
│  │   stripeProductId3 = 'prod_GHI789'                        │      │
│  │ WHERE id = organization.id                                │      │
│  └──────────────────────────────────────────────────────────┘      │
│                           ↓                                          │
│  STEP 6: Return Success Response                                    │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ {                                                          │      │
│  │   "message": "Organization registered successfully",      │      │
│  │   "organization": {                                        │      │
│  │     "id": 123,                                             │      │
│  │     "name": "Example Charity",                             │      │
│  │     "email": "charity@example.com",                        │      │
│  │     "stripeProductId1": "prod_ABC123",                     │      │
│  │     "stripeProductId2": "prod_DEF456",                     │      │
│  │     "stripeProductId3": "prod_GHI789"                      │      │
│  │   },                                                       │      │
│  │   "stripeProducts": { ... }                               │      │
│  │ }                                                          │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Frontend       │
│  Receives       │
│  Response       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Redirect to    │
│  Login Page     │
│  with Success   │
│  Message        │
└─────────────────┘
```

---

## Database State After Signup

```
┌────────────────────────────────────────────────────────────────────┐
│                    ORGANIZATIONS TABLE                              │
├─────┬──────────────────┬────────────────────┬──────────────────────┤
│ id  │ name             │ email              │ stripeProductId1     │
├─────┼──────────────────┼────────────────────┼──────────────────────┤
│ 123 │ Example Charity  │ charity@ex.com     │ prod_ABC123          │
└─────┴──────────────────┴────────────────────┴──────────────────────┘
       │                                        │
       │ stripeProductId2: prod_DEF456          │
       │ stripeProductId3: prod_GHI789          │
       └────────────────────────────────────────┘
```

---

## Stripe Dashboard State After Signup

```
┌────────────────────────────────────────────────────────────────────┐
│                      STRIPE PRODUCTS                                │
├────────────────┬────────────────────────────────────────────────────┤
│ Product ID     │ Name                                               │
├────────────────┼────────────────────────────────────────────────────┤
│ prod_ABC123    │ Example Charity - One-Time Donation                │
│                │ • Type: Service                                    │
│                │ • Active: Yes                                      │
│                │ • Default Price: $10.00                            │
│                │ • Metadata: org_id=123, product_type=one_time      │
├────────────────┼────────────────────────────────────────────────────┤
│ prod_DEF456    │ Example Charity - Monthly Donation                 │
│                │ • Type: Service                                    │
│                │ • Active: Yes                                      │
│                │ • Default Price: $25.00/month                      │
│                │ • Metadata: org_id=123, product_type=monthly       │
├────────────────┼────────────────────────────────────────────────────┤
│ prod_GHI789    │ Example Charity - Round-Up Program                 │
│                │ • Type: Service                                    │
│                │ • Active: Yes                                      │
│                │ • Default Price: $1.00                             │
│                │ • Metadata: org_id=123, product_type=round_up      │
└────────────────┴────────────────────────────────────────────────────┘
```

---

## Product Usage Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HOW PRODUCTS ARE USED                             │
└─────────────────────────────────────────────────────────────────────┘

Product 1: One-Time Donation (prod_ABC123)
┌──────────────────────────────────────────┐
│  Donor clicks "Donate Now"               │
│           ↓                               │
│  Select amount: $50                       │
│           ↓                               │
│  Create Payment Intent with:              │
│    • product_id: prod_ABC123              │
│    • amount: $50.00                       │
│           ↓                               │
│  Process payment                          │
│           ↓                               │
│  Donation complete ✅                     │
└──────────────────────────────────────────┘

Product 2: Monthly Recurring (prod_DEF456)
┌──────────────────────────────────────────┐
│  Donor clicks "Monthly Donation"         │
│           ↓                               │
│  Select amount: $25/month                 │
│           ↓                               │
│  Create Subscription with:                │
│    • product_id: prod_DEF456              │
│    • price_id: price_456                  │
│           ↓                               │
│  Set up payment method                    │
│           ↓                               │
│  Subscription active ✅                   │
│  (Charged monthly automatically)          │
└──────────────────────────────────────────┘

Product 3: Round-Up Program (prod_GHI789)
┌──────────────────────────────────────────┐
│  Donor connects bank via Plaid           │
│           ↓                               │
│  Transaction: $4.30                       │
│  Round-up to: $5.00                       │
│  Donation: $0.70                          │
│           ↓                               │
│  Create Payment Intent with:              │
│    • product_id: prod_GHI789              │
│    • amount: $0.70                        │
│           ↓                               │
│  Process round-up donation                │
│           ↓                               │
│  Donation complete ✅                     │
└──────────────────────────────────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING                                    │
└─────────────────────────────────────────────────────────────────────┘

Scenario 1: Stripe Not Configured
┌──────────────────────────────────────────┐
│  Check: isStripeConfigured()             │
│           ↓                               │
│  Result: false                            │
│           ↓                               │
│  Log: ⚠️ Stripe not configured           │
│           ↓                               │
│  Skip product creation                    │
│           ↓                               │
│  Organization created successfully ✅     │
│  (Products can be created later)          │
└──────────────────────────────────────────┘

Scenario 2: Product Creation Fails
┌──────────────────────────────────────────┐
│  Try: createOrganizationStripeProducts() │
│           ↓                               │
│  Error: Stripe API error                  │
│           ↓                               │
│  Catch error                              │
│           ↓                               │
│  Log: ❌ Stripe product creation error   │
│           ↓                               │
│  Continue with signup                     │
│           ↓                               │
│  Organization created successfully ✅     │
│  (Products can be created manually)       │
└──────────────────────────────────────────┘

Scenario 3: Database Update Fails
┌──────────────────────────────────────────┐
│  Products created in Stripe ✅            │
│           ↓                               │
│  Try: Update organization with IDs        │
│           ↓                               │
│  Error: Database connection error         │
│           ↓                               │
│  Products exist in Stripe                 │
│  But IDs not saved in DB                  │
│           ↓                               │
│  Manual linking required                  │
└──────────────────────────────────────────┘
```

---

## Timeline

```
Organization Signup Timeline (with Stripe)
═══════════════════════════════════════════

0s    ┌─────────────────┐
      │ User submits    │
      │ signup form     │
      └────────┬────────┘
               │
0.1s  ┌────────▼────────┐
      │ Validate input  │
      └────────┬────────┘
               │
0.2s  ┌────────▼────────────┐
      │ Create organization │
      │ in database         │
      └────────┬────────────┘
               │
2.5s  ┌────────▼────────────┐
      │ Create GHL account  │
      │ (if configured)     │
      └────────┬────────────┘
               │
3.0s  ┌────────▼─────────────────┐
      │ Create Stripe Product 1  │ ⏱️ ~1s
      └────────┬─────────────────┘
               │
4.0s  ┌────────▼─────────────────┐
      │ Create Stripe Product 2  │ ⏱️ ~1s
      └────────┬─────────────────┘
               │
5.0s  ┌────────▼─────────────────┐
      │ Create Stripe Product 3  │ ⏱️ ~1s
      └────────┬─────────────────┘
               │
5.5s  ┌────────▼─────────────────┐
      │ Create default prices    │ ⏱️ ~0.5s
      └────────┬─────────────────┘
               │
5.7s  ┌────────▼─────────────────┐
      │ Update org with IDs      │
      └────────┬─────────────────┘
               │
5.8s  ┌────────▼─────────────────┐
      │ Return success response  │
      └────────┬─────────────────┘
               │
6.0s  ┌────────▼─────────────────┐
      │ Redirect to login ✅     │
      └──────────────────────────┘

Total Time: ~6 seconds
```

---

## Key Points

✅ **3 Products Created Automatically**
✅ **Each Product Has Unique ID**
✅ **IDs Stored in Database**
✅ **Default Prices Configured**
✅ **Graceful Error Handling**
✅ **Ready for Immediate Use**

---

**Visual representation of the complete organization signup flow with Stripe product creation**



