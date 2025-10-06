import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const [donorsCount, orgsCount, donationsAgg, activeCount] = await Promise.all([
      prisma.donor.count({ where: { status: true } }),
      prisma.organization.count({ where: { status: true } }),
      prisma.saveTrRecord.aggregate({ where: { pay_status: 'completed' }, _sum: { trx_amount: true } }),
      prisma.saveTrRecord.count({ where: { pay_status: { in: ['pending', 'processing'] } } })
    ]);

    const totalDonations = donationsAgg._sum.trx_amount || 0;
    const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

    return NextResponse.json({
      success: true,
      stats: {
        totalDonors: { value: donorsCount },
        totalOrganizations: { value: orgsCount },
        totalDonations: { value: currency.format(totalDonations), raw: totalDonations },
        activeTransactions: { value: activeCount }
      }
    });
  } catch (error) {
    console.error('admin dashboard-stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load dashboard stats' }, { status: 500 });
  }
}
