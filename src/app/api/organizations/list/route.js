import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to retry database operations
async function retryDatabaseOperation(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
}

// GET - Fetch all organizations for dropdown
export async function GET() {
  try {
    console.log('🔄 Fetching organizations...');
    
    const organizations = await retryDatabaseOperation(async () => {
      return await prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          status: true
        },
        where: {
          status: true
        },
        orderBy: {
          name: 'asc'
        }
      });
    });

    console.log(`✅ Successfully fetched ${organizations.length} organizations`);
    
    return NextResponse.json({
      success: true,
      organizations: organizations,
      count: organizations.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching organizations after retries:', error);
    
    // Return a more detailed error response
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch organizations',
        details: error.message,
        timestamp: new Date().toISOString(),
        suggestion: 'Please try again in a moment. If the issue persists, contact support.'
      },
      { status: 500 }
    );
  }
}
