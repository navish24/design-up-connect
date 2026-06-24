import type { CardContactField } from '../types';

// ── Regex patterns ────────────────────────────────────────────────────────────

// Indian mobile:  +91 / 0 prefix, then 6–9 leading digit, 10 total digits
// Indian landline: +91 [STD 2-4 digits] [local 3-4 digits] [4 digits]  (e.g. +91 484 270 0090)
// International:   +country-code + digits
const PHONE_RE =
  /(?:\+91[\s\-.]?|0)?[6-9]\d{4}[\s\-.]?\d{5}|\+91[\s\-.]?\d{2,4}[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}|\+\d{1,3}[\s\-.]?\d{3,5}[\s\-.]?\d{3,9}/g;

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// URLs — explicit www. or https:// prefix
const EXPLICIT_URL_RE =
  /(?:https?:\/\/)?(?:www\.)\S+\.(?:com|in|co|net|org|io|design|studio|agency|co\.in|com\.au)\S*/gi;

// Bare domains that look like a website (e.g. "studiomehta.com")
const BARE_DOMAIN_RE =
  /\b[a-zA-Z0-9\-]{2,}\.(?:com|in|co|net|org|io|design|studio|agency)\b(?:\/\S*)*/g;

const LINKEDIN_RE = /linkedin\.com\/in\/[\w\-]+/gi;
const INSTAGRAM_RE =
  /(?:instagram\.com\/|ig:\s*@?)[\w.]+|(?<![a-zA-Z0-9_])@[\w.]{3,30}(?![a-zA-Z0-9_@])/g;
const FACEBOOK_RE = /(?:facebook\.com\/|fb\.com\/|fb:\s*)[\w.\-]+/gi;
const TWITTER_RE = /(?:twitter\.com\/|x\.com\/|tw:\s*)[\w]+/gi;
const BEHANCE_RE = /behance\.net\/[\w]+/gi;
const YOUTUBE_RE = /youtube\.com\/(?:c\/|channel\/|@)[\w\-]+/gi;

