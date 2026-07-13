-- ============================================================
-- Arisaa — Demo Brand Seed
-- Run in: Supabase Dashboard → SQL Editor
-- Brand ID: arisaa-b01-2024
-- QR encodes as: booth:arisaa-b01-2024
-- ============================================================

-- ── 1. BRAND ─────────────────────────────────────────────────
INSERT INTO public.brands (
  id, name, tagline, about, design_philosophy, category,
  cover_image_url, website, city, contact_name, contact_email, contact_phone,
  qr_token, gst_status, onboarding_step
) VALUES (
  'arisaa-b01-2024',
  'Arisaa',
  'Fine handmade objects shaped by master artisans',
  'Arisaa is an Ahmedabad-based design studio founded in 2021 by Aashka Shah — graphic designer turned maker — whose background informs a practice that is as visually rigorous as it is tactile. The studio produces sculptural installations, wall art, mirrors, furniture, and handwoven rugs, each piece shaped by sustained material exploration rather than predetermined form. Shah approaches every object as a study in texture, weight, and presence — the kind of object that reveals itself slowly, through living with it. Arisaa made its international debut at Salone Satellite, Milan in 2023 and has been featured in Vogue India, Condé Nast Traveler, Harper''s Bazaar, Living Etc., and COVER Magazine.',
  'Materials are explored patiently. Processes are refined through repetition. Rather than imposing preconceived ideas, forms emerge from what the material allows — its resistance, its grain, its capacity for surface. Craftsmanship is structural foundation, never decorative layer. The result is work that is considered, tactile, and intentional. Never hurried, never excessive.',
  'Art & Décor',
  'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0309f91d-d641-4a6d-971b-0e875afae13e/ARSD00465+a.jpg',
  'https://www.arisaa.com',
  'Ahmedabad',
  'Aashka Shah',
  'getintouch@arisaa.com',
  '+91 6351 605 730',
  'arisaa-b01-2024',
  'approved',
  'complete'
) ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  tagline           = EXCLUDED.tagline,
  about             = EXCLUDED.about,
  design_philosophy = EXCLUDED.design_philosophy,
  category          = EXCLUDED.category,
  cover_image_url   = EXCLUDED.cover_image_url,
  website           = EXCLUDED.website,
  city              = EXCLUDED.city,
  contact_name      = EXCLUDED.contact_name,
  contact_email     = EXCLUDED.contact_email,
  contact_phone     = EXCLUDED.contact_phone,
  qr_token          = EXCLUDED.qr_token,
  gst_status        = EXCLUDED.gst_status,
  onboarding_step   = EXCLUDED.onboarding_step;

-- ── 2. COLLECTIONS ────────────────────────────────────────────
INSERT INTO public.collections (id, brand_id, name, description, display_order) VALUES
  ('arisaa-c01', 'arisaa-b01-2024', 'Of the Earth',
   'Wall pieces and reliefs in natural pigment, clay, and raw mineral — each surface a record of material time. Made to be read slowly: the closer you look, the more texture reveals itself.',
   1),
  ('arisaa-c02', 'arisaa-b01-2024', 'Reflections',
   'Mirrors shaped by hand rather than machine — each frame a study in material honesty. Gilded brass, raw linen, organic edge. Every surface is an invitation to look twice.',
   2),
  ('arisaa-c03', 'arisaa-b01-2024', 'Woven Grounds',
   'Floor pieces woven in natural wool, cotton, and jute — geometry and touch in conversation. Designed to age beautifully underfoot, each rug is a landscape you live on.',
   3)
ON CONFLICT (id) DO NOTHING;

