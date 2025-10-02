-- Add organization_id field to existing plaid_connections table
ALTER TABLE `plaid_connections` 
ADD COLUMN `organization_id` int NOT NULL AFTER `donor_id`;

-- Add foreign key constraint
ALTER TABLE `plaid_connections` 
ADD CONSTRAINT `plaid_connections_organization_id_fkey` 
FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add index for organization_id
ALTER TABLE `plaid_connections` 
ADD INDEX `plaid_connections_organization_id_idx` (`organization_id`);
