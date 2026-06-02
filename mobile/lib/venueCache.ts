import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { VENUE_MAP } from '../data/venue-map';

const CACHE_KEY_MAP   = 'venue_map_v1';
const CACHE_KEY_STAMP = 'venue_map_stamp_v1';
const IMG_CACHE_DIR   = `${FileSystem.cacheDirectory}venue-images/`;

// ── Map data ──────────────────────────────────────────────────────────────────

export async function saveVenueMap(data: typeof VENUE_MAP) {
  await AsyncStorage.setItem(CACHE_KEY_MAP, JSON.stringify(data));
  await AsyncStorage.setItem(CACHE_KEY_STAMP, Date.now().toString());
}

export async function loadCachedVenueMap(): Promise<typeof VENUE_MAP | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY_MAP);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function getCacheAgeMs(): Promise<number | null> {
  const stamp = await AsyncStorage.getItem(CACHE_KEY_STAMP);
  if (!stamp) return null;
  return Date.now() - parseInt(stamp, 10);
}

// ── Image cache ───────────────────────────────────────────────────────────────

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(IMG_CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(IMG_CACHE_DIR, { intermediates: true });
}

/** Download a remote image URL and return a local file:// URI */
export async function cacheImage(url: string): Promise<string> {
  await ensureCacheDir();
  const filename = url.replace(/[^a-z0-9]/gi, '_').slice(-60) + '.jpg';
  const localPath = IMG_CACHE_DIR + filename;
  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) return localPath;
  await FileSystem.downloadAsync(url, localPath);
  return localPath;
}

/** Delete all cached images (call on app update or when storage is low) */
export async function clearImageCache() {
  const info = await FileSystem.getInfoAsync(IMG_CACHE_DIR);
  if (info.exists) await FileSystem.deleteAsync(IMG_CACHE_DIR, { idempotent: true });
}
