# Plaid Integration Environment Setup

## Required Environment Variables

Add the following environment variables to your `.env` file:

```env
# Plaid Configuration
PLAID_CLIENT_ID="68814029c232ad0025879e7e"
PLAID_SECRET_KEY="c48f13b583127da05554dfcd019a05"
NEXT_PUBLIC_PLAID_ENV="sandbox"
```

## Database Setup

Run the following SQL script to create the PlaidConnection table:

```sql
-- Create PlaidConnection table for Plaid integration
CREATE TABLE IF NOT EXISTS `plaid_connections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `donor_id` int NOT NULL,
  `access_token` varchar(255) NOT NULL,
  `item_id` varchar(255) NOT NULL,
  `institution_id` varchar(255) DEFAULT NULL,
  `institution_name` varchar(255) DEFAULT NULL,
  `accounts` text,
  `status` varchar(50) NOT NULL DEFAULT 'ACTIVE',
  `error_message` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `plaid_connections_access_token_key` (`access_token`),
  UNIQUE KEY `plaid_connections_item_id_key` (`item_id`),
  KEY `plaid_connections_donor_id_idx` (`donor_id`),
  KEY `plaid_connections_status_idx` (`status`),
  CONSTRAINT `plaid_connections_donor_id_fkey` FOREIGN KEY (`donor_id`) REFERENCES `donors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Features Implemented

### 1. PlaidIntegration Component
- Modal-based Plaid Link integration
- Secure bank account connection
- Real-time status updates
- Error handling and user feedback

### 2. API Endpoints
- `/api/plaid/create-link-token` - Creates Plaid Link tokens
- `/api/plaid/exchange-token` - Exchanges public tokens for access tokens
- `/api/plaid/webhook` - Handles Plaid webhooks

### 3. Database Integration
- PlaidConnection model for storing bank connections
- Relationship with Donor model
- Status tracking and error handling

### 4. Dashboard Integration
- Plaid integration button in Quick Actions
- Modal popup instead of separate page
- Success callback integration

## Usage

1. Add the environment variables to your `.env` file
2. Run the SQL script to create the database table
3. The Plaid integration will be available in the donor dashboard
4. Click "Plaid Integration" in Quick Actions to connect a bank account

## Security Notes

- Access tokens are stored securely in the database
- All API calls are authenticated with JWT tokens
- Webhook endpoints handle Plaid events securely
- Bank account data is encrypted and read-only

## Testing

The integration uses Plaid's sandbox environment for testing. You can use test credentials provided by Plaid for development and testing purposes.
