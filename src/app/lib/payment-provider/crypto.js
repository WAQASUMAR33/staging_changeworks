/**
 * lib/payment-provider/crypto.js
 * CSRF state token helpers for OAuth flows.
 */

import { randomBytes, createHmac } from 'crypto';

const SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fallback-dev-secret-change-in-prod';

export function generateStateToken(data = {}) {
  const nonce = randomBytes(16).toString('hex');
  const payload = Buffer.from(JSON.stringify({ ...data, nonce })).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyStateToken(token) {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) throw new Error('Invalid state token format');
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (expected !== sig) throw new Error('State token signature mismatch');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
}
