# GHL Account Creation Test Scripts

This directory contains test scripts that **actually create GHL sub-accounts** to verify API key functionality. These scripts perform real account creation, not just API validation.

## ⚠️ **IMPORTANT WARNING**

**These scripts create REAL GHL accounts!**
- Test accounts are created with unique timestamps
- Use the `--cleanup` flag to automatically delete test accounts
- Manual cleanup may be required if automatic cleanup fails

## 📁 Available Test Scripts

### 1. **Node.js Script (Full-featured)**
- **File**: `test-ghl-create-account.js`
- **Requirements**: Node.js only (no external packages)
- **Features**: Real account creation, automatic cleanup, detailed logging

```bash
# Create test account
node test-ghl-create-account.js "your_api_key_here"

# Create test account with automatic cleanup
node test-ghl-create-account.js "your_api_key_here" --cleanup
```

### 2. **PowerShell Script**
- **File**: `test-ghl-create-account.ps1`
- **Requirements**: Windows PowerShell
- **Features**: Native Windows support, colored output, cleanup option

```powershell
# Create test account
.\test-ghl-create-account.ps1 -ApiKey "your_api_key_here"

# Create test account with automatic cleanup
.\test-ghl-create-account.ps1 -ApiKey "your_api_key_here" -Cleanup
```

### 3. **Batch File (Windows)**
- **File**: `test-ghl-create-account.bat`
- **Requirements**: Windows Command Prompt
- **Features**: Simple double-click execution

```cmd
# Create test account
test-ghl-create-account.bat "your_api_key_here"

# Create test account with automatic cleanup
test-ghl-create-account.bat "your_api_key_here" --cleanup
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

## 🧪 What the Tests Do

1. **Key Analysis**: Determines key type and capabilities
2. **Real Account Creation**: Attempts to create an actual GHL sub-account
3. **Account Details**: Shows created account information
4. **Cleanup**: Optionally deletes the test account

## 📊 Test Results

### **Success Response**
```
🏢 GHL Account Creation Test
==================================================

📊 Key Analysis:
   Length: 350 characters
   Type: Agency API Key (JWT)
   Can create sub-accounts: ✅ Yes

🚀 Creating GHL Test Account...
   Endpoint: https://rest.gohighlevel.com/v1/locations/
   Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   Account Name: Test Account 2025-01-15T10-30-45-123Z

✅ ACCOUNT CREATED SUCCESSFULLY!
   Status: 200 OK
   Location ID: abc123def456
   Account Name: Test Account 2025-01-15T10-30-45-123Z
   Email: test-2025-01-15T10-30-45-123Z@example.com
   Phone: 1234567890
   Full Response: {
     "id": "abc123def456",
     "name": "Test Account 2025-01-15T10-30-45-123Z",
     "email": "test-2025-01-15T10-30-45-123Z@example.com",
     "phone": "1234567890",
     "status": "active"
   }

📊 Final Result:
✅ GHL API key can create sub-accounts!
   Location ID: abc123def456
   Account Name: Test Account 2025-01-15T10-30-45-123Z
```

### **Failure Response**
```
❌ ACCOUNT CREATION FAILED!
   Status: 403 Forbidden
   Error: Insufficient permissions

🔧 Troubleshooting:
   • The API key is a Location key, not an Agency key
   • Location keys cannot create sub-accounts
   • You need an Agency API key for sub-account creation

📊 Final Result:
❌ GHL API key cannot create sub-accounts
   Error: Insufficient permissions

💡 Solution:
   You need an Agency API key to create sub-accounts.
   Location API keys can only manage existing accounts.
```

## 🗑️ Cleanup Process

### **Automatic Cleanup**
When using the `--cleanup` flag:

```bash
node test-ghl-create-account.js "your_api_key" --cleanup
```

The script will:
1. Create the test account
2. Automatically delete it after testing
3. Confirm successful cleanup

### **Manual Cleanup**
If automatic cleanup fails:

1. **GHL Dashboard**: Log into your GHL account
2. **Locations**: Go to Locations section
3. **Find Test Account**: Look for "Test Account" with timestamp
4. **Delete**: Remove the test account manually

## 🚀 Quick Start

### **For Windows Users**
```cmd
# Double-click or run from command prompt
test-ghl-create-account.bat "your_api_key_here" --cleanup
```

### **For Node.js Users**
```bash
# Test with cleanup (recommended)
node test-ghl-create-account.js "your_api_key_here" --cleanup
```

### **For PowerShell Users**
```powershell
# Test with cleanup (recommended)
.\test-ghl-create-account.ps1 -ApiKey "your_api_key_here" -Cleanup
```

## 📝 Test Account Details

Each test creates an account with:
- **Name**: `Test Account [timestamp]`
- **Email**: `test-[timestamp]@example.com`
- **Phone**: `1234567890`
- **Address**: `123 Test Street`
- **City**: `Test City`
- **State**: `Test State`
- **Country**: `US`
- **Postal Code**: `12345`
- **Website**: `https://test.com`
- **Timezone**: `America/New_York`

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

#### **422 Validation Error**
- **Cause**: Account name or email already exists
- **Solution**: Script uses unique timestamps to avoid conflicts

#### **Timeout**
- **Cause**: GHL API not responding
- **Solution**: Check internet connection, try again later

## 🎯 Expected Outcomes

### **✅ Success**
- API key is valid
- Can create GHL sub-accounts
- Account created with unique timestamp
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
4. **Use --cleanup flag to avoid leaving test accounts**
5. **Contact GHL support if the key is valid but not working**

## 🔒 Security Notes

- **Never commit API keys to version control**
- **Use environment variables for production**
- **Rotate API keys regularly**
- **Test accounts are safe to use (they create test sub-accounts)**
- **Always use --cleanup flag in production testing**

## 📋 Checklist

Before running the test:

- [ ] You have a valid GHL API key
- [ ] The key is an Agency API key (250+ characters)
- [ ] You understand this creates real accounts
- [ ] You plan to use --cleanup flag
- [ ] You have access to GHL dashboard for manual cleanup if needed

---

**Happy Testing! 🚀**

**Remember: These scripts create REAL GHL accounts - use responsibly!**
