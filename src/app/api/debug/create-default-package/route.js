import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(request) {
  try {
    // Check if default package already exists
    const existingPackage = await prisma.package.findFirst({
      where: { id: 1 }
    });

    if (existingPackage) {
      return NextResponse.json({
        success: true,
        message: "Default package already exists",
        package: existingPackage
      });
    }

    // Create default package
    const defaultPackage = await prisma.package.create({
      data: {
        id: 1,
        name: "Default Package",
        description: "Default package for Stripe subscriptions",
        price: 0,
        currency: "USD",
        features: "Basic subscription features",
        isActive: true,
        category: "default"
      }
    });

    return NextResponse.json({
      success: true,
      message: "Default package created successfully",
      package: defaultPackage
    });

  } catch (error) {
    console.error("Error creating default package:", error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
