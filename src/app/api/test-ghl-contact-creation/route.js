import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { hash } from "bcryptjs";

export async function POST() {
  try {
    console.log('🧪 Testing GHL Contact Creation API for Corpulate organization...');

    // Step 1: Check if Corpulate organization exists
    console.log('🏢 Step 1: Checking for Corpulate organization...');
    
    let corpulateOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { name: "Corpulate" },
          { email: "contact@corpulate.com" }
        ]
      },
      include: {
        ghlAccounts: {
          select: {
            id: true,
            ghl_location_id: true,
            business_name: true,
            status: true
          }
        }
      }
    });

    if (!corpulateOrg) {
      console.log('📝 Creating Corpulate organization...');
      corpulateOrg = await prisma.organization.create({
        data: {
          name: "Corpulate",
          email: "contact@corpulate.com",
          password: await hash("corpulate123", 10),
          orgPassword: await hash("corpulateorg123", 10),
          phone: "+1234567890",
          company: "Corpulate Inc",
          address: "123 Business Street",
          city: "Business City",
          state: "BC",
          country: "US",
          postalCode: "12345",
          website: "https://corpulate.com",
          status: true,
          balance: 0
        },
        include: {
          ghlAccounts: {
            select: {
              id: true,
              ghl_location_id: true,
              business_name: true,
              status: true
            }
          }
        }
      });
    }

    console.log(`✅ Corpulate organization: ${corpulateOrg.name} (ID: ${corpulateOrg.id})`);
    console.log(`📊 GHL Accounts: ${corpulateOrg.ghlAccounts.length}`);

    // Step 2: Create a test GHL account for Corpulate if none exists
    let ghlAccount = corpulateOrg.ghlAccounts.find(acc => acc.status === "active");
    
    if (!ghlAccount) {
      console.log('🔗 Creating test GHL account for Corpulate...');
      ghlAccount = await prisma.gHLAccount.create({
        data: {
          organization_id: corpulateOrg.id,
          ghl_location_id: `test_location_${Date.now()}`,
          business_name: "Corpulate GHL",
          email: "ghl@corpulate.com",
          phone: "+1234567890",
          address: "123 Business Street",
          city: "Business City",
          state: "BC",
          country: "US",
          postal_code: "12345",
          website: "https://corpulate.com",
          timezone: "America/New_York",
          status: "active"
        }
      });
      console.log(`✅ GHL Account created: ${ghlAccount.ghl_location_id}`);
    } else {
      console.log(`✅ Using existing GHL Account: ${ghlAccount.ghl_location_id}`);
    }

    // Step 3: Create a test donor for Corpulate
    console.log('👤 Step 3: Creating test donor for Corpulate...');
    
    const testDonorEmail = `testdonor_corpulate_${Date.now()}@example.com`;
    const donorData = {
      name: "John Corpulate",
      email: testDonorEmail,
      password: "password123",
      phone: "+1555123456",
      city: "Business City",
      address: "456 Donor Avenue",
      postal_code: "12345",
      organization_id: corpulateOrg.id
    };

    console.log('📤 Creating donor with GHL contact creation...');
    
    // Use the main donor creation API to test GHL integration
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org';
    
    const donorResponse = await fetch(`${baseUrl}/api/donor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donorData)
    });

    const donorResult = await donorResponse.json();

    console.log('📊 Donor creation response:', {
      status: donorResponse.status,
      success: donorResult.message,
      ghl_status: donorResult.ghl_contact_status
    });

    // Step 4: Test the GHL contact creation API directly
    console.log('🔗 Step 4: Testing direct GHL contact creation API...');
    
    const ghlContactData = {
      locationId: ghlAccount.ghl_location_id,
      firstName: "Jane",
      lastName: "Corpulate",
      email: `jane_corpulate_${Date.now()}@example.com`,
      phone: "+1555987654",
      address: "789 Test Street",
      city: "Business City",
      state: "BC",
      country: "US",
      postalCode: "12345",
      source: "ChangeWorks Test",
      tags: ["Test", "Corpulate", "GHL Test"],
      customFields: {
        test_type: "GHL Contact Creation Test",
        organization: "Corpulate",
        created_via: "API Test"
      },
      donor_id: donorResult.donor?.id,
      organization_id: corpulateOrg.id
    };

    const ghlResponse = await fetch(`${baseUrl}/api/ghl/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ghlContactData)
    });

    const ghlResult = await ghlResponse.json();

    console.log('📊 GHL Contact creation response:', {
      status: ghlResponse.status,
      success: ghlResult.success,
      message: ghlResult.message,
      contactId: ghlResult.data?.contactId
    });

    // Step 5: Test bulk contact creation
    console.log('📦 Step 5: Testing bulk GHL contact creation...');
    
    const bulkContactData = {
      donor_id: donorResult.donor?.id,
      locationIds: [ghlAccount.ghl_location_id],
      customFields: {
        test_type: "Bulk Contact Creation Test",
        organization: "Corpulate"
      },
      tags: ["Bulk Test", "Corpulate"]
    };

    const bulkResponse = await fetch(`${baseUrl}/api/ghl/contact/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bulkContactData)
    });

    const bulkResult = await bulkResponse.json();

    console.log('📊 Bulk GHL Contact creation response:', {
      status: bulkResponse.status,
      success: bulkResult.success,
      message: bulkResult.message,
      results: bulkResult.results
    });

    // Step 6: Test auto-create contact API
    console.log('🤖 Step 6: Testing auto-create GHL contact API...');
    
    const autoCreateData = {
      donor_id: donorResult.donor?.id,
      organization_id: corpulateOrg.id,
      use_organization_ghl: true,
      customFields: {
        test_type: "Auto-Create Contact Test",
        organization: "Corpulate"
      },
      tags: ["Auto Test", "Corpulate"]
    };

    const autoCreateResponse = await fetch(`${baseUrl}/api/ghl/contact/auto-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(autoCreateData)
    });

    const autoCreateResult = await autoCreateResponse.json();

    console.log('📊 Auto-create GHL Contact response:', {
      status: autoCreateResponse.status,
      success: autoCreateResult.success,
      message: autoCreateResult.message,
      results: autoCreateResult.results
    });

    // Compile test results
    const testResults = {
      organization: {
        name: corpulateOrg.name,
        id: corpulateOrg.id,
        email: corpulateOrg.email,
        ghl_accounts: corpulateOrg.ghlAccounts.length
      },
      ghl_account: {
        id: ghlAccount.id,
        location_id: ghlAccount.ghl_location_id,
        business_name: ghlAccount.business_name,
        status: ghlAccount.status
      },
      donor_creation: {
        success: donorResponse.ok,
        status: donorResponse.status,
        donor_id: donorResult.donor?.id,
        donor_name: donorResult.donor?.name,
        ghl_contact_created: donorResult.ghl_contact_status?.created,
        ghl_contact_id: donorResult.ghl_contact_status?.contact_id,
        ghl_location_id: donorResult.ghl_contact_status?.location_id,
        ghl_error: donorResult.ghl_contact_status?.error
      },
      direct_ghl_contact: {
        success: ghlResponse.ok,
        status: ghlResponse.status,
        contact_created: ghlResult.success,
        contact_id: ghlResult.data?.contactId,
        error: ghlResult.error
      },
      bulk_ghl_contact: {
        success: bulkResponse.ok,
        status: bulkResponse.status,
        contacts_created: bulkResult.results?.successful || 0,
        contacts_failed: bulkResult.results?.failed || 0,
        error: bulkResult.message
      },
      auto_create_ghl_contact: {
        success: autoCreateResponse.ok,
        status: autoCreateResponse.status,
        contacts_created: autoCreateResult.results?.successful || 0,
        contacts_failed: autoCreateResult.results?.failed || 0,
        error: autoCreateResult.message
      }
    };

    // Determine overall test success
    const overallSuccess = donorResponse.ok && 
                          ghlResponse.ok && 
                          bulkResponse.ok && 
                          autoCreateResponse.ok;

    return NextResponse.json({
      success: overallSuccess,
      message: overallSuccess 
        ? "GHL Contact Creation API test completed successfully!" 
        : "GHL Contact Creation API test completed with some issues",
      test_results: testResults,
      summary: {
        organization_created: !!corpulateOrg,
        ghl_account_available: !!ghlAccount,
        donor_created: donorResponse.ok,
        ghl_contact_created_via_donor: donorResult.ghl_contact_status?.created,
        direct_ghl_contact_created: ghlResult.success,
        bulk_ghl_contact_created: bulkResult.results?.successful > 0,
        auto_create_ghl_contact_created: autoCreateResult.results?.successful > 0
      },
      environment_check: {
        ghl_agency_key_set: !!process.env.GHL_AGENCY_API_KEY,
        ghl_base_url_set: !!process.env.GHL_BASE_URL,
        base_url: process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'
      }
    }, { status: overallSuccess ? 200 : 207 }); // 207 = Multi-Status

  } catch (error) {
    console.error('❌ GHL Contact Creation test error:', error);
    
    return NextResponse.json({
      success: false,
      message: "GHL Contact Creation API test failed",
      error: error.message,
      stack: error.stack,
      possible_causes: [
        "Database connection issue",
        "GHL API key not configured",
        "GHL API endpoint not accessible",
        "Organization or GHL account creation failed"
      ]
    }, { status: 500 });
  }
}
