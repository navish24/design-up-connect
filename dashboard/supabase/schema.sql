-- ============================================================
-- DESIGNUP CONNECT — Dashboard Schema
-- Safe to run multiple times (idempotent)
--
-- Existing mobile app tables & their id types:
--   brands(text), exhibitions(text), products(text)
--   exhibition_brands(uuid), profiles(uuid)
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. USERS (dashboard profiles, separate from mobile "profiles")
-- ============================================================
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  phone      text,
  role       text check (role in ('organiser', 'gate_staff')),
  created_at timestamptz default now()
);

-- Auto-create row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill existing auth users
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ============================================================
-- 2. BRANDS — already exists (text id), add missing columns only
-- ============================================================
create table if not exists public.brands (
  id                text primary key default gen_random_uuid()::text,
  name              text not null,
  created_at        timestamptz default now()
);

-- Ensure id has a default (mobile app table may not have one)
alter table public.brands alter column id set default gen_random_uuid()::text;

alter table public.brands add column if not exists admin_user_id      uuid references auth.users(id) on delete set null;
alter table public.brands add column if not exists tagline            text;
alter table public.brands add column if not exists about              text;
alter table public.brands add column if not exists design_philosophy  text;
alter table public.brands add column if not exists category           text;
alter table public.brands add column if not exists cover_image_url    text;
alter table public.brands add column if not exists website            text;
alter table public.brands add column if not exists city               text;
alter table public.brands add column if not exists service_location   text;
alter table public.brands add column if not exists contact_name       text;
alter table public.brands add column if not exists contact_email      text;
alter table public.brands add column if not exists contact_phone      text;
alter table public.brands add column if not exists qr_token           text;
alter table public.brands add column if not exists gst_status         text default 'not_submitted';
alter table public.brands add column if not exists gst_document_url   text;
alter table public.brands add column if not exists onboarding_step    text default 'identity';

-- Unique index on admin_user_id if not already there
create unique index if not exists brands_admin_user_id_key on public.brands(admin_user_id);
create unique index if not exists brands_qr_token_key      on public.brands(qr_token) where qr_token is not null;

-- ============================================================
-- 3. EXHIBITIONS — already exists (text id), add missing columns
-- ============================================================
create table if not exists public.exhibitions (
  id           text primary key default gen_random_uuid()::text,
  name         text not null,
  created_at   timestamptz default now()
);

alter table public.exhibitions add column if not exists organiser_id uuid references auth.users(id) on delete cascade;
alter table public.exhibitions add column if not exists venue        text;
alter table public.exhibitions add column if not exists city         text;
alter table public.exhibitions add column if not exists description  text;
alter table public.exhibitions add column if not exists start_date   date;
alter table public.exhibitions add column if not exists end_date     date;
alter table public.exhibitions add column if not exists state        text default 'upcoming';

-- ============================================================
-- 4. EXHIBITION BRANDS — already exists (uuid id), add missing columns
-- ============================================================
alter table public.exhibition_brands add column if not exists booth_number      text;
alter table public.exhibition_brands add column if not exists status            text default 'invited';
alter table public.exhibition_brands add column if not exists passes_allocated  int default 0;
alter table public.exhibition_brands add column if not exists passes_sent       int default 0;
alter table public.exhibition_brands add column if not exists passes_registered int default 0;
alter table public.exhibition_brands add column if not exists passes_attended   int default 0;

