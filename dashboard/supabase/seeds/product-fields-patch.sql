-- ============================================================
-- Product fields patch: lead_time, installation, customisation_details
-- Run once on existing database.
-- ============================================================

alter table public.products add column if not exists customisation_details text;
alter table public.products add column if not exists lead_time             text;
alter table public.products add column if not exists installation          text;

-- ── Harshita Jhamtani Designs ─────────────────────────────────────────────────

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '6–8 weeks',
  installation = null
where id = 'hjd-p01';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '6–8 weeks',
  installation = null
where id = 'hjd-p02';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '6–8 weeks',
  installation = null
where id = 'hjd-p03';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '4–6 weeks',
  installation = 'By the studio''s team'
where id = 'hjd-p04';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '8–10 weeks',
  installation = 'By the studio''s team (included with purchase)'
where id = 'hjd-p05';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '6–8 weeks',
  installation = null
where id = 'hjd-p06';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '6–8 weeks',
  installation = null
where id = 'hjd-p07';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '4–6 weeks',
  installation = null
where id = 'hjd-p08';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '4–6 weeks',
  installation = null
where id = 'hjd-p09';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '4–6 weeks',
  installation = null
where id = 'hjd-p10';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '6–8 weeks',
  installation = null
where id = 'hjd-p11';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '4–6 weeks',
  installation = null
where id = 'hjd-p12';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '3–4 weeks',
  installation = null
where id = 'hjd-p13';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '8–10 weeks',
  installation = null
where id = 'hjd-p14';

update public.products set
  customisation_details = 'All our lamps are handmade to order, allowing for easy customisation of sizes, colors, and finishes.',
  lead_time    = '3–4 weeks',
  installation = null
where id = 'hjd-p15';

-- ── Arisaa ────────────────────────────────────────────────────────────────────
-- Website does not publish lead times or installation info.
-- All pieces are made to order; contact studio for bespoke enquiries.

update public.products set
  customisation_details = 'Get in touch with brand',
  lead_time    = null,
  installation = null
where brand_id = 'arisaa-b01-2024';
