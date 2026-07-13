import type { CardContactField } from '../types';
import { supabase } from './supabase';
import { OcrBlock, cloudVisionToOcrBlocks, computeOcrQuality, getDemoOcrBlocks } from './cardOcrPure';

export * from './cardOcrPure';

// ── Quality logging (silent, backend-only) ────────────────────────────────────

export async function saveOcrQuality(
  cardContactId: string,
  userId: string | null,
  rawText: string,
  fields: CardContactField[],
): Promise<void> {
  try {
    await supabase.from('ocr_quality').insert({
      card_contact_id: cardContactId,
      user_id: userId,
      ...computeOcrQuality(rawText, fields),
    });
  } catch {
    // Silent — never surface quality logging errors to the user
  }
}

// ── ML Kit wrapper ────────────────────────────────────────────────────────────
// Requires: @react-native-ml-kit/text-recognition (dev build only, not Expo Go)
// Falls back to demo data when the native module is unavailable.

export async function recognizeCardText(imageUri: string): Promise<OcrBlock[]> {
  try {
    // Dynamic import — avoids a crash in Expo Go where the native module is absent
    const mod = await import('@react-native-ml-kit/text-recognition').catch(() => null);
    if (!mod) return getDemoOcrBlocks();

    const TextRecognitionScript = mod.TextRecognitionScript ?? { LATIN: 0 };
    const result = await (mod.default ?? mod).recognize(imageUri, TextRecognitionScript.LATIN);
    return (result.blocks ?? []).map((block: any) => ({
      text: block.text,
      frameHeight: block.frame?.height ?? 0,
      frameWidth: block.frame?.width ?? 0,
      frameY: block.frame?.top ?? 0,
    }));
  } catch {
    return [];
  }
}

// ── Web OCR via Supabase Edge Function + Google Cloud Vision ─────────────────
// Compresses the image client-side before upload (canvas → JPEG 0.8, max 800px)
// then calls the /ocr Edge Function which proxies to Cloud Vision API.

export async function recognizeCardTextWeb(imageBase64: string): Promise<OcrBlock[]> {
  const { data, error } = await supabase.functions.invoke('ocr', {
    body: { imageBase64, mimeType: 'image/jpeg' },
  });
  if (error) throw new Error(error.message || 'OCR service error');
  if (!data) throw new Error('No response from OCR service');
  if (data.error) throw new Error(data.error);
  return cloudVisionToOcrBlocks(data);
}
