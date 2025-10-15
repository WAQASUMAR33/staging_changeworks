# GHL Sub-Account Creation Samples

This directory contains sample JSON files for creating GHL (GoHighLevel) sub-accounts using the API.

## Sample Files

### 1. `ghl-subaccount-minimal.json`
**Minimal required fields only**
```json
{
  "name": "Minimal Test Account",
  "prospectInfo": {
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com"
  }
}
```

### 2. `ghl-subaccount-sample.json`
**Standard fields with basic information**
```json
{
  "name": "Sample Organization",
  "address": {
    "address1": "123 Main Street",
    "address2": "Suite 100",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US"
  },
  "prospectInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1-555-123-4567"
  },
  "website": "https://example.com",
  "timezone": "America/New_York",
  "currency": "USD",
  "industry": "Technology",
  "description": "Sample organization for testing GHL sub-account creation"
}
```

### 3. `ghl-subaccount-detailed.json`
**Comprehensive fields with all available options**
```json
{
  "name": "Detailed Organization Account",
  "address": {
    "address1": "456 Business Avenue",
    "address2": "Floor 5",
    "city": "Los Angeles",
    "state": "CA",
    "postalCode": "90210",
    "country": "US"
  },
  "prospectInfo": {
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@company.com",
    "phone": "+1-555-987-6543",
    "title": "CEO",
    "company": "Smith Enterprises"
  },
  "website": "https://smith-enterprises.com",
  "timezone": "America/Los_Angeles",
  "currency": "USD",
  "industry": "Consulting",
  "description": "A comprehensive test account with all available fields",
  "tags": ["premium", "enterprise", "test"],
  "source": "website",
  "customFields": {
    "company_size": "50-100",
    "annual_revenue": "1M-5M",
    "lead_source": "organic"
  }
}
```

## Field Descriptions

### Required Fields
- `name`: Organization/account name
- `prospectInfo.firstName`: Contact's first name
- `prospectInfo.lastName`: Contact's last name
- `prospectInfo.email`: Contact's email address

### Optional Fields
- `address`: Physical address information
- `prospectInfo.phone`: Contact's phone number
- `prospectInfo.title`: Contact's job title
- `prospectInfo.company`: Contact's company
- `website`: Organization website URL
- `timezone`: Timezone (e.g., "America/New_York")
- `currency`: Currency code (e.g., "USD")
- `industry`: Industry type
- `description`: Account description
- `tags`: Array of tags
- `source`: Lead source
- `customFields`: Custom field values

## Usage

### 1. Test with Sample Files
```bash
node test-ghl-subaccount-samples.js "your-api-key-here"
```

### 2. Manual API Call
```bash
curl -X POST "https://rest.gohighlevel.com/v1/locations/" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Version: 2021-07-28" \
  -d @ghl-subaccount-sample.json
```

### 3. PowerShell Test
```powershell
.\test-ghl-create-account.ps1 "your-api-key-here"
```

## Environment Variables

Make sure these are set in your `.env` file:
```env
GHL_SUB_ACCOUNT_CREATION_API_URL=https://rest.gohighlevel.com/v1/locations/
GHL_API_KEY=your-api-key-here
GHL_AGENCY_API_KEY=your-agency-api-key-here
```

## API Endpoint

**URL**: `https://rest.gohighlevel.com/v1/locations/`
**Method**: `POST`
**Headers**:
- `Authorization: Bearer YOUR_API_KEY`
- `Content-Type: application/json`
- `Accept: application/json`
- `Version: 2021-07-28`

## Response Format

### Success Response (200/201)
```json
{
  "id": "location-id-here",
  "name": "Account Name",
  "prospectInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com"
  },
  "address": {
    "address1": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US"
  },
  "website": "https://example.com",
  "timezone": "America/New_York",
  "currency": "USD",
  "industry": "Technology",
  "description": "Account description"
}
```

### Error Response (400/401/403/500)
```json
{
  "msg": "Error message",
  "errors": [
    {
      "field": "field_name",
      "message": "Field error message"
    }
  ]
}
```

## Common Error Codes

- **401 Unauthorized**: Invalid or expired API key
- **400 Bad Request**: Missing required fields or invalid data
- **403 Forbidden**: Insufficient permissions
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side error

## Testing Tips

1. **Use unique names**: Add timestamps to avoid conflicts
2. **Test with minimal data first**: Start with `ghl-subaccount-minimal.json`
3. **Check API key permissions**: Ensure your key can create sub-accounts
4. **Monitor rate limits**: Don't exceed API rate limits
5. **Validate email formats**: Use valid email addresses
6. **Check timezone formats**: Use standard timezone identifiers

## Troubleshooting

### "Unauthorized, Switch to the new API token"
- Your API key is invalid or expired
- Contact GHL support to get a new API key

### "Missing required field"
- Check that all required fields are present
- Verify field names match the API specification

### "Invalid email format"
- Ensure email addresses are properly formatted
- Check for typos in email fields

### "Rate limit exceeded"
- Wait before making more requests
- Consider implementing request queuing

## Support

For API issues or questions:
- GHL API Documentation: https://highlevel.stoplight.io/
- GHL Support: https://support.gohighlevel.com/
- API Status: https://status.gohighlevel.com/
