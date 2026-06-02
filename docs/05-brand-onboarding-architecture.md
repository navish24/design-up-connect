# Designup Connect — Brand & Organiser Dashboard Architecture

> **Purpose**: Technical architecture for the Brand Dashboard and Organiser Dashboard web application.
> This is a Next.js web application shared by brand admins, organisers, and gate staff.
> Source of truth: _Designup Brand & Organiser Dashboard PRD — MVP_ (read alongside this doc).

---

## Overview

The dashboard is a **single Next.js web application** shared by all non-visitor roles:
- Brand admins manage their profile, catalogue, leads, and representatives
- Organisers manage exhibitions, brands, passes, and analytics
- Gate staff scan visitor QR codes at the venue entrance

The web app shares the same Supabase backend as the mobile app. Content uploaded on the dashboard
surfaces on the mobile app instantly, and visitor interactions in the app appear on the dashboard instantly.

---

## Shared Platform Architecture

- **Single web application** — same URL and login page for all roles
- **Role-based routing** post-login: brand → `/brand/*`, organiser → `/organiser/*`, gate staff → `/gate/*`
- **Same Supabase project** as the mobile app — same DB, same Auth, same Storage
- **Design system and component library** shared across brand and organiser dashboards

---

## Login & Authentication

### Login method
- Email address (primary) or phone number — both via **OTP** (not magic link, not password)
- MSG91 for SMS OTP, SendGrid for email OTP

### Dual identity — same contact on personal and brand account
If the same contact is linked to a personal Designup visitor account and a brand account, a **role switcher** appears post-OTP:
- Continue as [Name] (Personal)
- Continue as [Brand Name] (Brand)

Both resolve to the same Supabase Auth user. No separate credentials. The role switcher is a UI step after OTP verification, before routing to the dashboard.

### Organiser login
- Email OTP only
- Organiser accounts are **created by Designup admin** via internal script — no self-serve signup

### Gate staff login
- Restricted login link shared by organiser admin
- Resolves to gate interface only — no access to full dashboard

---

## Brand Dashboard

### How brands access
- **New brands**: invitation link sent by organiser → triggers onboarding flow
- **Existing brands**: organiser searches and links them → brand confirms in dashboard → no re-onboarding

---

## Brand Onboarding

### Onboarding rule
Sequential flow. All 5 mandatory steps must be completed and **GST verification approved by Designup** before the permanent brand QR is generated. Optional sections can be completed at any time after onboarding and only surface on the app when content is uploaded.

### Returning brands
Brands already verified on Designup from a previous exhibition **skip Step 5 entirely**. Their existing GST verification, brand profile, catalogue, and QR carry over. No re-upload, no re-review.

---

### MANDATORY — Gates QR generation

#### Step 1 — Brand Identity
- Brand name
- About the brand
- Design philosophy
- Category
- Brand tagline
- Brand cover image

Populates the **About tab** on the brand detail page in the app.

#### Step 2 — Contact & Location
- Contact name
- Email address
- Phone number
- Website
- City and service location

Used for QR generation and surfaces on the brand About tab.

#### Step 3 — Catalogue (Minimum 5 Products)
- Brand must upload a minimum of **5 products** before QR is generated
- All product fields must be completed for each product to count toward the minimum — partially filled products do not qualify
- Per-product fields: product name, minimum one image, material, dimensions, colour, customisation details
- Additional products can be added at any time post-onboarding

**UI pattern**: Grid of product cards with "Add Product" button. Progress indicator: "5 products required — 3 added".

**Image upload**: Direct to Cloudinary via signed URL (client → get signed URL from Edge Function → upload directly to Cloudinary → send URL to Supabase). Files never proxy through Supabase.

#### Step 4 — Representatives (Optional at onboarding)
- Brand admin can add representatives from approved linked users (via the "People at Brand" feature on Designup)
- Only users who have linked their profile to this brand **and** received brand approval appear as available to add
- This step is optional — a brand can complete onboarding without adding any representatives (e.g. solo brand owner). The step is shown so brands are aware of the option
- Representatives can be added or removed at any time post-onboarding

