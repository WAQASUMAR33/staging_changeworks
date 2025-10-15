import { NextResponse } from "next/server";
import GHLClient from "../../lib/ghl-client";

export async function POST(request) {
  try {
    const body = await request.json();
    const { apiKey, testData } = body;

    if (!apiKey) {
      return NextResponse.json({ 
        error: "API key is required" 
      }, { status: 400 });
    }

    // Default test data if not provided
    const defaultTestData = {
      businessName: "Test Organization",
      firstName: "Test",
      lastName: "Organization",
      email: "test@example.com",
      phone: "1234567890",
      address: "123 Test Street",
      city: "Test City",
      state: "Test State",
      country: "US",
      postalCode: "12345",
      website: "https://test.com",
      timezone: "America/New_York",
      companyId: "HegBO6PzXMfyDn0yFiFn"
    };

    const ghlData = testData || defaultTestData;

    console.log('=== GHL TEST REQUEST ===');
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT PROVIDED');
    console.log('Key Length:', apiKey ? apiKey.length : 0);
    console.log('Test Data:', JSON.stringify(ghlData, null, 2));

    // Test the API key
    const ghlClient = new GHLClient(apiKey);
    
    // Try to create a test sub-account
    const result = await ghlClient.createSubAccount(ghlData);

    console.log('=== GHL TEST RESULT ===');
    console.log('Success:', result.success);
    console.log('Error:', result.error);
    console.log('Status Code:', result.statusCode);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "GHL API key is valid and can create sub-accounts",
        data: {
          locationId: result.locationId,
          keyLength: apiKey.length,
          keyType: apiKey.length > 200 ? "Agency/Location API Key" : "Personal Access Token"
        }
      }, { status: 200 });
    } else {
      return NextResponse.json({
        success: false,
        error: "GHL API key test failed",
        details: result.error,
        statusCode: result.statusCode,
        keyLength: apiKey.length,
        keyType: apiKey.length > 200 ? "Agency/Location API Key" : "Personal Access Token",
        troubleshooting: {
          "Invalid JWT": "The API key is expired, invalid, or not the right type",
          "401 Unauthorized": "The API key doesn't have permission to create sub-accounts",
          "403 Forbidden": "The API key is a Location key, not an Agency key",
          "Key too short": "Need an Agency API key (250+ characters) for sub-account creation"
        }
      }, { status: 400 });
    }

  } catch (error) {
    console.error("GHL test error:", error);
    
    return NextResponse.json({ 
      success: false,
      error: "Test failed",
      details: error.message
    }, { status: 500 });
  }
}

// GET endpoint to show test instructions
export async function GET() {
  return NextResponse.json({
    message: "GHL API Key Test Endpoint",
    instructions: {
      method: "POST",
      endpoint: "/api/test-ghl",
      body: {
        apiKey: "your_ghl_api_key_here",
        testData: {
          businessName: "Test Organization",
          firstName: "Test",
          lastName: "Organization", 
          email: "test@example.com",
          phone: "1234567890",
          address: "123 Test Street",
          city: "Test City",
          state: "Test State",
          country: "US",
          postalCode: "12345",
          website: "https://test.com",
          timezone: "America/New_York",
          companyId: "HegBO6PzXMfyDn0yFiFn"
        }
      }
    },
    keyTypes: {
      "Personal Access Token": "~50 chars, pit-xxxxxxxx format, cannot create sub-accounts",
      "Location API Key": "~200-300 chars, JWT format, cannot create sub-accounts", 
      "Agency API Key": "250+ chars, JWT format, CAN create sub-accounts"
    }
  });
}
