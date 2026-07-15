import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from './betaConfig';
import type { CardContact } from '../types';

// Rewrites a Cloudinary URL to serve a width-limited, auto-quality thumbnail.
// Non-Cloudinary URLs (Unsplash, local, etc.) are returned unchanged.
export function cloudinaryThumb(url: string | null | undefined, width: number): string | null | undefined {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/w_${width},f_auto,q_auto/`);
}

const BASE_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// public_id sets the full Cloudinary path (folder + filename) explicitly,
// which is more reliable than the 'folder' param that can be overridden by preset settings.
async function uploadOnce(localUri: string, publicId: string): Promise<string | null> {
  const formData = new FormData();

  if (localUri.startsWith('data:')) {
    // Web: convert base64 data URI → Blob
    const [header, b64] = localUri.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    formData.append('file', new Blob([bytes], { type: mime }), 'card.jpg');
  } else if (localUri.startsWith('blob:')) {
    // Web: fetch blob URL → Blob
    const resp = await fetch(localUri);
    const blob = await resp.blob();
    formData.append('file', blob, 'image.jpg');
  } else {
    // Native: React Native FormData file object
    formData.append('file', { uri: localUri, type: 'image/jpeg', name: 'card.jpg' } as any);
  }

  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('public_id', publicId);

  const res = await fetch(BASE_URL, { method: 'POST', body: formData });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.secure_url as string) ?? null;
}

// Retries up to 3 times with exponential backoff: 0s → 2s → 4s
async function uploadWithRetry(localUri: string, publicId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url = await uploadOnce(localUri, publicId);
      if (url) return url;
    } catch {
      // network error — fall through to retry
    }
    if (attempt < 2) await sleep(Math.pow(2, attempt + 1) * 1000);
  }
  return null;
}

// Upload a user profile photo. Stored at connect/profiles/{userId} — overwrites on re-upload.
export async function uploadProfilePhoto(userId: string, localUri: string): Promise<string | null> {
  if (!CLOUDINARY_UPLOAD_PRESET || CLOUDINARY_UPLOAD_PRESET === 'YOUR_UPLOAD_PRESET') return null;
  return uploadWithRetry(localUri, `connect/profiles/${userId}`);
}

// Upload front + back card images in parallel.
// Folder structure in Cloudinary: connect/cards/{id}_front, connect/cards/{id}_back
export async function uploadCardImages(
  contact: CardContact,
  updateContact: (c: CardContact) => void,
): Promise<void> {
  if (!CLOUDINARY_UPLOAD_PRESET || CLOUDINARY_UPLOAD_PRESET === 'YOUR_UPLOAD_PRESET') return;

  const base = `connect/cards/${contact.id}`;

  const [frontUrl, backUrl] = await Promise.all([
    contact.card_image_uri ? uploadWithRetry(contact.card_image_uri, `${base}_front`) : Promise.resolve(null),
    contact.card_image_uri_back ? uploadWithRetry(contact.card_image_uri_back, `${base}_back`) : Promise.resolve(null),
  ]);

  // Only update if at least one image made it to Cloudinary
  if (frontUrl || backUrl) {
    updateContact({
      ...contact,
      card_image_uri: frontUrl ?? contact.card_image_uri,
      card_image_uri_back: backUrl ?? contact.card_image_uri_back,
    });
  }
}
