export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { constructWebhookEvent, getPaymentIntentWithCharge } from '@/app/lib/payment-provider/stripe';
import {
  getLocationByStripeAccount, upsertPaymentEvent, getPaymentEventByEntityId,
  isWebhookProcessed, createWebhookLog, updateWebhookLog,
} from '@/app/lib/payment-provider/tokenStore';
import { postPaymentUpdateToGHL, postSubscriptionUpdateToGHL, getContactByEmail, getTransaction } from '@/app/lib/payment-provider/ghl';
import { prisma } from '@/app/lib/prisma';
import { emailService } from '@/app/lib/email-service';
import { corsHeaders } from '@/app/lib/cors';

/**
 * After a successful GHL payment, auto-create a donor account (status=false until
 * email verified) and send a white-label verification email.
 */
async function maybeCreateDonorAccount({ customerEmail, customerName, customerPhone, locationId, stripeAccountId, ghlTransactionId }) {
  if (!customerEmail) return;

  try {
    // Check if donor already exists
    const existing = await prisma.donor.findFirst({
      where: { email: customerEmail.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      console.log(`[donor-auto-create] Donor already exists for ${customerEmail} — skipping`);
      return;
    }

    // Resolve organization: try locationId first, then fall back to stripeAccountId
    let organizationId = null;
    let organization = null;
    if (locationId) {
      organization = await prisma.organization.findFirst({
        where: {
          OR: [
            { ghlId: locationId },
            { ghlAccounts: { some: { ghl_location_id: locationId } } },
          ],
        },
        select: { id: true, name: true, imageUrl: true },
      });
    }
    if (!organization && stripeAccountId) {
      organization = await prisma.organization.findFirst({
        where: { stripeAccountId },
        select: { id: true, name: true, imageUrl: true },
      });
    }
    if (organization) organizationId = organization.id;
    console.log(`[donor-auto-create] Org resolved: ${organization?.name ?? 'none'} (locationId=${locationId}, stripeAccountId=${stripeAccountId})`);

    // Generate a random password (hashed)
    const rawPassword = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const email = customerEmail.toLowerCase().trim();
    const emailPrefix = email.split('@')[0];

    // A "real" name must contain a space or differ from the email prefix
    function isRealName(n) {
      if (!n) return false;
      const v = n.trim();
      if (!v) return false;
      if (v.includes('@')) return false;               // looks like an email
      if (v.toLowerCase() === emailPrefix.toLowerCase()) return false; // same as email prefix
      return true;
    }

    // Resolve first name: Stripe metadata → GHL transaction contactSnapshot → GHL contact lookup → 'Donor'
    let resolvedName = isRealName(customerName) ? customerName.trim() : null;
    if (!resolvedName && ghlTransactionId && locationId) {
      try {
        const txn = await getTransaction(locationId, ghlTransactionId);
        const snap = Array.isArray(txn) ? txn[0]?.contactSnapshot : txn?.contactSnapshot;
        const first = snap?.firstName?.trim() || null;
        const last  = snap?.lastName?.trim()  || null;
        const full  = snap?.fullNameLowerCase  || null;
        resolvedName = isRealName(first) ? first
                     : isRealName(last)  ? last
                     : (full ? full.split(' ')[0] : null);
      } catch {}
    }
    if (!resolvedName) {
      try {
        const contact = await getContactByEmail(locationId || '', email);
        const ghlFirst = contact?.firstName?.trim() || null;
        const ghlFull  = contact?.name?.trim() || null;
        resolvedName = isRealName(ghlFirst) ? ghlFirst
                     : isRealName(ghlFull)  ? ghlFull.split(' ')[0]
                     : null;
      } catch {}
    }
    const name = resolvedName || 'Donor';

    // Create donor with status=true (active immediately — no email verification required)
    await prisma.donor.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: customerPhone || null,
        country: 'US',
        status: true,
        ...(organizationId ? { organization_id: organizationId } : {}),
      },
    });

    console.log(`[donor-auto-create] Created donor account for ${email} (org: ${organizationId ?? 'none'})`);

    const orgName = organization?.name || 'ChangeWorks';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
    const loginUrl = `${baseUrl}/donor/login`;
    const logoUrl = emailService.getOrganizationLogoUrl(organization);

    const subject = `Welcome to ${orgName}'s Donation Community`;

    const html = emailService.generateEmailHtml(`
      <div style="text-align:center;margin-bottom:30px;">
        ${logoUrl ? `<img src="${logoUrl}" alt="${orgName}" style="max-height:100px;max-width:220px;height:auto;border:0;display:block;margin:0 auto 12px auto;">` : ''}
        <h2 style="color:#302E56;margin:0;font-size:22px;font-weight:700;">${orgName}</h2>
      </div>

      <p style="font-size:18px;font-weight:500;color:#212529;margin-bottom:20px;">Hello ${name}</p>

      <p>Thank you for supporting our work financially with your donation. Your generosity truly matters to us, and we want giving to feel simple and effortless.</p>

      <p>That's why you have your own donor dashboard with our trusted donation platform partner, <strong>ChangeWorks</strong>. It puts everything you need in one place:</p>

      <ul style="color:#495057;">
        <li><strong>See your monthly donation totals</strong> whenever you'd like</li>
        <li><strong>Adjust or pause your contributions</strong> if your needs change</li>
        <li><strong>Download your donation records</strong> for easy reference or tax time</li>
      </ul>

      <p>Your account is ready. Here are your login credentials:</p>

      <div style="background-color:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:20px 24px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#6c757d;width:120px;">Email</td>
            <td style="padding:6px 0;font-size:15px;color:#212529;font-weight:600;">${email}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#6c757d;">Password</td>
            <td style="padding:6px 0;font-size:15px;color:#212529;font-weight:600;">${rawPassword}</td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;margin:28px 0;">
        <a href="${loginUrl}" style="display:inline-block;background-color:#302E56;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:24px;font-weight:600;font-size:15px;letter-spacing:.02em;">LOGIN TO YOUR DASHBOARD</a>
      </div>

      <p>If you ever have a question or just want to reach out, we'd love to hear from you. We're grateful to have you with us.</p>

      <div style="margin-top:30px;font-style:italic;color:#495057;">
        <p>Warm regards,<br><strong>The ${orgName} Team</strong></p>
      </div>

      <p style="margin-top:20px;font-size:14px;color:#6c757d;"><strong>P.S.</strong> At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.</p>

      ${emailService.getFooterHtml()}
    `, null, subject, false, false);

    await emailService.sendEmail({
      to: email,
      subject,
      html,
      text: `Welcome to ${orgName}'s Donation Community\n\nHello ${name},\n\nThank you for supporting our work financially with your donation. Your generosity truly matters to us, and we want giving to feel simple and effortless.\n\nThat's why you have your own donor dashboard with our trusted donation platform partner, ChangeWorks. It puts everything you need in one place:\n- See your monthly donation totals whenever you'd like\n- Adjust or pause your contributions if your needs change\n- Download your donation records for easy reference or tax time\n\nYour account is ready. Here are your login credentials:\nEmail: ${email}\nPassword: ${rawPassword}\n\nLogin to your dashboard: ${loginUrl}\n\nIf you ever have a question or just want to reach out, we'd love to hear from you. We're grateful to have you with us.\n\nWarm regards,\nThe ${orgName} Team\n\nP.S. At the end of each month, we'll send you an update with your 30-day total, so you can see the difference you've made.`,
      from: `"${orgName}" <${process.env.EMAIL_FROM || 'info@changeworksfund.org'}>`,
    });

    console.log(`[donor-auto-create] Verification email sent to ${email}`);
  } catch (err) {
    // Non-fatal — payment already succeeded
    console.error('[donor-auto-create] Failed:', err.message, err.stack);
  }
}

