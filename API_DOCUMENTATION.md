# ChangeWorks API Documentation

## Authentication APIs

| URL | Method | Description | Input / Body Parameters |
| :--- | :--- | :--- | :--- |
| `/api/login` | `POST` | General login (User/Donor) | **JSON Body:**<br>- `email` (string, email format)<br>- `password` (string, min 6 chars)<br>- `twoFactorCode` (string, optional) |
| `/api/donor/login` | `POST` | Donor-specific login | **JSON Body:**<br>- `email` (string, email format)<br>- `password` (string, min 6 chars)<br>- `twoFactorCode` (string, optional) |
| `/api/organization/login` | `POST` | Organization login | **JSON Body:**<br>- `email` (string, email format)<br>- `password` (string, min 6 chars)<br>- `twoFactorCode` (string, optional) |
| `/api/auth/forgot-password` | `POST` | Request password reset | **JSON Body:**<br>- `email` (string, email format) |
| `/api/auth/reset-password` | `POST` | Reset password with token | **JSON Body:**<br>- `token` (string)<br>- `newPassword` (string, min 6 chars)<br>- `confirmPassword` (string, match newPassword) |

## Donor APIs

| URL | Method | Description | Input / Body Parameters |
| :--- | :--- | :--- | :--- |
| `/api/donor/signup` | `POST` | Register new donor | **JSON Body:**<br>- `name` (string, required)<br>- `email` (string, required)<br>- `password` (string, min 6 chars)<br>- `phone` (string, required)<br>- `postal_code` (string, required)<br>- `country` (string, default 'US')<br>- `organization_id` (optional) |
| `/api/donor/update-profile` | `PUT` | Update donor profile | **Headers:** `Authorization: Bearer <token>`<br>**JSON Body:**<br>- `phone` (string, optional)<br>- `postal_code` (string, optional)<br>- `country` (string, optional)<br>- `imageUrl` (string, URL format, optional) |
| `/api/donor/change-password` | `POST` | Change logged-in donor password | **Headers:** `Authorization: Bearer <token>`<br>**JSON Body:**<br>- `currentPassword` (string)<br>- `newPassword` (string, min 6 chars)<br>- `confirmPassword` (string) |
| `/api/donor/forgot-password` | `POST` | Request donor password reset | **JSON Body:**<br>- `email` (string, email format) |
| `/api/donor/reset-password` | `POST` | Reset donor password | **JSON Body:**<br>- `token` (string)<br>- `newPassword` (string, min 6 chars)<br>- `confirmPassword` (string) |

## Organization APIs

| URL | Method | Description | Input / Body Parameters |
| :--- | :--- | :--- | :--- |
| `/api/organization` | `POST` | Register new organization | **JSON Body:**<br>- `name` (string, required)<br>- `firstName` (string, optional)<br>- `lastName` (string, optional)<br>- `title` (string, optional)<br>- `email` (string, email format)<br>- `phone` (string, optional)<br>- `company` (string, optional)<br>- `address` (string, optional)<br>- `website` (string, URL)<br>- `city`, `state`, `country`, `postalCode`<br>- `ein` (string, min 10 chars)<br>- `logoUrl` (string, required)<br>- `orgPassword` (string, min 6 chars)<br>- `confirmOrgPassword` (string) |
| `/api/organization/update-profile` | `PUT` | Update org profile | **Headers:** `Authorization: Bearer <token>`<br>**JSON Body:**<br>- `name` (string, optional)<br>- `phone` (string, optional)<br>- `address`, `city`, `state`, `country`, `postalCode`<br>- `website` (string, URL)<br>- `company` (string, optional) |
| `/api/organization/change-password` | `POST` | Change org password | **Headers:** `Authorization: Bearer <token>`<br>**JSON Body:**<br>- `currentPassword` (string)<br>- `newPassword` (string, min 6 chars)<br>- `confirmPassword` (string) |
| `/api/organization/forgot-password` | `POST` | Request org password reset | **JSON Body:**<br>- `email` (string, email format) |
| `/api/organization/reset-password` | `POST` | Reset org password | **JSON Body:**<br>- `token` (string)<br>- `email` (string)<br>- `newPassword` (string, min 6 chars) |

## Payment & Transaction APIs

| URL | Method | Description | Input / Body Parameters |
| :--- | :--- | :--- | :--- |
| `/api/payments/create-intent` | `POST` | Create Stripe Payment Intent | **JSON Body:**<br>- `amount` (number, in cents)<br>- `currency` (string, e.g., "USD")<br>- `donor_id` (number)<br>- `organization_id` (number)<br>- `description` (string, optional)<br>- `metadata` (object, optional) |
| `/api/transactions` | `GET` | List transactions | **Query Params:**<br>- `trx_ghl_id`<br>- `donor_id`<br>- `organization_id` |
| `/api/transactions` | `POST` | Record transaction | **JSON Body:**<br>- `trx_id` (string, required)<br>- `trx_date` (datetime string)<br>- `trx_amount` (number, positive)<br>- `trx_method` ("stripe" \| "plaid")<br>- `trx_donor_id` (number)<br>- `trx_organization_id` (number)<br>- `pay_status` ("pending" \| "completed" \| "failed") |

## GoHighLevel (GHL) APIs

