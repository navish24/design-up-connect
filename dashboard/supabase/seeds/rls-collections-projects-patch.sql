-- One-off patch: RLS policies for collections, collection_images, projects, project_images
-- Run in Supabase → SQL Editor (safe to run multiple times)

alter table public.collections        enable row level security;
alter table public.collection_images  enable row level security;
alter table public.projects           enable row level security;
alter table public.project_images     enable row level security;

drop policy if exists "coll_select"    on public.collections;
drop policy if exists "coll_write"     on public.collections;
drop policy if exists "ci_select"      on public.collection_images;
drop policy if exists "ci_write"       on public.collection_images;
drop policy if exists "proj_select"    on public.projects;
drop policy if exists "proj_write"     on public.projects;
drop policy if exists "projimg_select" on public.project_images;
drop policy if exists "projimg_write"  on public.project_images;
drop policy if exists "bpe_all"        on public.brand_past_exhibitions;
drop policy if exists "bpe_select"     on public.brand_past_exhibitions;
drop policy if exists "bpe_write"      on public.brand_past_exhibitions;
drop policy if exists "bpei_all"       on public.brand_past_exhibition_images;
drop policy if exists "bpei_select"    on public.brand_past_exhibition_images;
drop policy if exists "bpei_write"     on public.brand_past_exhibition_images;

create policy "coll_select"    on public.collections        for select using (true);
create policy "coll_write"     on public.collections        for all to authenticated using (true) with check (true);
create policy "ci_select"      on public.collection_images  for select using (true);
create policy "ci_write"       on public.collection_images  for all to authenticated using (true) with check (true);
create policy "proj_select"    on public.projects           for select using (true);
create policy "proj_write"     on public.projects           for all to authenticated using (true) with check (true);
create policy "projimg_select" on public.project_images     for select using (true);
create policy "projimg_write"  on public.project_images     for all to authenticated using (true) with check (true);
create policy "bpe_select"     on public.brand_past_exhibitions       for select using (true);
create policy "bpe_write"      on public.brand_past_exhibitions       for all to authenticated using (true) with check (true);
create policy "bpei_select"    on public.brand_past_exhibition_images for select using (true);
create policy "bpei_write"     on public.brand_past_exhibition_images for all to authenticated using (true) with check (true);
