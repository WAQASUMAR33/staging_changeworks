import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// POST /api/debug/create-test-subscription - Create a test subscription
export async function POST(request) {
  try {
    console.log('Creating test subscription...');
    
    // First, create a test donor if it doesn't exist
    let donor = await prisma.donor.findFirst({
      where: { email: 'test@example.com' }
    });
    
    if (!donor) {
      donor = await prisma.donor.create({
        data: {
          name: 'Test Donor',
          email: 'test@example.com',
          password: 'hashedpassword',
          phone: '1234567890',
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zip_code: '12345',
          country: 'US',
          is_verified: true,
          verification_token: null,
          reset_token: null,
          reset_token_expires: null
        }
      });
      console.log(`Created test donor with ID: ${donor.id}`);
    } else {
      console.log(`Using existing test donor with ID: ${donor.id}`);
    }
    
    // Create a test organization if it doesn't exist
    let organization = await prisma.organization.findFirst({
      where: { name: 'Test Organization' }
    });
    
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          email: 'org@example.com',
          phone: '1234567890',
          address: '456 Org St',
          city: 'Org City',
          state: 'OS',
          zip_code: '54321',
          country: 'US',
          website: 'https://testorg.com',
          description: 'Test organization for debugging',
          is_verified: true,
          verification_token: null
        }
      });
      console.log(`Created test organization with ID: ${organization.id}`);
    } else {
      console.log(`Using existing test organization with ID: ${organization.id}`);
    }
    
    // Create a test package if it doesn't exist
    let package_ = await prisma.package.findFirst({
      where: { name: 'Test Package' }
    });
    
    if (!package_) {
      package_ = await prisma.package.create({
        data: {
          name: 'Test Package',
          description: 'Test package for debugging',
          price: 10.00,
          currency: 'USD',
          interval: 'month',
          interval_count: 1,
          features: '["Feature 1", "Feature 2"]',
          is_active: true
        }
      });
      console.log(`Created test package with ID: ${package_.id}`);
    } else {
      console.log(`Using existing test package with ID: ${package_.id}`);
    }
    
    // Create the test subscription
    const subscription = await prisma.subscription.create({
      data: {
        stripe_subscription_id: 'sub_test_' + Date.now(),
        donor_id: donor.id,
        organization_id: organization.id,
        package_id: package_.id,
        status: 'ACTIVE',
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        cancel_at_period_end: false,
        canceled_at: null,
        amount: 10.00,
        currency: 'USD',
        interval: 'month',
        interval_count: 1,
        metadata: JSON.stringify({
          test: true,
          created_at: new Date().toISOString()
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
            name: true
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true
          }
        }
      }
    });
    
    console.log(`Created test subscription with ID: ${subscription.id}`);
    
    return NextResponse.json({
      success: true,
      message: 'Test subscription created successfully',
      subscription: subscription
    });

  } catch (error) {
    console.error('Error creating test subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create test subscription', details: error.message },
      { status: 500 }
    );
  }
}