-- ============================================================
-- 5. BRAND MEMBERS (new)
-- ============================================================
create table if not exists public.brand_members (
  id            text primary key default gen_random_uuid()::text,
  brand_id      text not null references public.brands(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'rep' check (role in ('admin', 'rep')),
  status        text not null default 'pending' check (status in ('pending','approved','declined')),
  show_on_about boolean not null default false,
  created_at    timestamptz default now(),
  unique (brand_id, user_id)
);

-- ============================================================
-- 6. PRODUCTS — already exists (text id), add missing columns
-- ============================================================
create table if not exists public.products (
  id         text primary key default gen_random_uuid()::text,
  brand_id   text not null references public.brands(id) on delete cascade,
  name       text not null,
  created_at timestamptz default now()
);

alter table public.products alter column id set default gen_random_uuid()::text;

alter table public.products add column if not exists description           text;
alter table public.products add column if not exists material              text;
alter table public.products add column if not exists dimensions            text;
alter table public.products add column if not exists colour                text;
alter table public.products add column if not exists customisation_details text;
alter table public.products add column if not exists display_order         int default 0;

-- ============================================================
-- 7. PRODUCT IMAGES (new, product_id = text)
-- ============================================================
create table if not exists public.product_images (
  id            text primary key default gen_random_uuid()::text,
  product_id    text not null references public.products(id) on delete cascade,
  url           text not null,
  display_order int not null default 0
);

-- ============================================================
-- 8. VISITORS (new)
-- ============================================================
create table if not exists public.visitors (
  id         text primary key default gen_random_uuid()::text,
  qr_token   text unique default gen_random_uuid()::text,
  name       text not null,
  profession text,
  company    text,
  email      text,
  phone      text,
  created_at timestamptz default now()
);

-- ============================================================
-- 9. VISITOR SCANS (new, all FK types match existing tables)
-- ============================================================
create table if not exists public.visitor_scans (
  id                    text primary key default gen_random_uuid()::text,
  exhibition_id         text not null references public.exhibitions(id) on delete cascade,
  brand_id              text not null references public.brands(id) on delete cascade,
  visitor_id            text not null references public.visitors(id) on delete cascade,
  scan_type             text not null default 'rep_initiated'
                          check (scan_type in ('visitor_initiated','rep_initiated','manual')),
  rep_id                uuid references auth.users(id) on delete set null,
  rep_name              text,
  lead_rating           text check (lead_rating in ('hot','warm','cold')),
  notes                 text,
  qualification_answers jsonb,
  is_manual             boolean not null default false,
  created_at            timestamptz default now()
);

-- ============================================================
-- 10. GATE ENTRIES (new)
-- ============================================================
create table if not exists public.gate_entries (
  id            text primary key default gen_random_uuid()::text,
  exhibition_id text not null references public.exhibitions(id) on delete cascade,
  visitor_id    text not null references public.visitors(id) on delete cascade,
  created_at    timestamptz default now()
);

-- ============================================================
-- 11. QUALIFICATION QUESTIONS (new, exhibition_brand_id = uuid)
-- ============================================================
create table if not exists public.qualification_questions (
  id                  text primary key default gen_random_uuid()::text,
  exhibition_brand_id uuid not null references public.exhibition_brands(id) on delete cascade,
  text                text not null,
  type                text not null default 'text'
                        check (type in ('text','single_choice','multi_choice')),
  options             jsonb not null default '[]',
  required            boolean not null default false,
  "order"             int not null default 0,
  created_at          timestamptz default now()
);

-- ============================================================
-- 12. VISITOR PASSES (new)
-- ============================================================
create table if not exists public.visitor_passes (
  id            text primary key default gen_random_uuid()::text,
  exhibition_id text not null references public.exhibitions(id) on delete cascade,
  brand_id      text not null references public.brands(id) on delete cascade,
  visitor_id    text references public.visitors(id) on delete set null,
  scanned       boolean not null default false,
  created_at    timestamptz default now()
);

-- ============================================================
-- 13. GATE STAFF ASSIGNMENTS (new)
-- ============================================================
create table if not exists public.gate_staff_assignments (
  id            text primary key default gen_random_uuid()::text,
  user_id       uuid not null references auth.users(id) on delete cascade,
  exhibition_id text not null references public.exhibitions(id) on delete cascade,
  created_at    timestamptz default now(),
  unique (user_id, exhibition_id)
);

-- ============================================================
-- 14. COLLECTIONS (new)
-- ============================================================
create table if not exists public.collections (
  id            text primary key default gen_random_uuid()::text,
  brand_id      text not null references public.brands(id) on delete cascade,
  name          text not null,
  description   text,
  display_order int default 0,
  created_at    timestamptz default now()
);

create table if not exists public.collection_images (
  id            text primary key default gen_random_uuid()::text,
  collection_id text not null references public.collections(id) on delete cascade,
  url           text not null,
  display_order int default 0
);

-- ============================================================
-- 15. PROJECTS — already exists (text id), add missing columns
-- ============================================================
create table if not exists public.projects (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  created_at  timestamptz default now()
);

alter table public.projects alter column id set default gen_random_uuid()::text;
alter table public.projects add column if not exists brand_id     text references public.brands(id) on delete cascade;
alter table public.projects add column if not exists description  text;
alter table public.projects add column if not exists year         int;
alter table public.projects add column if not exists display_order int default 0;

create table if not exists public.project_images (
  id            text primary key default gen_random_uuid()::text,
  project_id    text not null references public.projects(id) on delete cascade,
  url           text not null,
  display_order int default 0
);

-- ============================================================
-- 16. BRAND PAST EXHIBITIONS (manual history entries)
-- ============================================================
create table if not exists public.brand_past_exhibitions (
  id            text primary key default gen_random_uuid()::text,
  brand_id      text not null references public.brands(id) on delete cascade,
  name          text not null,
  city          text,
  venue         text,
  description   text,
  start_date    date,
  end_date      date,
  created_at    timestamptz default now()
);

create table if not exists public.brand_past_exhibition_images (
  id                   text primary key default gen_random_uuid()::text,
  past_exhibition_id   text not null references public.brand_past_exhibitions(id) on delete cascade,
  url                  text not null,
  display_order        int default 0
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_brand_members_user    on public.brand_members(user_id);
create index if not exists idx_brand_members_brand   on public.brand_members(brand_id);
create index if not exists idx_products_brand        on public.products(brand_id);
create index if not exists idx_product_images_prod   on public.product_images(product_id, display_order);
create index if not exists idx_exhibitions_organiser on public.exhibitions(organiser_id);
create index if not exists idx_visitor_scans_exh     on public.visitor_scans(exhibition_id, brand_id);
create index if not exists idx_gate_entries_exh      on public.gate_entries(exhibition_id, created_at desc);
create index if not exists idx_gate_staff_user       on public.gate_staff_assignments(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users                   enable row level security;
alter table public.brands                  enable row level security;
alter table public.brand_members           enable row level security;
alter table public.products                enable row level security;
alter table public.product_images          enable row level security;
alter table public.exhibitions             enable row level security;
alter table public.exhibition_brands       enable row level security;
alter table public.visitors                enable row level security;
alter table public.visitor_scans           enable row level security;
alter table public.gate_entries            enable row level security;
alter table public.qualification_questions enable row level security;
alter table public.visitor_passes          enable row level security;
alter table public.gate_staff_assignments         enable row level security;
alter table public.brand_past_exhibitions         enable row level security;
alter table public.brand_past_exhibition_images   enable row level security;

-- Drop all existing policies cleanly
do $$ declare r record; begin
  for r in
    select policyname, tablename from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- USERS
create policy "users_select" on public.users for select to authenticated using (true);
create policy "users_update" on public.users for update to authenticated using (auth.uid() = id);

-- BRANDS (public read — brand profiles are a public marketplace directory)
create policy "brands_select" on public.brands for select using (true);
create policy "brands_insert" on public.brands for insert to authenticated with check (true);
create policy "brands_update" on public.brands for update to authenticated using (true);

-- BRAND MEMBERS
create policy "bm_all" on public.brand_members for all to authenticated using (true) with check (true);

-- PRODUCTS (public read)
create policy "prod_select" on public.products for select using (true);
create policy "prod_write"  on public.products for all to authenticated using (true) with check (true);

-- PRODUCT IMAGES (public read so mobile app anon key can fetch images)
create policy "pi_select" on public.product_images for select using (true);
create policy "pi_write"  on public.product_images for all to authenticated using (true) with check (true);

-- EXHIBITIONS
create policy "exh_select" on public.exhibitions for select to authenticated using (true);
create policy "exh_write"  on public.exhibitions for all to authenticated using (true) with check (true);

-- EXHIBITION BRANDS
create policy "eb_select" on public.exhibition_brands for select to authenticated using (true);
create policy "eb_all"    on public.exhibition_brands for all to authenticated using (true) with check (true);

-- VISITORS
create policy "vis_all" on public.visitors for all to authenticated using (true) with check (true);

-- VISITOR SCANS
create policy "vs_all" on public.visitor_scans for all to authenticated using (true) with check (true);

-- GATE ENTRIES
create policy "ge_all" on public.gate_entries for all to authenticated using (true) with check (true);

-- QUALIFICATION QUESTIONS
create policy "qq_all" on public.qualification_questions for all to authenticated using (true) with check (true);

-- VISITOR PASSES
create policy "vp_all" on public.visitor_passes for all to authenticated using (true) with check (true);

-- GATE STAFF ASSIGNMENTS
create policy "gsa_all" on public.gate_staff_assignments for all to authenticated using (true) with check (true);

-- BRAND PAST EXHIBITIONS (public read so mobile can show brand history)
create policy "bpe_select"  on public.brand_past_exhibitions       for select using (true);
create policy "bpe_write"   on public.brand_past_exhibitions       for all to authenticated using (true) with check (true);
create policy "bpei_select" on public.brand_past_exhibition_images for select using (true);
create policy "bpei_write"  on public.brand_past_exhibition_images for all to authenticated using (true) with check (true);

-- COLLECTIONS (public read)
alter table public.collections        enable row level security;
alter table public.collection_images  enable row level security;
create policy "coll_select" on public.collections       for select using (true);
create policy "coll_write"  on public.collections       for all to authenticated using (true) with check (true);
create policy "ci_select"   on public.collection_images for select using (true);
create policy "ci_write"    on public.collection_images for all to authenticated using (true) with check (true);

-- PROJECTS (public read)
alter table public.projects       enable row level security;
alter table public.project_images enable row level security;
create policy "proj_select"    on public.projects       for select using (true);
create policy "proj_write"     on public.projects       for all to authenticated using (true) with check (true);
create policy "projimg_select" on public.project_images for select using (true);
create policy "projimg_write"  on public.project_images for all to authenticated using (true) with check (true);
