import { NextResponse } from "next/server";
import { z } from "zod";

// Import mock data from the main packages route
const mockPackages = [
  {
    id: 1,
    name: "Basic Plan",
    description: "Perfect for small organizations getting started with our platform",
    price: 29.99,
    currency: "USD",
    features: [
      "Up to 100 donors",
      "Basic reporting",
      "Email support",
      "Standard templates"
    ],
    duration: "1 month",
    isActive: true,
    category: "basic",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    name: "Premium Plan",
    description: "Advanced features for growing organizations with more complex needs",
    price: 79.99,
    currency: "USD",
    features: [
      "Up to 500 donors",
      "Advanced reporting & analytics",
      "Priority support",
      "Custom templates",
      "API access",
      "Advanced integrations"
    ],
    duration: "1 month",
    isActive: true,
    category: "premium",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 3,
    name: "Enterprise Plan",
    description: "Full-featured solution for large organizations with unlimited needs",
    price: 199.99,
    currency: "USD",
    features: [
      "Unlimited donors",
      "Custom reporting & dashboards",
      "24/7 dedicated support",
      "White-label options",
      "Full API access",
      "All integrations",
      "Custom development",
      "Advanced security features"
    ],
    duration: "1 month",
    isActive: true,
    category: "enterprise",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const updatePackageSchema = z.object({
  name: z.string().min(1, "Package name is required").optional(),
  description: z.string().min(1, "Package description is required").optional(),
  price: z.number().positive("Price must be positive").optional(),
  currency: z.string().optional(),
  features: z.array(z.string()).optional(),
  duration: z.string().optional(),
  isActive: z.boolean().optional(),
  category: z.string().optional(),
});

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const packageId = parseInt(id);

    if (isNaN(packageId)) {
      return NextResponse.json({ error: "Invalid package ID" }, { status: 400 });
    }

    const packageData = mockPackages.find(pkg => pkg.id === packageId);

    if (!packageData) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      package: packageData,
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching package:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const packageId = parseInt(id);

    if (isNaN(packageId)) {
      return NextResponse.json({ error: "Invalid package ID" }, { status: 400 });
    }

    const body = await req.json();
    const input = updatePackageSchema.parse(body);

    // Find package index
    const packageIndex = mockPackages.findIndex(pkg => pkg.id === packageId);

    if (packageIndex === -1) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Update package
    const updatedPackage = {
      ...mockPackages[packageIndex],
      ...input,
      updated_at: new Date().toISOString()
    };

    mockPackages[packageIndex] = updatedPackage;

    return NextResponse.json({
      success: true,
      message: "Package updated successfully",
      package: updatedPackage,
    }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating package:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const packageId = parseInt(id);

    if (isNaN(packageId)) {
      return NextResponse.json({ error: "Invalid package ID" }, { status: 400 });
    }

    // Find package index
    const packageIndex = mockPackages.findIndex(pkg => pkg.id === packageId);

    if (packageIndex === -1) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Remove package from mock data
    mockPackages.splice(packageIndex, 1);

    return NextResponse.json({
      success: true,
      message: "Package deleted successfully",
    }, { status: 200 });
  } catch (error) {
    console.error("Error deleting package:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
