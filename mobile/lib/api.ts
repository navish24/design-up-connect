// Designup Connect — Supabase data service
// All query functions accept isDemoMode to filter by the demo column (1 = demo, 0 = real).
// Return shapes mirror data/brands.ts and data/exhibitions.ts so screens need minimal changes.

import { supabase } from './supabase';
import { ALL_EXHIBITIONS, EXHIBITION_MAP } from '../data/exhibitions';
import { ALL_BRANDS } from '../data/brands';

// ─── Shared types (mirror data/brands.ts + data/exhibitions.ts) ───────────────

export interface ApiProduct {
  id: string;
  name: string;
  description: string;
  material: string;
  dimensions: string;
  color: string;
  customisable: string;
  images: string[];
}

export interface ApiProject {
  id: string;
  name: string;
  city: string;
  theme: string;
  about: string;
  images: string[];
}

export interface ApiBrand {
  id: string;
  name: string;
  category: string;
  tagline: string;
  story: string;
  design_philosophy?: string;
  cover_image_url?: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  instagram?: string;
  logo_initial: string;
  booth_number: string;
  hall_number: string;
  products: ApiProduct[];
  projects?: ApiProject[];
}

export interface ApiExhibitionBrandRef {
  id: string;
  name: string;
  category: string;
  booth: string;
  hall: string;
}

export interface ApiExhibition {
  id: string;
  name: string;
  tagline: string;
  about: string;
  start_date: string;
  end_date: string;
  timings: string;
  venue_name: string;
  venue_address: string;
  city: string;
  status: 'active' | 'upcoming' | 'past';
  is_paid: boolean;
  user_registration_status: 'checked_in' | 'registered' | null;
  stats: { cities: number; brands: number };
  layout_map_url: string;
  brands: ApiExhibitionBrandRef[];
}

// ─── Demo mode: preset registration status (mirrors original static data) ────
// In demo mode the mock user has no rows in Supabase, so we hardcode the same
// statuses that data/exhibitions.ts had. Update here when the demo script changes.
const DEMO_REGISTRATION_STATUS: Record<string, 'checked_in' | 'registered'> = {
  'exh-001': 'checked_in',
  'exh-002': 'registered',
};

// ─── Exhibitions ──────────────────────────────────────────────────────────────

export async function getExhibitions(
  isDemoMode: boolean,
  userId?: string,
): Promise<ApiExhibition[]> {
  const demo = isDemoMode ? 1 : 0;

  const { data: rows, error } = await supabase
    .from('exhibitions')
    .select('*')
    .eq('demo', demo)
    .order('start_date', { ascending: true });

  if (error) {
    // Fall back to local static data when Supabase is unavailable
    return ALL_EXHIBITIONS.map((e) => ({
      id: e.id,
      name: e.name,
      tagline: e.tagline,
      about: e.about,
      start_date: e.start_date,
      end_date: e.end_date,
      timings: e.timings,
      venue_name: e.venue_name,
      venue_address: e.venue_address,
      city: e.city,
      status: e.status,
      is_paid: e.is_paid,
      layout_map_url: e.layout_map_url,
      stats: e.stats,
      user_registration_status: isDemoMode ? (DEMO_REGISTRATION_STATUS[e.id] ?? null) : null,
      brands: [],
    }));
  }

  let checkedInIds = new Set<string>();
  let registeredIds = new Set<string>();

  if (isDemoMode) {
    // Use preset statuses — mock user has no rows in Supabase
    Object.entries(DEMO_REGISTRATION_STATUS).forEach(([exhId, status]) => {
      if (status === 'checked_in') checkedInIds.add(exhId);
      else registeredIds.add(exhId);
    });
  } else if (userId) {
    const [regRes, checkinRes] = await Promise.all([
      supabase
        .from('exhibition_registrations')
        .select('exhibition_id')
        .eq('user_id', userId)
        .eq('demo', demo),
      supabase
        .from('exhibition_checkins')
        .select('exhibition_id')
        .eq('user_id', userId)
        .eq('demo', demo),
    ]);
    registeredIds = new Set((regRes.data ?? []).map((r: any) => r.exhibition_id));
    checkedInIds = new Set((checkinRes.data ?? []).map((r: any) => r.exhibition_id));
  }

  return (rows ?? []).map((e: any) => ({
    id: e.id,
    name: e.name,
    tagline: e.tagline ?? '',
    about: e.about ?? '',
    start_date: e.start_date ?? '',
    end_date: e.end_date ?? '',
    timings: e.timings ?? '',
    venue_name: e.venue_name ?? '',
    venue_address: e.venue_address ?? '',
    city: e.city ?? '',
    status: e.status ?? 'upcoming',
    is_paid: e.is_paid ?? false,
    layout_map_url: e.layout_map_url || EXHIBITION_MAP[e.id]?.layout_map_url || '',
    stats: { cities: e.stats_cities ?? 0, brands: e.stats_brands ?? 0 },
    user_registration_status: checkedInIds.has(e.id)
      ? 'checked_in'
      : registeredIds.has(e.id)
      ? 'registered'
      : null,
    brands: [],
  }));
}

