# Product Notes — Feature Workflow

**Feature:** Add contextual notes to individual products while visiting exhibition booths.
**Status:** Implemented (demo mode)
**File:** `mobile/app/brand/[id].tsx`

---

## Why this feature exists

At an exhibition, a buyer or designer sees 50–100 products across multiple brands in a few hours. They may like a specific product for a specific reason — the material finish, the customisation option, a client project in mind — but that context is lost by the time they're back at their desk.

Product notes let them capture that thought in the moment, attached directly to the product, not buried in a generic notepad.

---

## User journey

```
Exhibition floor
      │
      ▼
Scan brand booth QR  ──────────────────────────────────────────┐
      │                                                         │
      ▼                                                         │
Brand Detail screen (Products tab is default)                  │
      │                                                         │
      ▼                                                         │
Tap product card → Product Detail screen                       │
      │                                                         │
      ▼                                                         │
Read specs (material, dimensions, colour, customisable)        │
      │                                                         │
      ▼                                                         │
Tap "Add Note" pill → Notes sheet slides up                    │
      │                                                         │
      ▼                                                         │
Type note (e.g. "Good for Juhu project — ask about lead time") │
      │                                                         │
      ▼                                                         │
Note saved → appears inline under specs immediately            │
      │                                                         │
      ▼                                                         │
Return to brand → pencil dot on product card = note exists  ───┘
```

---

## Where notes appear

| Location | What you see |
|---|---|
| Products grid (brand page) | Small accent-coloured pencil dot on top-left of card |
| Product detail — below specs | Left-bordered note snippet(s), inline, no tap needed |
| Product detail — pill button | "Add Note" or "2 Notes" depending on count |

---

## How it works technically

### Data storage
Notes are stored in `AuthContext` as:
```ts
notes: Record<string, Note[]>
// key = product id e.g. "b01-p1"
// Note = { id, text, created_at }
```

The same `notes` map is used for brand notes and connection notes — just different keys.

### Adding a note
```ts
addNote(selectedProduct.id, text)
// e.g. addNote('b01-p1', 'Great brass finish — confirm MOQ')
```

### Reading notes
```ts
const productNotes = notes[selectedProduct.id] ?? [];
```

### Components used
- `NotesModal` — reused from brand and connection notes. Accepts `entityName`, `notes[]`, `onAddNote`.
- `showProductNotes` state — boolean controlling modal visibility.

---

## Note indicator on grid cards

A small dot with a pencil icon appears on any product card that has at least one note:

```
┌──────────────────┐
│ ✏ ·              │  ← accent-coloured dot (top-left)
│                  │        ♥  (wishlist, top-right)
│   [product img]  │
│                  │
│ Product Name     │
│ View Product  >  │
└──────────────────┘
```

---

## Note sheet behaviour

- Slides up from bottom (same `NotesModal` as brand/connection notes)
- Shows product name as header
- Input field at top — tap to type, submit adds note instantly
- All existing notes listed below, newest first
- Notes persist for the session (in-memory, demo mode)

---

## Scope and limitations (current)

| Item | Status |
|---|---|
| Notes per product | Unlimited |
| Notes persist across app restart | No — in-memory only (demo) |
| Notes sync to backend (Supabase) | Not implemented |
| Edit / delete a note | Not implemented |
| Search products by note content | Not implemented |
| Export notes | Not implemented |

---

## Suggested next features (backlog)

1. **Search by note** — extend saved brands search to surface products by note text
2. **Notes export** — share product notes as PDF or email after the show
3. **Delete note** — swipe-to-delete on note items in the modal
4. **Backend sync** — persist notes to Supabase `product_notes` table on save
5. **Note count on saved brands card** — show total note count across all products of a saved brand

---

## Related docs

- `04-scanner-flow.md` — how brand QR scan works
- `02-data-model.md` — product data shape (`ApiProduct`)
- `05-brand-onboarding-architecture.md` — how brands and products get into the system
