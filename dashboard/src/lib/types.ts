export type UserRole = 'brand_admin' | 'organiser' | 'gate_staff'

export type OnboardingStep = 'identity' | 'contact' | 'catalogue' | 'representatives' | 'gst'

export type GSTStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected'

export type ExhibitionState = 'upcoming' | 'active' | 'ended'

export type BrandExhibitionStatus =
  | 'invited'
  | 'awaiting_setup'
  | 'setup_in_progress'
  | 'onboarding_in_progress'
  | 'verification_in_progress'
  | 'active'
  | 'failed'

export type LeadRating = 'hot' | 'warm' | 'cold' | null

export type ScanType = 'visitor_initiated' | 'rep_initiated' | 'manual'

export interface Brand {
  id: string
  name: string
  tagline: string | null
  about: string | null
  design_philosophy: string | null
  category: string | null
  cover_image_url: string | null
  website: string | null
  city: string | null
  service_location: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  qr_code_url: string | null
  gst_status: GSTStatus
  gst_document_url: string | null
  onboarding_step: OnboardingStep | 'complete'
  created_at: string
}

export interface Product {
  id: string
  brand_id: string
  name: string
  description: string | null
  material: string | null
  dimensions: string | null
  colour: string | null
  customisation_details: string | null
  display_order: number
  images: ProductImage[]
  created_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  display_order: number
}

export interface Exhibition {
  id: string
  name: string
  venue: string
  city: string
  description: string | null
  start_date: string
  end_date: string
  state: ExhibitionState
  organiser_id: string
  created_at: string
}

export interface ExhibitionBrand {
  id: string
  exhibition_id: string
  brand_id: string
  booth_number: string | null
  status: BrandExhibitionStatus
  passes_allocated: number
  passes_sent: number
  passes_registered: number
  passes_attended: number
  brand?: Brand
}

export interface Representative {
  id: string
  brand_id: string
  user_id: string
  show_on_about_tab: boolean
  status: 'pending' | 'approved' | 'declined'
  user?: {
    id: string
    full_name: string
    designation: string | null
    avatar_url: string | null
  }
}

export interface Visitor {
  id: string
  exhibition_id: string
  brand_id: string
  scan_type: ScanType
  first_name: string
  full_name: string | null
  profession: string | null
  company: string | null
  email: string | null
  phone: string | null
  visitor_timestamp: string
  rep_timestamp: string | null
  rep_id: string | null
  rep_name: string | null
  lead_rating: LeadRating
  notes: string | null
  qualification_answers: Record<string, string> | null
  is_merged: boolean
  is_manual: boolean
}

export interface QualificationQuestion {
  id: string
  exhibition_id: string
  brand_id: string
  text: string
  type: 'single' | 'multiple' | 'text'
  options: string[] | null
  display_order: number
}
