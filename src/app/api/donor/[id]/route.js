import { corsHeaders } from '@/app/lib/cors';

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
