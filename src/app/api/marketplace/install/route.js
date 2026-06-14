import { corsHeaders } from '@/app/lib/cors';
/**
 * Public-facing OAuth redirect URL (no third-party brand references in the path).
 * Register this in the payment provider portal as:
 *   https://app.changeworksfund.org/api/ghl_api/marketplace/install
 *
 * Delegates all logic to the internal handler.
 */
export { GET } from '../../ghl_api/marketplace/install/route';

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
