// Central exhibition data for Designup Connect
// 10 real Indian design exhibitions, each with 15 brands from ALL_BRANDS

import { ALL_BRANDS } from './brands';

export interface ExhibitionBrandRef {
  id: string;
  name: string;
  category: string;
  booth: string;
  hall: string;
}

export interface Exhibition {
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
  brands: ExhibitionBrandRef[];
}

// Helper: pick 15 brands from ALL_BRANDS, starting at offset, rotating
function pickBrands(offset: number): ExhibitionBrandRef[] {
  const halls = ['Hall 1', 'Hall 2', 'Hall 3'];
  return Array.from({ length: 15 }, (_, i) => {
    const b = ALL_BRANDS[(offset + i) % ALL_BRANDS.length];
    return {
      id: b.id,
      name: b.name,
      category: b.category,
      booth: b.booth_number,
      hall: halls[i % halls.length],
    };
  });
}

export const ALL_EXHIBITIONS: Exhibition[] = [
  {
    id: 'exh-001',
    name: 'Index Mumbai 2025',
    tagline: "India's Premier Design Exhibition",
    about: 'Index Mumbai is the largest design and lifestyle exhibition in India, bringing together over 150 leading brands across furniture, lighting, decor, and architectural materials. A must-visit for architects, interior designers, and design enthusiasts.',
    start_date: '2025-11-15',
    end_date: '2025-11-18',
    timings: '10:00 AM – 7:00 PM',
    venue_name: 'Bombay Exhibition Centre',
    venue_address: 'Western Express Highway, Goregaon East, Mumbai – 400063',
    city: 'Mumbai',
    status: 'active',
    is_paid: false,
    user_registration_status: 'checked_in',
    stats: { cities: 50, brands: 150 },
    layout_map_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800',
    brands: pickBrands(0),
  },
  {
    id: 'exh-002',
    name: 'ACETECH Mumbai 2025',
    tagline: 'Architecture, Construction & Interior Design Expo',
    about: 'ACETECH is Asia\'s largest architectural exhibition. The Mumbai edition brings together 1000+ brands spanning building materials, hardware, tiles, glass, lighting, furniture, and smart home solutions across 100,000+ sqm.',
    start_date: '2025-12-05',
    end_date: '2025-12-08',
    timings: '10:00 AM – 6:00 PM',
    venue_name: 'Bombay Exhibition Centre',
    venue_address: 'Western Express Highway, Goregaon East, Mumbai – 400063',
    city: 'Mumbai',
    status: 'upcoming',
    is_paid: false,
    user_registration_status: 'registered',
    stats: { cities: 35, brands: 1000 },
    layout_map_url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800',
    brands: pickBrands(3),
  },
  {
    id: 'exh-003',
    name: 'AD Design Show 2026',
    tagline: 'Curated Luxury Design',
    about: 'The AD Design Show, powered by Architectural Digest India, is the most curated design fair in the country. Featuring 100+ luxury brands across furniture, lighting, art, and accessories — invitation and ticket only.',
    start_date: '2026-01-22',
    end_date: '2026-01-25',
    timings: '11:00 AM – 8:00 PM',
    venue_name: 'MMRDA Grounds',
    venue_address: 'Bandra Kurla Complex, Mumbai – 400051',
    city: 'Mumbai',
    status: 'upcoming',
    is_paid: true,
    user_registration_status: null,
    stats: { cities: 20, brands: 100 },
    layout_map_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
    brands: pickBrands(5),
  },
  {
    id: 'exh-004',
    name: 'Design Mumbai 2026',
    tagline: 'Where Design Conversations Begin',
    about: 'Design Mumbai is the city\'s premier design week and fair — a celebration of craft, culture, and contemporary design. The fair spans the historic BKC precinct with multiple pavilions and installations.',
    start_date: '2026-02-12',
    end_date: '2026-02-16',
    timings: '11:00 AM – 8:00 PM',
    venue_name: 'Bandra Kurla Complex',
    venue_address: 'BKC, Bandra East, Mumbai – 400051',
    city: 'Mumbai',
    status: 'upcoming',
    is_paid: true,
    user_registration_status: null,
    stats: { cities: 30, brands: 120 },
    layout_map_url: 'https://images.unsplash.com/photo-1551818255-e6e10579a0d4?w=800',
    brands: pickBrands(7),
  },
  {
    id: 'exh-005',
    name: 'ACETECH Bengaluru 2026',
    tagline: 'South India\'s Building & Design Expo',
    about: 'The Bengaluru edition of ACETECH brings the country\'s most comprehensive building products expo to South India. Covering everything from structural materials to luxury finishes — across 75,000 sqm.',
    start_date: '2026-03-06',
    end_date: '2026-03-09',
    timings: '10:00 AM – 6:00 PM',
    venue_name: 'Bangalore International Exhibition Centre',
    venue_address: '10th Mile, Tumkur Road, Bengaluru – 562123',
    city: 'Bengaluru',
    status: 'upcoming',
    is_paid: false,
    user_registration_status: null,
    stats: { cities: 25, brands: 750 },
    layout_map_url: 'https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=800',
    brands: pickBrands(2),
  },
  {
    id: 'exh-006',
    name: 'India Design ID 2026',
    tagline: 'The International Design Fair',
    about: 'India Design ID is the country\'s most prestigious international design fair, bringing together 200+ Indian and global brands in the heart of the capital. Part of India Design Week.',
    start_date: '2026-02-28',
    end_date: '2026-03-04',
    timings: '11:00 AM – 8:00 PM',
    venue_name: 'The Oval, JLN Stadium',
    venue_address: 'Bhishma Pitamah Marg, New Delhi – 110003',
    city: 'New Delhi',
    status: 'upcoming',
    is_paid: true,
    user_registration_status: null,
    stats: { cities: 40, brands: 200 },
    layout_map_url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800',
    brands: pickBrands(4),
  },
  {
    id: 'exh-007',
    name: 'WOFX Mumbai 2026',
    tagline: 'World of Flooring Expo',
    about: 'WOFX is India\'s dedicated flooring and wall covering exhibition, featuring the latest in tiles, natural stone, hardwood, luxury vinyl, carpets, and wallcoverings from 300+ brands across 20+ countries.',
    start_date: '2026-04-10',
    end_date: '2026-04-13',
    timings: '10:00 AM – 6:00 PM',
    venue_name: 'Bombay Exhibition Centre',
    venue_address: 'Western Express Highway, Goregaon East, Mumbai – 400063',
    city: 'Mumbai',
    status: 'upcoming',
    is_paid: false,
    user_registration_status: null,
    stats: { cities: 20, brands: 300 },
    layout_map_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800',
    brands: pickBrands(6),
  },
  {
    id: 'exh-008',
    name: 'FOAID Delhi 2026',
    tagline: 'Festival of Architecture & Interior Design',
    about: 'FOAID is the country\'s largest festival dedicated to architecture and interior design — a confluence of thought leadership, product showcases, and networking. The Delhi edition brings 100+ speakers and 80+ brands.',
    start_date: '2026-05-08',
    end_date: '2026-05-10',
    timings: '10:00 AM – 7:00 PM',
    venue_name: 'Jawaharlal Nehru Stadium',
    venue_address: 'Bhishma Pitamah Marg, New Delhi – 110003',
    city: 'New Delhi',
    status: 'upcoming',
    is_paid: true,
    user_registration_status: null,
    stats: { cities: 30, brands: 80 },
    layout_map_url: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800',
    brands: pickBrands(8),
  },
  {
    id: 'exh-009',
    name: 'iDAC Mumbai 2026',
    tagline: 'Interior Design & Architecture Convention',
    about: 'iDAC Mumbai is an intimate, high-quality convention and exhibition for interior designers and architects — focused on materials, finishes, and emerging design technologies. Capped at 60 exhibitors for a curated experience.',
    start_date: '2026-06-19',
    end_date: '2026-06-21',
    timings: '10:00 AM – 6:30 PM',
    venue_name: 'The St. Regis Mumbai',
    venue_address: '462, Senapati Bapat Marg, Lower Parel, Mumbai – 400013',
    city: 'Mumbai',
    status: 'upcoming',
    is_paid: true,
    user_registration_status: null,
    stats: { cities: 15, brands: 60 },
    layout_map_url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
    brands: pickBrands(10),
  },
  {
    id: 'exh-011',
    name: 'Design Democracy 2026',
    tagline: 'Design for Everyone',
    about: 'Design Democracy is Bengaluru\'s most inclusive design festival — a platform that brings together designers, makers, brands, and curious minds to celebrate design as a tool for everyday life. Spread across multiple pavilions, it features curated product showcases, live making sessions, talks, and workshops.',
    start_date: '2026-09-11',
    end_date: '2026-09-13',
    timings: '10:00 AM – 8:00 PM',
    venue_name: 'Jayamahal Palace Grounds',
    venue_address: 'Jayamahal Road, Bengaluru – 560046',
    city: 'Bengaluru',
    status: 'upcoming',
    is_paid: false,
    user_registration_status: null,
    stats: { cities: 20, brands: 80 },
    layout_map_url: 'https://images.unsplash.com/photo-1522158637959-30385a09e0da?w=800',
    brands: pickBrands(1),
  },
  {
    id: 'exh-010',
    name: 'Architect & Interior Expo Chennai 2026',
    tagline: 'South India\'s Design & Build Summit',
    about: 'The Architect & Interior Expo brings the best of architecture, interior design, and building products to Chennai — a growing hub for design talent and residential development. 90+ brands across materials, furniture, and technology.',
    start_date: '2026-07-17',
    end_date: '2026-07-19',
    timings: '10:00 AM – 6:00 PM',
    venue_name: 'Chennai Trade Centre',
    venue_address: 'Nandambakkam, Chennai – 600089',
    city: 'Chennai',
    status: 'upcoming',
    is_paid: false,
    user_registration_status: null,
    stats: { cities: 20, brands: 90 },
    layout_map_url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800',
    brands: pickBrands(12),
  },
];

// Quick lookup by ID
export const EXHIBITION_MAP = Object.fromEntries(ALL_EXHIBITIONS.map((e) => [e.id, e]));