export async function POST(request) {
  const rawBody   = await request.text();
  const signature = request.headers.get('stripe-signature');

  // Diagnostic: log sig header prefix and body snippet to help diagnose secret mismatches
  const sigTs = signature?.match(/t=(\d+)/)?.[1] ?? 'none';
  const sigV1 = signature?.match(/v1=([^,]+)/)?.[1]?.slice(0, 16) ?? 'none';
  console.log(`[Stripe Webhook] bodyLen=${rawBody.length} sigT=${sigTs} sigV1prefix=${sigV1}`);

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event;
  try {
    event = await constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (await isWebhookProcessed(event.id)) {
    return NextResponse.json({ received: true, skipped: true });
  }

  const stripeAccountId = event.account;
  const livemode = event.livemode ?? false;
  console.log(`[Stripe Webhook] type=${event.type} livemode=${livemode} account=${stripeAccountId ?? 'platform'}`);
  const locationId = stripeAccountId ? await getLocationByStripeAccount(stripeAccountId) : null;

  await createWebhookLog({ source: 'STRIPE', eventId: event.id, eventType: event.type, locationId: locationId ?? undefined, payload: event });

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        let customerName  = intent.metadata?.customerName  ?? null;
        let customerEmail = intent.metadata?.customerEmail ?? intent.receipt_email ?? null;
        let customerPhone = intent.metadata?.customerPhone ?? null;
        console.log(`[Stripe Webhook] payment_intent.succeeded | id=${intent.id} | livemode=${livemode} | locationId=${locationId ?? intent.metadata?.locationId ?? 'none'} | emailFromMeta=${customerEmail ?? 'none'}`);
        try {
          const full    = await getPaymentIntentWithCharge(intent.id, stripeAccountId, livemode);
          const billing = full.latest_charge?.billing_details ?? {};
          const custObj = typeof full.customer === 'object' ? full.customer : null;
          customerName  = billing.name || custObj?.name || customerName;
          customerEmail = billing.email || custObj?.email || customerEmail;
          customerPhone = billing.phone || custObj?.phone || customerPhone;
          console.log(`[Stripe Webhook] expanded billing | email=${customerEmail ?? 'none'} name=${customerName ?? 'none'}`);
        } catch (expandErr) {
          console.error(`[Stripe Webhook] getPaymentIntentWithCharge failed (livemode=${livemode}):`, expandErr.message);
        }
        console.log(`[Stripe Webhook] resolved customer | email=${customerEmail ?? 'MISSING — donor will NOT be created'}`);
        await upsertPaymentEvent({
          locationId: locationId ?? intent.metadata?.locationId, stripeAccountId: stripeAccountId ?? '',
          paymentIntentId: intent.id, entityId: intent.metadata?.entityId,
          entityType: intent.metadata?.entityType ?? 'invoice', amount: intent.amount, currency: intent.currency,
          status: 'SUCCESS', customerName, customerEmail, customerPhone, metadata: intent.metadata,
        });

        // Auto-create donor account only for confirmed GHL payments
        if (intent.status === 'succeeded') {
          const resolvedLocationId = locationId ?? intent.metadata?.locationId ?? null;
          console.log(`[Stripe Webhook] calling maybeCreateDonorAccount | email=${customerEmail} locationId=${resolvedLocationId}`);
          await maybeCreateDonorAccount({ customerEmail, customerName, customerPhone, locationId: resolvedLocationId, stripeAccountId, ghlTransactionId: intent.metadata?.ghlTransactionId ?? intent.metadata?.entityId ?? null });
        }

        if (locationId) {
          let chargeId = intent.id;
          if (intent.metadata?.entityId) {
            try {
              const pi1Event = await getPaymentEventByEntityId(locationId, intent.metadata.entityId);
              if (pi1Event && pi1Event.paymentIntentId !== intent.id) chargeId = pi1Event.paymentIntentId;
            } catch {}
          }
          const ghlTransactionId = intent.metadata?.ghlTransactionId ?? intent.metadata?.entityId ?? null;
          try {
            await postPaymentUpdateToGHL(locationId, { chargeId, ghlTransactionId, amount: intent.amount });
          } catch (ghlErr) {
            console.error('[Stripe Webhook] GHL payment update failed:', ghlErr.response?.status, JSON.stringify(ghlErr.response?.data ?? ghlErr.message));
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        await upsertPaymentEvent({
          locationId: locationId ?? intent.metadata?.locationId, stripeAccountId: stripeAccountId ?? '',
          paymentIntentId: intent.id, entityId: intent.metadata?.entityId,
          entityType: intent.metadata?.entityType ?? 'invoice', amount: intent.amount, currency: intent.currency,
          status: 'FAILED', failureReason: intent.last_payment_error?.message ?? null,
          customerName: intent.metadata?.customerName ?? null,
          customerEmail: intent.metadata?.customerEmail ?? intent.receipt_email ?? null,
          customerPhone: intent.metadata?.customerPhone ?? null, metadata: intent.metadata,
        });
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        await upsertPaymentEvent({
          locationId: locationId ?? charge.metadata?.locationId, stripeAccountId: stripeAccountId ?? '',
          paymentIntentId: charge.payment_intent, entityId: charge.metadata?.entityId,
          entityType: charge.metadata?.entityType ?? 'invoice', amount: charge.amount, currency: charge.currency,
          status: charge.amount_refunded === charge.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          refundedAmount: charge.amount_refunded, metadata: charge.metadata,
        });
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        if (locationId) {
          const ghlSubscriptionId = sub.metadata?.ghlSubscriptionId ?? sub.metadata?.entityId;
          try {
            await postSubscriptionUpdateToGHL(locationId, { externalSubscriptionId: sub.id, status: sub.status, entityId: ghlSubscriptionId });
          } catch (ghlErr) {
            console.error('[Stripe Webhook] GHL subscription update failed:', ghlErr.response?.status, JSON.stringify(ghlErr.response?.data ?? ghlErr.message));
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        if (locationId) {
          const ghlSubscriptionId = sub.metadata?.ghlSubscriptionId ?? sub.metadata?.entityId;
          try {
            await postSubscriptionUpdateToGHL(locationId, { externalSubscriptionId: sub.id, status: 'canceled', entityId: ghlSubscriptionId });
          } catch {}
        }
        break;
      }
      default:
        await updateWebhookLog(event.id, 'SKIPPED');
        return NextResponse.json({ received: true });
    }
    await updateWebhookLog(event.id, 'PROCESSED');
  } catch (err) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, err.message);
    await updateWebhookLog(event.id, 'FAILED', err.message);
  }

  return NextResponse.json({ received: true });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
