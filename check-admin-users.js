const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAdminUsers() {
  try {
    console.log('🔍 Checking admin users in database...');
    
    // Check users table for admin roles
    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'SUPERADMIN', 'MANAGER']
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        created_at: true
      }
    });
    
    console.log(`\n📊 Found ${adminUsers.length} admin users:`);
    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.role}`);
    });
    
    if (adminUsers.length === 0) {
      console.log('\n❌ No admin users found!');
      console.log('You need to create an admin user first.');
      console.log('\nTo create a super admin, you can use:');
      console.log('POST /api/create-superadmin');
      console.log('With ADMIN_CREATION_SECRET in headers');
    } else {
      console.log('\n✅ Admin users found. You can use these credentials to test login.');
    }
    
  } catch (error) {
    console.error('❌ Error checking admin users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUsers();
