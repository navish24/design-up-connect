-- ============================================================
-- Designup Connect — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
-- Convention: demo = 1 means demo/seed data, demo = 0 means real data
-- All tables include demo smallint for filtering in queries.
-- ============================================================


-- ── 1. USER PROFILES ──────────────────────────────────────────────────────────
-- Extends Supabase auth.users. One row per registered user.

create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  first_name        text,
  last_name         text,
  email             text,
  phone             text,
  designation       text,
  company_name      text,
  city              text,
  country           text,
  designup_user_id  text unique,          -- e.g. "priya_sharma_42", used in QR
  created_at        timestamptz default now(),
  demo              smallint not null default 0 check (demo in (0, 1))
);

-- Auto-create a profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 2. EXHIBITIONS ────────────────────────────────────────────────────────────
-- Each exhibition is a distinct event (Index Mumbai, ACETECH, etc.)

create table if not exists public.exhibitions (
  id              text primary key,               -- e.g. "exh-001"
  name            text not null,
  tagline         text,
  about           text,
  start_date      date,
  end_date        date,
  timings         text,                           -- e.g. "10:00 AM – 7:00 PM"
  venue_name      text,
  venue_address   text,
  city            text,
  status          text check (status in ('active', 'upcoming', 'past')),
  is_paid         boolean default false,
  layout_map_url  text,
  stats_cities    int default 0,
  stats_brands    int default 0,
  created_at      timestamptz default now(),
  demo            smallint not null default 0 check (demo in (0, 1))
);


-- ── 3. BRANDS ─────────────────────────────────────────────────────────────────
-- Brand profile — independent of any exhibition.

create table if not exists public.brands (
  id              text primary key,               -- e.g. "b01"
  name            text not null,
  category        text,                           -- "Lighting", "Furniture", etc.
  tagline         text,
  story           text,
  contact_name    text,
  email           text,
  phone           text,
  website         text,
  instagram       text,
  logo_initial    text,                           -- 2-letter abbrev for avatar
  created_at      timestamptz default now(),
  demo            smallint not null default 0 check (demo in (0, 1))
);


-- ── 4. EXHIBITION ↔ BRAND (junction) ─────────────────────────────────────────
-- Links brands to exhibitions with booth/hall assignment.
-- A brand can appear at multiple exhibitions with different booth numbers.

create table if not exists public.exhibition_brands (
  id              uuid primary key default gen_random_uuid(),
  exhibition_id   text not null references public.exhibitions (id) on delete cascade,
  brand_id        text not null references public.brands (id) on delete cascade,
  booth_number    text,
  hall_number     text,
  created_at      timestamptz default now(),
  demo            smallint not null default 0 check (demo in (0, 1)),
  unique (exhibition_id, brand_id)
);


-- ── 5. PRODUCTS ───────────────────────────────────────────────────────────────
-- Products belong to a brand. Images stored as array of URLs (Cloudinary/Supabase Storage).

create table if not exists public.products (
  id              text primary key,               -- e.g. "b01-p1"
  brand_id        text not null references public.brands (id) on delete cascade,
  name            text not null,
  description     text,
  material        text,
  dimensions      text,
  color           text,
  customisable    text,
  images          text[] default '{}',            -- array of image URLs
  created_at      timestamptz default now(),
  demo            smallint not null default 0 check (demo in (0, 1))
);


-- ── 6. PROJECTS ───────────────────────────────────────────────────────────────
-- Case study / installation projects belonging to a brand.

create table if not exists public.projects (
  id              text primary key,               -- e.g. "b01-proj1"
  brand_id        text not null references public.brands (id) on delete cascade,
  name            text not null,
  city            text,
  theme           text,
  about           text,
  images          text[] default '{}',
  created_at      timestamptz default now(),
  demo            smallint not null default 0 check (demo in (0, 1))
);


-- ── 7. EXHIBITION REGISTRATIONS ───────────────────────────────────────────────
-- Tracks when a user registers for an upcoming exhibition.

create table if not exists public.exhibition_registrations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  exhibition_id   text not null references public.exhibitions (id) on delete cascade,
  registered_at   timestamptz default now(),
  demo            smallint not null default 0 check (demo in (0, 1)),
  unique (user_id, exhibition_id)
);


-- ── 8. EXHIBITION CHECK-INS ───────────────────────────────────────────────────
-- Tracks when a user physically scans the entry QR at an exhibition.

create table if not exists public.exhibition_checkins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  exhibition_id   text not null references public.exhibitions (id) on delete cascade,
  checked_in_at   timestamptz default now(),
  demo            smallint not null default 0 check (demo in (0, 1)),
  unique (user_id, exhibition_id)
);


-- ── 9. SAVED BRANDS ───────────────────────────────────────────────────────────
-- User's wishlist — brands saved by scanning a booth QR.

create table if not exists public.saved_brands (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  brand_id        text not null references public.brands (id) on delete cascade,
  exhibition_id   text references public.exhibitions (id),   -- which event they saved it at
  saved_at        timestamptz default now(),
  demo            smallint not null default 0 check (demo in (0, 1)),
  unique (user_id, brand_id, exhibition_id)
);


