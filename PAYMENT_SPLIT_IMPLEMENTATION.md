# Payment 90/10 Split Implementation

## Summary
Updated **both one-time payments and recurring subscription payments** to store **90% of the transaction amount** in all transaction tables (`save_tr_record`, `donor_transactions`, `subscription_transactions`), reflecting the platform's 10% commission fee.

## Changes Made

### 1. One-Time Payments

#### `/api/payments/confirm-and-record/route.js`
**Purpose**: Handles payment confirmation and transaction recording

**Changes**:
- Calculate `organizationAmount = fullAmount * 0.9` (90% of total)
- Store `organizationAmount` in `save_tr_record.trx_amount` instead of full amount
- Add `full_amount` and `organization_amount` to `trx_details` for transparency
- Create `donorTransaction` record with 90% amount
- Include metadata showing full amount, organization amount, and platform commission

**Example**:
- If transaction is $100:
  - `save_tr_record.trx_amount` = $90
  - `donor_transactions.amount` = $90
  - `trx_details` includes: `full_amount: 100`, `organization_amount: 90`
  - Organization balance increases by $90
  - Platform keeps $10 commission

#### `/api/payments/webhook/route.js` - `handlePaymentIntentSucceeded()`
**Purpose**: Handles Stripe webhook events for payment_intent.succeeded

**Changes**:
- Calculate `organizationAmount = fullAmount * 0.9`
- Update `save_tr_record.trx_amount` with 90% amount
- Add `full_amount` and `organization_amount` to webhook details
- Update organization balance with 90% amount
- Enhanced logging to show both full and organization amounts

### 2. Recurring Subscription Payments

#### `/api/payments/webhook/route.js` - `handleInvoicePaymentSucceeded()`
**Purpose**: Handles recurring subscription invoice payments

**Changes**:
- Calculate `organizationAmount = fullAmount * 0.9` (90% of subscription payment)
- Store 90% in `subscription_transactions.amount`
- Store 90% in `save_tr_record.trx_amount`
- Store 90% in `donor_transactions.amount`
- Update organization balance with 90% amount
- Add `full_amount`, `organization_amount`, and `platform_fee` to metadata
- Enhanced logging to show breakdown of amounts

**Example**:
- If monthly subscription is $50:
  - `subscription_transactions.amount` = $45
  - `save_tr_record.trx_amount` = $45
  - `donor_transactions.amount` = $45
  - Organization balance increases by $45
  - Platform keeps $5 commission per month

## Database Records

### save_tr_record Table (Both One-Time & Subscription)
```javascript
{
  trx_amount: 90.00,  // 90% of $100 (or $45 for $50 subscription)
  trx_details: {
    full_amount: 100.00,
    organization_amount: 90.00,
    platform_fee: 10.00,
    payment_intent_id: "pi_xxx",
    // ... other Stripe details
  }
}
```

### donor_transactions Table (Both One-Time & Subscription)
```javascript
{
  amount: 90.00,  // 90% of $100 (or $45 for $50 subscription)
  transaction_type: 'one_time', // or 'subscription_recurring'
  metadata: {
    full_amount: 100.00,
    organization_amount: 90.00,
    platform_fee: 10.00,
    save_tr_record_id: 123,
    // ... other details
  }
}
```

### subscription_transactions Table (Subscription Only)
```javascript
{
  amount: 45.00,  // 90% of $50 monthly subscription
  status: 'paid',
  stripe_invoice_id: 'in_xxx',
  // ... other invoice details
}
```

## Benefits
1. ✅ **Accurate Financial Records**: Transaction amounts reflect actual organization revenue (90%)
2. ✅ **Transparency**: Full amount and split details preserved in metadata
3. ✅ **Consistency**: All transaction tables show same 90% amount
4. ✅ **Balance Accuracy**: Organization balance matches recorded transaction amounts
5. ✅ **Audit Trail**: Full transaction details available in `trx_details` and `metadata`
6. ✅ **Unified Commission**: 10% platform fee applied consistently to all payment types

## Platform Revenue
- **One-time payments**: 10% of each donation
- **Recurring subscriptions**: 10% of each monthly/recurring payment
- **Example**: 
  - $100 one-time donation → $10 platform fee
  - $50/month subscription → $5/month platform fee ($60/year)

## Testing Checklist

### One-Time Payment
- [ ] Make a $100 one-time donation
- [ ] Verify `save_tr_record.trx_amount` = $90
- [ ] Verify `donor_transactions.amount` = $90
- [ ] Verify organization balance increased by $90
- [ ] Verify `trx_details` contains `full_amount: 100` and `organization_amount: 90`

### Recurring Subscription
- [ ] Create a $50/month subscription
- [ ] Wait for first invoice payment
- [ ] Verify `subscription_transactions.amount` = $45
- [ ] Verify `save_tr_record.trx_amount` = $45
- [ ] Verify `donor_transactions.amount` = $45
- [ ] Verify organization balance increased by $45
- [ ] Verify metadata contains `full_amount: 50`, `organization_amount: 45`, `platform_fee: 5`
- [ ] Check next month's payment applies same 90/10 split
