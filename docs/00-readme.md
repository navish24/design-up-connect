# Designup Connect — Technical Reference

> This folder contains the complete technical reference for building Designup Connect MVP.
> Share the relevant documents with engineers and designers when onboarding them.

---

## Documents

| File | What it covers | Share with |
|---|---|---|
| [01-tech-stack.md](01-tech-stack.md) | Every technology choice and why | All engineers, designer |
| [02-data-model.md](02-data-model.md) | Complete PostgreSQL database schema | Backend / full-stack engineer |
| [03-api-design.md](03-api-design.md) | All API endpoints (auth, scan, connections, etc.) | All engineers |
| [04-scanner-flow.md](04-scanner-flow.md) | QR scanner technical implementation | Mobile engineer |
| [05-brand-onboarding-architecture.md](05-brand-onboarding-architecture.md) | Brand onboarding web portal architecture | Frontend / full-stack engineer |
| [06-hiring-plan.md](06-hiring-plan.md) | Who to hire, when, what to look for | PM reference |

---

## Product Reference

The product spec is in: `DESIGNUP — PRODUCT NOTE(MVP).pdf`

Always read the product note alongside the technical docs. The product note defines **what** to build; these docs define **how** to build it.

---

## Stack Summary

- **Mobile App**: React Native + Expo (iOS + Android)
- **Web Portals**: Next.js (admin + organizer + brand onboarding)
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Images**: Cloudinary
- **Email**: SendGrid
- **OTP**: MSG91
- **Analytics**: Mixpanel

---

## MVP Core Hypothesis

> Users will actively use Designup during exhibitions to save brands and will return to the app afterward to revisit them.

Everything we build is in service of validating this one behavior.
