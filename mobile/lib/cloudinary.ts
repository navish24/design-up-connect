import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from './betaConfig';
import type { CardContact } from '../types';

const BASE_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadOnce(localUri: string, folder: string): Promise<string | null> {
  const formData = new FormData();

  if (localUri.startsWith('data:')) {
    // Web: convert base64 data URI → Blob
    const [header, b64] = localUri.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    formData.append('file', new Blob([bytes], { type: mime }), 'card.jpg');
  } else {
    // Native: React Native FormData file object
    formData.append('file', { uri: localUri, type: 'image/jpeg', name: 'card.jpg' } as any);
  }

  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(BASE_URL, { method: 'POST', body: formData });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.secure_url as string) ?? null;
}

// Retries up to 3 times with exponential backoff: 0s → 2s → 4s
async function uploadWithRetry(localUri: string, folder: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url = await uploadOnce(localUri, folder);
      if (url) return url;
    } catch {
      // network error — fall through to retry
    }
    if (attempt < 2) await sleep(Math.pow(2, attempt + 1) * 1000);
  }
  return null;
}

// Upload front + back card images in parallel.
// Returns the contact with cloud URLs substituted in, or the original if upload failed.
export async function uploadCardImages(
  contact: CardContact,
  updateContact: (c: CardContact) => void,
): Promise<void> {
  if (!CLOUDINARY_UPLOAD_PRESET || CLOUDINARY_UPLOAD_PRESET === 'YOUR_UPLOAD_PRESET') return;

  const folder = `connect/cards/${contact.id}`;

  const [frontUrl, backUrl] = await Promise.all([
    contact.card_image_uri ? uploadWithRetry(contact.card_image_uri, folder) : Promise.resolve(null),
    contact.card_image_uri_back ? uploadWithRetry(contact.card_image_uri_back, folder) : Promise.resolve(null),
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