#### Step 5 — GST Verification
- Brand uploads their GST certificate — final mandatory step
- On submission, dashboard shows: _"Verification typically takes 1–2 business days. You will be notified once approved."_
- **Brand QR is not generated until Designup approves the GST document internally**
- Dashboard states post-submission:
  - **Verification Pending** → awaiting Designup review
  - **Approved** → QR generates automatically
  - **Rejected** → brand notified with reason, prompted to resubmit

---

### OPTIONAL — Available anytime, shown on app only when content is uploaded

| Section | What to upload | App tab |
|---|---|---|
| Collections | Curated product groupings with name, description, and images. Brand-controlled editorial content. | Collections tab |
| Past Exhibitions | Exhibition history — name, dates, city, booth images. Added manually. | Past Exhibitions tab |
| Projects | Installation imagery and completed project references with optional descriptions. | Projects tab |

If all entries in an optional section are deleted, that tab disappears from the app automatically.

---

## QR Code

- **One permanent QR per brand** — never changes across exhibitions or locations
- Auto-generates immediately upon Designup's approval of the GST verification document
- QR is always available in the dashboard for download and print (booth, showroom, business card, catalogue)
- Brand sees a contextual demo of how the QR will be used during onboarding — no separate training required

---

## Brand Profile Editing — Post-Onboarding

- All sections are editable at any time from the dashboard
- Changes sync to the app instantly — dashboard is the single source of truth
- **Mandatory fields** (brand name, category, tagline, cover image, contact details) cannot be left blank. Inline error prevents submission if admin attempts to remove one

### Catalogue management
- Add, edit, or delete individual products at any time
- Reorder products via drag and drop — order on dashboard mirrors order on app (`@dnd-kit/sortable`)
- Minimum 5 products with all fields completed must remain at all times. System prevents deletion if it would drop below 5, with inline explanation

### Optional sections
- Collections — create, edit, or delete collections and assign products to them
- Past Exhibitions — add, edit, or delete exhibition history entries
- Projects — add, edit, or delete project entries with images and descriptions

### Preview before saving
A **Preview button** on the catalogue and profile editor opens a read-only simulation of the brand detail page as it appears on the app:
- **Brand Catalogue view**: product grid with names, primary images, and category
- **Product Detail view**: tapping any product shows full product detail — all images, material, dimensions, colour, customisation details

Admin navigates between views naturally. A persistent **"Back to Edit"** button exits preview without saving. **"Save Changes"** saves and exits.

---

## Brand Dashboard Home Screen

First screen after login. Organised around exhibitions with brand management as a persistent layer.

### Active Exhibition block
Shown only when an exhibition is currently live. Top of home screen. Shows: exhibition name, today's live visitor entry count, today's total saves, and a "View Dashboard" CTA.

### Upcoming Exhibitions
- Cards for all exhibitions the brand is registered for
- Each card: exhibition name, date, city, onboarding completion status if steps pending
- "Complete Setup" CTA on cards with pending steps — links directly to the incomplete step

### Pending Actions
Task list surfacing items needing admin attention:
- "2 People at Brand requests waiting" → approval queue
- "Catalogue incomplete — minimum 5 products required" → catalogue upload step
- "[Exhibition] starts in 5 days — no representatives added yet" → rep management for that exhibition

### Past Exhibitions
Condensed list, most recent first. Each entry: exhibition name, dates, "View Report" link.

### Brand Profile
Preview card showing brand name, category, tagline, cover image with "Edit Profile" CTA. Always accessible from home regardless of exhibition context.

---

## Multi-Exhibition Navigation

Two-level navigation for brands registered across multiple exhibitions:

1. Brand admin lands on **Brand Dashboard Home** — overview of all exhibitions (Active, Upcoming, Past)
2. Tapping any exhibition card enters that exhibition's full dashboard context (visitor list, lead data, qualification responses, rep management)
3. Inside an exhibition: top navigation shows exhibition name with a back arrow to return home. No dropdown switcher.
4. **Brand-level features** (profile, QR code, People at Brand approvals, profile editing) are accessible from the **persistent sidebar** at all times — these are brand-level, not exhibition-level

---

## Exhibition Registration & States

### Registration
- Brand registers for an exhibition after completing onboarding
- One brand can be registered across multiple exhibitions

