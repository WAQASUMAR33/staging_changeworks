import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (token) {
      // Check specific token
      const verificationToken = await prisma.donorVerificationToken.findFirst({
        where: { token: token }
      });
      
      const donor = verificationToken ? await prisma.donor.findUnique({
        where: { email: verificationToken.identifier }
      }) : null;
      
      return NextResponse.json({
        success: true,
        token: verificationToken,
        donor: donor ? {
          id: donor.id,
          name: donor.name,
          email: donor.email,
          status: donor.status
        } : null
      });
    } else {
      // List all tokens
      const tokens = await prisma.donorVerificationToken.findMany({
        orderBy: { expires: 'desc' },
        take: 10
      });
      
      return NextResponse.json({
        success: true,
        tokens: tokens
      });
    }
  } catch (error) {
    console.error('Debug verification tokens error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
