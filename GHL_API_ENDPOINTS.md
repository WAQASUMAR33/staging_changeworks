# GHL (GoHighLevel) API Endpoints and Links

This document contains all the essential GHL API endpoints, documentation links, and resources for developers.

## 🔗 **Official GHL API Documentation**

### **Main Documentation**
- **API Documentation**: https://highlevel.stoplight.io/docs/integrations
- **API Reference**: https://highlevel.stoplight.io/docs/integrations/ZG9jOjEwODA3NDc1-introduction
- **Authentication Guide**: https://highlevel.stoplight.io/docs/integrations/ZG9jOjEwODA3NDc1-authentication

### **Developer Resources**
- **Developer Portal**: https://highlevel.stoplight.io/
- **API Status**: https://status.gohighlevel.com/
- **Support**: https://support.gohighlevel.com/

## 🌐 **Base API URLs**

### **Production Environment**
```
https://rest.gohighlevel.com/v1
```

### **Sandbox Environment**
```
https://rest.gohighlevel.com/v1
```
*Note: GHL uses the same URL for both production and sandbox*

## 📋 **Core API Endpoints**

### **Authentication**
```
POST /oauth/token
POST /oauth/refresh
```

### **Locations (Sub-Accounts)**
```
GET    /locations/
POST   /locations/
GET    /locations/{locationId}
PUT    /locations/{locationId}
DELETE /locations/{locationId}
```

### **Contacts**
```
GET    /locations/{locationId}/contacts/
POST   /locations/{locationId}/contacts/
GET    /locations/{locationId}/contacts/{contactId}
PUT    /locations/{locationId}/contacts/{contactId}
DELETE /locations/{locationId}/contacts/{contactId}
```

### **Opportunities**
```
GET    /locations/{locationId}/opportunities/
POST   /locations/{locationId}/opportunities/
GET    /locations/{locationId}/opportunities/{opportunityId}
PUT    /locations/{locationId}/opportunities/{opportunityId}
DELETE /locations/{locationId}/opportunities/{opportunityId}
```

### **Appointments**
```
GET    /locations/{locationId}/appointments/
POST   /locations/{locationId}/appointments/
GET    /locations/{locationId}/appointments/{appointmentId}
PUT    /locations/{locationId}/appointments/{appointmentId}
DELETE /locations/{locationId}/appointments/{appointmentId}
```

### **Campaigns**
```
GET    /locations/{locationId}/campaigns/
POST   /locations/{locationId}/campaigns/
GET    /locations/{locationId}/campaigns/{campaignId}
PUT    /locations/{locationId}/campaigns/{campaignId}
DELETE /locations/{locationId}/campaigns/{campaignId}
```

### **Pipelines**
```
GET    /locations/{locationId}/pipelines/
POST   /locations/{locationId}/pipelines/
GET    /locations/{locationId}/pipelines/{pipelineId}
PUT    /locations/{locationId}/pipelines/{pipelineId}
DELETE /locations/{locationId}/pipelines/{pipelineId}
```

### **Calendars**
```
GET    /locations/{locationId}/calendars/
POST   /locations/{locationId}/calendars/
GET    /locations/{locationId}/calendars/{calendarId}
PUT    /locations/{locationId}/calendars/{calendarId}
DELETE /locations/{locationId}/calendars/{calendarId}
```

### **Forms**
```
GET    /locations/{locationId}/forms/
POST   /locations/{locationId}/forms/
GET    /locations/{locationId}/forms/{formId}
PUT    /locations/{locationId}/forms/{formId}
DELETE /locations/{locationId}/forms/{formId}
```

### **Webhooks**
```
GET    /locations/{locationId}/webhooks/
POST   /locations/{locationId}/webhooks/
GET    /locations/{locationId}/webhooks/{webhookId}
PUT    /locations/{locationId}/webhooks/{webhookId}
DELETE /locations/{locationId}/webhooks/{webhookId}
```

## 🔑 **API Key Types and Endpoints**

### **Personal Access Token (PAT)**
- **Format**: `pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Length**: ~50 characters
- **Capabilities**: Limited API access
- **Endpoint**: `https://rest.gohighlevel.com/v1`

### **Location API Key (JWT)**
- **Format**: JWT token
- **Length**: ~200-300 characters
- **Capabilities**: Location-specific operations
- **Endpoint**: `https://rest.gohighlevel.com/v1`

### **Agency API Key (JWT)**
- **Format**: JWT token
- **Length**: 250+ characters
- **Capabilities**: Full agency operations
- **Endpoint**: `https://rest.gohighlevel.com/v1`

## 📝 **Common API Headers**

### **Required Headers**
```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
Accept: application/json
Version: 2021-07-28
```

### **Optional Headers**
```http
User-Agent: YourApp/1.0
X-Request-ID: unique-request-id
X-Rate-Limit-Remaining: 100
```

