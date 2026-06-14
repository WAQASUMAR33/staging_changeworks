import { NextResponse } from "next/server";
import { z } from "zod";
import GHLClient from "../../../../lib/ghl-client";
import { prisma } from "../../../../lib/prisma";

// Validation schema for bulk contact creation
const bulkContactSchema = z.object({
  donor_id: z.number().int().positive("Donor ID is required"),
  locationIds: z.array(z.string()).min(1, "At least one location ID is required"),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional()
});

// POST - Create contact in multiple GHL sub-accounts
export async function POST(request) {
  try {
    const body = await request.json();
    const validatedData = bulkContactSchema.parse(body);

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

    // Initialize GHL client with agency key
    const ghlClient = new GHLClient(process.env.GHL_AGENCY_API_KEY);

    const results = [];
    const errors = [];

    // Prepare base contact data
    const baseContactData = {
      firstName: donor.name.split(' ')[0] || donor.name,
      lastName: donor.name.split(' ').slice(1).join(' ') || '',
      email: donor.email,
      phone: donor.phone || '',
      address: donor.address || '',
      city: donor.city || '',
      state: '', // We don't have state in donor data
      country: 'US', // Default country
      postalCode: donor.postal_code || '',
      source: 'ChangeWorks Donor',
      tags: validatedData.tags || ['ChangeWorks', 'Donor', donor.organization.name],
      customFields: {
        donor_id: donor.id,
        organization_id: donor.organization_id,
        organization_name: donor.organization.name,
        created_via: 'ChangeWorks API',
        ...validatedData.customFields
      }
    };

    // Create contact in each location
    for (let i = 0; i < validatedData.locationIds.length; i++) {
      const locationId = validatedData.locationIds[i];
      
      try {
        console.log(`🔗 Creating GHL contact in location ${locationId} for donor ${donor.name}`);
        
        const result = await ghlClient.createContact(
          locationId, 
          baseContactData, 
          process.env.GHL_AGENCY_API_KEY
        );

        if (result.success) {
          results.push({
            locationId: locationId,
            success: true,
            contactId: result.contactId,
            donor: {
              id: donor.id,
              name: donor.name,
              email: donor.email
            }
          });
          console.log(`✅ Contact created successfully in location ${locationId}:`, result.contactId);
        } else {
          errors.push({
            locationId: locationId,
            success: false,
            error: result.error,
            details: result.details,
            donor: {
              id: donor.id,
              name: donor.name,
              email: donor.email
            }
          });
          console.error(`❌ Failed to create contact in location ${locationId}:`, result.error);
        }
      } catch (error) {
        errors.push({
          locationId: locationId,
          success: false,
          error: error.message,
          donor: {
            id: donor.id,
            name: donor.name,
            email: donor.email
          }
        });
        console.error(`❌ Error creating contact in location ${locationId}:`, error.message);
      }

      // Add delay between requests to avoid rate limiting
      if (i < validatedData.locationIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${validatedData.locationIds.length} locations for donor ${donor.name}`,
      donor: {
        id: donor.id,
        name: donor.name,
        email: donor.email,
        organization: donor.organization
      },
      results: {
        successful: results.length,
        failed: errors.length,
        total: validatedData.locationIds.length
      },
      data: {
        successful: results,
        failed: errors
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Bulk GHL contact creation error:', error);

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
