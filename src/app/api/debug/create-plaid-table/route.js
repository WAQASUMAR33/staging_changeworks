import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST() {
  try {
    // Check if table exists by trying to query it
    try {
      await prisma.$queryRaw`SELECT 1 FROM plaid_connections LIMIT 1`;
      return NextResponse.json({
        success: true,
        message: 'plaid_connections table already exists',
        table_exists: true
      });
    } catch (error) {
      if (error.code === 'P2021') {
        // Table doesn't exist, create it
        console.log('plaid_connections table does not exist, creating it...');
        
        const createTableSQL = `
          CREATE TABLE plaid_connections (
            id int NOT NULL AUTO_INCREMENT,
            donor_id int NOT NULL,
            access_token varchar(255) NOT NULL,
            item_id varchar(255) NOT NULL,
            institution_id varchar(255) DEFAULT NULL,
            institution_name varchar(255) DEFAULT NULL,
            accounts longtext NOT NULL,
            status enum('ACTIVE','INACTIVE','ERROR') NOT NULL DEFAULT 'ACTIVE',
            error_message text DEFAULT NULL,
            created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            KEY plaid_connections_donor_id_idx (donor_id),
            KEY plaid_connections_institution_id_idx (institution_id),
            KEY plaid_connections_status_idx (status),
            CONSTRAINT plaid_connections_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES donors (id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;
        
        await prisma.$executeRawUnsafe(createTableSQL);
        
        return NextResponse.json({
          success: true,
          message: 'plaid_connections table created successfully',
          table_exists: false,
          created: true
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('Error creating plaid_connections table:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create plaid_connections table', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check if table exists
    try {
      await prisma.$queryRaw`SELECT 1 FROM plaid_connections LIMIT 1`;
      return NextResponse.json({
        success: true,
        message: 'plaid_connections table exists',
        table_exists: true
      });
    } catch (error) {
      if (error.code === 'P2021') {
        return NextResponse.json({
          success: true,
          message: 'plaid_connections table does not exist',
          table_exists: false
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('Error checking plaid_connections table:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check plaid_connections table', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
