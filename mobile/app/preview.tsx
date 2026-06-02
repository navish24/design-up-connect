// Temporary preview — 6 catalogue layout options.
// Tap the centre header to cycle A → B → C → D → E → F.
// Delete this file once a layout is chosen.
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Dimensions } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import { ALL_BRANDS } from '../data/brands';

const SCREEN_W = Dimensions.get('window').width;
const PRODUCTS = ALL_BRANDS.find((b) => b.id === 'b01')?.products ?? [];
type Option = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
const ORDER: Option[] = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── Option A: Horizontal list — image left, text right ───────────────────────
function OptionA({ colors }: { colors: any }) {
  const s = StyleSheet.create({
    list: { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
    card: { flexDirection: 'row', borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
    img: { width: 120, height: 120 },
    body: { flex: 1, padding: Spacing.md, justifyContent: 'space-between' },
    name: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text, marginBottom: 2 },
    material: { fontSize: FontSize.xs, color: colors.textMuted, marginBottom: Spacing.sm },
    pill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: '#E8EAE6' },
    pillText: { fontSize: 9, fontWeight: FontWeight.semibold, color: '#6B7280' },
    cta: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.accent, marginTop: Spacing.sm },
  });
  return (
    <View style={s.list}>
      {PRODUCTS.map((p) => (
        <View key={p.id} style={s.card}>
          <Image source={{ uri: p.images[0] }} style={s.img} resizeMode="cover" />
          <View style={s.body}>
            <View>
              <Text style={s.name} numberOfLines={1}>{p.name}</Text>
              <Text style={s.material} numberOfLines={1}>{p.material}</Text>
              {p.customisable ? <View style={s.pill}><Text style={s.pillText}>Customisable</Text></View> : null}
            </View>
            <Text style={s.cta}>View Product →</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Option B: Editorial grid — alternating full-width hero + 2-col pairs ─────
function OptionB({ colors: _colors }: { colors: any }) {
  const s = StyleSheet.create({
    grid: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    fullCard: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#111' },
    fullImg: { width: '100%', height: 240 },
    row: { flexDirection: 'row', gap: Spacing.sm },
    halfCard: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#111', flex: 1 },
    halfImg: { width: '100%', height: 190 },
    overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: 'rgba(0,0,0,0.52)' },
    name: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#FFF' },
    sub: { fontSize: 9, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  });
  const chunks: any[] = [];
  let i = 0;
  while (i < PRODUCTS.length) {
    if (chunks.length % 2 === 0) { chunks.push({ type: 'full', product: PRODUCTS[i] }); i += 1; }
    else { chunks.push({ type: 'pair', a: PRODUCTS[i], b: PRODUCTS[i + 1] }); i += 2; }
  }
  return (
    <View style={s.grid}>
      {chunks.map((chunk, idx) => chunk.type === 'full' ? (
        <View key={idx} style={s.fullCard}>
          <Image source={{ uri: chunk.product.images[0] }} style={s.fullImg} resizeMode="cover" />
          <View style={s.overlay}>
            <Text style={s.name}>{chunk.product.name}</Text>
            <Text style={s.sub}>{chunk.product.material}</Text>
          </View>
        </View>
      ) : (
        <View key={idx} style={s.row}>
          {[chunk.a, chunk.b].filter(Boolean).map((p: any) => (
            <View key={p.id} style={s.halfCard}>
              <Image source={{ uri: p.images[0] }} style={s.halfImg} resizeMode="cover" />
              <View style={s.overlay}><Text style={s.name} numberOfLines={1}>{p.name}</Text></View>
            </View>
          ))}
          {!chunk.b && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

// ─── Option C: 2-col grid, name + material below image (no overlay) ───────────
function OptionC({ colors }: { colors: any }) {
  const cardW = (SCREEN_W - Spacing.lg * 2 - Spacing.sm) / 2;
  const s = StyleSheet.create({
    grid: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    row: { flexDirection: 'row', gap: Spacing.sm },
    card: { width: cardW, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
    img: { width: '100%', height: 190 },
    body: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, gap: 2 },
    name: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text },
    material: { fontSize: 10, color: colors.textMuted },
    heart: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14, padding: 4 },
    pill: { marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: '#E8EAE6' },
    pillText: { fontSize: 9, fontWeight: FontWeight.semibold, color: '#6B7280' },
  });
  const rows: any[][] = [];
  for (let i = 0; i < PRODUCTS.length; i += 2) rows.push(PRODUCTS.slice(i, i + 2));
  return (
    <View style={s.grid}>
      {rows.map((row, ri) => (
        <View key={ri} style={s.row}>
          {row.map((p: any) => (
            <View key={p.id} style={s.card}>
              <View>
                <Image source={{ uri: p.images[0] }} style={s.img} resizeMode="cover" />
                <View style={s.heart}><Ionicons name="heart-outline" size={14} color="#FFF" /></View>
              </View>
              <View style={s.body}>
                <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                <Text style={s.material} numberOfLines={1}>{p.material}</Text>
                {p.customisable ? <View style={s.pill}><Text style={s.pillText}>Customisable</Text></View> : null}
              </View>
            </View>
          ))}
          {row.length === 1 && <View style={{ width: cardW }} />}
        </View>
      ))}
    </View>
  );
}

// ─── Option D: Full-width stacked cards — large image, text below ─────────────
function OptionD({ colors }: { colors: any }) {
  const s = StyleSheet.create({
    list: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
    card: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: colors.surface },
    img: { width: '100%', height: 260 },
    body: { padding: Spacing.md, gap: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    name: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text, flex: 1 },
    heart: { padding: 4 },
    material: { fontSize: FontSize.xs, color: colors.textMuted },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: '#E8EAE6' },
    pillText: { fontSize: 9, fontWeight: FontWeight.semibold, color: '#6B7280' },
    cta: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.accent },
  });
  return (
    <View style={s.list}>
      {PRODUCTS.map((p) => (
        <View key={p.id} style={s.card}>
          <Image source={{ uri: p.images[0] }} style={s.img} resizeMode="cover" />
          <View style={s.body}>
            <View style={s.row}>
              <Text style={s.name} numberOfLines={1}>{p.name}</Text>
              <View style={s.heart}><Ionicons name="heart-outline" size={18} color={colors.textMuted} /></View>
            </View>
            <Text style={s.material}>{p.material}</Text>
            <View style={s.footer}>
              {p.customisable
                ? <View style={s.pill}><Text style={s.pillText}>Customisable</Text></View>
                : <View />}
              <Text style={s.cta}>View Product →</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Option E: 3-column image grid — minimal, Instagram-style ─────────────────
function OptionE({ colors: _colors }: { colors: any }) {
  const cellSize = (SCREEN_W - Spacing.lg * 2 - Spacing.xs * 2) / 3;
  const s = StyleSheet.create({
    grid: { paddingHorizontal: Spacing.lg, gap: Spacing.xs },
    row: { flexDirection: 'row', gap: Spacing.xs },
    cell: { width: cellSize, height: cellSize, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: '#111' },
    img: { width: '100%', height: '100%' },
    overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 5, paddingVertical: 5, backgroundColor: 'rgba(0,0,0,0.48)' },
    name: { fontSize: 9, fontWeight: FontWeight.bold, color: '#FFF' },
  });
  const rows: any[][] = [];
  for (let i = 0; i < PRODUCTS.length; i += 3) rows.push(PRODUCTS.slice(i, i + 3));
  return (
    <View style={s.grid}>
      {rows.map((row, ri) => (
        <View key={ri} style={s.row}>
          {row.map((p: any) => (
            <View key={p.id} style={s.cell}>
              <Image source={{ uri: p.images[0] }} style={s.img} resizeMode="cover" />
              <View style={s.overlay}><Text style={s.name} numberOfLines={1}>{p.name}</Text></View>
            </View>
          ))}
          {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
            <View key={`empty-${i}`} style={{ width: cellSize }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Option F: Spec-sheet list — tiny thumbnail + dense text ─────────────────
function OptionF({ colors }: { colors: any }) {
  const s = StyleSheet.create({
    list: { paddingHorizontal: Spacing.lg, gap: 0 },
    card: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.md },
    divider: { height: 1, backgroundColor: colors.border },
    img: { width: 68, height: 68, borderRadius: Radius.md },
    body: { flex: 1, gap: 2 },
    name: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text },
    row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
    tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: '#E8EAE6' },
    tagText: { fontSize: 9, color: '#6B7280', fontWeight: FontWeight.semibold },
    material: { fontSize: FontSize.xs, color: colors.textMuted },
    dims: { fontSize: FontSize.xs, color: colors.textMuted },
    chevron: { paddingLeft: 4 },
  });
  return (
    <View style={s.list}>
      {PRODUCTS.map((p, idx) => (
        <View key={p.id}>
          {idx > 0 && <View style={s.divider} />}
          <View style={s.card}>
            <Image source={{ uri: p.images[0] }} style={s.img} resizeMode="cover" />
            <View style={s.body}>
              <Text style={s.name} numberOfLines={1}>{p.name}</Text>
              <Text style={s.material} numberOfLines={1}>{p.material}</Text>
              <Text style={s.dims} numberOfLines={1}>{p.dimensions}</Text>
              <View style={s.row}>
                {p.customisable ? <View style={s.tag}><Text style={s.tagText}>Customisable</Text></View> : null}
              </View>
            </View>
            <View style={s.chevron}><Ionicons name="chevron-forward" size={16} color={colors.textMuted} /></View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Main preview shell ───────────────────────────────────────────────────────
const LABELS: Record<Option, string> = {
  A: 'A — Horizontal list (image left, text right)',
  B: 'B — Editorial grid (hero + pairs, dark overlay)',
  C: 'C — 2-col grid, text below image',
  D: 'D — Full-width stacked cards',
  E: 'E — 3-col image grid (minimal)',
  F: 'F — Spec-sheet list (dense text)',
};

export default function CataloguePreview() {
  const { colors } = useTheme();
  const [option, setOption] = useState<Option>('A');
  const cycle = () => setOption((o) => {
    const idx = ORDER.indexOf(o);
    return ORDER[(idx + 1) % ORDER.length];
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm,
      }}>
        <Pressable onPress={() => router.back()} style={{ width: 30, padding: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={cycle} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: colors.accent, letterSpacing: 0.5 }}>
            TAP TO SWITCH  ({ORDER.indexOf(option) + 1}/{ORDER.length})
          </Text>
          <Text style={{ fontSize: FontSize.sm, color: colors.text, fontWeight: FontWeight.semibold, marginTop: 2 }}>
            Option {option}
          </Text>
        </Pressable>
        <View style={{ width: 30 }} />
      </View>

      <View style={{
        marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.sm,
      }}>
        <Text style={{ fontSize: FontSize.xs, color: colors.textMuted, textAlign: 'center' }}>
          {LABELS[option]}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {option === 'A' && <OptionA colors={colors} />}
        {option === 'B' && <OptionB colors={colors} />}
        {option === 'C' && <OptionC colors={colors} />}
        {option === 'D' && <OptionD colors={colors} />}
        {option === 'E' && <OptionE colors={colors} />}
        {option === 'F' && <OptionF colors={colors} />}
      </ScrollView>
    </View>
  );
}