export async function getExhibition(
  id: string,
  isDemoMode: boolean,
  userId?: string,
): Promise<ApiExhibition | null> {
  const demo = isDemoMode ? 1 : 0;

  const [{ data: exh, error: exhErr }, { data: ebRows }] = await Promise.all([
    supabase.from('exhibitions').select('*').eq('id', id).eq('demo', demo).single(),
    supabase
      .from('exhibition_brands')
      .select('booth_number, hall_number, brands(id, name, category)')
      .eq('exhibition_id', id)
      .eq('demo', demo),
  ]);

  if (exhErr || !exh) {
    // Fall back to local static data (covers non-demo QR scans and offline use)
    const local = EXHIBITION_MAP[id];
    if (!local) return null;
    const user_registration_status_local: 'checked_in' | 'registered' | null =
      isDemoMode ? (DEMO_REGISTRATION_STATUS[id] ?? null) : null;
    return {
      id: local.id,
      name: local.name,
      tagline: local.tagline,
      about: local.about,
      start_date: local.start_date,
      end_date: local.end_date,
      timings: local.timings,
      venue_name: local.venue_name,
      venue_address: local.venue_address,
      city: local.city,
      status: local.status,
      is_paid: local.is_paid,
      layout_map_url: local.layout_map_url,
      stats: local.stats,
      user_registration_status: user_registration_status_local,
      brands: local.brands.map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        booth: b.booth,
        hall: b.hall,
      })),
    };
  }

  let user_registration_status: 'checked_in' | 'registered' | null = null;
  if (isDemoMode) {
    user_registration_status = DEMO_REGISTRATION_STATUS[id] ?? null;
  } else if (userId) {
    const [regRes, checkinRes] = await Promise.all([
      supabase
        .from('exhibition_registrations')
        .select('id')
        .eq('user_id', userId)
        .eq('exhibition_id', id)
        .maybeSingle(),
      supabase
        .from('exhibition_checkins')
        .select('id')
        .eq('user_id', userId)
        .eq('exhibition_id', id)
        .maybeSingle(),
    ]);
    if (checkinRes.data) user_registration_status = 'checked_in';
    else if (regRes.data) user_registration_status = 'registered';
  }

  const brands: ApiExhibitionBrandRef[] = (ebRows ?? []).map((eb: any) => ({
    id: eb.brands?.id ?? '',
    name: eb.brands?.name ?? '',
    category: eb.brands?.category ?? '',
    booth: eb.booth_number ?? '',
    hall: eb.hall_number ?? '',
  }));

  return {
    id: exh.id,
    name: exh.name,
    tagline: exh.tagline ?? '',
    about: exh.about ?? '',
    start_date: exh.start_date ?? '',
    end_date: exh.end_date ?? '',
    timings: exh.timings ?? '',
    venue_name: exh.venue_name ?? '',
    venue_address: exh.venue_address ?? '',
    city: exh.city ?? '',
    status: exh.status ?? 'upcoming',
    is_paid: exh.is_paid ?? false,
    layout_map_url: exh.layout_map_url || EXHIBITION_MAP[exh.id]?.layout_map_url || '',
    stats: { cities: exh.stats_cities ?? 0, brands: exh.stats_brands ?? 0 },
    user_registration_status,
    brands,
  };
}

