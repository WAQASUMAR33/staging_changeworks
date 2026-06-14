'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function GhlConnectedContent() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId');
  const error      = searchParams.get('error');
  const detail     = searchParams.get('detail');

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Connection Failed</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
            {detail ? decodeURIComponent(detail) : 'The GHL connection could not be completed. Please try again.'}
          </p>
          <a
            href="/organization/login"
            style={{ display: 'inline-block', background: '#0E0061', color: '#fff', padding: '12px 28px', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>GHL Connected Successfully!</h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
          Your GoHighLevel location has been connected to ChangeWorks.
        </p>
        {locationId && (
          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 24, background: '#f3f4f6', padding: '8px 12px', borderRadius: 6 }}>
            Location ID: <strong>{locationId}</strong>
          </p>
        )}
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 32 }}>
          Log in to your ChangeWorks organization dashboard to connect your Stripe account and complete the setup.
        </p>
        <a
          href="/organization/login"
          style={{ display: 'inline-block', background: '#0E0061', color: '#fff', padding: '12px 28px', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
        >
          Log in to Dashboard
        </a>
      </div>
    </div>
  );
}

export default function GhlConnectedPage() {
  return (
    <Suspense>
      <GhlConnectedContent />
    </Suspense>
  );
}
