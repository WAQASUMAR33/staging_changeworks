/**
 * Clears all GHL app connection records from the database.
 * Run with: node scripts/clear-ghl-connections.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting GHL connection cleanup...\n');

  // 1. Children of ghl_connections first (FK constraints)
  const stripeConns = await prisma.ghlStripeConnection.deleteMany({});
  console.log(`✓ Deleted ${stripeConns.count} ghl_stripe_connections`);

  const webhookLogs = await prisma.ghlWebhookLog.deleteMany({});
  console.log(`✓ Deleted ${webhookLogs.count} ghl_webhook_logs`);

  const paymentEvents = await prisma.ghlPaymentEvent.deleteMany({});
  console.log(`✓ Deleted ${paymentEvents.count} ghl_payment_events`);

  // 2. Parent ghl_connections
  const connections = await prisma.ghlConnection.deleteMany({});
  console.log(`✓ Deleted ${connections.count} ghl_connections`);

  // 3. App installations
  const installations = await prisma.gHLAppInstallation.deleteMany({});
  console.log(`✓ Deleted ${installations.count} ghl_app_installations`);

  // 4. GHL accounts linked to orgs
  const accounts = await prisma.gHLAccount.deleteMany({});
  console.log(`✓ Deleted ${accounts.count} ghl_accounts`);

  console.log('\nDone. You can now reconnect the GHL app.');
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