### Exhibition states — dashboard side
- **Date-based activation**: dashboard auto-activates on exhibition start date, auto-ends on end date
- This is **dashboard-side only** and does not affect visitor-side session activation (which is gate-controlled)
- On activation: linked brand representative accounts attach to the exhibition automatically
- On end: rep accounts detach from the exhibition automatically
- Brand accessing dashboard before exhibition is active: onboarding and profile editing available, visitor list shows "Exhibition not started" state

---

## Representative Management

- Reps added from **approved linked users only**. A user must have linked their brand via the "Link your brand" feature on their Designup profile and received brand approval
- Brand admin selects which approved linked users to assign to a specific exhibition — not all linked users need to be in every exhibition
- Once assigned, the exhibition appears on the rep's home screen in the app
- **Rep permissions**: access to visitor list only. Cannot edit brand profile or product catalogue
- Rep added but not yet registered on Designup: shown as **Pending**. Activates automatically when they register
- Representatives can be added or removed from exhibitions at any time

---

## Exhibition Mode

### Principle
When **Exhibition Mode is ON** → everything goes to brand dashboard only (no personal Connect or Saved).
When **Exhibition Mode is OFF** → everything goes to rep's personal account only (brand dashboard receives nothing).
No overlap, no dual-capture.

### Rep side
- Once assigned to an exhibition, the rep sees: _"Your exhibition: [Exhibition Name] · [Date]"_ on their home screen
- Exhibition Mode **auto-activates on the exhibition day** on the rep's account
- Toggle available on rep's profile page to switch to personal mode (e.g. walking the floor off-booth)
- While in personal mode, scanner shows reminder: _"Exhibition Mode is off — turn on to add this contact to [Brand Name]'s dashboard."_ One tap to switch back

### Scan and exchange rules

| Action | Exhibition Mode ON | Exhibition Mode OFF |
|---|---|---|
| Rep scans visitor QR | Brand dashboard only | Rep's personal Connect only |
| Visitor scans rep QR | Visitor receives rep's contact (one-way) | Visitor receives rep's contact (one-way) |
| Visitor taps Exchange Contact | Visitor's contact → brand dashboard only | Visitor's contact → rep's personal Connect only |
| Rep scans brand QR | Rep's personal Saved tab (always personal) | Rep's personal Saved tab |

---

## Visitor List

Accessible from within each exhibition's dashboard view.

### Two sections per exhibition

| Field | Scanned by Visitor | Scanned by Team |
|---|---|---|
| Trigger | Visitor scans booth QR (visitor-initiated) | Rep scans visitor QR or visitor exchanges contact in Exhibition Mode |
| Visible fields | First name, profession, timestamp | Full visiting card: name, profession, company, email, phone, timestamp, rep who captured |
| Notes | Editable — any team member can add/edit, all see | Editable — any team member can add/edit, all see |
| Intent signal | Low | High — equivalent to exchanging cards |

If a visitor appears in both sections: **single merged entry** with both timestamps, both intent signals, and a combined notes field.

### Search and filter
- Search bar: searches visitor name, company, profession — instant results
- Filter chips: Lead Rating (Hot/Warm/Cold/Unrated), Scan Type (Visitor/Rep-Initiated), Rep Name, Date
- Active filters shown as chips with × to remove individually. Clear All available
- Sort: Most Recent (default), Lead Rating (Hot first), Name A-Z

---

## Lead Rating

- Options: Hot, Warm, Cold
- Appears on rep's **scan success screen** immediately after contact is captured — one tap to select, not mandatory
- Can be added or changed at any time from the visitor list in the brand dashboard
- Unrated leads remain in the list and are not hidden or deprioritised

---

## Qualification Questionnaire

Optional per exhibition. Brand admin creates before the exhibition goes live.

### Admin — building
- Accessible from exhibition setup in the brand dashboard
- Question types: single answer, multiple choice (select all that apply), open text
- Questions reorderable via drag and drop
- No question limit (brevity recommended for rep usability)

### Rep — filling
- On scan success screen, after lead rating: "Fill questionnaire for this lead" tap action. Only appears if questionnaire exists
- Opens as overlay — one question per screen
- Rep can skip and fill retroactively from visitor list. Not mandatory

