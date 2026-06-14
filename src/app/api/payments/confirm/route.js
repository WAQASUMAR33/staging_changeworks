import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import emailService from "../../../lib/email-service";

import { createStripeClient } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';

const schema = z.object({
  payment_intent_id: z.string().min(1),
});

export async function POST(request) {
  const stripe = await createStripeClient();
  try {

    const body = await request.json();
    const { payment_intent_id } = schema.parse(body);

    console.log(`🔍 Confirming payment for intent: ${payment_intent_id}`);

    // 1. Find the pending transaction in the database FIRST
    // We search by trx_id (which usually contains the PI ID) or trx_details
    const transaction = await prisma.saveTrRecord.findFirst({
      where: {
        OR: [
          { trx_id: { contains: payment_intent_id } },
          { trx_details: { contains: payment_intent_id } }
        ]
      }
    });

    if (!transaction) {
      console.error(`❌ Transaction record not found for PI: ${payment_intent_id}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Transaction record not found' 
      }, { status: 404 });
    }

    // 2. Retrieve the PaymentIntent from Stripe (using Connected Account if applicable)
    let pi;
    try {
      const trxDetails = JSON.parse(transaction.trx_details || '{}');
      const stripeAccountId = trxDetails.destination_account;

      const options = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;
      console.log(`🔍 Retrieving PI ${payment_intent_id} from Stripe${stripeAccountId ? ` (Account: ${stripeAccountId})` : ''}...`);

      pi = await stripe.paymentIntents.retrieve(payment_intent_id, options);
    } catch (stripeError) {
      console.error('❌ Error retrieving payment intent:', stripeError);
      return NextResponse.json({ 
        success: false, 
        error: stripeError.message 
      }, { status: 400 });
    }

    if (pi.status !== 'succeeded') {
      return NextResponse.json({ 
        success: false, 
        error: `Payment not succeeded. Status: ${pi.status}` 
      }, { status: 400 });
    }

    if (transaction.pay_status === 'completed') {
      console.log(`✅ Transaction ${transaction.id} already completed`);
      return NextResponse.json({ success: true, transaction });
    }

    // 3. Update the transaction record
    const updatedTransaction = await prisma.saveTrRecord.update({
      where: { id: transaction.id },
      data: {
        pay_status: 'completed',
        trx_recipt_url: pi.receipt_url || `https://pay.stripe.com/receipts/${pi.id}`,
        trx_details: JSON.stringify({
          ...JSON.parse(transaction.trx_details || '{}'),
          payment_intent_id: pi.id,
          stripe_status: pi.status,
          stripe_payment_method: pi.payment_method,
          updated_at: new Date()
        }),
        updated_at: new Date()
      }
    });

    // 4. Update Organization Balance
    // Calculate amount in dollars (Stripe amount is in cents)
    const amountDollars = (pi.amount_received || pi.amount) / 100;
    const organizationAmount = amountDollars * 0.9; // 90% share

    await prisma.organization.update({
      where: { id: transaction.trx_organization_id },
      data: {
        balance: {
          increment: organizationAmount
        }
      }
    });

    console.log(`✅ Payment confirmed and recorded for PI: ${payment_intent_id}`);

    // 5. Create DonorTransaction and Send Email (for One-Time Donations)
    // This serves as a primary trigger for local dev (where webhooks fail) and a backup for prod
    // We check for existence to avoid race conditions with webhook
    const metadata = pi.metadata || {};
    let emailResult = { sent: false, reason: 'not_applicable' };

    if (metadata.transaction_type === 'one_time') {
      try {
        const donorId = transaction.trx_donor_id;
        const organizationId = transaction.trx_organization_id;
        
        // Check if DonorTransaction already exists
        const existingTrx = await prisma.donorTransaction.findUnique({
          where: { trnx_id: pi.id }
        });

        if (!existingTrx) {
            console.log(`Creating DonorTransaction from confirm API for ${pi.id}`);
            
            const paymentMethod = typeof pi.payment_method === 'string' 
                ? pi.payment_method 
                : (pi.payment_method?.id || 'card');

            await prisma.donorTransaction.create({
                data: {
                  donor_id: donorId,
                  organization_id: organizationId,
                  amount: organizationAmount,
                  currency: 'usd',
                  transaction_type: 'one_time',
                  status: 'completed',
                  trnx_id: pi.id,
                  payment_method: paymentMethod,
                  receipt_url: pi.receipt_url,
                }
            });

            // Send Email
            // Since we just created the transaction, we are responsible for sending the email
            const [donor, organization] = await Promise.all([
              prisma.donor.findUnique({ where: { id: donorId }, select: { name: true, email: true } }),
              prisma.organization.findUnique({ 
                where: { id: organizationId }, 
                select: { 
                  name: true, email: true, firstName: true, lastName: true, title: true, 
                  imageUrl: true, ein: true, address: true, city: true, state: true, postalCode: true, phone: true
                } 
              })
            ]);

            if (donor && organization) {
                // Generate dashboard link - FORCE login URL for donor dashboard access
                let appBase = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
                if (!/^https?:\/\//i.test(appBase)) appBase = `https://${appBase}`;
                const dashboardLink = `${appBase}/donor/login`;
                
                let paymentMethodText = 'Credit Card';
                if (pi.payment_method_details?.card?.last4) {
                    paymentMethodText = `Card ending in ${pi.payment_method_details.card.last4}`;
                }
                
                console.log(`📧 [Confirm API] Sending one-time donation email to ${donor.email}`);
                try {
                  const sendResult = await emailService.sendOneTimeDonationEmail({
                    donor,
                    organization,
                    dashboardLink,
                    amount: amountDollars.toFixed(2),
                    donationDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    transactionId: pi.id,
                    paymentMethod: paymentMethodText,
                    campaignName: metadata.campaign_name || 'General Donation'
                  });
                  emailResult = { sent: true, details: sendResult };
                } catch (emailErr) {
                  console.error('Failed to send email in confirm API:', emailErr);
                  emailResult = { sent: false, reason: 'error', error: emailErr.message };
                }
            } else {
                emailResult = { sent: false, reason: 'missing_data' };
            }
        } else {
             console.log(`ℹ️ DonorTransaction already exists for ${pi.id}, skipping creation/email in confirm API`);
             emailResult = { sent: true, reason: 'already_handled_by_webhook' };
        }
      } catch (err) {
        console.error('Error handling DonorTransaction/Email in confirm API:', err);
        emailResult = { sent: false, reason: 'transaction_creation_error', error: err.message };
      }
    }

    return NextResponse.json({ 
      success: true, 
      transaction: updatedTransaction,
      emailResult
    });

  } catch (error) {
    console.error('Confirmation error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
