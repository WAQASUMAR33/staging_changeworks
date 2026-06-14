import { prisma } from '../../../../lib/prisma';
import { corsHeaders } from '@/app/lib/cors';

/**
 * GHL Marketplace App - Uninstall Webhook
 *
 * GHL sends a POST here when a user uninstalls the app.
 * Body: { companyId, locationId, userId, appId }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { companyId, locationId, userId, appId } = body;

    console.log('GHL app uninstall received', { companyId, locationId, userId, appId });

    if (!locationId) {
      return Response.json({ success: false, message: 'locationId is required' }, { status: 400 });
    }

    // Mark installation as uninstalled — keep record for audit trail
    await prisma.gHLAppInstallation.updateMany({
      where: { location_id: locationId },
      data:  { status: 'uninstalled', updated_at: new Date() },
    });

    console.log('GHL installation marked uninstalled for location:', locationId);

    return Response.json({ success: true, message: 'Uninstall acknowledged' });

  } catch (error) {
    console.error('GHL uninstall webhook error', error.message);
    return Response.json(
      { success: false, message: 'Uninstall handler failed', error: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
