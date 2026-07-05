// Web (connect-designup.vercel.app) is always the beta/Connect experience.
// Native: set EXPO_PUBLIC_IS_BETA=false to get the full Designup app.
import { Platform } from 'react-native';
export const isBeta: boolean =
  Platform.OS === 'web' || process.env.EXPO_PUBLIC_IS_BETA === 'true';

// Cloudinary — same account as the brand dashboard.
// CLOUDINARY_UPLOAD_PRESET: create an unsigned preset in Cloudinary dashboard →
//   Settings → Upload → Upload Presets → Add preset → Signing mode: Unsigned → name it "connect_cards"
export const CLOUDINARY_CLOUD_NAME = 'dohulv5ld';
export const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'YOUR_UPLOAD_PRESET';
