-- Create PlaidConnection table for Plaid integration
CREATE TABLE IF NOT EXISTS `plaid_connections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `donor_id` int NOT NULL,
  `organization_id` int NOT NULL,
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
  KEY `plaid_connections_organization_id_idx` (`organization_id`),
  KEY `plaid_connections_status_idx` (`status`),
  CONSTRAINT `plaid_connections_donor_id_fkey` FOREIGN KEY (`donor_id`) REFERENCES `donors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `plaid_connections_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
