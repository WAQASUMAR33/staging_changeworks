import GHLClient from '../../../lib/ghl-client';

export async function POST(req) {
  // Initialize GHL client
  const ghlClient = new GHLClient();

  const {
    businessName,
    firstName,
    lastName,
    email,
    phone,
    address,
    city,
    state,
    country,
    postalCode,
    website,
    timezone,
    companyId,
    settings
  } = await req.json();

  // Validation
  if (!businessName || !firstName || !lastName || !email) {
    return Response.json({
      success: false,
      message: 'Missing required fields',
      required: ['businessName', 'firstName', 'lastName', 'email']
    }, { status: 400 });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return Response.json({
      success: false,
      message: 'Invalid email format'
    }, { status: 400 });
  }

  const result = await ghlClient.createSubAccount({
    businessName,
    firstName,
    lastName,
    email,
    phone,
    address,
    city,
    state,
    country,
    postalCode,
    website,
    timezone,
    companyId,
    settings
  });

  if (result.success) {
    return Response.json({
      success: true,
      message: 'Sub-account created successfully',
      data: result.data,
      locationId: result.locationId
    }, { status: 201 });
  } else {
    return Response.json({
      success: false,
      message: 'Failed to create sub-account',
      error: result.error,
      details: result.details
    }, { status: result.statusCode || 400 });
  }
}

export async function GET(req) {
  const ghlClient = new GHLClient();
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('locationId');

  if (!locationId) {
    return Response.json({
      success: false,
      message: 'Location ID is required'
    }, { status: 400 });
  }

  const result = await ghlClient.getSubAccount(locationId);

  if (result.success) {
    return Response.json({
      success: true,
      data: result.data
    }, { status: 200 });
  } else {
    return Response.json({
      success: false,
      message: 'Sub-account not found',
      error: result.error
    }, { status: result.statusCode || 404 });
  }
}

export async function PUT(req) {
  const ghlClient = new GHLClient();
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('locationId');
  
  if (!locationId) {
    return Response.json({
      success: false,
      message: 'Location ID is required'
    }, { status: 400 });
  }

  const body = await req.json();
  const result = await ghlClient.updateSubAccount(locationId, body);

  if (result.success) {
    return Response.json({
      success: true,
      message: 'Sub-account updated successfully',
      data: result.data
    }, { status: 200 });
  } else {
    return Response.json({
      success: false,
      message: 'Failed to update sub-account',
      error: result.error
    }, { status: result.statusCode || 400 });
  }
}

export async function DELETE(req) {
  const ghlClient = new GHLClient();
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('locationId');
  
  if (!locationId) {
    return Response.json({
      success: false,
      message: 'Location ID is required'
    }, { status: 400 });
  }

  const result = await ghlClient.deleteSubAccount(locationId);

  if (result.success) {
    return Response.json({
      success: true,
      message: 'Sub-account deleted successfully'
    }, { status: 200 });
  } else {
    return Response.json({
      success: false,
      message: 'Failed to delete sub-account',
      error: result.error
    }, { status: result.statusCode || 400 });
  }
}
