/**
 * First-pass JSON generator using Claude vision.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/vision-import.ts path/to/map.jpg
 *
 * Output:
 *   path/to/map-annotated.json  (ready to import into the Venue Annotator)
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const PROMPT = `You are analyzing a venue/exhibition floor map image.

For every stall, booth, café, lounge, or special area visible, estimate its bounding rectangle in pixels relative to the full image dimensions (top-left origin).

Return ONLY valid JSON — no prose, no markdown fences — in exactly this schema:

{
  "refWidth": <image width in px>,
  "refHeight": <image height in px>,
  "stalls": [
    {
      "id": "stall-1",
      "label": "<exact name printed on the stall>",
      "x": <left edge px>,
      "y": <top edge px>,
      "w": <width px>,
      "h": <height px>,
      "type": "<brand|cafe|lounge|feature|directory|service|entry|exit>"
    }
  ],
  "navNodes": [],
  "navEdges": []
}

Type rules:
- "brand"     → regular exhibitor stall
- "cafe"      → coffee / food / drink area
- "lounge"    → seating / networking lounge
- "feature"   → sponsor highlight, main stage, central feature
- "directory" → information board, directory panel
- "service"   → registration, box office, help desk
- "entry"     → entrance
- "exit"      → exit

Be as precise as possible. Cover every labelled area you can see.`;

async function run(imagePath: string) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('❌  Set ANTHROPIC_API_KEY environment variable first.');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`❌  File not found: ${imagePath}`);
    process.exit(1);
  }

  const ext = path.extname(imagePath).slice(1).toLowerCase();
  const mediaType =
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    ext === 'png' ? 'image/png' :
    ext === 'gif' ? 'image/gif' :
    ext === 'webp' ? 'image/webp' : null;

  if (!mediaType) {
    console.error('❌  Unsupported image format. Use jpg, png, gif, or webp.');
    process.exit(1);
  }

  console.log(`📷  Reading ${imagePath}…`);
  const imageData = fs.readFileSync(imagePath).toString('base64');

  const client = new Anthropic({ apiKey: key });

  console.log('🤖  Asking Claude to analyse the map…');

  let response;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 8096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: imageData } },
            { type: 'text', text: PROMPT },
          ],
        }],
      });
      break; // success
    } catch (err: any) {
      const status = err?.status ?? 0;
      if ((status === 502 || status === 503 || status === 529) && attempt < 3) {
        const wait = attempt * 5;
        console.log(`⚠️  Server error (${status}), retrying in ${wait}s… (attempt ${attempt}/3)`);
        await new Promise(r => setTimeout(r, wait * 1000));
      } else {
        throw err;
      }
    }
  }
  if (!response) throw new Error('All retries failed');

  const rawText = response.content.find(c => c.type === 'text')?.text ?? '';

  // Strip any accidental markdown code fences
  const jsonText = rawText.replace(/^```[a-z]*\n?/m, '').replace(/\n?```$/m, '').trim();

  let data: object;
  try {
    data = JSON.parse(jsonText);
  } catch {
    console.error('❌  Claude returned invalid JSON. Raw response saved to vision-raw.txt');
    fs.writeFileSync('vision-raw.txt', rawText);
    process.exit(1);
  }

  const outPath = imagePath.replace(/\.[^.]+$/, '-annotated.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

  const stallCount = (data as any).stalls?.length ?? 0;
  console.log(`✅  Done! Found ${stallCount} stalls.`);
  console.log(`📄  Saved to: ${outPath}`);
  console.log(`\nNext step: open the Venue Annotator, upload the image,`);
  console.log(`then click 📂 Import and select ${path.basename(outPath)}.`);
}

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: ANTHROPIC_API_KEY=sk-... npx tsx scripts/vision-import.ts <image.jpg>');
  process.exit(1);
}

run(imagePath).catch(err => {
  console.error('❌ ', err.message);
  process.exit(1);
});
