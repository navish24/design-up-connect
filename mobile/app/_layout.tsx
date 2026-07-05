import 'react-native-get-random-values';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, Pressable, StyleSheet, LogBox, useWindowDimensions, Modal, Animated } from 'react-native';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { prefetchCategories } from '../lib/unsplash';
import { isInAppBrowser } from '../lib/inAppBrowser';
import InAppBrowserOverlay from '../components/InAppBrowserOverlay';
// Suppress expected dev-only log messages that appear as yellow warnings
// in the LogBox banner. These are informational — not real errors.
LogBox.ignoreLogs([
  '[getBrand]',
  '[getNewBrands]',
  '[showDataService]',
]);

function InstallBanner() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showSheet, setShowSheet] = useState(false);

  useEffect(() => {
    const g = globalThis as any;
    if (!g.window) return;
    const standalone =
      g.window.matchMedia?.('(display-mode: standalone)').matches ||
      g.navigator?.standalone === true;
    if (standalone) return;

    const ua = g.navigator?.userAgent ?? '';
    const ios = /iphone|ipad|ipod/i.test(ua);
    const android = /android/i.test(ua);

    if (ios) {
      setPlatform('ios');
      setVisible(true);
    } else if (android) {
      setPlatform('android');
      const handler = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setVisible(true);
      };
      g.window.addEventListener('beforeinstallprompt', handler);
      return () => g.window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowSheet(true);
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setVisible(false);
      setDeferredPrompt(null);
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Slim top banner */}
      <View style={[banner.wrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={banner.row}>
          <View style={[banner.iconWrap, { backgroundColor: colors.accent + '20' }]}>
            <Ionicons name="phone-portrait-outline" size={16} color={colors.accent} />
          </View>
          {platform === 'ios' ? (
            <View style={banner.textStack}>
              <Text style={[banner.textLine1, { color: colors.textSecondary }]}>For better experience</Text>
              <Text style={[banner.textLine2, { color: colors.text }]}>Add Connect to your Home Screen</Text>
            </View>
          ) : (
            <Text style={[banner.title, { color: colors.text }]}>Install Connect for the best experience</Text>
          )}
          <Pressable
            style={[banner.installBtn, { backgroundColor: colors.accent }]}
            onPress={handleInstall}
          >
            <Text style={banner.installBtnText}>{platform === 'ios' ? 'How?' : 'Install'}</Text>
          </Pressable>
        </View>
      </View>

      {/* iOS bottom-sheet guide — near Safari's Share button */}
      {platform === 'ios' && (
        <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
          <Pressable style={banner.sheetOverlay} onPress={() => setShowSheet(false)}>
            <View style={[banner.sheet, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
              {/* Handle */}
              <View style={[banner.handle, { backgroundColor: colors.border }]} />

              <Text style={[banner.sheetTitle, { color: colors.text }]}>Add to Home Screen</Text>
              <Text style={[banner.sheetSub, { color: colors.textMuted }]}>
                Follow these 3 steps in Safari
              </Text>

              {/* Steps */}
              {[
                { icon: 'share-outline' as const, label: 'Tap ••• (bottom right) → Share' },
                { icon: 'add-square-outline' as const, label: 'Tap "Add to Home Screen"' },
                { icon: 'checkmark-circle-outline' as const, label: 'Tap "Add" to confirm' },
              ].map((step, i) => (
                <View key={i} style={[banner.sheetStep, { backgroundColor: colors.background }]}>
                  <View style={[banner.sheetStepNum, { backgroundColor: colors.accent }]}>
                    <Text style={banner.sheetStepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[banner.sheetStepLabel, { color: colors.text, flex: 1 }]}>{step.label}</Text>
                  <Ionicons name={step.icon} size={22} color={colors.accent} />
                </View>
              ))}

              {/* Arrow pointing down toward Safari's share button */}
              <View style={banner.arrowWrap}>
                <Ionicons name="arrow-down" size={20} color={colors.accent} />
                <Text style={[banner.arrowLabel, { color: colors.textMuted }]}>••• menu is down there</Text>
              </View>

              <Pressable
                style={[banner.sheetDismiss, { borderColor: colors.border }]}
                onPress={() => setShowSheet(false)}
              >
                <Text style={[banner.sheetDismissText, { color: colors.text }]}>Got it</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

function RootLayoutInner() {
  const { isDark, colors } = useTheme();
  const [fontsLoaded] = useFonts({ ...Ionicons.font });
  const { width: windowWidth } = useWindowDimensions();

  useEffect(() => { prefetchCategories(); }, []);

  // Keep html/body background in sync with theme so the iOS home indicator
  // gutter (below the viewport) matches the app background, not browser white.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const g = globalThis as any;
    if (!g.document) return;
    g.document.documentElement.style.backgroundColor = colors.background;
    g.document.body.style.backgroundColor = colors.background;
  }, [colors.background]);

  // Show before anything else if running inside WhatsApp / Instagram / etc.
  // Their WKWebView strips getUserMedia, so the whole app is unusable without Safari.
  if (Platform.OS === 'web' && isInAppBrowser()) {
    return (
      <View style={[styles.mobileFull, { backgroundColor: colors.background }]}>
        <InAppBrowserOverlay />
      </View>
    );
  }

  const inner = (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="card-scanner" options={{ animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="card-review" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </>
  );

  if (Platform.OS === 'web') {
    // Mobile: fill the full dynamic viewport — no phone frame
    if (windowWidth < 500) {
      return (
        <View style={[styles.mobileFull, { backgroundColor: colors.background }]}>
          <InstallBanner />
          <View style={{ flex: 1 }}>{inner}</View>
        </View>
      );
    }
    // Desktop: phone-shaped frame centred on a dark background
    return (
      <View style={[styles.webOuter, { backgroundColor: '#050505' }]}>
        <View style={[styles.webPhone, { backgroundColor: colors.background }]}>
          <InstallBanner />
          <View style={{ flex: 1 }}>{inner}</View>
        </View>
      </View>
    );
  }

  return inner;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutInner />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const banner = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingTop: 13, paddingBottom: 10,
  },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  textStack: { flex: 1, gap: 1 },
  textLine1: { fontSize: 11, fontWeight: '400', lineHeight: 14 },
  textLine2: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  installBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, flexShrink: 0 },
  installBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // iOS bottom sheet guide
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12,
    gap: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetSub: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  sheetStep: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 12, padding: 14,
  },
  sheetStepNum: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sheetStepNumText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  sheetStepLabel: { fontSize: 14, fontWeight: '600' },
  arrowWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: 4 },
  arrowLabel: { fontSize: 12 },
  sheetDismiss: {
    borderWidth: 1, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  sheetDismissText: { fontSize: 15, fontWeight: '600' },
});

const styles = StyleSheet.create({
  mobileFull: {
    height: '100dvh' as any,
    overflow: 'hidden' as any,
    flexDirection: 'column',
  },
  webOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh' as any,
  },
  webPhone: {
    width: 390,
    height: 844,
    overflow: 'hidden',
    borderRadius: 40,
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
  },
});
