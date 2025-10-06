import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";
import emailService from "../../../lib/email-service.jsx";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/subscriptions/setup-payment - Setup payment for subscription
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      donor_id,
      organization_id,
      package_id,
      customer_email,
      customer_name,
      return_url,
      create_checkout_session = false,
      auto_create_subscription = false,
      payment_method_id = null
    } = body;

    // Validate required fields
    if (!donor_id || !organization_id || !package_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: donor_id, organization_id, package_id' },
        { status: 400 }
      );
    }

    // Get package details
    const packageData = await prisma.package.findUnique({
      where: { id: package_id }
    });

    if (!packageData) {
      return NextResponse.json(
        { success: false, error: 'Package not found' },
        { status: 404 }
      );
    }

    // Get donor and organization details
    const [donor, organization] = await Promise.all([
      prisma.donor.findUnique({
        where: { id: donor_id },
        select: { id: true, name: true, email: true }
      }),
      prisma.organization.findUnique({
        where: { id: organization_id },
        select: { id: true, name: true, email: true }
      })
    ]);

    if (!donor || !organization) {
      return NextResponse.json(
        { success: false, error: 'Donor or organization not found' },
        { status: 404 }
      );
    }

    // Create or retrieve Stripe customer
    let customer;
    try {
      // Use provided customer email or fall back to donor email
      const customerEmail = customer_email || donor.email;
      const customerName = customer_name || donor.name;
      
      const existingCustomers = await stripe.customers.list({
        email: customerEmail,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        // Update customer name if provided
        if (customer_name && customer.name !== customer_name) {
          customer = await stripe.customers.update(customer.id, {
            name: customer_name
          });
        }
      } else {
        customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName,
          metadata: {
            donor_id: donor_id.toString(),
            organization_id: organization_id.toString()
          }
        });
      }
    } catch (stripeError) {
      console.error('Stripe customer creation error:', stripeError);
      console.error('Stripe error details:', {
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message,
        param: stripeError.param,
        decline_code: stripeError.decline_code
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create Stripe customer',
          details: {
            type: stripeError.type,
            code: stripeError.code,
            message: stripeError.message,
            param: stripeError.param
          }
        },
        { status: 500 }
      );
    }

    // If auto_create_subscription is true and payment_method_id is provided, create subscription directly
    if (auto_create_subscription && payment_method_id) {
      try {
        // Attach payment method to customer
        await stripe.paymentMethods.attach(payment_method_id, {
          customer: customer.id,
        });

        // Set as default payment method
        await stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: payment_method_id,
          },
        });

        // Create subscription directly
        const subscriptionData = {
          customer: customer.id,
          items: [{
            price_data: {
              currency: packageData.currency.toLowerCase(),
              product_data: {
                name: packageData.name,
                description: packageData.description,
              },
              unit_amount: Math.round(packageData.price * 100), // Convert to cents
              recurring: {
                interval: 'month', // Default to monthly
              },
            },
          }],
          collection_method: 'charge_automatically',
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: ['latest_invoice.payment_intent'],
          metadata: {
            donor_id: donor_id.toString(),
            organization_id: organization_id.toString(),
            package_id: package_id.toString()
          }
        };

        const stripeSubscription = await stripe.subscriptions.create(subscriptionData);

        // Save subscription to database
        const subscription = await prisma.subscription.create({
          data: {
            stripe_subscription_id: stripeSubscription.id,
            donor_id,
            organization_id,
            package_id,
            status: stripeSubscription.status.toUpperCase(),
            current_period_start: new Date(stripeSubscription.current_period_start * 1000),
            current_period_end: new Date(stripeSubscription.current_period_end * 1000),
            cancel_at_period_end: stripeSubscription.cancel_at_period_end,
            canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
            trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
            trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
            amount: packageData.price,
            currency: packageData.currency,
            interval: 'month',
            interval_count: 1,
            metadata: JSON.stringify({
              stripe_customer_id: customer.id,
              payment_method_id: payment_method_id,
              created_via: 'api_auto'
            })
          },
          include: {
            donor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            organization: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            package: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                currency: true,
                features: true
              }
            }
          }
        });

        // Send welcome email and monthly impact email for auto-created subscription
        try {
          const dashboardLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/donor/dashboard?donor_id=${donor.id}`;
          
          // Send welcome email
          const welcomeResult = await emailService.sendWelcomeEmail({
            donor: {
              name: donor.name,
              email: donor.email
            },
            organization: organization,
            dashboardLink: dashboardLink
          });

          if (welcomeResult.success) {
            console.log(`✅ Welcome email sent to ${donor.email} for auto-created subscription`);
          } else {
            console.error(`❌ Failed to send welcome email to ${donor.email}:`, welcomeResult.error);
          }

          // Send monthly impact email for the subscription
          const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
          const monthlyImpactResult = await emailService.sendMonthlyImpactEmail({
            donor: {
              name: donor.name,
              email: donor.email
            },
            organization: organization,
            dashboardLink: dashboardLink,
            month: currentMonth,
            totalAmount: packageData.price
          });

          if (monthlyImpactResult.success) {
            console.log(`✅ Monthly impact email sent to ${donor.email} for $${packageData.price} in ${currentMonth}`);
          } else {
            console.error(`❌ Failed to send monthly impact email to ${donor.email}:`, monthlyImpactResult.error);
          }

        } catch (emailError) {
          console.error('Error sending subscription emails:', emailError);
          // Don't fail the API if email sending fails
        }

        return NextResponse.json({
          success: true,
          subscription,
          client_secret: stripeSubscription.latest_invoice.payment_intent.client_secret,
          stripe_subscription_id: stripeSubscription.id,
          customer: {
            id: customer.id,
            email: customer.email,
            name: customer.name
          },
          package: {
            id: packageData.id,
            name: packageData.name,
            price: packageData.price,
            currency: packageData.currency
          },
          message: 'Subscription created successfully. Complete payment to activate.'
        });

      } catch (stripeError) {
        console.error('Auto subscription creation error:', stripeError);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to create subscription automatically',
            details: {
              type: stripeError.type,
              code: stripeError.code,
              message: stripeError.message,
              param: stripeError.param
            }
          },
          { status: 500 }
        );
      }
    }

    // If create_checkout_session is true, create a checkout session
    if (create_checkout_session) {
      // Build dynamic base URL without hardcoding
      const fallbackOrigin = new URL(request.url).origin;
      const baseUrl = return_url || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || fallbackOrigin;
      let checkoutSession;
      try {
        const sessionData = {
          customer: customer.id,
          payment_method_types: ['card'],
          mode: 'subscription',
          payment_method_collection: 'always',
          line_items: [{
            price_data: {
              currency: packageData.currency.toLowerCase(),
              product_data: {
                name: packageData.name,
                description: packageData.description,
              },
              unit_amount: Math.round(packageData.price * 100), // Convert to cents
              recurring: {
                interval: 'month', // Default to monthly
              },
            },
            quantity: 1,
          }],
          success_url: `${baseUrl.replace(/\/$/, '')}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl.replace(/\/$/, '')}/subscription/cancel`,
          metadata: {
            donor_id: donor_id.toString(),
            organization_id: organization_id.toString(),
            package_id: package_id.toString()
          },
          subscription_data: {
            metadata: {
              donor_id: donor_id.toString(),
              organization_id: organization_id.toString(),
              package_id: package_id.toString()
            }
          }
        };

        checkoutSession = await stripe.checkout.sessions.create(sessionData);
      } catch (stripeError) {
        console.error('Checkout session creation error:', stripeError);
        console.error('Stripe error details:', {
          type: stripeError.type,
          code: stripeError.code,
          message: stripeError.message,
          param: stripeError.param,
          decline_code: stripeError.decline_code
        });
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to create checkout session',
            details: {
              type: stripeError.type,
              code: stripeError.code,
              message: stripeError.message,
              param: stripeError.param
            }
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        checkout_session: {
          id: checkoutSession.id,
          url: checkoutSession.url
        },
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name
        },
        package: {
          id: packageData.id,
          name: packageData.name,
          price: packageData.price,
          currency: packageData.currency
        },
        message: 'Checkout session created successfully'
      });
    } else {
      // Create setup intent for payment method collection
      let setupIntent;
      try {
        setupIntent = await stripe.setupIntents.create({
          customer: customer.id,
          payment_method_types: ['card'],
          usage: 'off_session',
          metadata: {
            donor_id: donor_id.toString(),
            organization_id: organization_id.toString(),
            package_id: package_id.toString()
          }
        });
      } catch (stripeError) {
        console.error('Setup intent creation error:', stripeError);
        return NextResponse.json(
          { success: false, error: 'Failed to create setup intent' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        setup_intent: {
          id: setupIntent.id,
          client_secret: setupIntent.client_secret,
          status: setupIntent.status
        },
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name
        },
        package: {
          id: packageData.id,
          name: packageData.name,
          price: packageData.price,
          currency: packageData.currency
        },
        message: 'Payment setup created successfully'
      });
    }

  } catch (error) {
    console.error('Error setting up subscription payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to setup subscription payment' },
      { status: 500 }
    );
  }
}