// Address cues
const ADDRESS_KEYWORD_RE =
  /\b(street|road|nagar|marg|avenue|lane|plot|sector|floor|building|bhavan|house|tower|complex|industrial|estate|park|junction|circle|chowk|cross|layout|society|colony|phase|block|near|opp|opposite|behind|beside|no\.|#)\b/i;
const PIN_RE = /\b[1-9]\d{5}\b/;

// Designation keywords — "art" removed (too generic: matches "art collective" brand taglines)
const DESIGNATION_RE =
  /\b(founder|co-founder|ceo|cto|coo|cmo|cso|director|manager|architect|designer|engineer|consultant|associate|principal|partner|head|lead|senior|junior|intern|president|vice|vp|md|gm|dgm|cgm|officer|executive|strategist|illustrator|creative)\b/i;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OcrBlock {
  text: string;
  frameHeight?: number;
  frameWidth?: number;
  frameY?: number; // vertical position on card (0 = top)
}

// ── OCR artefact correction ───────────────────────────────────────────────────

// Apply known OCR misread fixes before regex parsing so downstream patterns
// work on corrected text rather than having to handle every variant.
const fixOcrArtifacts = (text: string): string =>
  text
    // "domain com" → "domain.com"  (period before TLD dropped by OCR)
    // Require all-lowercase so "Hyderabad in" or "Office com" are not affected.
    .replace(/\b([a-z][a-z0-9\-]{2,}(?:\.[a-z][a-z0-9\-]+)?)\s+com\b/g, '$1.com')
    // "domain. in" → "domain.in"  (space between dot and TLD, e.g. "navinarchitects. in")
    .replace(/\b([a-z][a-z0-9\-]+\.)\s+(in|com|co|net|org|io)\b/g, '$1$2')
    // "user.name @domain.com" → "user.name@domain.com"  (space before @)
    .replace(/([a-zA-Z0-9._%+\-]{2,})\s+@([a-zA-Z0-9\-]+\.[a-zA-Z]{2,})/g, '$1@$2')
    // "user@ domain.com" → "user@domain.com"  (space after @)
    .replace(/@\s+([a-zA-Z0-9\-]+\.[a-zA-Z]{2,})/g, '@$1')
    // "user@domain com" → "user@domain.com"  (space instead of dot inside email domain)
    // Targeting the @ boundary makes this unambiguous — only fires inside an email address.
    .replace(/(@[a-zA-Z0-9\-]+)\s+(com|in|co|net|org|io)\b/g, '$1.$2')
    // "infoOdomain.com" → "info@domain.com"  (@ misread as uppercase O)
    // Signature: lowercase run + lone uppercase O + lowercase run + .tld
    .replace(/\b([a-z][a-z0-9._+\-]*)O([a-z][a-z0-9.\-]*\.[a-z]{2,})\b/g, '$1@$2');

// ── Core parser ───────────────────────────────────────────────────────────────

export function parseCardFields(blocks: OcrBlock[]): CardContactField[] {
  const fields: CardContactField[] = [];
  const consumedRanges: Array<[number, number]> = [];

  const fullText = fixOcrArtifacts(blocks.map((b) => b.text).join('\n'));
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);

  function consume(match: string) {
    const idx = fullText.indexOf(match);
    if (idx !== -1) consumedRanges.push([idx, idx + match.length]);
  }

  function isConsumed(text: string): boolean {
    const idx = fullText.indexOf(text);
    if (idx === -1) return false;
    return consumedRanges.some(([s, e]) => idx >= s && idx + text.length <= e + 5);
  }

  // ── 1. LinkedIn (before generic URL so it isn't misclassified) ──────────────
  const liMatches = [...new Set(fullText.match(LINKEDIN_RE) ?? [])];
  for (const m of liMatches) {
    fields.push({ label: 'LinkedIn', value: m.replace(/^https?:\/\//, '') });
    consume(m);
  }

  // ── 2. Instagram ─────────────────────────────────────────────────────────────
  const igRaw = fullText.match(INSTAGRAM_RE) ?? [];
  const igMatches = [...new Set(igRaw)].filter((m) => {
    // Skip if this @ handle is actually inside an email already captured
    return !EMAIL_RE.test(m) && !m.includes('@gmail') && !m.includes('@yahoo') && !m.includes('@hotmail');
  });
  for (const m of igMatches) {
    if (isConsumed(m)) continue;
    const handle = m.match(/[\w.]+$/)?.[0] ?? m;
    fields.push({ label: 'Instagram', value: `@${handle.replace(/^@/, '')}` });
    consume(m);
  }

  // ── 3. Facebook ──────────────────────────────────────────────────────────────
  const fbMatches = [...new Set(fullText.match(FACEBOOK_RE) ?? [])];
  for (const m of fbMatches) {
    if (isConsumed(m)) continue;
    fields.push({ label: 'Facebook', value: m });
    consume(m);
  }

  // ── 4. Twitter/X ─────────────────────────────────────────────────────────────
  const twMatches = [...new Set(fullText.match(TWITTER_RE) ?? [])];
  for (const m of twMatches) {
    if (isConsumed(m)) continue;
    fields.push({ label: 'Twitter/X', value: m });
    consume(m);
  }

  // ── 4. Behance / YouTube ─────────────────────────────────────────────────────
  for (const m of fullText.match(BEHANCE_RE) ?? []) {
    if (!isConsumed(m)) { fields.push({ label: 'Behance', value: m }); consume(m); }
  }
  for (const m of fullText.match(YOUTUBE_RE) ?? []) {
    if (!isConsumed(m)) { fields.push({ label: 'YouTube', value: m }); consume(m); }
  }

  // ── 5. Emails ────────────────────────────────────────────────────────────────
  const emailMatches = [...new Set(fullText.match(EMAIL_RE) ?? [])];
  for (const m of emailMatches) {
    fields.push({ label: 'Email', value: m.toLowerCase() });
    consume(m);
  }

  // ── 6. Websites (after socials so linkedin/instagram URLs aren't re-added) ───
  const normalizeUrl = (u: string) =>
    u.replace(/^(?:https?:\/\/)?(?:www\.)?/, '').replace(/\/+$/, '').toLowerCase();
  // Email provider domains are never websites — they leak from broken email splits
  const EMAIL_PROVIDER_RE = /^(gmail|yahoo|hotmail|outlook|icloud|rediffmail|live|ymail)\.com$/;
  const urlsExplicit = fullText.match(EXPLICIT_URL_RE) ?? [];
  const urlsBare = fullText.match(BARE_DOMAIN_RE) ?? [];
  const allUrls = [...urlsExplicit, ...urlsBare].filter((u) => {
    const norm = normalizeUrl(u);
    return (
      !EMAIL_PROVIDER_RE.test(norm) &&
      !norm.includes('linkedin') &&
      !norm.includes('instagram') &&
      !norm.includes('facebook') &&
      !norm.includes('twitter') &&
      !norm.includes('behance') &&
      !norm.includes('youtube') &&
      !isConsumed(u)
    );
  });
  // Deduplicate by normalised domain — "www.foo.com/", "foo.com/", "foo.com"
  // are all the same site; keep only the first-seen variant for each domain.
  const seenUrls = new Map<string, string>();
  for (const url of allUrls) {
    const norm = normalizeUrl(url);
    if (!seenUrls.has(norm)) seenUrls.set(norm, url);
  }
  for (const url of seenUrls.values()) {
    fields.push({ label: 'Website', value: url.replace(/^https?:\/\//, '') });
    consume(url);
  }

  // ── 7. Phone numbers ─────────────────────────────────────────────────────────
  const phoneMatches = [...new Set(fullText.match(PHONE_RE) ?? [])].filter(
    (p) => p.replace(/\D/g, '').length >= 10
  );
  for (const m of phoneMatches) {
    if (isConsumed(m)) continue;
    // Check the 30 chars before this match for a "WhatsApp" hint
    const idx = fullText.indexOf(m);
    const prefix = fullText.slice(Math.max(0, idx - 30), idx).toLowerCase();
    const label =
      prefix.includes('whatsapp') || prefix.includes('wa:') || prefix.includes('wa ')
        ? 'WhatsApp'
        : 'Phone';
    fields.push({ label, value: m.trim() });
    consume(m);
  }

  // ── 8. Remaining text → Name / Company / Designation / Address / Other ───────
  // Drop already-extracted substrings (website/email/social handles etc.) from
  // each line before classifying it — otherwise a partially-consumed line like
  // "ftà theeminara.com" re-adds the whole line (domain and all) into Other/Company.
  const remaining = lines
    .filter((line) => line.length >= 2 && !isConsumed(line))
    .map((line) =>
      line
        .replace(PHONE_RE, '')
        .replace(EMAIL_RE, '')
        .replace(EXPLICIT_URL_RE, '')
        .replace(BARE_DOMAIN_RE, '')
        .replace(LINKEDIN_RE, '')
        .replace(INSTAGRAM_RE, '')
        .replace(FACEBOOK_RE, '')
        .replace(TWITTER_RE, '')
        .replace(BEHANCE_RE, '')
        .replace(YOUTUBE_RE, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    )
    .filter((line) => {
      if (line.length <= 1) return false;
      // Drop partial URL fragments left after stripping (e.g. "ww. /")
      if (/^ww?w?\s*[./]/.test(line.toLowerCase())) return false;
      // Drop bare label remnants after stripping (e.g. "M:", "W:", "E:", "O:")
      if (/^[A-Za-z]\s*:$/.test(line)) return false;
      // Drop single short alphabetic words (≤3 chars) — OCR noise from decorative
      // fonts, icon misreads, or partial glyphs (e.g. "tun", "ft", "O")
      if (/^[a-zA-Z]{1,3}$/.test(line)) return false;
      // Pipe "|" always means a separator was only partially stripped
      // (e.g. "+91 484 270 OO90 | www.espravo.com" after phone/url stripping → "OO90 |")
      if (/\|/.test(line)) return false;
      return true;
    });

  // A phone number that slipped past PHONE_RE (unusual spacing/format) is still
  // a phone number, not a Company/Other value — catch it before classification.
  const PHONE_LIKE_RE = /^[+\d][\d\s\-().]{6,}$/;
  const isPhoneLike = (text: string) =>
    PHONE_LIKE_RE.test(text) && text.replace(/\D/g, '').length >= 7;

  // A bare social handle (no @, no platform URL) — usually sits next to a
  // platform icon (Instagram/Facebook/etc.) that ML Kit can't read since it's
  // a graphic, not text. The icon's outline is sometimes misread as a single
  // stray character glued onto the handle (e.g. "Otheeminara") or, just as
  // often, OCR'd as its own separate token on the same line with a space
  // (e.g. "O theeminara") — strip either form before testing.
  const ICON_GLYPH_PREFIX_RE = /^[O0@](?=[a-z0-9])/;
  // Any single lowercase letter preceding a bare word — icons (globe, Instagram,
  // Facebook, etc.) are sometimes misread as a lowercase letter rather than O/0/@.
  const ICON_GLYPH_TOKEN_RE = /^[a-z]\s+(\S+)$/;
  const BARE_HANDLE_RE = /^[a-z][a-z0-9_.]{3,29}$/;

  // Strip diacritics so OCR artefacts like "theemínara" (italic font read as
  // accented í) still match the ASCII-only handle regex.
  const stripDiacritics = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  const bareHandle = (text: string): string | null => {
    const tokenMatch = text.match(ICON_GLYPH_TOKEN_RE);
    const candidateLine = tokenMatch ? tokenMatch[1] : text;
    if (candidateLine.includes(' ')) return null;
    const candidate = stripDiacritics(candidateLine).replace(ICON_GLYPH_PREFIX_RE, '');
    return BARE_HANDLE_RE.test(candidate) ? candidate : null;
  };

  let nameAssigned = false;
  let companyAssigned = false;
  const designationLines: string[] = [];
  const addressIdx = new Set<number>();
  const otherEntries: Array<{ idx: number; text: string }> = [];

  // True when a line is entirely uppercase letters (plus spaces/hyphens/dots/&)
  // — a reliable signal for company/brand headers on Indian business cards.
  const isAllCaps = (s: string) =>
    /[A-Z]/.test(s) && s === s.toUpperCase() && /^[A-Z0-9\s\-'.&/]+$/.test(s);

  // Single-letter label prefix common on Indian cards: "M: ", "O: ", "W: ", "E: "
  const LABEL_PREFIX_RE = /^[A-Za-z]\s*:\s*/;

  remaining.forEach((line, idx) => {
    // Address: has PIN or address keyword
    if (PIN_RE.test(line) || ADDRESS_KEYWORD_RE.test(line)) {
      addressIdx.add(idx);
      return;
    }

    // Designation: contains a role keyword
    if (DESIGNATION_RE.test(line)) {
      designationLines.push(line);
      return;
    }

    // Phone: try stripping label prefix first (e.g. "O: 040-23 32 42 52" → "040-23 32 42 52")
    const strippedForPhone = line.replace(LABEL_PREFIX_RE, '');
    if (isPhoneLike(strippedForPhone)) {
      fields.push({ label: 'Phone', value: strippedForPhone });
      return;
    }

    // Lines containing @ that EMAIL_RE missed.
    // A trailing or leading "@" is often a social-media icon misread by OCR
    // (e.g. "padmehumstudioindia @") — treat those as Social Handles, not Email.
    if (line.includes('@')) {
      const trailingAt = line.match(/^([a-z][a-z0-9_.]{2,29})\s*@$/);
      const leadingAt  = line.match(/^@\s*([a-z][a-z0-9_.]{2,29})$/);
      if (trailingAt) { fields.push({ label: 'Social Handle', value: trailingAt[1] }); return; }
      if (leadingAt)  { fields.push({ label: 'Social Handle', value: leadingAt[1] });  return; }
      fields.push({ label: 'Email', value: line });
      return;
    }

    // Bare social handle (no @ / platform URL) sitting next to an icon.
    const handle = bareHandle(line);
    if (handle) {
      fields.push({ label: 'Social Handle', value: handle });
      return;
    }

    const lineIsAllCaps = isAllCaps(line);

    // All-caps multi-word = company name (e.g. "NAVIN ARCHITECTS", "ADORNO INTERIORS").
    // Checked BEFORE the person-name test — company headers often appear at the top of
    // the card and would otherwise steal the Name slot.
    if (!companyAssigned && lineIsAllCaps && line.split(/\s+/).filter(Boolean).length >= 2) {
      const nameIdx = fields.findIndex((f) => f.label === 'Name');
      fields.splice(nameIdx === -1 ? 0 : nameIdx + 1, 0, { label: 'Company', value: line });
      companyAssigned = true;
      return;
    }

    // Name: first non-all-caps alphabetic multi-word line (person's name).
    // Skip all-caps lines — those are company/brand headers, handled above.
    if (
      !nameAssigned &&
      !lineIsAllCaps &&
      /^[A-Za-z\s.''\-]{3,60}$/.test(line) &&
      line.split(' ').length >= 2 &&
      line.split(' ').length <= 6
    ) {
      fields.unshift({ label: 'Name', value: line });
      nameAssigned = true;
      return;
    }

    // Company: title-case company name that follows the person's name.
    // Requires initial uppercase so lowercase brand taglines (e.g. "art collective")
    // don't steal the company slot.
    if (!companyAssigned && nameAssigned && line.length <= 100 && !DESIGNATION_RE.test(line) && /^[A-Z]/.test(line)) {
      const nameIdx = fields.findIndex((f) => f.label === 'Name');
      fields.splice(nameIdx + 1, 0, { label: 'Company', value: line });
      companyAssigned = true;
      return;
    }

    // Defer: may turn out to be a city/state line that belongs to the address
    otherEntries.push({ idx, text: line });
  });

  // A line sitting right next to a recognised address line belongs to the address too
  // (e.g. a city/pin line OCR'd separately). Allow digits so "Hyderabad - 500 004" qualifies.
  const looksLikeAddressFragment = (text: string) =>
    text.length <= 60 && /^[A-Za-z0-9\s,.\-/]+$/.test(text);

  for (const { idx, text } of otherEntries) {
    if (looksLikeAddressFragment(text) && (addressIdx.has(idx - 1) || addressIdx.has(idx + 1))) {
      addressIdx.add(idx);
    } else {
      // Suppress single-word all-caps brand logo text already covered by the Company field
      // (e.g. "ESPRAVO" when Company is "Espravo Decor Private Limited")
      const existingCompany = fields.find((f) => f.label === 'Company')?.value?.toUpperCase() ?? '';
      if (isAllCaps(text) && text.split(/\s+/).filter(Boolean).length === 1 && existingCompany.includes(text)) continue;
      fields.push({ label: 'Other', value: text });
    }
  }

  // Insert designations after name/company block
  if (designationLines.length > 0) {
    const insertAfter = fields.findIndex((f) => f.label === 'Company' || f.label === 'Name');
    const insertAt = insertAfter === -1 ? 0 : insertAfter + 1;
    for (const d of designationLines) {
      fields.splice(insertAt, 0, { label: 'Designation', value: d });
    }
  }

  // Consolidate address lines into one field, preserving original top-to-bottom order
  if (addressIdx.size > 0) {
    const ordered = [...addressIdx].sort((a, b) => a - b).map((i) => remaining[i]);
    // Strip any trailing phone-label remnant (e.g. "M:" left after PHONE_RE consumed the number)
    let addressStr = ordered.join(', ').replace(/,?\s*[A-Z]\s*:\s*$/, '').trim();

    // If no company has been assigned yet and the address string starts with a
    // company name (e.g. "ADORNO INTERIORS PVT LTD, Corporate Office: #303..."),
    // extract it — this happens when the company name and its address appear on
    // the same OCR block or adjacent lines.
    if (!companyAssigned) {
      const m = addressStr.match(/^(.+?\b(?:PVT\.?\s*LTD\.?|LIMITED|LLP|INC\.?))\s*,\s*/i);
      if (m) {
        const companyName = m[1].trim();
        const nameIdx = fields.findIndex((f) => f.label === 'Name');
        fields.splice(nameIdx === -1 ? 0 : nameIdx + 1, 0, { label: 'Company', value: companyName });
        companyAssigned = true;
        addressStr = addressStr.slice(m[0].length).trim();
      }
    }

    if (addressStr.length > 0) {
      fields.push({ label: 'Address', value: addressStr });
    }
  }

  return fields;
}

// ── ML Kit wrapper ────────────────────────────────────────────────────────────
// Requires: @react-native-ml-kit/text-recognition (dev build only, not Expo Go)
// Falls back to demo data when the native module is unavailable.

export async function recognizeCardText(imageUri: string): Promise<OcrBlock[]> {
  try {
    // Dynamic import — avoids a crash in Expo Go where the native module is absent
    const mod = await import('@react-native-ml-kit/text-recognition').catch(() => null);
    if (!mod) return getDemoOcrBlocks();

    const result = await (mod.default ?? mod).recognize(imageUri);
    return (result.blocks ?? []).map((block: any) => ({
      text: block.text,
      frameHeight: block.frame?.height ?? 0,
      frameWidth: block.frame?.width ?? 0,
      frameY: block.frame?.top ?? 0,
    }));
  } catch {
    return [];
  }
}

// ── Demo blocks (used in Expo Go / simulator where ML Kit is unavailable) ────

function getDemoOcrBlocks(): OcrBlock[] {
  return [
    { text: 'Rahul Mehta', frameHeight: 48, frameWidth: 260, frameY: 40 },
    { text: 'Studio Mehta', frameHeight: 32, frameWidth: 200, frameY: 100 },
    { text: 'Principal Architect', frameHeight: 22, frameWidth: 220, frameY: 140 },
    { text: '+91 98200 00000', frameHeight: 18, frameWidth: 180, frameY: 200 },
    { text: '+91 22 4000 0000', frameHeight: 18, frameWidth: 180, frameY: 225 },
    { text: 'rahul@studiomehta.com', frameHeight: 18, frameWidth: 220, frameY: 255 },
    { text: 'www.studiomehta.com', frameHeight: 18, frameWidth: 210, frameY: 280 },
    { text: 'linkedin.com/in/rahulmehta', frameHeight: 16, frameWidth: 230, frameY: 305 },
    { text: '@studiomehta', frameHeight: 16, frameWidth: 150, frameY: 325 },
    { text: '202 Maker Chambers, Nariman Point, Mumbai 400021', frameHeight: 16, frameWidth: 300, frameY: 360 },
  ];
}
