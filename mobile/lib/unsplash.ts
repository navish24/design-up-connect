// Unsplash image service — fetches category-appropriate photos at app startup
// and provides them as deterministic per-brand cover + product image fallbacks.
// Move ACCESS_KEY to an env var (EXPO_PUBLIC_UNSPLASH_KEY) before production.

import { getCoverForBrand as hardcodedCover, getProductImageForIndex as hardcodedProduct } from '../constants/categoryImages';

const ACCESS_KEY = 'R7iDbfupF854lY-JgMUAFrnQ45uEzV7v6_ICSjou87Y';
const BASE = 'https://api.unsplash.com';

// Per-category search queries tuned for interior-design relevance
const QUERIES: Record<string, { cover: string; product: string }> = {
  'Art':                         { cover: 'contemporary art gallery',          product: 'original artwork painting sculpture' },
  'Furniture':                   { cover: 'furniture interior living room',    product: 'designer furniture piece chair' },
  'Lighting':                    { cover: 'interior lighting pendant lamp',    product: 'designer lamp light fixture' },
  'Flooring':                    { cover: 'flooring wood tile interior',       product: 'floor tile wood material' },
  'Surfaces & Materials':        { cover: 'marble stone surface interior',     product: 'marble stone texture material' },
  'Décor & Accessories':         { cover: 'home decor accessories vase',       product: 'home decor object accessory' },
  'Sanitaryware & Bath':         { cover: 'luxury bathroom interior design',   product: 'bathroom fixture basin tap' },
  'Kitchen':                     { cover: 'modern kitchen interior design',    product: 'kitchen interior appliance' },
  'Textiles & Upholstery':       { cover: 'fabric textile interior decor',     product: 'fabric textile weave detail' },
  'Outdoor & Landscape':         { cover: 'outdoor garden landscape design',   product: 'outdoor furniture garden plant' },
  'Smart Home & Technology':     { cover: 'smart home technology interior',    product: 'smart home device technology' },
  'Architecture & Construction': { cover: 'modern architecture interior',      product: 'architectural detail building' },
};

// Module-level caches — persist for the entire app session
const coverCache: Record<string, string[]> = {};
const productCache: Record<string, string[]> = {};
let prefetchDone = false;
const subscribers = new Set<() => void>();

function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

// Strip diacritics so 'Décor' and 'Decor' compare equal.
function norm(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Explicit aliases for category strings used in static/Supabase data that don't
// substring-match any QUERIES key (e.g. 'Wall Finishes' → 'Surfaces & Materials').
const CATEGORY_ALIASES: Record<string, string> = {
  'decor':                    'Décor & Accessories',
  'art & accessories':        'Art',
  'soft furnishings':         'Textiles & Upholstery',
  'wall finishes':            'Surfaces & Materials',
  'architectural materials':  'Surfaces & Materials',
  'smart living':             'Smart Home & Technology',
  'doors & hardware':         'Architecture & Construction',
};

// Maps any incoming category string to a known QUERIES key:
//   1. normalised exact match
//   2. explicit alias lookup
//   3. normalised substring match (either direction)
//   4. default fallback
function resolveCategory(category: string): string {
  if (!category) return 'Décor & Accessories';
  const keys = Object.keys(QUERIES);
  const n = norm(category);
  return (
    keys.find(k => norm(k) === n) ??
    CATEGORY_ALIASES[n] ??
    keys.find(k => n.includes(norm(k)) || norm(k).includes(n)) ??
    'Décor & Accessories'
  );
}

async function searchPhotos(query: string, orientation: 'landscape' | 'squarish', count: number): Promise<string[] | null> {
  try {
    const url = `${BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=${orientation}&client_id=${ACCESS_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return (json.results ?? []).map((p: any) => p.urls.raw as string);
  } catch {
    return null;
  }
}

// Call once at app startup — fetches all 12 categories in parallel (24 requests total,
// well within Unsplash's 50/hour free tier). Subsequent calls are no-ops.
export async function prefetchCategories(): Promise<void> {
  if (prefetchDone) return;
  prefetchDone = true;

  await Promise.all(
    Object.entries(QUERIES).map(async ([cat, q]) => {
      const [covers, products] = await Promise.all([
        searchPhotos(q.cover,   'landscape', 30),
        searchPhotos(q.product, 'squarish',  30),
      ]);
      if (covers  && covers.length  > 0) coverCache[cat]   = covers.map(r  => `${r}&w=1200&fit=crop&q=85`);
      if (products && products.length > 0) productCache[cat] = products.map(r => `${r}&w=600&fit=crop&q=80`);
    })
  );

  // Notify all subscribed components so they re-render with real images
  subscribers.forEach(fn => fn());
}

// Subscribe to cache-ready notifications — returns an unsubscribe function.
// Use inside useEffect: return subscribeToCache(() => forceUpdate(n => n + 1))
export function subscribeToCache(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

// Returns the Unsplash cover for this brand if cached, otherwise the hardcoded fallback.
// The same brandId always maps to the same photo (deterministic hash).
export function getCachedCover(category: string, brandId: string): string {
  const key = resolveCategory(category);
  const pool = coverCache[key];
  if (pool && pool.length > 0) return pool[stableHash(brandId) % pool.length];
  return hardcodedCover(key, brandId);
}

// Returns the Unsplash product image for this index if cached, otherwise the hardcoded fallback.
// brandId offsets into the pool so different brands in the same category show different images.
export function getCachedProductImage(category: string, index: number, brandId = ''): string {
  const key = resolveCategory(category);
  const pool = productCache[key];
  const offset = brandId ? stableHash(brandId) : 0;
  if (pool && pool.length > 0) return pool[(offset + index) % pool.length];
  return hardcodedProduct(key, index);
}
