# Designup Connect — Technology Stack

> **Purpose**: This document explains every technology choice for the MVP and why it was selected. Share this with engineering hires as the definitive stack decision.

---

## Stack at a Glance

| Layer | Technology | What it does |
|---|---|---|
| Mobile App | React Native + Expo | iOS + Android app |
| Web (Admin + Brand Portal) | Next.js | Admin dashboard, brand onboarding, exhibition pages |
| Backend Platform | Supabase | Database, Auth, Storage, APIs, Real-time |
| Image CDN | Cloudinary | Product images, brand logos, exhibition layouts |
| Email | SendGrid | Brand invitations, registration confirmations, reminders |
| OTP / SMS | MSG91 | Phone number verification during sign-up |
| WhatsApp | Gupshup (WhatsApp Business API) | Free pass delivery via WhatsApp |
| Analytics | Mixpanel | User behavior tracking, funnel measurement |
| Mobile Distribution | Expo EAS | App builds, App Store + Play Store submissions, OTA updates |
| Payments (future) | Razorpay | Paid exhibition registrations (Phase 2) |

---

## Mobile App — React Native + Expo

### What it is
React Native is a framework by Meta for building iOS and Android apps using JavaScript/TypeScript. One codebase runs on both platforms. Expo is a toolset on top of React Native that handles the complex native setup (camera, QR scanning, push notifications, permissions) so engineers can focus on product, not configuration.

### Why this for Designup Connect
- **QR scanning is built-in**: `expo-camera` and `expo-barcode-scanner` handle the full camera + QR decode pipeline. This is the app's core feature — it should not require custom native code.
- **Largest talent pool**: More React Native engineers available than Flutter engineers, especially in India.
- **Fastest MVP**: Expo's managed workflow means no Xcode or Android Studio setup for initial development. Engineers can start building on Day 1.
- **OTA updates**: Expo EAS allows pushing UI/logic updates to users without waiting for App Store review. Critical for fixing bugs between exhibitions.
- **Dark/Light mode**: React Native's `useColorScheme` + a theme context handles this cleanly.

### Key Expo packages used
- `expo-camera` — camera access + QR/barcode scanning
- `expo-notifications` — push notifications (FCM on Android, APNs on iOS)
- `expo-image-picker` — profile photo uploads
- `expo-secure-store` — secure local storage (auth tokens)
- `react-native-qrcode-svg` — rendering the user's personal QR code on-screen
- `expo-local-authentication` — optional biometric lock for future

---

## Backend Platform — Supabase

### What it is
Supabase is an open-source Firebase alternative built on PostgreSQL. It provides a managed database, authentication system, file storage, and auto-generated REST + GraphQL APIs — all in one platform.

### Why this for Designup Connect
Instead of building a separate Node.js server, Supabase gives you:

| Capability | What Designup Connect uses it for |
|---|---|
| **PostgreSQL database** | All core data: users, exhibitions, brands, connections, saved brands |
| **Auth (OTP + Email)** | Phone number OTP verification at sign-up, email magic links for brand onboarding |
| **Storage** | Product images, brand catalogues, exhibition layout maps |
| **Row Level Security (RLS)** | Data access rules: visitors only see their own saved brands; brand admins only manage their own brand |
| **Edge Functions** | Custom server logic: QR generation, email triggers, analytics events |
| **Real-time subscriptions** | Live updates (useful from Phase 2 messaging onwards) |
| **Auto-generated API** | Every database table is instantly accessible as a REST API |

### Why not a custom Node.js backend
For MVP, a custom backend adds weeks of boilerplate: auth system, JWT handling, file upload pipelines, database connection pooling. Supabase provides all of this on day one. A single full-stack engineer can build the entire backend layer using Supabase without needing a dedicated backend specialist.

Supabase is built on standard PostgreSQL — if the team ever needs to migrate to a custom backend, the database is fully portable.

---

## Web — Next.js

### What it is
Next.js is a React framework for building web applications. It supports both server-side rendering (fast initial page loads, SEO) and client-side rendering (interactive dashboards).

### What it builds for Designup Connect
1. **Admin Dashboard** — Designup team creates exhibitions, manages organizers
2. **Organizer Portal** — Upload brand lists, configure exhibition, allocate passes
3. **Brand Onboarding Web** — Brands register, upload profiles, products, team members
4. **Public Exhibition Pages** — For discovery and SEO (future)

### Why one codebase for all three
All three web surfaces share the same Supabase backend and TypeScript type definitions. Using Next.js with role-based routing (middleware checks user role: admin / organizer / brand) means one codebase to maintain, not three.

---

## Image Management — Cloudinary

### Why not Supabase Storage for images
Supabase Storage is fine for documents (catalogue PDFs, layout maps). For product images — which need thumbnails, lazy loading, responsive sizes, and CDN delivery to mobile devices — Cloudinary is purpose-built.

- Auto-generates thumbnails on upload (no resize code needed)
- Serves WebP format to mobile for faster loading
- Free tier: 25GB storage, 25GB monthly bandwidth — sufficient for MVP
- Upload directly from mobile using a signed URL (no file passes through your server)

---

## Email — SendGrid

Used for:
- Brand invitation emails (with booth number, exhibition name, onboarding CTA)
- Visitor registration confirmation
- Exhibition reminder emails (5 days, 3 days, 1 day before)
- Post-show catalogue reminder

SendGrid's template system maps directly to the template variables in the product note.

---

## OTP / SMS — MSG91

- Strong delivery rates for Indian mobile numbers
- Cost-effective compared to Twilio for India-first usage
- Supports WhatsApp OTP as fallback if SMS fails
- Simple API integration

---

## Analytics — Mixpanel

Every key action in the North Star and Connection funnels from the product note becomes a Mixpanel event. This must be instrumented from Sprint 1 — not added at the end.

Events to track (minimum):
- `exhibition_registered`
- `exhibition_entry_scanned`
- `brand_scan_started`
- `brand_saved`
- `brand_detail_viewed`
- `brand_visiting_card_tapped`
- `contact_exchange_initiated`
- `contact_exchange_completed`
- `product_wishlisted`
- `saved_brands_revisited` (post-show)

---

## Infrastructure

| Service | Hosting | Why |
|---|---|---|
| Database + Auth + Storage | Supabase Cloud (Free → Pro) | Managed, no DevOps needed |
| Next.js Web | Vercel | One-click deploy from GitHub, free tier |
| Mobile App | Expo EAS | Managed build pipeline |

No servers to manage for MVP. Everything runs on managed cloud services. The team can focus entirely on product, not infrastructure.

---

## What We Are NOT Using (and Why)

| Technology | Why skipped |
|---|---|
| Flutter | Smaller hiring pool, slower MVP for a PM-led project |
| Firebase | Supabase gives real SQL database — Firebase's NoSQL would fight the relational data model |
| Custom Node.js backend | Supabase eliminates this need for MVP scope |
| AWS | Too much DevOps overhead for a team without a dedicated infrastructure engineer |
| GraphQL | REST is simpler for MVP; GraphQL overhead not justified at this stage |
| MongoDB | The data (exhibitions ↔ brands ↔ connections ↔ users) is highly relational — SQL is the right tool |
