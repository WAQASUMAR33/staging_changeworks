import { NextResponse } from "next/server";
import { z } from "zod";
import GHLClient from "../../../../lib/ghl-client";
import { prisma } from "../../../../lib/prisma";

// Validation schema for auto contact creation
const autoCreateSchema = z.object({
  donor_id: z.number().int().positive("Donor ID is required"),
  organization_id: z.number().int().positive("Organization ID is required").optional(),
  use_organization_ghl: z.boolean().default(true),
  additional_location_ids: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional()
});

// POST - Automatically create GHL contacts for a donor
export async function POST(request) {
  try {
    const body = await request.json();
    const validatedData = autoCreateSchema.parse(body);

    // Get donor information
    const donor = await prisma.donor.findUnique({
      where: { id: validatedData.donor_id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!donor) {
      return NextResponse.json({
        success: false,
        message: "Donor not found",
        donor_id: validatedData.donor_id
      }, { status: 404 });
    }

    // Get organization's GHL accounts
    let ghlAccounts = [];
    if (validatedData.use_organization_ghl) {
      ghlAccounts = await prisma.gHLAccount.findMany({
        where: { 
          organization_id: validatedData.organization_id || donor.organization_id 
        },
        select: {
          id: true,
          ghl_location_id: true,
          business_name: true,
          organization_id: true
        }
      });
    }

    // Combine organization GHL accounts with additional location IDs
    const allLocationIds = [
      ...ghlAccounts.map(account => account.ghl_location_id),
      ...(validatedData.additional_location_ids || [])
    ].filter(Boolean);

    if (allLocationIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No GHL locations found for contact creation",
        donor: {
          id: donor.id,
          name: donor.name,
          email: donor.email,
          organization_id: donor.organization_id
        },
        suggestion: "Ensure the organization has GHL accounts configured or provide additional_location_ids"
      }, { status: 400 });
    }

    // Initialize GHL client with agency key
    const ghlClient = new GHLClient(process.env.GHL_AGENCY_API_KEY);

    const results = [];
    const errors = [];

    // Prepare contact data
    const contactData = {
      firstName: donor.name.split(' ')[0] || donor.name,
      lastName: donor.name.split(' ').slice(1).join(' ') || '',
      email: donor.email,
      phone: donor.phone || '',
      address: donor.address || '',
      city: donor.city || '',
      state: '', // We don't have state in donor data
      country: 'US', // Default country
      postalCode: donor.postal_code || '',
      source: 'ChangeWorks Auto-Create',
      tags: validatedData.tags || [
        'ChangeWorks', 
        'Donor', 
        'Auto-Created',
        donor.organization.name
      ],
      customFields: {
        donor_id: donor.id,
        organization_id: donor.organization_id,
        organization_name: donor.organization.name,
        created_via: 'ChangeWorks Auto-Create API',
        created_at: new Date().toISOString(),
        ...validatedData.customFields
      }
    };

    // Create contact in each location
    for (let i = 0; i < allLocationIds.length; i++) {
      const locationId = allLocationIds[i];
      
      try {
        console.log(`🔗 Auto-creating GHL contact in location ${locationId} for donor ${donor.name}`);
        
        const result = await ghlClient.createContact(
          locationId, 
          contactData, 
          process.env.GHL_AGENCY_API_KEY
        );

        if (result.success) {
          results.push({
            locationId: locationId,
            success: true,
            contactId: result.contactId,
            business_name: ghlAccounts.find(acc => acc.ghl_location_id === locationId)?.business_name || 'Unknown'
          });
          console.log(`✅ Auto-created contact successfully in location ${locationId}:`, result.contactId);
        } else {
          errors.push({
            locationId: locationId,
            success: false,
            error: result.error,
            details: result.details,
            business_name: ghlAccounts.find(acc => acc.ghl_location_id === locationId)?.business_name || 'Unknown'
          });
          console.error(`❌ Failed to auto-create contact in location ${locationId}:`, result.error);
        }
      } catch (error) {
        errors.push({
          locationId: locationId,
          success: false,
          error: error.message,
          business_name: ghlAccounts.find(acc => acc.ghl_location_id === locationId)?.business_name || 'Unknown'
        });
        console.error(`❌ Error auto-creating contact in location ${locationId}:`, error.message);
      }

      // Add delay between requests to avoid rate limiting
      if (i < allLocationIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update donor record with GHL contact creation status
    try {
      await prisma.donor.update({
        where: { id: donor.id },
        data: {
          // You can add a field to track GHL contact creation status
          // ghl_contacts_created: results.length,
          // ghl_contact_creation_date: new Date()
        }
      });
    } catch (dbError) {
      console.warn('Could not update donor with GHL contact creation status:', dbError.message);
    }

    return NextResponse.json({
      success: true,
      message: `Auto-created GHL contacts for donor ${donor.name}`,
      donor: {
        id: donor.id,
        name: donor.name,
        email: donor.email,
        organization: donor.organization
      },
      ghl_accounts_used: ghlAccounts.map(acc => ({
        id: acc.id,
        location_id: acc.ghl_location_id,
        business_name: acc.business_name
      })),
      results: {
        successful: results.length,
        failed: errors.length,
        total: allLocationIds.length
      },
      data: {
        successful: results,
        failed: errors
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Auto GHL contact creation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        message: "Validation error",
        errors: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      message: "Internal server error",
      error: error.message
    }, { status: 500 });
  }
}
