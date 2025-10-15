import axios from 'axios';

class GHLClient {
  constructor(customToken) {
    // Use the correct GHL API endpoint from documentation
    const baseURL = process.env.GHL_BASE_URL || 'https://rest.gohighlevel.com/v1';
    
    // Validate that customToken is provided
    if (!customToken) {
      console.error('❌ GHL Client Error: customToken is required but not provided');
      throw new Error('GHL Client requires a customToken parameter');
    }

    // Validate API key format
    if (customToken.length < 200) {
      console.warn('⚠️ GHL API key seems short. Agency API keys are typically 250+ characters.');
    }

    console.log('✅ GHL Client initialized with custom token');
    
    this.client = axios.create({
      baseURL: baseURL,
      headers: {
        'Authorization': `Bearer ${customToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2021-07-28'
      }
    });
  }

  async generateLocationToken(locationId) {
    try {
      console.log('=== GENERATING LOCATION TOKEN ===');
      console.log('Location ID:', locationId);
      
      const tokenEndpoint = 'https://services.leadconnectorhq.com/oauth/locationToken';
      const agencyToken = process.env.GHL_AGENCY_API_KEY || process.env.GHL_API_KEY;
      
      console.log('Token Endpoint:', tokenEndpoint);
      console.log('Using Agency Token:', agencyToken ? `${agencyToken.substring(0, 20)}...` : 'NOT SET');
      
      const response = await axios.post(tokenEndpoint, {
        locationId: locationId
      }, {
        headers: {
          'Authorization': `Bearer ${agencyToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        timeout: 30000
      });

      console.log('=== LOCATION TOKEN SUCCESS ===');
      console.log('Status:', response.status);
      console.log('Token:', response.data.access_token ? `${response.data.access_token.substring(0, 20)}...` : 'NOT FOUND');
      
      return {
        success: true,
        accessToken: response.data.access_token,
        data: response.data
      };
    } catch (error) {
      console.error('=== LOCATION TOKEN ERROR ===');
      console.error('Error Message:', error.message);
      console.error('Status:', error.response?.status);
      console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        statusCode: error.response?.status || 500,
        details: error.response?.data || null
      };
    }
  }

  async createSubAccount(data) {
    try {
      // Build request data according to GHL API documentation
      const requestData = {
        name: data.businessName,
        businessName : data.businessName,
        phone: data.phone || '',
        companyId: data.companyId || process.env.GHL_COMPANY_ID, // REQUIRED field
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country || 'GB',
        postalCode: data.postalCode || '',
        website: data.website || '',
        timezone: data.timezone || 'Europe/London',
        prospectInfo: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email
        },
        ...(data.settings && { settings: data.settings }),
        ...(data.social && { social: data.social }),
        ...(data.twilio && { twilio: data.twilio }),
        ...(data.mailgun && { mailgun: data.mailgun }),
        ...(data.snapshotId && { snapshotId: data.snapshotId })
      };

      console.log('=== GHL API REQUEST ===');
      const subAccountApiUrl = process.env.GHL_SUB_ACCOUNT_CREATION_API_URL || 'https://rest.gohighlevel.com/v1/locations/';
      console.log('Sub-Account Creation API URL:', subAccountApiUrl);
      console.log('Headers:', this.client.defaults.headers);
      console.log('Request Data:', JSON.stringify(requestData, null, 2));

      const response = await this.client.post(subAccountApiUrl, requestData);

      console.log('=== GHL API SUCCESS RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Response Data:', JSON.stringify(response.data, null, 2));
      console.log('Response Headers:', response.headers);

      return {
        success: true,
        data: response.data,
        locationId: response.data.id || response.data.locationId
      };
    } catch (error) {
      console.error('=== GHL API ERROR RESPONSE ===');
      console.error('Error Message:', error.message);
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Request Config:', {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      });
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        statusCode: error.response?.status || 500,
        details: error.response?.data || null,
        fullError: {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        }
      };
    }
  }

  async getSubAccount(locationId) {
    try {
      const locationsEndpoint = process.env.GHL_LOCATIONS_ENDPOINT || '/v1/locations/';
      const response = await this.client.get(`${locationsEndpoint}${locationId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        statusCode: error.response?.status || 500
      };
    }
  }

  async updateSubAccount(locationId, data) {
    try {
      const locationsEndpoint = process.env.GHL_LOCATIONS_ENDPOINT || '/v1/locations/';
      const response = await this.client.put(`${locationsEndpoint}${locationId}`, data);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        statusCode: error.response?.status || 500
      };
    }
  }

  async deleteSubAccount(locationId) {
    try {
      const locationsEndpoint = process.env.GHL_LOCATIONS_ENDPOINT || '/v1/locations/';
      const response = await this.client.delete(`${locationsEndpoint}${locationId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        statusCode: error.response?.status || 500
      };
    }
  }

  async createContact(locationId, contactData, overrideToken) {
    try {
      // Use the sub-account API key directly (no need for location token generation)
      console.log('=== CREATING CONTACT WITH SUB-ACCOUNT API KEY ===');
      
      const requestData = {
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        email: contactData.email,
        phone: contactData.phone || '',
        address: contactData.address || '',
        city: contactData.city || '',
        state: contactData.state || '',
        country: contactData.country || 'US',
        postalCode: contactData.postalCode || '',
        ...(contactData.customFields && { customFields: contactData.customFields }),
        ...(contactData.tags && { tags: contactData.tags }),
        ...(contactData.source && { source: contactData.source })
      };

      const contactsApiUrl = process.env.GHL_CONTACT_CREATE_API_URL || 'https://rest.gohighlevel.com/v1/contacts/';
      const apiKey = overrideToken || this.client.defaults.headers.Authorization?.replace('Bearer ', '');
      
      if (!apiKey) {
        console.error('❌ GHL Contact Creation Error: No API key available');
        throw new Error('GHL Contact creation requires a valid API key');
      }
      
      console.log('Contact API URL:', contactsApiUrl);
      console.log('Location ID:', locationId);
      console.log('API Key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT FOUND');
      console.log('Request Data:', JSON.stringify(requestData, null, 2));

      // Prepare headers with all required fields
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2021-07-28',
        'Authorization': `Bearer ${apiKey}`,
        'Location-Id': locationId
      };

      console.log('=== REQUEST HEADERS ===');
      console.log('Content-Type:', headers['Content-Type']);
      console.log('Accept:', headers['Accept']);
      console.log('Version:', headers['Version']);
      console.log('Authorization:', headers['Authorization'].substring(0, 30) + '...');
      console.log('Location-Id:', headers['Location-Id']);
      console.log('=======================');

      const response = await this.client.post(contactsApiUrl, requestData, {
        headers: headers
      });

      console.log('=== GHL CONTACT API SUCCESS RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Response Data:', JSON.stringify(response.data, null, 2));

      return {
        success: true,
        data: response.data,
        contactId: response.data.contact?.id || response.data.id || response.data.contactId
      };
    } catch (error) {
      console.error('=== GHL CONTACT API ERROR RESPONSE ===');
      console.error('Error Message:', error.message);
      console.error('Status:', error.response?.status);
      console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        statusCode: error.response?.status || 500,
        details: error.response?.data || null
      };
    }
  }
}

export default GHLClient;