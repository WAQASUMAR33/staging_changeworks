# GHL Account Creation JSON Samples

This directory contains JSON samples for creating GHL (GoHighLevel) sub-accounts using the API.

## 📁 Available JSON Samples

### 1. **Minimal Sample** (`ghl-account-minimal-sample.json`)
Contains only the required fields for account creation:

```json
{
  "name": "Test Organization",
  "phone": "1234567890",
  "companyId": "HegBO6PzXMfyDn0yFiFn",
  "prospectInfo": {
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com"
  }
}
```

### 2. **Standard Sample** (`ghl-account-sample.json`)
Contains common fields for most use cases:

```json
{
  "name": "Sample Organization",
  "phone": "1234567890",
  "companyId": "HegBO6PzXMfyDn0yFiFn",
  "address": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "country": "US",
  "postalCode": "10001",
  "website": "https://sample-org.com",
  "timezone": "America/New_York",
  "prospectInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@sample-org.com"
  }
}
```

### 3. **Detailed Sample** (`ghl-account-detailed-sample.json`)
Contains all possible fields including advanced features:

```json
{
  "name": "ChangeWorks Foundation",
  "phone": "+1-555-123-4567",
  "companyId": "HegBO6PzXMfyDn0yFiFn",
  "address": "456 Charity Lane",
  "city": "San Francisco",
  "state": "CA",
  "country": "US",
  "postalCode": "94105",
  "website": "https://changeworksfoundation.org",
  "timezone": "America/Los_Angeles",
  "prospectInfo": {
    "firstName": "Sarah",
    "lastName": "Johnson",
    "email": "sarah.johnson@changeworksfoundation.org",
    "phone": "+1-555-123-4567",
    "address": "456 Charity Lane",
    "city": "San Francisco",
    "state": "CA",
    "country": "US",
    "postalCode": "94105",
    "website": "https://changeworksfoundation.org",
    "tags": ["Non-Profit", "Charity", "Foundation"],
    "customFields": {
      "organization_type": "Non-Profit",
      "tax_id": "12-3456789",
      "founded_year": "2020",
      "mission": "Empowering communities through technology",
      "focus_areas": ["Education", "Healthcare", "Environment"]
    }
  },
  "settings": {
    "currency": "USD",
    "dateFormat": "MM/DD/YYYY",
    "timeFormat": "12",
    "weekStart": "Monday"
  },
  "features": {
    "sms": true,
    "email": true,
    "calls": true,
    "calendar": true,
    "pipelines": true,
    "automations": true
  }
}
```

## 🧪 Test Script with JSON Samples

### **`test-ghl-with-json.js`**
A Node.js script that uses the JSON samples to test GHL API keys:

```bash
# Test with minimal sample
node test-ghl-with-json.js "your_api_key" minimal

# Test with detailed sample
node test-ghl-with-json.js "your_api_key" detailed

# Test with standard sample (default)
node test-ghl-with-json.js "your_api_key" default
```

## 📋 Field Descriptions

### **Required Fields**
- **`name`**: Organization/business name
- **`phone`**: Primary phone number
- **`companyId`**: GHL company ID (usually "HegBO6PzXMfyDn0yFiFn")
- **`prospectInfo.firstName`**: Contact first name
- **`prospectInfo.lastName`**: Contact last name
- **`prospectInfo.email`**: Contact email address

### **Optional Fields**
- **`address`**: Street address
- **`city`**: City name
- **`state`**: State/province code
- **`country`**: Country code (US, CA, GB, etc.)
- **`postalCode`**: ZIP/postal code
- **`website`**: Organization website URL
- **`timezone`**: Timezone (America/New_York, Europe/London, etc.)

### **Advanced Fields**
- **`prospectInfo.phone`**: Contact phone number
- **`prospectInfo.address`**: Contact address
- **`prospectInfo.tags`**: Array of tags
- **`prospectInfo.customFields`**: Custom field data
- **`settings`**: Account settings
- **`features`**: Feature flags

## 🚀 Usage Examples

### **Using cURL**
```bash
# Minimal sample
curl -X POST https://rest.gohighlevel.com/v1/locations/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Version: 2021-07-28" \
  -d @ghl-account-minimal-sample.json

# Detailed sample
curl -X POST https://rest.gohighlevel.com/v1/locations/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Version: 2021-07-28" \
  -d @ghl-account-detailed-sample.json
```

### **Using PowerShell**
```powershell
# Load JSON sample
$jsonData = Get-Content "ghl-account-sample.json" | ConvertFrom-Json

# Create account
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type" = "application/json"
    "Version" = "2021-07-28"
}

$response = Invoke-RestMethod -Uri "https://rest.gohighlevel.com/v1/locations/" -Method POST -Body ($jsonData | ConvertTo-Json -Depth 10) -Headers $headers
```

### **Using Node.js**
```javascript
const fs = require('fs');
const https = require('https');

// Load JSON sample
const accountData = JSON.parse(fs.readFileSync('ghl-account-sample.json', 'utf8'));

// Create account
const options = {
  hostname: 'rest.gohighlevel.com',
  port: 443,
  path: '/v1/locations/',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
    'Version': '2021-07-28'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(JSON.parse(data)));
});

req.write(JSON.stringify(accountData));
req.end();
```

## 🔧 Customization

### **Modifying Samples**
1. **Edit the JSON files** to match your requirements
2. **Add custom fields** to `prospectInfo.customFields`
3. **Update tags** in `prospectInfo.tags`
4. **Modify settings** in `settings` object
5. **Enable/disable features** in `features` object

### **Adding Custom Fields**
```json
{
  "prospectInfo": {
    "customFields": {
      "organization_type": "Non-Profit",
      "tax_id": "12-3456789",
      "founded_year": "2020",
      "mission": "Your mission statement",
      "focus_areas": ["Education", "Healthcare"],
      "custom_field_1": "Custom value",
      "custom_field_2": "Another value"
    }
  }
}
```

### **Setting Tags**
```json
{
  "prospectInfo": {
    "tags": [
      "Non-Profit",
      "Charity",
      "Foundation",
      "Education",
      "Healthcare",
      "Environment"
    ]
  }
}
```

## ⚠️ Important Notes

### **API Key Requirements**
- **Agency API Key**: Required for creating sub-accounts
- **Location API Key**: Cannot create sub-accounts
- **Personal Access Token**: Cannot create sub-accounts

### **Account Creation**
- **Real Accounts**: These samples create actual GHL accounts
- **Unique Names**: Scripts add timestamps to avoid conflicts
- **Cleanup**: Consider deleting test accounts after testing

### **Rate Limits**
- **GHL API**: Has rate limits for account creation
- **Testing**: Use unique names/emails for each test
- **Production**: Implement proper error handling

## 🎯 Expected Responses

### **Success Response**
```json
{
  "id": "abc123def456",
  "name": "Test Organization 2025-01-15T10-30-45-123Z",
  "email": "test-2025-01-15T10-30-45-123Z@example.com",
  "phone": "1234567890",
  "status": "active",
  "createdAt": "2025-01-15T10:30:45.123Z"
}
```

### **Error Response**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

## 📞 Support

If you encounter issues:

1. **Check API key type** (must be Agency API key)
2. **Verify JSON format** (valid JSON syntax)
3. **Check required fields** (name, phone, companyId, prospectInfo)
4. **Use unique names/emails** (avoid conflicts)
5. **Contact GHL support** if the key is valid but not working

---

**Happy Testing! 🚀**

**Remember: These samples create REAL GHL accounts - use responsibly!**
