import { NextResponse } from "next/server";
import { z } from "zod";
import GHLClient from "../../../lib/ghl-client";
import { prisma } from "../../../lib/prisma";

// Validation schema for contact creation
const contactSchema = z.object({
  locationId: z.string().min(1, "Location ID is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("US"),
  postalCode: z.string().optional(),
  source: z.string().default("ChangeWorks"),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  donor_id: z.number().int().positive().optional(),
  organization_id: z.number().int().positive().optional()
});

// POST - Create contact in GHL sub-account
export async function POST(request) {
  try {
    const body = await request.json();
    const validatedData = contactSchema.parse(body);

    // Initialize GHL client with agency key
    const ghlClient = new GHLClient(process.env.GHL_AGENCY_API_KEY);

    // Prepare contact data for GHL
    const contactData = {
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email,
      phone: validatedData.phone || '',
      address: validatedData.address || '',
      city: validatedData.city || '',
      state: validatedData.state || '',
      country: validatedData.country,
      postalCode: validatedData.postalCode || '',
      source: validatedData.source,
      tags: validatedData.tags || ['ChangeWorks', 'Donor'],
      customFields: validatedData.customFields || {}
    };

    // Add custom fields for donor and organization if provided
    if (validatedData.donor_id) {
      contactData.customFields.donor_id = validatedData.donor_id;
    }
    if (validatedData.organization_id) {
      contactData.customFields.organization_id = validatedData.organization_id;
    }

    console.log('🔗 Creating GHL contact in sub-account:', {
      locationId: validatedData.locationId,
      contact: contactData
    });

    // Create contact in GHL sub-account
    const result = await ghlClient.createContact(
      validatedData.locationId, 
      contactData, 
      process.env.GHL_AGENCY_API_KEY
    );

    if (result.success) {
      // Optionally update donor record with GHL contact ID
      if (validatedData.donor_id) {
        try {
          await prisma.donor.update({
            where: { id: validatedData.donor_id },
            data: {
              // Add GHL contact ID to donor record if you have a field for it
              // ghl_contact_id: result.contactId
            }
          });
        } catch (dbError) {
          console.warn('Could not update donor with GHL contact ID:', dbError.message);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Contact created successfully in GHL sub-account",
        data: {
          contactId: result.contactId,
          locationId: validatedData.locationId,
          contact: {
            firstName: contactData.firstName,
            lastName: contactData.lastName,
            email: contactData.email,
            phone: contactData.phone
          }
        }
      }, { status: 201 });
    } else {
      return NextResponse.json({
        success: false,
        message: "Failed to create contact in GHL sub-account",
        error: result.error,
        details: result.details,
        statusCode: result.statusCode
      }, { status: result.statusCode || 500 });
    }

  } catch (error) {
    console.error('GHL contact creation error:', error);

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

// GET - Get contact from GHL sub-account
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');
    const contactId = searchParams.get('contactId');
    const email = searchParams.get('email');

    if (!locationId) {
      return NextResponse.json({
        success: false,
        message: "Location ID is required"
      }, { status: 400 });
    }

    if (!contactId && !email) {
      return NextResponse.json({
        success: false,
        message: "Either contactId or email is required"
      }, { status: 400 });
    }

    // Initialize GHL client with agency key
    const ghlClient = new GHLClient(process.env.GHL_AGENCY_API_KEY);

    // For now, we'll use the createContact method to check if contact exists
    // In a real implementation, you'd want to add a getContact method to GHLClient
    // This is a placeholder - you'd need to implement the actual GET contact API
    
    return NextResponse.json({
      success: false,
      message: "GET contact functionality not yet implemented",
      suggestion: "Use the contact creation API to create contacts"
    }, { status: 501 });

  } catch (error) {
    console.error('GHL contact retrieval error:', error);
    return NextResponse.json({
      success: false,
      message: "Internal server error",
      error: error.message
    }, { status: 500 });
  }
}