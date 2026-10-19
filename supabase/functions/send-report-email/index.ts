// Supabase Edge Function: send-report-email
//
// Deploy with the Supabase CLI:
//   supabase functions deploy send-report-email
//   supabase secrets set RESEND_API_KEY=your_resend_api_key_here
//
// Requires a free Resend account (resend.com) — their free tier covers a
// realistic small-lab volume. You'll also need to verify a sending domain
// in Resend (or use their shared onboarding domain for testing only; real
// clients should verify their own lab's domain so email doesn't land in
// spam and doesn't say "via resend.dev").
//
// This function is called from the frontend with the Supabase anon key
// (via supabase.functions.invoke), but only performs the one narrow action
// it's built for — it does not expose the RESEND_API_KEY to the browser,
// which is the whole reason this has to be a server-side function rather
// than called directly from the app.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_ADDRESS = Deno.env.get('REPORT_EMAIL_FROM') || 'reports@yourlab.example.com';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured on the server.' }), { status: 500 });
  }

  try {
    const { to, patientName, labId, labName, pdfBase64 } = await req.json();

    if (!to || !patientName || !labId || !pdfBase64) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), { status: 400 });
    }

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${labName || 'Laboratory'} <${FROM_ADDRESS}>`,
        to: [to],
        subject: `Your Lab Report — ${labId}`,
        html: `<p>Dear ${patientName},</p>
               <p>Please find your diagnostic report (Lab ID: ${labId}) attached.</p>
               <p>This is an automated message from ${labName || 'the laboratory'}.</p>`,
        attachments: [
          {
            filename: `report-${labId}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      return new Response(JSON.stringify({ error: `Resend API error: ${errText}` }), { status: 502 });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
