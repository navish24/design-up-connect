import type { CardContactField } from '../types';

// Ephemeral in-memory store for passing OCR results from the scan screen to the
// review screen. Not persisted — clears after the review screen consumes it.

export type ScanSource = 'camera_native' | 'gallery_native' | 'camera_web' | 'gallery_web';

export interface PendingCardScan {
  imageUri: string | null;
  backImageUri: string | null;
  fields: CardContactField[];
  isBlurry: boolean;
  rawText: string;
  scanSource: ScanSource;
}

let pending: PendingCardScan | null = null;

export const cardScanStore = {
  set(data: PendingCardScan) {
    pending = data;
  },
  get(): PendingCardScan | null {
    return pending;
  },
  consume(): PendingCardScan | null {
    const data = pending;
    pending = null;
    return data;
  },
};
