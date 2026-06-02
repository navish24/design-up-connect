# Designup Connect — Hiring Plan & Team Structure

> **Purpose**: Who to hire, in what sequence, what to look for, and how the team maps to the work. Share this when discussing roles with potential candidates or recruiters.

---

## Team for MVP

You need 4 people total (including yourself as PM):

| Role | Type | When to hire | Monthly Cost (India) |
|---|---|---|---|
| UI/UX Designer | Freelance or Full-time | **Immediately — hire first** | ₹60K–₹1L (freelance) |
| Senior Full-Stack Engineer | Full-time | Week 1–2 | ₹1.5L–₹2.5L |
| Mobile / Frontend Engineer | Full-time | Week 3–4 | ₹1L–₹1.8L |
| QA / Testing (part-time) | Freelance | Sprint 3 onwards | ₹30K–₹50K part-time |

Total monthly burn for a lean MVP team: approximately ₹3.5L–₹5.5L + your own cost.

---

## Hire #1: UI/UX Designer

**Hire this person first — before any engineer.**

The designer creates Figma screens that engineers implement. Without Figma designs, engineers make UI decisions themselves — this is inefficient and results in a product that doesn't match your vision. Your product note has excellent spec detail; a good designer will translate it into screens in 2–3 weeks, and engineers will then build against those screens.

### What to look for
- Strong Figma skills (components, auto-layout, design systems)
- Mobile app design experience (iOS/Android patterns)
- Portfolio: should show clean, premium apps — not just web work
- Understands dark mode design (your default theme)
- Can design a full component library, not just individual screens

### What they will build
- Full Figma file with all screens from the product note
- Component library (buttons, cards, navigation, modals)
- Dark and light mode variants for all screens
- Prototype flows for: registration, QR scan, saved brands, connections
- Asset export ready for developers (icons, images, spacing specs)

