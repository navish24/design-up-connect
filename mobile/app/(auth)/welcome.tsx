import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

const VALUE_PROPS = [
  {
    icon: 'card-outline' as const,
    title: 'Visiting Card Scanner',
    text: 'Photograph any card and details are saved automatically',
  },
  {
    icon: 'people-outline' as const,
    title: 'Professional Directory',
    text: 'Every person you meet, organised and searchable',
  },
  {
    icon: 'qr-code-outline' as const,
    title: 'QR Card Exchange',
    text: 'Show your QR, scan theirs — contacts saved in seconds',
  },
];

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  return (
    <View style={s.root}>
      <View style={s.logoArea}>
        <Text style={[s.connect, { color: colors.accent }]}>CONNECT</Text>
        <Text style={[s.tagline, { color: colors.textSecondary }]}>
          Your digital visiting card,{'\n'}always with you
        </Text>
      </View>

      <View style={s.props}>
        {VALUE_PROPS.map((item, i) => (
          <View key={i} style={s.propRow}>
            <View style={[s.propIcon, { backgroundColor: colors.accent + '18' }]}>
              <Ionicons name={item.icon} size={18} color={colors.accent} />
            </View>
            <View style={s.propTextWrap}>
              <Text style={[s.propTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[s.propText, { color: colors.textSecondary }]}>{item.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.ctas}>
        <Pressable
          style={[s.primaryBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.replace('/(auth)/sign-in')}
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
      justifyContent: 'space-between', alignItems: 'stretch',
    },
    logoArea: { alignItems: 'center', gap: 4 },
    brand: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 4, marginBottom: 2 },
    connect: { fontSize: 38, fontWeight: FontWeight.bold, letterSpacing: 6 },
    tagline: { fontSize: FontSize.md, lineHeight: 22, textAlign: 'center', marginTop: Spacing.sm },

    props: { gap: Spacing.lg, width: '100%' },
    propRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, width: '100%' },
    propIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
    propTextWrap: { flex: 1, gap: 2, flexShrink: 1 },
    propTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    propText: { fontSize: FontSize.sm, lineHeight: 20, flexWrap: 'wrap' },

    ctas: { gap: Spacing.md },
    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
      paddingVertical: 16, borderRadius: Radius.md,
    },
    primaryBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    terms: { fontSize: FontSize.xs, textAlign: 'center', lineHeight: 18 },
  });
}
