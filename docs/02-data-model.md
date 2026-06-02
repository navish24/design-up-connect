# Designup Connect — Data Model

> **Purpose**: Complete database schema for all MVP features. This is the source of truth for the PostgreSQL database on Supabase. Engineers implement this exactly — no improvisation on table/column names without updating this document.

---

## Entity Relationship Overview

```
exhibitions
    └── exhibition_brands (brand ↔ exhibition, with booth info + QR)
            └── exhibition_brand_team (which brand members are active at this show)

users
    ├── brand_members (user belongs to a brand)
    ├── visitor_registrations (user registers for exhibition)
    ├── saved_brands (visitor saves a brand during/after show)
    ├── connections (user ↔ user relationship via QR scan)
    ├── wishlists (user saves product images)
    └── notifications

brands
    ├── brand_members
    ├── exhibition_brands
    ├── products
    │       └── product_images
    └── free_passes
            └── free_pass_tokens
```

---

## Table Definitions

### `users`
All individuals on the platform — visitors, brand representatives, and admins.

```sql
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designup_user_id    VARCHAR(50) UNIQUE NOT NULL,   -- e.g. @rohan_lumina
  first_name          VARCHAR(50) NOT NULL,
  last_name           VARCHAR(50) NOT NULL,
  email               VARCHAR(255) UNIQUE,
  phone               VARCHAR(20) UNIQUE NOT NULL,
  profession          VARCHAR(100),                  -- from curated list
  profession_other    VARCHAR(100),                  -- when 'Other' is selected
  company_name        VARCHAR(200),
  designation         VARCHAR(100),
  city                VARCHAR(100),
  country             VARCHAR(100),
  year_of_birth       SMALLINT,
  linkedin_url        VARCHAR(500),
  instagram_handle    VARCHAR(100),
  website_url         VARCHAR(500),
  profile_image_url   VARCHAR(500),
  profile_complete    BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

**Notes:**
- `designup_user_id` is the public-facing handle (shown everywhere in app). Email is private.
- `profession` stores the selected value from the curated list. `profession_other` stores the manual entry when 'Other' is chosen.
- `profile_complete` is set to `true` once LinkedIn/Instagram/Website are filled in.

---

### `brands`
A company or studio participating in exhibitions.

```sql
CREATE TABLE brands (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(200) NOT NULL,
  category              VARCHAR(100) NOT NULL,       -- Furniture, Lighting, etc.
  tagline               VARCHAR(300),
  story                 TEXT,
  email                 VARCHAR(255) UNIQUE NOT NULL, -- official brand email
  phone                 VARCHAR(20),
  website_url           VARCHAR(500),
  logo_url              VARCHAR(500),
  catalogue_url         VARCHAR(500),
  catalogue_is_private  BOOLEAN DEFAULT TRUE,
  created_by_user_id    UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

---

### `exhibitions`
An exhibition event (e.g., Index Mumbai 2025).

```sql
CREATE TYPE exhibition_status AS ENUM ('upcoming', 'active', 'past');

CREATE TABLE exhibitions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(200) NOT NULL,
  tagline          VARCHAR(300),
  about            TEXT,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  timings          VARCHAR(200),                -- e.g. "10:00 AM – 7:00 PM"
  venue_name       VARCHAR(200),
  venue_address    TEXT,
  city             VARCHAR(100),
  country          VARCHAR(100),
  layout_map_url   VARCHAR(500),                -- uploaded image of floor plan
  status           exhibition_status DEFAULT 'upcoming',
  is_paid          BOOLEAN DEFAULT FALSE,
  ticket_price     DECIMAL(10,2),
  organizer_email  VARCHAR(255),               -- organizer's login email
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**Notes:**
- `status` transitions: `upcoming` → `active` (on show start date, or manually) → `past` (on end date, via scheduled job).
- `layout_map_url` is a Cloudinary URL. The image is displayed in landscape view in the app.

---

### `exhibition_brands`
Links a brand to an exhibition with booth location and QR code.

```sql
CREATE TABLE exhibition_brands (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibition_id        UUID NOT NULL REFERENCES exhibitions(id),
  brand_id             UUID NOT NULL REFERENCES brands(id),
  booth_number         VARCHAR(50) NOT NULL,
  hall_number          VARCHAR(50) NOT NULL,
  qr_code_url          VARCHAR(500),            -- Cloudinary URL of QR image for printing
  qr_code_data         VARCHAR(500),            -- encoded string: booth:{exhibition_id}:{brand_id}
  onboarding_complete  BOOLEAN DEFAULT FALSE,
  invitation_sent_at   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exhibition_id, brand_id),
  UNIQUE(exhibition_id, booth_number, hall_number)
);
```

---

### `brand_members`
Links individual users to a brand (with role).

```sql
CREATE TYPE brand_member_role AS ENUM ('admin', 'member');

