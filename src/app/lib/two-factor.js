import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

/**
 * Generate a 2FA secret for a user
 * @param {string} email - User's email
 * @param {string} serviceName - Name of the service (e.g., "ChangeWorks")
 * @returns {Object} - Secret object with secret, otpauth_url, and QR code data URL
 */
export async function generateTwoFactorSecret(email, serviceName = 'ChangeWorks') {
  const secret = speakeasy.generateSecret({
    name: `${serviceName} (${email})`,
    issuer: serviceName,
    length: 32,
  });

  // Generate QR code data URL
  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
    qrCode: qrCodeDataUrl,
  };
}

/**
 * Verify a 2FA token
 * @param {string} token - The 6-digit code from the authenticator app
 * @param {string} secret - The user's 2FA secret (base32)
 * @returns {boolean} - True if token is valid
 */
export function verifyTwoFactorToken(token, secret) {
  if (!token || !secret) {
    return false;
  }

  // Remove any spaces from token
  const cleanToken = token.replace(/\s/g, '');

  // Verify token with a window of 1 (allows for slight clock skew)
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: cleanToken,
    window: 1, // Allow 1 time step (30 seconds) before/after current time
  });
}

/**
 * Generate a temporary token for 2FA verification during setup
 * @param {string} token - The 6-digit code from the authenticator app
 * @param {string} secret - The user's 2FA secret (base32)
 * @returns {boolean} - True if token is valid
 */
export function verifyTwoFactorSetup(token, secret) {
  return verifyTwoFactorToken(token, secret);
}




