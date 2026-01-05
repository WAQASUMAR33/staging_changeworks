# Two-Factor Authentication (2FA) Implementation Guide

## Overview
This application now supports Two-Factor Authentication (2FA) using Time-based One-Time Passwords (TOTP). Users can enable 2FA to add an extra layer of security to their accounts.

## How It Works

### For Users
1. **Enable 2FA**: Go to Settings → Enable Two-Factor Authentication
2. **Scan QR Code**: Use an authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.) to scan the QR code
3. **Verify Setup**: Enter the 6-digit code from your authenticator app to complete setup
4. **Login**: When logging in, you'll be prompted to enter your 2FA code after entering your password

### For Developers

## 1. Adding 2FA Setup to Settings Pages

### Donor Settings Page
Add the `TwoFactorSetup` component to `/src/app/donor/dashboard/settings/page.js`:

```jsx
'use client';

import TwoFactorSetup from '@/app/components/TwoFactorSetup';

export default function DonorSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      
      {/* Other settings sections */}
      
      {/* Two-Factor Authentication Section */}
      <TwoFactorSetup 
        userType="donor" 
        onSuccess={() => {
          // Optional: Show success message or refresh data
          console.log('2FA status updated');
        }}
      />
    </div>
  );
}
```

### Organization Settings Page
Add to `/src/app/organization/dashboard/settings/page.js`:

```jsx
import TwoFactorSetup from '@/app/components/TwoFactorSetup';

<TwoFactorSetup userType="organization" />
```

### Admin Settings Page
Add to `/src/app/admin/settings/page.js`:

```jsx
import TwoFactorSetup from '@/app/components/TwoFactorSetup';

<TwoFactorSetup userType="user" />
```

## 2. Login Flow (Already Implemented)

The main login page (`/src/app/login/page.js`) already has 2FA verification integrated. When a user with 2FA enabled tries to log in:

1. User enters email and password
2. If 2FA is enabled, the system returns `requiresTwoFactor: true`
3. A modal appears asking for the 6-digit code
4. User enters code from authenticator app
5. Login completes after successful verification

### Updating Other Login Pages

If you have separate login pages for donors or organizations, update them similarly:

**Example for Donor Login (`/src/app/donor/login/page.js`):**

```jsx
'use client';
import { useState } from 'react';
import TwoFactorVerification from '@/app/components/TwoFactorVerification';

export default function DonorLoginPage() {
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    
    const res = await fetch('/api/donor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm),
    });

    const data = await res.json();

    // Check if 2FA is required
    if (data.requiresTwoFactor) {
      setShowTwoFactorModal(true);
      return;
    }

    // Handle successful login
    if (res.ok) {
      localStorage.setItem('token', data.token);
      // Redirect to dashboard
    }
  };

  const handleTwoFactorVerify = async (code) => {
    const res = await fetch('/api/donor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...loginForm,
        twoFactorCode: code,
      }),
    });

    const data = await res.json();
    
    if (res.ok) {
      localStorage.setItem('token', data.token);
      // Redirect to dashboard
    } else {
      throw new Error(data.error || 'Invalid code');
    }
  };

  return (
    <div>
      {/* Login form */}
      <form onSubmit={handleLogin}>
        {/* Email and password inputs */}
      </form>

      {/* 2FA Modal */}
      <TwoFactorVerification
        isOpen={showTwoFactorModal}
        onClose={() => setShowTwoFactorModal(false)}
        onVerify={handleTwoFactorVerify}
        email={loginForm.email}
      />
    </div>
  );
}
```

## 3. API Endpoints Reference

### Enable 2FA
```javascript
POST /api/two-factor/enable
Headers: Authorization: Bearer <token>
Body: { userType: 'user' | 'donor' | 'organization' }

Response: {
  success: true,
  secret: 'base32secret',
  qrCode: 'data:image/png;base64,...',
  otpauth_url: 'otpauth://totp/...'
}
```

### Verify Setup
```javascript
POST /api/two-factor/verify-setup
Headers: Authorization: Bearer <token>
Body: { 
  token: '123456',
  userType: 'user' | 'donor' | 'organization'
 }

Response: {
  success: true,
  message: 'Two-factor authentication has been successfully enabled'
}
```

