import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { getBrand, type ApiBrand } from '../../lib/api';
import { getCachedProductImage, subscribeToCache } from '../../lib/unsplash';

function resolveId(raw: string): string {
  if (/^b\d{2,}$/.test(raw)) return raw;
  const match = raw.match(/^b(\d+)$/);
  if (match) return `b${match[1].padStart(2, '0')}`;
  return raw;
}

export default function BrandProductsScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { demoWishlistedIds, toggleWishlistItem } = useAuth();
  const id = resolveId(rawId ?? '');
  const [brand, setBrand] = useState<ApiBrand | null>(null);
  const [wishlisted, setWishlisted] = useState<Set<string>>(() => new Set(demoWishlistedIds));
  const [, forceUpdate] = useState(0);
  const s = makeStyles(colors);

  useEffect(() => subscribeToCache(() => forceUpdate(n => n + 1)), []);

  useEffect(() => {
    if (!id) return;
    getBrand(id).then(setBrand).catch(console.error);
  }, [id]);

  const toggleWishlist = (itemId: string, productName: string, imageUrl: string, material?: string) => {
    const wasWishlisted = wishlisted.has(itemId);
    setWishlisted((prev) => {
      const next = new Set(prev);
      wasWishlisted ? next.delete(itemId) : next.add(itemId);
      return next;
    });
    toggleWishlistItem({
      id: itemId,
      brand_id: id,
      brand_name: brand?.name ?? '',
      product_name: productName,
      image_url: imageUrl,
      material,
    });
  };

  if (!brand) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Loading…</Text>
      </View>
    );
  }

  // Flatten all images from all products for the pinterest grid.
  // Products with no uploaded images get a single category-appropriate fallback entry.
  const allItems: { productId: string; productName: string; imageUrl: string; imgIndex: number; material?: string }[] = [];
  brand.products.forEach((p, pi) => {
    if (p.images.length > 0) {
      p.images.forEach((url, i) => {
        allItems.push({ productId: p.id, productName: p.name, imageUrl: url, imgIndex: i, material: p.material });
      });
    } else {
      allItems.push({ productId: p.id, productName: p.name, imageUrl: getCachedProductImage(brand.category, pi, id), imgIndex: 0, material: p.material });
    }
  });

  // Split into 2 columns for masonry-style layout
  const col1 = allItems.filter((_, i) => i % 2 === 0);
  const col2 = allItems.filter((_, i) => i % 2 === 1);

  const renderItem = (item: typeof allItems[number]) => {
    const itemId = `${item.productId}-${item.imgIndex}`;
    const isWishlisted = wishlisted.has(itemId);
    const height = item.imgIndex % 3 === 0 ? 220 : item.imgIndex % 3 === 1 ? 160 : 190;
    return (
      <Pressable
        key={itemId}
        style={[s.pinterestItem, { backgroundColor: colors.surface }]}
        onPress={() => router.push(`/brand/${id}?product=${item.productId}`)}
      >
        <Image source={{ uri: item.imageUrl }} style={[s.pinterestImg, { height }]} />
        <Pressable
          style={s.heartBtn}
          onPress={() => toggleWishlist(itemId, item.productName, item.imageUrl, item.material)}
        >
          <Ionicons name={isWishlisted ? 'heart' : 'heart-outline'} size={15} color={isWishlisted ? '#FF4444' : '#FFF'} />
        </Pressable>
        <View style={s.itemLabel}>
          <Text style={s.itemLabelText} numberOfLines={1}>{item.productName}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Brand + product count */}
      <View style={s.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[s.pageTitle, { color: colors.text }]}>Products</Text>
          <Text style={[s.pageSub, { color: colors.textSecondary }]}>{brand.name} · {brand.products.length} products</Text>
        </View>
        <Pressable style={[s.viewBrandBtn, { borderColor: colors.gold }]} onPress={() => router.back()}>
          <Text style={[s.viewBrandBtnText, { color: colors.gold }]}>View Brand</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.masonryRow}>
          <View style={s.masonryCol}>{col1.map(renderItem)}</View>
          <View style={s.masonryCol}>{col2.map(renderItem)}</View>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm,
    },
    headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    backBtn: { padding: 4, width: 30 },
    titleRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    },
    pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
    pageSub: { fontSize: FontSize.sm, marginTop: 2 },
    viewBrandBtn: {
      paddingHorizontal: Spacing.md, paddingVertical: 8,
      borderRadius: Radius.md, borderWidth: 1.5,
    },
    viewBrandBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    scroll: { paddingHorizontal: Spacing.sm, paddingBottom: 100 },

    masonryRow: { flexDirection: 'row', gap: Spacing.sm },
    masonryCol: { flex: 1, gap: Spacing.sm },

    pinterestItem: { borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
    pinterestImg: { width: '100%', resizeMode: 'cover' },
    heartBtn: {
      position: 'absolute', top: 8, right: 8,
      backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14, padding: 5,
    },
    itemLabel: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: Spacing.sm, paddingVertical: 6,
    },
    itemLabelText: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  });
}
