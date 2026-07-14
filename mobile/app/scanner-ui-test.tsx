/**
 * Scanner tab UI options.
 * Primary: card scanner. Secondary: gallery. QR: curiosity pill. How it works: info panel.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { Spacing, FontSize, FontWeight, Radius } from '../constants/theme';

type Variant = 'A' | 'B' | 'C';

// ── Mock camera ───────────────────────────────────────────────────────────────

function MockCamera({ height = 420, children }: { height?: number; children?: React.ReactNode }) {
  return (
    <View style={[mc.wrap, { height }]}>
      <View style={mc.overlay} />
      {children}
    </View>
  );
}

function CardFrame({ color }: { color: string }) {
  const b = { borderColor: color };
  return (
    <View style={[mc.frame, { borderColor: color + '45' }]}>
      <View style={[mc.corner, { top: -2, left: -2, borderBottomWidth: 0, borderRightWidth: 0, ...b }]} />
      <View style={[mc.corner, { top: -2, right: -2, borderBottomWidth: 0, borderLeftWidth: 0, ...b }]} />
      <View style={[mc.corner, { bottom: -2, left: -2, borderTopWidth: 0, borderRightWidth: 0, ...b }]} />
      <View style={[mc.corner, { bottom: -2, right: -2, borderTopWidth: 0, borderLeftWidth: 0, ...b }]} />
    </View>
  );
}

const mc = StyleSheet.create({
  wrap: { width: '100%', backgroundColor: '#111', overflow: 'hidden', position: 'relative' },
  overlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)' },
  frame: { width: 272, height: 168, borderRadius: 10, borderWidth: 1, position: 'relative' },
  corner: { position: 'absolute', width: 22, height: 22, borderWidth: 3 },
});

// ── Processing state ──────────────────────────────────────────────────────────

function ReadingCard({ colors, onDone }: { colors: any; onDone: () => void }) {
  setTimeout(onDone, 1800);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
        Reading the card...
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: FontSize.xs }}>On-device · no data sent</Text>
    </View>
  );
}

// ── QR discovery pill ─────────────────────────────────────────────────────────
// Prominent enough to notice, curious enough to make the user wonder.
// Not a scanner control — it lives below the scanner zone.

function QRDiscovery({ colors }: { colors: any }) {
  return (
    <View style={[qd.pill, { backgroundColor: colors.accent + '10', borderColor: colors.accent + '28' }]}>
      <View style={[qd.iconWrap, { backgroundColor: colors.accent + '1E' }]}>
        <Ionicons name="qr-code-outline" size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[qd.title, { color: colors.text }]}>Skip the card next time</Text>
        <Text style={[qd.sub, { color: colors.textSecondary }]}>
          People on Connect can exchange contacts in seconds with a personal QR
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.accent} />
    </View>
  );
}

const qd = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.lg, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  sub: { fontSize: FontSize.xs, lineHeight: 16 },
});

// ── How it works — info panel ─────────────────────────────────────────────────
// Visually separate from the scanner — looks like an editorial info block,
// not a list of controls. Has its own background zone and info header.

function HowItWorks({ colors }: { colors: any }) {
  return (
    <View style={[hiw.wrap, { backgroundColor: colors.surfaceElevated }]}>
      <View style={hiw.header}>
        <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
        <Text style={[hiw.heading, { color: colors.textMuted }]}>HOW IT WORKS</Text>
      </View>

      <View style={hiw.item}>
        <View style={[hiw.step, { backgroundColor: colors.accent }]}>
          <Text style={hiw.stepNum}>1</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[hiw.title, { color: colors.text }]}>Hold the card in front of your camera</Text>
          <Text style={[hiw.body, { color: colors.textMuted }]}>
            Align it within the frame and tap capture — keep it flat and well-lit.
          </Text>
        </View>
      </View>

      <View style={[hiw.rule, { backgroundColor: colors.border }]} />

      <View style={hiw.item}>
        <View style={[hiw.step, { backgroundColor: colors.accent }]}>
          <Text style={hiw.stepNum}>2</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[hiw.title, { color: colors.text }]}>We read the card for you</Text>
          <Text style={[hiw.body, { color: colors.textMuted }]}>
            Name, phone, email, company — extracted on your device. Nothing leaves your phone.
          </Text>
        </View>
      </View>

      <View style={[hiw.rule, { backgroundColor: colors.border }]} />

      <View style={hiw.item}>
        <View style={[hiw.step, { backgroundColor: colors.accent }]}>
          <Text style={hiw.stepNum}>3</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[hiw.title, { color: colors.text }]}>Review and save</Text>
          <Text style={[hiw.body, { color: colors.textMuted }]}>
            Check what was read, fix anything if needed, then save to your contacts.
          </Text>
        </View>
      </View>
    </View>
  );
}

const hiw = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden', gap: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  heading: { fontSize: 10, fontWeight: FontWeight.semibold, letterSpacing: 1 },
  item: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 12, alignItems: 'flex-start' },
  step: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNum: { color: '#FFF', fontSize: 11, fontWeight: FontWeight.bold },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 2 },
  body: { fontSize: FontSize.xs, lineHeight: 16 },
  rule: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.md + 22 + Spacing.md },
});

// ── Option A ──────────────────────────────────────────────────────────────────
// Full camera. Capture ring + gallery icon inside camera bottom bar.
// QR discovery pill sits in its own padded zone below the camera.
// How it works is a separate info panel further down.

function VariantA({ colors }: { colors: any }) {
  const [reading, setReading] = useState(false);
  if (reading) return <ReadingCard colors={colors} onDone={() => setReading(false)} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <MockCamera height={430}>
        <View style={vA.frameWrap}>
          <Text style={vA.hint}>Hold the card flat within the frame</Text>
          <CardFrame color={colors.accent} />
        </View>
        <View style={vA.bar}>
          <Pressable style={vA.galleryBtn}>
            <Ionicons name="images-outline" size={24} color="rgba(255,255,255,0.85)" />
            <Text style={vA.galleryLabel}>Gallery</Text>
          </Pressable>
          <Pressable style={vA.captureRing} onPress={() => setReading(true)}>
            <View style={[vA.captureDisk, { backgroundColor: colors.accent }]} />
          </Pressable>
          <View style={{ width: 52 }} />
        </View>
      </MockCamera>

      {/* QR discovery — own zone, clearly below scanner */}
      <View style={vA.qrZone}>
        <QRDiscovery colors={colors} />
      </View>

      {/* Info panel — visually separate */}
      <View style={vA.infoZone}>
        <HowItWorks colors={colors} />
      </View>
    </ScrollView>
  );
}

