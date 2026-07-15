import type { CardContactField } from '../types';

// Bump whenever parser logic changes so Supabase queries can compare before/after.
export const PARSER_VERSION = '1.14.0';

// ── OCR quality signals (saved silently to Supabase after every scan) ─────────

export interface OcrQualityPayload {
  parse_version: string;
  raw_text: string;
  field_count: number;
  other_count: number;
  has_name: boolean;
  has_company: boolean;
  has_phone: boolean;
  has_email: boolean;
  completeness_pct: number;
  other_values: string[];
}

export function computeOcrQuality(rawText: string, fields: CardContactField[]): OcrQualityPayload {
  const has = (label: string) => fields.some((f) => f.label === label);
  const core = ['Name', 'Phone', 'Email', 'Company'];
  const presentCore = core.filter(has).length;
  return {
    parse_version: PARSER_VERSION,
    raw_text: rawText,
    field_count: fields.length,
    other_count: fields.filter((f) => f.label === 'Other').length,
    has_name: has('Name'),
    has_company: has('Company'),
    has_phone: has('Phone') || has('WhatsApp'),
    has_email: has('Email'),
    completeness_pct: Math.round((presentCore / core.length) * 100),
    other_values: fields.filter((f) => f.label === 'Other').map((f) => f.value),
  };
}

// ── Regex patterns ────────────────────────────────────────────────────────────

// Indian mobile:  +91 / 91 / 0 prefix (+ optional), then 6–9 leading digit, 9 more digits
//                 Allows any pattern of spaces/dashes/dots between digit groups
// International:   +country-code + digits
// US format:       (NXX) NXX-XXXX or NXX-NXX-XXXX (area code in parens or not)
const PHONE_RE =
  /0\d{2,3}[\s\t\-.]?\d{7,8}(?!\d)|(?:\+91[ \t\-.]?|91[ \t\-.]?|0)?[6-9]\d(?:[ \t\-.]?\d){8}|\+\d{1,3}[ \t\-.]?\d{2,5}[ \t\-.]?\d{3,9}|\(?\d{3}\)?[ \t\-.]?\d{3}[ \t\-.]?\d{3}[ \t\-.]?\d{4}(?!\d)|\(?\d{3}\)?[ \t\-.]?\d{3}[ \t\-.]?\d{4}(?!\d)/g;

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// URLs — https:// (with or without www) or bare www. prefix
const EXPLICIT_URL_RE =
  /(?:https?:\/\/(?:www\.)?|www\.)[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+\.(?:com|in|co|net|org|io|art|design|studio|agency|co\.in|com\.au)[^\s]*/gi;

// Bare domains that look like a website (e.g. "studiomehta.com")
const BARE_DOMAIN_RE =
  /\b[a-zA-Z0-9\-]{2,}\.(?:com|in|co|net|org|io|art|design|studio|agency)\b(?:\/\S*)*/g;

const LINKEDIN_RE = /linkedin\.com\/in\/[\w\-]+/gi;
const INSTAGRAM_RE =
  /(?:instagram\.com\/|ig:\s*@?)[\w.]+|(?<![a-zA-Z0-9_])@[\w.]{3,30}(?![a-zA-Z0-9_@])/gi;
const FACEBOOK_RE = /(?:facebook\.com\/|fb\.com\/|fb:\s*)[\w.\-]+/gi;
const TWITTER_RE = /(?:twitter\.com\/|x\.com\/|tw:\s*)[\w]+/gi;
const BEHANCE_RE = /behance\.net\/[\w]+/gi;
const YOUTUBE_RE = /youtube\.com\/(?:c\/|channel\/|@)[\w\-]+/gi;

// Address cues
const ADDRESS_KEYWORD_RE =
  /\bc\/o\b|\bno\.\s*\d|\b(?:shop|flat|unit|room)\s*no\b|\b(street|road|nagar|marg|avenue|lane|plot|sector|floor|bhavan|house|tower|complex|estate|park|junction|circle|chowk|cross|layout|society|colony|phase|block|near|opp|opposite|behind|beside|drive|boulevard|blvd|highway|expressway|enclave|extension|ext|residency|residences|apartments|apt|flat|villa|bungalow|farm|farms|gardens|garden|heights|hills|hill|bagh|ganj|view|vihar|puram|bazaar|bazar|market|mandal|suite|ste|bldg|taluka|taluk|dist)\b|\((west|east|north|south|w|e|n|s)\)|\b(india|uae|usa|uk|canada|australia|singapore|dubai|bahrain|kuwait|qatar|oman|united states|united kingdom|united arab emirates|maharashtra|gujarat|karnataka|rajasthan|telangana|andhra\s+pradesh|tamil\s+nadu|kerala|punjab|haryana|uttarakhand|uttar\s+pradesh|madhya\s+pradesh|west\s+bengal|odisha|assam|jharkhand|chhattisgarh|bihar|mumbai|delhi|bangalore|bengaluru|chennai|hyderabad|pune|kolkata|ahmedabad|surat|jaipur|lucknow|noida|gurgaon|gurugram|thane|new delhi|chattarpur|jubilee hills|banjara hills|madhapur|secunderabad|begumpet|washington|illinois|california|new york|texas|florida|chicago|dc|new jersey|pennsylvania|massachusetts|georgia|ohio|michigan|virginia|arizona|colorado|minnesota|oregon|nevada|utah|connecticut)\b|^\d+\s+[A-Z]|\b\d{5}(?:-\d{4})?\b/im;
const PIN_RE = /\b[1-9]\d{5}\b/;

// Designation keywords — "art" removed (too generic: matches "art collective" brand taglines)
const DESIGNATION_RE =
  /\b(founder|co-founder|ceo|cto|coo|cmo|cso|director|directed|manager|architect|designer|engineer|consultant|associate|principal|partner|head|lead|senior|junior|intern|president|vice|vp|md|gm|dgm|cgm|officer|executive|strategist|illustrator|creative|senator|representative|minister|secretary|governor|attorney|commissioner|councillor|counsel|ambassador|deputy|spokesperson|chairman|chairperson|trustee|parliamentarian)\b/i;

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
    // Require at least one letter in the local part so a bare phone number like
    // "8356955483 @handle" is NOT collapsed — that would manufacture a fake email.
    .replace(/([a-zA-Z0-9._%+\-]*[a-zA-Z][a-zA-Z0-9._%+\-]*)\s+@([a-zA-Z0-9\-]+\.[a-zA-Z]{2,})/g, '$1@$2')
    // "@ nivedita.singh" → "@nivedita.singh"  (space after @ — OCR splits social handle from icon)
    // Use [ \t]+ (not \s+) so this never fires across a line break — "visit us @\nwww.site.com"
    // must NOT be collapsed into "@www.site.com" (that turns a URL into a fake Instagram handle).
    .replace(/@[ \t]+([a-zA-Z][a-zA-Z0-9_.]{2,29})(?=[^a-zA-Z0-9_@.]|$)/g, '@$1')
    // "user@ domain.com" → "user@domain.com"  (space after @ in email — horizontal only)
    .replace(/@[ \t]+([a-zA-Z0-9\-]+\.[a-zA-Z]{2,})/g, '@$1')
    // "user@domain com" → "user@domain.com"  (space instead of dot inside email domain)
    .replace(/(@[a-zA-Z0-9\-]+)\s+(com|in|co|net|org|io)\b/g, '$1.$2')
    // "infoOdomain.com" → "info@domain.com"  (@ misread as uppercase O)
    // Require ≥2 chars before O so single icon misreads ("o" + globe icon "O" + domain)
    // don't produce false emails like "o@ziba.homes".
    .replace(/\b([a-z][a-z0-9._+\-]+)O([a-z][a-z0-9.\-]*\.[a-z]{2,})\b/g, '$1@$2')
    // "O_handle_" → "@_handle_"  (@ misread as O before underscore-led social handles)
    .replace(/(?<![a-zA-Z0-9.])O(_[a-z][a-z0-9_.]{1,27}[a-z0-9_]?)(?=[^a-zA-Z0-9_]|$)/g, '@$1');

// ── Phone normalization ───────────────────────────────────────────────────────
// If the number has an identifiable country code, emit it in +CC XXXXXXXXXX form.
// If it's bare 10 digits (no prefix), leave it as-is — the review screen will
// show a country code picker so the user can confirm before saving.

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) return trimmed; // already has +CC
  const digits = trimmed.replace(/\D/g, '');
  // 91XXXXXXXXXX (12 digits, Indian mobile range 6–9) → +91 XXXXXXXXXX
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits[2])) {
    return `+91 ${digits.slice(2)}`;
  }
  // 0XXXXXXXXXX (11 digits, Indian trunk prefix) → +91 XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits[1])) {
    return `+91 ${digits.slice(1)}`;
  }
  return trimmed; // bare 10-digit — review screen handles country code
}

// ── Core parser ───────────────────────────────────────────────────────────────

