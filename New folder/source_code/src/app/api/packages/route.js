import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

// GET /api/packages - List all packages
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};
    if (isActive !== null) where.isActive = isActive === 'true';
    if (category) where.category = category;

    // Get packages
    const packages = await prisma.package.findMany({
      where,
      orderBy: {
        created_at: 'desc'
      },
      skip,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.package.count({ where });

    return NextResponse.json({
      success: true,
      packages,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching packages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch packages' },
      { status: 500 }
    );
  }
}

// POST /api/packages - Create a new package
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      price,
      currency = 'USD',
      features,
      duration,
      isActive = true,
      category
    } = body;

    // Validate required fields
    if (!name || !description || price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, description, price' },
        { status: 400 }
      );
    }

    // Check if package with same name already exists
    const existingPackage = await prisma.package.findFirst({
      where: { name }
    });

    if (existingPackage) {
      return NextResponse.json(
        { success: false, error: 'Package with this name already exists' },
        { status: 409 }
      );
    }

    // Create package
    const packageData = await prisma.package.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        currency: currency.toUpperCase(),
        features,
        duration,
        isActive,
        category
      }
    });

    return NextResponse.json({
      success: true,
      package: packageData,
      message: 'Package created successfully'
    });

  } catch (error) {
    console.error('Error creating package:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create package' },
      { status: 500 }
    );
  }
}