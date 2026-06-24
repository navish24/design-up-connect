import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, StyleSheet, LogBox } from 'react-native';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { prefetchCategories } from '../lib/unsplash';
import { isBeta } from '../lib/betaConfig';

// Suppress expected dev-only log messages that appear as yellow warnings
// in the LogBox banner. These are informational — not real errors.
LogBox.ignoreLogs([
  '[getBrand]',
  '[getNewBrands]',
  '[showDataService]',
]);

function RootLayoutInner() {
  const { isDark, colors } = useTheme();

  useEffect(() => { prefetchCategories(); }, []);

  const inner = (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isBeta && (
        <View style={styles.betaBanner}>
          <Text style={styles.betaBannerText}>β  BETA BUILD</Text>
        </View>
      )}
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );

  // On web: show a phone-shaped frame centred on the page
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webOuter, { backgroundColor: '#050505' }]}>
        <View style={[styles.webPhone, { backgroundColor: colors.background }]}>
          {inner}
        </View>
      </View>
    );
  }

  return inner;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  betaBanner: {
    backgroundColor: '#B45309',
    alignItems: 'center',
    paddingVertical: 3,
  },
  betaBannerText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
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
    // phone-like shadow
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
  },
});
