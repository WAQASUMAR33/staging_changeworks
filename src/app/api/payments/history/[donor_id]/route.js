import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(request, { params }) {
  try {
    const { donor_id } = await params;

    if (!donor_id) {
      return NextResponse.json({
        success: false,
        error: "Donor ID is required"
      }, { status: 400 });
    }

    const donorIdInt = parseInt(donor_id);
    if (isNaN(donorIdInt)) {
      return NextResponse.json({
        success: false,
        error: "Invalid donor ID format"
      }, { status: 400 });
    }

    // Verify donor exists
    const donor = await prisma.donor.findUnique({
      where: { id: donorIdInt },
      select: { id: true, name: true, email: true }
    });

    if (!donor) {
      return NextResponse.json({
        success: false,
        error: "Donor not found"
      }, { status: 404 });
    }

    // Get payment history for the donor
    const payments = await prisma.saveTrRecord.findMany({
      where: {
        trx_donor_id: donorIdInt
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Format the payment data for the frontend
    const formattedPayments = payments.map(payment => {
      let stripeDetails = null;
      try {
        if (payment.trx_details) {
          stripeDetails = JSON.parse(payment.trx_details);
        }
      } catch (e) {
        // If parsing fails, keep stripeDetails as null
      }

      return {
        id: payment.id,
        transaction_id: payment.trx_id,
        amount: payment.trx_amount,
        currency: 'USD', // Default currency, you might want to store this in the database
        status: payment.pay_status,
        payment_method: payment.trx_method,
        receipt_url: payment.trx_recipt_url,
        transaction_date: payment.trx_date,
        created_at: payment.created_at,
        updated_at: payment.updated_at,
        organization: payment.organization,
        stripe_details: stripeDetails,
        description: stripeDetails?.description || `Donation to ${payment.organization.name}`
      };
    });

    // Calculate summary statistics
    const totalDonations = payments.reduce((sum, payment) => {
      return payment.pay_status === 'completed' ? sum + payment.trx_amount : sum;
    }, 0);

    const completedPayments = payments.filter(p => p.pay_status === 'completed').length;
    const pendingPayments = payments.filter(p => p.pay_status === 'pending').length;
    const failedPayments = payments.filter(p => p.pay_status === 'failed').length;

    return NextResponse.json({
      success: true,
      donor: donor,
      payments: formattedPayments,
      summary: {
        total_payments: payments.length,
        completed_payments: completedPayments,
        pending_payments: pendingPayments,
        failed_payments: failedPayments,
        total_donated: totalDonations,
        currency: 'USD'
      }
    });

  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch payment history",
      details: error.message
    }, { status: 500 });
  }
}
