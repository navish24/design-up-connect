# Designup Connect — Scanner Flow: Technical Implementation

> **Purpose**: Step-by-step technical breakdown of the QR scanner — the core feature of the app. Every engineer touching the Scan screen must read this document before writing a single line of code.

---

## Overview

The scanner is a **universal QR scanner** — one screen that handles three distinct scan types automatically, with no mode switching required from the user. The app decodes the QR data, identifies its type, calls the backend, and shows the appropriate result.

```
Camera View
    ↓
QR Decoded (on-device, instant)
    ↓
Type Detection (client-side, < 1ms)
    ↓
API Call: POST /scan
    ↓
Micro-transition overlay ("Saving brand...")
    ↓
Success Screen (brand detail / connection created)
    ↓
Auto-return to scanner (2 sec delay, or "Scan Next" tap)
```

---

## QR Code Format Specification

All QR codes in the system use a consistent prefix-based format:

| QR Type | Format | Example |
|---|---|---|
| Booth QR | `booth:{exhibition_id}:{brand_id}` | `booth:3f8a1b2c:9d4e5f6a` |
| Personal / Visiting QR | `user:{user_id}` | `user:7c8d9e0f` |
| Entry Pass QR | `entry:{registration_id}` | `entry:2a3b4c5d` |

**Client-side detection logic:**
```typescript
function detectQRType(qrData: string): 'booth' | 'user' | 'entry' | 'unknown' {
  if (qrData.startsWith('booth:')) return 'booth';
  if (qrData.startsWith('user:'))  return 'user';
  if (qrData.startsWith('entry:')) return 'entry';
  return 'unknown';
}
```

This detection happens on-device before any network call — near-instant response.

---

## Screen Architecture: Scan Tab

The Scan screen is structured as a single scrollable view (user scrolls down to see non-camera content). The camera view is the top and primary element.

```
┌─────────────────────────────────┐
│  [Camera View — full width]     │
│                                 │
│         [  scan frame  ]        │  ← scan indicator centered on screen
│                                 │
│  "Scan booth to save brand"     │  ← hint text below camera
└─────────────────────────────────┘
│                                 │
│  [Type Brand Name  ] [Save]     │  ← manual search fallback
│                                 │
│  [My Visiting QR]               │  ← quick access button
│                                 │
│  How Scanner Works              │
│  1. Point camera at booth QR    │
│  2. Scan personal QR to share   │
│  3. Revisit it later            │
└─────────────────────────────────┘
```

---

## State Machine: Scanner Screen States

```
IDLE
  → Camera active, waiting for QR
  → User can also type brand name (manual save)

SCANNING
  → QR detected and decoded
  → Micro-transition overlay appears (0.5–1 sec)
  → "Saving brand..." text with loading icon
  → Camera is paused during this state

SUCCESS_BRAND
  → Brand saved successfully
  → Show brand success card (2 sec auto-dismiss or user taps "Scan Next")
  → "Already saved" variant if duplicate

SUCCESS_CONNECTION
  → Connection created
  → Show connection confirmation (different UI from brand save)

SUCCESS_EXHIBITION_ENTRY
  → Exhibition activated
  → Notification shown: "[Exhibition Name] is now active on dashboard"

ERROR
  → Invalid QR / network error
  → Brief error message, auto-return to IDLE
```

---

## Implementation: Camera + QR Scanning

```typescript
// Expo packages required:
// expo-camera
// expo-barcode-scanner

import { Camera, BarCodeScanningResult } from 'expo-camera';
import { useState, useRef } from 'react';

const ScanScreen = () => {
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [scanResult, setScanResult] = useState(null);
  const isProcessing = useRef(false); // prevents multiple scans firing at once

  const handleBarCodeScanned = async ({ data }: BarCodeScanningResult) => {
    // CRITICAL: Guard against duplicate scan events from expo-camera
    if (isProcessing.current) return;
    isProcessing.current = true;

    setScanState('scanning'); // show "Saving brand..." overlay

    try {
      const result = await processScan(data);
      setScanResult(result);
      setScanState('success');

      // Auto-return to scanner after 2 seconds
      // (user can also tap "Scan Next" to return immediately)
      setTimeout(() => {
        setScanState('idle');
        isProcessing.current = false;
      }, 2000);

    } catch (error) {
      setScanState('error');
      setTimeout(() => {
        setScanState('idle');
        isProcessing.current = false;
      }, 1500);
    }
  };

  return (
    <View>
      {scanState === 'idle' && (
        <Camera
          onBarCodeScanned={handleBarCodeScanned}
          barCodeScannerSettings={{
            barCodeTypes: ['qr'],  // only scan QR, ignore barcodes
          }}
        />
      )}
      {scanState === 'scanning' && <ScanningOverlay />}
      {scanState === 'success' && <ScanSuccessScreen result={scanResult} onScanNext={() => {
        setScanState('idle');
        isProcessing.current = false;
      }} />}
    </View>
  );
};
```

**Why `isProcessing` ref is critical**: `expo-camera` fires `onBarCodeScanned` multiple times per second when a QR is in frame. Without this guard, the app would make 5–10 API calls for a single scan. The ref (not state) is used because it updates synchronously — state updates are async and would allow duplicates through.

---

## Implementation: processScan Function

