
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const donor = await prisma.donor.findFirst({
      select: { id: true, email: true, name: true }
    });
    
    const org = await prisma.organization.findFirst({
      where: { stripeAccountId: { not: null } },
      select: { id: true, name: true, stripeAccountId: true }
    });

    console.log('Valid Donor:', donor);
    console.log('Valid Organization:', org);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
