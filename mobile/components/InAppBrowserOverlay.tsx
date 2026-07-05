import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getInAppBrowserName, suggestedBrowser } from '../lib/inAppBrowser';
import { FontSize, FontWeight, Radius, Spacing } from '../constants/theme';

export default function InAppBrowserOverlay() {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const browser = suggestedBrowser();
  const appName = getInAppBrowserName();
  const isIOS = Platform.OS === 'web'
    && typeof navigator !== 'undefined'
    && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const url = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.href : '';

  const handleOpen = async () => {
    const g = globalThis as any;
    if (g.window) {
      // Some in-app browsers (Android Chrome Custom Tabs) honour window.open
      const opened = g.window.open(url, '_blank');
      if (opened) return;
    }
    // Blocked (typical on iOS WKWebView) — copy link as fallback
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
          ? `Paste it in ${browser}'s address bar`
          : isIOS
            ? `Or tap ··· in ${appName} → Open in Safari`
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
