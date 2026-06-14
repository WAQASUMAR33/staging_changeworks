import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma.jsx";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/subscriptions/resume-by-donor - Resume/reactivate subscription by donor ID
export async function POST(request) {
  try {
    const body = await request.json();
    const { donor_id } = body;

    // Validate required fields
    if (!donor_id) {
      return NextResponse.json(
        { success: false, error: 'donor_id is required' },
        { status: 400 }
      );
    }

    // Find the donor
    const donor = await prisma.donor.findUnique({
      where: { id: parseInt(donor_id) },
      select: { id: true, email: true, name: true }
    });

    if (!donor) {
      return NextResponse.json(
        { success: false, error: 'Donor not found' },
        { status: 404 }
      );
    }

    // Find all canceled or scheduled for cancellation subscriptions for the donor
    const dbSubscriptions = await prisma.subscription.findMany({
      where: {
        donor_id: donor.id,
        OR: [
          { status: 'CANCELED' },
          { cancel_at_period_end: true }
        ]
      },
      include: {
        organization: { select: { id: true, name: true, email: true } },
        package: { select: { id: true, name: true, price: true, currency: true } }
      }
    });

    if (dbSubscriptions.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No canceled or scheduled for cancellation subscriptions found for this donor',
          donor_id: donor.id 
        },
        { status: 404 }
      );
    }

    const resumeResults = [];
    let successfulResumes = 0;
    let failedResumes = 0;

    for (const dbSub of dbSubscriptions) {
      try {
        // Check if subscription exists in Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(dbSub.stripe_subscription_id);
        
        let stripeResponse;
        let updatedDbData = {};

        if (stripeSubscription.status === 'canceled') {
          // Subscription is already canceled in Stripe - cannot resume
          resumeResults.push({
            subscription_id: dbSub.id,
            stripe_subscription_id: dbSub.stripe_subscription_id,
            status: 'failed',
            error: 'Subscription is already canceled in Stripe and cannot be resumed. Create a new subscription instead.'
          });
          failedResumes++;
          continue;
        }

        if (stripeSubscription.cancel_at_period_end) {
          // Subscription is scheduled for cancellation - remove the cancellation
          await stripe.subscriptions.update(dbSub.stripe_subscription_id, {
            cancel_at_period_end: false,
          });
          stripeResponse = { message: 'Subscription cancellation removed - subscription will continue' };
          updatedDbData = {
            cancel_at_period_end: false,
            canceled_at: null,
            status: 'ACTIVE',
            updated_at: new Date()
          };
        } else if (stripeSubscription.status === 'past_due' || stripeSubscription.status === 'unpaid') {
          // Subscription is past due - attempt to reactivate
          await stripe.subscriptions.update(dbSub.stripe_subscription_id, {
            cancel_at_period_end: false,
          });
          stripeResponse = { message: 'Subscription reactivated from past_due/unpaid status' };
          updatedDbData = {
            cancel_at_period_end: false,
            canceled_at: null,
            status: 'ACTIVE',
            updated_at: new Date()
          };
        } else {
          // Subscription is already active
          stripeResponse = { message: 'Subscription is already active' };
          updatedDbData = {
            cancel_at_period_end: false,
            canceled_at: null,
            status: 'ACTIVE',
            updated_at: new Date()
          };
        }

        // Update database record
        const updatedDbSub = await prisma.subscription.update({
          where: { id: dbSub.id },
          data: updatedDbData,
          include: {
            donor: { select: { id: true, name: true, email: true } },
            organization: { select: { id: true, name: true, email: true } },
            package: { select: { id: true, name: true, price: true, currency: true } }
          }
        });

        resumeResults.push({
          subscription_id: dbSub.id,
          stripe_subscription_id: dbSub.stripe_subscription_id,
          status: 'success',
          subscription: updatedDbSub,
          stripe_response: stripeResponse
        });
        successfulResumes++;

      } catch (stripeError) {
        console.error(`Stripe resume error for subscription ${dbSub.stripe_subscription_id}:`, stripeError);
        resumeResults.push({
          subscription_id: dbSub.id,
          stripe_subscription_id: dbSub.stripe_subscription_id,
          status: 'failed',
          error: stripeError.message
        });
        failedResumes++;
      }
    }

    return NextResponse.json({
      success: true,
      donor_id: donor.id,
      total_subscriptions: dbSubscriptions.length,
      successful_resumes: successfulResumes,
      failed_resumes: failedResumes,
      message: `${successfulResumes} subscription(s) resumed successfully`,
      results: resumeResults
    });

  } catch (error) {
    console.error('Error resuming subscriptions by donor:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resume subscriptions', details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/subscriptions/resume-by-donor - Get resumable subscriptions for a donor
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const donorId = searchParams.get('donor_id');

    if (!donorId) {
      return NextResponse.json(
        { success: false, error: 'donor_id is required' },
        { status: 400 }
      );
    }

    const donor = await prisma.donor.findUnique({
      where: { id: parseInt(donorId) },
      select: { id: true, email: true, name: true }
    });

    if (!donor) {
      return NextResponse.json(
        { success: false, error: 'Donor not found' },
        { status: 404 }
      );
    }

    // Find all subscriptions that can be resumed
    const subscriptions = await prisma.subscription.findMany({
      where: { 
        donor_id: donor.id,
        OR: [
          { status: 'CANCELED' },
          { cancel_at_period_end: true },
          { status: 'PAST_DUE' },
          { status: 'UNPAID' }
        ]
      },
      include: {
        organization: { select: { id: true, name: true } },
        package: { select: { id: true, name: true } }
      }
    });

    const resumableSubscriptions = subscriptions.filter(sub => 
      sub.status === 'CANCELED' || 
      sub.cancel_at_period_end || 
      sub.status === 'PAST_DUE' || 
      sub.status === 'UNPAID'
    );

    return NextResponse.json({
      success: true,
      donor_id: donor.id,
      total_subscriptions: subscriptions.length,
      resumable_subscriptions: resumableSubscriptions.length,
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        stripe_subscription_id: sub.stripe_subscription_id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_end: sub.current_period_end,
        package_name: sub.package?.name,
        organization_name: sub.organization?.name,
        can_resume: resumableSubscriptions.some(res => res.id === sub.id)
      })),
      resumable: resumableSubscriptions
    });

  } catch (error) {
    console.error('Error getting resumable subscriptions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get resumable subscriptions', details: error.message },
      { status: 500 }
    );
  }
}
