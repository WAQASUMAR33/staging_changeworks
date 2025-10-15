# GHL API Key Test Scripts

This directory contains multiple test scripts to verify GHL (GoHighLevel) API keys and their ability to create sub-accounts.

## 📁 Available Test Scripts

### 1. **Node.js Script (Full-featured)**
- **File**: `test-ghl-script.js`
- **Requirements**: Node.js + axios package
- **Features**: Full error handling, troubleshooting, custom test data

```bash
# Install dependencies
npm install axios

# Run the test
node test-ghl-script.js "your_api_key_here"
node test-ghl-script.js "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. **Node.js Script (Simple)**
- **File**: `test-ghl-simple.js`
- **Requirements**: Node.js only (no external packages)
- **Features**: Uses built-in modules, lightweight

```bash
# Run the test (no installation needed)
node test-ghl-simple.js "your_api_key_here"
node test-ghl-simple.js "pit-f397ad9f-cf11-49b8-a791-658b934ec3f6"
```

### 3. **PowerShell Script**
- **File**: `test-ghl.ps1`
- **Requirements**: Windows PowerShell
- **Features**: Native Windows support, colored output

```powershell
# Run the test
.\test-ghl.ps1 -ApiKey "your_api_key_here"
.\test-ghl.ps1 -ApiKey "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 4. **Batch File (Windows)**
- **File**: `test-ghl.bat`
- **Requirements**: Windows Command Prompt
- **Features**: Simple double-click execution

```cmd
# Run the test
test-ghl.bat "your_api_key_here"
test-ghl.bat "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 5. **Web Interface**
- **File**: `public/test-ghl.html`
- **URL**: `https://app.changeworksfund.org/test-ghl.html`
- **Features**: Visual interface, real-time testing

### 6. **API Endpoint**
- **Endpoint**: `/api/test-ghl`
- **Method**: POST
- **Features**: Programmatic testing, JSON response

```bash
curl -X POST https://app.changeworksfund.org/api/test-ghl \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your_api_key_here"}'
```

## 🔑 GHL API Key Types

### **Personal Access Token (PAT)**
- **Format**: `pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Length**: ~50 characters
- **Capabilities**: Limited API access
- **Sub-account creation**: ❌ **NO**

### **Location API Key (JWT)**
- **Format**: JWT token
- **Length**: ~200-300 characters
- **Capabilities**: Location-specific operations
- **Sub-account creation**: ❌ **NO**

### **Agency API Key (JWT)**
- **Format**: JWT token
- **Length**: 250+ characters
- **Capabilities**: Full agency operations
- **Sub-account creation**: ✅ **YES**

## 🧪 What the Tests Check

1. **Key Validity**: Is the API key properly formatted?
2. **Authentication**: Can the key authenticate with GHL API?
3. **Permissions**: Does the key have permission to create sub-accounts?
4. **Sub-account Creation**: Can it actually create a test sub-account?

## 📊 Test Results

### **Success Response**
```json
{
  "success": true,
  "message": "GHL API key is valid and can create sub-accounts",
  "data": {
    "locationId": "abc123def456",
    "keyLength": 350,
    "keyType": "Agency API Key"
  }
}
```

### **Failure Response**
```json
{
  "success": false,
  "error": "GHL API key test failed",
  "details": "Invalid JWT token",
  "statusCode": 401,
  "keyLength": 200,
  "keyType": "Location API Key",
  "troubleshooting": {
    "Invalid JWT": "The API key is expired, invalid, or not the right type",
    "401 Unauthorized": "The API key doesn't have permission to create sub-accounts"
  }
}
```

## 🔧 Troubleshooting

### **Common Errors**

#### **401 Unauthorized**
- **Cause**: Invalid or expired API key
- **Solution**: Generate a new API key from GHL dashboard

#### **403 Forbidden**
- **Cause**: Location API key (cannot create sub-accounts)
- **Solution**: Use an Agency API key instead

#### **400 Bad Request**
- **Cause**: Invalid test data format
- **Solution**: Check the test data structure

#### **Timeout**
- **Cause**: GHL API not responding
- **Solution**: Check internet connection, try again later

## 🚀 Quick Start

### **For Windows Users**
1. Double-click `test-ghl.bat`
2. Enter your GHL API key when prompted
3. Review the results

### **For Node.js Users**
1. Run: `node test-ghl-simple.js "your_api_key_here"`
2. Review the output

### **For Web Users**
1. Visit: `https://app.changeworksfund.org/test-ghl.html`
2. Paste your API key
3. Click "Test GHL API Key"

## 📝 Test Data

The scripts use the following default test data:

```json
{
  "name": "Test Organization",
  "phone": "1234567890",
  "companyId": "HegBO6PzXMfyDn0yFiFn",
  "address": "123 Test Street",
  "city": "Test City",
  "state": "Test State",
  "country": "US",
  "postalCode": "12345",
  "website": "https://test.com",
  "timezone": "America/New_York",
  "prospectInfo": {
    "firstName": "Test",
    "lastName": "Organization",
    "email": "test@example.com"
  }
}
```

## 🎯 Expected Outcomes

### **✅ Success**
- API key is valid
- Can create GHL sub-accounts
- Ready for production use

### **❌ Failure**
- API key is invalid or expired
- Wrong key type (Location instead of Agency)
- Insufficient permissions
- Network/API issues

## 📞 Support

If you encounter issues:

1. **Check the troubleshooting section above**
2. **Verify your API key type and permissions**
3. **Ensure you have an Agency API key for sub-account creation**
4. **Contact GHL support if the key is valid but not working**

## 🔒 Security Notes

- **Never commit API keys to version control**
- **Use environment variables for production**
- **Rotate API keys regularly**
- **Test keys are safe to use (they create test sub-accounts)**

---

**Happy Testing! 🚀**