const vA = StyleSheet.create({
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  hint: { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.xs },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 36, paddingBottom: 24 },
  galleryBtn: { alignItems: 'center', gap: 4 },
  galleryLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
  captureRing: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  captureDisk: { width: 56, height: 56, borderRadius: 28 },
  qrZone: { padding: Spacing.lg, paddingBottom: 0 },
  infoZone: { padding: Spacing.lg, paddingBottom: 40 },
});

// ── Option B ──────────────────────────────────────────────────────────────────
// No live camera. Clean intent screen — large button, clear hierarchy.
// QR discovery pill appears between the actions and the info panel.
// How it works is an isolated info block at the bottom.

function VariantB({ colors }: { colors: any }) {
  const [reading, setReading] = useState(false);
  if (reading) return <ReadingCard colors={colors} onDone={() => setReading(false)} />;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
        {/* Card illustration */}
        <View style={[vB.hero, { backgroundColor: colors.surface }]}>
          <View style={[vB.heroCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={{ gap: 7 }}>
              <View style={[vB.line, { backgroundColor: colors.textMuted, width: '55%' }]} />
              <View style={[vB.line, { backgroundColor: colors.border, width: '38%' }]} />
              <View style={[vB.line, { backgroundColor: colors.border, width: '46%', marginTop: 6 }]} />
              <View style={[vB.line, { backgroundColor: colors.border, width: '30%' }]} />
            </View>
          </View>
          <Ionicons name="camera-outline" size={26} color={colors.accent} style={{ position: 'absolute', bottom: 18, right: 22 }} />
        </View>

        {/* Primary */}
        <Pressable style={[vB.primary, { backgroundColor: colors.accent }]} onPress={() => setReading(true)}>
          <Ionicons name="card-outline" size={20} color="#FFF" />
          <Text style={vB.primaryText}>Scan a Visiting Card</Text>
        </Pressable>

        {/* Gallery */}
        <Pressable style={[vB.gallery, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="images-outline" size={18} color={colors.textSecondary} />
          <Text style={[vB.galleryText, { color: colors.text }]}>Import from Gallery</Text>
        </Pressable>
      </View>

      {/* QR discovery — separated from actions above */}
      <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }}>
        <QRDiscovery colors={colors} />
      </View>

      {/* How it works info panel — fully detached */}
      <View style={{ paddingHorizontal: Spacing.lg }}>
        <HowItWorks colors={colors} />
      </View>
    </ScrollView>
  );
}

const vB = StyleSheet.create({
  hero: { borderRadius: Radius.lg, height: 148, alignItems: 'center', justifyContent: 'center' },
  heroCard: { width: 196, height: 118, borderRadius: 10, borderWidth: 1, padding: 18, justifyContent: 'center' },
  line: { height: 8, borderRadius: 4 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 16, borderRadius: Radius.md },
  primaryText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  gallery: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1 },
  galleryText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
});

