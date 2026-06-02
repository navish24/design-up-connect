import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { prefetchCategories } from '../lib/unsplash';

function RootLayoutInner() {
  const { isDark, colors } = useTheme();

  useEffect(() => { prefetchCategories(); }, []);

  const inner = (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
