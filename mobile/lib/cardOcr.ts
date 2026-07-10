import type { CardContactField } from '../types';
import { supabase } from './supabase';

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
  /(?:https?:\/\/(?:www\.)?|www\.)[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+\.(?:com|in|co|net|org|io|design|studio|agency|co\.in|com\.au)[^\s]*/gi;

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
  /\b(street|road|nagar|marg|avenue|lane|plot|sector|floor|bhavan|house|tower|complex|estate|park|junction|circle|chowk|cross|layout|society|colony|phase|block|near|opp|opposite|behind|beside|no\.|#|drive|boulevard|blvd|highway|expressway|enclave|extension|ext|residency|residences|apartments|apt|flat|villa|bungalow|farm|farms|gardens|garden|heights|view|vihar|puram|bazaar|bazar|market|mandal|suite|ste)\b|\((west|east|north|south|w|e|n|s)\)|\b(india|uae|usa|uk|canada|australia|singapore|dubai|bahrain|kuwait|qatar|oman|united states|united kingdom|united arab emirates|maharashtra|gujarat|karnataka|rajasthan|mumbai|delhi|bangalore|bengaluru|chennai|hyderabad|pune|kolkata|ahmedabad|surat|jaipur|lucknow|noida|gurgaon|gurugram|thane|new delhi|chattarpur|washington|illinois|california|new york|texas|florida|chicago|dc|new jersey|pennsylvania|massachusetts|georgia|ohio|michigan|virginia|arizona|colorado|minnesota|oregon|nevada|utah|connecticut)\b|^\d+\s+[A-Z]|\b\d{5}(?:-\d{4})?\b/im;
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
    .replace(/\b([a-z][a-z0-9._+\-]*)O([a-z][a-z0-9.\-]*\.[a-z]{2,})\b/g, '$1@$2')
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

  // Pre-merge: when OCR splits a platform icon glyph onto its own line immediately
  // before the handle, re-join them so detectHandle has glyph context for platform detection.
  const rawText = blocks.map((b) => b.text).join('\n');
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
  const phoneMatches = [...new Set(fullText.match(PHONE_RE) ?? [])].filter(
    (p) => p.replace(/\D/g, '').length >= 10
  );
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
  // Handles must end with an alphanumeric char — trailing "." or "_" are OCR artifacts, not real handles.
  const BARE_HANDLE_RE = /^[a-z][a-z0-9_.]{2,28}[a-z0-9]$/;

  // Strip diacritics so OCR artefacts like "theemínara" (italic font read as
  // accented í) still match the ASCII-only handle regex.
  const stripDiacritics = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Maps 1-3 char OCR icon misreads to platform names.
  const GLYPH_TO_PLATFORM: Record<string, string> = {
    in: 'Instagram', ig: 'Instagram', i: 'Instagram',
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
  const otherEntries: Array<{ idx: number; text: string }> = [];

  // True when a line is entirely uppercase letters (plus spaces/hyphens/dots/&)
  // — a reliable signal for company/brand headers on Indian business cards.
  const isAllCaps = (s: string) =>
    /[A-Z]/.test(s) && s === s.toUpperCase() && /^[A-Z0-9\s\-'.&/]+$/.test(s);

  // Words that appear in firm/studio/brand names but not in personal names.
  const COMPANY_KEYWORD_RE =
    /\b(studio|studios|architects|architecture|interiors|interior|design|designers|group|associates|consultants|enterprises|solutions|services|industries|builders|developers|construction|pvt|ltd|inc|llp|limited|technologies|tech|media|creative|photography|jewellers|jewellery|fashion|textiles|trading|exports|imports|suppliers|manufacturing|projects|properties|realty|estates|hospital|clinic|labs|diagnostics|academy|institution|institute|college|school|agency|agencies|co\.|corp|government|ministry|department|authority|corporation|bank|council|committee|commission|board|foundation|trust|union|federation|association|chamber|senate|national|international|municipal|capital|ventures|holdings|finance|financial|wealth|advisory|advisors|investments|investment|securities|broking|insurance|leasing|logistics|infrastructure|pharma|pharmaceuticals|chemicals|polymers|packaging|print|printing|publications|publishers|events|promotions|marketing|consultancy|outsourcing|staffing|recruitment)\b|\bstate\s+of\b/i;

  // Label prefix common on cards: "M:" / "M (400)…" / "Tel. " / "Fax: " / "Ph: "
  // The space-only variant (no colon) is guarded by a lookahead for digit/paren/+ so we
  // don't accidentally strip the first letter of a real name like "Emily Bates".
  const LABEL_PREFIX_RE = /^(?:[A-Za-z](?:\s*:|\s+(?=[\d(+]))|(?:tel|fax|ph|mob|mobile|phone)\s*\.?\s*:?)\s*/i;

  remaining.forEach((line, idx) => {
    // Company keyword check runs BEFORE address — company names often contain words
    // like "India", "Studio", "Park" that also appear in ADDRESS_KEYWORD_RE.
    // Condition: starts with uppercase, has a strong company keyword, no PIN,
    // and the line does NOT also have unambiguous address keywords (floor/street/sector etc.)
    const ADDRESS_STRUCTURAL_RE =
      /\b(floor|street|road|nagar|marg|avenue|lane|plot|sector|bhavan|house|tower|complex|estate|junction|circle|chowk|cross|layout|society|colony|phase|block|near|opp|opposite|behind|beside|drive|boulevard|highway|expressway|enclave|extension|residency|residences|apartments|apt|flat|villa|bungalow|farm)\b/i;
    if (
      !companyAssigned &&
      !DESIGNATION_RE.test(line) &&
      !PIN_RE.test(line) &&
      /^[A-Za-z]/.test(line) &&
      line.length <= 100 &&
      !line.includes('_') &&
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
      // Falls through — re-evaluated as name/company/designation/other
    }

    // Bare social handle (no @ / platform URL) sitting next to an icon.
    // Default platform is Instagram; glyph prefix (fb, tw, li…) overrides it.
    const detected = detectHandle(line);
    if (detected) {
      fields.push({ label: detected.platform, value: `@${detected.handle}` });
      return;
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
      if (!nameAssigned && !hasCompanyKeyword && wordCount <= 3) {
        fields.unshift({ label: 'Name', value: line });
        nameAssigned = true;
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
      if (
        !nameAssigned &&
        !lineIsAllCaps &&
        /^[A-Za-z\s.''\-]{3,60}$/.test(lineForName) &&
        lineForName.split(' ').length >= 2 &&
        lineForName.split(' ').length <= 6 &&
        lineForName.split(/\s+/).every((w) => /^[A-Z]/.test(w))
      ) {
        fields.unshift({ label: 'Name', value: lineForName });
        nameAssigned = true;
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
            const hasAltName =
              /^[A-Za-z][a-z]+(?:\s[A-Za-z][a-z]+){1,2}\s*,/.test(addrStr) ||
              otherEntries.some(({ text }) =>
                /^[A-Za-z][a-z]+(?:\s[A-Za-z][a-z]+){1,2}$/.test(text) &&
                !COMPANY_KEYWORD_RE.test(text) &&
                !DESIGNATION_RE.test(text)
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

  // A line sitting right next to a recognised address line belongs to the address too
  // (e.g. a city/pin line OCR'd separately). Allow digits so "Hyderabad - 500 004" qualifies.
  // Minimum length of 6 prevents short OCR garbage ("P.Q.", "Hum", etc.) from
  // being absorbed into the address just because they're adjacent to an address line.
  // Personal-name shape: "First Last", "First M Last", "First M. Last" — don't absorb into address
  const PERSON_NAME_SHAPE_RE = /^[A-Z][a-z]{2,}(?:\s+[A-Z]\.?|\s+[A-Z][a-z]{2,}){1,2}$/;
  const looksLikeAddressFragment = (text: string) =>
    text.length >= 6 && text.length <= 60 &&
    /^[A-Za-z0-9\s,.\-/]+$/.test(text) &&
    !PERSON_NAME_SHAPE_RE.test(text) &&
    !COMPANY_KEYWORD_RE.test(text);

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
    const ordered = [...addressIdx].sort((a, b) => a - b).map((i) => remaining[i].replace(/,\s*$/, ''));
    let addressStr = ordered.join(', ').replace(/,?\s*[A-Z]\s*:\s*$/, '').trim();

    // Strip an OCR-noise word at the very start of the address (before the first comma)
    // if it's all letters, ≤12 chars, and not a known address keyword itself.
    // e.g. "Afvices, Corporate Office: A-204..." → "Corporate Office: A-204..."
    addressStr = addressStr.replace(/^([A-Za-z]{2,12}),\s*/, (_, word) =>
      ADDRESS_KEYWORD_RE.test(word) ? `${word}, ` : '',
    );

    // Strip embedded phone-label tokens (e.g. "Tel.:" or "Fax:") that remain after
    // the phone number was extracted by PHONE_RE. Also strip any stray phone numbers
    // that slipped through (e.g. Indian landlines not matched earlier).
    addressStr = addressStr
      .replace(/[,.]?\s*\b(?:tel|fax|phone|ph|mob|mobile)\b\.?\s*:\s*/gi, ' ')
      .replace(new RegExp(PHONE_RE.source, 'g'), '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[,\s]+|[,\s]+$/g, '')
      .trim();

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

    // If no name yet, scan comma-separated address segments for a personal name —
    // "First Last" anywhere in the address block (start, middle, or end).
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

    if (addressStr.length > 0) {
      fields.push({ label: 'Address', value: addressStr });
    }
  }

  // Last resort: if still no name, promote the first Other field that looks like
  // a personal name (catches the case where the name wasn't adjacent to the address).
  if (!nameAssigned) {
    const otherIdx = fields.findIndex(
      (f) =>
        f.label === 'Other' &&
        /^[A-Za-z][a-z]+(?:\s[A-Za-z][a-z]+){0,2}$/.test(f.value) &&
        !ADDRESS_KEYWORD_RE.test(f.value) &&
        !DESIGNATION_RE.test(f.value) &&
        !COMPANY_KEYWORD_RE.test(f.value)
    );
    if (otherIdx !== -1) {
      const nameValue = fields[otherIdx].value;
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

  // Normalize text fields to title case — cards are often all-caps or all-lowercase
  const TEXT_LABELS = new Set(['Name', 'Company', 'Designation', 'Address', 'Other']);
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
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, i) => ({ text: line.trim(), frameY: i * 20 }));
}

// ── ML Kit wrapper ────────────────────────────────────────────────────────────
// Requires: @react-native-ml-kit/text-recognition (dev build only, not Expo Go)
// Falls back to demo data when the native module is unavailable.

export async function recognizeCardText(imageUri: string): Promise<OcrBlock[]> {
  try {
    // Dynamic import — avoids a crash in Expo Go where the native module is absent
    const mod = await import('@react-native-ml-kit/text-recognition').catch(() => null);
    if (!mod) return getDemoOcrBlocks();

    const TextRecognitionScript = mod.TextRecognitionScript ?? { LATIN: 0 };
    const result = await (mod.default ?? mod).recognize(imageUri, TextRecognitionScript.LATIN);
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

// ── Web OCR via Supabase Edge Function + Google Cloud Vision ─────────────────
// Compresses the image client-side before upload (canvas → JPEG 0.8, max 800px)
// then calls the /ocr Edge Function which proxies to Cloud Vision API.

export async function recognizeCardTextWeb(imageBase64: string): Promise<OcrBlock[]> {
  const { data, error } = await supabase.functions.invoke('ocr', {
    body: { imageBase64, mimeType: 'image/jpeg' },
  });
  if (error) throw new Error(error.message || 'OCR service error');
  if (!data) throw new Error('No response from OCR service');
  if (data.error) throw new Error(data.error);
  return cloudVisionToOcrBlocks(data);
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