### Where to find
- Behance / Dribbble (DM designers with relevant portfolios)
- LinkedIn (search: "mobile UI designer Figma India")
- DesignUp community (ironically — your target market's design community)
- Toptal / Contra for freelance options

### Interview test
Share 2–3 screens from your product note and ask them to design one screen (e.g., the Brand Detail Page) as a paid test task. Evaluate: premium feel, adherence to spec, attention to spacing and typography.

---

## Hire #2: Senior Full-Stack Engineer

**The most important technical hire.** This person sets the architecture, makes tech decisions, and builds the backbone of the product.

### Skills required (non-negotiable)
- React Native + Expo (must have built and shipped a mobile app)
- TypeScript (not JavaScript — types prevent bugs)
- Supabase or similar (PostgreSQL, backend-as-a-service)
- Next.js (for the web portals)
- REST API design
- Git + GitHub

### Skills that are a strong plus
- Experience with QR scanning / camera APIs on mobile
- Image upload pipelines (Cloudinary or S3)
- Push notifications (FCM / APNs)
- Has worked in a startup / early-stage product

### What they will own
- Supabase project setup (database, auth, storage, RLS)
- All Supabase Edge Functions
- React Native mobile app (core screens)
- API integration layer

### Red flags to avoid
- Has only built web apps, never shipped a mobile app to App Store / Play Store
- Only knows class-based React (not modern hooks)
- Cannot explain database indexing or query optimization
- Has never set up auth from scratch

### Interview approach
1. Walk them through the product note — ask them to critique the data model in `02-data-model.md`
2. Ask: "How would you prevent duplicate QR scans in the saved_brands table?" (Answer: UNIQUE constraint + upsert)
3. Ask: "How would you handle the QR scan → success screen in under 1.5 seconds?" (Answer: concurrent API + optimistic UI)
4. Paid test: Build the `POST /scan` Edge Function with the three QR types — takes ~4 hours for a strong candidate

### Compensation
₹1.5L–₹2.5L/month depending on experience. 3–5 years experience is the sweet spot. A 6+ year engineer will be 3L+ and is not necessary for MVP scope.

---

## Hire #3: Mobile / Frontend Engineer

A supporting engineer who works alongside the Senior engineer. This person handles the web portals (admin, brand onboarding) and supports mobile development.

### Skills required
- React Native + Expo
- Next.js / React
- Comfortable with Supabase client SDK
- TypeScript

### What they will own
- Brand Onboarding Web Portal (Next.js)
- Admin Dashboard (Next.js)
- Organizer Portal (Next.js)
- Support on mobile app features

### Notes
This hire can come 3–4 weeks after the Senior engineer. Let the Senior engineer establish the architecture, set up the repo, and define conventions — then the second engineer slots in cleanly.

---

## Freelance: QA Tester

Hire from Sprint 3 onwards (around Week 8–9). Their job:
- Test every feature on real iOS and Android devices
- Test QR scanning with printed QR codes (not on-screen QRs)
- Validate registration flows end-to-end
- Write bug reports with reproduction steps in a shared issue tracker (Linear or GitHub Issues)

A strong QA freelancer costs ₹30K–₹50K/month part-time and saves weeks of debugging after launch.

---

## What You (PM) Handle

- All product decisions and feature scope
- This documentation — keep it updated as the team builds
- Figma file (with the designer)
- Vendor setup: Supabase account, Cloudinary account, SendGrid account, MSG91, Mixpanel
- App Store + Play Store developer accounts (register early — Apple takes 1–2 days to approve)
- Testing on your own phone with the demo mode
- Stakeholder communication: exhibition organizers, brand contacts

---

## Recommended Sprint Plan

| Week | Designer | Senior Engineer | Second Engineer |
|---|---|---|---|
| 1–2 | Designing all screens in Figma | Environment setup, DB schema, auth | — |
| 3–4 | Completing component library | Mobile: auth flow, home screen, exhibition list | Joins. Starts brand onboarding web |
| 5–6 | Available for design QA | Mobile: scanner, save flow, brand detail | Brand onboarding portal |
| 7–8 | — | Mobile: connections, saved brands | Admin dashboard, organizer portal |
| 9–10 | — | Notifications, wishlist, demo mode | QA integration, bug fixes |
| 11–12 | — | Analytics instrumentation, polish | Web portal polish |
| 13–14 | — | App Store submission, production setup | Final bug fixes |

**Total**: ~14 weeks from hiring to launch-ready product.

---

## Onboarding New Hires

Share these documents with every new hire on Day 1:

1. `01-tech-stack.md` — understand every technology choice and why
2. `02-data-model.md` — the database is the backbone, read this thoroughly
3. `03-api-design.md` — all API endpoints reference
4. `04-scanner-flow.md` — the core feature, must understand before touching the Scan screen
5. `05-brand-onboarding-architecture.md` — for the engineer building the web portal
6. This document (06) — team structure and responsibilities

**For the designer**: Share the product note PDF + `01-tech-stack.md` (so they know it's a React Native app and design for mobile-first).

---

## Tools the Team Needs

| Tool | Purpose | Cost |
|---|---|---|
| GitHub | Code repository + PR reviews | Free |
| Linear | Sprint planning + bug tracking | Free for small teams |
| Figma | Design | Free (starter) |
| Slack | Team communication | Free |
| Supabase | Backend platform | Free (upgrade to Pro at ~$25/mo when needed) |
| Cloudinary | Image CDN | Free tier |
| SendGrid | Email | Free up to 100 emails/day |
| MSG91 | OTP SMS | Pay-per-SMS (~₹0.20/OTP) |
| Mixpanel | Analytics | Free up to 20M events/month |
| Expo EAS | Mobile builds | Free tier (limited builds/month) |
| Apple Developer Account | iOS App Store | $99/year |
| Google Play Console | Android Play Store | $25 one-time |

**Total tool cost for MVP**: Under ₹10,000/month until significant scale.
