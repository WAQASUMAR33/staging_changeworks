import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import GHLClient from "../../lib/ghl-client";
import emailService from "../../lib/email-service";

const donorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").max(100),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  imageUrl: z.string().optional(),
  organization_id: z.number().int().positive("Organization ID is required"),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, password, phone, city, address, postal_code, imageUrl, organization_id } = donorSchema.parse(body);

    // Check for existing donor
    const existingDonor = await prisma.donor.findUnique({ where: { email } });
    if (existingDonor) {
      return NextResponse.json({ error: "Donor already exists" }, { status: 400 });
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({ where: { id: organization_id } });
    if (!organization) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create donor (start as unverified)
    const donor = await prisma.donor.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        city,
        address,
        postal_code,
        imageUrl,
        status: false,
        organization: { connect: { id: organization_id } },
      },
      include: { organization: true },
    });

    // Create GHL contact for the donor using the specific GHL API configuration
    let ghlContactCreated = false;
    let ghlContactError = null;
    let ghlContactId = null;
    let ghlAccount = null;

    try {
      // Get the organization's GHL account
      ghlAccount = await prisma.gHLAccount.findFirst({
        where: { organization_id: organization_id, status: "active" },
        select: { ghl_location_id: true, business_name: true, api_key: true }
      });

      // Fallback: use organization's stored ghlId if no active gHLAccount record
      if (!ghlAccount) {
        const org = await prisma.organization.findUnique({
          where: { id: organization_id },
          select: { ghlId: true, name: true }
        });
        if (org?.ghlId) {
          console.log('📋 Using GHL ID from organization table:', org.ghlId);
          // If ghlId looks like a token (long), use it as token; otherwise treat as locationId
          const looksLikeToken = typeof org.ghlId === 'string' && org.ghlId.length > 100;
          ghlAccount = { 
            ghl_location_id: looksLikeToken ? null : org.ghlId, 
            business_name: org.name || null, 
            api_key: looksLikeToken ? org.ghlId : null 
          };
          console.log('🔧 GHL Account configuration:', ghlAccount);
        }
      }

      if (ghlAccount && ghlAccount.ghl_location_id) {
        console.log('🔗 Creating GHL contact for donor:', donor.name, 'in organization GHL location:', ghlAccount.ghl_location_id);
        
        // Use the specific GHL API configuration provided
        const ghlApiUrl = 'https://rest.gohighlevel.com/v1/contacts/';
        const ghlApiKey = process.env.GHL_API_KEY;
        
        // Prepare contact data according to your GHL API specification
        const contactData = {
          email: email,
          phone: phone || '+15551234567', // Default phone if not provided
          firstName: name.split(' ')[0] || name,
          lastName: name.split(' ').slice(1).join(' ') || 'User',
          city: city || 'Mandi Bahauddin',
          address1: address || 'Lahore',
          postalCode: postal_code || '50400',
          country: 'PK', // Default to Pakistan as per your example
          notes: `Donor registration initiated. ID: ${donor.id}`,
          customField: {
            // Using the custom field structure from your example
            cf_transaction_id: donor.id.toString(),
            cf_transaction_email: email,
            cf_transaction_amount: '0 AED', // Default amount, can be updated later
            cf_donor_id: donor.id.toString(),
            cf_organization_id: organization_id.toString(),
            cf_organization_name: organization.name,
            cf_created_via: 'ChangeWorks Donor Registration',
            cf_created_at: new Date().toISOString(),
            cf_donor_status: 'Active',
            cf_registration_source: 'Web Signup'
          },
          locationId: ghlAccount.ghl_location_id
        };

        console.log('=== GHL CONTACT API REQUEST ===');
        console.log('URL:', ghlApiUrl);
        console.log('Location ID:', ghlAccount.ghl_location_id);
        console.log('Request Data:', JSON.stringify(contactData, null, 2));

        // Make direct API call to GHL using fetch
        const response = await fetch(ghlApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ghlApiKey}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(contactData)
        });

        const responseData = await response.json();

        if (response.ok) {
          ghlContactCreated = true;
          // Extract contact ID from the nested response structure
          ghlContactId = responseData.contact?.id || responseData.id || responseData.contactId;
          console.log('✅ GHL contact created successfully:', {
            contactId: ghlContactId,
            locationId: ghlAccount.ghl_location_id,
            businessName: ghlAccount.business_name,
            donorName: donor.name,
            organizationName: organization.name,
            responseData: responseData
          });
        } else {
          ghlContactError = responseData.message || 'GHL API request failed';
          console.error('❌ Failed to create GHL contact:', {
            error: ghlContactError,
            status: response.status,
            statusText: response.statusText,
            locationId: ghlAccount.ghl_location_id,
            businessName: ghlAccount.business_name,
            responseData: responseData
          });
        }
      } else {
        console.log('⚠️ No GHL account found for organization:', organization_id);
        ghlContactError = 'No GHL account found for organization';
      }
    } catch (ghlErr) {
      ghlContactError = ghlErr.message;
      console.error('❌ GHL contact creation failed:', ghlErr.message);
      // Don't fail the donor creation if GHL contact creation fails
    }

    // Generate verification token
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in DonorVerificationToken
    await prisma.donorVerificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    // Send beautiful verification email using our email service
    let verificationEmailSent = false;
    let verificationEmailError = null;
    let welcomeEmailSent = false;
    let welcomeEmailError = null;

    try {
      // Check if email server is configured
      if (process.env.EMAIL_SERVER_HOST && process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD) {
        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org'}/donor/verify?token=${token}&email=${encodeURIComponent(email)}`;

        // Send beautiful verification email
        const verificationResult = await emailService.sendVerificationEmail({
          donor: {
            name: donor.name,
            email: donor.email
          },
          verificationToken: token,
          verificationLink: verificationUrl
        });

        if (verificationResult.success) {
          verificationEmailSent = true;
          console.log('✅ Beautiful verification email sent successfully');
        } else {
          verificationEmailError = verificationResult.error;
          console.error('❌ Verification email failed:', verificationResult.error);
        }

        // Defer welcome email until after verification

      } else {
        console.log('⚠️ Email server not configured, skipping email sending');
        verificationEmailError = 'Email server not configured';
        welcomeEmailError = 'Email server not configured';
      }
    } catch (emailErr) {
      verificationEmailError = emailErr.message;
      welcomeEmailError = emailErr.message;
      console.error('❌ Email sending failed:', emailErr.message);
      // Don't throw error - continue with success response
    }

    return NextResponse.json(
      { 
        message: verificationEmailSent 
          ? "Donor registered successfully! Beautiful verification and welcome emails sent to your inbox." 
          : "Donor registered successfully. Email sending failed (check email configuration).",
        donor: {
          id: donor.id,
          name: donor.name,
          email: donor.email,
          organization: donor.organization,
          status: donor.status
        },
        email_status: {
          verification_email: {
            sent: verificationEmailSent,
            error: verificationEmailError,
            type: "Beautiful HTML verification email"
          },
          welcome_email: {
            sent: welcomeEmailSent,
            error: welcomeEmailError,
            type: "Beautiful HTML welcome email"
          },
          verification_token: verificationEmailSent ? undefined : token // Include token if email failed
        },
        ghl_contact_status: {
          created: ghlContactCreated,
          contact_id: ghlContactId,
          location_id: ghlAccount?.ghl_location_id || null,
          business_name: ghlAccount?.business_name || null,
          error: ghlContactError,
          organization_ghl_available: ghlContactError !== 'No GHL account found for organization',
          created_in_subaccount: ghlContactCreated
        }
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET: Fetch all donors with pagination
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limitParam = searchParams.get('limit');
    const limit = limitParam === 'all' ? undefined : parseInt(limitParam || '10', 10);
    const skip = limit ? (page - 1) * limit : 0;

    const [donors, totalCount] = await Promise.all([
      prisma.donor.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          address: true,
          postal_code: true,
          imageUrl: true,
          status: true,
          created_at: true,
          updated_at: true,
          organization_id: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.donor.count(),
    ]);

    return NextResponse.json({ donors, totalCount }, { status: 200 });
  } catch (error) {
    console.error('Error fetching donors:', error);
    return NextResponse.json({ error: 'Failed to fetch donors' }, { status: 500 });
  }
}