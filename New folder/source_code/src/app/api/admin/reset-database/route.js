import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { verifyAdminToken } from "../../../lib/admin-auth";

export async function POST(request) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization header missing or invalid' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = verifyAdminToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is SUPERADMIN
    if (user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { success: false, error: 'Access denied. SUPERADMIN role required.' },
        { status: 403 }
      );
    }

    console.log('🔍 Database reset initiated by SUPERADMIN:', user.email);

    // Reset database - delete all tables except users
    try {
      // Start a transaction to ensure all operations succeed or fail together
      await prisma.$transaction(async (tx) => {
        // Delete all data from tables (in order to respect foreign key constraints)
        
        // 1. Delete donor transactions first (has foreign keys)
        await tx.donorTransaction.deleteMany({});
        console.log('✅ Deleted donor transactions');

        // 2. Delete transactions
        await tx.transaction.deleteMany({});
        console.log('✅ Deleted transactions');

        // 3. Delete subscriptions
        await tx.subscription.deleteMany({});
        console.log('✅ Deleted subscriptions');

        // 4. Delete plaid connections
        await tx.plaidConnection.deleteMany({});
        console.log('✅ Deleted plaid connections');

        // 5. Delete fund transfers
        await tx.fundTransfer.deleteMany({});
        console.log('✅ Deleted fund transfers');

        // 6. Delete GHL accounts
        await tx.gHLAccount.deleteMany({});
        console.log('✅ Deleted GHL accounts');

        // 7. Delete save transaction records
        await tx.saveTrRecord.deleteMany({});
        console.log('✅ Deleted save transaction records');

        // 8. Delete donors
        await tx.donor.deleteMany({});
        console.log('✅ Deleted donors');

        // 9. Delete organizations
        await tx.organization.deleteMany({});
        console.log('✅ Deleted organizations');

        // 10. Delete packages
        await tx.package.deleteMany({});
        console.log('✅ Deleted packages');

        // 11. Delete password reset tokens
        await tx.passwordResetToken.deleteMany({});
        console.log('✅ Deleted password reset tokens');

        // Note: Users table is preserved as requested
        console.log('✅ Users table preserved');
      });

      console.log('🎉 Database reset completed successfully');

      return NextResponse.json({
        success: true,
        message: 'Database reset successfully',
        resetBy: user.email,
        resetAt: new Date().toISOString(),
        tablesReset: [
          'donorTransaction',
          'transaction', 
          'subscription',
          'plaidConnection',
          'fundTransfer',
          'gHLAccount',
          'saveTrRecord',
          'donor',
          'organization',
          'package',
          'passwordResetToken'
        ],
        tablesPreserved: ['user']
      });

    } catch (error) {
      console.error('❌ Database reset failed:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to reset database. Please try again.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Database reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
