# Product Note: In-Context Product Notes

**Product:** Designup Connect
**Feature:** Product Notes
**Author:** Nivedita
**Date:** April 2026
**Status:** Built (Demo) — Backend sync pending

---

## Problem

Exhibition visitors — interior designers, architects, buyers — walk through 50–100 booths in a single day. They photograph products, pick up brochures, and make mental notes. By the time they're back at their desk, context is gone.

Current workarounds:
- WhatsApp notes to self
- Voice memos with no structure
- Generic notes apps with no link to the product or brand

None of these are attached to the product. There's no way to go back and know *why* they liked something.

---

## Opportunity

A buyer who can annotate a product in the moment — "great for Juhu project, ask about lead time" — is more likely to follow up. Notes that live *on the product* mean less friction between interest and action.

This also increases the value of Designup Connect as a post-show tool, not just a scanning app.

---

## Who is this for

**Primary:** Interior designers and architects attending B2B design exhibitions
**Secondary:** Procurement managers and retail buyers at trade shows

**Key behaviour:** They make decisions collaboratively. Notes help them brief a colleague or client without re-explaining context.

---

## What we built

A lightweight notes layer on top of every product in the app.

### User can:
- Open any product detail page
- Tap "Add Note" to type a contextual note
- See all notes for that product inline, below the specs
- See a visual indicator (pencil dot) on the product grid card when a note exists

### User cannot yet:
- Edit or delete a note
- Search products by note content
- Export notes after the show
- Access notes after closing the app (notes are in-memory for now)

---

## User Stories

| # | Story | Priority |
|---|---|---|
| 1 | As a designer, I want to note why I liked a product so I can brief my client later | P0 |
| 2 | As a buyer, I want to see at a glance which products I've annotated | P0 |
| 3 | As a user, I want my notes to survive after I close the app | P1 |
| 4 | As a user, I want to search my product notes to find something I half-remember | P1 |
| 5 | As a user, I want to delete a note I no longer need | P2 |
| 6 | As a user, I want to export all my product notes as a summary after the show | P2 |

---

## Flow

```
Products tab (brand page)
    → Tap product card
    → Product detail screen
        → Specs: material, dimensions, colour, customisable
        → "Add Note" pill button (bottom of specs)
        → Notes sheet opens
        → Type note → saved instantly
        → Note appears inline under specs
    → Return to product grid
        → Pencil dot visible on cards with notes
```

---

## Design Decisions

**Why inline notes, not a separate screen?**
Speed. At a busy exhibition, the user has 2 minutes at a booth. Opening a separate screen adds friction. Notes appear where the product specs are — same context, same scroll.

**Why reuse the existing NotesModal?**
Brand notes and connection notes already use the same component. Consistent behaviour across the app means no learning curve.

**Why a pencil dot on the grid, not a count badge?**
The grid cards are small (2-per-row). A count badge clutters the image. A small dot signals "something is here" without competing with the product image.

---

## Success Metrics

| Metric | Target |
|---|---|
| % of product views that result in a note | > 15% |
| Average notes per user per exhibition | > 3 |
| Retention: users who add notes return to the app post-show | > 60% |
| NPS delta vs users who don't use notes | +10 points |

---

## What's Not Built Yet

| Gap | Impact | Suggested sprint |
|---|---|---|
| Notes don't persist after app close | High — loses all value if app is killed | Sprint 1 |
| No edit / delete | Medium — users make typos | Sprint 1 |
| No search by note content | Medium — hard to find half-remembered products | Sprint 2 |
| No export (PDF / email) | High post-show utility | Sprint 2 |
| No note count on saved brands card | Low | Sprint 3 |

---

## Dependencies

- `AuthContext` — `notes` state, `addNote()` function
- `NotesModal` component — shared with brand and connection notes
- Supabase `product_notes` table — needed for persistence (not yet created)

---

## Open Questions

1. Should notes be private to the user, or shareable with a colleague who also attended the show?
2. Post-show: do notes expire, or do they persist indefinitely in the user's account?
3. Should the app prompt "Add a note?" after a user wishlist-saves a product?

---

## Related

- Scanner flow → `docs/04-scanner-flow.md`
- Data model → `docs/02-data-model.md`
- Technical implementation → `docs/07-product-notes-workflow.md`
