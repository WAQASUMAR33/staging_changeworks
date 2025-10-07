-- Direct SQL script to create a Super Admin account
-- Run this script directly on your MySQL database

-- Note: The password below is hashed version of 'SuperAdmin@123'
-- Password hash: $2a$12$LKfVx3Z.qhZvH0Y6JQXGTuEqK3vZXJ9eJH6vP5xYwZ8PQN7mxBQGO

-- Insert Super Admin user
INSERT INTO users (name, email, password, role, email_verified, created_at, updated_at)
VALUES (
  'Super Admin',
  'superadmin@changeworksfund.org',
  '$2a$12$LKfVx3Z.qhZvH0Y6JQXGTuEqK3vZXJ9eJH6vP5xYwZ8PQN7mxBQGO',
  'SUPERADMIN',
  NOW(),
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE 
  name = 'Super Admin',
  role = 'SUPERADMIN',
  updated_at = NOW();

-- Verify the account was created
SELECT id, name, email, role, created_at FROM users WHERE email = 'superadmin@changeworksfund.org';

-- Login credentials:
-- Email: superadmin@changeworksfund.org
-- Password: SuperAdmin@123
-- 
-- IMPORTANT: Change this password after first login!

