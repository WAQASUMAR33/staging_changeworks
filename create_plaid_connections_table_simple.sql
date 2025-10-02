-- Create plaid_connections table (simplified version without organization_id)
CREATE TABLE IF NOT EXISTS `plaid_connections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `donor_id` int NOT NULL,
  `access_token` varchar(255) NOT NULL,
  `item_id` varchar(255) NOT NULL,
  `institution_id` varchar(255) DEFAULT NULL,
  `institution_name` varchar(255) DEFAULT NULL,
  `accounts` longtext NOT NULL,
  `status` enum('ACTIVE','INACTIVE','ERROR') NOT NULL DEFAULT 'ACTIVE',
  `error_message` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `plaid_connections_donor_id_idx` (`donor_id`),
  KEY `plaid_connections_institution_id_idx` (`institution_id`),
  KEY `plaid_connections_status_idx` (`status`),
  CONSTRAINT `plaid_connections_donor_id_fkey` FOREIGN KEY (`donor_id`) REFERENCES `donors` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
