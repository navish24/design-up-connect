import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Analytics } from '../../lib/analytics';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { setPendingConnectionOpen } from '../../lib/pendingNav';

interface Profile {
  first_name: string;
  last_name: string;
  designation: string | null;
  company_name: string | null;
  city: string | null;
  profile_image_url: string | null;
}

const PWA_URL = 'https://connect-designup.vercel.app';

export default function PublicProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { addDemoConnection } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('profiles')
      .select('first_name, last_name, designation, company_name, city, profile_image_url')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); }
        else { setProfile(data); Analytics.qrLandingViewed(id); }
        setLoading(false);
      });
  }, [id]);

  const addOnConnect = async () => {
    if (!profile || adding || added) return;
    Analytics.addOnConnectTapped(id);
    setAdding(true);
    addDemoConnection({
      id,
      full_name: `${profile.first_name} ${profile.last_name}`.trim(),
      designation: profile.designation ?? '',
      company_name: profile.company_name ?? '',
      city: profile.city ?? '',
    });
    setPendingConnectionOpen(id);
    setAdded(true);
    setAdding(false);
    router.replace('/(app)/connections');
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

        {/* Avatar — photo if available, initials otherwise */}
        {profile.profile_image_url ? (
          <Image source={{ uri: profile.profile_image_url }} style={s.avatarPhoto} />
        ) : (
          <View style={[s.avatar, { backgroundColor: colors.accent + '22' }]}>
            <Text style={[s.avatarText, { color: colors.accent }]}>{initials}</Text>
          </View>
        )}

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

        {/* Primary: add this person to Connect connections */}
        <Pressable
          style={[s.primaryBtn, { backgroundColor: added ? colors.accent + 'AA' : colors.accent }]}
          onPress={addOnConnect}
          disabled={adding || added}
        >
          {adding ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Ionicons name={added ? 'checkmark-circle-outline' : 'person-add-outline'} size={16} color="#FFF" />
          )}
          <Text style={s.primaryBtnText}>
            {added ? 'Added!' : `Add ${profile.first_name} on Connect`}
          </Text>
        </Pressable>

        {/* Secondary: open the PWA for users who don't have it yet */}
        <Text style={[s.downloadHint, { color: colors.textMuted }]}>
          Don't have Connect?{' '}
          <Text
            style={{ color: colors.accent, fontWeight: FontWeight.semibold }}
            onPress={() => { Analytics.getTheAppTapped(); (globalThis as any).window?.open(PWA_URL, '_blank'); }}
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
    avatarPhoto: { width: 72, height: 72, borderRadius: 36, marginBottom: 4 },
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
