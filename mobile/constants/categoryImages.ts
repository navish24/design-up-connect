// Category-appropriate stock images (Unsplash CDN — free for development use)
// Used as fallbacks when a brand/product has no uploaded images yet.

// Cover image pools — 4-5 distinct landscape shots per category at 1200px width.
// getCoverForBrand() hashes the brand ID to pick one deterministically, so
// different brands of the same category show different covers.
export const CATEGORY_COVER_POOLS: Record<string, string[]> = {
  'Art': [
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=1200&fit=crop&q=85',
  ],
  'Furniture': [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1549187774-b4e9b0445b41?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=1200&fit=crop&q=85',
  ],
  'Lighting': [
    'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1513506003901-1e6a35f9e30a?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=1200&fit=crop&q=85',
  ],
  'Flooring': [
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&fit=crop&q=85',
  ],
  'Surfaces & Materials': [
    'https://images.unsplash.com/photo-1583845112203-29329902332e?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1541123437800-df5eb7c7f853?w=1200&fit=crop&q=85',
  ],
  'Décor & Accessories': [
    'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1578749556568-bc26bae9af2e?w=1200&fit=crop&q=85',
  ],
  'Sanitaryware & Bath': [
    'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&fit=crop&q=85',
  ],
  'Kitchen': [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1556909190-eccf4a8bf97a?w=1200&fit=crop&q=85',
  ],
  'Textiles & Upholstery': [
    'https://images.unsplash.com/photo-1528459199957-0ff28496a7f6?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1581539250439-c96689b516dd?w=1200&fit=crop&q=85',
  ],
  'Outdoor & Landscape': [
    'https://images.unsplash.com/photo-1416879595882-61ca26db9bcc?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=1200&fit=crop&q=85',
  ],
  'Smart Home & Technology': [
    'https://images.unsplash.com/photo-1558002038-1055907df827?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1567360425618-1594206637d2?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=1200&fit=crop&q=85',
  ],
  'Architecture & Construction': [
    'https://images.unsplash.com/photo-1541123437800-df5eb7c7f853?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1501183638710-841dd1904471?w=1200&fit=crop&q=85',
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&fit=crop&q=85',
  ],
};

export const CATEGORY_PRODUCT_IMAGES: Record<string, string[]> = {
  'Art': [
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&fit=crop&q=80',
  ],
  'Furniture': [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1549187774-b4e9b0445b41?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600&fit=crop&q=80',
  ],
  'Lighting': [
    'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513506003901-1e6a35f9e30a?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=600&fit=crop&q=80',
  ],
  'Flooring': [
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&fit=crop&q=80',
  ],
  'Surfaces & Materials': [
    'https://images.unsplash.com/photo-1583845112203-29329902332e?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1541123437800-df5eb7c7f853?w=600&fit=crop&q=80',
  ],
  'Décor & Accessories': [
    'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1578749556568-bc26bae9af2e?w=600&fit=crop&q=80',
  ],
  'Sanitaryware & Bath': [
    'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&fit=crop&q=80',
  ],
  'Kitchen': [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1556909190-eccf4a8bf97a?w=600&fit=crop&q=80',
  ],
  'Textiles & Upholstery': [
    'https://images.unsplash.com/photo-1528459199957-0ff28496a7f6?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1581539250439-c96689b516dd?w=600&fit=crop&q=80',
  ],
  'Outdoor & Landscape': [
    'https://images.unsplash.com/photo-1416879595882-61ca26db9bcc?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=600&fit=crop&q=80',
  ],
  'Smart Home & Technology': [
    'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1567360425618-1594206637d2?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&fit=crop&q=80',
  ],
  'Architecture & Construction': [
    'https://images.unsplash.com/photo-1541123437800-df5eb7c7f853?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1501183638710-841dd1904471?w=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&fit=crop&q=80',
  ],
};

export const DEFAULT_COVER = 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=1200&fit=crop&q=85';
export const DEFAULT_PRODUCT_IMAGES = [
  'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=600&fit=crop&q=80',
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&fit=crop&q=80',
];

// Simple deterministic hash so the same brand ID always maps to the same image.
function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

// Primary cover helper — picks a different image per brand based on brand ID,
// but always the same image for the same brand (deterministic).
export function getCoverForBrand(category: string, brandId: string): string {
  const pool = CATEGORY_COVER_POOLS[category] ?? CATEGORY_COVER_POOLS['Décor & Accessories']!;
  return pool[stableHash(brandId) % pool.length];
}

// Single cover for a category (first from pool) — used where brand ID isn't available.
export function getCoverForCategory(category: string): string {
  const pool = CATEGORY_COVER_POOLS[category];
  return pool?.[0] ?? DEFAULT_COVER;
}

// Cover varied by display index — used in grid lists where brand ID isn't available.
export function getCoverForIndex(category: string, index: number): string {
  const pool = CATEGORY_COVER_POOLS[category];
  if (pool && pool.length > 0) return pool[index % pool.length];
  return DEFAULT_COVER;
}

// Single product image rotated by index — so products don't all show the same fallback.
export function getProductImageForIndex(category: string, index: number): string {
  const pool = CATEGORY_PRODUCT_IMAGES[category] ?? DEFAULT_PRODUCT_IMAGES;
  return pool[index % pool.length];
}

export function getProductImagesForCategory(category: string, count = 1): string[] {
  const pool = CATEGORY_PRODUCT_IMAGES[category] ?? DEFAULT_PRODUCT_IMAGES;
  return pool.slice(0, Math.min(count, pool.length));
}
