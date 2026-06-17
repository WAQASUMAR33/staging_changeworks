const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const donorId = 139;
  console.log(`Fetching subscriptions for donor ID ${donorId}...`);

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        donor_id: donorId
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            price: true,
            currency: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    console.log(`Found ${subscriptions.length} subscription records.`);
    console.log(JSON.stringify(subscriptions, null, 2));

  } catch (error) {
    console.error('Error fetching subscriptions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