| URL | Method | Description | Input / Body Parameters |
| :--- | :--- | :--- | :--- |
| `/api/ghl/contact` | `POST` | Create contact in GHL sub-account | **JSON Body:**<br>- `locationId` (string, required)<br>- `firstName` (string, required)<br>- `lastName` (string, required)<br>- `email` (string, email format)<br>- `phone` (string, optional)<br>- `address`, `city`, `state`, `country`, `postalCode`<br>- `source` (string, default "ChangeWorks")<br>- `tags` (array of strings)<br>- `customFields` (object)<br>- `donor_id` (number, optional)<br>- `organization_id` (number, optional) |
| `/api/ghl/contact/bulk` | `POST` | Create contact in multiple GHL sub-accounts | **JSON Body:**<br>- `donor_id` (number, required)<br>- `locationIds` (array of strings, min 1)<br>- `customFields` (object, optional)<br>- `tags` (array of strings, optional) |
| `/api/ghl/contact/auto-create` | `POST` | Automatically create GHL contacts for a donor | **JSON Body:**<br>- `donor_id` (number, required)<br>- `organization_id` (number, optional)<br>- `use_organization_ghl` (boolean, default true)<br>- `additional_location_ids` (array of strings, optional)<br>- `customFields` (object, optional)<br>- `tags` (array of strings, optional) |

## Subscription APIs

| URL | Method | Description | Input / Body Parameters |
| :--- | :--- | :--- | :--- |
| `/api/subscriptions` | `GET` | List subscriptions | **Query Params:**<br>- `donor_id`<br>- `organization_id`<br>- `status`<br>- `page` (number)<br>- `limit` (number) |
| `/api/subscriptions/create-complete` | `POST` | Create customer, subscription, and payment | **JSON Body:**<br>- `donor_id` (number, required)<br>- `organization_id` (number, required)<br>- `package_id` (number, required)<br>- `payment_method_id` (string, required)<br>- `customer_email` (string, optional)<br>- `customer_name` (string, optional)<br>- `trial_period_days` (number, default 0) |

## User & Admin APIs

| URL | Method | Description | Input / Body Parameters |
| :--- | :--- | :--- | :--- |
| `/api/users` | `POST` | Create internal user | **JSON Body:**<br>- `name` (string)<br>- `email` (string, email format)<br>- `password` (string, min 6 chars)<br>- `role` ("SUPERADMIN" \| "MANAGER" \| "ADMIN") |
| `/api/admin/donors` | `GET` | List all donors (Admin only) | **Headers:** `Authorization: Bearer <token>`<br>**No Body** |

## Other Detected API Endpoints

The following endpoints exist in the codebase but are not fully documented above. They likely follow similar patterns (GET for retrieval, POST for creation).

- `/api/verify-donor`
- `/api/transactions/by-donor/[donor_id]`
- `/api/test-one-time-email`
- `/api/subscriptions/webhooks`
- `/api/subscriptions/setup-payment`
- `/api/subscriptions/create-from-stripe`
- `/api/subscriptions/checkout-session`
- `/api/plaid/*` (exchange-token, mock-exchange-token, simple-exchange-token, webhook, save-connection, etc.)
- `/api/payments/webhook`
- `/api/payments/confirm`
- `/api/payments/confirm-and-record`
- `/api/organization/dashboard-stats`
- `/api/organization/create-stripe-products`
- `/api/email/*` (send-welcome, send-verification, send-monthly-impact, etc.)
- `/api/donor_transactions`
- `/api/donor/verify`
- `/api/donor/verify-reset-token`
- `/api/donor/subscriptions`
- `/api/donor/profile`
- `/api/donor/dashboard-stats`
- `/api/create-superadmin`
- `/api/admin/dashboard-stats`
- `/api/subscriptions/cancel-by-donor`
- `/api/organization/stripe-onboarding-link`
- `/api/organization/[id]/stripe-transactions`
- `/api/organization/resend-onboarding-email`
- `/api/organization/delete-all`
- `/api/test-stripe-account`
- `/api/organizations/list`
- `/api/two-factor/*` (verify, verify-setup, status, enable, disable)
- `/api/transactions/ghl/[ghl_id]`
- `/api/transactions/donor/[donor_id]`
- `/api/transactions/by-organization/[organization_id]`
- `/api/transactions/by-id/[transaction_id]`
- `/api/test-webhook`
- `/api/test-ghl`
- `/api/subscriptions/sync-stripe`
- `/api/subscriptions/stripe-transactions`
- `/api/subscriptions/resume-by-donor`
- `/api/subscriptions/refunds`
- `/api/subscriptions/payments`
- `/api/subscriptions/payment-methods`
- `/api/subscriptions/membership-status`
- `/api/subscriptions/invoices`
- `/api/subscriptions/donor-status`
- `/api/subscriptions/create-connect-session`
- `/api/subscriptions/check-customer`
- `/api/subscriptions/billing`
- `/api/subscriptions/analytics`
- `/api/subscriptions/[id]/*`
- `/api/stripe/products`
- `/api/stripe/prices`
- `/api/stripe/organization-products`
- `/api/payments/history/[donor_id]`
- `/api/payments/check-intent`
- `/api/packages`
- `/api/organization/transactions/[id]`
- `/api/organization/profile`
- `/api/organization/ghl-account`
- `/api/organization/fund-transfers`
- `/api/organization/create-ghl-account`
- `/api/ghl/subaccounts/bulk`
- `/api/ghl/subaccount`
- `/api/fund-transfers`
- `/api/donor_transactions/[id]`
- `/api/donor/settings`
- `/api/donor/impact`
- `/api/donor/donations`
- `/api/donor/[id]`
- `/api/countries`
- `/api/check-stripe-transactions`
- `/api/auth`
- `/api/admin/update-profile`
- `/api/admin/reset-database`
- `/api/admin/organizations`
- `/api/admin/change-password`
