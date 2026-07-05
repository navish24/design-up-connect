import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useState, useMemo } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../constants/theme';

const BASE_NOTIFS = [
  { id: 'n1', type: 'contact_received', title: 'Priya Sharma received your contact', body: 'Your digital visiting card was shared successfully.', time: '2h ago' },
  { id: 'n2', type: 'exhibition_reminder', title: 'Index Mumbai 2025 starts in 3 days', body: 'Get ready — the exhibition begins on 15 Nov at 10:00 AM.', time: '1d ago' },
  { id: 'n3', type: 'platform_update', title: 'Revisit the brands you saved', body: 'You saved 3 brands at Index Mumbai. Tap to explore them.', time: '2d ago' },
];

const ICON_MAP: Record<string, any> = {
  contact_received: 'person-add-outline',
  exhibition_reminder: 'calendar-outline',
  platform_update: 'megaphone-outline',
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { demoAddedConnections, demoSavedBrands } = useAuth();
  const [readIds, setReadIds] = useState<Set<string>>(new Set(['n3']));
  const s = makeStyles(colors);

  // Build dynamic notifications from demo activity
  const notifs = useMemo(() => {
    const dynamic = [
      ...demoAddedConnections.map((p: any) => ({
        id: `conn-${p.id}`,
        type: 'contact_received',
        title: `You connected with ${p.full_name}`,
        body: `${p.designation} · ${p.company} — tap to view their contact details.`,
        time: 'Just now',
      })),
      ...demoSavedBrands.map((b: any) => ({
        id: `save-${b.brand_id}`,
        type: 'platform_update',
        title: `${b.brand_name} saved`,
        body: `Added to your saves for ${b.exhibition_name}.`,
        time: 'Just now',
      })),
    ];
    return [...dynamic, ...BASE_NOTIFS];
  }, [demoAddedConnections, demoSavedBrands]);

  const markRead = (id: string) => setReadIds((prev) => new Set([...prev, id]));
  const unreadCount = notifs.filter((n) => !readIds.has(n.id)).length;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={s.titleRow}>
        <Text style={[s.pageTitle, { color: colors.text }]}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={[s.badge, { backgroundColor: colors.accent }]}>
            <Text style={s.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {notifs.map((n) => {
          const isRead = readIds.has(n.id);
          return (
            <Pressable
              key={n.id}
              style={[s.card, { backgroundColor: colors.surface, borderLeftColor: isRead ? 'transparent' : colors.accent, borderLeftWidth: isRead ? 0 : 3 }]}
              onPress={() => markRead(n.id)}
            >
              <View style={[s.iconWrap, { backgroundColor: colors.accent + '22' }]}>
                <Ionicons name={ICON_MAP[n.type] ?? 'notifications-outline'} size={18} color={colors.accent} />
              </View>
              <View style={s.textWrap}>
                <Text style={[s.title, { color: colors.text, fontWeight: isRead ? FontWeight.regular : FontWeight.semibold }]}>{n.title}</Text>
                <Text style={[s.body, { color: colors.textSecondary }]}>{n.body}</Text>
                <Text style={[s.time, { color: colors.textMuted }]}>{n.time}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'web' ? 14 : 56, paddingBottom: Spacing.sm },
    backBtn: { width: 30, padding: 4 },
    headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
    pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, minWidth: 22, alignItems: 'center' },
    badgeText: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100, gap: Spacing.sm },
    card: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, alignItems: 'flex-start' },
    iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    textWrap: { flex: 1, gap: 3 },
    title: { fontSize: FontSize.sm },
    body: { fontSize: FontSize.xs, lineHeight: 18 },
    time: { fontSize: FontSize.xs },
  });
}
