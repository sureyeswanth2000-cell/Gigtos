import React from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '48px 24px 96px', color: 'var(--text-main)' }}>
      <section style={{
        border: '1px solid var(--border-light)',
        borderRadius: 8,
        background: 'var(--bg-surface)',
        padding: 28,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <span style={{ color: 'var(--primary-purple)', fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
          Gigtos privacy
        </span>
        <h1 style={{ margin: '8px 0 12px', letterSpacing: 0 }}>Privacy Policy</h1>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Last updated: June 13, 2026. Gigtos collects only the information needed to operate a trusted home-services marketplace,
          protect users and workers, and improve service quality.
        </p>

        {[
          ['Information We Collect', 'Account details such as name, phone, email, profile photo, city, area, state, postal code, booking history, worker verification submissions, support messages, safety events, and limited device or log data needed for security and reliability.'],
          ['How We Use Information', 'We use data to create accounts, match consumers with verified workers, show booking status, support disputes, prevent fraud, calculate trusted GigScore events, send operational alerts, and maintain platform safety.'],
          ['Location Data', 'Location is used for nearby matching, travel status, ETA, safety, and service-area checks. Exact live location is shown only where needed for an active booking or worker travel/work state.'],
          ['Photos And Verification', 'Profile, work proof, before/after job photos, and worker verification files are used for trust, dispute handling, and human review. Sensitive verification data is not shown in normal consumer views.'],
          ['AI And Monitoring', 'AI systems receive sanitized summaries only. We do not send raw bank details, private tokens, full identity documents, exact private addresses, or private chat payloads to AI summaries.'],
          ['Payments And Bank Details', 'Refund or payout bank details are used only for payment/refund operations and are protected. Worker payout account updates go through backend-controlled paths.'],
          ['Sharing', 'We share only what is needed between booking participants, admins, support reviewers, infrastructure providers, and legally required authorities. We do not sell personal data.'],
          ['Security', 'Gigtos uses Firebase security rules, App Check, role-based access, audit logs, monitoring, and manual review for sensitive actions. No client app should be trusted as an authority for final decisions.'],
          ['Your Choices', 'You can update profile details in the app, request support for corrections, and ask for account/data review where legally available. Some records may be retained for safety, dispute, fraud, or legal reasons.'],
          ['Contact', 'For privacy or safety questions, contact Gigtos support from the app or email the founder/admin support address used for your launch region.'],
        ].map(([title, body]) => (
          <section key={title} style={{ marginTop: 24 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>{title}</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.7 }}>{body}</p>
          </section>
        ))}

        <div style={{ marginTop: 30, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/services" style={{
            background: 'var(--primary-purple)',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 8,
            padding: '11px 16px',
            fontWeight: 900,
          }}>
            View Services
          </Link>
          <Link to="/workers" style={{
            border: '1px solid var(--border-light)',
            color: 'var(--text-main)',
            textDecoration: 'none',
            borderRadius: 8,
            padding: '11px 16px',
            fontWeight: 900,
          }}>
            Worker Info
          </Link>
        </div>
      </section>
    </main>
  );
}
