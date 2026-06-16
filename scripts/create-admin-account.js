const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'theitxprts@gmail.com';
  const password = '786Ninja';
  const name = 'Admin User';

  try {
    console.log('Starting admin creation script...');

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the admin user
    const admin = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {
        name: name,
        password: hashedPassword,
        role: 'ADMIN',
        emailVerified: new Date()
      },
      create: {
        name: name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'ADMIN',
        emailVerified: new Date()
      }
    });

    console.log('✅ Admin user created/updated successfully!');
    console.log('ID:', admin.id);
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
