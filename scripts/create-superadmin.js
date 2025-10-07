const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    console.log('🔧 Creating Super Admin Account...\n');

    // Super Admin details
    const superAdminData = {
      name: 'Super Admin',
      email: 'superadmin@changeworksfund.org',
      password: 'SuperAdmin@123', // Change this to a secure password
      role: 'SUPERADMIN'
    };

    // Check if super admin already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: superAdminData.email }
    });

    if (existingUser) {
      console.log('⚠️  Super Admin account already exists!');
      console.log('📧 Email:', existingUser.email);
      console.log('👤 Name:', existingUser.name);
      console.log('🔑 Role:', existingUser.role);
      console.log('\n✅ No action needed.\n');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(superAdminData.password, 12);

    // Create super admin user
    const superAdmin = await prisma.user.create({
      data: {
        name: superAdminData.name,
        email: superAdminData.email,
        password: hashedPassword,
        role: 'SUPERADMIN',
        emailVerified: new Date(), // Mark as verified
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      }
    });

    console.log('✅ Super Admin account created successfully!\n');
    console.log('📋 Account Details:');
    console.log('   ID:', superAdmin.id);
    console.log('   Name:', superAdmin.name);
    console.log('   Email:', superAdmin.email);
    console.log('   Role:', superAdmin.role);
    console.log('   Created:', superAdmin.created_at);
    console.log('\n🔐 Login Credentials:');
    console.log('   Email:', superAdminData.email);
    console.log('   Password:', superAdminData.password);
    console.log('\n⚠️  IMPORTANT: Please change the password after first login!\n');

  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    
    if (error.code === 'P2002') {
      console.error('Email already exists in the database.');
    } else if (error.code === 'P2003') {
      console.error('Invalid role. Make sure SUPERADMIN is in the Role enum.');
    } else {
      console.error('Details:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();