// ─── Brands ───────────────────────────────────────────────────────────────────

export async function getBrand(id: string, isDemoMode?: boolean): Promise<ApiBrand | null> {
  console.log('[getBrand] called — id:', id, 'isDemoMode:', isDemoMode);

  // In demo mode always use local data so all 14+ products are visible
  if (isDemoMode) {
    const local = ALL_BRANDS.find((b) => b.id === id);
    if (local) {
      return {
        id: local.id,
        name: local.name,
        category: local.category,
        tagline: local.tagline,
        story: local.story,
        contact_name: local.contact_name,
        email: local.email,
        phone: local.phone,
        website: local.website,
        instagram: local.instagram,
        logo_initial: local.logo_initial,
        booth_number: local.booth_number,
        hall_number: local.hall_number,
        products: local.products,
        projects: local.projects,
      };
    }
  }

  const [{ data: brand, error: brandErr }, { data: products, error: prodErr }, { data: projects, error: projErr }] = await Promise.all([
    supabase.from('brands').select('*').eq('id', id).single(),
    supabase.from('products').select('*').eq('brand_id', id).order('display_order', { nullsFirst: false }),
    supabase.from('projects').select('*').eq('brand_id', id),
  ]);

  console.log('[getBrand] supabase result — brand:', brand?.id ?? 'null', 'brandErr:', brandErr?.message ?? 'none', 'products:', products?.length ?? 0, 'projects:', projects?.length ?? 0, 'projErr:', projErr?.message ?? 'none');

  if (brandErr || !brand) {
    console.log('[getBrand] brand fetch failed:', brandErr?.message, 'id:', id);
    const local = ALL_BRANDS.find((b) => b.id === id);
    if (local) {
      return {
        id: local.id, name: local.name, category: local.category,
        tagline: local.tagline, story: local.story,
        contact_name: local.contact_name, email: local.email,
        phone: local.phone, website: local.website,
        instagram: local.instagram, logo_initial: local.logo_initial,
        booth_number: local.booth_number, hall_number: local.hall_number,
        products: local.products, projects: local.projects,
      };
    }
    return null;
  }

  if (prodErr) console.log('[getBrand] products fetch failed:', prodErr.message);

  // Fetch product images separately — more reliable than nested join
  const productIds = (products ?? []).map((p: any) => p.id);
  console.log('[getBrand] productIds:', productIds);
  const { data: allProductImages } = productIds.length > 0
    ? await supabase.from('product_images').select('product_id, url, display_order').in('product_id', productIds).order('display_order', { nullsFirst: false })
    : { data: [] };
  console.log('[getBrand] allProductImages count:', allProductImages?.length ?? 0);

  // Group images by product_id
  const imagesByProduct: Record<string, string[]> = {};
  for (const img of (allProductImages ?? [])) {
    if (!imagesByProduct[img.product_id]) imagesByProduct[img.product_id] = [];
    imagesByProduct[img.product_id].push(img.url);
  }

  return {
    id: brand.id,
    name: brand.name,
    category: brand.category ?? '',
    tagline: brand.tagline ?? '',
    story: brand.about ?? brand.story ?? '',
    design_philosophy: brand.design_philosophy ?? undefined,
    cover_image_url: brand.cover_image_url ?? undefined,
    contact_name: brand.contact_name ?? '',
    email: brand.contact_email ?? brand.email ?? '',
    phone: brand.contact_phone ?? brand.phone ?? '',
    website: brand.website ?? '',
    instagram: brand.instagram ?? undefined,
    logo_initial: (brand.name ?? '?').charAt(0).toUpperCase(),
    booth_number: '',
    hall_number: '',
    products: (products ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      material: p.material ?? '',
      dimensions: p.dimensions ?? '',
      color: p.colour ?? p.color ?? '',
      customisable: p.customisation_details ?? p.customisable ?? '',
      images: imagesByProduct[p.id] ?? [],
    })),
    projects: (() => {
      const fromSupabase = (projects ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        city: p.city ?? '',
        theme: p.theme ?? '',
        about: p.description ?? p.about ?? '',
        images: [],
      }));
      if (fromSupabase.length > 0) return fromSupabase;
      // No Supabase projects — fall back to local data matched by name
      const localBrand = ALL_BRANDS.find((b) => b.name === brand.name);
      return (localBrand?.projects ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        city: p.city,
        theme: p.theme,
        about: p.about,
        images: p.images ?? [],
      }));
    })(),
  };
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProject(
  projectId: string,
): Promise<{ brand: ApiBrand; project: ApiProject } | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, brands(*)')
    .eq('id', projectId)
    .single();

  if (error || !data) {
    // Fall back to local data (covers demo project IDs like 'b01-proj1')
    for (const b of ALL_BRANDS) {
      const proj = b.projects?.find((p) => p.id === projectId);
      if (proj) {
        return {
          project: { id: proj.id, name: proj.name, city: proj.city, theme: proj.theme, about: proj.about, images: proj.images ?? [] },
          brand: {
            id: b.id, name: b.name, category: b.category, tagline: b.tagline,
            story: b.story, contact_name: b.contact_name, email: b.email,
            phone: b.phone, website: b.website, instagram: b.instagram,
            logo_initial: b.logo_initial, booth_number: b.booth_number,
            hall_number: b.hall_number, products: [], projects: [],
          },
        };
      }
    }
    return null;
  }

  const b = data.brands as any;

  return {
    project: {
      id: data.id,
      name: data.name,
      city: data.city ?? '',
      theme: data.theme ?? '',
      about: data.about ?? '',
      images: data.images ?? [],
    },
    brand: {
      id: b.id,
      name: b.name,
      category: b.category ?? '',
      tagline: b.tagline ?? '',
      story: b.story ?? '',
      contact_name: b.contact_name ?? '',
      email: b.email ?? '',
      phone: b.phone ?? '',
      website: b.website ?? '',
      instagram: b.instagram ?? undefined,
      logo_initial: b.logo_initial ?? '',
      booth_number: '',
      hall_number: '',
      products: [],
      projects: [],
    },
  };
}

