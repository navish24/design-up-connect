const JSON_HEADERS = { 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  try {
    const { user, email_data } = await req.json();
    const toEmail: string = user.email;
    const otp: string = email_data.token;

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500, headers: JSON_HEADERS });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Connect <onboarding@resend.dev>',
        to: [toEmail],
        subject: 'Your Connect verification code',
        text: `Your Connect verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
      }),
    });

    const data = await res.json();
    console.log('Resend response:', JSON.stringify(data));

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.message ?? 'Email failed' }), { status: 500, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({}), { status: 200, headers: JSON_HEADERS });
  } catch (e) {
    console.error('Unhandled error:', String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: JSON_HEADERS });
  }
});
