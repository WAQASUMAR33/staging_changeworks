/**
 * Test script to delete an organization by email
 * Useful for cleaning up before testing signup
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function deleteOrganizationByEmail(email) {
  console.log('🔍 Finding organization with email:', email);
  console.log('');

  try {
    // First, get all organizations to find the one with this email
    const listResponse = await fetch(`${API_BASE_URL}/api/organization`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!listResponse.ok) {
      console.error('❌ Failed to fetch organizations');
      const errorData = await listResponse.json();
      console.error('Error:', errorData);
      return;
    }

    const { organizations } = await listResponse.json();
    const org = organizations.find(o => o.email === email);

    if (!org) {
      console.log(`✅ No organization found with email: ${email}`);
      return;
    }

    console.log(`✅ Found organization:`);
    console.log(`   ID: ${org.id}`);
    console.log(`   Name: ${org.name}`);
    console.log(`   Email: ${org.email}`);
    console.log('');

    // Delete the organization
    console.log(`🗑️  Deleting organization ${org.id}...`);
    const deleteResponse = await fetch(`${API_BASE_URL}/api/organization/${org.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const deleteData = await deleteResponse.json();

    if (!deleteResponse.ok) {
      console.error('❌ Failed to delete organization');
      console.error('Error:', deleteData);
      return;
    }

    console.log('✅ Organization deleted successfully!');
    console.log('');
    console.log('📊 Deletion Summary:');
    console.log('===================');
    if (deleteData.deletedCounts) {
      Object.entries(deleteData.deletedCounts).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || 'theitxprts@gmail.com';

console.log('🚀 Starting Organization Deletion Test');
console.log('');
deleteOrganizationByEmail(email)
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
