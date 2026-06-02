import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import { DEFAULT_PRODUCT_IMAGES } from '../constants/categoryImages';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../constants/theme';

export default function WishlistScreen() {
  const { colors } = useTheme();
  const { demoWishlist, toggleWishlistItem } = useAuth();
  const s = makeStyles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        <View style={{ width: 30 }} />
      </View>

      <Text style={[s.pageTitle, { color: colors.text }]}>Wishlist</Text>
      <Text style={[s.pageSub, { color: colors.textSecondary }]}>Products you've saved for later</Text>

      <ScrollView contentContainerStyle={s.scroll}>
        {demoWishlist.length === 0 ? (
          <View style={[s.empty, { backgroundColor: colors.surface }]}>
            <Text style={s.emptyIcon}>❤️</Text>
            <Text style={[s.emptyTitle, { color: colors.text }]}>Nothing wishlisted yet</Text>
            <Text style={[s.emptySub, { color: colors.textSecondary }]}>Tap the heart icon on any product to save it here.</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {demoWishlist.map((item: any) => (
              <Pressable key={item.id} style={[s.card, { backgroundColor: colors.surface }]} onPress={() => router.push(`/brand/${item.brand_id}?product=${item.id}`)}>
                <Image
                  source={{ uri: item.image_url || DEFAULT_PRODUCT_IMAGES[0] }}
                  style={s.img}
                  resizeMode="cover"
                />
                <Pressable style={s.heartBtn} onPress={(e) => { e.stopPropagation(); toggleWishlistItem(item); }}>
                  <Ionicons name="heart" size={16} color="#FF4444" />
                </Pressable>
                <View style={s.cardBody}>
                  <Text style={[s.productName, { color: colors.text }]}>{item.product_name}</Text>
                  <Text style={[s.brandName, { color: colors.accent }]}>{item.brand_name}</Text>
                  {item.material ? <Text style={[s.material, { color: colors.textMuted }]}>{item.material}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm },
    backBtn: { width: 30, padding: 4 },
    headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, paddingHorizontal: Spacing.lg, marginBottom: 4 },
    pageSub: { fontSize: FontSize.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    card: { width: '48%', borderRadius: Radius.lg, overflow: 'hidden' },
    img: { width: '100%', height: 140, resizeMode: 'cover' },
    heartBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 14, padding: 4 },
    cardBody: { padding: Spacing.sm },
    productName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    brandName: { fontSize: FontSize.xs, marginTop: 2 },
    material: { fontSize: FontSize.xs, marginTop: 2 },
    empty: { borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.xl },
    emptyIcon: { fontSize: 36, marginBottom: Spacing.sm },
    emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Spacing.sm },
    emptySub: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  });
}
