import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

/**
 * DELETE /api/organization/delete-all
 * Delete all organizations and all related records
 * 
 * WARNING: This is a destructive operation that will delete:
 * - All organizations
 * - All donors associated with organizations
 * - All transactions (DonorTransaction, SaveTrRecord)
 * - All fund transfers
 * - All GHL accounts
 * - All subscriptions
 * - All Plaid connections
 * 
 * This endpoint requires admin authentication (you can add auth check if needed)
 */
export async function DELETE(request) {
  try {
    console.log('🗑️ Starting deletion of all organizations and related records...');

    // Use a transaction to ensure all deletions succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      let deletedCounts = {
        subscriptionTransactions: 0,
        subscriptions: 0,
        plaidConnections: 0,
        donorTransactions: 0,
        saveTrRecords: 0,
        fundTransfers: 0,
        ghlAccounts: 0,
        donors: 0,
        organizations: 0
      };

      // 1. Delete subscription transactions first (has foreign key to subscriptions)
      const subscriptionTxResult = await tx.subscriptionTransaction.deleteMany({
        where: {
          subscription: {
            organization_id: { not: null }
          }
        }
      });
      deletedCounts.subscriptionTransactions = subscriptionTxResult.count;
      console.log(`✅ Deleted ${deletedCounts.subscriptionTransactions} subscription transactions`);

      // 2. Delete subscriptions (has foreign keys to donors and organizations)
      const subscriptionsResult = await tx.subscription.deleteMany({
        where: {
          organization_id: { not: null }
        }
      });
      deletedCounts.subscriptions = subscriptionsResult.count;
      console.log(`✅ Deleted ${deletedCounts.subscriptions} subscriptions`);

      // 3. Delete Plaid connections (has foreign keys to donors and organizations)
      const plaidResult = await tx.plaidConnection.deleteMany({
        where: {
          organization_id: { not: null }
        }
      });
      deletedCounts.plaidConnections = plaidResult.count;
      console.log(`✅ Deleted ${deletedCounts.plaidConnections} Plaid connections`);

      // 4. Delete donor transactions (has foreign keys to donors and organizations)
      const donorTxResult = await tx.donorTransaction.deleteMany({
        where: {
          organization_id: { not: null }
        }
      });
      deletedCounts.donorTransactions = donorTxResult.count;
      console.log(`✅ Deleted ${deletedCounts.donorTransactions} donor transactions`);

      // 5. Delete save transaction records (has foreign keys to donors and organizations)
      const saveTrResult = await tx.saveTrRecord.deleteMany({
        where: {
          trx_organization_id: { not: null }
        }
      });
      deletedCounts.saveTrRecords = saveTrResult.count;
      console.log(`✅ Deleted ${deletedCounts.saveTrRecords} save transaction records`);

      // 6. Delete fund transfers (has foreign key to organizations)
      const fundTransfersResult = await tx.fundTransfer.deleteMany({
        where: {
          organization_id: { not: null }
        }
      });
      deletedCounts.fundTransfers = fundTransfersResult.count;
      console.log(`✅ Deleted ${deletedCounts.fundTransfers} fund transfers`);

      // 7. Delete GHL accounts (has foreign key to organizations)
      const ghlResult = await tx.gHLAccount.deleteMany({
        where: {
          organization_id: { not: null }
        }
      });
      deletedCounts.ghlAccounts = ghlResult.count;
      console.log(`✅ Deleted ${deletedCounts.ghlAccounts} GHL accounts`);

      // 8. Delete donors (has foreign key to organizations)
      const donorsResult = await tx.donor.deleteMany({
        where: {
          organization_id: { not: null }
        }
      });
      deletedCounts.donors = donorsResult.count;
      console.log(`✅ Deleted ${deletedCounts.donors} donors`);

      // 9. Finally, delete all organizations
      const orgsResult = await tx.organization.deleteMany({});
      deletedCounts.organizations = orgsResult.count;
      console.log(`✅ Deleted ${deletedCounts.organizations} organizations`);

      return deletedCounts;
    });

    console.log('🎉 Successfully deleted all organizations and related records');

    return NextResponse.json({
      success: true,
      message: "All organizations and related records deleted successfully",
      deletedCounts: result
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error deleting organizations:', error);
    return NextResponse.json({
      success: false,
      error: "Failed to delete organizations",
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/organization/delete-all
 * Get information about what would be deleted (dry run)
 */
export async function GET() {
  try {
    const counts = {
      organizations: await prisma.organization.count(),
      donors: await prisma.donor.count(),
      donorTransactions: await prisma.donorTransaction.count(),
      saveTrRecords: await prisma.saveTrRecord.count(),
      fundTransfers: await prisma.fundTransfer.count(),
      ghlAccounts: await prisma.gHLAccount.count(),
      subscriptions: await prisma.subscription.count(),
      subscriptionTransactions: await prisma.subscriptionTransaction.count({
        where: {
          subscription: {
            organization_id: { not: null }
          }
        }
      }),
      plaidConnections: await prisma.plaidConnection.count()
    };

    return NextResponse.json({
      message: "This endpoint will delete all organizations and related records",
      warning: "This is a destructive operation. Use DELETE method to proceed.",
      currentCounts: counts,
      endpoint: "DELETE /api/organization/delete-all"
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error getting counts:', error);
    return NextResponse.json({
      success: false,
      error: "Failed to get record counts",
      details: error.message
    }, { status: 500 });
  }
}
