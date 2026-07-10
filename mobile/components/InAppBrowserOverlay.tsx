import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getInAppBrowserName, suggestedBrowser, buildRedirectUrl } from '../lib/inAppBrowser';
import { FontSize, FontWeight, Radius, Spacing } from '../constants/theme';

export default function InAppBrowserOverlay() {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const browser = suggestedBrowser();
  const appName = getInAppBrowserName();
  const isIOS = Platform.OS === 'web'
    && typeof navigator !== 'undefined'
    && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const url = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.href : '';

  useEffect(() => {
    const g = globalThis as any;
    const redirectUrl = buildRedirectUrl(url);
    if (redirectUrl && g.window) {
      g.window.location.href = redirectUrl;
    }
    // If the redirect worked, the page will unload. If WhatsApp blocked it,
    // we're still here after 700ms — show the manual fallback overlay.
    const t = setTimeout(() => setShowOverlay(true), 700);
    return () => clearTimeout(t);
  }, []);

  if (!showOverlay) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const handleOpen = async () => {
    const g = globalThis as any;
    // Re-attempt the deep-link redirect on button tap
    const redirectUrl = buildRedirectUrl(url);
    if (redirectUrl && g.window) {
      g.window.location.href = redirectUrl;
      await new Promise((r) => setTimeout(r, 800));
    }
    if (g.window) {
      const opened = g.window.open(url, '_blank');
      if (opened) return;
    }
    // Final fallback — copy so user can paste manually
    if (url) await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.iconWrap, { backgroundColor: colors.accent + '18' }]}>
        <Ionicons name="lock-closed-outline" size={40} color={colors.accent} />
      </View>

      <Text style={[s.title, { color: colors.text }]}>
        Open in {browser} to continue
      </Text>

      <Text style={[s.body, { color: colors.textSecondary }]}>
        {`You opened this link inside ${appName}. Its built-in browser blocks the camera access Connect needs.`}
      </Text>

      <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={handleOpen}>
        <Ionicons
          name={copied ? 'checkmark-outline' : 'open-outline'}
          size={18}
          color="#FFF"
        />
        <Text style={s.btnText}>
          {copied ? 'Link copied!' : `Open in ${browser}`}
        </Text>
      </Pressable>

      <Text style={[s.hint, { color: colors.textMuted }]}>
        {copied
          ? `Paste it in ${browser}'s address bar to continue`
          : isIOS
            ? `Or tap ··· in ${appName} → Open in ${browser}`
            : `Or use ${browser}'s address bar to open the link`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: {
    fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center',
  },
  body: {
    fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: Radius.md, marginTop: Spacing.sm,
    width: '100%', justifyContent: 'center',
  },
  btnText: {
    color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold,
  },
  hint: {
    fontSize: FontSize.xs, textAlign: 'center',
  },
});
