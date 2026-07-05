import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  TextInput, Modal, Platform,
} from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import type { SavedBrand } from '../../types';
import { getCachedCover, subscribeToCache } from '../../lib/unsplash';

type SortOption = 'latest' | 'oldest' | 'name_az';

export default function SavedScreen() {
  const { colors } = useTheme();
  const { demoSavedReset, demoSavedBrands } = useAuth();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('latest');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [exhibitionFilter, setExhibitionFilter] = useState<string | null>(null);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showExhibitionSheet, setShowExhibitionSheet] = useState(false);
  const [, forceUpdate] = useState(0);
  const s = makeStyles(colors);

  useEffect(() => subscribeToCache(() => forceUpdate(n => n + 1)), []);

  const allBrands = useMemo<SavedBrand[]>(() => {
    if (demoSavedReset) return [];
    return demoSavedBrands as SavedBrand[];
  }, [demoSavedReset, demoSavedBrands]);

  const categories = useMemo(() => {
    return [...new Set(allBrands.map((b) => b.brand_category))].sort();
  }, [allBrands]);

  const exhibitions = useMemo(() => {
    const map = new Map<string, string>();
    allBrands.forEach((b) => {
      if (b.exhibition_id && b.exhibition_name) map.set(b.exhibition_id, b.exhibition_name);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [allBrands]);

  const filtered = useMemo(() => {
    let list = [...allBrands];

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.brand_name.toLowerCase().includes(q) ||
          b.brand_category.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (categoryFilter) list = list.filter((b) => b.brand_category === categoryFilter);

    // Exhibition filter
    if (exhibitionFilter) list = list.filter((b) => b.exhibition_id === exhibitionFilter);

    // Sort
    if (sort === 'latest') list.sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime());
    else if (sort === 'oldest') list.sort((a, b) => new Date(a.saved_at).getTime() - new Date(b.saved_at).getTime());
    else if (sort === 'name_az') list.sort((a, b) => a.brand_name.localeCompare(b.brand_name));

    return list;
  }, [allBrands, search, sort, categoryFilter, exhibitionFilter]);

  const hasFilters = !!categoryFilter || !!exhibitionFilter || sort !== 'latest';

  const SORT_LABELS: Record<SortOption, string> = {
    latest: 'Latest saved',
    oldest: 'Oldest saved',
    name_az: 'Brand name A–Z',
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Top controls — single block so flex column only has 2 children */}
      <View style={s.topBlock}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Saved Brands</Text>

        <View style={[s.searchRow, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: Spacing.md }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            placeholder="Search brand or category"
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.filterScroll}
          contentContainerStyle={s.filterBar}
        >
        {/* Sort */}
        <Pressable
          style={[s.filterChip, sort !== 'latest' && { backgroundColor: colors.accent + '18', borderColor: colors.accent }]}
          onPress={() => setShowSortSheet(true)}
        >
          <Ionicons name="swap-vertical-outline" size={13} color={sort !== 'latest' ? colors.accent : colors.textSecondary} />
          <Text style={[s.filterChipText, { color: sort !== 'latest' ? colors.accent : colors.textSecondary }]}>
            {sort !== 'latest' ? SORT_LABELS[sort] : 'Sort'}
          </Text>
          <Ionicons name="chevron-down" size={11} color={sort !== 'latest' ? colors.accent : colors.textMuted} />
        </Pressable>

        {/* Category */}
        <Pressable
          style={[s.filterChip, !!categoryFilter && { backgroundColor: colors.accent + '18', borderColor: colors.accent }]}
          onPress={() => setShowCategorySheet(true)}
        >
          <Ionicons name="grid-outline" size={13} color={categoryFilter ? colors.accent : colors.textSecondary} />
          <Text style={[s.filterChipText, { color: categoryFilter ? colors.accent : colors.textSecondary }]}>
            {categoryFilter ?? 'Category'}
          </Text>
          <Ionicons name="chevron-down" size={11} color={categoryFilter ? colors.accent : colors.textMuted} />
        </Pressable>

        {/* Exhibition */}
        <Pressable
          style={[s.filterChip, !!exhibitionFilter && { backgroundColor: colors.accent + '18', borderColor: colors.accent }]}
          onPress={() => setShowExhibitionSheet(true)}
        >
          <Ionicons name="business-outline" size={13} color={exhibitionFilter ? colors.accent : colors.textSecondary} />
          <Text style={[s.filterChipText, { color: exhibitionFilter ? colors.accent : colors.textSecondary }]}>
            {exhibitionFilter ? (exhibitions.find((e) => e.id === exhibitionFilter)?.name ?? 'Event') : 'Event'}
          </Text>
          <Ionicons name="chevron-down" size={11} color={exhibitionFilter ? colors.accent : colors.textMuted} />
        </Pressable>

        {/* Clear filters */}
        {hasFilters && (
          <Pressable
            style={[s.filterChip, { borderColor: colors.border }]}
            onPress={() => { setSort('latest'); setCategoryFilter(null); setExhibitionFilter(null); }}
          >
            <Ionicons name="close" size={13} color={colors.textMuted} />
            <Text style={[s.filterChipText, { color: colors.textMuted }]}>Clear</Text>
          </Pressable>
        )}
        </ScrollView>
      </View>

      {/* Brand list */}
      <ScrollView style={s.brandList} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {filtered.length === 0 ? (
          <View style={[s.emptyState, { backgroundColor: colors.surface }]}>
            <Text style={s.emptyIcon}>🔖</Text>
            <Text style={[s.emptyTitle, { color: colors.text }]}>
              {allBrands.length === 0 ? 'No saved brands yet' : 'No brands match filters'}
            </Text>
            <Text style={[s.emptyBody, { color: colors.textSecondary }]}>
              {allBrands.length === 0
                ? 'Scan booth QR codes at exhibitions to save brands here.'
                : 'Try adjusting your filters or search term.'}
            </Text>
          </View>
        ) : (
          filtered.map((brand) => (
            <BrandCard key={brand.id} brand={brand} colors={colors} />
          ))
        )}
      </ScrollView>

      {/* ── Sort Sheet ─────────────────────────────────────────────────── */}
      <Modal visible={showSortSheet} transparent animationType="slide">
        <Pressable style={s.sheetOverlay} onPress={() => setShowSortSheet(false)}>
          <View style={[s.sheet, { backgroundColor: colors.surface }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.text }]}>Sort by</Text>
            {(['latest', 'oldest', 'name_az'] as SortOption[]).map((opt) => (
              <Pressable
                key={opt}
                style={[s.sheetOption, sort === opt && { backgroundColor: colors.accent + '12' }]}
                onPress={() => { setSort(opt); setShowSortSheet(false); }}
              >
                <Text style={[s.sheetOptionText, { color: sort === opt ? colors.accent : colors.text }]}>
                  {SORT_LABELS[opt]}
                </Text>
                {sort === opt && <Ionicons name="checkmark" size={16} color={colors.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Category Sheet ─────────────────────────────────────────────── */}
      <Modal visible={showCategorySheet} transparent animationType="slide">
        <Pressable style={s.sheetOverlay} onPress={() => setShowCategorySheet(false)}>
          <View style={[s.sheet, { backgroundColor: colors.surface }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.text }]}>Filter by category</Text>
            <Pressable
              style={[s.sheetOption, !categoryFilter && { backgroundColor: colors.accent + '12' }]}
              onPress={() => { setCategoryFilter(null); setShowCategorySheet(false); }}
            >
              <Text style={[s.sheetOptionText, { color: !categoryFilter ? colors.accent : colors.text }]}>All categories</Text>
              {!categoryFilter && <Ionicons name="checkmark" size={16} color={colors.accent} />}
            </Pressable>
            {categories.map((cat) => (
              <Pressable
                key={cat}
                style={[s.sheetOption, categoryFilter === cat && { backgroundColor: colors.accent + '12' }]}
                onPress={() => { setCategoryFilter(cat); setShowCategorySheet(false); }}
              >
                <Text style={[s.sheetOptionText, { color: categoryFilter === cat ? colors.accent : colors.text }]}>{cat}</Text>
                {categoryFilter === cat && <Ionicons name="checkmark" size={16} color={colors.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Exhibition Sheet ────────────────────────────────────────────── */}
      <Modal visible={showExhibitionSheet} transparent animationType="slide">
        <Pressable style={s.sheetOverlay} onPress={() => setShowExhibitionSheet(false)}>
          <View style={[s.sheet, { backgroundColor: colors.surface }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.text }]}>Filter by event</Text>
            <Pressable
              style={[s.sheetOption, !exhibitionFilter && { backgroundColor: colors.accent + '12' }]}
              onPress={() => { setExhibitionFilter(null); setShowExhibitionSheet(false); }}
            >
              <Text style={[s.sheetOptionText, { color: !exhibitionFilter ? colors.accent : colors.text }]}>All exhibitions</Text>
              {!exhibitionFilter && <Ionicons name="checkmark" size={16} color={colors.accent} />}
            </Pressable>
            {exhibitions.map((exh) => (
              <Pressable
                key={exh.id}
                style={[s.sheetOption, exhibitionFilter === exh.id && { backgroundColor: colors.accent + '12' }]}
                onPress={() => { setExhibitionFilter(exh.id); setShowExhibitionSheet(false); }}
              >
                <Text style={[s.sheetOptionText, { color: exhibitionFilter === exh.id ? colors.accent : colors.text }]}>{exh.name}</Text>
                {exhibitionFilter === exh.id && <Ionicons name="checkmark" size={16} color={colors.accent} />}
              </Pressable>
            ))}
            <Pressable
              style={[s.sheetOption, exhibitionFilter === 'showroom' && { backgroundColor: colors.accent + '12' }]}
              onPress={() => { setExhibitionFilter('showroom'); setShowExhibitionSheet(false); }}
            >
              <Text style={[s.sheetOptionText, { color: exhibitionFilter === 'showroom' ? colors.accent : colors.text }]}>Showroom Visits</Text>
              {exhibitionFilter === 'showroom' && <Ionicons name="checkmark" size={16} color={colors.accent} />}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Brand Card ─────────────────────────────────────────────────────────────────
function BrandCard({ brand, colors }: { brand: SavedBrand; colors: any }) {
  const s = makeStyles(colors);
  const contextLabel = brand.exhibition_name
    ? brand.exhibition_name
    : `Showroom Visit · ${new Date(brand.saved_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;

  return (
    <Pressable
      style={[s.brandCard, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/brand/${brand.brand_id}`)}
    >
      <Image
        source={{ uri: brand.product_image_url || getCachedCover(brand.brand_category, brand.brand_id) }}
        style={s.brandThumb}
        resizeMode="cover"
      />
      <View style={s.brandCardBody}>
        <View style={s.brandCardTop}>
          <Text style={[s.brandName, { color: colors.text }]}>{brand.brand_name}</Text>
          <View style={[s.brandCategoryPill, { backgroundColor: '#E8EAE6' }]}>
            <Text style={[s.brandCategory, { color: '#6B7280' }]}>{brand.brand_category}</Text>
          </View>
        </View>
        {brand.brand_tagline && (
          <Text style={[s.brandTagline, { color: colors.textSecondary }]} numberOfLines={2}>
            {brand.brand_tagline}
          </Text>
        )}
        <View style={[s.contextPill, { backgroundColor: colors.background }]}>
          <Ionicons name="location-outline" size={10} color={colors.textMuted} />
          <Text style={[s.contextPillText, { color: colors.textMuted }]} numberOfLines={1}>
            {contextLabel}
          </Text>
        </View>
        <Text style={[s.viewDetailsCta, { color: colors.accent }]}>View Brand →</Text>
      </View>
    </Pressable>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    // Single top block — title + search + filters all in one View
    topBlock: { paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'web' ? 14 : 56, paddingBottom: Spacing.md },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    headerCount: { fontSize: FontSize.sm },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderWidth: 1, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, height: 44, marginTop: Spacing.md,
    },
    searchInput: { flex: 1, fontSize: FontSize.md },

    // Filter — fixed height = chip height, negative margin breaks out of topBlock horizontal padding
    filterScroll: { height: 32, marginTop: Spacing.md, marginHorizontal: -Spacing.lg },
    filterBar: {
      paddingHorizontal: Spacing.lg, gap: Spacing.sm,
      flexDirection: 'row', alignItems: 'center',
    },
    filterChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1, borderColor: colors.border, borderRadius: Radius.full,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    filterChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },

    brandList: { flex: 1 },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: Spacing.md },
    filterDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing.lg },

    // Brand card
    brandCard: {
      borderRadius: Radius.lg, marginBottom: Spacing.sm, overflow: 'hidden',
    },
    brandThumb: { width: '100%', height: 200 },
    brandThumbPlaceholder: { width: '100%', height: 200, alignItems: 'center', justifyContent: 'center' },
    brandThumbInitial: { fontSize: 48, fontWeight: FontWeight.bold },
    brandCardBody: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: 6 },
    brandCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    brandName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flex: 1 },
    brandCategoryPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
    brandCategory: { fontSize: 10, fontWeight: FontWeight.semibold },
    brandTagline: { fontSize: FontSize.xs, lineHeight: 16 },
    contextPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: Radius.full, marginTop: Spacing.xs,
    },
    contextPillText: { fontSize: 10 },
    viewDetailsCta: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: 2 },

    // Bottom sheets
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
    sheet: {
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 40,
      width: '100%', ...(Platform.OS === 'web' ? { maxWidth: 430 } : {}),
    },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
    sheetTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Spacing.sm },
    sheetOption: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, paddingHorizontal: Spacing.sm,
      borderRadius: Radius.md,
    },
    sheetOptionText: { fontSize: FontSize.md },

    // Empty state
    emptyState: { borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.xl },
    emptyIcon: { fontSize: 36, marginBottom: Spacing.sm },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.sm },
    emptyBody: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  });
}
