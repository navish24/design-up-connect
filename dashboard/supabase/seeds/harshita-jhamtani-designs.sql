-- ============================================================
-- Harshita Jhamtani Designs — Demo Brand Seed
-- Run in: Supabase Dashboard → SQL Editor
-- Brand ID: hjd-b01-2024
-- QR encodes as: booth:hjd-b01-2024
-- ============================================================

-- ── 1. BRAND ─────────────────────────────────────────────────
INSERT INTO public.brands (
  id, name, tagline, about, design_philosophy, category,
  cover_image_url, website, city, contact_email,
  qr_token, gst_status, onboarding_step
) VALUES (
  'hjd-b01-2024',
  'Harshita Jhamtani Designs',
  'Handcrafted light for considered spaces',
  'Harshita Jhamtani Designs is a Mumbai-based studio crafting handmade lighting and furniture at the intersection of art and function. Founded by architect-turned-designer Harshita Jhamtani, the studio is known for sculptural clay lamps, natural stone wall lights, and totem floor lamps — each piece built to order. Winner of the EDIDA 2021 Award in Lighting, and featured in Architectural Digest India, Elle Décor, and Living ETC India.',
  'We believe light is not just functional — it is the most expressive material in a space. Every piece is a conversation between form, material, and glow, designed to last a lifetime and feel entirely your own.',
  'Lighting & Furniture',
  'https://static.wixstatic.com/media/67a4ef_56422cdaf100415fac61c15a5d349eb1~mv2.jpg',
  'https://www.harshitajhamtani.com',
  'Mumbai',
  'hello@harshitajhamtani.com',
  'hjd-b01-2024',
  'approved',
  'complete'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  about = EXCLUDED.about,
  design_philosophy = EXCLUDED.design_philosophy,
  category = EXCLUDED.category,
  cover_image_url = EXCLUDED.cover_image_url,
  website = EXCLUDED.website,
  city = EXCLUDED.city,
  contact_email = EXCLUDED.contact_email,
  qr_token = EXCLUDED.qr_token,
  gst_status = EXCLUDED.gst_status,
  onboarding_step = EXCLUDED.onboarding_step;

-- ── 2. COLLECTIONS ────────────────────────────────────────────
INSERT INTO public.collections (id, brand_id, name, description, display_order) VALUES
  ('hjd-c01', 'hjd-b01-2024', 'The Rio Collection',
   'Wall lights sculpted from natural stone — travertine, rainforest marble, alabaster, and pizzato — each with signature fluting and brass accents. Every piece is unique, shaped by the veining and colour of the stone it is carved from.',
   1),
  ('hjd-c02', 'hjd-b01-2024', 'Totem Series',
   'Freestanding floor lamps that read as sculpture. Built over 80+ hours in clay stoneware and claypaste on a mild steel armature, each totem carries the full material vocabulary of the studio from first lamp to latest form.',
   2),
  ('hjd-c03', 'hjd-b01-2024', 'Pendants & Chandeliers',
   'Ceiling fixtures that define a room — from the delicate Bloom pendant tracing a flower''s growth to the brass ring chandelier that turns negative space into ornament.',
   3)
ON CONFLICT (id) DO NOTHING;

-- Collection images (3–4 per collection = 10 total)
INSERT INTO public.collection_images (id, collection_id, url, display_order) VALUES
  -- Rio Collection
  ('hjd-ci01', 'hjd-c01', 'https://static.wixstatic.com/media/67a4ef_56422cdaf100415fac61c15a5d349eb1~mv2.jpg', 1),
  ('hjd-ci02', 'hjd-c01', 'https://static.wixstatic.com/media/67a4ef_dc0794650c6c43b696de70f4482da15b~mv2.jpg', 2),
  ('hjd-ci03', 'hjd-c01', 'https://static.wixstatic.com/media/67a4ef_79bde5707e094e9381712fdbb35a33be~mv2.jpg', 3),
  ('hjd-ci04', 'hjd-c01', 'https://static.wixstatic.com/media/67a4ef_64ac390b3a824bb6ab7b80fe2b40bf9e~mv2.jpg', 4),
  -- Totem Series
  ('hjd-ci05', 'hjd-c02', 'https://static.wixstatic.com/media/67a4ef_090f6f2764474878a6a056f4ec953a2a~mv2.jpg', 1),
  ('hjd-ci06', 'hjd-c02', 'https://static.wixstatic.com/media/67a4ef_1219ac2b81634ab4af00330ea192d085~mv2.jpg', 2),
  ('hjd-ci07', 'hjd-c02', 'https://static.wixstatic.com/media/67a4ef_32a6d73160f94665aeec5fa37c1be4c3~mv2.jpg', 3),
  -- Pendants & Chandeliers
  ('hjd-ci08', 'hjd-c03', 'https://static.wixstatic.com/media/67a4ef_09c382a29a234c62af7e01dd6ee2cfd4~mv2.jpg', 1),
  ('hjd-ci09', 'hjd-c03', 'https://static.wixstatic.com/media/67a4ef_0766e8810f124207b10082023d41f7b4~mv2.jpg', 2),
  ('hjd-ci10', 'hjd-c03', 'https://static.wixstatic.com/media/67a4ef_cd84fd3879ee4b438781937ed5b8d8d7~mv2.jpg', 3)
ON CONFLICT (id) DO NOTHING;

-- ── 3. PRODUCTS (15) ──────────────────────────────────────────
INSERT INTO public.products (id, brand_id, name, description, material, dimensions, colour, display_order) VALUES
  ('hjd-p01', 'hjd-b01-2024', 'Rio Wall Light — Rainforest',
   'This wall light extends the Rio collection into a new format with sculptural softness. Crafted in natural stone with signature fluting detail and brass accents, it casts a soft, diffused glow ideal for bedside settings. Each handcrafted piece is unique.',
   'Green Rainforest stone, Brass finish MS', '10" H × 8" Ø × 10" from wall', 'Green / Natural Stone', 1),

  ('hjd-p02', 'hjd-b01-2024', 'Bean Table Lamp (Marble)',
   'Three stacked rounded forms in rainforest green marble with natural veining, topped with a polished alabaster dome shade that produces warm illumination when lit. A masterpiece of modern design that blends sculptural aesthetics with functional lighting.',
   'Alabaster, Rainforest Green Marble', '24" H × 14" Ø', 'Green / White', 2),

  ('hjd-p03', 'hjd-b01-2024', 'Asteroid — Clay Floor Lamp',
   'Introducing the Asteroid floor lamp, a truly unique piece poured from the studio''s heart. This totem-style lamp represents functional art, blending aesthetics with practicality. Handcrafted over 80 hours, it''s designed as a distinctive statement piece.',
   'Clay (Stoneware), Mild steel base & pipe', '64" H × 18" Ø', 'Natural Clay', 3),

  ('hjd-p04', 'hjd-b01-2024', 'Bloom Pendant',
   'This pendant traces the quiet poetry of growth, capturing a flower''s journey from seed to full bloom. Five stages expressed in delicate pastel shades across a horizontal form, designed for dining areas and intimate settings.',
   'Mild steel, in-house claypaste, FRP', '48" L × 6"–7" W', 'Pastel Multi', 4),

  ('hjd-p05', 'hjd-b01-2024', 'Ring Chandelier',
   'A playful two-tier design featuring brass rings suspended from pipes with Tyvek light modules in a concentric circular pattern. Additional tiers available. Professional installation by the maker''s team required.',
   'Tyvek modules, brass rings, mild steel pipes (black powder coated)', '36" H × 60" Ø', 'Brass / Black', 5),

  ('hjd-p06', 'hjd-b01-2024', 'Kasa Floor Lamp — Nude',
   'Inspired by Japanese forms, designed to embody simplicity and capture a Zen-like vibe. An indirect LED light source behind frosted acrylic produces a soft, ambient glow that creates a serene atmosphere in any room.',
   'Mild steel base with in-house clay paste coating', '68" H × 21" Ø', 'Nude / Natural', 6),

  ('hjd-p07', 'hjd-b01-2024', 'Totem Floor Lamp',
   'One of the studio''s sleekest and most recent favourites — a dual-colour totem floor lamp. Each piece is built by hand and finished with in-house clay paste for added texture. A living sculpture that anchors any room.',
   'Clay (Stoneware), In-house Claypaste, Mild steel base & pipe', '5''6" H × 14" Ø shade', 'Dual Clay', 7),

  ('hjd-p08', 'hjd-b01-2024', 'Cone Pendant — Brushed Silver',
   'A modern pendant featuring stacked triangular forms that can be adjusted to suit the height and proportions of your space. Available in brushed silver, dull gold, and textured black finishes.',
   'Casted Aluminium', '18" Ø × 30" H (17" module + 13" drop)', 'Brushed Silver', 8),

  ('hjd-p09', 'hjd-b01-2024', 'Scallop Wall Light',
   'The Scallop brings a playful yet elegant touch to a space. Its charming umbrella-like scalloped design creates a soft, warm glow that enhances ambiance. Functions as either an uplighter or downlighter, with stackable components.',
   'Mild Steel, In-house Claypaste, Clay (Stoneware)', '13" H × 7" Ø', 'Natural Clay', 9),

  ('hjd-p10', 'hjd-b01-2024', 'Rex Table Lamp',
   'The smallest and cutest in the collection, featuring a dome top adorned with subtle dino-inspired scales for a whimsical and playful touch. Hand-thrown stoneware with signature clay paste finishing in soft pastel shades. A collaboration with Kaji Kids.',
   'Clay (Stoneware)', '10" H × 9" Ø', 'Soft Pastel', 10),

  ('hjd-p11', 'hjd-b01-2024', 'Iris Pendant',
   'The accidental light — named after the flowering plant because of its resemblance. Two pendants flipped and stacked created this ceiling fixture organically. A meditation on how the best forms emerge without forcing them.',
   'FRP (Fiber reinforced plastic), In-house Claypaste, Mild steel', '28" Ø × 19.5" H', 'Natural / Ivory', 11),

  ('hjd-p12', 'hjd-b01-2024', 'Branch Wall Light',
   'Wall lights inspired by tree branch shapes. Bulbs peek out like little buds, casting a warm and cozy light. The textured black finish grounds the organic silhouette against any wall surface.',
   'Mild steel base, in-house claypaste, glass globe (3" × 4")', '25" H × 10" Ø × 5" D', 'Textured Black', 12),

  ('hjd-p13', 'hjd-b01-2024', 'Wilo Nude',
   'An indoor/outdoor terrazzo wall light reminiscent of the terrazzo flooring of the 80s — classic, playful, and timeless. The neutral palette adds warmth and texture whether illuminated or not.',
   'Terrazzo, aluminium, silicone, LED (14W)', '6" Ø × 2.5" D', 'Nude Terrazzo', 13),

  ('hjd-p14', 'hjd-b01-2024', 'Legacy Totem',
   'At nearly seven feet tall, this is one of the widest and most personal pieces the studio has ever created. It brings together every chapter of the studio''s evolution — from the very first Asteroid floor lamp to the sculptural totems, to hand-built chandeliers and suspended clay elements.',
   'Clay (Stoneware), In-house Claypaste, Mild steel', '84" H × 24" Ø', 'Natural Clay', 14),

  ('hjd-p15', 'hjd-b01-2024', 'Orbis — Casted',
   'A candle stand inspired by the studio''s totems collection, scaled down into a piece that brings sculptural presence to a tabletop. Available in brushed silver, dull brass, and textured black.',
   'Casted Aluminium', '14.5" H × 4.5" Ø', 'Brushed Silver / Brass / Black', 15)
ON CONFLICT (id) DO NOTHING;

-- Product images (2–3 per product)
INSERT INTO public.product_images (id, product_id, url, display_order) VALUES
  -- Rio Wall Light
  ('hjd-pi01', 'hjd-p01', 'https://static.wixstatic.com/media/67a4ef_56422cdaf100415fac61c15a5d349eb1~mv2.jpg', 1),
  ('hjd-pi02', 'hjd-p01', 'https://static.wixstatic.com/media/67a4ef_dc0794650c6c43b696de70f4482da15b~mv2.jpg', 2),
  ('hjd-pi03', 'hjd-p01', 'https://static.wixstatic.com/media/67a4ef_79bde5707e094e9381712fdbb35a33be~mv2.jpg', 3),
  -- Bean Table Lamp
  ('hjd-pi04', 'hjd-p02', 'https://static.wixstatic.com/media/67a4ef_d7ab1e46db81475d8261a1d9dd65c424~mv2.jpg', 1),
  ('hjd-pi05', 'hjd-p02', 'https://static.wixstatic.com/media/67a4ef_20e0e6270a3e4d89abb081b3f5349a2c~mv2.jpg', 2),
  ('hjd-pi06', 'hjd-p02', 'https://static.wixstatic.com/media/67a4ef_9920e71fb8b848c8b7b3a03e5b9521d8~mv2.jpg', 3),
  -- Asteroid Floor Lamp
  ('hjd-pi07', 'hjd-p03', 'https://static.wixstatic.com/media/67a4ef_1219ac2b81634ab4af00330ea192d085~mv2.jpg', 1),
  ('hjd-pi08', 'hjd-p03', 'https://static.wixstatic.com/media/67a4ef_d6ce37a08062403ab69a2f6e42f2f892~mv2.jpg', 2),
  ('hjd-pi09', 'hjd-p03', 'https://static.wixstatic.com/media/67a4ef_d613e56904914dc5ada7700f991139ec~mv2.jpg', 3),
  -- Bloom Pendant
  ('hjd-pi10', 'hjd-p04', 'https://static.wixstatic.com/media/67a4ef_09c382a29a234c62af7e01dd6ee2cfd4~mv2.jpg', 1),
  ('hjd-pi11', 'hjd-p04', 'https://static.wixstatic.com/media/67a4ef_55b0829d87774f2395447d83d6754227~mv2.jpg', 2),
  ('hjd-pi12', 'hjd-p04', 'https://static.wixstatic.com/media/67a4ef_d3f11a36233e4e7dbd50e9f3db2d0a91~mv2.jpg', 3),
  -- Ring Chandelier
  ('hjd-pi13', 'hjd-p05', 'https://static.wixstatic.com/media/67a4ef_0766e8810f124207b10082023d41f7b4~mv2.jpg', 1),
  ('hjd-pi14', 'hjd-p05', 'https://static.wixstatic.com/media/67a4ef_472c6bba3def4fd4b3caf0c697e4fcc9~mv2.jpg', 2),
  ('hjd-pi15', 'hjd-p05', 'https://static.wixstatic.com/media/67a4ef_1189395b276b4116b6a44254f825b548~mv2.jpg', 3),
  -- Kasa Floor Lamp
  ('hjd-pi16', 'hjd-p06', 'https://static.wixstatic.com/media/67a4ef_dbeb746a0e0d4818860f7ca0e1b47cb2~mv2.jpg', 1),
  ('hjd-pi17', 'hjd-p06', 'https://static.wixstatic.com/media/67a4ef_7fc5854fbf76498a83ab13084e780a99~mv2.jpg', 2),
  ('hjd-pi18', 'hjd-p06', 'https://static.wixstatic.com/media/67a4ef_167d12ec297b422189e1e724d110b7be~mv2.jpg', 3),
  -- Totem Floor Lamp
  ('hjd-pi19', 'hjd-p07', 'https://static.wixstatic.com/media/67a4ef_090f6f2764474878a6a056f4ec953a2a~mv2.jpg', 1),
  ('hjd-pi20', 'hjd-p07', 'https://static.wixstatic.com/media/67a4ef_9364276208404db5a6fa7c58830d877c~mv2.jpg', 2),
  ('hjd-pi21', 'hjd-p07', 'https://static.wixstatic.com/media/67a4ef_2c9eb98b02d44f7b8d109f6553e86e15~mv2.jpg', 3),
  -- Cone Pendant
  ('hjd-pi22', 'hjd-p08', 'https://static.wixstatic.com/media/67a4ef_622a2257cb9241e393a78c056b30de06~mv2.jpg', 1),
  ('hjd-pi23', 'hjd-p08', 'https://static.wixstatic.com/media/67a4ef_41e8a57062df40208221bd896e73191b~mv2.jpg', 2),
  ('hjd-pi24', 'hjd-p08', 'https://static.wixstatic.com/media/67a4ef_3f5cbe912f28471faf54725451addc05~mv2.jpg', 3),
  -- Scallop Wall Light
  ('hjd-pi25', 'hjd-p09', 'https://static.wixstatic.com/media/67a4ef_057239fbfaea46f0812910630556d254~mv2.jpg', 1),
  ('hjd-pi26', 'hjd-p09', 'https://static.wixstatic.com/media/67a4ef_2a87304b873e4a7ebff2830efd0b2b73~mv2.jpg', 2),
  ('hjd-pi27', 'hjd-p09', 'https://static.wixstatic.com/media/67a4ef_bfb34b51d7ff470ab4fdb0f22b088ca5~mv2.jpg', 3),
  -- Rex Table Lamp
  ('hjd-pi28', 'hjd-p10', 'https://static.wixstatic.com/media/67a4ef_1a5518ebaee64a718b95572adabb2c4c~mv2.jpg', 1),
  ('hjd-pi29', 'hjd-p10', 'https://static.wixstatic.com/media/67a4ef_ae799dad748741e6a42b41d9764387bc~mv2.jpg', 2),
  ('hjd-pi30', 'hjd-p10', 'https://static.wixstatic.com/media/67a4ef_e6841f91a61c48c48e6d0cf1d3f4cdfe~mv2.jpg', 3),
  -- Iris Pendant
  ('hjd-pi31', 'hjd-p11', 'https://static.wixstatic.com/media/67a4ef_cd84fd3879ee4b438781937ed5b8d8d7~mv2.jpg', 1),
  ('hjd-pi32', 'hjd-p11', 'https://static.wixstatic.com/media/67a4ef_4e5babfdbacd4af29647f93faed472c8~mv2.jpg', 2),
  ('hjd-pi33', 'hjd-p11', 'https://static.wixstatic.com/media/67a4ef_4ee4f72d0a9f4afd983de8bf8b381478~mv2.jpg', 3),
  -- Branch Wall Light
  ('hjd-pi34', 'hjd-p12', 'https://static.wixstatic.com/media/67a4ef_dd87ca7ca5c34799ac4b0798f15bb149~mv2.jpg', 1),
  ('hjd-pi35', 'hjd-p12', 'https://static.wixstatic.com/media/67a4ef_116450f633a1425ca56d1469132e62f3~mv2.jpg', 2),
  ('hjd-pi36', 'hjd-p12', 'https://static.wixstatic.com/media/67a4ef_ccbe2d4fd03349b7bdee03fd7c6ab3ef~mv2.jpg', 3),
  -- Wilo Nude
  ('hjd-pi37', 'hjd-p13', 'https://static.wixstatic.com/media/67a4ef_f38a7995f1a54491ba9af44662cff605~mv2.jpg', 1),
  ('hjd-pi38', 'hjd-p13', 'https://static.wixstatic.com/media/67a4ef_ec1d4810fc814ed68062986acdee4c23~mv2.jpg', 2),
  ('hjd-pi39', 'hjd-p13', 'https://static.wixstatic.com/media/67a4ef_580eb28baf0f467cada6482bcb9108ca~mv2.jpg', 3),
  -- Legacy Totem
  ('hjd-pi40', 'hjd-p14', 'https://static.wixstatic.com/media/67a4ef_32a6d73160f94665aeec5fa37c1be4c3~mv2.jpg', 1),
  ('hjd-pi41', 'hjd-p14', 'https://static.wixstatic.com/media/67a4ef_b3d47c130492463ab3aa6937e01a3c30~mv2.jpg', 2),
  ('hjd-pi42', 'hjd-p14', 'https://static.wixstatic.com/media/67a4ef_bab3a28cf2f44f1fba0888e80fd133fb~mv2.jpg', 3),
  -- Orbis Casted
  ('hjd-pi43', 'hjd-p15', 'https://static.wixstatic.com/media/67a4ef_a536db8364a149fb882c43f166803026~mv2.jpg', 1),
  ('hjd-pi44', 'hjd-p15', 'https://static.wixstatic.com/media/67a4ef_69c94b3895f548b3982cf5611e42d9fd~mv2.jpg', 2),
  ('hjd-pi45', 'hjd-p15', 'https://static.wixstatic.com/media/67a4ef_178725fb99454e559cf343f504de88f7~mv2.jpg', 3)
ON CONFLICT (id) DO NOTHING;

-- ── 4. PROJECTS (5) ───────────────────────────────────────────
INSERT INTO public.projects (id, brand_id, name, description, year, display_order) VALUES
  ('hjd-proj01', 'hjd-b01-2024',
   'EDIDA 2021 — Lighting Category Winner',
   'Won the ELLE DECO International Design Awards (EDIDA) in the Lighting category at the 20th Edition — one of the most prestigious global design awards. This recognition cemented HJD as one of India''s most awarded independent lighting studios.',
   2021, 1),

  ('hjd-proj02', 'hjd-b01-2024',
   'House of Curiosities — MuseLAB, Kolhapur',
   'A bespoke lighting installation for MuseLAB''s "House of Curiosities" residential project in Kolhapur. Sculptural floor lamps and custom ceiling fixtures transformed the interiors into a gallery-like space that blurs the line between inhabiting and exhibiting.',
   2024, 2),

  ('hjd-proj03', 'hjd-b01-2024',
   'Not Your Ordinary — HJD × Length Breadth Height',
   'A collaborative collection with Mumbai-based interior studio Length Breadth Height, exploring natural materials and handmade objects that challenge the everyday. Both studios broke free from their individual identities to create a series of objects that makes you question the ordinary. Launched with editorial coverage in Elle Décor India.',
   2023, 3),

  ('hjd-proj04', 'hjd-b01-2024',
   'Kaji Kids Lighting Collection',
   'A children''s lighting line developed in collaboration with Kolkata-based House of Kaji. Featuring pastel hues and dino-scale hand-thrown stoneware textures, the collection brings whimsy and warmth to children''s bedrooms and nurseries.',
   2023, 4),

  ('hjd-proj05', 'hjd-b01-2024',
   'Living ETC India — Cover Feature',
   'Selected for the cover of Living ETC India, making HJD one of a handful of independent Indian design studios to receive a cover story in a major interiors publication. The feature spotlighted the studio''s approach to capitalising on handcraft as a competitive edge in the lighting market.',
   2023, 5)
ON CONFLICT (id) DO NOTHING;

-- Project images (using existing product images that match each story)
INSERT INTO public.project_images (id, project_id, url, display_order) VALUES
  ('hjd-projimg01', 'hjd-proj01', 'https://static.wixstatic.com/media/67a4ef_0766e8810f124207b10082023d41f7b4~mv2.jpg', 1),
  ('hjd-projimg02', 'hjd-proj01', 'https://static.wixstatic.com/media/67a4ef_090f6f2764474878a6a056f4ec953a2a~mv2.jpg', 2),
  ('hjd-projimg03', 'hjd-proj02', 'https://static.wixstatic.com/media/67a4ef_1219ac2b81634ab4af00330ea192d085~mv2.jpg', 1),
  ('hjd-projimg04', 'hjd-proj02', 'https://static.wixstatic.com/media/67a4ef_32a6d73160f94665aeec5fa37c1be4c3~mv2.jpg', 2),
  ('hjd-projimg05', 'hjd-proj03', 'https://static.wixstatic.com/media/67a4ef_f38a7995f1a54491ba9af44662cff605~mv2.jpg', 1),
  ('hjd-projimg06', 'hjd-proj03', 'https://static.wixstatic.com/media/67a4ef_a536db8364a149fb882c43f166803026~mv2.jpg', 2),
  ('hjd-projimg07', 'hjd-proj04', 'https://static.wixstatic.com/media/67a4ef_1a5518ebaee64a718b95572adabb2c4c~mv2.jpg', 1),
  ('hjd-projimg08', 'hjd-proj04', 'https://static.wixstatic.com/media/67a4ef_ae799dad748741e6a42b41d9764387bc~mv2.jpg', 2),
  ('hjd-projimg09', 'hjd-proj05', 'https://static.wixstatic.com/media/67a4ef_09c382a29a234c62af7e01dd6ee2cfd4~mv2.jpg', 1),
  ('hjd-projimg10', 'hjd-proj05', 'https://static.wixstatic.com/media/67a4ef_d7ab1e46db81475d8261a1d9dd65c424~mv2.jpg', 2)
ON CONFLICT (id) DO NOTHING;

-- ── 5. PAST SHOWS (5) ─────────────────────────────────────────
INSERT INTO public.brand_past_exhibitions (
  id, brand_id, name, city, venue, description, start_date, end_date
) VALUES
  ('hjd-show01', 'hjd-b01-2024',
   'AD Design Show',
   'Mumbai',
   'NSCI Dome, Worli',
   'India''s premier design show curated by Architectural Digest India. HJD showcased the complete Rio collection in natural stone and debuted the new Totem series, drawing significant trade and editorial attention.',
   '2023-10-19', '2023-10-22'),

  ('hjd-show02', 'hjd-b01-2024',
   'Index Furniture & Interiors',
   'Mumbai',
   'Bombay Exhibition Centre, Goregaon',
   'Asia''s largest furniture and interiors trade exhibition. The brand exhibited the Kasa and Wilo collections alongside the Asteroid floor lamp, engaging architects and interior designers from across India.',
   '2022-11-24', '2022-11-27'),

  ('hjd-show03', 'hjd-b01-2024',
   'India Design ID',
   'New Delhi',
   'Epicentre, Gurugram',
   'A curated design fair showcasing the best of Indian design practice. HJD debuted the Bloom Pendant and Ring Chandelier, both of which received editorial coverage in multiple shelter magazines following the show.',
   '2022-02-04', '2022-02-06'),

  ('hjd-show04', 'hjd-b01-2024',
   'Maison Mumbai',
   'Mumbai',
   'The St. Regis Mumbai',
   'An exclusive showcase of luxury interiors and design products in a hotel setting. Featured the Legacy Totem and the new alabaster stone collection — the first time the full stone range was exhibited publicly.',
   '2024-01-18', '2024-01-21'),

  ('hjd-show05', 'hjd-b01-2024',
   'Elle Décor Design Village',
   'Mumbai',
   'Mehboob Studios, Bandra',
   'Elle Décor India''s annual design village bringing together the finest Indian interior and product designers. HJD showcased the full Orbis and Branch collections alongside the collaborative HJD × LBH pieces.',
   '2023-09-14', '2023-09-17')
ON CONFLICT (id) DO NOTHING;

-- ── DONE ──────────────────────────────────────────────────────
-- Brand ID:  hjd-b01-2024
-- QR value:  booth:hjd-b01-2024
-- QR page:   /brand/qr (logged in as brand admin)
-- Mobile:    Add to DEMO_BRANDS in mobile/lib/supabase.ts (see below)
--
-- DEMO_BRANDS entry for supabase.ts:
-- 'hjd-b01-2024': {
--   id: 'hjd-b01-2024',
--   name: 'Harshita Jhamtani Designs',
--   category: 'Lighting & Furniture',
--   tagline: 'Handcrafted light for considered spaces',
--   booth_number: 'L12',
--   hall_number: 'Hall 3',
--   images: [
--     'https://static.wixstatic.com/media/67a4ef_56422cdaf100415fac61c15a5d349eb1~mv2.jpg',
--     'https://static.wixstatic.com/media/67a4ef_1219ac2b81634ab4af00330ea192d085~mv2.jpg',
--     'https://static.wixstatic.com/media/67a4ef_09c382a29a234c62af7e01dd6ee2cfd4~mv2.jpg',
--   ]
-- },
