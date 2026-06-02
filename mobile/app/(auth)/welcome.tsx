import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

const VALUE_PROPS = [
  { icon: 'scan-outline' as const, text: 'Scan booth QR codes to save brands instantly' },
  { icon: 'bookmark-outline' as const, text: 'Revisit every discovery after the show' },
  { icon: 'people-outline' as const, text: 'Exchange digital visiting cards with professionals' },
];

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  return (
    <View style={s.root}>
      <View style={s.logoArea}>
        <Text style={[s.wordmark, { color: colors.text }]}>DESIGNUP</Text>
        <Text style={[s.connect, { color: colors.accent }]}>CONNECT</Text>
        <Text style={[s.tagline, { color: colors.textMuted }]}>Scan · Save · Revisit · Connect</Text>
      </View>

      <View style={s.props}>
        {VALUE_PROPS.map((item, i) => (
          <View key={i} style={s.propRow}>
            <View style={[s.propIcon, { backgroundColor: colors.accent + '18' }]}>
              <Ionicons name={item.icon} size={18} color={colors.accent} />
            </View>
            <Text style={[s.propText, { color: colors.textSecondary }]}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={s.ctas}>
        <Pressable
          style={[s.primaryBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text style={s.primaryBtnText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </Pressable>
        <Text style={[s.terms, { color: colors.textMuted }]}>
          By continuing you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: {
      flex: 1, backgroundColor: colors.background,
      paddingHorizontal: Spacing.lg, paddingTop: 80, paddingBottom: 48,
      justifyContent: 'space-between',
    },
    logoArea: { alignItems: 'center', gap: 4 },
    wordmark: { fontSize: 34, fontWeight: FontWeight.bold, letterSpacing: 6 },
    connect: { fontSize: 34, fontWeight: FontWeight.bold, letterSpacing: 6 },
    tagline: { fontSize: FontSize.xs, letterSpacing: 2, marginTop: Spacing.sm },

    props: { gap: Spacing.lg },
    propRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    propIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    propText: { flex: 1, fontSize: FontSize.md, lineHeight: 22 },

    ctas: { gap: Spacing.md },
    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
      paddingVertical: 16, borderRadius: Radius.md,
    },
    primaryBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    terms: { fontSize: FontSize.xs, textAlign: 'center', lineHeight: 18 },
  });
}