```typescript
async function processScan(qrData: string) {
  const qrType = detectQRType(qrData);

  if (qrType === 'unknown') {
    throw new Error('invalid_qr');
  }

  const activeExhibitionId = getActiveExhibitionId(); // from app state / AsyncStorage

  const response = await supabase.functions.invoke('scan', {
    body: {
      qr_data: qrData,
      active_exhibition_id: activeExhibitionId
    }
  });

  if (response.error) throw response.error;
  return response.data;
}
```

---

## Success Screen: Brand Saved

When a booth QR is scanned successfully, this screen appears **in the user journey flow** (not as a bottom toast).

```
┌─────────────────────────────────┐
│                                 │
│   ✓  Saved — Lumina Lighting    │  ← large, prominent
│   Saved to Index Mumbai 2025    │  ← exhibition context
│                                 │
│   [product image 1] [image 2]   │  ← 1–2 product visuals
│                                 │
│   Hall 2  •  Booth B12          │  ← booth info
│                                 │
│       [View Brand Details]      │  ← secondary CTA, text-width
│                                 │
│          [Scan Next]            │  ← primary CTA, returns to camera
│                                 │
│  You can revisit this anytime   │
│       after the show            │  ← subtle note
└─────────────────────────────────┘
```

**Already Saved variant:**
```
│   ✓  Already saved              │
│   Lumina Lighting is in your    │
│   Index Mumbai 2025 saves       │
│                                 │
│          [Scan Next]            │
```

---

## Manual Save: Type Brand Name

Below the camera, there is a search field that lists brands in the active exhibition. This is the fallback for cases where the QR code is damaged or missing.

```typescript
// Search brands in active exhibition
const searchExhibitionBrands = async (query: string, exhibitionId: string) => {
  const { data } = await supabase
    .from('exhibition_brands')
    .select(`
      brand_id,
      booth_number,
      hall_number,
      brands(id, name, category, tagline)
    `)
    .eq('exhibition_id', exhibitionId)
    .ilike('brands.name', `%${query}%`)
    .limit(10);

  return data;
};
```

The CTA next to the search field says **"Save"** (not "Scan") — tapping it calls the same `POST /scan` endpoint but with a constructed QR data string:
```
booth:{exhibition_id}:{brand_id}
```

---

## Entry Pass Scanning (Gate Scanner)

The entry pass scan is handled by the **same universal scanner**. When the backend returns `scan_type: "entry"`, the app:

1. Updates the exhibition status from "Upcoming" to "Active" in local app state
2. Shows: "[Exhibition Name] is now active on your dashboard"
3. Home screen updates: Active Exhibition card appears at the top with "Open Scanner" and "Explore Exhibition" CTAs

**Gate scanner context**: The entry QR is shown in the "View Ticket" screen. The visitor presents their phone to a gate operator who scans it with a separate gate-side scanner (which also calls `POST /scan` with an admin JWT). The visitor's app does not need to do anything — the check-in is server-side.

**However**: The visitor's app needs to detect that they are now checked in. Two approaches:
- **Polling**: Check `visitor_registrations.status` every 30 seconds when app is in foreground during exhibition dates (simple, works)
- **Supabase Realtime**: Subscribe to changes on their `visitor_registrations` row (instant, more elegant)

For MVP, polling is acceptable.

---

## Demo Mode: Simulated Scans

When Demo Mode is enabled (Profile toggle), the scanner shows a "Simulate Brand Scan" button. Tapping it:

1. Picks a pre-loaded demo brand from a hardcoded list
2. Constructs a fake `booth:{demo_exhibition_id}:{demo_brand_id}` QR string
3. Sends it through the same `processScan` flow
4. The backend handles demo brands the same as real brands (they are real records in the database, seeded as demo data)

This means Demo Mode requires zero special code in the scanner — only the trigger UI changes.

---

## Performance Requirements

| Metric | Target | How to achieve |
|---|---|---|
| QR decode time | < 100ms | On-device, expo-camera handles this |
| API call (booth scan) | < 800ms | Supabase Edge Function + indexed lookups |
| Total: scan to "Saved" message | < 1.5 seconds | Combination of above |
| Success screen display | 2 seconds | Auto-dismisses, or immediate on "Scan Next" tap |

If the API call exceeds 800ms consistently, the primary fix is:
1. Ensure database indexes are in place on `saved_brands(visitor_user_id, brand_id, exhibition_id)`
2. Ensure the Supabase Edge Function is deployed in the `ap-south-1` (Mumbai) region

---

## Edge Cases to Handle

| Scenario | Expected behavior |
|---|---|
| No active exhibition | Error: "You need to check in to an exhibition to save brands" — show prompt to go to Home |
| Same brand scanned twice | Return `already_saved: true`, show "Already saved" state, do NOT create duplicate |
| QR from a different exhibition | Save under the scanned QR's exhibition (not the active one), confirm with "[Brand] saved to [Other Exhibition]" |
| No internet connection | Show "No connection" error, do not add to pending queue (MVP: require connectivity) |
| QR code is blurry / partially visible | Camera keeps scanning until a clean read. No timeout needed. |
| Scanning a non-Designup QR (e.g., URL, barcode) | Return `unknown` type, show "This QR isn't a Designup code" briefly, return to idle |
| Brand not yet onboarded (invited but incomplete) | Backend returns a "brand profile not ready" error. Show: "This brand hasn't completed their setup yet." |
