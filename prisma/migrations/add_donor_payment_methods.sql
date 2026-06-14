-- Migration: Add donor_payment_methods table
-- Run this against your MySQL database

CREATE TABLE IF NOT EXISTS `donor_payment_methods` (
  `id`                       INT          NOT NULL AUTO_INCREMENT,
  `donor_id`                 INT          NOT NULL,
  `stripe_customer_id`       VARCHAR(255) NOT NULL,
  `stripe_payment_method_id` VARCHAR(255) NOT NULL,
  `label`                    VARCHAR(100) NOT NULL,
  `card_brand`               VARCHAR(50)  NULL,
  `card_last4`               VARCHAR(4)   NULL,
  `card_exp_month`           INT          NULL,
  `card_exp_year`            INT          NULL,
  `is_default`               TINYINT(1)   NOT NULL DEFAULT 1,
  `status`                   VARCHAR(50)  NOT NULL DEFAULT 'active',
  `created_at`               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`               DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `donor_payment_methods_stripe_payment_method_id_key` (`stripe_payment_method_id`),
  KEY `donor_payment_methods_donor_id_idx` (`donor_id`),
  CONSTRAINT `donor_payment_methods_donor_id_fkey`
    FOREIGN KEY (`donor_id`) REFERENCES `donors` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
