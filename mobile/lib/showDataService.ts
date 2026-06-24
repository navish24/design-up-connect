// ------------------------------------------------------------
// showDataService.ts
// Singleton service — loads show JSON and resolves hall images.
// All stall data is JSON-driven; nothing is hardcoded here.
// ------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { ShowJSON, Hall, Stall, NavNode } from '../data/showTypes';

// ------------------------------------------------------------------ //
//  Storage keys
// ------------------------------------------------------------------ //

const CACHE_KEY = 'show_data_v5';
const STAMP_KEY = 'show_data_stamp_v5';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ------------------------------------------------------------------ //
//  1. Primary entry point
// ------------------------------------------------------------------ //

/**
 * Returns the current ShowJSON for the app to render.
 *
 * Resolution order:
 *   1. AsyncStorage cache, if younger than 24 h
 *   2. Bundled sampleShow.json
 *
 * If ShowMeta.dataUrl is present, a background fetch is kicked off
 * to refresh the cache without blocking the caller.
 */
export async function getShowData(): Promise<ShowJSON> {
  // --- try cache ---
  const [cached, stamp] = await Promise.all([
    AsyncStorage.getItem(CACHE_KEY),
    AsyncStorage.getItem(STAMP_KEY),
  ]);

  if (cached && stamp) {
    const age = Date.now() - Number(stamp);
    if (age < CACHE_TTL_MS) {
      const parsed: ShowJSON = JSON.parse(cached);
      const enriched = enrichStalls(parsed);
      if (enriched.meta.dataUrl) _fetchAndCacheRemote(enriched.meta.dataUrl);
      return enriched;
    }
  }

  // --- fall back to bundled default ---
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bundled: ShowJSON = require('../data/sampleShow.json');
  const enriched = enrichStalls(bundled);
  await _persistToCache(enriched);
  if (enriched.meta.dataUrl) _fetchAndCacheRemote(enriched.meta.dataUrl);
  return enriched;
}

// ------------------------------------------------------------------ //
//  2. computeNearestNodeId
// ------------------------------------------------------------------ //

/**
 * Finds the NavNode whose centre is closest (Euclidean) to the
 * centre of the given stall and returns the node's id.
 */
export function computeNearestNodeId(
  stall: Stall,
  navNodes: NavNode[],
): string {
  const cx = stall.x + stall.width / 2;
  const cy = stall.y + stall.height / 2;

  let bestId = navNodes[0].id;
  let bestDist = Infinity;

  for (const node of navNodes) {
    const dx = node.x - cx;
    const dy = node.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = node.id;
    }
  }

  return bestId;
}

// ------------------------------------------------------------------ //
//  3. enrichStalls
// ------------------------------------------------------------------ //

/**
 * Returns a copy of ShowJSON where every stall has a nearestNodeId.
 * Stalls that already carry the field are left untouched.
 */
export function enrichStalls(show: ShowJSON): ShowJSON {
  const nodes = show.navGraph.nodes;

  const enrichedStalls = show.stalls.map((stall) => {
    if (stall.nearestNodeId) return stall;
    return {
      ...stall,
      nearestNodeId: computeNearestNodeId(stall, nodes),
    };
  });

  return { ...show, stalls: enrichedStalls };
}

// ------------------------------------------------------------------ //
//  4. resolveHallImageSource
// ------------------------------------------------------------------ //

/**
 * Converts a Hall's imageUrl into a value suitable for an <Image>
 * source prop.
 *
 * - "local:<filename>"  → require('../assets/<filename>')
 * - anything else       → { uri: hall.imageUrl }
 */
export function resolveHallImageSource(
  hall: Hall,
): ReturnType<typeof require> | { uri: string } | undefined {
  if (hall.imageUrl.startsWith('local:')) {
    return _resolveLocalAsset(hall.imageUrl.slice('local:'.length));
  }
  return { uri: hall.imageUrl };
}

/**
 * Internal lookup for bundled hall floor-plan images.
 * Add a new entry whenever a hall asset is added to mobile/assets/.
 */
function _resolveLocalAsset(filename: string): ReturnType<typeof require> | undefined {
  // Metro resolves require() statically, so every entry must be a literal.
  const LOCAL_ASSETS: Record<string, ReturnType<typeof require>> = {
    'venue-map.png': require('../assets/venue-map.png'),
    'venue-map.jpg': require('../assets/venue-map.jpg'),
  };

  const asset = LOCAL_ASSETS[filename];
  if (!asset) {
    console.log(
      `[showDataService] No bundled asset for "${filename}". ` +
        'Add it to LOCAL_ASSETS in showDataService.ts.',
    );
    return undefined;
  }

  return asset;
}

// ------------------------------------------------------------------ //
//  5. clearCache
// ------------------------------------------------------------------ //

/** Removes all cached show-data keys from AsyncStorage. */
export async function clearCache(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEY, STAMP_KEY]);
}

// ------------------------------------------------------------------ //
//  Internal helpers
// ------------------------------------------------------------------ //

async function _persistToCache(show: ShowJSON): Promise<void> {
  const json = JSON.stringify(show);
  const stamp = String(Date.now());
  await AsyncStorage.multiSet([
    [CACHE_KEY, json],
    [STAMP_KEY, stamp],
  ]);
}

/**
 * Fetches a remote ShowJSON payload and updates the cache in the
 * background.  Never throws — failures are logged and swallowed so
 * they don't interrupt the UI.
 */
async function _fetchAndCacheRemote(url: string): Promise<void> {
  try {
    const tmpUri = FileSystem.cacheDirectory + 'show_data_remote_tmp.json';
    const result = await FileSystem.downloadAsync(url, tmpUri);

    if (result.status !== 200) {
      console.log(
        `[showDataService] Remote fetch returned HTTP ${result.status} for ${url}`,
      );
      return;
    }

    const rawJson = await FileSystem.readAsStringAsync(tmpUri);
    const parsed: ShowJSON = JSON.parse(rawJson);
    const enriched = enrichStalls(parsed);
    await _persistToCache(enriched);
  } catch (err) {
    console.log('[showDataService] Background remote fetch failed:', err);
  }
}