-- Collection images (3–4 per collection)
INSERT INTO public.collection_images (id, collection_id, url, display_order) VALUES
  -- Of the Earth (wall art)
  ('arisaa-ci01', 'arisaa-c01', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0300321c-5336-41ec-be26-4c0082d245ca/Of+the+Earth+%281%29.png', 1),
  ('arisaa-ci02', 'arisaa-c01', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg', 2),
  ('arisaa-ci03', 'arisaa-c01', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/6097b573-1fc9-4770-8965-2edcde445095/_R8A3250edited-new.jpg', 3),
  ('arisaa-ci04', 'arisaa-c01', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eb0013af-bbeb-40ec-8b21-77833b7e9bef/ARSD00415.jpg', 4),
  -- Reflections (mirrors)
  ('arisaa-ci05', 'arisaa-c02', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/f85e0e44-1696-4063-baaa-a8c0bcaf3049/Gilded+current4a.jpg', 1),
  ('arisaa-ci06', 'arisaa-c02', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0bd027f7-ee1f-46bf-9291-2fd7739d8061/web+rs.jpg', 2),
  ('arisaa-ci07', 'arisaa-c02', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/6097b573-1fc9-4770-8965-2edcde445095/_R8A3250edited-new.jpg', 3),
  -- Woven Grounds (rugs)
  ('arisaa-ci08', 'arisaa-c03', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/50193dd1-52f1-4501-abe2-df9323063be4/Drava-web-3.png', 1),
  ('arisaa-ci09', 'arisaa-c03', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/a7d37874-2573-494d-9eb9-a45b71997213/ARSD00404.jpg', 2),
  ('arisaa-ci10', 'arisaa-c03', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eb0013af-bbeb-40ec-8b21-77833b7e9bef/ARSD00415.jpg', 3)
ON CONFLICT (id) DO NOTHING;

-- ── 3. PRODUCTS (15) ──────────────────────────────────────────
INSERT INTO public.products (id, brand_id, name, description, material, dimensions, colour, customisation_details, lead_time, installation, display_order) VALUES

  -- Wall Art (5)
  ('arisaa-p01', 'arisaa-b01-2024', 'Of the Earth',
   'A layered wall piece working with raw mineral pigments pressed into wet clay — the surface records the gesture of its making, each mark left by the pressure of hands and tools. No two are identical; the earth decides the final form.',
   'Natural mineral pigments, clay, jute on board', '60 × 45 cm', 'Ochre / Sand / Umber',
   'Get in touch with brand', null, null, 1),

  ('arisaa-p02', 'arisaa-b01-2024', 'Terrain Study',
   'A textural wall panel inspired by geological cross-sections — layers of gesso, pigment, and sand built up and carved back to reveal strata beneath. The surface has the quality of sedimentary rock, worn and ancient.',
   'Gesso, mineral pigment, raw sand, mixed media on board', '80 × 60 cm', 'Stone / Dusk',
   'Get in touch with brand', null, null, 2),

  ('arisaa-p03', 'arisaa-b01-2024', 'Sediment Series No. 1',
   'The first in an ongoing series exploring how time leaves its mark on surface. Raw pigment is suspended in resin and allowed to settle at its own pace — the artist''s role becomes one of observation rather than control.',
   'Raw pigment, resin, mixed media', '45 × 60 cm', 'Rust / Terracotta / Bone',
   'Get in touch with brand', null, null, 3),

  ('arisaa-p04', 'arisaa-b01-2024', 'Ochre Relief',
   'A sculptural wall piece built from layers of hand-applied clay over a wooden armature, finished in mineral pigments sourced from Rajasthani ochre deposits. Its surface changes quality with the light — matte at noon, alive at dusk.',
   'Hand-applied clay, Rajasthani mineral pigments, wood armature', '90 × 70 cm', 'Burnt Ochre / Natural',
   'Get in touch with brand', null, null, 4),

  ('arisaa-p05', 'arisaa-b01-2024', 'Fragment Wall Piece',
   'Assembled from fragments of repurposed stone and fired clay, this wall piece explores the formal qualities of broken things — how edges made by accident carry more honesty than edges that were planned.',
   'Repurposed stone fragments, fired clay, natural pigment', '50 × 50 cm', 'Stone / Charcoal / Bone',
   'Get in touch with brand', null, null, 5),

  -- Sculptural Installations (3)
  ('arisaa-p06', 'arisaa-b01-2024', 'Negi Sculpture',
   'A freestanding floor sculpture in hand-carved natural stone — the form references the contours of a Negi, a traditional staff carving found in Himachali craft, abstracted into something more elemental. Carved slowly over several weeks.',
   'Hand-carved natural stone', '40 × 18 × 12 cm', 'Natural Stone',
   'Get in touch with brand', null, null, 6),

  ('arisaa-p07', 'arisaa-b01-2024', 'Mesa Form',
   'A sculptural table object in hand-burnished terracotta — the flat plateau at its crown referencing the mesas of arid landscapes. Made through a combination of wheel-throwing and hand-building, fired in a wood kiln.',
   'Hand-burnished terracotta, wood-fired', '35 × 20 × 20 cm', 'Terra / Natural',
   'Get in touch with brand', null, null, 7),

  ('arisaa-p08', 'arisaa-b01-2024', 'Vessel Study',
   'A series of slip-cast ceramic vessels exploring volume and restraint. The form is deliberately simple — it is the surface that carries the work, hand-burnished to a soft luminosity, finished with a natural ash glaze.',
   'Slip-cast ceramic, natural ash glaze', '28 × 12 × 12 cm', 'Ash White / Natural Clay',
   'Get in touch with brand', null, null, 8),

  -- Mirrors (3)
  ('arisaa-p09', 'arisaa-b01-2024', 'Gilded Current',
   'A hand-finished mirror frame in aged brass patina — the frame appears to flow at its edges, as if the gilding was caught mid-motion. Made to order; the patina deepens further over years of use.',
   'Handmade wooden frame, aged brass patina, mirror glass', '90 × 60 cm', 'Aged Brass / Gold',
   'Get in touch with brand', null, null, 9),

  ('arisaa-p10', 'arisaa-b01-2024', 'Ripple Mirror',
   'An organically shaped mirror with an irregular edge — no straight lines, no symmetry. The frame is hand-finished in raw plaster tinted with mineral pigment, giving it the quality of a fragment from an old wall.',
   'Organic-edge mirror glass, hand-finished plaster frame, mineral pigment', '75 × 55 cm', 'Stone / Plaster',
   'Get in touch with brand', null, null, 10),

  ('arisaa-p11', 'arisaa-b01-2024', 'Arch Study',
   'A tall arched mirror in a raw linen-wrapped frame — the proportions are classical but the finish is decidedly handmade, the linen slightly irregular, the arch not quite perfect. Its imprecision is its character.',
   'Mirror glass, hand-carved wood frame, raw linen', '120 × 45 cm', 'Natural Linen / Warm White',
   'Get in touch with brand', null, null, 11),

  -- Furniture (2)
  ('arisaa-p12', 'arisaa-b01-2024', 'Antelope Chair',
   'A solid-wood chair whose legs taper and splay like the limbs of the antelope it is named after — simultaneously delicate and structural. Hand-sculpted from a single block of sheesham wood, the seat is slightly concave for comfort.',
   'Solid sheesham wood, hand-sculpted, natural oil finish', '80 × 60 × 50 cm', 'Natural Sheesham',
   'Get in touch with brand', null, null, 12),

  ('arisaa-p13', 'arisaa-b01-2024', 'Studio Bench',
   'A long low bench in reclaimed timber, finished by hand with a rubbed wax that lets the grain breathe. Made for sitting but equally purposeful as a surface — for books, objects, the quiet accumulation of a day.',
   'Reclaimed timber, hand-finished, natural wax', '120 × 35 × 45 cm', 'Natural / Reclaimed',
   'Get in touch with brand', null, null, 13),

  -- Rugs (2)
  ('arisaa-p14', 'arisaa-b01-2024', 'Drava',
   'A hand-woven rug in natural wool and cotton — the weave follows a geometry loosely derived from river systems, the pattern emerging from the rhythm of the loom rather than a fixed plan. Made in collaboration with weavers in Rajasthan.',
   'Hand-woven natural wool and cotton, Rajasthan', '180 × 120 cm', 'Dusk / Bone / Charcoal',
   'Get in touch with brand', null, null, 14),

  ('arisaa-p15', 'arisaa-b01-2024', 'Mesa Weave',
   'A hand-tufted rug in natural jute with a low pile that gives it a surface quality closer to stone than textile. The geometric pattern references the flat-topped mesa formations of the Deccan plateau.',
   'Hand-tufted natural jute, low pile', '240 × 160 cm', 'Sand / Stone / Natural',
   'Get in touch with brand', null, null, 15)

ON CONFLICT (id) DO UPDATE SET
  customisation_details = EXCLUDED.customisation_details,
  lead_time             = EXCLUDED.lead_time,
  installation          = EXCLUDED.installation;

-- Product images (2–3 per product)
INSERT INTO public.product_images (id, product_id, url, display_order) VALUES
  -- Of the Earth
  ('arisaa-pi01', 'arisaa-p01', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0300321c-5336-41ec-be26-4c0082d245ca/Of+the+Earth+%281%29.png', 1),
  ('arisaa-pi02', 'arisaa-p01', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg', 2),
  ('arisaa-pi03', 'arisaa-p01', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/6097b573-1fc9-4770-8965-2edcde445095/_R8A3250edited-new.jpg', 3),
  -- Terrain Study
  ('arisaa-pi04', 'arisaa-p02', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0309f91d-d641-4a6d-971b-0e875afae13e/ARSD00465+a.jpg', 1),
  ('arisaa-pi05', 'arisaa-p02', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eb0013af-bbeb-40ec-8b21-77833b7e9bef/ARSD00415.jpg', 2),
  ('arisaa-pi06', 'arisaa-p02', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/7aad5460-9855-49de-a92a-a2afbb5fbbc4/ARSD00488.jpg', 3),
  -- Sediment Series No. 1
  ('arisaa-pi07', 'arisaa-p03', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg', 1),
  ('arisaa-pi08', 'arisaa-p03', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0300321c-5336-41ec-be26-4c0082d245ca/Of+the+Earth+%281%29.png', 2),
  ('arisaa-pi09', 'arisaa-p03', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eb0013af-bbeb-40ec-8b21-77833b7e9bef/ARSD00415.jpg', 3),
  -- Ochre Relief
  ('arisaa-pi10', 'arisaa-p04', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/7aad5460-9855-49de-a92a-a2afbb5fbbc4/ARSD00488.jpg', 1),
  ('arisaa-pi11', 'arisaa-p04', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0309f91d-d641-4a6d-971b-0e875afae13e/ARSD00465+a.jpg', 2),
  ('arisaa-pi12', 'arisaa-p04', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/6097b573-1fc9-4770-8965-2edcde445095/_R8A3250edited-new.jpg', 3),
  -- Fragment Wall Piece
  ('arisaa-pi13', 'arisaa-p05', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eb0013af-bbeb-40ec-8b21-77833b7e9bef/ARSD00415.jpg', 1),
  ('arisaa-pi14', 'arisaa-p05', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg', 2),
  ('arisaa-pi15', 'arisaa-p05', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0300321c-5336-41ec-be26-4c0082d245ca/Of+the+Earth+%281%29.png', 3),
  -- Negi Sculpture
  ('arisaa-pi16', 'arisaa-p06', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0f54cb7d-3661-4bc6-a44c-dc96ef5e1b6b/Negi+Sculpture+%281%29.JPG', 1),
  ('arisaa-pi17', 'arisaa-p06', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg', 2),
  ('arisaa-pi18', 'arisaa-p06', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/6097b573-1fc9-4770-8965-2edcde445095/_R8A3250edited-new.jpg', 3),
  -- Mesa Form
  ('arisaa-pi19', 'arisaa-p07', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0309f91d-d641-4a6d-971b-0e875afae13e/ARSD00465+a.jpg', 1),
  ('arisaa-pi20', 'arisaa-p07', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eb0013af-bbeb-40ec-8b21-77833b7e9bef/ARSD00415.jpg', 2),
  ('arisaa-pi21', 'arisaa-p07', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0f54cb7d-3661-4bc6-a44c-dc96ef5e1b6b/Negi+Sculpture+%281%29.JPG', 3),
  -- Vessel Study
  ('arisaa-pi22', 'arisaa-p08', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/7aad5460-9855-49de-a92a-a2afbb5fbbc4/ARSD00488.jpg', 1),
  ('arisaa-pi23', 'arisaa-p08', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0f54cb7d-3661-4bc6-a44c-dc96ef5e1b6b/Negi+Sculpture+%281%29.JPG', 2),
  ('arisaa-pi24', 'arisaa-p08', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg', 3),
  -- Gilded Current
  ('arisaa-pi25', 'arisaa-p09', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/f85e0e44-1696-4063-baaa-a8c0bcaf3049/Gilded+current4a.jpg', 1),
  ('arisaa-pi26', 'arisaa-p09', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0bd027f7-ee1f-46bf-9291-2fd7739d8061/web+rs.jpg', 2),
  ('arisaa-pi27', 'arisaa-p09', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/6097b573-1fc9-4770-8965-2edcde445095/_R8A3250edited-new.jpg', 3),
  -- Ripple Mirror
  ('arisaa-pi28', 'arisaa-p10', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0bd027f7-ee1f-46bf-9291-2fd7739d8061/web+rs.jpg', 1),
  ('arisaa-pi29', 'arisaa-p10', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/f85e0e44-1696-4063-baaa-a8c0bcaf3049/Gilded+current4a.jpg', 2),
  ('arisaa-pi30', 'arisaa-p10', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/6097b573-1fc9-4770-8965-2edcde445095/_R8A3250edited-new.jpg', 3),
  -- Arch Study
  ('arisaa-pi31', 'arisaa-p11', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/f85e0e44-1696-4063-baaa-a8c0bcaf3049/Gilded+current4a.jpg', 1),
  ('arisaa-pi32', 'arisaa-p11', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0bd027f7-ee1f-46bf-9291-2fd7739d8061/web+rs.jpg', 2),
  -- Antelope Chair
  ('arisaa-pi33', 'arisaa-p12', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/46106f34-d750-4d09-bb66-4216b194acdd/Antelope+Chair1.jpg', 1),
  ('arisaa-pi34', 'arisaa-p12', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg', 2),
  ('arisaa-pi35', 'arisaa-p12', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/6097b573-1fc9-4770-8965-2edcde445095/_R8A3250edited-new.jpg', 3),
  -- Studio Bench
  ('arisaa-pi36', 'arisaa-p13', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0309f91d-d641-4a6d-971b-0e875afae13e/ARSD00465+a.jpg', 1),
  ('arisaa-pi37', 'arisaa-p13', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/46106f34-d750-4d09-bb66-4216b194acdd/Antelope+Chair1.jpg', 2),
  ('arisaa-pi38', 'arisaa-p13', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg', 3),
  -- Drava Rug
  ('arisaa-pi39', 'arisaa-p14', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/50193dd1-52f1-4501-abe2-df9323063be4/Drava-web-3.png', 1),
  ('arisaa-pi40', 'arisaa-p14', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/a7d37874-2573-494d-9eb9-a45b71997213/ARSD00404.jpg', 2),
  -- Mesa Weave
  ('arisaa-pi41', 'arisaa-p15', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/a7d37874-2573-494d-9eb9-a45b71997213/ARSD00404.jpg', 1),
  ('arisaa-pi42', 'arisaa-p15', 'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/50193dd1-52f1-4501-abe2-df9323063be4/Drava-web-3.png', 2)
ON CONFLICT (id) DO NOTHING;

-- ── 4. PROJECTS (5) ───────────────────────────────────────────
INSERT INTO public.projects (id, brand_id, name, description, year, display_order) VALUES
  ('arisaa-proj01', 'arisaa-b01-2024',
   'Salone Satellite, Milan 2023',
   'Arisaa''s international debut at Salone Satellite — the most visible platform for emerging design talent during Milan Design Week. The studio presented a body of work centred on material honesty and slow process, drawing the attention of international editors and gallerists. The show opened relationships with European design press and placed the studio firmly in a global conversation about contemporary craft.',
   2023, 1),

  ('arisaa-proj02', 'arisaa-b01-2024',
   'EDIDA India — Emerging Designer',
   'Recognition at the ELLE DECO International Design Awards (EDIDA) in the Emerging Designer category — one of the most prominent global design awards, judged by editors of ELLE Décor across 25 countries. The nomination affirmed Arisaa''s positioning at the intersection of craft and contemporary design practice.',
   2024, 2),

  ('arisaa-proj03', 'arisaa-b01-2024',
   'Private Residence — Bandra, Mumbai',
   'A commissioned installation for a private residence in Bandra — the client wanted handmade objects that could carry a space without overwhelming it. Arisaa developed a site-specific wall piece for the entry foyer and a series of sculptural objects for the living room, calibrated to the light conditions of each space at different times of day.',
   2024, 3),

  ('arisaa-proj04', 'arisaa-b01-2024',
   'Craft of Slowness — Group Exhibition',
   'A group exhibition at the Conflictorium, Ahmedabad, bringing together practitioners who privilege process and material time over efficiency. Arisaa showed three new works — two wall pieces and a floor sculpture — made specifically for the exhibition, exploring the relationship between geological time and handmade mark.',
   2023, 4),

  ('arisaa-proj05', 'arisaa-b01-2024',
   'Vogue India Editorial Feature',
   'A full editorial feature in Vogue India covering the studio''s approach to material and making — photographed in the Ahmedabad atelier with the full range of objects. The story framed Arisaa within a growing movement of Indian makers redefining craft for contemporary interiors, outside the traditional crafts economy.',
   2024, 5)
ON CONFLICT (id) DO NOTHING;

-- ── 5. PAST SHOWS (5) ─────────────────────────────────────────
INSERT INTO public.brand_past_exhibitions (
  id, brand_id, name, city, venue, description, start_date, end_date
) VALUES
  ('arisaa-show01', 'arisaa-b01-2024',
   'Salone Satellite',
   'Milan, Italy',
   'Fiera Milano, Rho',
   'Arisaa''s first international exhibition. The studio presented wall art, sculptural objects, and handwoven pieces to an audience of international design professionals, editors, and collectors. The debut drew significant editorial attention and positioned the studio within a global craft dialogue.',
   '2023-04-18', '2023-04-23'),

  ('arisaa-show02', 'arisaa-b01-2024',
   'India Design ID',
   'New Delhi',
   'Epicentre, Gurugram',
   'India''s foremost curated design fair. Arisaa presented the full Of the Earth wall art collection alongside new sculptural pieces, engaging with architects, interior designers, and collectors from across India. The show generated strong inquiry for commissioned residential work.',
   '2023-02-10', '2023-02-12'),

  ('arisaa-show03', 'arisaa-b01-2024',
   'AD Design Show',
   'Mumbai',
   'NSCI Dome, Worli',
   'Curated by Architectural Digest India. Arisaa debuted the Reflections mirror collection and the Antelope Chair, both of which received significant editorial interest. Condé Nast Traveler shot the booth for a subsequent India design feature.',
   '2023-10-19', '2023-10-22'),

  ('arisaa-show04', 'arisaa-b01-2024',
   'Index Furniture & Interiors',
   'Mumbai',
   'Bombay Exhibition Centre, Goregaon',
   'Asia''s largest furniture and interiors trade show. Arisaa presented the Woven Grounds rug collection alongside wall art and sculptural objects. The Drava rug drew particular attention for its approach to natural fibre and geometric restraint.',
   '2024-11-21', '2024-11-24'),

  ('arisaa-show05', 'arisaa-b01-2024',
   'Design Ahmedabad',
   'Ahmedabad',
   'AMA Auditorium, Ahmedabad',
   'A biennial showcase celebrating Ahmedabad as a UNESCO World Heritage City and a centre of design culture in India. Arisaa showed as a local studio with international reach, highlighting material sourcing from within Gujarat and Rajasthan.',
   '2022-11-08', '2022-11-12')
ON CONFLICT (id) DO NOTHING;

-- ── DONE ──────────────────────────────────────────────────────
-- Brand ID:  arisaa-b01-2024
-- QR value:  booth:arisaa-b01-2024
-- Booth:     A05 · Hall 1
-- Mobile:    Add to DEMO_BRANDS in mobile/lib/supabase.ts
-- App:       Add to BRAND_COLLECTIONS and BRAND_PAST_SHOWS in mobile/app/brand/[id].tsx
-- QR sheet:  Add cards to docs/demo-qr-sheet.html