## 🚀 **Quick Start Examples**

### **1. Create a Location (Sub-Account)**
```bash
curl -X POST https://rest.gohighlevel.com/v1/locations/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Version: 2021-07-28" \
  -d '{
    "name": "Test Organization",
    "phone": "1234567890",
    "companyId": "HegBO6PzXMfyDn0yFiFn",
    "prospectInfo": {
      "firstName": "Test",
      "lastName": "User",
      "email": "test@example.com"
    }
  }'
```

### **2. Get All Locations**
```bash
curl -X GET https://rest.gohighlevel.com/v1/locations/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Version: 2021-07-28"
```

### **3. Create a Contact**
```bash
curl -X POST https://rest.gohighlevel.com/v1/locations/{locationId}/contacts/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Version: 2021-07-28" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "1234567890"
  }'
```

### **4. Get All Contacts**
```bash
curl -X GET https://rest.gohighlevel.com/v1/locations/{locationId}/contacts/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Version: 2021-07-28"
```

## 🔧 **API Versioning**

### **Current Version**
- **Version**: `2021-07-28`
- **Header**: `Version: 2021-07-28`

### **Previous Versions**
- `2021-07-15`
- `2021-07-01`
- `2021-06-15`

## 📊 **Rate Limits**

### **Standard Limits**
- **Requests per minute**: 100
- **Requests per hour**: 1000
- **Requests per day**: 10000

### **Rate Limit Headers**
```http
X-Rate-Limit-Limit: 100
X-Rate-Limit-Remaining: 95
X-Rate-Limit-Reset: 1640995200
```

## 🚨 **Error Codes**

### **Common HTTP Status Codes**
- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **422**: Unprocessable Entity
- **429**: Too Many Requests
- **500**: Internal Server Error

### **Error Response Format**
```json
{
  "statusCode": 400,
  "message": "Validation error",
  "error": "Bad Request",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  }
}
```

## 🔐 **Authentication Methods**

### **1. Bearer Token**
```http
Authorization: Bearer YOUR_API_KEY
```

### **2. OAuth 2.0**
```http
Authorization: Bearer ACCESS_TOKEN
```

### **3. API Key in Header**
```http
X-API-Key: YOUR_API_KEY
```

## 📱 **SDKs and Libraries**

### **Official SDKs**
- **JavaScript/Node.js**: https://www.npmjs.com/package/@gohighlevel/gohighlevel-js
- **PHP**: https://packagist.org/packages/gohighlevel/gohighlevel-php
- **Python**: https://pypi.org/project/gohighlevel-python/
- **Ruby**: https://rubygems.org/gems/gohighlevel-ruby

### **Community Libraries**
- **cURL**: Built-in HTTP client
- **Postman**: API testing tool
- **Insomnia**: API client
- **HTTPie**: Command-line HTTP client

## 🧪 **Testing Tools**

### **API Testing**
- **Postman Collection**: https://www.postman.com/gohighlevel/workspace/gohighlevel-api
- **Insomnia Collection**: Available in GHL documentation
- **cURL Examples**: Provided in documentation

### **Sandbox Environment**
- **Test API Key**: Use your test location API key
- **Test Data**: Use test phone numbers and emails
- **Rate Limits**: Same as production

## 📚 **Additional Resources**

### **Tutorials and Guides**
- **Getting Started**: https://highlevel.stoplight.io/docs/integrations/ZG9jOjEwODA3NDc1-getting-started
- **Webhooks Guide**: https://highlevel.stoplight.io/docs/integrations/ZG9jOjEwODA3NDc1-webhooks
- **Rate Limiting**: https://highlevel.stoplight.io/docs/integrations/ZG9jOjEwODA3NDc1-rate-limiting

### **Community**
- **Developer Forum**: https://community.gohighlevel.com/
- **Discord**: https://discord.gg/gohighlevel
- **GitHub**: https://github.com/gohighlevel

### **Support**
- **Help Center**: https://support.gohighlevel.com/
- **Contact Support**: https://support.gohighlevel.com/contact
- **Status Page**: https://status.gohighlevel.com/

## 🎯 **Quick Reference**

### **Most Used Endpoints**
1. **Create Location**: `POST /locations/`
2. **Get Locations**: `GET /locations/`
3. **Create Contact**: `POST /locations/{locationId}/contacts/`
4. **Get Contacts**: `GET /locations/{locationId}/contacts/`
5. **Create Opportunity**: `POST /locations/{locationId}/opportunities/`

### **Essential Headers**
```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
Version: 2021-07-28
```

### **Base URL**
```
https://rest.gohighlevel.com/v1
```

---

**Happy Coding! 🚀**

**Remember: Always use the latest API version and follow rate limits!**
