import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Analytics } from './analytics';

// ─── PLACEHOLDER CONFIG ────────────────────────────────────────────────────────
// Replace these with your actual Supabase project values from:
// https://supabase.com → Project Settings → API
const SUPABASE_URL = 'https://frbozqaqmcwuxfvadhxl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyYm96cWFxbWN3dXhmdmFkaHhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTYzMzAsImV4cCI6MjA5MTk3MjMzMH0.Vw08afQN-2gWEMgp3lxsq_KMPeUZcovVJ3sklcXUbuk';
// ──────────────────────────────────────────────────────────────────────────────

// Native: tokens stored in device keychain (iOS) / keystore (Android)
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Web: expo-secure-store has no web implementation — use localStorage instead
const LocalStorageAdapter = {
  getItem: (key: string) => Promise.resolve((globalThis as any).localStorage?.getItem(key) ?? null),
  setItem: (key: string, value: string) => {
    (globalThis as any).localStorage?.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    (globalThis as any).localStorage?.removeItem(key);
    return Promise.resolve();
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? LocalStorageAdapter : SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// ─── Helper: Process QR scan ──────────────────────────────────────────────────
export async function processScan(qrData: string, activeExhibitionId: string | null, currentUserId?: string | null) {
  if (!qrData || qrData.length > 500) throw new Error('invalid_qr');

  // ── Exhibition lookup — mirrors data/exhibitions.ts IDs ──────────────────
  const DEMO_EXHIBITIONS: Record<string, string> = {
    'exh-001': 'Index Mumbai 2025',
    'exh-002': 'ACETECH Mumbai 2025',
    'exh-003': 'AD Design Show 2026',
  };

  // ── Booth QR: format  booth:<brand_id>  ─────────────────────────────────
  // Exhibition context comes from activeExhibitionId (set on entry scan), not the QR.
  // If the user is checked in → save tagged to that show. Otherwise → Showroom Visit.
  if (qrData.startsWith('booth:')) {
    const parts = qrData.split(':');
    const brandId = parts[1] ?? 'b01';
    const exhibitionId = activeExhibitionId ?? null;
    const exhibitionName = exhibitionId ? (DEMO_EXHIBITIONS[exhibitionId] ?? null) : null;

    // All 15 brands match data/brands.ts exactly — full explore pages exist for each
    const DEMO_BRANDS: Record<string, { id: string; name: string; category: string; tagline: string; booth_number: string; hall_number: string; images: string[] }> = {
      'b01': { id: 'b01', name: 'Lumina Lighting',    category: 'Lighting',                 tagline: 'Light that tells stories',        booth_number: 'B12', hall_number: 'Hall 2', images: ['https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=400', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400'] },
      'b02': { id: 'b02', name: 'ClayCraft Ceramics', category: 'Decor',                    tagline: 'Earth shaped into art',            booth_number: 'C4',  hall_number: 'Hall 1', images: ['https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400', 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=400'] },
      'b03': { id: 'b03', name: 'Studio Forma',       category: 'Furniture',                tagline: 'Form follows feeling',             booth_number: 'A7',  hall_number: 'Hall 1', images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400'] },
      'b04': { id: 'b04', name: 'Arche Surfaces',     category: 'Wall Finishes',            tagline: 'Walls that breathe',               booth_number: 'D3',  hall_number: 'Hall 3', images: ['https://images.unsplash.com/photo-1541123437800-df5eb7c7f853?w=400', 'https://images.unsplash.com/photo-1501183638710-841dd1904471?w=400'] },
      'b05': { id: 'b05', name: 'Kala Textiles',      category: 'Soft Furnishings',         tagline: 'Threads woven with intention',     booth_number: 'E9',  hall_number: 'Hall 2', images: ['https://images.unsplash.com/photo-1528459199957-0ff28496a7f6?w=400', 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=400'] },
      'b06': { id: 'b06', name: 'Mara Kitchen',       category: 'Kitchen & Bath',           tagline: 'Where function becomes luxury',    booth_number: 'F5',  hall_number: 'Hall 3', images: ['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400', 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=400'] },
      'b07': { id: 'b07', name: 'Verdant Living',     category: 'Outdoor',                  tagline: 'Spaces that grow with you',        booth_number: 'G2',  hall_number: 'Hall 4', images: ['https://images.unsplash.com/photo-1416879595882-61ca26db9bcc?w=400', 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400'] },
      'b08': { id: 'b08', name: 'Arterra Tiles',      category: 'Architectural Materials',  tagline: 'Every surface tells a story',     booth_number: 'H8',  hall_number: 'Hall 4', images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400', 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=400'] },
      'b09': { id: 'b09', name: 'Nomo Design',        category: 'Smart Living',             tagline: 'Intelligence woven into space',    booth_number: 'I3',  hall_number: 'Hall 5', images: ['https://images.unsplash.com/photo-1558002038-1055907df827?w=400', 'https://images.unsplash.com/photo-1567360425618-1594206637d2?w=400'] },
      'b10': { id: 'b10', name: 'Nexus Doors',        category: 'Doors & Hardware',         tagline: 'The first impression is the door', booth_number: 'J6',  hall_number: 'Hall 5', images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400', 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=400'] },
      'b11': { id: 'b11', name: 'Bloom Art',          category: 'Art & Accessories',        tagline: 'Art that belongs in your home',    booth_number: 'K1',  hall_number: 'Hall 2', images: ['https://images.unsplash.com/photo-1579783901586-a03c72ab261d?w=400', 'https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=400'] },
      'b12': { id: 'b12', name: 'Drift Wood Co',      category: 'Furniture',                tagline: 'Furniture with memory',            booth_number: 'L4',  hall_number: 'Hall 1', images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400'] },
      'b13': { id: 'b13', name: 'Prism Glass',        category: 'Architectural Materials',  tagline: 'Light as a building material',     booth_number: 'M7',  hall_number: 'Hall 3', images: ['https://images.unsplash.com/photo-1583845112203-29329902332e?w=400', 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400'] },
      'b14': { id: 'b14', name: 'Terrain Stone',      category: 'Architectural Materials',  tagline: "Stone in its most honest form",    booth_number: 'N9',  hall_number: 'Hall 4', images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400', 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=400'] },
      'b15': { id: 'b15', name: 'Casa Luce',          category: 'Lighting',                 tagline: 'Italian light, Indian soul',       booth_number: 'O2',  hall_number: 'Hall 2', images: ['https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=400', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400'] },
      'hjd-b01-2024': { id: 'hjd-b01-2024', name: 'Harshita Jhamtani Designs', category: 'Lighting & Furniture', tagline: 'Handcrafted light for considered spaces', booth_number: 'L12', hall_number: 'Hall 3', images: ['https://static.wixstatic.com/media/67a4ef_56422cdaf100415fac61c15a5d349eb1~mv2.jpg', 'https://static.wixstatic.com/media/67a4ef_1219ac2b81634ab4af00330ea192d085~mv2.jpg', 'https://static.wixstatic.com/media/67a4ef_09c382a29a234c62af7e01dd6ee2cfd4~mv2.jpg'] },
      'arisaa-b01-2024': { id: 'arisaa-b01-2024', name: 'Arisaa', category: 'Art & Décor', tagline: 'Fine handmade objects shaped by master artisans', booth_number: 'A05', hall_number: 'Hall 1', images: ['https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0309f91d-d641-4a6d-971b-0e875afae13e/ARSD00465+a.jpg', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0300321c-5336-41ec-be26-4c0082d245ca/Of+the+Earth+%281%29.png', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/f85e0e44-1696-4063-baaa-a8c0bcaf3049/Gilded+current4a.jpg'] },
    };
    // Demo brand — return immediately from local data
    if (DEMO_BRANDS[brandId]) {
      const b = DEMO_BRANDS[brandId];
      return {
        scan_type: 'booth' as const,
        action: 'brand_saved' as const,
        brand: {
          id: b.id,
          name: b.name,
          category: b.category,
          tagline: b.tagline,
          booth_number: b.booth_number,
          hall_number: b.hall_number,
          exhibition_name: exhibitionName,
          product_images: b.images,
        },
      };
    }

    // Real brand from Supabase (e.g. Eminara) — look up live data
    const { data: brandData } = await supabase
      .from('brands').select('*').eq('id', brandId).single();
    if (brandData) {
      const { data: products } = await supabase
        .from('products').select('id').eq('brand_id', brandId).order('display_order');
      const productIds = (products ?? []).map((p: any) => p.id);
      const { data: imgRows } = productIds.length > 0
        ? await supabase.from('product_images').select('product_id, url').in('product_id', productIds).order('display_order')
        : { data: [] };
      // First image per product
      const seen = new Set<string>();
      const productImages: string[] = [];
      for (const row of (imgRows ?? [])) {
        if (!seen.has(row.product_id)) { seen.add(row.product_id); productImages.push(row.url); }
      }
      return {
        scan_type: 'booth' as const,
        action: 'brand_saved' as const,
        brand: {
          id: brandData.id,
          name: brandData.name,
          category: brandData.category ?? '',
          tagline: brandData.tagline ?? '',
          booth_number: '',
          hall_number: '',
          exhibition_name: exhibitionName,
          product_images: productImages.slice(0, 3),
        },
      };
    }

    throw new Error('Brand not found');
  }

  // ── User QR: URL formats  https://connect.designup.in/u/<id>  ───────────────
  if (qrData.startsWith('https://connect-designup.vercel.app/u/') || qrData.startsWith('https://connect.designup.in/u/') || qrData.startsWith('https://designup.in/u/')) {
    const userId = qrData.split('/u/')[1]?.split('?')[0].trim() ?? '';
    return processScan(`user:${userId}`, activeExhibitionId);
  }

  // ── User QR: format  user:<user_id>  ─────────────────────────────────────
  if (qrData.startsWith('user:')) {
    const userId = qrData.split(':')[1] ?? '';
    const DEMO_USERS: Record<string, { full_name: string; designation: string; company_name: string; designup_user_id: string; email: string; phone: string; city: string; brand_id?: string }> = {
      'u-priya':  { full_name: 'Priya Sharma',  designation: 'Principal Designer', company_name: 'Studio Forma',        designup_user_id: 'priya_sharma',  email: 'priya@studioforma.com',   phone: '+91 98765 43210', city: 'Mumbai',    brand_id: 'b03' },
      'u-arjun':  { full_name: 'Arjun Mehta',   designation: 'Sales Manager',      company_name: 'Lumina Lighting',     designup_user_id: 'arjun_mehta',   email: 'arjun@lumina.in',         phone: '+91 87654 32109', city: 'Mumbai',    brand_id: 'b01' },
      'u-ananya': { full_name: 'Ananya Kapoor', designation: 'Interior Architect', company_name: 'Kapoor & Associates', designup_user_id: 'ananya_kapoor', email: 'ananya@kapoorassoc.com',  phone: '+91 76543 21098', city: 'Delhi'     },
      'u-rohan':  { full_name: 'Rohan Desai',   designation: 'Brand Director',     company_name: 'ClayCraft Ceramics',  designup_user_id: 'rohan_desai',   email: 'rohan@claycraft.in',      phone: '+91 65432 10987', city: 'Ahmedabad', brand_id: 'b02' },
      'u-meera':  { full_name: 'Meera Nair',    designation: 'Creative Director',  company_name: 'Bloom Art Studio',    designup_user_id: 'meera_nair',    email: 'meera@bloomart.in',       phone: '+91 54321 09876', city: 'Bangalore', brand_id: 'b11' },
      'u-vikram': { full_name: 'Vikram Bose',   designation: 'Head of Sales',      company_name: 'Arterra Tiles',       designup_user_id: 'vikram_bose',   email: 'vikram@arterra.in',       phone: '+91 43210 98765', city: 'Chennai',   brand_id: 'b08' },
    };

    // Demo user — return immediately without hitting DB
    if (DEMO_USERS[userId]) {
      const u = DEMO_USERS[userId];
      return {
        scan_type: 'user' as const,
        action: 'connection_created' as const,
        connection: { id: `conn-${userId}`, user: u, contact_shared: true, is_mutual: false },
      };
    }

    // Real user — look up from Supabase
    // Prefer the userId passed from AuthContext; fall back to supabase.auth.getUser()
    let scannerUserId = currentUserId ?? null;
    if (!scannerUserId) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      scannerUserId = authUser?.id ?? null;
    }
    if (!scannerUserId) throw new Error('not_authenticated');

    // Check if already connected
    const { count } = await supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', scannerUserId)
      .eq('connected_user_id', userId);

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, designation, company_name, email, phone, city, address, designup_user_id, profile_image_url, instagram_handle, linkedin_url, website_url')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) throw new Error(`Profile not found for user ${userId}. Error: ${profileErr?.message ?? 'no row returned'}`);

    const userShape = {
      id: userId,
      full_name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
      designation: profile.designation ?? undefined,
      company_name: profile.company_name ?? undefined,
      designup_user_id: profile.designup_user_id ?? '',
      email: profile.email ?? undefined,
      phone: profile.phone ?? undefined,
      city: profile.city ?? undefined,
      profile_image_url: profile.profile_image_url ?? undefined,
      instagram_handle: profile.instagram_handle ?? undefined,
      linkedin_url: profile.linkedin_url ?? undefined,
      website_url: profile.website_url ?? undefined,
      address: profile.address ?? undefined,
    };

    if (count && count > 0) {
      return {
        scan_type: 'user' as const,
        action: 'already_connected' as const,
        connection: { id: `conn-${userId}`, user: userShape, contact_shared: true, is_mutual: false },
      };
    }

    const { error: insertErr } = await supabase.from('connections').insert({
      user_id: scannerUserId,
      connected_user_id: userId,
      exhibition_id: activeExhibitionId,
    });
    if (insertErr) throw new Error(`Failed to save connection: ${insertErr.message}`);
    Analytics.connectionMade({ isFirstConnection: (count ?? 0) === 0 });

    return {
      scan_type: 'user' as const,
      action: 'connection_created' as const,
      connection: { id: `conn-${userId}`, user: userShape, contact_shared: true, is_mutual: false },
    };
  }

  // ── Entry QR: format  entry:<exhibition_id>  ─────────────────────────────
  if (qrData.startsWith('entry:')) {
    const exhId = qrData.split(':')[1] ?? 'exh-001';
    return {
      scan_type: 'entry' as const,
      action: 'exhibition_activated' as const,
      exhibition: { id: exhId, name: DEMO_EXHIBITIONS[exhId] ?? 'Index Mumbai 2025' },
    };
  }

  throw new Error('invalid_qr');
}
