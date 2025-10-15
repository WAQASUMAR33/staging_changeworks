# GHL API Quick Reference Links

## 🔗 **Essential GHL API Links**

### **Main API Documentation**
- **API Documentation**: https://highlevel.stoplight.io/docs/integrations
- **API Reference**: https://highlevel.stoplight.io/docs/integrations/ZG9jOjEwODA3NDc1-introduction
- **Authentication**: https://highlevel.stoplight.io/docs/integrations/ZG9jOjEwODA3NDc1-authentication

### **Developer Resources**
- **Developer Portal**: https://highlevel.stoplight.io/
- **Postman Collection**: https://www.postman.com/gohighlevel/workspace/gohighlevel-api
- **Status Page**: https://status.gohighlevel.com/

### **Support & Community**
- **Help Center**: https://support.gohighlevel.com/
- **Developer Forum**: https://community.gohighlevel.com/
- **Discord**: https://discord.gg/gohighlevel

## 🌐 **API Base URL**
```
https://rest.gohighlevel.com/v1
```

## 📋 **Key Endpoints**

### **Locations (Sub-Accounts)**
- **Create**: `POST /locations/`
- **List**: `GET /locations/`
- **Get**: `GET /locations/{locationId}`
- **Update**: `PUT /locations/{locationId}`
- **Delete**: `DELETE /locations/{locationId}`

### **Contacts**
- **Create**: `POST /locations/{locationId}/contacts/`
- **List**: `GET /locations/{locationId}/contacts/`
- **Get**: `GET /locations/{locationId}/contacts/{contactId}`
- **Update**: `PUT /locations/{locationId}/contacts/{contactId}`
- **Delete**: `DELETE /locations/{locationId}/contacts/{contactId}`

### **Opportunities**
- **Create**: `POST /locations/{locationId}/opportunities/`
- **List**: `GET /locations/{locationId}/opportunities/`
- **Get**: `GET /locations/{locationId}/opportunities/{opportunityId}`

## 🔑 **API Headers**
```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
Accept: application/json
Version: 2021-07-28
```

## 🚀 **Quick Examples**

### **Create Location**
```bash
curl -X POST https://rest.gohighlevel.com/v1/locations/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Version: 2021-07-28" \
  -d '{"name": "Test Org", "phone": "1234567890", "companyId": "HegBO6PzXMfyDn0yFiFn", "prospectInfo": {"firstName": "Test", "lastName": "User", "email": "test@example.com"}}'
```

### **Create Contact**
```bash
curl -X POST https://rest.gohighlevel.com/v1/locations/{locationId}/contacts/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Version: 2021-07-28" \
  -d '{"firstName": "John", "lastName": "Doe", "email": "john@example.com", "phone": "1234567890"}'
```

## 📚 **SDKs**
- **JavaScript**: https://www.npmjs.com/package/@gohighlevel/gohighlevel-js
- **PHP**: https://packagist.org/packages/gohighlevel/gohighlevel-php
- **Python**: https://pypi.org/project/gohighlevel-python/
- **Ruby**: https://rubygems.org/gems/gohighlevel-ruby

## 🎯 **Most Important Links**
1. **API Docs**: https://highlevel.stoplight.io/docs/integrations
2. **Postman**: https://www.postman.com/gohighlevel/workspace/gohighlevel-api
3. **Status**: https://status.gohighlevel.com/
4. **Support**: https://support.gohighlevel.com/
