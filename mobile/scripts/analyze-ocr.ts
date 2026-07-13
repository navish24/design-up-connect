/**
 * OCR Quality Analysis Script
 *
 * Fetches ocr_quality rows for a given date, re-runs the current parser on
 * stored raw_text, and surfaces patterns to fix.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/analyze-ocr.ts [--date YYYY-MM-DD]
 *
 * Requires the service role key (not anon key) to read all rows, bypassing RLS.
 * Never commit the key; pass it as an env var or create a .env.local file and
 * use `dotenv -e .env.local -- npx tsx scripts/analyze-ocr.ts`.
 */

import { createClient } from '@supabase/supabase-js';
import { parseCardFields, computeOcrQuality, PARSER_VERSION } from '../lib/cardOcrPure';
import type { CardContactField } from '../types';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://frbozqaqmcwuxfvadhxl.supabase.co';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error(
    'Error: SUPABASE_SERVICE_ROLE_KEY env var is required.\n' +
    'Run: SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/analyze-ocr.ts',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, serviceKey, {
  auth: { persistSession: false },
});

// ── Arg parsing ───────────────────────────────────────────────────────────────

function getDateArg(): string {
  const idx = process.argv.indexOf('--date');
  if (idx !== -1 && process.argv[idx + 1]) {
    const d = process.argv[idx + 1];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      console.error(`Error: --date must be YYYY-MM-DD, got "${d}"`);
      process.exit(1);
    }
    return d;
  }
  return new Date().toISOString().slice(0, 10);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rawTextToBlocks(rawText: string) {
  return rawText
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

function completenessBar(pct: number): string {
  const filled = Math.round(pct / 10);
  return '[' + '█'.repeat(filled) + '░'.repeat(10 - filled) + ']';
}

function labelCounts(fields: CardContactField[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of fields) counts[f.label] = (counts[f.label] ?? 0) + 1;
  return counts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const date = getDateArg();
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(` OCR Quality Analysis — ${date}`);
  console.log(` Current parser version: ${PARSER_VERSION}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  const { data: rows, error } = await supabase
    .from('ocr_quality')
    .select('*')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log(`No OCR scans found for ${date}.`);
    console.log('Tip: the ocr_quality table is populated on every card save after the logging update is deployed.\n');
    return;
  }

  // ── 1. Summary ─────────────────────────────────────────────────────────────

  const n = rows.length;
  const avgStored = Math.round(rows.reduce((s, r) => s + (r.completeness_pct ?? 0), 0) / n);
  const buckets = { '0-24': 0, '25-49': 0, '50-74': 0, '75-99': 0, '100': 0 };
  for (const r of rows) {
    const p = r.completeness_pct ?? 0;
    if (p === 100) buckets['100']++;
    else if (p >= 75) buckets['75-99']++;
    else if (p >= 50) buckets['50-74']++;
    else if (p >= 25) buckets['25-49']++;
    else buckets['0-24']++;
  }

  console.log(`SUMMARY  (${n} scan${n !== 1 ? 's' : ''})`);
  console.log(`─────────────────────────────────────────────────`);
  console.log(`  Avg completeness (stored): ${avgStored}%`);
  console.log(`  Distribution:`);
  for (const [range, count] of Object.entries(buckets)) {
    const bar = '▮'.repeat(count);
    console.log(`    ${range.padEnd(7)} ${bar} ${count}`);
  }

  // ── 2. Parser replay ────────────────────────────────────────────────────────

  console.log(`\nPARSER REPLAY  (re-running ${PARSER_VERSION} on stored raw_text)`);
  console.log(`─────────────────────────────────────────────────`);

  let improved = 0, regressed = 0, unchanged = 0, noRawText = 0;
  const improvementDetails: string[] = [];
  const regressionDetails: string[] = [];

  for (const row of rows) {
    if (!row.raw_text) { noRawText++; continue; }
    const blocks = rawTextToBlocks(row.raw_text);
    const replayFields = parseCardFields(blocks);
    const replay = computeOcrQuality(row.raw_text, replayFields);

    const delta = replay.completeness_pct - (row.completeness_pct ?? 0);
    const storedPct = row.completeness_pct ?? 0;
    const id = row.card_contact_id?.slice(0, 8) ?? '?';

    if (delta > 0) {
      improved++;
      improvementDetails.push(
        `  ✓ [${id}] ${storedPct}% → ${replay.completeness_pct}% (+${delta})`
      );
    } else if (delta < 0) {
      regressed++;
      regressionDetails.push(
        `  ✗ [${id}] ${storedPct}% → ${replay.completeness_pct}% (${delta})`
      );
    } else {
      unchanged++;
    }
  }

  console.log(`  Improved:  ${improved}`);
  console.log(`  Regressed: ${regressed}`);
  console.log(`  Unchanged: ${unchanged}`);
  if (noRawText > 0) console.log(`  No raw_text: ${noRawText} (scanned before logging update)`);

  if (improvementDetails.length) {
    console.log('\n  Improvements:');
    improvementDetails.forEach((l) => console.log(l));
  }
  if (regressionDetails.length) {
    console.log('\n  Regressions (parser got worse — investigate!):');
    regressionDetails.forEach((l) => console.log(l));
  }

  // ── 3. Top "Other" values (parser likely missed these) ─────────────────────

  console.log(`\nTOP UNCLASSIFIED VALUES  (stored as "Other")`);
  console.log(`─────────────────────────────────────────────────`);

  const allOther: string[] = [];
  for (const row of rows) {
    if (Array.isArray(row.other_values)) allOther.push(...row.other_values);
  }

  if (allOther.length === 0) {
    console.log('  None — parser classified everything.');
  } else {
    const freq: Record<string, number> = {};
    for (const v of allOther) {
      const key = v.toLowerCase().trim();
      freq[key] = (freq[key] ?? 0) + 1;
    }
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [val, count] of sorted) {
      console.log(`  ${String(count).padStart(2)}×  ${val}`);
    }
  }

  // ── 4. OCR failure vs parser failure ───────────────────────────────────────

  console.log(`\nOCR vs PARSER FAILURE BREAKDOWN`);
  console.log(`─────────────────────────────────────────────────`);
  console.log(`  (If "Other" text appears in raw_text → parser missed it`);
  console.log(`   If NOT in raw_text → OCR didn't pick it up at all)\n`);

  let parserMiss = 0, ocrMiss = 0;
  const parserMissExamples: string[] = [];
  const ocrMissExamples: string[] = [];

  for (const row of rows) {
    if (!row.raw_text || !Array.isArray(row.other_values)) continue;
    const rawLower = row.raw_text.toLowerCase();
    const id = row.card_contact_id?.slice(0, 8) ?? '?';

    for (const val of row.other_values) {
      const inRaw = rawLower.includes(val.toLowerCase().trim());
      if (inRaw) {
        parserMiss++;
        if (parserMissExamples.length < 8) {
          parserMissExamples.push(`  → [${id}] "${val}" (in raw text, parser missed)`);
        }
      } else {
        ocrMiss++;
        if (ocrMissExamples.length < 8) {
          ocrMissExamples.push(`  → [${id}] "${val}" (NOT in raw text, OCR issue)`);
        }
      }
    }
  }

  console.log(`  Parser failures (text was OCR'd but misclassified): ${parserMiss}`);
  parserMissExamples.forEach((l) => console.log(l));
  console.log(`\n  OCR failures (text not captured at all):           ${ocrMiss}`);
  ocrMissExamples.forEach((l) => console.log(l));

  // ── 5. Low-completeness scan details ───────────────────────────────────────

  const lowRows = rows.filter((r) => (r.completeness_pct ?? 0) < 50 && r.raw_text);
  if (lowRows.length > 0) {
    console.log(`\nLOW-COMPLETENESS SCANS  (< 50% — raw text for inspection)`);
    console.log(`─────────────────────────────────────────────────`);

    for (const row of lowRows.slice(0, 5)) {
      const id = row.card_contact_id?.slice(0, 8) ?? '?';
      const pct = row.completeness_pct ?? 0;
      const blocks = rawTextToBlocks(row.raw_text);
      const replayFields = parseCardFields(blocks);
      const counts = labelCounts(replayFields);

      console.log(`\n  [${id}]  ${completenessBar(pct)} ${pct}%`);
      console.log(`  Stored parse_version: ${row.parse_version}`);
      console.log(`  Replay fields: ${Object.entries(counts).map(([l, c]) => `${l}×${c}`).join(', ') || 'none'}`);
      console.log(`  Raw text:`);
      row.raw_text
        .split('\n')
        .filter(Boolean)
        .forEach((line: string) => console.log(`    │ ${line}`));
    }

    if (lowRows.length > 5) {
      console.log(`\n  … and ${lowRows.length - 5} more low-completeness scans.`);
    }
  }

  console.log(`\n═══════════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
