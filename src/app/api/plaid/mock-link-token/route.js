import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(request) {
  try {
    // Verify JWT token
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    // Get organization_id from request body
    const { organization_id } = await request.json();
    if (!organization_id) {
      return NextResponse.json({ success: false, error: 'Organization ID is required' }, { status: 400 });
    }

    // Generate a mock link token for testing
    const mockLinkToken = `link-sandbox-mock-${Date.now()}-${donorId}-${organization_id}`;

    console.log('Generated mock link token for testing:', mockLinkToken);

    return NextResponse.json({
      success: true,
      link_token: mockLinkToken,
      is_mock: true,
      message: 'Mock link token generated for testing purposes'
    });

  } catch (error) {
    console.error('Error creating mock Plaid link token:', error);
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to create mock link token', details: error.message },
      { status: 500 }
    );
  }
}
