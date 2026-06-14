import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Webhook test endpoint is working",
    timestamp: new Date().toISOString(),
    webhook_secret_configured: !!process.env.STRIPE_WEBHOOK_SECRET,
    webhook_secret_length: process.env.STRIPE_WEBHOOK_SECRET?.length || 0
  });
}

export async function POST(request) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    console.log('🔍 Test webhook received:');
    console.log('🔍 Headers:', headers);
    console.log('🔍 Body:', body);
    
    return NextResponse.json({
      message: "Test webhook received successfully",
      timestamp: new Date().toISOString(),
      headers: headers,
      body_length: body.length
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    return NextResponse.json({
      error: 'Test webhook failed',
      message: error.message
    }, { status: 500 });
  }
}
