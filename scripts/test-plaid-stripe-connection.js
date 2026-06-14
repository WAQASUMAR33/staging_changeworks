/**
 * Test script: Check a specific Plaid connection and its Stripe link
 *
 * Usage:
 *   node scripts/test-plaid-stripe-connection.js <donor_id>
 *   node scripts/test-plaid-stripe-connection.js 1
 */

const donorId = process.argv[2];

if (!donorId) {
  console.error('Usage: node scripts/test-plaid-stripe-connection.js <donor_id>');
  process.exit(1);
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function checkConnection() {
  console.log('\n🔍 Checking Plaid + Stripe connection for donor_id:', donorId);
  console.log('🌐 API URL:', `${BASE_URL}/api/plaid/check-connection?donor_id=${donorId}`);
  console.log('─'.repeat(60));

  try {
    const res = await fetch(`${BASE_URL}/api/plaid/check-connection?donor_id=${donorId}`);
    const data = await res.json();

    if (!data.success) {
      console.error('❌ API Error:', data.error);
      return;
    }

    // Top-level summary
    console.log('\n📊 SUMMARY');
    console.log('  Message       :', data.message);
    console.log('  Is Connected  :', data.is_connected);
    console.log('  Ready to Charge:', data.ready_to_charge);
    console.log('  Total Connections:', data.connection_count);

    if (data.connection_count === 0) {
      console.log('\n⚠️  No Plaid connections found for this donor.');
      return;
    }

    // Per-connection details
    data.connections.forEach((conn, i) => {
      console.log(`\n🏦 CONNECTION #${i + 1}`);
      console.log('  ID              :', conn.id);
      console.log('  Institution     :', conn.institution_name || 'Unknown');
      console.log('  Plaid Status    :', conn.status);
      console.log('  Organization    :', conn.organization?.name || 'N/A');

      console.log('\n  💳 STRIPE STATUS');
      console.log('  Linked          :', conn.stripe.linked);
      console.log('  Account ID      :', conn.stripe.account_id || 'N/A');
      console.log('  Charges Enabled :', conn.stripe.charges_enabled);
      console.log('  Payouts Enabled :', conn.stripe.payouts_enabled);
      console.log('  Ready           :', conn.stripe.ready);

      if (conn.stripe.error) {
        console.log('  Stripe Error    :', conn.stripe.error);
      }

      console.log('\n  ✅ RESULT');
      console.log('  Ready to Charge :', conn.ready_to_charge);
      console.log('  Message         :', conn.message);
      console.log('  Created At      :', new Date(conn.created_at).toLocaleString());
    });

    console.log('\n' + '─'.repeat(60));
    if (data.ready_to_charge) {
      console.log('✅ PASS — Plaid is connected and linked with Stripe. Round-ups can be collected.');
    } else {
      console.log('❌ FAIL — Not ready to charge. See message above for details.');
    }
    console.log('─'.repeat(60) + '\n');

  } catch (err) {
    console.error('❌ Failed to reach API:', err.message);
    console.error('   Make sure the app is running on', BASE_URL);
  }
}

checkConnection();