// ── Option C ──────────────────────────────────────────────────────────────────
// Compact camera shows the card frame context. Capture + gallery below it.
// QR discovery pill in its own zone. How it works as a separate info panel.

function VariantC({ colors }: { colors: any }) {
  const [reading, setReading] = useState(false);
  if (reading) return <ReadingCard colors={colors} onDone={() => setReading(false)} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <MockCamera height={260}>
        <View style={vC.frameWrap}>
          <CardFrame color={colors.accent} />
          <Text style={vC.hint}>Hold the card flat and steady</Text>
        </View>
      </MockCamera>

      <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
        {/* Gallery + capture */}
        <View style={vC.actionRow}>
          <Pressable style={[vC.galleryBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="images-outline" size={21} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={[vC.captureBtn, { backgroundColor: colors.accent }]} onPress={() => setReading(true)}>
            <Ionicons name="camera-outline" size={20} color="#FFF" />
            <Text style={vC.captureBtnText}>Capture Card</Text>
          </Pressable>
        </View>

        {/* QR discovery */}
        <QRDiscovery colors={colors} />
      </View>

      {/* How it works info panel — own zone */}
      <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: 40 }}>
        <HowItWorks colors={colors} />
      </View>
    </ScrollView>
  );
}

const vC = StyleSheet.create({
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.xs },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  captureBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 15, borderRadius: Radius.md },
  captureBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  galleryBtn: { width: 54, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, borderWidth: 1 },
});

// ── Root ──────────────────────────────────────────────────────────────────────

const VARIANTS: { id: Variant; label: string; note: string }[] = [
  { id: 'A', label: 'A', note: 'Full camera · capture ring + gallery inside camera' },
  { id: 'B', label: 'B', note: 'No camera · clean intent screen' },
  { id: 'C', label: 'C', note: 'Compact camera · capture button below' },
];

export default function ScannerUITest() {
  const { colors } = useTheme();
  const [active, setActive] = useState<Variant>('A');

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.title, { color: colors.text }]}>Scanner Options</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={[s.tabBar, { backgroundColor: colors.surface }]}>
        {VARIANTS.map((v) => (
          <Pressable
            key={v.id}
            style={[s.tab, active === v.id && { backgroundColor: colors.accent }]}
            onPress={() => setActive(v.id)}
          >
            <Text style={[s.tabText, { color: active === v.id ? '#FFF' : colors.textMuted }]}>
              Option {v.id}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[s.noteBar, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[s.noteText, { color: colors.textMuted }]}>
          {VARIANTS.find((v) => v.id === active)!.note}
        </Text>
      </View>

      <View style={[s.frame, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={[s.frameHeader, { borderBottomColor: colors.border }]}>
          <Text style={[s.frameTitle, { color: colors.text }]}>Scanner</Text>
        </View>
        {active === 'A' && <VariantA colors={colors} />}
        {active === 'B' && <VariantB colors={colors} />}
        {active === 'C' && <VariantC colors={colors} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm,
  },
  back: { padding: 4 },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  tabBar: { flexDirection: 'row', marginHorizontal: Spacing.lg, borderRadius: Radius.lg, padding: 3, gap: 2 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: Radius.md, alignItems: 'center' },
  tabText: { fontSize: 11, fontWeight: FontWeight.semibold },
  noteBar: { marginHorizontal: Spacing.lg, marginTop: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm },
  noteText: { fontSize: FontSize.xs, textAlign: 'center' },
  frame: { flex: 1, marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing.lg, borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  frameHeader: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  frameTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