CREATE TABLE brand_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     UUID NOT NULL REFERENCES brands(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  role         brand_member_role DEFAULT 'member',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, user_id)
);
```

---

### `exhibition_brand_team`
Designates which brand members are the active team at a specific exhibition. Only active members' scans are attributed to the brand dashboard.

```sql
CREATE TABLE exhibition_brand_team (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibition_id  UUID NOT NULL REFERENCES exhibitions(id),
  brand_id       UUID NOT NULL REFERENCES brands(id),
  user_id        UUID NOT NULL REFERENCES users(id),
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exhibition_id, brand_id, user_id)
);
```

---

### `visitor_registrations`
Records a visitor's registration for a specific exhibition.

```sql
CREATE TYPE registration_type AS ENUM ('free', 'paid', 'free_pass');
CREATE TYPE registration_status AS ENUM ('registered', 'checked_in');

CREATE TABLE visitor_registrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  exhibition_id       UUID NOT NULL REFERENCES exhibitions(id),
  visitor_category    VARCHAR(100),              -- Interior Designer, Architect, etc.
  entry_qr_url        VARCHAR(500),              -- QR image for app display
  entry_qr_data       VARCHAR(500),              -- encoded: entry:{registration_id}
  registration_type   registration_type DEFAULT 'free',
  free_pass_token_id  UUID REFERENCES free_pass_tokens(id),
  checked_in_at       TIMESTAMPTZ,
  status              registration_status DEFAULT 'registered',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exhibition_id)
);
```

---

### `saved_brands`
The core MVP table. Records when a visitor scans and saves a brand.

```sql
CREATE TABLE saved_brands (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_user_id   UUID NOT NULL REFERENCES users(id),
  brand_id          UUID NOT NULL REFERENCES brands(id),
  exhibition_id     UUID NOT NULL REFERENCES exhibitions(id),
  notes             TEXT,                        -- private user notes on this brand
  saved_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(visitor_user_id, brand_id, exhibition_id)  -- prevents duplicate saves
);
```

**Notes:**
- The `UNIQUE` constraint on (visitor_user_id, brand_id, exhibition_id) is the duplicate prevention mechanism. The API returns a `already_saved` flag when this constraint triggers — the app shows "Already saved" instead of an error.

---

### `connections`
A relationship created when one user scans another's QR code.

```sql
CREATE TYPE connection_scope AS ENUM ('brand', 'personal');
CREATE TYPE connection_type AS ENUM (
  'booth_scan',           -- visitor scanned booth QR
  'visitor_scanned_rep',  -- visitor scanned a brand rep's personal QR
  'rep_scanned_visitor',  -- brand rep scanned visitor's personal QR
  'networking'            -- user scanned another user's personal QR
);

CREATE TABLE connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id          UUID NOT NULL REFERENCES users(id),
  to_user_id            UUID NOT NULL REFERENCES users(id),
  brand_id              UUID REFERENCES brands(id),        -- null for personal networking
  exhibition_id         UUID REFERENCES exhibitions(id),   -- context of connection
  scope                 connection_scope NOT NULL,
  connection_type       connection_type NOT NULL,
  is_mutual             BOOLEAN DEFAULT FALSE,
  from_contact_shared   BOOLEAN DEFAULT FALSE,             -- from_user shared their contact
  to_contact_shared     BOOLEAN DEFAULT FALSE,             -- to_user shared their contact
  notes                 TEXT,                              -- private notes (from_user only)
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

**Contact sharing logic:**
| connection_type | from_contact_shared | to_contact_shared | is_mutual |
|---|---|---|---|
| booth_scan | false | false | false |
| visitor_scanned_rep | false | true | false |
| rep_scanned_visitor | false | true | false |
| networking | false | true | false (until reverse scan or 'Exchange Contact') |

When "Exchange Contact" is tapped: `from_contact_shared = true` and `is_mutual = true`.

---

### `products`
A product belonging to a brand.

```sql
CREATE TABLE products (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id             UUID NOT NULL REFERENCES brands(id),
  name                 VARCHAR(200) NOT NULL,
  description          TEXT,
  material             TEXT,
  dimensions           VARCHAR(200),
  customisable_options TEXT,
  color_details        VARCHAR(200),
  category             VARCHAR(100),              -- Furniture, Lighting, Wall Finishes, etc.
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
```

