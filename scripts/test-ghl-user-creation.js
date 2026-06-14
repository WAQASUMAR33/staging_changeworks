
const GHLClient = require('../src/app/lib/ghl-client').default;
require('dotenv').config({ path: '.env' });

async function testGhlUserCreation() {
  try {
    console.log('Starting GHL User Creation Test...');

    const ghlAgencyKey = process.env.GHL_AGENCY_API_KEY || process.env.GHL_API_KEY;
    if (!ghlAgencyKey) {
      throw new Error('GHL_AGENCY_API_KEY or GHL_API_KEY is missing in .env');
    }

    const ghlClient = new GHLClient(ghlAgencyKey);

    // Hardcoded location ID - ideally we should create a sub-account first, 
    // but to test user creation failure, we can try to use an existing one if known,
    // or just rely on the fact that we need a valid location ID.
    // However, without a valid location ID, it will definitely fail.
    // Let's first create a dummy sub-account to get a fresh location ID.
    
    console.log('Creating dummy sub-account...');
    const dummyName = `TestOrg_${Date.now()}`;
    const ghlData = {
        businessName: dummyName,
        firstName: 'Test',
        lastName: 'User',
        email: `test_${Date.now()}@example.com`,
        phone: '',
        address: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        country: 'US',
        postalCode: '12345',
        website: '',
        timezone: 'Europe/London',
        companyId: process.env.GHL_COMPANY_ID || 'HegBO6PzXMfyDn0yFiFn'
    };

    const subAccountResult = await ghlClient.createSubAccount(ghlData);
    
    if (!subAccountResult.success) {
        console.error('Failed to create dummy sub-account:', subAccountResult.error);
        return;
    }

    const locationId = subAccountResult.locationId;
    console.log('Dummy sub-account created. Location ID:', locationId);

    // Now try to create the user
    console.log('Attempting to create user...');
    const companyId = process.env.GHL_COMPANY_ID || 'BWID4bp77xwMfmzh1iud';
    
    const email = `admin_REUSE@example.com`; // Fixed email
    const userData = {
        companyId: companyId,
        firstName: 'Test',
        lastName: 'Admin',
        email: email,
        password: 'TestPassword123!', // Valid password
        locationId: locationId,
        type: 'account',
        role: 'admin',
        permissions: {
                campaignsEnabled: true,
                campaignsReadOnly: false,
                contactsEnabled: true,
                contactsReadOnly: false,
                funnelsEnabled: true,
                funnelsReadOnly: false,
                triggersEnabled: true,
                triggersReadOnly: false,
                opportunitiesEnabled: true,
                opportunitiesReadOnly: false,
                conversationsEnabled: true,
                conversationsReadOnly: false,
                onlineListingsEnabled: true,
                onlineListingsReadOnly: false,
                settingsEnabled: true,
                settingsReadOnly: false,
                tagsEnabled: true,
                tagsReadOnly: false,
                leadValueEnabled: true,
                leadValueReadOnly: false,
                marketingEnabled: true,
                marketingReadOnly: false,
                agentReportingEnabled: true,
                agentReportingReadOnly: false,
                botServiceEnabled: true,
                botServiceReadOnly: false,
                socialPlannerEnabled: true,
                socialPlannerReadOnly: false,
                bloggingEnabled: true,
                bloggingReadOnly: false,
                invoiceEnabled: true,
                invoiceReadOnly: false,
                affiliateManagerEnabled: true,
                affiliateManagerReadOnly: false,
                contentAiEnabled: true,
                contentAiReadOnly: false,
                refundsEnabled: true,
                refundsReadOnly: false,
                recordPaymentEnabled: true,
                recordPaymentReadOnly: false,
                cancelSubscriptionEnabled: true,
                cancelSubscriptionReadOnly: false
        }
    };

    // Intentionally OMIT phone
    
    console.log('User Data:', JSON.stringify({ ...userData, password: '***' }, null, 2));

    const userResult = await ghlClient.createUser(userData);

    if (userResult.success) {
        console.log('✅ User created successfully!');
        console.log('User ID:', userResult.userId);
    } else {
        console.error('❌ User creation failed!');
        console.error('Error:', userResult.error);
        console.error('Details:', JSON.stringify(userResult.details, null, 2));

        // Test the fix logic
        console.log('--- TESTING FIX LOGIC ---');
        console.log('🔄 Attempting to find existing user by email to update permissions...');
        const searchResult = await ghlClient.getUserByEmail(userData.email);

        if (searchResult.success && searchResult.user && searchResult.user.id) {
            console.log('✅ Found existing GHL User:', searchResult.user.id);
            console.log('Current user locations:', searchResult.user.roles?.locationIds || []);

            // Prepare update data - merge existing locations with new one
            const existingLocations = searchResult.user.roles?.locationIds || [];
            const newLocationIds = [...new Set([...existingLocations, locationId])];

            const updateData = {
                ...userData,
                locationIds: newLocationIds
            };

            console.log('Updating user with new location list:', newLocationIds);
            const updateResult = await ghlClient.updateUser(searchResult.user.id, updateData);

            if (updateResult.success) {
                console.log('✅ GHL User updated successfully with new location:', updateResult.userId);
            } else {
                console.error('❌ Failed to update existing GHL User:', updateResult.error);
            }
        } else {
             console.error('❌ Could not find existing user to update. User creation failed permanently.');
        }
    }

  } catch (error) {
    console.error('Test failed with exception:', error);
  }
}

testGhlUserCreation();
