import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import GHLClient from "../../lib/ghl-client";

// Validation schema
const organizationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").max(100),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url("Invalid url").optional().or(z.literal("")),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  ghlId: z.string().optional(),
  imageUrl: z.string().optional(),
  logo: z.string().optional(), // Base64 encoded logo
  logoUrl: z.string().optional(), // URL returned from PHP API
  // Organization Login Details (single password)
  orgPassword: z.string().min(6, "Organization password must be at least 6 characters"),
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
        imageUrl: input.logoUrl || input.imageUrl, // Use logoUrl if available, fallback to imageUrl
        orgPassword: hashedOrgPassword, // Store same password in orgPassword field
      },
    });

    let ghlAccount = null;
    let ghlLocationId = null;
    let ghlApiKey = null;

    // Automatically create GHL account using organization information
    try {
      // Check if we have a valid GHL Agency API key
      if (!process.env.GHL_AGENCY_API_KEY || process.env.GHL_AGENCY_API_KEY.length < 200) {
        console.log('⚠️ GHL Agency API key not configured or too short. Skipping GHL account creation.');
        console.log('To enable GHL integration, add a valid GHL_AGENCY_API_KEY (250+ characters) to your environment variables.');
        console.log('Current key appears to be a Location API key, which cannot create sub-accounts.');
        throw new Error('GHL Agency API key not configured');
      }
      
      const ghlClient = new GHLClient(process.env.GHL_AGENCY_API_KEY);
      
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

        // Create GHL contact for the organization using ChangeWorks credentials
        try {
          console.log('Creating GHL contact for organization:', organization.id);
          console.log('Using ChangeWorks Location ID:', process.env.CHANGEWORKS_LOCAION_ID);
          console.log('Using ChangeWorks API Key:', process.env.CHANGEWORKS_LOCATION_API_KEY ? `${process.env.CHANGEWORKS_LOCATION_API_KEY.substring(0, 20)}...` : 'NOT SET');
          console.log('Using Contact Create API URL:', process.env.GHL_CONTACT_CREATE_API_URL);
          
          // Prepare contact data for the organization
          const contactData = {
            firstName: input.name.split(' ')[0] || input.name,
            lastName: input.name.split(' ').slice(1).join(' ') || 'Organization',
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

    return NextResponse.json({
      message: "Organization registered successfully",
      organization: {
        ...organization,
        ghlId: ghlLocationId
      },
      ghlAccount: ghlAccount,
      ghlLocationId: ghlLocationId,
      ghlApiKey: ghlApiKey // Include the sub-account API key in response
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