### Admin — viewing
- Answers appear in lead's expanded detail view alongside notes and rating
- Visitor list filterable by any qualification answer
- Answers included in CSV export

---

## Data Export

- Export button on visitor list — available during and after exhibition
- Export full list or filtered subset (e.g. Hot leads only, specific rep)
- Format: **CSV**
- Columns: visitor name, profession, company, email, phone, timestamp, scan type, rep who captured, lead rating, qualification answers (one column per question), notes
- Designed for clean CRM import

---

## People at Brand — Approval & Curation

Two-step process:

### Step 1 — Approval queue
- Accessible from persistent sidebar at all times. Badge shows pending count
- Also surfaces as a Pending Action on home screen
- Each request shows: user name, role/designation, profile initials, date requested
- Admin approves or declines each request individually. **No bulk approve**
- On approval: user becomes a linked representative. Can be assigned to exhibitions and use Exhibition Mode. Does not automatically appear on About tab
- On decline: user notified, request cleared

### Step 2 — Curating the About tab
- In brand profile editor: "People at this brand" section lists all approved linked representatives
- Admin selects up to **3 people** to display publicly on About tab
- Selected people appear with name, role, and avatar initials
- Admin can change selection at any time. De-selecting removes from About tab immediately but does not affect linked representative status

---

## Manual Lead Entry

- Available directly from the brand dashboard visitor list — not accessible from the mobile app
- Used when rep has a physical visiting card or forgot to scan during exhibition
- Fields match Scanned by Team format: name, profession, company, email, phone, timestamp, notes. Rep name recorded as entry creator
- Manual entries appear in Scanned by Team section, clearly marked as manually entered
- Lead rating and qualification answers can be added to manual entries

---

## Post-Show

- Visitor list and all lead data remain accessible indefinitely after exhibition ends
- Post-show report available from Past Exhibitions section on home screen

---

## Edge Cases — Brand

| Scenario | Behaviour |
|---|---|
| Brand invited, never completes onboarding | QR not generated. Organiser sees Invited status |
| Rep added, not yet registered on Designup | Shown as Pending. Activates when they register |
| Rep scans visitor who also scanned booth QR | Merged entry with both timestamps and combined notes |
| Admin deletes product that would drop below 5 | System prevents with inline error |
| All entries deleted from optional section | That tab disappears from app automatically |
| People at Brand request from user linked to another brand | User must remove existing brand link before request can be approved |

---

## Organiser Dashboard

Account created by Designup admin. Organiser authenticates via email OTP. No self-serve signup.

---

## Exhibition Management

### Create Exhibition
Fields: exhibition name, venue, city, start date, end date, description

### Exhibition States
- **Upcoming → Active → Ended**
- Auto-activates on start date. Auto-ends on end date
- **Manual override** available with 2-step confirmation before state change executes
- Organiser can push end date forward (extension) via manual override with same 2-step confirmation
- Organiser can manually activate before start date — allowed, same 2-step confirmation applies

---

## Brand Linking — Adding Brands to an Exhibition

### Two types
- **New brands** (not yet on Designup): invited to onboard via invitation link
- **Existing brands** (already on Designup): searched and linked directly — no re-onboarding

### Inviting new brands
- Upload brand list via CSV for bulk invitations, or manual single-brand addition for one-offs
- System sends onboarding invitation email to each brand on upload
- CSV with duplicate brand entries: system flags duplicates before sending. Organiser confirms or removes
- Re-send invitation available for brands that have not started onboarding

### Linking existing brands
- Organiser searches for existing brand by name
- Organiser links them to the exhibition
- Brand receives notification in dashboard and confirms participation. Exhibition appears in their dashboard navigation
- No onboarding steps required

### Brand status tracking per exhibition

| Status | Meaning |
|---|---|
| Invited | Invitation sent. Brand has not opened the link or taken any action |
| Awaiting Setup | Account created but no onboarding details filled |
| Setup In Progress | Actively filling Steps 1–4. Not yet submitted |
| Onboarding In Progress | All 5 steps including GST submitted. Awaiting Designup verification |
| Verification In Progress | Designup is reviewing the GST document. Not yet live |
| Active | GST approved. QR is live and scannable. Brand is live on the platform |
| Failed | GST rejected. Brand notified with reason and prompted to resubmit |

