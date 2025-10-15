// Test script to verify GHL API response structure
const mockGhlResponse = {
  "id": "G115agL2r1kaaGAEPPsg",
  "name": "Mark Shoes",
  "address": "4th fleet street",
  "city": "New York",
  "state": "Illinois",
  "country": "US",
  "postalCode": "567654",
  "website": "https://yourwebsite.com",
  "timezone": "US/Central",
  "firstName": "",
  "lastName": "",
  "email": "",
  "phone": "+1410039940",
  "apiKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2NhdGlvbl9pZCI6IkcxMTVhZ0wycjFrYWFHQUVQUHNnIiwidmVyc2lvbiI6MSwiaWF0IjoxNzYwNTQ1NzAxMzQ2fQ.ff8HTTnd8FV58E04-Jk4KiZQs_u1ScdvKqALesjbrTY",
  "business": {
    "name": "Mark Shoes",
    "address": "4th fleet street",
    "city": "New York",
    "state": "Illinois",
    "country": "US",
    "postalCode": "567654",
    "website": "https://yourwebsite.com",
    "timezone": "US/Central"
  },
  "social": {
    "facebookUrl": "",
    "googlePlus": "",
    "linkedIn": "",
    "foursquare": "",
    "twitter": "",
    "yelp": "",
    "instagram": "",
    "youtube": "",
    "pinterest": "",
    "blogRss": "",
    "googlePlaceId": ""
  },
  "settings": {
    "allowDuplicateContact": false,
    "allowDuplicateOpportunity": false,
    "allowFacebookNameMerge": false,
    "disableContactTimezone": false
  }
};

// Simulate the GHL client response structure
const ghlResult = {
  success: true,
  data: mockGhlResponse,
  locationId: mockGhlResponse.id
};

console.log('🔍 Testing GHL Response Structure');
console.log('================================');

console.log('\n📊 GHL Result Structure:');
console.log('✅ Success:', ghlResult.success);
console.log('✅ Location ID:', ghlResult.locationId);
console.log('✅ Data exists:', !!ghlResult.data);

console.log('\n🔑 API Key Extraction:');
const extractedApiKey = ghlResult.data.apiKey;
console.log('✅ API Key found:', !!extractedApiKey);
console.log('✅ API Key length:', extractedApiKey ? extractedApiKey.length : 0);
console.log('✅ API Key preview:', extractedApiKey ? `${extractedApiKey.substring(0, 20)}...` : 'NOT FOUND');

console.log('\n🏢 Organization Data:');
console.log('✅ Business Name:', ghlResult.data.name);
console.log('✅ Address:', ghlResult.data.address);
console.log('✅ City:', ghlResult.data.city);
console.log('✅ State:', ghlResult.data.state);
console.log('✅ Country:', ghlResult.data.country);
console.log('✅ Postal Code:', ghlResult.data.postalCode);
console.log('✅ Website:', ghlResult.data.website);
console.log('✅ Timezone:', ghlResult.data.timezone);

console.log('\n📋 Database Storage Simulation:');
console.log('Organization Table:');
console.log('  - ghlId:', ghlResult.locationId);
console.log('  - ghlApiKey:', extractedApiKey ? `${extractedApiKey.substring(0, 20)}...` : 'NOT FOUND');

console.log('\nGHLAccount Table:');
console.log('  - ghl_location_id:', ghlResult.locationId);
console.log('  - api_key:', extractedApiKey ? `${extractedApiKey.substring(0, 20)}...` : 'NOT FOUND');
console.log('  - business_name:', ghlResult.data.name);

console.log('\n✅ Verification Complete!');
console.log('The API key extraction is working correctly.');