export function parseCardFields(blocks: OcrBlock[]): CardContactField[] {
  const fields: CardContactField[] = [];
  const consumedRanges: Array<[number, number]> = [];

  // Extract logo hints injected by cloudVisionToOcrBlocks — strip before text processing.
  const logoHints = new Set(
    blocks.filter((b) => b.text.startsWith('__LOGO__')).map((b) => b.text.slice(8).toLowerCase())
  );
  const textBlocks = blocks.filter((b) => !b.text.startsWith('__LOGO__'));

  // Pre-merge: when OCR splits a platform icon glyph onto its own line immediately
  // before the handle, re-join them so detectHandle has glyph context for platform detection.
  const rawText = textBlocks.map((b) => b.text).join('\n');
  const premergedText = rawText
    // Merge platform icon glyph onto the same line as its handle
    .replace(
      /^(in|ig|i|fb|f|tw|x|li|ln|lk|be|yt)\n([a-zA-Z][a-zA-Z0-9_.]{2,28}[a-zA-Z0-9])/gim,
      (_, g, h) => `${g.toLowerCase()} ${h}`,
    )
    // Merge a bare area code "(NXX)" or label+area-code "M (NXX)" with the phone digits
    // on the next OCR line — OCR commonly splits them because they're visually separated.
    .replace(
      /^(?:[A-Za-z] )?\((\d{3})\)[ \t]*\n([\d+][\d\s()\-.]{5,})/gm,
      '($1) $2',
    )
    // Merge a line starting with "& " into the preceding line — company names like
    // "AR. POOJA SHETYE\n& ASSOCIATES" are often split this way by OCR.
    .replace(/([^\n]+)\n(& \S[^\n]{0,60})/g, '$1 $2');
  const fullText = fixOcrArtifacts(premergedText);
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);

  function consume(match: string) {
    const idx = fullText.indexOf(match);
    if (idx !== -1) consumedRanges.push([idx, idx + match.length]);
  }

  function isConsumed(text: string): boolean {
    let searchFrom = 0;
    while (true) {
      const idx = fullText.indexOf(text, searchFrom);
      if (idx === -1) return true; // no more occurrences — all were consumed
      const inRange = consumedRanges.some(([s, e]) => idx >= s && idx + text.length <= e + 5);
      if (!inRange) return false; // found an occurrence outside consumed ranges
      searchFrom = idx + 1;
    }
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
    if (EMAIL_RE.test(m) || m.includes('@gmail') || m.includes('@yahoo') || m.includes('@hotmail')) return false;
    // Skip domain-like handles (e.g. "@zerodesignstudio.in") — these are website URLs that
    // INSTAGRAM_RE grabs before Website extraction consumes them. Handles with underscores
    // are always real handles (underscores are invalid in domain names), so exempt those.
    const handle = m.match(/[\w.]+$/)?.[0] ?? '';
    if (handle.includes('.') && /\.(in|com|co|net|org|io)$/.test(handle) && !handle.includes('_')) return false;
    return true;
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
  const emailMatches = [...new Set(fullText.match(EMAIL_RE) ?? [])].filter((m) => {
    // A phone number before "@" produces fake emails like "8356955483@tushar.gupta".
    // Real email local parts always contain at least one letter.
    return /[a-zA-Z]/.test(m.split('@')[0]);
  });
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
      norm.includes('.') &&           // bare TLD fragments like "in" (from "www.in.domain.com") are not real sites
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
  const phoneMatches = [...new Set(fullText.match(PHONE_RE) ?? [])].filter((p) => {
    if (p.replace(/\D/g, '').length < 10) return false;
    // Reject decimal/fractional numbers from spreadsheets or printed tables.
    // The phone regex uses "." as a separator (e.g. "+91.98200.00000"), so cell values
    // like "94.3333 53.33" or "252 186.6667" can match. A real phone separator never
    // has more than 2 digits on the left side of the dot followed by 3+ fraction digits.
    if (/\d{2,}\.\d{3,}/.test(p)) return false;
    return true;
  });
  for (const m of phoneMatches) {
    if (isConsumed(m)) continue;
    // Check context around this match for "WhatsApp" or "fax" hints
    const idx = fullText.indexOf(m);
    const prefix = fullText.slice(Math.max(0, idx - 30), idx).toLowerCase();
    const suffix = fullText.slice(idx + m.length, idx + m.length + 12).toLowerCase().trim();
    const label =
      prefix.includes('whatsapp') || prefix.includes('wa:') || prefix.includes('wa ')
        ? 'WhatsApp'
        : prefix.includes('fax') || suffix.startsWith('fax')
        ? 'Fax'
        : 'Phone';
    fields.push({ label, value: normalizePhone(m) });
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
      // Drop pure bracket/paren lines — platform icon misreads like "()" or "( )"
      if (/^[\s()]+$/.test(line)) return false;
      // Trailing pipe = separator remnant after phone/URL was stripped (e.g. "OO90 |")
      // Mid-line pipe is legitimate (e.g. "Founder | Principal Architect") — keep those.
      if (/\|\s*$/.test(line)) return false;
      // Common QR-code prompt text printed on cards — never contact data
      if (/^(scan\s+me|scan\s+qr|qr\s+code|follow\s+me|click\s+here|tap\s+here)$/i.test(line)) return false;
      // Lines with no ASCII letters or digits are OCR noise from QR codes or decorative graphics (e.g. "□□", "■■")
      if (!/[a-zA-Z0-9]/.test(line)) return false;
      // Bare area code in parens (e.g. "(400)") is a phone fragment already captured by PHONE_RE — discard
      if (/^\(\d{3}\)$/.test(line)) return false;
      // Bare country/exchange prefix (e.g. "+18", "+91") with too few digits is a phone fragment — discard
      if (/^\+\d{1,4}$/.test(line)) return false;
      // Short bare digit sequence (e.g. "6718") — phone fragment left after PHONE_RE consumed the rest
      if (/^\d{1,6}$/.test(line)) return false;
      // Short ordinal fragments (e.g. "2nd", "3rd", "1st") — floor/level labels from address context
      if (/^\d{1,2}(st|nd|rd|th)$/i.test(line)) return false;
      // Pure label remnant after phone/email strip (e.g. "Gous Arab:", "E-Mail:", "M: | E:").
      // Matches any line that ends with ":" with no real value — including pipe-separated
      // label pairs like "M: | E:" left after phone/email extraction.
      // Also catches "Call US: /" where a trailing "/" follows the colon.
      if (/^[\w\s.\-/:|]{2,40}:\s*\/*\s*$/.test(line)) return false;
      // Pipe/punctuation remnant with no letters (e.g. "| (+91) ," left after phone/email
      // extraction strips the actionable content from a separator line).
      if (!/[a-zA-Z]/.test(line) && /^[\d\s+()|\-,\/]+$/.test(line)) return false;
      // Standalone contact field label word printed on the card (e.g. "Phone", "Email",
      // "Website", "Address") — after the value is extracted the bare label remains.
      // Also catches common abbreviations and variants without a trailing colon.
      if (/^(phone|phones|mobile|mob|cell|tel|telephone|fax|email|e-mail|e\.mail|website|web|url|address|addr)\.?$/i.test(line)) return false;
      // Trailing "@" with no handle (e.g. "visit us @" after the URL was extracted from
      // the next OCR line) — prose use of "@" as "at", not a social handle or email.
      if (/^[\w\s.''\-,]{2,40}@\s*$/.test(line)) return false;
      // Parenthesised label remnant after phone extraction (e.g. "(M) ," or "(O) :")
      // — occurs when a line like "(M) 9876543210, 7778001234" has both numbers stripped.
      if (/^\([A-Za-z]{1,5}\)[\s,.\-:]*$/.test(line)) return false;
      return true;
    });

  // A phone number that slipped past PHONE_RE (unusual spacing/format) is still
  // a phone number, not a Company/Other value — catch it before classification.
  const PHONE_LIKE_RE = /^[+\d(][\d\s\-().]{6,}$/;
  const isPhoneLike = (text: string) =>
    PHONE_LIKE_RE.test(text) && text.replace(/\D/g, '').length >= 7;

  // A bare social handle (no @, no platform URL) — usually sits next to a
  // platform icon (Instagram/Facebook/etc.) that ML Kit can't read since it's
  // a graphic, not text. The icon's outline is sometimes misread as a single
  // stray character glued onto the handle (e.g. "Otheeminara") or, just as
  // often, OCR'd as its own separate token on the same line with a space
  // (e.g. "O theeminara") — strip either form before testing.
  const ICON_GLYPH_PREFIX_RE = /^[O0@](?=[a-z0-9])/;
  // 1-3 letter glyph prefix (any case) + handle — icon misread on same line as handle.
  const ICON_GLYPH_TOKEN_RE = /^([a-zA-Z]{1,3})\s+(\S+)$/;
  // Allow _ at start/end — Instagram handles like @_absolut_decor_ and @creativehood_ are valid.
  // Only trailing/leading "." is excluded (OCR sentence-end artifact).
  const BARE_HANDLE_RE = /^[a-z_][a-z0-9_.]{1,28}[a-z0-9_]$/;

  // Strip diacritics so OCR artefacts like "theemínara" (italic font read as
  // accented í) still match the ASCII-only handle regex.
  const stripDiacritics = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Maps 1-3 char OCR icon misreads to platform names.
  const GLYPH_TO_PLATFORM: Record<string, string> = {
    in: 'Instagram', ig: 'Instagram', i: 'Instagram', o: 'Instagram',
    fb: 'Facebook', f: 'Facebook',
    tw: 'Twitter/X', x: 'Twitter/X',
    li: 'LinkedIn', ln: 'LinkedIn', lk: 'LinkedIn',
    be: 'Behance',
    yt: 'YouTube',
  };

  const detectHandle = (text: string): { handle: string; platform: string } | null => {
    const tokenMatch = text.match(ICON_GLYPH_TOKEN_RE);
    const glyphToken = tokenMatch ? tokenMatch[1].toLowerCase() : null;
    const isKnownGlyph = glyphToken !== null && glyphToken in GLYPH_TO_PLATFORM;
    // Without a known platform glyph prefix, a bare lowercase word is more likely
    // a brand name or logo text (e.g. "aviato") than a social handle — don't assume Instagram.
    if (!isKnownGlyph) return null;
    const rawLine = tokenMatch![2];
    const candidateLine = rawLine
      .replace(/\s+[A-Za-z]{1,2}[()]*$/, '')
      .replace(/[()[\]{}]+$/, '')
      .trim();
    if (candidateLine.includes(' ')) return null;
    const stripped = stripDiacritics(candidateLine).replace(ICON_GLYPH_PREFIX_RE, '');
    // Lowercase when a known glyph is present — OCR sometimes capitalises the handle
    const normalised = isKnownGlyph ? stripped.toLowerCase() : stripped;
    if (!BARE_HANDLE_RE.test(normalised)) return null;
    const platform = (glyphToken && GLYPH_TO_PLATFORM[glyphToken]) ?? 'Instagram';
    return { handle: normalised, platform };
  };

  let nameAssigned = false;
  let companyAssigned = false;
  const designationLines: string[] = [];
  const designationIndices: number[] = [];
  const addressIdx = new Set<number>();
  const addrSectionHeaders = new Map<number, string>(); // remaining idx → section label
  const otherEntries: Array<{ idx: number; text: string }> = [];

  // True when a line is entirely uppercase letters (plus spaces/hyphens/dots/&)
  // — a reliable signal for company/brand headers on Indian business cards.
  const isAllCaps = (s: string) =>
    /[A-Z]/.test(s) && s === s.toUpperCase() && /^[A-Z0-9\s\-'.&/]+$/.test(s);

  // Words that appear in firm/studio/brand names but not in personal names.
  const COMPANY_KEYWORD_RE =
    /\b(studio|studios|architects|architecture|interiors|interior|landscape|landscaping|design|designers|group|associates|consultants|enterprises|solutions|services|industries|builders|developers|construction|pvt|ltd|inc|llp|limited|technologies|tech|media|creative|photography|jewellers|jewellery|fashion|textiles|trading|exports|imports|suppliers|manufacturing|projects|properties|realty|estates|hospital|clinic|labs|diagnostics|academy|institution|institute|college|school|agency|agencies|co\.|corp|government|ministry|department|authority|corporation|bank|council|committee|commission|board|foundation|trust|union|federation|association|chamber|senate|national|international|municipal|capital|ventures|holdings|finance|financial|wealth|advisory|advisors|investments|investment|securities|broking|insurance|leasing|logistics|infrastructure|pharma|pharmaceuticals|chemicals|polymers|packaging|print|printing|publications|publishers|events|promotions|marketing|consultancy|outsourcing|staffing|recruitment|furniture|furnishings|modular|planters|nursery|nurseries|florist|florists|gardens)\b|\bstate\s+of\b/i;

  // Label prefix common on cards: "M:" / "M (400)…" / "Tel. " / "Fax: " / "Ph: "
  // The space-only variant (no colon) is guarded by a lookahead for digit/paren/+ so we
  // don't accidentally strip the first letter of a real name like "Emily Bates".
  const LABEL_PREFIX_RE = /^(?:[A-Za-z](?:\s*:|\s+(?=[\d(+]))|(?:tel|fax|ph|mob|mobile|phone)\s*\.?\s*:?)\s*/i;

  remaining.forEach((line, idx) => {
    // Address section headers ("Office Address", "Store Address") — used as group
    // separators in multi-address consolidation, not contact data or person names.
    const ADDR_SECTION_HDR_RE = /^(office|store|branch|head|registered|corporate|correspondence|mailing|billing|regd?\.?)\s+(address|addr\.?)$/i;
    const sectionMatch = ADDR_SECTION_HDR_RE.exec(line);
    if (sectionMatch) {
      const sectionLabel = sectionMatch[1].charAt(0).toUpperCase() + sectionMatch[1].slice(1).toLowerCase();
      addrSectionHeaders.set(idx, sectionLabel);
      addressIdx.add(idx);
      return;
    }

    // Company keyword check runs BEFORE address — company names often contain words
    // like "India", "Studio", "Park" that also appear in ADDRESS_KEYWORD_RE.
    // Condition: starts with uppercase, has a strong company keyword, no PIN,
    // and the line does NOT also have unambiguous address keywords (floor/street/sector etc.)
    const ADDRESS_STRUCTURAL_RE =
      /\b(floor|street|road|nagar|marg|avenue|lane|plot|sector|bhavan|house|tower|complex|estate|junction|circle|chowk|cross|layout|society|colony|phase|block|near|opp|opposite|behind|beside|drive|boulevard|highway|expressway|enclave|extension|residency|residences|apartments|apt|flat|villa|bungalow|farm|bldg)\b/i;
    // "C/O Firm Name", "Nr. Junction", "Opp. Mall" — care-of and direction prefixes
    // signal this is an address fragment even when it contains company keywords (pvt/ltd).
    const ADDR_PREFIX_RE = /^(c\/o|nr\.?|opp\.?|near|behind|beside|opposite)\b/i;
    if (
      !companyAssigned &&
      !DESIGNATION_RE.test(line) &&
      !PIN_RE.test(line) &&
      /^[A-Za-z]/.test(line) &&
      line.length <= 100 &&
      !line.includes('_') &&
      !ADDR_PREFIX_RE.test(line) &&
      COMPANY_KEYWORD_RE.test(line) &&
      !ADDRESS_STRUCTURAL_RE.test(line)
    ) {
      const nameIdx = fields.findIndex((f) => f.label === 'Name');
      fields.splice(nameIdx === -1 ? 0 : nameIdx + 1, 0, { label: 'Company', value: line });
      companyAssigned = true;
      return;
    }

    // Address: has PIN or address keyword.
    // Guard: lines with "|" are service/product lists or membership credentials
    // (e.g. "Member of IIA (CA/2020/121718) | Member of IGBC") — even if the credential
    // number matches PIN_RE (6 digits), the "|" signals it is not a real postal address.
    if ((PIN_RE.test(line) || ADDRESS_KEYWORD_RE.test(line)) && !line.includes('|')) {
      addressIdx.add(idx);
      return;
    }

    // Company suffix expansion: "PERFECT" captured as single-word company, next line is
    // "Interior & Architect" → expand to "Perfect Interior & Architect" instead of Designation.
    // Triggered when: company is a single bare word (no existing keyword) + this line has a
    // company keyword and is short (≤5 words) + no structural address keywords.
    {
      const existingComp = fields.find((f) => f.label === 'Company');
      if (
        companyAssigned &&
        existingComp &&
        existingComp.value.split(/\s+/).length === 1 &&
        COMPANY_KEYWORD_RE.test(line) &&
        !ADDRESS_STRUCTURAL_RE.test(line) &&
        !ADDRESS_KEYWORD_RE.test(line) &&
        !PIN_RE.test(line) &&
        line.split(/\s+/).filter(Boolean).length <= 5
      ) {
        existingComp.value = existingComp.value + ' ' + line;
        return;
      }
    }

    // Designation: contains a role keyword
    if (DESIGNATION_RE.test(line)) {
      designationLines.push(line);
      designationIndices.push(idx);
      return;
    }

    // Phone: try stripping label prefix and trailing "fax" word first
    const isFaxLine = /\bfax\b/i.test(line);
    const strippedForPhone = line.replace(LABEL_PREFIX_RE, '').replace(/\s*\bfax\b\s*$/i, '').trim();
    if (isPhoneLike(strippedForPhone)) {
      fields.push({ label: isFaxLine ? 'Fax' : 'Phone', value: strippedForPhone });
      return;
    }

    // Lines containing @ that EMAIL_RE missed.
    if (line.includes('@')) {
      const ll = line.toLowerCase();
      // "handle @" — trailing @ is the Instagram bird icon misread
      const trailingAt = ll.match(/^([a-z][a-z0-9_.]{2,29})\s*@$/);
      // "@ handle" or "@handle"
      const leadingAt  = ll.match(/^@\s*([a-z][a-z0-9_.]{2,29})$/);
      // "fb @handle" or "in @handle" — glyph + @ + handle on same line
      const glyphAtHandle = ll.match(/^([a-z]{1,3})\s+@([a-z][a-z0-9_.]{2,29})$/);
      if (trailingAt) { fields.push({ label: 'Instagram', value: `@${trailingAt[1]}` }); return; }
      if (leadingAt)  { fields.push({ label: 'Instagram', value: `@${leadingAt[1]}` });  return; }
      if (glyphAtHandle && glyphAtHandle[1] in GLYPH_TO_PLATFORM) {
        fields.push({ label: GLYPH_TO_PLATFORM[glyphAtHandle[1]], value: `@${glyphAtHandle[2]}` });
        return;
      }
      // Only push as Email if the line actually contains a valid email address.
      // "visit us @" contains @ but has no domain — it's prose, not email — let it
      // fall through to the name/company/other classifiers below.
      if (EMAIL_RE.test(line)) {
        fields.push({ label: 'Email', value: line });
        return;
      }
      // "@ First Last" — social icon (LinkedIn/etc.) misread as "@" before a person's name.
      // Handles cannot contain spaces, so multi-word text after "@" is always an icon misread.
      // If the text matches the primary Name, drop silently; otherwise strip "@" and let the
      // text fall through to the name/company/other classifiers as plain text.
      if (/^@\s+\S/.test(line) && line.slice(1).trim().includes(' ')) {
        const stripped = line.replace(/^@\s+/, '');
        const primaryNameNorm = fields.find((f) => f.label === 'Name')?.value
          ?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
        const strippedNorm = stripped.toLowerCase().replace(/[^a-z]/g, '');
        if (primaryNameNorm && (primaryNameNorm.includes(strippedNorm) || strippedNorm.includes(primaryNameNorm))) {
          return; // duplicate of primary name from icon misread — drop
        }
        otherEntries.push({ idx, text: stripped });
        return;
      }
      // Falls through — re-evaluated as name/company/designation/other
    }

    // Bare social handle (no @ / platform URL) sitting next to an icon.
    // Default platform is Instagram; glyph prefix (fb, tw, li…) overrides it.
    const detected = detectHandle(line);
    if (detected) {
      fields.push({ label: detected.platform, value: `@${detected.handle}` });
      return;
    }
    // If no glyph prefix was found, check adjacent lines for Instagram context.
    // Cards often print the IG logo graphic (unreadable by OCR) with a bare handle below it.
    if (BARE_HANDLE_RE.test(stripDiacritics(line.toLowerCase()))) {
      const window = [remaining[idx - 2], remaining[idx - 1], remaining[idx + 1], remaining[idx + 2]]
        .filter(Boolean)
        .map((s) => s.toLowerCase());
      const igNearby = window.some((s) => /\b(insta(?:gram)?|ig)\b|^@\s*[a-z]/.test(s));
      if (igNearby) {
        const handle = stripDiacritics(line.toLowerCase()).replace(ICON_GLYPH_PREFIX_RE, '');
        if (BARE_HANDLE_RE.test(handle) && !fields.some((f) => f.label === 'Instagram' && f.value.replace(/^@/, '') === handle)) {
          fields.push({ label: 'Instagram', value: `@${handle}` });
          return;
        }
      }
    }

    // Bare handle that matches the website domain base → Social Handle.
    // Cards often print "padmehumstudioindia" next to Instagram/Facebook icons that OCR
    // can't read. Without a glyph prefix detectHandle() returns null, but a domain-base
    // match is reliable enough to classify it. Return (consumed) even for duplicates so
    // the second identical line doesn't get absorbed into an adjacent address block.
    {
      const websiteField = fields.find((f) => f.label === 'Website');
      if (websiteField && BARE_HANDLE_RE.test(line.toLowerCase())) {
        const normDomain = normalizeUrl(websiteField.value).replace(/\/.*$/, '');
        const domBase = normDomain.replace(/\.[a-z]{2,}(?:\.[a-z]{2})?$/i, '').replace(/[.\-]/g, '');
        const lineNorm = line.toLowerCase().replace(/[._\-]/g, '');
        if (lineNorm.length >= 4 && lineNorm === domBase) {
          // Skip if this bare word is the company/brand name itself (logo text misread as handle)
          const companyValNow = fields.find((f) => f.label === 'Company')?.value ?? '';
          if (companyValNow.toLowerCase() === line.toLowerCase()) return;
          if (!fields.some(
            (f) =>
              (f.label === 'Social Handle' || f.label === 'Instagram' || f.label === 'Facebook') &&
              f.value.replace(/^@/, '').toLowerCase() === line.toLowerCase()
          )) {
            fields.push({ label: 'Instagram', value: `@${line.toLowerCase()}` });
          }
          return;
        }
      }
    }

    const lineIsAllCaps = isAllCaps(line);

    // All-caps multi-word line — could be a company name OR a person's name printed
    // in uppercase (very common on Indian visiting cards).
    // Heuristic: if no name yet, the line is short (≤3 words), and it has no
    // company-type keyword → treat as the person's Name (regardless of whether a
    // company was already found). Otherwise → Company if one isn't assigned yet.
    if (lineIsAllCaps && line.split(/\s+/).filter(Boolean).length >= 2) {
      const wordCount = line.split(/\s+/).filter(Boolean).length;
      const hasCompanyKeyword = COMPANY_KEYWORD_RE.test(line);
      if (!nameAssigned && !hasCompanyKeyword && wordCount <= 5) {
        fields.unshift({ label: 'Name', value: line });
        nameAssigned = true;
        return;
      }
      // Second person on two-person card (e.g. "AR. MOHIT KIRAN BHOLE")
      if (
        nameAssigned &&
        !hasCompanyKeyword &&
        !DESIGNATION_RE.test(line) &&
        !ADDRESS_KEYWORD_RE.test(line) &&
        wordCount >= 2 &&
        wordCount <= 5 &&
        !fields.some((f) => f.label === 'Name 2')
      ) {
        fields.push({ label: 'Name 2', value: line });
        return;
      }
      if (!companyAssigned) {
        const nameIdx = fields.findIndex((f) => f.label === 'Name');
        fields.splice(nameIdx === -1 ? 0 : nameIdx + 1, 0, { label: 'Company', value: line });
        companyAssigned = true;
        return;
      }
    }

    // Single-word all-caps line — brand logo header (e.g. "GUBI", "IKEA", "FLOS").
    // Guard: if a name is already assigned and this token is ≤6 chars with no company keyword,
    // it's likely an OCR fragment of the person's name (e.g. "HANS" from "GHANSHYAM"), not a brand.
    if (!companyAssigned && lineIsAllCaps && line.split(/\s+/).filter(Boolean).length === 1 && !DESIGNATION_RE.test(line) && !(nameAssigned && line.length <= 6 && !COMPANY_KEYWORD_RE.test(line))) {
      const nameIdx = fields.findIndex((f) => f.label === 'Name');
      fields.splice(nameIdx === -1 ? 0 : nameIdx + 1, 0, { label: 'Company', value: line });
      companyAssigned = true;
      return;
    }

    // Name: first non-all-caps alphabetic multi-word line (person's name).
    // Skip all-caps lines — those are company/brand headers, handled above.
    // Require every word to start with uppercase — filters OCR-garbled brand logos like
    // "Artists li" where a lowercase fragment reveals it's not a real person's name.
    // Allow a trailing academic/professional credential in parens (e.g. "(M. Arch)", "(Ph.D)")
    // — strip it before matching so "Ar. Rahul S Sulge (M. Arch)" → Name "Ar. Rahul S Sulge".
    {
      const CREDENTIAL_SUFFIX_RE = /\s*\([A-Za-z][A-Za-z.\s]{1,15}\)\s*$/;
      const lineForName = line.replace(CREDENTIAL_SUFFIX_RE, '').trim();
      const ADDR_ABBREV_RE = /^(rd|st|ave|blvd|dr|ln|ct|pl|extn?)$/i;
      // Reject name candidates sandwiched between address content — e.g. "Andheri East"
      // sitting between "Saki Vihar Road" and "Mumbai, Maharashtra 400072" is an address
      // locality, not a person's name, even though it looks like "First Last".
      const nameNextLine = remaining[idx + 1] ?? '';
      const nameAdjacentToAddr =
        addressIdx.has(idx - 1) ||
        ADDRESS_KEYWORD_RE.test(nameNextLine) ||
        PIN_RE.test(nameNextLine);
      if (
        !nameAssigned &&
        !lineIsAllCaps &&
        !nameAdjacentToAddr &&
        /^[A-Za-z\s.''\-]{3,60}$/.test(lineForName) &&
        lineForName.split(' ').length >= 2 &&
        lineForName.split(' ').length <= 6 &&
        lineForName.split(/\s+/).every((w) => /^[A-Z]/.test(w)) &&
        !lineForName.split(/\s+/).some((w) => ADDR_ABBREV_RE.test(w)) &&
        !lineForName.split(/\s+/).some((w) => w.length > 3 && w.endsWith('.')) &&
        !ADDRESS_KEYWORD_RE.test(lineForName)
      ) {
        fields.unshift({ label: 'Name', value: lineForName });
        nameAssigned = true;
        return;
      }
    }

    // Second person on card: same name shape as primary but Name already taken.
    // Happens on cards with two partners/co-founders (e.g. "Kunj Baheti / Nidhi Baheti").
    // Label as 'Name 2' so the UI can surface it distinctly instead of burying it in Other.
    {
      const CREDENTIAL_SUFFIX_RE = /\s*\([A-Za-z][A-Za-z.\s]{1,15}\)\s*$/;
      const lineForName2 = line.replace(CREDENTIAL_SUFFIX_RE, '').trim();
      const ADDR_ABBREV_RE = /^(rd|st|ave|blvd|dr|ln|ct|pl|extn?)$/i;
      const name2NextLine = remaining[idx + 1] ?? '';
      const name2AdjacentToAddr =
        addressIdx.has(idx - 1) ||
        ADDRESS_KEYWORD_RE.test(name2NextLine) ||
        PIN_RE.test(name2NextLine);
      if (
        nameAssigned &&
        !lineIsAllCaps &&
        !name2AdjacentToAddr &&
        /^[A-Za-z\s.''\-]{3,60}$/.test(lineForName2) &&
        lineForName2.split(' ').length >= 2 &&
        lineForName2.split(' ').length <= 6 &&
        lineForName2.split(/\s+/).every((w) => /^[A-Z]/.test(w)) &&
        !lineForName2.split(/\s+/).some((w) => ADDR_ABBREV_RE.test(w)) &&
        // Reject dotted-tagline pattern: "Residential. Commercial. Hospitality" —
        // words > 3 chars ending in "." are service/product category labels, not name words.
        // Short abbreviations like "Ar.", "ID.", "Dr." (≤3 chars) are still allowed.
        !lineForName2.split(/\s+/).some((w) => w.length > 3 && w.endsWith('.')) &&
        !ADDRESS_KEYWORD_RE.test(lineForName2) &&
        !DESIGNATION_RE.test(lineForName2) &&
        !COMPANY_KEYWORD_RE.test(lineForName2)
      ) {
        fields.push({ label: 'Name 2', value: lineForName2 });
        return;
      }
    }

    // Defer: may turn out to be a city/state line that belongs to the address
    otherEntries.push({ idx, text: line });
  });

  // When the company name is split across two OCR blocks (common with decorative/script fonts),
  // the first block lands in otherEntries (no company keyword) right before the second block
  // that triggered the Company classification. Merge them so "Padme Hum" + "Studio India"
  // becomes "Padme Hum Studio India".
  const companyField = fields.find((f) => f.label === 'Company');
  if (companyField) {
    const companyRemainingIdx = remaining.findIndex((line) => line === companyField.value);
    if (companyRemainingIdx > 0) {
      const prefixEntry = otherEntries.find(
        ({ idx, text }) =>
          (idx === companyRemainingIdx - 1 || idx === companyRemainingIdx - 2) &&
          /^[A-Za-z]/.test(text) &&
          !ADDRESS_KEYWORD_RE.test(text) &&
          !DESIGNATION_RE.test(text) &&
          // Don't absorb a line whose predecessor is a designation (e.g. "Business Development"
          // after "Associate Director-" is a role continuation, not a company name prefix).
          !designationIndices.includes(idx - 1) &&
          text.split(/\s+/).filter(Boolean).length >= 1 &&
          text.split(/\s+/).filter(Boolean).length <= 3
      );
      if (prefixEntry) {
        companyField.value = prefixEntry.text + ' ' + companyField.value;
        const i = otherEntries.indexOf(prefixEntry);
        if (i !== -1) otherEntries.splice(i, 1);
      }

      // If the Name field itself was the company prefix (e.g. "Padme Hum" before "Studio India"),
      // and another personal name exists elsewhere (in address or uncategorised lines), re-classify.
      if (!prefixEntry && nameAssigned) {
        const nameField = fields.find((f) => f.label === 'Name');
        if (nameField) {
          const nameRemainingIdx = remaining.findIndex((line) => line === nameField.value);
          if (
            nameRemainingIdx !== -1 &&
            (nameRemainingIdx === companyRemainingIdx - 1 || nameRemainingIdx === companyRemainingIdx - 2) &&
            !ADDRESS_KEYWORD_RE.test(nameField.value) &&
            !DESIGNATION_RE.test(nameField.value)
          ) {
            const addrStr = [...addressIdx].sort((a, b) => a - b).map((j) => remaining[j]).join(', ');
            // Check if the address string starts with what looks like a person's name
            // ("Rahul Kumar, 45 MG Road") — but exclude if ANY word in the matched
            // segment is itself an address keyword (e.g. "Near Trezure Casa," triggers on
            // "Near"; "Chamunda Complex, Kasheli," triggers on "Complex"). Without this
            // guard, place names with structural words merge the real person name into Company.
            const addrNameMatch = addrStr.match(/^([A-Za-z][a-z]+(?:\s[A-Za-z][a-z]+){1,2})\s*,/);
            const addrNameHasAddrWord = addrNameMatch
              ? addrNameMatch[1].split(/\s+/).some((w) => ADDRESS_KEYWORD_RE.test(w))
              : false;
            const hasAltName =
              (addrNameMatch !== null && !addrNameHasAddrWord) ||
              otherEntries.some(({ idx: oIdx, text }) =>
                /^[A-Za-z][a-z]+(?:\s[A-Za-z][a-z]+){1,2}$/.test(text) &&
                !COMPANY_KEYWORD_RE.test(text) &&
                !DESIGNATION_RE.test(text) &&
                !addressIdx.has(oIdx - 1) && !addressIdx.has(oIdx + 1)
              );
            if (hasAltName) {
              const nameFieldIdx = fields.indexOf(nameField);
              if (nameFieldIdx !== -1) {
                companyField.value = nameField.value + ' ' + companyField.value;
                fields.splice(nameFieldIdx, 1);
                nameAssigned = false;
              }
            }
          }
        }
      }
    }
  }

  // If the current Name is a brand logo (not directly before any designation) but an
  // Other entry IS directly before a designation, swap them: the person adjacent to their
  // title is the real contact. E.g. card with "Messe Frankfurt" logo → "Ankita Chadda" →
  // "Assistant Manager" should yield Name=Ankita Chadda, Company=Messe Frankfurt … Pvt. Ltd.
  if (nameAssigned && designationIndices.length > 0) {
    const nameField = fields.find((f) => f.label === 'Name');
    if (nameField) {
      const nameRIdx = remaining.findIndex((l) => l === nameField.value);
      const nameNextToDesig = designationIndices.some((di) => di === nameRIdx + 1);
      if (!nameNextToDesig) {
        const betterEntry = otherEntries.find(
          ({ idx, text }) =>
            designationIndices.some((di) => di === idx + 1) &&
            /^[A-Z][a-z]{2,}(?:\s+[A-Z]\.?|\s+[A-Z][a-z]{2,}){1,2}$/.test(text) &&
            !COMPANY_KEYWORD_RE.test(text) &&
            !ADDRESS_KEYWORD_RE.test(text)
        );
        if (betterEntry) {
          const companyF = fields.find((f) => f.label === 'Company');
          const nameFieldIdx = fields.indexOf(nameField);
          if (companyF) {
            companyF.value = nameField.value + ' ' + companyF.value;
            if (nameFieldIdx !== -1) fields.splice(nameFieldIdx, 1);
          } else {
            nameField.label = 'Company';
            companyAssigned = true;
          }
          nameAssigned = false;
          const bi = otherEntries.indexOf(betterEntry);
          if (bi !== -1) otherEntries.splice(bi, 1);
          fields.unshift({ label: 'Name', value: betterEntry.text });
          nameAssigned = true;
        }
      }
    }
  }

  // Single-word Company + single-word Other → Name (personal name printed on separate display lines).
  // Happens when "PRIYANKA\nHANSRAJANI" is split by OCR — "PRIYANKA" gets assigned as Company
  // (single all-caps word, no keyword) and "HANSRAJANI" falls to Other. When a Designation
  // confirms this is a person's card, merge them as the full Name.
  if (companyAssigned && !nameAssigned && designationLines.length > 0) {
    const companyF = fields.find((f) => f.label === 'Company');
    if (
      companyF &&
      /^[A-Za-z]+$/.test(companyF.value) &&
      !COMPANY_KEYWORD_RE.test(companyF.value)
    ) {
      const surnameEntry = otherEntries.find(
        (e) =>
          /^[A-Za-z]+$/.test(e.text) &&
          !COMPANY_KEYWORD_RE.test(e.text) &&
          !DESIGNATION_RE.test(e.text)
      );
      if (surnameEntry) {
        const compFIdx = fields.indexOf(companyF);
        fields[compFIdx] = { label: 'Name', value: companyF.value + ' ' + surnameEntry.text };
        nameAssigned = true;
        companyAssigned = false;
        const oIdx = otherEntries.indexOf(surnameEntry);
        if (oIdx !== -1) otherEntries.splice(oIdx, 1);
      }
    }
  }

  // Collect service-type lines printed on firm cards (e.g. "Architecture", "Interiors",
  // "Landscape", "Turn-Key Projects") to merge into a single Services field.
  const serviceEntries: string[] = [];

  // A line sitting right next to a recognised address line belongs to the address too
  // (e.g. a city/pin line OCR'd separately). Allow digits so "Hyderabad - 500 004" qualifies.
  // Minimum length of 6 prevents short OCR garbage ("P.Q.", "Hum", etc.) from
  // being absorbed into the address just because they're adjacent to an address line.
  // Personal-name shape: "First Last", "First M Last", "First M. Last" — don't absorb into address
  const PERSON_NAME_SHAPE_RE = /^[A-Z][a-z]{2,}(?:\s+[A-Z]\.?|\s+[A-Z][a-z]{2,}){1,2}$/;
  const looksLikeAddressFragment = (text: string) => {
    // Single-word domain-like strings (e.g. "BBAREBOHO.HOME", "example.com") are
    // websites, not address fragments — exclude them even when adjacent to address lines.
    const isDomainLike = !text.includes(' ') && /^[A-Za-z0-9][\w.-]*\.[A-Za-z]{2,10}$/.test(text);
    return (
      text.length >= 6 && text.length <= 60 &&
      /^[A-Za-z0-9\s,.\-/#]+$/.test(text) &&
      !isDomainLike &&
      !PERSON_NAME_SHAPE_RE.test(text) &&
      !COMPANY_KEYWORD_RE.test(text)
    );
  };

  for (const { idx, text } of otherEntries) {
    // A line sandwiched between two already-classified address lines is part of the address
    // regardless of whether it looks like a person name (e.g. "Andheri East" between road/city).
    const sandwichedByAddr = addressIdx.has(idx - 1) && addressIdx.has(idx + 1);
    if (sandwichedByAddr && text.length >= 4 && /^[A-Za-z0-9\s,.\-/#()]+$/.test(text)) {
      addressIdx.add(idx);
    } else if (looksLikeAddressFragment(text) && (addressIdx.has(idx - 1) || addressIdx.has(idx + 1))) {
      addressIdx.add(idx);
    } else {
      // Suppress single-word all-caps brand logo text already covered by the Company field
      // (e.g. "ESPRAVO" when Company is "Espravo Decor Private Limited")
      const existingCompany = fields.find((f) => f.label === 'Company')?.value?.toUpperCase() ?? '';
      if (isAllCaps(text) && text.split(/\s+/).filter(Boolean).length === 1 && existingCompany.includes(text)) continue;
      // Suppress Instagram handle OCR'd without "@" when the handle was already captured
      // (e.g. card shows "@aalaya_home" but OCR returns "Aalaya_home" as a separate block)
      const igVal = fields.find((f) => f.label === 'Instagram')?.value?.replace(/^@/, '').toLowerCase() ?? '';
      if (igVal && text.replace(/^@/, '').toLowerCase() === igVal) continue;
      // Collect service-type lines when the company is already found — e.g. an architecture
      // firm printing "Architecture / Interiors / Landscape" as service descriptions.
      // These are industry terms, not contact data, so merge them into one Services field.
      // Also catches pipe-separated product/offering taglines like "Objects | Rugs | Sculptures".
      if (
        companyAssigned &&
        (COMPANY_KEYWORD_RE.test(text) || (
          text.includes('|') &&
          text.split(/\s*\|\s*/).length >= 2 &&
          text.split(/\s*\|\s*/).every((p) => p.trim().length >= 2)
        )) &&
        text.split(/\s+/).filter(Boolean).length <= 8 &&
        !ADDRESS_KEYWORD_RE.test(text) &&
        !DESIGNATION_RE.test(text)
      ) {
        serviceEntries.push(text);
        continue;
      }
      // Handle heuristic: strip leading OCR artifacts (□, O glyph, etc.) then classify.
      const handleCandidate = text
        .replace(/^[^a-zA-Z0-9@_]+\s*/, '') // strip leading non-alphanumeric symbols (□, ■, etc.)
        .replace(/^[oO]\s+/, '')              // strip 'O ' glyph+space prefix
        .replace(/^[oO](?=[_a-z0-9])/i, '')  // strip 'O' glued before handle
        .replace(/^@/, '')
        .toLowerCase();
      const isHandleLike = /^[a-z0-9_.]{3,30}$/.test(handleCandidate) &&
        !handleCandidate.match(/\.(com|in|net|org|io|co)\b/);
      // Underscore → always Instagram (data-verified, zero false positives).
      // No underscore but Instagram logo detected on card → also Instagram.
      if (isHandleLike && (handleCandidate.includes('_') || logoHints.has('instagram'))) {
        const handle = `@${handleCandidate}`;
        const alreadyCaptured = fields.some(
          (f) => f.label === 'Instagram' && f.value.toLowerCase() === handle
        );
        if (!alreadyCaptured) fields.push({ label: 'Instagram', value: handle });
        continue;
      }
      fields.push({ label: 'Other', value: text });
    }
  }

  if (serviceEntries.length > 0) {
    fields.push({ label: 'Services', value: serviceEntries.join(' · ') });
  }

  // Insert designations after name/company block
  if (designationLines.length > 0) {
    const insertAfter = fields.findIndex((f) => f.label === 'Company' || f.label === 'Name');
    const insertAt = insertAfter === -1 ? 0 : insertAfter + 1;
    for (const d of designationLines) {
      // Strip trailing hyphen/dash that results from OCR splitting "Director-Business Development"
      // across two lines — the continuation is handled by fragComp or ignored, not the designation.
      const cleaned = d.replace(/[-–—\s]+$/, '').trim();
      fields.splice(insertAt, 0, { label: 'Designation', value: cleaned });
    }
  }

  // Consolidate address lines — supports multiple offices via location headers.
  if (addressIdx.size > 0) {
    const orderedIdxs = [...addressIdx].sort((a, b) => a - b);

    // ── Path A: section-header grouping ("Office Address", "Store Address" etc.) ──
    // Takes priority when the card uses explicit section labels to delimit offices.
    if (addrSectionHeaders.size > 0) {
      const sectionGroups: { label: string | null; lines: string[] }[] = [];
      let curSect: { label: string | null; lines: string[] } = { label: null, lines: [] };
      for (const i of orderedIdxs) {
        if (addrSectionHeaders.has(i)) {
          if (curSect.lines.length > 0 || curSect.label !== null) sectionGroups.push(curSect);
          curSect = { label: addrSectionHeaders.get(i)!, lines: [] };
        } else {
          curSect.lines.push(remaining[i].replace(/,\s*$/, ''));
        }
      }
      sectionGroups.push(curSect);

      for (const group of sectionGroups) {
        if (group.label === null) continue; // pre-header lines with no section label
        if (group.lines.length === 0) continue; // header with no content lines
        const addressStr = group.lines
          .join(', ')
          .replace(/[,.]?\s*\b(?:tel|fax|phone|ph|mob|mobile)\b\.?\s*:\s*/gi, ' ')
          .replace(new RegExp(PHONE_RE.source, 'g'), '')
          .replace(/\s{2,}/g, ' ')
          .replace(/^[,\s]+|[,\s]+$/g, '')
          .trim();
        if (addressStr.length > 0) {
          fields.push({ label: `Address (${group.label})`, value: addressStr });
        }
      }

    // ── Path B: city-label grouping (Nandini-style multi-office) ────────────────
    } else {
      // Strip "HEAD OFFICE:", "2nd OFFICE:", "OFFICE:" label prefixes before joining.
      const OFFICE_LABEL_RE = /^(?:(?:\d+(?:st|nd|rd|th)?\s+)?(?:head\s+|registered\s+|corporate\s+)?office)\s*:\s*/i;
      const ordered = orderedIdxs.map((i) => remaining[i].replace(/,\s*$/, '').replace(OFFICE_LABEL_RE, '').trim());

      // ── Path B1: inline label splitting ("Atelier:- E-71...", "Flagship Store:- Plot...") ──
      // When ≥2 address lines start with a location-type label followed by :-  or :–,
      // split them into separate address fields rather than merging into one blob.
      const INLINE_LABEL_PREFIX_RE = /^([\w][\w\s.']{1,25}?)\s*:[-–]\s+/;
      const INLINE_LABEL_KEYWORDS_RE = /\b(atelier|flagship|showroom|workshop|studio|boutique|gallery|outlet|factory|warehouse|plant|depot|office|store|shop|branch|unit)\b/i;
      const inlineLabelLines = ordered.filter((line) => {
        const m = line.match(INLINE_LABEL_PREFIX_RE);
        return m != null && INLINE_LABEL_KEYWORDS_RE.test(m[1]);
      });

      if (inlineLabelLines.length >= 2) {
        const inGroups: { label: string; lines: string[] }[] = [];
        let curIn: { label: string; lines: string[] } = { label: '', lines: [] };
        for (const line of ordered) {
          const m = line.match(INLINE_LABEL_PREFIX_RE);
          if (m && INLINE_LABEL_KEYWORDS_RE.test(m[1])) {
            if (curIn.label || curIn.lines.length > 0) inGroups.push(curIn);
            curIn = { label: m[1].trim(), lines: [line.slice(m[0].length).trim()] };
          } else {
            curIn.lines.push(line);
          }
        }
        inGroups.push(curIn);

        for (const g of inGroups) {
          if (g.lines.length === 0) continue;
          const val = g.lines
            .join(', ')
            .replace(/[,.]?\s*\b(?:tel|fax|phone|ph|mob|mobile)\b\.?\s*:\s*/gi, ' ')
            .replace(new RegExp(PHONE_RE.source, 'g'), '')
            .replace(/\s{2,}/g, ' ')
            .replace(/^[,\s]+|[,\s]+$/g, '')
            .trim();
          if (val.length > 0) {
            fields.push({ label: g.label ? `Address (${g.label})` : 'Address', value: val });
          }
        }
      } else {

      // City names worth using as address group labels (excludes generic countries like India/USA)
      const CITY_LABEL_RE =
        /\b(mumbai|delhi|new\s+delhi|bangalore|bengaluru|chennai|hyderabad|pune|kolkata|ahmedabad|surat|jaipur|lucknow|noida|gurgaon|gurugram|thane|navi\s+mumbai|chandigarh|amravati|nagpur|nashik|aurangabad|vadodara|coimbatore|visakhapatnam|vizag|kochi|cochin|trivandrum|thiruvananthapuram|bhubaneswar|patna|raipur|dehradun|jodhpur|udaipur|indore|bhopal|kanpur|agra|varanasi|prayagraj|allahabad|ranchi|gwalior|jabalpur|madurai|tiruchirappalli|trichy|salem|tiruppur|vellore|erode|tirunelveli|vijayawada|warangal|guntur|nellore|tirupati|kurnool|kadapa|karimnagar|nizamabad|khammam|rajahmundry|mangalore|mangaluru|mysore|mysuru|hubli|dharwad|belagavi|belgaum|gulbarga|kalaburagi|shimoga|shivamogga|davangere|tumkur|bellary|ballari|hospet|bidar|vijayapura|kalyan|dombivali|vasai|virar|solapur|kolhapur|latur|akola|nanded|jalgaon|ahmednagar|rajkot|bhavnagar|jamnagar|junagadh|gandhinagar|anand|bharuch|mehsana|morbi|surendranagar|amritsar|ludhiana|jalandhar|patiala|mohali|bathinda|pathankot|ambala|panipat|hisar|rohtak|karnal|faridabad|ghaziabad|meerut|aligarh|moradabad|bareilly|gorakhpur|saharanpur|jhansi|mathura|ujjain|sagar|siliguri|jamshedpur|dhanbad|guwahati|cuttack|rourkela|solapur|thrissur|kozhikode|calicut|kannur|kollam|palakkad|kottayam|alappuzha|alleppey|haridwar|rishikesh|roorkee|haldwani|bhilai|bilaspur|korba|shillong|imphal|gangtok|srinagar|jammu|bikaner|ajmer|kota|alwar|howrah|durgapur|asansol|bardhaman|singapore|dubai|bahrain|kuwait|qatar|abu\s+dhabi|washington|chicago|new\s+york|los\s+angeles|san\s+francisco|london|toronto|sydney|seattle|boston|amsterdam|berlin|paris|milan|hong\s+kong)\b/i;
      const ADDR_STRUCTURAL_RE =
        /\bno\.\s*\d|\b(road|street|nagar|marg|avenue|floor|sector|plot|block|house|tower|phase|opposite|opp)\b/i;

      const asLocationHeader = (line: string): string | null => {
        const cityMatch = line.match(CITY_LABEL_RE);
        if (!cityMatch) return null;
        if (line.trim().split(/\s+/).length > 5) return null;
        if (PIN_RE.test(line)) return null;
        if (/\d{1,4}[,\/]/.test(line)) return null;
        const withoutCity = line.replace(CITY_LABEL_RE, '').trim();
        if (ADDR_STRUCTURAL_RE.test(withoutCity)) return null;
        const city = cityMatch[0].replace(/\s+/g, ' ').trim();
        return city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
      };

      const groups: { city: string | null; lines: string[] }[] = [];
      let cur: { city: string | null; lines: string[] } = { city: null, lines: [] };
      for (const line of ordered) {
        const city = asLocationHeader(line);
        if (city !== null) {
          if (cur.lines.length > 0 || cur.city !== null) groups.push(cur);
          cur = { city, lines: [] };
        } else {
          cur.lines.push(line);
        }
      }
      groups.push(cur);

      // Indian address convention: city appears as the last line (e.g. "Hyderabad" below
      // the street). This creates a null-city group (street lines) + an empty named group.
      // Re-classify as single address so `ordered` is joined correctly with the city included.
      const cityAtEnd =
        groups.length >= 2 &&
        groups[0].city === null &&
        groups[0].lines.length > 0 &&
        groups.slice(1).every((g) => g.lines.length === 0);
      const isMultiAddress = !cityAtEnd && (groups.length > 1 || (groups.length === 1 && groups[0].city !== null));

      if (!isMultiAddress) {
        let addressStr = ordered.join(', ').replace(/,?\s*[A-Z]\s*:\s*$/, '').trim();

        addressStr = addressStr.replace(/^([A-Za-z]{2,12}),\s*/, (_, word) =>
          ADDRESS_KEYWORD_RE.test(word) ? `${word}, ` : '',
        );
        addressStr = addressStr
          .replace(/[,.]?\s*\b(?:tel|fax|phone|ph|mob|mobile)\b\.?\s*:\s*/gi, ' ')
          .replace(new RegExp(PHONE_RE.source, 'g'), '')
          .replace(/\s{2,}/g, ' ')
          .replace(/^[,\s]+|[,\s]+$/g, '')
          .trim();

        if (!companyAssigned) {
          const m = addressStr.match(/^(.+?\b(?:PVT\.?\s*LTD\.?|LIMITED|LLP|INC))\.?(?:\s*,\s*|\s+)/i);
          if (m) {
            const companyName = m[1].trim();
            const nameIdx = fields.findIndex((f) => f.label === 'Name');
            fields.splice(nameIdx === -1 ? 0 : nameIdx + 1, 0, { label: 'Company', value: companyName });
            companyAssigned = true;
            addressStr = addressStr.slice(m[0].length).trim();
          }
        }

        if (!nameAssigned) {
          const segments = addressStr.split(/,\s*/);
          let nameSegIdx = -1;
          for (let si = 0; si < segments.length; si++) {
            const seg = segments[si].trim();
            if (
              /^[A-Za-z][a-z]+(?:\s[A-Za-z][a-z]+){1,2}$/.test(seg) &&
              !ADDRESS_KEYWORD_RE.test(seg) &&
              !DESIGNATION_RE.test(seg) &&
              !COMPANY_KEYWORD_RE.test(seg)
            ) {
              nameSegIdx = si;
              break;
            }
          }
          if (nameSegIdx !== -1) {
            const possibleName = segments[nameSegIdx].trim();
            segments.splice(nameSegIdx, 1);
            fields.unshift({ label: 'Name', value: possibleName });
            nameAssigned = true;
            addressStr = segments.join(', ').trim();
          }
        }

        if (addressStr.length > 0) fields.push({ label: 'Address', value: addressStr });

      } else {
        for (const group of groups) {
          if (group.city === null) continue;
          if (group.lines.length === 0) {
            fields.push({ label: 'Address', value: group.city });
            continue;
          }
          let addressStr = group.lines
            .join(', ')
            .replace(/[,.]?\s*\b(?:tel|fax|phone|ph|mob|mobile)\b\.?\s*:\s*/gi, ' ')
            .replace(new RegExp(PHONE_RE.source, 'g'), '')
            .replace(/\s{2,}/g, ' ')
            .replace(/^[,\s]+|[,\s]+$/g, '')
            .trim();
          if (addressStr.length > 0) {
            fields.push({ label: `Address (${group.city})`, value: addressStr });
          }
        }
      }

      } // end of inline-label else block (Path B2: city-label grouping)
    }
  }

  // Email domain → company fallback: if no company was found anywhere, derive a
  // hint from the custom email domain (skip generic providers like gmail, yahoo).
  if (!companyAssigned) {
    const emailField = fields.find((f) => f.label === 'Email');
    const domain = emailField?.value?.split('@')[1] ?? '';
    const domainBase = domain.replace(/\.(?:co\.in|com\.au|[a-z]{2,})$/i, '');
    const GENERIC_DOMAIN =
      /^(gmail|yahoo|hotmail|outlook|rediffmail|icloud|live|msn|aol|protonmail|zoho|ymail)$/i;
    if (domainBase && !GENERIC_DOMAIN.test(domainBase)) {
      const hint = domainBase.charAt(0).toUpperCase() + domainBase.slice(1).toLowerCase();
      const nameIdx = fields.findIndex((f) => f.label === 'Name');
      fields.splice(nameIdx === -1 ? 0 : nameIdx + 1, 0, { label: 'Company', value: hint });
      companyAssigned = true;
    }
  }

  // Last resort: if still no name, promote an Other field that looks like a personal name.
  // Priority: an Other whose text matches the email local-part (e.g. "MENKA" from
  // "menka@…") — that's a direct clue the OCR returned the person's name in all-caps.
  // Fallback: first Other that matches the mixed-case "First [Last]" shape.
  if (!nameAssigned) {
    const emailFieldForName = fields.find((f) => f.label === 'Email');
    const emailLocal = emailFieldForName?.value?.split('@')[0]?.toLowerCase() ?? '';
    const GENERIC_MAILBOX =
      /^(info|sales|contact|admin|support|hello|help|enquiry|enquiries|office|mail|hr|jobs|noreply|no-reply|team|accounts|billing|marketing|pr|media)$/i;
    const useEmailHint = emailLocal.length >= 3 && !GENERIC_MAILBOX.test(emailLocal);
    let otherIdx = useEmailHint
      ? fields.findIndex(
          (f) =>
            f.label === 'Other' &&
            f.value.toLowerCase() === emailLocal &&
            !ADDRESS_KEYWORD_RE.test(f.value) &&
            !DESIGNATION_RE.test(f.value) &&
            !COMPANY_KEYWORD_RE.test(f.value),
        )
      : -1;
    if (otherIdx === -1) {
      otherIdx = fields.findIndex(
        (f) =>
          f.label === 'Other' &&
          /^[A-Za-z][a-z]+(?:\s[A-Za-z][a-z]+){0,2}$/.test(f.value) &&
          !ADDRESS_KEYWORD_RE.test(f.value) &&
          !DESIGNATION_RE.test(f.value) &&
          !COMPANY_KEYWORD_RE.test(f.value),
      );
    }
    if (otherIdx !== -1) {
      const raw = fields[otherIdx].value;
      // Title-case all-caps values found via email-local match (e.g. "MENKA" → "Menka")
      const nameValue =
        raw === raw.toUpperCase()
          ? raw.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
          : raw;
      fields.splice(otherIdx, 1);
      fields.unshift({ label: 'Name', value: nameValue });
    }
  }

  // ── Post-pass: recover from OCR-fragment company ──────────────────────────────
  // If Company has no company keyword, is very short (≤6 chars), and its text is a
  // substring of the person's Name, it's an OCR misread of the name (e.g. "HANS"
  // from "GHANSHYAM"). Remove it, then try to promote a Company-keyword Other field
  // (e.g. "Technologies") — and merge any adjacent lowercase brand prefix Other
  // (e.g. "aviato") to produce the full "Aviato Technologies" company name.
  {
    const fragComp = fields.find(
      (f) =>
        f.label === 'Company' &&
        !COMPANY_KEYWORD_RE.test(f.value) &&
        f.value.replace(/\s/g, '').length <= 6,
    );
    const personName = fields.find((f) => f.label === 'Name');
    if (
      fragComp &&
      personName &&
      personName.value.toUpperCase().includes(fragComp.value.toUpperCase())
    ) {
      fields.splice(fields.indexOf(fragComp), 1);
      // Find an Other entry with a company keyword to promote
      const altIdx = fields.findIndex(
        (f) => f.label === 'Other' && COMPANY_KEYWORD_RE.test(f.value),
      );
      if (altIdx !== -1) {
        const [altComp] = fields.splice(altIdx, 1);
        // Also pick up a lowercase brand-name prefix sitting in Other
        // (e.g. "aviato" before "Technologies") — identified by all-lowercase, no spaces
        const brandIdx = fields.findIndex(
          (f) =>
            f.label === 'Other' &&
            /^[a-z][a-zA-Z0-9]{2,19}$/.test(f.value) &&
            !COMPANY_KEYWORD_RE.test(f.value) &&
            !ADDRESS_KEYWORD_RE.test(f.value),
        );
        let companyValue = altComp.value;
        if (brandIdx !== -1) {
          const [brand] = fields.splice(brandIdx, 1);
          companyValue = brand.value + ' ' + altComp.value;
        }
        const nIdx = fields.findIndex((f) => f.label === 'Name');
        fields.splice(nIdx === -1 ? 0 : nIdx + 1, 0, { label: 'Company', value: companyValue });
      }
    }
  }

  // Post-process: if Company equals Name exactly (OCR read the same text twice —
  // once as the person's name, once as the firm header), drop the duplicate Company.
  // If there's a company-keyword Other entry, promote it as the real company instead.
  {
    const dupComp = fields.find((f) => f.label === 'Company');
    const nameField = fields.find((f) => f.label === 'Name');
    if (
      dupComp &&
      nameField &&
      dupComp.value.replace(/\s/g, '').toUpperCase() ===
        nameField.value.replace(/\s/g, '').toUpperCase()
    ) {
      fields.splice(fields.indexOf(dupComp), 1);
      // Try to promote an Other entry with a company keyword
      const altIdx = fields.findIndex(
        (f) => f.label === 'Other' && COMPANY_KEYWORD_RE.test(f.value),
      );
      if (altIdx !== -1) {
        const [alt] = fields.splice(altIdx, 1);
        const nIdx = fields.findIndex((f) => f.label === 'Name');
        fields.splice(nIdx === -1 ? 0 : nIdx + 1, 0, { label: 'Company', value: alt.value });
      }
    }
  }

  // Post-process: if Company has no company keyword but an Other entry does, the Company
  // was assigned too early from a short logo/OCR fragment (e.g. "Geninfo" before
  // "Genesis Infoserve PVT. LTD."). Swap: move the keyword-bearing Other to Company
  // and demote the fragment to Other. Use a strict subset of keywords (legal suffixes
  // and strong industry nouns) to avoid swapping on generic organisational words.
  {
    const STRONG_KW_RE =
      /\b(pvt|ltd|limited|llp|llc|inc|associates|technologies|tech|solutions|enterprises|industries|group|studios?|corporation|corp)\b/i;
    const bareComp = fields.find(
      (f) => f.label === 'Company' && !STRONG_KW_RE.test(f.value),
    );
    if (bareComp) {
      const kwOtherIdx = fields.findIndex(
        (f) => f.label === 'Other' && STRONG_KW_RE.test(f.value),
      );
      if (kwOtherIdx !== -1) {
        const [kwOther] = fields.splice(kwOtherIdx, 1);
        const bareIdx = fields.indexOf(bareComp);
        fields.splice(bareIdx, 1, { label: 'Other', value: bareComp.value });
        const nIdx = fields.findIndex((f) => f.label === 'Name');
        fields.splice(nIdx === -1 ? 0 : nIdx + 1, 0, { label: 'Company', value: kwOther.value });
      }
    }
  }

  // Post-process: re-label Instagram handles that were caught by INSTAGRAM_RE but
  // have a known platform glyph immediately before them on the same OCR line —
  // e.g. "fb @niveditafb" should become Facebook, not Instagram.
  const GLYPH_BEFORE_HANDLE_RE = (handle: string) =>
    new RegExp(
      `^([a-z]{1,3})\\s+@?${handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'im',
    );
  for (const f of fields) {
    if (f.label === 'Instagram' && f.value.startsWith('@')) {
      const handle = f.value.slice(1);
      const m = fullText.match(GLYPH_BEFORE_HANDLE_RE(handle));
      if (m) {
        const glyph = m[1].toLowerCase();
        if (glyph in GLYPH_TO_PLATFORM && GLYPH_TO_PLATFORM[glyph] !== 'Instagram') {
          f.label = GLYPH_TO_PLATFORM[glyph];
        }
      }
    }
  }

  // Post-pass: remove Social Handle entries whose handle (without @) matches the company
  // name — happens when logo text matches the domain base but Company was assigned later.
  {
    const companyFinal = fields.find((f) => f.label === 'Company')?.value?.toLowerCase() ?? '';
    if (companyFinal) {
      const shIdx = fields.findIndex(
        (f) => f.label === 'Social Handle' && f.value.replace(/^@/, '').toLowerCase() === companyFinal,
      );
      if (shIdx !== -1) fields.splice(shIdx, 1);
    }
  }

  // Post-process: fuzzy Name==Company dedup — catches OCR variants of the same company
  // text, e.g. "Bsquare Designstudio" (Name) vs "B Square Design Studio." (Company).
  // Stripping all non-alphanumeric chars from both → "BSQUAREDESIGNSTUDIO" == "BSQUAREDESIGNSTUDIO".
  // When matched: promote Name 2 → Name, then look for the next Other person-name for Name 2.
  {
    const normAlpha = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const variantComp = fields.find((f) => f.label === 'Company');
    const variantName = fields.find((f) => f.label === 'Name');
    if (
      variantComp &&
      variantName &&
      variantName.value !== variantComp.value &&
      normAlpha(variantComp.value) === normAlpha(variantName.value)
    ) {
      const name2Field = fields.find((f) => f.label === 'Name 2');
      const variantNameIdx = fields.indexOf(variantName);
      if (name2Field && variantNameIdx !== -1) {
        fields.splice(variantNameIdx, 1);
        name2Field.label = 'Name';
        const nextPersonIdx = fields.findIndex(
          (f) =>
            f.label === 'Other' &&
            /^[A-Za-z][A-Za-z\s.']{3,60}$/.test(f.value) &&
            !COMPANY_KEYWORD_RE.test(f.value) &&
            !DESIGNATION_RE.test(f.value) &&
            !ADDRESS_KEYWORD_RE.test(f.value),
        );
        if (nextPersonIdx !== -1) fields[nextPersonIdx].label = 'Name 2';
      }
    }
  }

  // Post-process: brand name split across lines misread as Name + single-word Company.
  // "Elevate Nest" (Name) + "Media" (Company, 1 keyword) + "Rahul Shirsat" (Name 2) →
  // Company = "Elevate Nest Media", Name = "Rahul Shirsat".
  // Guard: Company must be exactly one word that is itself a company keyword, and it
  // must appear immediately after Name in the fields array (consecutive OCR lines).
  {
    const splitNameF = fields.find((f) => f.label === 'Name');
    const splitCompF = fields.find((f) => f.label === 'Company');
    const splitName2F = fields.find((f) => f.label === 'Name 2');
    if (splitNameF && splitCompF && splitName2F) {
      const splitNamePos = fields.indexOf(splitNameF);
      const splitCompPos = fields.indexOf(splitCompF);
      const compWords = splitCompF.value.split(/\s+/).filter(Boolean);
      // Allow Designation fields between Name and Company (Designation is inserted after forEach)
      const fieldsBetween = fields.slice(splitNamePos + 1, splitCompPos);
      const onlyDesignationsBetween = fieldsBetween.every((f) => f.label === 'Designation');
      if (compWords.length === 1 && COMPANY_KEYWORD_RE.test(splitCompF.value) && onlyDesignationsBetween) {
        splitCompF.value = splitNameF.value + ' ' + splitCompF.value;
        // Strip paired phone from Name 2 value before promoting (phone is already in Phone field)
        const name2Clean = splitName2F.value.includes('·')
          ? splitName2F.value.split('·')[0].trim()
          : splitName2F.value;
        splitNameF.value = name2Clean;
        fields.splice(fields.indexOf(splitName2F), 1);
      }
    }
  }

  // Post-process: two-person card — pair Name 2 with its adjacent phone in the OCR.
  // When a person's name and phone appear on consecutive lines (common on Indian business
  // cards listing two architects/partners), embed the phone in the Name 2 value so the
  // reviewer sees "AR. Mohit Kiran Bhole · +91 8209717720" as one grouped entry.
  {
    const name2Field = fields.find((f) => f.label === 'Name 2');
    if (name2Field && !name2Field.value.includes('·')) {
      const name2Upper = name2Field.value.toUpperCase().replace(/\s+/g, ' ').trim();
      const name2LineIdx = lines.findIndex(
        (l) => l.toUpperCase().replace(/\s+/g, ' ').trim() === name2Upper,
      );
      if (name2LineIdx !== -1) {
        const PHONE_RE_LOCAL = new RegExp(PHONE_RE.source);
        for (let di = 1; di <= 3; di++) {
          const candidate = lines[name2LineIdx + di];
          if (!candidate) break;
          const phoneMatch = candidate.match(PHONE_RE_LOCAL);
          if (phoneMatch) {
            const pairedNorm = normalizePhone(phoneMatch[0]);
            const last10 = (v: string) => v.replace(/\D/g, '').slice(-10);
            const pairedIdx = fields.findIndex(
              (f) =>
                (f.label === 'Phone' || f.label === 'WhatsApp') &&
                last10(f.value) === last10(pairedNorm),
            );
            if (pairedIdx !== -1) {
              name2Field.value = `${name2Field.value} · ${fields[pairedIdx].value}`;
            }
            break;
          }
        }
      }
    }
  }

  // Normalize text fields to title case — cards are often all-caps or all-lowercase
  const TEXT_LABELS = new Set(['Name', 'Name 2', 'Company', 'Designation', 'Address', 'Services', 'Other']);
  return fields.map((f) =>
    TEXT_LABELS.has(f.label)
      ? { ...f, value: toTitleCase(f.value) }
      : f
  );
}

const KEEP_CAPS = new Set(['LLC', 'LLP', 'LTD', 'PVT', 'INC', 'USA', 'UAE', 'UK', 'US']);

function toTitleCase(str: string): string {
  return str.replace(/\b(\w+)\b/g, (word) => {
    // Preserve 2-letter all-caps (state/country codes: NY, CA, TX, UK, US…)
    if (/^[A-Z]{2}$/.test(word)) return word;
    // Preserve specific known abbreviations that are 3+ letters
    if (KEEP_CAPS.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

// ── Cloud Vision adapter ──────────────────────────────────────────────────────
// Converts a raw Google Cloud Vision TEXT_DETECTION response to OcrBlock[].
// Uses fullTextAnnotation.text (preserves line order top→bottom) as primary,
// falls back to textAnnotations[0].description (same content, different path).
// parseCardFields only reads block.text — frameY/frameWidth/frameHeight unused.

export function cloudVisionToOcrBlocks(response: any): OcrBlock[] {
  const text: string =
    response?.responses?.[0]?.fullTextAnnotation?.text ??
    response?.responses?.[0]?.textAnnotations?.[0]?.description ??
    '';
  const textBlocks = text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, i) => ({ text: line.trim(), frameY: i * 20 }));

  // Inject logo hint blocks — parsed out by parseCardFields before text processing.
  const logos: any[] = response?.responses?.[0]?.logoAnnotations ?? [];
  const logoBlocks = logos.map((logo: any) => ({
    text: `__LOGO__${logo.description}`,
    frameY: -999,
  }));

  return [...logoBlocks, ...textBlocks];
}

// ── Demo blocks (used in Expo Go / simulator where ML Kit is unavailable) ────

export function getDemoOcrBlocks(): OcrBlock[] {
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
