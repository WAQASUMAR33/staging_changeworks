
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Use the known valid donor ID from previous steps
    const donorId = 101; 

    console.log(`Fetching subscriptions for donor_id: ${donorId}...`);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        donor_id: donorId
      },
      include: {
        organization: {
          select: { id: true, name: true, imageUrl: true }
        },
        package: {
          select: { id: true, name: true, description: true }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    console.log(`Found ${subscriptions.length} subscriptions.`);

    if (subscriptions.length > 0) {
        const sub = subscriptions[0];
        console.log('Sample Subscription Structure:');
        console.log(JSON.stringify(sub, null, 2));

        // Test the mapping logic
        const formatted = {
            id: sub.id,
            amount: sub.amount,
            status: sub.status,
            interval: sub.interval || 'monthly',
            description: sub.package?.name || `Donation to ${sub.organization?.name}`,
            createdAt: sub.created_at.toISOString(),
            nextPaymentDate: sub.current_period_end?.toISOString(),
            organization: sub.organization,
            package: sub.package
        };
        console.log('Formatted Sample:', formatted);
    } else {
        console.log('No subscriptions found for this donor to verify structure against.');
    }

  } catch (e) {
    console.error('Error executing query:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