---

### `product_images`
Images for a product. One product can have multiple images.

```sql
CREATE TABLE product_images (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id),
  image_url      VARCHAR(500) NOT NULL,            -- Cloudinary URL
  display_order  SMALLINT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

---

### `wishlists`
A user's saved product images for post-show reference.

```sql
CREATE TABLE wishlists (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  product_id        UUID NOT NULL REFERENCES products(id),
  product_image_id  UUID NOT NULL REFERENCES product_images(id),
  brand_id          UUID NOT NULL REFERENCES brands(id),  -- denormalized for quick lookup
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_image_id)
);
```

---

### `free_passes`
Allocation of complimentary visitor passes to a brand for a specific exhibition.

```sql
CREATE TABLE free_passes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibition_id    UUID NOT NULL REFERENCES exhibitions(id),
  brand_id         UUID NOT NULL REFERENCES brands(id),
  allocated_count  SMALLINT DEFAULT 0,
  used_count       SMALLINT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exhibition_id, brand_id)
);
```

---

### `free_pass_tokens`
Individual pass tokens sent to specific recipients by a brand.

```sql
CREATE TABLE free_pass_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  free_pass_id      UUID NOT NULL REFERENCES free_passes(id),
  recipient_email   VARCHAR(255),
  recipient_phone   VARCHAR(20),
  token             VARCHAR(100) UNIQUE NOT NULL,  -- random UUID used in invite URL
  used_by_user_id   UUID REFERENCES users(id),
  used_at           TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

---

### `notifications`
In-app notifications for users.

```sql
CREATE TYPE notification_type AS ENUM (
  'contact_received',         -- someone received your contact
  'exhibition_registered',    -- registration confirmed
  'exhibition_reminder',      -- 5/3/1 day before event
  'platform_update',          -- new exhibition live, post-show revisit prompt
  'catalogue_reminder'        -- brand sends post-show catalogue reminder
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  type        notification_type NOT NULL,
  title       VARCHAR(200),
  body        TEXT,
  data        JSONB,           -- flexible: { exhibition_id, brand_id, connection_id, etc. }
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Key Indexes

```sql
-- Frequently queried lookups
CREATE INDEX idx_saved_brands_visitor    ON saved_brands(visitor_user_id);
CREATE INDEX idx_saved_brands_exhibition ON saved_brands(exhibition_id);
CREATE INDEX idx_connections_from_user   ON connections(from_user_id);
CREATE INDEX idx_connections_to_user     ON connections(to_user_id);
CREATE INDEX idx_notifications_user      ON notifications(user_id, is_read);
CREATE INDEX idx_visitor_reg_user        ON visitor_registrations(user_id);
CREATE INDEX idx_exhibition_brands_exh   ON exhibition_brands(exhibition_id);
CREATE INDEX idx_product_images_product  ON product_images(product_id);
```

---

## Row Level Security (Supabase RLS) — Key Rules

| Table | Rule |
|---|---|
| `users` | Users can read their own row. Public fields (name, designup_user_id, profession) visible to all authenticated users. |
| `saved_brands` | Users can only read/write their own saved brands. |
| `connections` | Users can read connections where they are from_user or to_user. |
| `wishlists` | Users can only read/write their own wishlist. |
| `notifications` | Users can only read their own notifications. |
| `brands` | All authenticated users can read brands. Only brand admins can update. |
| `exhibitions` | All authenticated users can read. Only admins can create/update. |
| `exhibition_brands` | Admins and organizers can write. All authenticated users can read. |

---

## Supabase Edge Functions Required

| Function | Trigger | What it does |
|---|---|---|
| `generate-booth-qr` | Called after exhibition_brand onboarding is complete | Generates QR image, uploads to Cloudinary, writes back URL to exhibition_brands |
| `send-brand-invitation` | Called after brand is added to exhibition_brands | Sends SendGrid email with onboarding link |
| `send-exhibition-reminders` | Scheduled CRON (daily) | Checks exhibitions 5/3/1 days away, sends notification + email |
| `transition-exhibition-status` | Scheduled CRON (daily) | Sets exhibitions to 'active' on start_date, 'past' on end_date |
| `send-free-pass` | Called when brand submits a pass | Generates token, sends WhatsApp + email invite to recipient |
| `send-catalogue-reminder` | Called by brand post-show | Sends one-time notification to visitors who scanned their booth QR |
