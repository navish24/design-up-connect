// All Exhibitions screen — reached from Home "View All"
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { getExhibitions, type ApiExhibition } from '../../lib/api';
import { ALL_EXHIBITIONS } from '../../data/exhibitions';

export default function ExhibitionListScreen() {
  const { colors } = useTheme();
  const { isDemoMode, user } = useAuth();
  const [search, setSearch] = useState('');
  const [exhibitions, setExhibitions] = useState<ApiExhibition[]>([]);
  const s = makeStyles(colors);

  useEffect(() => {
    getExhibitions(isDemoMode, user?.id)
      .then((data) => {
        if (data.length > 0) {
          setExhibitions(data);
        } else {
          // Supabase returned empty — fall back to local data
          setExhibitions(ALL_EXHIBITIONS.map((e) => ({
            id: e.id, name: e.name, tagline: e.tagline, about: e.about,
            start_date: e.start_date, end_date: e.end_date, timings: e.timings,
            venue_name: e.venue_name, venue_address: e.venue_address, city: e.city,
            status: e.status, is_paid: e.is_paid, layout_map_url: e.layout_map_url,
            stats: e.stats, user_registration_status: null, brands: [],
          })));
        }
      })
      .catch(() => {
        setExhibitions(ALL_EXHIBITIONS.map((e) => ({
          id: e.id, name: e.name, tagline: e.tagline, about: e.about,
          start_date: e.start_date, end_date: e.end_date, timings: e.timings,
          venue_name: e.venue_name, venue_address: e.venue_address, city: e.city,
          status: e.status, is_paid: e.is_paid, layout_map_url: e.layout_map_url,
          stats: e.stats, user_registration_status: null, brands: [],
        })));
      });
  }, [isDemoMode, user?.id]);

  const filtered = exhibitions.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.city || '').toLowerCase().includes(search.toLowerCase())
  );

  // Registered first, then unregistered
  const sorted = [...filtered].sort((a, b) => {
    const aReg = a.user_registration_status ? 1 : 0;
    const bReg = b.user_registration_status ? 1 : 0;
    return bReg - aReg;
  });

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={s.searchWrap}>
        <View style={[s.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            placeholder="Search by name or city"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {sorted.map((exh) => (
          <Pressable
            key={exh.id}
            style={[s.card, { backgroundColor: colors.surface }]}
            onPress={() => router.push(`/exhibition/${exh.id}`)}
          >
            <View style={s.cardTop}>
              <Text style={[s.exhName, { color: colors.text }]}>{exh.name}</Text>
              {exh.user_registration_status && (
                <View style={[s.badge, { backgroundColor: colors.accent + '22' }]}>
                  <Text style={[s.badgeText, { color: colors.accent }]}>
                    {exh.user_registration_status === 'checked_in' ? 'Checked In' : 'Registered'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[s.venue, { color: colors.textSecondary }]}>
              {exh.venue_name} · {exh.city}
            </Text>
            <Text style={[s.date, { color: colors.textSecondary }]}>
              {fmt(exh.start_date)} – {fmt(exh.end_date)}
            </Text>
            {exh.stats?.brands && (
              <Text style={[s.brandCount, { color: colors.textMuted }]}>
                {exh.stats.brands}+ brands
              </Text>
            )}
            <View style={s.cardActions}>
              <Pressable
                style={[s.btn, {
                  backgroundColor: exh.user_registration_status ? colors.gold + '15' : 'transparent',
                  borderColor: exh.user_registration_status ? colors.gold : colors.border,
                  borderWidth: 1,
                }]}
                onPress={() => router.push(`/exhibition/${exh.id}`)}
              >
                <Text style={[s.btnText, { color: exh.user_registration_status ? colors.gold : colors.textSecondary }]}>
                  {exh.user_registration_status === 'checked_in'
                    ? 'View Ticket'
                    : exh.user_registration_status === 'registered'
                    ? 'View Ticket'
                    : 'View Details'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'web' ? 14 : 56, paddingBottom: Spacing.sm,
    },
    backBtn: { width: 30, padding: 4 },
    headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    searchWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44,
    },
    searchInput: { flex: 1, fontSize: FontSize.md },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    card: { borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    exhName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flex: 1, marginRight: Spacing.sm },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    venue: { fontSize: FontSize.sm, marginBottom: 2 },
    date: { fontSize: FontSize.sm, marginBottom: 4 },
    brandCount: { fontSize: FontSize.xs, marginBottom: Spacing.md },
    cardActions: { flexDirection: 'row', justifyContent: 'flex-end' },
    btn: { paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
    btnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  });
}
