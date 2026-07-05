// All Brands screen — reached from Home "New on Designup → View All"
import { View, Text, StyleSheet, ScrollView, Pressable, Image, TextInput, ActivityIndicator, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { getNewBrands, type NewBrand } from '../../lib/api';
import { ALL_BRANDS } from '../../data/brands';
import { getCachedCover, subscribeToCache } from '../../lib/unsplash';

const FALLBACK_BRANDS: NewBrand[] = ALL_BRANDS.map((b) => ({
  id: b.id,
  name: b.name,
  category: b.category,
  logo: b.logo_initial,
  image_url: b.products?.[0]?.images?.[0] ?? null,
}));

export default function BrandsListScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [brands, setBrands] = useState<NewBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [, forceUpdate] = useState(0);
  const s = makeStyles(colors);

  useEffect(() => subscribeToCache(() => forceUpdate(n => n + 1)), []);

  useEffect(() => {
    getNewBrands()
      .then((data) => {
        setBrands(data.length > 0 ? data : FALLBACK_BRANDS);
      })
      .catch(() => setBrands(FALLBACK_BRANDS))
      .finally(() => setLoading(false));
  }, []);

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Brands on Designup</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <View style={[s.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            placeholder="Search by name or category"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {filtered.map((brand) => (
            <Pressable
              key={brand.id}
              style={[s.brandCard, { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/brand/${brand.id}`)}
            >
              <Image
                source={{ uri: brand.image_url ?? getCachedCover(brand.category, brand.id) }}
                style={s.brandThumb}
                resizeMode="cover"
              />
              <View style={s.brandCardBody}>
                <View style={s.brandCardTop}>
                  <Text style={[s.brandName, { color: colors.text }]} numberOfLines={1}>{brand.name}</Text>
                  <View style={[s.brandCategoryPill, { backgroundColor: '#E8EAE6' }]}>
                    <Text style={[s.brandCategory, { color: '#6B7280' }]}>{brand.category}</Text>
                  </View>
                </View>
                <Text style={[s.viewCta, { color: colors.accent }]}>View Brand →</Text>
              </View>
            </Pressable>
          ))}
          {filtered.length === 0 && (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: colors.textMuted }]}>No brands match "{search}"</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
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
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    brandCard: { borderRadius: Radius.lg, marginBottom: Spacing.sm, overflow: 'hidden' },
    brandThumb: { width: '100%', height: 200 },
    brandCardBody: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: 6 },
    brandCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    brandName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flex: 1 },
    brandCategoryPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
    brandCategory: { fontSize: 10, fontWeight: FontWeight.semibold },
    viewCta: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    empty: { alignItems: 'center', paddingVertical: Spacing.xl },
    emptyText: { fontSize: FontSize.sm },
  });
}