-- ── 10. CONNECTIONS ───────────────────────────────────────────────────────────
-- User-to-user connections made by scanning another person's QR badge.

create table if not exists public.connections (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,  -- who scanned
  connected_user_id   uuid not null references public.profiles (id) on delete cascade,  -- who was scanned
  exhibition_id       text references public.exhibitions (id),
  connected_at        timestamptz default now(),
  is_mutual           boolean default false,      -- true when both have each other
  demo                smallint not null default 0 check (demo in (0, 1)),
  unique (user_id, connected_user_id, exhibition_id)
);


-- ── 11. QR CODES ──────────────────────────────────────────────────────────────
-- Stores all QR codes issued. Used by the scan Edge Function to resolve scans.

create table if not exists public.qr_codes (
  id              uuid primary key default gen_random_uuid(),
  qr_data         text not null unique,           -- string encoded in the QR image
  type            text check (type in ('booth', 'user', 'entry')),
  reference_id    text not null,                  -- brand_id, user_id, or exhibition_id
  exhibition_id   text references public.exhibitions (id),
  created_at      timestamptz default now(),
  demo            smallint not null default 0 check (demo in (0, 1))
);


-- ── 12. SUPPORT QUERIES ───────────────────────────────────────────────────────
-- Queries submitted via Help & Support in the app.
-- (Mirrors what goes to Google Sheets — keep both in sync or use one only.)

create table if not exists public.support_queries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles (id),
  name            text,
  email           text,
  query           text not null,
  submitted_at    timestamptz default now(),
  demo            smallint not null default 0 check (demo in (0, 1))
);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles               enable row level security;
alter table public.exhibitions            enable row level security;
alter table public.brands                 enable row level security;
alter table public.exhibition_brands      enable row level security;
alter table public.products               enable row level security;
alter table public.projects               enable row level security;
alter table public.exhibition_registrations enable row level security;
alter table public.exhibition_checkins    enable row level security;
alter table public.saved_brands           enable row level security;
alter table public.connections            enable row level security;
alter table public.qr_codes               enable row level security;
alter table public.support_queries        enable row level security;

-- Public read: exhibitions, brands, products, projects, exhibition_brands, qr_codes
create policy "Public can read exhibitions"       on public.exhibitions            for select using (true);
create policy "Public can read brands"            on public.brands                 for select using (true);
create policy "Public can read exhibition_brands" on public.exhibition_brands      for select using (true);
create policy "Public can read products"          on public.products               for select using (true);
create policy "Public can read projects"          on public.projects               for select using (true);
create policy "Public can read qr_codes"          on public.qr_codes               for select using (true);

-- Profiles: users can read/update only their own row
create policy "Users can read own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Saved brands: users can manage their own saves
create policy "Users can read own saved brands"   on public.saved_brands for select using (auth.uid() = user_id);
create policy "Users can insert own saved brands" on public.saved_brands for insert with check (auth.uid() = user_id);
create policy "Users can delete own saved brands" on public.saved_brands for delete using (auth.uid() = user_id);

-- Connections: users can read connections where they are either party
create policy "Users can read own connections" on public.connections for select
  using (auth.uid() = user_id or auth.uid() = connected_user_id);
create policy "Users can insert own connections" on public.connections for insert
  with check (auth.uid() = user_id);

-- Registrations: users manage their own
create policy "Users can read own registrations" on public.exhibition_registrations for select using (auth.uid() = user_id);
create policy "Users can insert own registrations" on public.exhibition_registrations for insert with check (auth.uid() = user_id);

-- Check-ins: users manage their own
create policy "Users can read own checkins" on public.exhibition_checkins for select using (auth.uid() = user_id);
create policy "Users can insert own checkins" on public.exhibition_checkins for insert with check (auth.uid() = user_id);

-- Support queries: users can submit, no read-back needed from client
create policy "Users can insert support queries" on public.support_queries for insert with check (true);


-- ============================================================
-- INDEXES (for common query patterns)
-- ============================================================

create index if not exists idx_exhibition_brands_exhibition on public.exhibition_brands (exhibition_id);
create index if not exists idx_exhibition_brands_brand      on public.exhibition_brands (brand_id);
create index if not exists idx_products_brand               on public.products (brand_id);
create index if not exists idx_projects_brand               on public.projects (brand_id);
create index if not exists idx_saved_brands_user            on public.saved_brands (user_id);
create index if not exists idx_connections_user             on public.connections (user_id);
create index if not exists idx_connections_connected_user   on public.connections (connected_user_id);
create index if not exists idx_registrations_user           on public.exhibition_registrations (user_id);
create index if not exists idx_checkins_user                on public.exhibition_checkins (user_id);
create index if not exists idx_qr_codes_data               on public.qr_codes (qr_data);

-- Filter demo vs real data efficiently
create index if not exists idx_exhibitions_demo  on public.exhibitions (demo);
create index if not exists idx_brands_demo       on public.brands (demo);
create index if not exists idx_products_demo     on public.products (demo);
