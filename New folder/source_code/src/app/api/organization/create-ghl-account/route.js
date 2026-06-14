import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import GHLClient from "../../../lib/ghl-client";

export async function POST(request) {
  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ 
        error: "Organization ID is required" 
      }, { status: 400 });
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: parseInt(organizationId) },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        website: true,
        ghlId: true
      }
    });

    if (!organization) {
      return NextResponse.json({ 
        error: "Organization not found" 
      }, { status: 404 });
    }

    // Check if organization already has GHL account
    if (organization.ghlId) {
      return NextResponse.json({ 
        error: "Organization already has a GHL account",
        ghlId: organization.ghlId
      }, { status: 400 });
    }

    // Check if we have a valid GHL Agency API key
    if (!process.env.GHL_AGENCY_API_KEY || process.env.GHL_AGENCY_API_KEY.length < 200) {
      return NextResponse.json({ 
        error: "GHL Agency API key not configured. Please add a valid GHL_AGENCY_API_KEY (250+ characters) to your environment variables.",
        details: "To enable GHL integration, you need an Agency API key from GoHighLevel with sub-account creation permissions."
      }, { status: 400 });
    }

    console.log('Creating GHL account for organization:', organization.id);

    // Create GHL account
    const ghlClient = new GHLClient(process.env.GHL_AGENCY_API_KEY);
    
    const ghlData = {
      businessName: organization.name,
      firstName: organization.name.split(' ')[0] || organization.name,
      lastName: organization.name.split(' ').slice(1).join(' ') || '',
      email: organization.email,
      phone: organization.phone || '',
      address: organization.address || '',
      city: organization.city || '',
      state: organization.state || '',
      country: organization.country || 'GB',
      postalCode: organization.postalCode || '',
      website: organization.website || '',
      timezone: 'Europe/London',
      companyId: 'HegBO6PzXMfyDn0yFiFn'
    };

    const ghlResult = await ghlClient.createSubAccount(ghlData);

    if (ghlResult.success) {
      const ghlLocationId = ghlResult.locationId;
      
      // Save GHL account details to database
      const ghlAccount = await prisma.gHLAccount.create({
        data: {
          organization_id: organization.id,
          ghl_location_id: ghlLocationId,
          business_name: organization.name,
          email: organization.email,
          phone: organization.phone,
          address: organization.address,
          city: organization.city,
          state: organization.state,
          country: organization.country,
          postal_code: organization.postalCode,
          website: organization.website,
          timezone: 'Europe/London',
          ghl_data: JSON.stringify(ghlResult.data),
          status: 'active'
        }
      });

      // Update organization with GHL location ID
      await prisma.organization.update({
        where: { id: organization.id },
        data: { ghlId: ghlLocationId }
      });

      console.log('✅ GHL account created successfully:', ghlLocationId);

      return NextResponse.json({
        success: true,
        message: "GHL account created successfully",
        ghlAccount: ghlAccount,
        ghlLocationId: ghlLocationId
      }, { status: 201 });

    } else {
      console.error('❌ GHL account creation failed:', ghlResult.error);
      
      return NextResponse.json({
        success: false,
        error: "GHL account creation failed",
        details: ghlResult.error,
        statusCode: ghlResult.statusCode
      }, { status: 500 });
    }

  } catch (error) {
    console.error("GHL account creation error:", error);
    
    return NextResponse.json({ 
      success: false,
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}
