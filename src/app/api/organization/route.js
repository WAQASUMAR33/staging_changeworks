import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import GHLClient from "../../lib/ghl-client";
import { createStripeAccountDirect, createStripeAccountLinkDirect } from "../../lib/stripe-direct-api";
import emailService from "../../lib/email-service";
import { corsHeaders } from '@/app/lib/cors';

// Validation schema
const organizationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email("Invalid email").max(100),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional().or(z.literal("")),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  ghlId: z.string().optional(),
  ein: z.string().min(10, "EIN must be at least 10 characters (including hyphen)"),
  imageUrl: z.string().optional(),
  logo: z.string().optional(), // Base64 encoded logo
  logoUrl: z.string().optional(), // URL returned from PHP API (optional — logo upload may be skipped)
  // Stripe Connect Account Information
  createStripeAccount: z.boolean().optional().default(false),
  // Organization Login Details (single password)
  orgPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, "Password must include uppercase, lowercase, number, and special character"),
  confirmOrgPassword: z.string(),
});

export async function POST(req) {
  try {
    const body = await req.json();
    const input = organizationSchema.parse(body);

    const existing = await prisma.organization.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }

    // Validate organization password confirmation
    if (input.orgPassword !== input.confirmOrgPassword) {
      return NextResponse.json({
        error: "Organization passwords do not match"
      }, { status: 400 });
    }

    const hashedOrgPassword = await hash(input.orgPassword, 10);

    // Create organization first
    const organization = await prisma.organization.create({
      data: {
        name: input.name,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title,
        email: input.email,
        password: hashedOrgPassword, // Use orgPassword as main password
        phone: input.phone,
        company: input.name, // Use organization name as company name
        address: input.address,
        website: input.website,
        city: input.city,
        state: input.state,
        country: input.country,
        postalCode: input.postalCode,
        ghlId: input.ghlId,
        ein: input.ein,
        imageUrl: input.logoUrl || input.imageUrl, // Use logoUrl if available, fallback to imageUrl
        orgPassword: hashedOrgPassword, // Store same password in orgPassword field
      },
    });

    // Send Welcome Email
    let welcomeEmailStatus = 'not_attempted';
    console.log('📧 Preparing to send organization welcome email to:', input.email);
    try {
      const hasEmailConfig =
        process.env.EMAIL_SERVER_HOST &&
        process.env.EMAIL_SERVER_PORT &&
        process.env.EMAIL_SERVER_USER &&
        process.env.EMAIL_SERVER_PASSWORD &&
        process.env.EMAIL_FROM;

      if (!hasEmailConfig) {
        console.warn('⚠️ Email server not configured. Skipping welcome email.');
        welcomeEmailStatus = 'skipped - email not configured';
      } else {
        const dashboardLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://changeworkscollective.org'}/organization/login`;
        
        console.log('📋 Welcome email details:', {
          name: input.name,
          firstName: input.firstName,
          lastName: input.lastName,
          dashboardLink
        });

        const welcomeResult = await emailService.sendOrganizationWelcomeEmail({
          organization: {
            ...organization,
            firstName: input.firstName,
            lastName: input.lastName,
            imageUrl: organization.imageUrl
          },
          dashboardLink
        });

        if (welcomeResult.success) {
          console.log('✅ Organization welcome email sent to:', input.email);
          welcomeEmailStatus = 'sent';
        } else {
          console.error('❌ Failed to send organization welcome email (service error):', welcomeResult.error);
          welcomeEmailStatus = `failed - ${welcomeResult.error}`;
        }
      }
    } catch (welcomeError) {
      console.error('❌ Failed to send organization welcome email (exception):', welcomeError);
      welcomeEmailStatus = `failed - ${welcomeError.message}`;
    }

    let ghlAccount = null;
    let ghlLocationId = null;
    let ghlApiKey = null;

    // Automatically create GHL account using organization information
    try {
      // Check if we have a valid GHL Agency API key
      const ghlAgencyKey = process.env.GHL_AGENCY_API_KEY;

      if (!ghlAgencyKey || ghlAgencyKey.length < 30) {
        console.log('⚠️ GHL Agency API key not configured or too short. Skipping GHL account creation.');
        console.log('To enable GHL integration, add a valid GHL_AGENCY_API_KEY to your environment variables.');
        throw new Error('GHL Agency API key not configured');
      }

      const ghlClient = new GHLClient(ghlAgencyKey);

      const ghlData = {
        businessName: input.name, // Use organization name as business name
        firstName: input.name.split(' ')[0] || input.name,
        lastName: input.name.split(' ').slice(1).join(' ') || '',
        email: input.email,
        phone: input.phone || '',
        address: input.address || '',
        city: input.city || '',
        state: input.state || '',
        country: input.country || 'GB',
        postalCode: input.postalCode || '',
        website: input.website || '',
        timezone: 'Europe/London', // Default timezone
        companyId: 'HegBO6PzXMfyDn0yFiFn' // Use the provided GHL ID
      };

      console.log('Creating GHL account for organization:', organization.id);
      const ghlResult = await ghlClient.createSubAccount(ghlData);

      if (ghlResult.success) {
        ghlLocationId = ghlResult.locationId;
        ghlApiKey = ghlResult.data.apiKey; // Extract the sub-account API key

        console.log('GHL Location ID:', ghlLocationId);
        console.log('GHL API Key:', ghlApiKey ? `${ghlApiKey.substring(0, 20)}...` : 'NOT FOUND');

        // Save GHL account details to database
        ghlAccount = await prisma.gHLAccount.create({
          data: {
            organization_id: organization.id,
            ghl_location_id: ghlLocationId,
            business_name: input.name, // Use organization name as business name
            email: input.email,
            phone: input.phone,
            address: input.address,
            city: input.city,
            state: input.state,
            country: input.country,
            postal_code: input.postalCode,
            website: input.website,
            timezone: 'Europe/London',
            ghl_data: JSON.stringify(ghlResult.data),
            api_key: ghlApiKey, // Store the sub-account API key
            status: 'active'
          }
        });

        // Update organization with GHL location ID and API key
        await prisma.organization.update({
          where: { id: organization.id },
          data: {
            ghlId: ghlLocationId,
            ghlApiKey: ghlApiKey
          }
        });

        console.log('GHL account created successfully:', ghlLocationId);

        // Create GHL User for the new sub-account
        try {
          console.log('Creating GHL User for location:', ghlLocationId);
          // Use GHL_COMPANY_ID from env, or fallback to the one used for sub-account if needed
          const companyId = process.env.GHL_COMPANY_ID || 'BWID4bp77xwMfmzh1iud';
          
          const ghlLastName = input.lastName || input.name.split(' ').slice(1).join(' ') || 'Admin';

          const userData = {
             companyId: companyId,
             firstName: input.firstName || input.name.split(' ')[0] || input.name,
             lastName: ghlLastName,
             email: input.email,
             password: input.orgPassword, 
             // phone: input.phone || '', // Removed to prevent empty string issues
             locationId: ghlLocationId,
             type: 'account',
             role: 'admin',
             permissions: {
                campaignsEnabled: true,
                campaignsReadOnly: false,
                contactsEnabled: true,
                contactsReadOnly: false,
                funnelsEnabled: true,
                funnelsReadOnly: false,
                triggersEnabled: true,
                triggersReadOnly: false,
                opportunitiesEnabled: true,
                opportunitiesReadOnly: false,
                conversationsEnabled: true,
                conversationsReadOnly: false,
                onlineListingsEnabled: true,
                onlineListingsReadOnly: false,
                settingsEnabled: true,
                settingsReadOnly: false,
                tagsEnabled: true,
                tagsReadOnly: false,
                leadValueEnabled: true,
                leadValueReadOnly: false,
                marketingEnabled: true,
                marketingReadOnly: false,
                agentReportingEnabled: true,
                agentReportingReadOnly: false,
                botServiceEnabled: true,
                botServiceReadOnly: false,
                socialPlannerEnabled: true,
                socialPlannerReadOnly: false,
                bloggingEnabled: true,
                bloggingReadOnly: false,
                invoiceEnabled: true,
                invoiceReadOnly: false,
                affiliateManagerEnabled: true,
                affiliateManagerReadOnly: false,
                contentAiEnabled: true,
                contentAiReadOnly: false,
                refundsEnabled: true,
                refundsReadOnly: false,
                recordPaymentEnabled: true,
                recordPaymentReadOnly: false,
                cancelSubscriptionEnabled: true,
                cancelSubscriptionReadOnly: false
             }
          };
          
          // Only add phone if it has a value to avoid GHL validation errors with empty strings
          if (input.phone) {
            userData.phone = input.phone;
          }

          console.log('Creating GHL User with data (password hidden):', { ...userData, password: '***' });

          const userResult = await ghlClient.createUser(userData);
          if (userResult.success) {
             console.log('✅ GHL User created successfully:', userResult.userId);
          } else {
             console.error('❌ Failed to create GHL User:', userResult.error);
             
             // Check if the user already exists (likely due to reused email)
             // We can check by error message or status code if provided, but safe to just search by email
             console.log('🔄 Attempting to find existing user by email to update permissions...');
             const searchResult = await ghlClient.getUserByEmail(userData.email);
             
             if (searchResult.success && searchResult.user && searchResult.user.id) {
               console.log('✅ Found existing GHL User:', searchResult.user.id);
               console.log('Current user locations:', searchResult.user.roles?.locationIds || []);
               
               // Prepare update data - merge existing locations with new one
               const existingLocations = searchResult.user.roles?.locationIds || [];
               const newLocationIds = [...new Set([...existingLocations, ghlLocationId])];
               
               const updateData = {
                 ...userData,
                 locationIds: newLocationIds
                 // Note: We are using the password provided in signup. 
                 // If the user already exists, this will update their password.
                 // This is generally acceptable for a "Signup" flow where the user expects to set these credentials.
               };
               
               console.log('Updating user with new location list:', newLocationIds);
               const updateResult = await ghlClient.updateUser(searchResult.user.id, updateData);
               
               if (updateResult.success) {
                 console.log('✅ GHL User updated successfully with new location:', updateResult.userId);
               } else {
                 console.error('❌ Failed to update existing GHL User:', updateResult.error);
               }
             } else {
               console.error('❌ Could not find existing user to update. User creation failed permanently.');
               console.error('User creation details:', JSON.stringify(userResult.details, null, 2));
               if (userResult.error && userResult.error.toLowerCase().includes('password')) {
                 console.error('⚠️ Password might not meet GHL complexity requirements (8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char).');
               }
             }
          }
        } catch (userErr) {
           console.error('❌ Exception creating GHL User:', userErr);
        }

        // Create GHL contact for the organization using ChangeWorks credentials
        try {
          console.log('Creating GHL contact for organization:', organization.id);
          console.log('Using ChangeWorks Location ID:', process.env.CHANGEWORKS_LOCAION_ID);
          console.log('Using ChangeWorks API Key:', process.env.CHANGEWORKS_LOCATION_API_KEY ? `${process.env.CHANGEWORKS_LOCATION_API_KEY.substring(0, 20)}...` : 'NOT SET');
          console.log('Using Contact Create API URL:', process.env.GHL_CONTACT_CREATE_API_URL);

          // Prepare contact data for the organization
          const contactData = {
            firstName: input.firstName || input.name.split(' ')[0] || input.name,
            lastName: input.lastName || input.name.split(' ').slice(1).join(' ') || 'Organization',
            email: input.email,
            phone: input.phone || '',
            address: input.address || '',
            city: input.city || '',
            state: input.state || '',
            country: input.country || 'GB',
            postalCode: input.postalCode || '',
            source: 'ChangeWorks',
            tags: ['ChangeWorks', 'Organization', 'Admin'],
            customFields: {
              organization_id: organization.id,
              organization_name: input.name,
              organization_email: input.email,
              organization_phone: input.phone || '',
              organization_website: input.website || '',
              organization_address: input.address || '',
              organization_city: input.city || '',
              organization_state: input.state || '',
              organization_country: input.country || 'GB',
              organization_postal_code: input.postalCode || '',
              ghl_location_id: ghlLocationId,
              created_via: 'ChangeWorks Organization Registration',
              created_at: new Date().toISOString(),
              organization_status: 'Active',
              registration_source: 'Web Signup'
            }
          };

          console.log('Contact data prepared:', JSON.stringify(contactData, null, 2));

          // Create contact using ChangeWorks GHL client
          const changeWorksGhlClient = new GHLClient(process.env.CHANGEWORKS_LOCATION_API_KEY);
          let contactResult = await changeWorksGhlClient.createContact(
            process.env.CHANGEWORKS_LOCAION_ID,
            contactData
          );

          console.log('Contact creation result:', contactResult);

          // If GHL client fails, try direct API call as fallback
          if (!contactResult.success) {
            console.log('GHL client failed, trying direct API call...');

            try {
              const directApiUrl = process.env.GHL_CONTACT_CREATE_API_URL || 'https://rest.gohighlevel.com/v1/contacts/';
              const directApiKey = process.env.CHANGEWORKS_LOCATION_API_KEY; // Use ChangeWorks API key

              console.log('Direct API URL:', directApiUrl);
              console.log('Using ChangeWorks API key:', directApiKey ? `${directApiKey.substring(0, 20)}...` : 'NOT SET');

              const directResponse = await fetch(directApiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${directApiKey}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Version': '2021-07-28',
                  'Location-Id': process.env.CHANGEWORKS_LOCAION_ID
                },
                body: JSON.stringify({
                  firstName: contactData.firstName,
                  lastName: contactData.lastName,
                  email: contactData.email,
                  phone: contactData.phone,
                  address: contactData.address,
                  city: contactData.city,
                  state: contactData.state,
                  country: contactData.country,
                  postalCode: contactData.postalCode,
                  source: contactData.source,
                  tags: contactData.tags,
                  customFields: contactData.customFields
                })
              });

              console.log('Direct API response status:', directResponse.status);
              const directData = await directResponse.json();
              console.log('Direct API response data:', directData);

              if (directResponse.ok) {
                contactResult = {
                  success: true,
                  contactId: directData.id || directData.contactId,
                  data: directData
                };
                console.log('✅ GHL contact created successfully via direct API:', contactResult.contactId);
              } else {
                console.error('❌ Direct API contact creation failed:', directData);
                contactResult = {
                  success: false,
                  error: directData.message || 'Direct API call failed',
                  details: directData,
                  statusCode: directResponse.status
                };
              }
            } catch (directError) {
              console.error('❌ Direct API contact creation error:', directError);
              contactResult = {
                success: false,
                error: directError.message,
                details: directError
              };
            }
          } else {
            console.log('✅ GHL contact created successfully via client:', contactResult.contactId);
          }
        } catch (contactError) {
          console.error('❌ GHL contact creation error:', contactError);
          console.error('Contact error stack:', contactError.stack);
          // Don't fail the entire signup if contact creation fails
        }
      } else {
        console.error('GHL account creation failed:', ghlResult.error);
      }
    } catch (ghlError) {
      console.error('GHL integration error:', ghlError);
      // Don't fail the entire signup if GHL creation fails
    }

    // Create Stripe Connect account if requested
    let stripeAccount = null;
    let stripeAccountLink = null;
    let emailSentStatus = null; // Track email sending status

    if (input.createStripeAccount) {
      try {
        const { getStripeSecretKey } = await import('@/app/lib/payment-mode');
        const stripeSecretKey = await getStripeSecretKey();

        if (!stripeSecretKey) {
          console.log('⚠️ Stripe not configured. Skipping Stripe Connect account creation.');
        } else {
          console.log('🔵 Creating Stripe Connect account for organization:', organization.id);

          // Create Stripe Connect Express account using direct API
          const accountResult = await createStripeAccountDirect(organization.country || 'US');

          if (!accountResult.success) {
            console.error('❌ Failed to create Stripe Connect account:', accountResult.error);
            console.error('Error details:', accountResult.details);

            // Return error to client
            return NextResponse.json({
              message: "Organization registered, but Stripe account creation failed",
              organization: {
                ...organization,
                ghlId: ghlLocationId,
                stripeAccountId: null,
              },
              ghlAccount: ghlAccount,
              warning: `Stripe API Error: ${accountResult.error}`,
              stripeError: accountResult.error,
            }, { status: 201 });
          } else {
            stripeAccount = accountResult.account;

            // Update organization with Stripe Connect account ID
            await prisma.organization.update({
              where: { id: organization.id },
              data: {
                stripeAccountId: stripeAccount.id,
              }
            });

            console.log('✅ Stripe Connect account created and stored successfully');
            console.log('  - Account ID:', stripeAccount.id);

            // Generate onboarding link
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const refreshUrl = `${baseUrl}/organization/dashboard/stripe-products`;
            const returnUrl = `${baseUrl}/organization/dashboard/stripe-products`;

            const linkResult = await createStripeAccountLinkDirect(
              stripeAccount.id,
              refreshUrl,
              returnUrl
            );

            if (!linkResult.success) {
              console.error('❌ Failed to create Stripe onboarding link:', linkResult.error);
              console.error('Error details:', linkResult.details);
              // Don't fail the entire signup if link creation fails
            } else {
              stripeAccountLink = linkResult.accountLink;
              console.log('✅ Stripe onboarding link created successfully');
              console.log('  - Onboarding URL:', stripeAccountLink.url);

              // Send onboarding email to organization
              try {
                // Check if email is configured before attempting to send
                const hasEmailConfig =
                  process.env.EMAIL_SERVER_HOST &&
                  process.env.EMAIL_SERVER_PORT &&
                  process.env.EMAIL_SERVER_USER &&
                  process.env.EMAIL_SERVER_PASSWORD &&
                  process.env.EMAIL_FROM;

                if (!hasEmailConfig) {
                  console.warn('⚠️ Email server not configured. Skipping email send.');
                  console.warn('Missing email configuration. Please set: EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_SERVER_USER, EMAIL_SERVER_PASSWORD, EMAIL_FROM');
                  emailSentStatus = 'skipped - email not configured';
                } else {
                  console.log('📧 Attempting to send Stripe onboarding email to:', organization.email);
                  const emailResult = await emailService.sendStripeOnboardingEmail({
                    organization: {
                      name: organization.name,
                      email: organization.email
                    },
                    onboardingUrl: stripeAccountLink.url
                  });

                  if (emailResult.success) {
                    console.log('✅ Stripe onboarding email sent successfully to:', organization.email);
                    console.log('   Message ID:', emailResult.messageId);
                    emailSentStatus = 'sent';
                  } else {
                    console.error('❌ Failed to send Stripe onboarding email:', emailResult.error);
                    console.error('   Email error details:', JSON.stringify(emailResult, null, 2));
                    emailSentStatus = `failed - ${emailResult.error}`;
                  }
                }
              } catch (emailError) {
                console.error('❌ Error sending Stripe onboarding email:', emailError);
                console.error('   Error stack:', emailError.stack);
                emailSentStatus = `failed - ${emailError.message}`;
                // Don't fail the entire signup if email fails
              }
            }
          }
        }
      } catch (connectError) {
        console.error('❌ Stripe Connect account creation error:', connectError);
        console.error('Stripe Connect error details:', connectError.message);

        // Return the error to the client so they know why Stripe is failing
        return NextResponse.json({
          message: "Organization registered, but Stripe account creation failed",
          organization: {
            ...organization,
            ghlId: ghlLocationId,
            stripeAccountId: null,
          },
          ghlAccount: ghlAccount,
          warning: `Stripe account creation failed: ${connectError.message}. Please check your Stripe configuration.`,
          stripeError: connectError.message,
          // Still return success status as organization WAS created
        }, { status: 201 });
      }
    }

    return NextResponse.json({
      message: "Organization registered successfully",
      organization: {
        ...organization,
        ghlId: ghlLocationId,
        stripeAccountId: stripeAccount?.id || null,
      },
      ghlAccount: ghlAccount,
      ghlLocationId: ghlLocationId,
      ghlApiKey: ghlApiKey, // Include the sub-account API key in response
      stripeAccount: stripeAccount ? {
        id: stripeAccount.id,
        type: stripeAccount.type,
        onboardingUrl: stripeAccountLink?.url || null,
        onboardingLinkExpiresAt: stripeAccountLink?.expires_at ? new Date(stripeAccountLink.expires_at * 1000).toISOString() : null,
      } : null,
      // Include onboarding link in response so user can access it even if email fails
      stripeOnboardingLink: stripeAccountLink?.url || null,
      emailSent: emailSentStatus || (stripeAccountLink ? 'skipped - not requested' : null),
      welcomeEmailStatus: welcomeEmailStatus,
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



export async function GET() {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { created_at: "desc" }
    });

    return NextResponse.json({ organizations }, { status: 200 });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
