const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_H = { 'Content-Type': 'application/json', ...CORS };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 required' }), { status: 400, headers: JSON_H });
    }

    const visionKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
    if (!visionKey) {
      return new Response(JSON.stringify({ error: 'Vision API key not configured' }), { status: 500, headers: JSON_H });
    }

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          }],
        }),
      }
    );

    if (!visionRes.ok) {
      const err = await visionRes.text();
      console.error('Vision API error:', err);
      return new Response(JSON.stringify({ error: 'Vision API request failed', detail: err }), { status: 502, headers: JSON_H });
    }

    const data = await visionRes.json();
    return new Response(JSON.stringify(data), { headers: JSON_H });

  } catch (e) {
    console.error('Unhandled error:', String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: JSON_H });
  }
});
