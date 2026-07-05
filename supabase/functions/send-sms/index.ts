const JSON_HEADERS = { 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  try {
    const { user, sms } = await req.json();
    const phone: string = user.phone;
    const otp: string = sms.otp;

    const apiKey = Deno.env.get('FAST2SMS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'FAST2SMS_API_KEY not set' }), { status: 500, headers: JSON_HEADERS });
    }

    // Fast2SMS expects 10-digit number without country code
    const phoneDigits = phone.replace(/^\+91/, '').replace(/^\+/, '');
    console.log('Sending OTP to:', phoneDigits);

    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=otp&variables_values=${otp}&flash=0&numbers=${phoneDigits}`;
    const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
    const raw = await res.text();
    console.log('Fast2SMS response:', raw);

    let data: { return?: boolean; message?: string[] };
    try {
      data = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: raw }), { status: 500, headers: JSON_HEADERS });
    }

    if (!data.return) {
      return new Response(JSON.stringify({ error: data.message?.[0] ?? 'SMS failed' }), { status: 500, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({}), { status: 200, headers: JSON_HEADERS });
  } catch (e) {
    console.error('Unhandled error:', String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: JSON_HEADERS });
  }
});
