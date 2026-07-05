import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Returns a paddingTop value that correctly clears the status bar on all
 * platforms including iOS PWA (where useSafeAreaInsets returns 0 on web).
 *
 * On web: uses CSS calc(env(safe-area-inset-top) + Xpx) so the browser's own
 * env variable is applied at paint time — works in both regular Safari and
 * installed PWA mode.
 * On native: uses the JS-measured inset from useSafeAreaInsets.
 */
export function useHeaderPaddingTop(base = 12): number | string {
  const { top } = useSafeAreaInsets();
  if (Platform.OS === 'web') {
    return `calc(env(safe-area-inset-top, 0px) + ${base}px)` as any;
  }
  return top + base;
}
