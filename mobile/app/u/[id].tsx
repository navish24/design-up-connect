import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

interface Profile {
  first_name: string;
  last_name: string;
  designation: string | null;
  company_name: string | null;
  city: string | null;
}

const APP_URL = 'https://connect-designup.vercel.app';

export default function PublicProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('profiles')
      .select('first_name, last_name, designation, company_name, city')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); }
        else { setProfile(data); }
        setLoading(false);
      });
  }, [id]);

  const openInConnect = () => {
    const deepLink = `${APP_URL}/u/${id}`;
    if (Platform.OS === 'web') {
      (globalThis as any).window?.open(deepLink, '_self');
    }
  };

  const s = makeStyles(colors);

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <Ionicons name="person-circle-outline" size={56} color={colors.textMuted} />
        <Text style={[s.notFoundTitle, { color: colors.text }]}>Profile not found</Text>
        <Text style={[s.notFoundSub, { color: colors.textSecondary }]}>
          This link may be outdated or the user no longer exists.
        </Text>
      </View>
    );
  }

  const fullName = `${profile.first_name} ${profile.last_name}`.trim();
  const initials = [profile.first_name?.[0], profile.last_name?.[0]].filter(Boolean).join('').toUpperCase();
  const subtitle = [profile.designation, profile.company_name].filter(Boolean).join(' · ');

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.card, { backgroundColor: colors.surface }]}>

        {/* Avatar */}
        <View style={[s.avatar, { backgroundColor: colors.accent + '22' }]}>
          <Text style={[s.avatarText, { color: colors.accent }]}>{initials}</Text>
        </View>

        <Text style={[s.name, { color: colors.text }]}>{fullName}</Text>
        {subtitle ? <Text style={[s.sub, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        {profile.city ? (
          <View style={s.locationRow}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={[s.location, { color: colors.textMuted }]}>{profile.city}</Text>
          </View>
        ) : null}

        <View style={[s.divider, { backgroundColor: colors.border }]} />

        <Text style={[s.cta, { color: colors.textSecondary }]}>
          Open Connect to save {profile.first_name}'s contact and connect professionally.
        </Text>

        {/* Primary: open in Connect (same URL, app intercepts) */}
        <Pressable style={[s.primaryBtn, { backgroundColor: colors.accent }]} onPress={openInConnect}>
          <Ionicons name="person-add-outline" size={16} color="#FFF" />
          <Text style={s.primaryBtnText}>Add {profile.first_name} on Connect</Text>
        </Pressable>

        {/* Secondary: download prompt */}
        <Text style={[s.downloadHint, { color: colors.textMuted }]}>
          Don't have Connect?{' '}
          <Text
            style={{ color: colors.accent, fontWeight: FontWeight.semibold }}
            onPress={() => (globalThis as any).window?.open('https://designup.in', '_blank')}
          >
            Get the app
          </Text>
        </Text>
      </View>

      <Text style={[s.footer, { color: colors.textMuted }]}>Powered by Designup Connect</Text>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      padding: Spacing.lg, gap: Spacing.md,
    },
    card: {
      width: '100%', maxWidth: 360, borderRadius: Radius.xl,
      padding: Spacing.xl, alignItems: 'center', gap: Spacing.md,
    },
    avatar: {
      width: 72, height: 72, borderRadius: 36,
      alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    avatarText: { fontSize: 26, fontWeight: FontWeight.bold },
    name: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, textAlign: 'center' },
    sub: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    location: { fontSize: FontSize.xs },
    divider: { width: '100%', height: StyleSheet.hairlineWidth, marginVertical: 4 },
    cta: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingVertical: 14, paddingHorizontal: Spacing.xl,
      borderRadius: Radius.md, width: '100%', justifyContent: 'center',
    },
    primaryBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    downloadHint: { fontSize: FontSize.xs, textAlign: 'center' },
    notFoundTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginTop: Spacing.md },
    notFoundSub: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    footer: { fontSize: 10, marginTop: Spacing.md },
  });
}
