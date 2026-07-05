// EXPO_PUBLIC_* vars are inlined at build time by Metro/EAS.
// In beta builds (APP_VARIANT=beta) this is "true"; in production it is unset.
export const isBeta: boolean = process.env.EXPO_PUBLIC_IS_BETA === 'true';

// Cloudinary — same account as the brand dashboard.
// CLOUDINARY_UPLOAD_PRESET: create an unsigned preset in Cloudinary dashboard →
//   Settings → Upload → Upload Presets → Add preset → Signing mode: Unsigned → name it "connect_cards"
export const CLOUDINARY_CLOUD_NAME = 'dohulv5ld';
export const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'YOUR_UPLOAD_PRESET';
