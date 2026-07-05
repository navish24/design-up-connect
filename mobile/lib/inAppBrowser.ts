import { Platform } from 'react-native';

export function isInAppBrowser(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;

  // Explicit markers injected by apps that identify themselves
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return true;
  if (/Instagram/i.test(ua)) return true;
  if (/LinkedInApp/i.test(ua)) return true;
  if (/WhatsApp/i.test(ua)) return true;
  if (/Line\//i.test(ua)) return true;

  // iOS WKWebView fallback: real Safari always includes "Version/XX.X";
  // in-app browsers (WhatsApp, Telegram, etc.) typically omit it entirely.
  if (/iPhone|iPad|iPod/i.test(ua) && !/Version\//.test(ua)) return true;

  // Android WebView: presence of the "wv" flag in the UA string
  if (/Android/i.test(ua) && /\bwv\b/.test(ua)) return true;

  return false;
}

export function getInAppBrowserName(): string {
  if (typeof navigator === 'undefined') return 'this app';
  const ua = navigator.userAgent;
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/LinkedInApp/i.test(ua)) return 'LinkedIn';
  if (/Line\//i.test(ua)) return 'Line';
  return 'this app';
}

export function suggestedBrowser(): 'Safari' | 'Chrome' {
  if (typeof navigator === 'undefined') return 'Safari';
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'Safari' : 'Chrome';
}