### Disable 2FA
```javascript
POST /api/two-factor/disable
Headers: Authorization: Bearer <token>
Body: { 
  password: 'userpassword',
  userType: 'user' | 'donor' | 'organization'
 }

Response: {
  success: true,
  message: 'Two-factor authentication has been successfully disabled'
}
```

### Check Status
```javascript
GET /api/two-factor/status?userType=donor
Headers: Authorization: Bearer <token>

Response: {
  success: true,
  twoFactorEnabled: true/false
}
```

## 4. User Instructions

### Setting Up 2FA

1. **Install an Authenticator App** (if you don't have one):
   - Google Authenticator (iOS/Android)
   - Microsoft Authenticator (iOS/Android)
   - Authy (iOS/Android)
   - Any TOTP-compatible app

2. **Enable 2FA**:
   - Go to your account Settings
   - Find "Two-Factor Authentication" section
   - Click "Enable Two-Factor Authentication"
   - A QR code will appear

3. **Scan QR Code**:
   - Open your authenticator app
   - Tap "Add Account" or "+"
   - Choose "Scan QR Code"
   - Point your camera at the QR code on screen

4. **Verify Setup**:
   - Enter the 6-digit code shown in your authenticator app
   - Click "Verify and Enable"
   - 2FA is now active!

### Logging In with 2FA

1. Enter your email and password as usual
2. After clicking "Login", a modal will appear asking for your 2FA code
3. Open your authenticator app
4. Find the code for "ChangeWorks"
5. Enter the 6-digit code
6. Click "Verify"
7. You'll be logged in!

### Disabling 2FA

1. Go to Settings → Two-Factor Authentication
2. Click "Disable Two-Factor Authentication"
3. Enter your password to confirm
4. 2FA will be disabled

## 5. Testing

### Test the Complete Flow

1. **Enable 2FA**:
   ```bash
   # Login to your account
   # Go to Settings
   # Enable 2FA
   # Scan QR code with authenticator app
   # Verify with code
   ```

2. **Test Login**:
   ```bash
   # Logout
   # Try to login
   # Should see 2FA modal
   # Enter code from authenticator app
   # Should login successfully
   ```

3. **Test Invalid Code**:
   ```bash
   # Try logging in with wrong 2FA code
   # Should show error message
   ```

4. **Test Disable**:
   ```bash
   # Go to Settings
   # Disable 2FA
   # Enter password
   # Try logging in - should NOT ask for 2FA code
   ```

## 6. Troubleshooting

### Common Issues

**Issue**: QR code not showing
- **Solution**: Check browser console for errors. Ensure the API endpoint is working.

**Issue**: "Invalid code" error
- **Solution**: 
  - Make sure your device time is synchronized
  - Check that you're entering the code from the correct account
  - Try waiting for a new code (codes refresh every 30 seconds)

**Issue**: Can't disable 2FA
- **Solution**: Make sure you're entering the correct password

**Issue**: Lost access to authenticator app
- **Solution**: Contact support. They may need to disable 2FA manually from the database.

## 7. Security Best Practices

1. **Backup Codes**: Consider implementing backup codes for account recovery
2. **Multiple Devices**: Users can add the same account to multiple authenticator apps
3. **Time Sync**: Ensure server time is synchronized (NTP)
4. **Rate Limiting**: The login endpoints should have rate limiting to prevent brute force

## 8. Files Created/Modified

### New Files:
- `src/app/lib/two-factor.js` - 2FA utility functions
- `src/app/components/TwoFactorSetup.jsx` - Setup component
- `src/app/components/TwoFactorVerification.jsx` - Login verification modal
- `src/app/api/two-factor/enable/route.js` - Enable endpoint
- `src/app/api/two-factor/verify-setup/route.js` - Verify setup endpoint
- `src/app/api/two-factor/disable/route.js` - Disable endpoint
- `src/app/api/two-factor/verify/route.js` - Verify code endpoint
- `src/app/api/two-factor/status/route.js` - Status check endpoint

### Modified Files:
- `prisma/schema.prisma` - Added 2FA fields
- `src/app/api/login/route.js` - Added 2FA check
- `src/app/api/donor/login/route.js` - Added 2FA check
- `src/app/api/organization/login/route.js` - Added 2FA check
- `src/app/login/page.js` - Added 2FA verification modal

## Need Help?

If you encounter any issues:
1. Check browser console for errors
2. Check server logs
3. Verify database schema is updated
4. Ensure all dependencies are installed (`speakeasy`, `qrcode`)




