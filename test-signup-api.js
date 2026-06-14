// Native fetch is available in Node 18+
async function testSignup() {
    const email = `test.donor.${Date.now()}@example.com`;
    const port = 3000; // Trying default port 3000
    const url = `http://localhost:${port}/api/donor/signup`;

    console.log(`Testing API at: ${url}`);
    console.log(`Attempting to create donor with email: ${email}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Donor',
                email: email,
                password: 'Password123!',
                phone: '+15555555555',
                postal_code: '12345',
                country: 'US',
                // No organization_id
            }),
        });

        const data = await response.json();

        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('✅ SUCCESS: Donor created without organization_id');
        } else {
            console.log('❌ FAILED: API returned error');
        }
    } catch (error) {
        console.error('❌ ERROR: Failed to request API', error);
    }
}

testSignup();
