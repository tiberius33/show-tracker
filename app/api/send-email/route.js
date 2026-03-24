import { NextResponse } from 'next/server';

export async function POST(request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY not configured. Set it in Netlify Site settings > Environment variables.' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { to, subject, html } = body;
  if (!to || !subject || !html) {
    return NextResponse.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Phillip <phillip@mysetlists.net>',
        to,
        subject,
        html,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, id: data.id });
    } else {
      const errText = await res.text();
      console.error('Resend API error:', res.status, errText);
      return NextResponse.json({ error: 'Email send failed', details: errText }, { status: res.status });
    }
  } catch (err) {
    console.error('Resend request failed:', err);
    return NextResponse.json({ error: 'Request failed', details: err.message }, { status: 500 });
  }
}
