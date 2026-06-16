const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting data deletion script...');

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete subscription transactions (foreign key constraint)
      const subTxCount = await tx.subscriptionTransaction.deleteMany({});
      console.log(`Deleted ${subTxCount.count} subscription transactions.`);

      // 2. Delete subscriptions
      const subCount = await tx.subscription.deleteMany({});
      console.log(`Deleted ${subCount.count} subscriptions.`);

      // 3. Delete Plaid connections
      const plaidCount = await tx.plaidConnection.deleteMany({});
      console.log(`Deleted ${plaidCount.count} Plaid connections.`);

      // 4. Delete donor transactions (one-time and subscription records)
      const donorTxCount = await tx.donorTransaction.deleteMany({});
      console.log(`Deleted ${donorTxCount.count} donor transactions.`);

      // 5. Delete save transaction records (one-time and subscription records)
      const saveTrCount = await tx.saveTrRecord.deleteMany({});
      console.log(`Deleted ${saveTrCount.count} save transaction records.`);

      // 6. Delete GhlPaymentEvent (contains payment/subscription records for GHL locations)
      const ghlPaymentEventCount = await tx.ghlPaymentEvent.deleteMany({});
      console.log(`Deleted ${ghlPaymentEventCount.count} GHL payment events.`);

      return {
        subscriptionTransactions: subTxCount.count,
        subscriptions: subCount.count,
        plaidConnections: plaidCount.count,
        donorTransactions: donorTxCount.count,
        saveTrRecords: saveTrCount.count,
        ghlPaymentEvents: ghlPaymentEventCount.count
      };
    });

    console.log('✅ All requested records deleted successfully!', result);

  } catch (error) {
    console.error('❌ Error executing deletion:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