---

## Booth Assignment
- Link each brand to a booth number within the exhibition
- Booth number surfaces on brand dashboard for reference
- Upload exhibition layout (image or PDF) for internal reference

---

## Visitor Pass Management
- Set free pass allocation per brand individually, or as a blanket number across all brands
- Per brand view: passes allocated → passes sent → passes registered (converted to Designup accounts) → passes that resulted in gate entry
- This conversion funnel shows which brands are actively driving footfall — useful for planning and brand conversations

---

## Analytics

### During Active Exhibition — real-time dashboard
- Live visitor entry count for current day
- Cumulative entry count for multi-day exhibitions
- Total booth saves happening live (brand QR scans)
- Total rep scans (brand-initiated connections)
- **Brand engagement leaderboard** — brands ranked by saves, updating live
- **Busiest hour chart** — hourly entry and scan distribution

### Post-Show Report
- Registration vs. actual entry rate
- Visitor profession breakdown (architects, interior designers, buyers, developers, hospitality, media — percentage split)
- City and geography of visitors
- Brand performance ranking — sorted by total saves, with rep scans and unique visitor count per brand
- Per-brand detail: total saves, rep scans, unique visitor count, profession mix
- Free pass performance: allocated vs. sent vs. registered vs. attended per brand
- Peak day and peak hour data
- **Post-show brand profile revisits** — visitors who returned to the app after the show to view brand profiles, browse catalogues, or copy contact details. Tracked per brand. This is data no traditional exhibition tool provides

---

## Staff Gate Interface

Separate interface for organiser staff at the venue gate. Accessed on tablet or laptop via a restricted login link shared by organiser admin — no full dashboard access.

### Scan Mode
- Full-screen camera view. Large scan indicator centred on screen
- Staff scans visitor's Designup pass QR
- On successful scan: large green confirmation screen showing visitor name, profession, registration status (Free / Paid / Free Pass). Entry logged automatically
- Visitor's app activates Exhibition Mode automatically — no action from visitor required
- Staff taps "Next" to return to scanner. Fast, repeatable flow for high-footfall entry

### Manual Entry Mode — fallback for scanner failure
- Toggle at top of screen to switch to manual entry
- Large input field for visitor's registered contact number
- System looks up number, shows visitor name and registration details for staff to confirm before completing entry
- On confirmation: entry logged, Exhibition Mode activates on visitor's app
- If number not found: "Not registered — direct to registration desk." No entry logged

### Gate count
Today's entry count always visible at top of the staff interface throughout the day.

---

## Edge Cases — Organiser

| Scenario | Behaviour |
|---|---|
| Brand invited, never completes onboarding | Re-send invitation available from brand list |
| Exhibition extended beyond end date | Manual override with 2-step confirmation |
| Organiser activates before start date | Allowed — same 2-step confirmation |
| CSV with duplicate brand entries | System flags before sending. Organiser confirms or removes |
| Existing brand linked but does not confirm participation | Status: "Linked — Pending Confirmation". Organiser can send reminder or remove |

---

## Next.js Route Structure