// ─── New on Designup ──────────────────────────────────────────────────────────

export interface NewBrand {
  id: string;
  name: string;
  category: string;
  logo: string;
  image_url: string | null;
}

export async function getNewBrands(): Promise<NewBrand[]> {
  const { data, error } = await supabase
    .from('brands')
    .select('id, name, category, cover_image_url')
    .not('name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.log('[getNewBrands] error:', error.message, error.code);
    return [];
  }
  if (!data || data.length === 0) return [];

  return data.map((b: any) => {
    const localBrand = ALL_BRANDS.find((lb) => lb.id === b.id);
    const localImage = localBrand?.products?.[0]?.images?.[0] ?? null;
    return {
      id: b.id,
      name: b.name ?? '',
      category: b.category ?? '',
      logo: (b.name ?? '?').charAt(0).toUpperCase(),
      image_url: b.cover_image_url ?? localImage,
    };
  });
}

// ─── Brand search (for profile brand linking) ─────────────────────────────────

export interface BrandSearchResult {
  id: string;
  name: string;
  category: string;
}

export async function getAllBrandsForSearch(): Promise<BrandSearchResult[]> {
  const { data, error } = await supabase
    .from('brands')
    .select('id, name, category')
    .not('name', 'is', null)
    .order('name', { ascending: true });

  if (error || !data) return [];
  return data.map((b: any) => ({ id: b.id, name: b.name ?? '', category: b.category ?? '' }));
}
