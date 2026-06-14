import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";

export async function GET(request) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    // Get donor information
    const donor = await prisma.donor.findUnique({
      where: { id: donorId }
    });

    if (!donor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    // Get donor settings (mock data for now - in real app, you'd have a settings table)
    const settings = {
      notifications: {
        email: true,
        donationReminders: true,
        impactReports: true,
        newsletters: false,
        marketing: false
      },
      privacy: {
        profileVisibility: 'private',
        showDonationAmount: false,
        allowContact: false
      },
      preferences: {
        currency: 'USD',
        language: 'en',
        timezone: 'America/New_York'
      }
    };

    return NextResponse.json({
      success: true,
      settings
    });

  } catch (error) {
    console.error("Settings fetch error:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    // Get donor information
    const donor = await prisma.donor.findUnique({
      where: { id: donorId }
    });

    if (!donor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    const body = await request.json();
    const { settings } = body;

    // In a real application, you would save these settings to a database
    // For now, we'll just return success
    console.log('Settings updated for donor:', donorId, settings);

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully"
    });

  } catch (error) {
    console.error("Settings update error:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