```
app/
├── login/                          page.tsx  (shared login — OTP, role switcher)
│
├── brand/
│   ├── page.tsx                    (home — active exhibition, upcoming, pending actions, past)
│   ├── onboarding/
│   │   ├── identity/               page.tsx  (Step 1)
│   │   ├── contact/                page.tsx  (Step 2)
│   │   ├── catalogue/              page.tsx  (Step 3 — products)
│   │   ├── representatives/        page.tsx  (Step 4)
│   │   └── gst/                    page.tsx  (Step 5)
│   ├── profile/                    page.tsx  (edit brand profile + preview)
│   ├── catalogue/                  page.tsx  (manage products post-onboarding)
│   ├── collections/                page.tsx  (optional section)
│   ├── past-exhibitions/           page.tsx  (optional section)
│   ├── projects/                   page.tsx  (optional section)
│   ├── qr/                         page.tsx  (QR download)
│   ├── people/                     page.tsx  (approval queue + About tab curation)
│   └── exhibitions/
│       └── [id]/
│           ├── page.tsx            (exhibition home — visitor list overview)
│           ├── visitors/           page.tsx  (full visitor list with search/filter)
│           ├── leads/
│           │   └── [visitorId]/    page.tsx  (lead detail — rating, notes, questionnaire)
│           ├── questionnaire/      page.tsx  (build qualification questionnaire)
│           └── representatives/    page.tsx  (manage reps for this exhibition)
│
├── organiser/
│   ├── page.tsx                    (home — list of exhibitions)
│   └── exhibitions/
│       ├── page.tsx                (exhibition list)
│       ├── new/                    page.tsx  (create exhibition)
│       └── [id]/
│           ├── page.tsx            (exhibition detail + analytics)
│           ├── brands/             page.tsx  (brand list, status, invite/link)
│           ├── passes/             page.tsx  (visitor pass management)
│           ├── layout/             page.tsx  (floor map upload)
│           └── report/             page.tsx  (post-show report)
│
└── gate/
    └── [exhibitionId]/             page.tsx  (staff gate interface — scan + manual entry)
```

---

## Shared Components

| Component | Used in |
|---|---|
| `OTPLogin` | Login flow |
| `RoleSwitcher` | Post-OTP dual identity selection |
| `ImageUploader` | Logo, product images, project images, layout map |
| `ProductCard` | Catalogue grid |
| `ProductForm` | Add/edit product |
| `DragSortableList` | Product reorder, questionnaire reorder |
| `CSVUploader` | Organiser brand list upload |
| `QRDisplay` | Brand QR download screen |
| `VisitorListTable` | Visitor list with search/filter/sort |
| `LeadDetailPanel` | Lead expanded view — rating, notes, questionnaire |
| `ManualLeadEntry` | Manual add lead from dashboard |
| `PendingActionsList` | Home screen task list |
| `ExhibitionCard` | Upcoming/past exhibition cards |
| `BrandStatusBadge` | Brand status in organiser view |
| `BrandEngagementLeaderboard` | Organiser analytics |
| `GateScanView` | Gate staff QR scan interface |

---

## Authentication & Role Routing

```
User arrives at /login
    ↓
Enters email or phone → OTP sent
    ↓
OTP verified → check roles on this contact
    ├── Brand only → redirect to /brand
    ├── Organiser only → redirect to /organiser
    ├── Gate staff → redirect to /gate/[exhibitionId]
    └── Dual (personal + brand) → show RoleSwitcher
            ├── Personal → redirect to mobile app (or show message)
            └── Brand → redirect to /brand
```

Supabase RLS enforces access at the data layer. Next.js middleware enforces it at the route layer.

---

## State Management

React Context + Supabase client (no Redux for MVP). Key global state:
- `user` — current logged-in Supabase user
- `activeBrand` — for future multi-brand support
- `activeExhibition` — exhibition context inside organiser or brand exhibition view

Use `@supabase/ssr` for session management in Next.js App Router (replaces deprecated `auth-helpers-nextjs`).

---

## Key Technical Notes

1. **File uploads go directly to Cloudinary from the browser** — never proxy through Supabase. Get a signed URL from a Supabase Edge Function, then upload from client.
2. **CSV parsing**: use `papaparse`. Validate client-side before sending to API.
3. **Product image ordering**: `@dnd-kit/sortable`. `display_order` column on `product_images` stores order.
4. **Onboarding step persistence**: track current step in `exhibition_brands.onboarding_step`. Brands resume on return.
5. **QR generation**: triggered by Designup internal GST approval action → calls Edge Function `generate-brand-qr` → one permanent QR per brand stored in `brands.qr_code_url`.
6. **Exhibition Mode state**: stored on `exhibition_brand_team` record, managed server-side, read by mobile app in real time.
7. **Real-time analytics**: use Supabase Realtime subscriptions on the organiser analytics page for live counts.
8. **Post-show revisit tracking**: tracked in Mixpanel event `brand_profile_viewed`, `catalogue_viewed`, `contact_copied` with `exhibition_id` context. Queried for post-show report.
