// Designup Connect — Core TypeScript Types
// Mirrors the data model in docs/02-data-model.md

export type AppTheme = 'dark' | 'light';

export type ExhibitionStatus = 'upcoming' | 'active' | 'past';

export type RegistrationStatus = 'registered' | 'checked_in';

export type ConnectionType =
  | 'booth_scan'
  | 'visitor_scanned_rep'
  | 'rep_scanned_visitor'
  | 'networking';

export type ConnectionScope = 'brand' | 'personal';

export interface User {
  id: string;
  designup_user_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone: string;
  profession?: string;
  company_name?: string;
  designation?: string;
  city?: string;
  country?: string;
  linkedin_url?: string;
  instagram_handle?: string;
  website_url?: string;
  other_url?: string;
  profile_image_url?: string;
  profile_complete: boolean;
}

export interface Exhibition {
  id: string;
  name: string;
  tagline?: string;
  about?: string;
  start_date: string;
  end_date: string;
  timings?: string;
  venue_name?: string;
  venue_address?: string;
  city?: string;
  layout_map_url?: string;
  status: ExhibitionStatus;
  is_paid: boolean;
  brand_count?: number;
  user_registration_status?: RegistrationStatus | null;
  entry_qr_url?: string;
}

export interface Brand {
  id: string;
  name: string;
  category: string;
  tagline?: string;
  story?: string;
  logo_url?: string;
  catalogue_is_private: boolean;
}

export interface SavedBrand {
  id: string;
  brand_id: string;
  brand_name: string;
  brand_category: string;
  brand_tagline?: string;
  product_image_url?: string;
  exhibition_id: string;
  exhibition_name: string;
  booth_number?: string;
  hall_number?: string;
  notes?: string;
  saved_at: string;
}

export interface Connection {
  id: string;
  user: {
    id: string;
    full_name: string;
    designup_user_id: string;
    designation?: string;
    company_name?: string;
    city?: string;
    phone?: string;
    email?: string;
    linkedin_url?: string;
    instagram_handle?: string;
    website_url?: string;
    profile_image_url?: string;
  };
  brand_name?: string;
  brand_id?: string;
  connection_type: ConnectionType;
  scope: ConnectionScope;
  is_mutual: boolean;
  to_contact_shared: boolean;
  from_contact_shared: boolean;
  notes?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface CardContactField {
  label: string;
  value: string;
}

export interface CardContact {
  id: string;
  source: 'card_scan';
  scanned_at: string;
  card_image_uri: string | null;
  card_image_uri_back: string | null;
  fields: CardContactField[];
  notes: string;
  tags: string[];
  nexgild_user_id: string | null;
}

export interface ScanResult {
  scan_type: 'booth' | 'user' | 'entry' | 'unknown';
  action: 'brand_saved' | 'already_saved' | 'connection_created' | 'already_connected' | 'exhibition_activated';
  brand?: {
    id: string;
    name: string;
    category: string;
    tagline?: string;
    booth_number: string;
    hall_number: string;
    exhibition_name: string;
    product_images: string[];
  };
  connection?: {
    id: string;
    user: { full_name: string; designation?: string; company_name?: string; designup_user_id: string };
    contact_shared: boolean;
    is_mutual: boolean;
  };
  exhibition?: {
    id: string;
    name: string;
  };
}
