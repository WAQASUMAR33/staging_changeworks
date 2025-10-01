import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    stripe_publishable_key: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    stripe_secret_key: process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not Set',
    node_env: process.env.NODE_ENV,
  });
}
