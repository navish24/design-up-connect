import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { getProject, type ApiBrand, type ApiProject } from '../../lib/api';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const s = makeStyles();
  const [brand, setBrand] = useState<ApiBrand | null>(null);
  const [project, setProject] = useState<ApiProject | null>(null);

  useEffect(() => {
    if (!id) return;
    getProject(id).then((entry) => {
      if (entry) { setBrand(entry.brand); setProject(entry.project); }
    }).catch(console.error);
  }, [id]);

  if (!brand || !project) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={s.notFound}>
          <Text style={[s.notFoundText, { color: colors.textMuted }]}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Hero image */}
        <Image source={{ uri: project.images[0] }} style={s.heroImg} />

        {/* Theme badge */}
        <View style={[s.themeBadge, { backgroundColor: colors.accent + '22' }]}>
          <Text style={[s.themeText, { color: colors.accent }]}>{project.theme}</Text>
        </View>

        {/* Project title + meta */}
        <Text style={[s.projectTitle, { color: colors.text }]}>{project.name}</Text>
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={[s.metaText, { color: colors.textSecondary }]}>{project.city}</Text>
          </View>
          <View style={[s.metaDot, { backgroundColor: colors.border }]} />
          <Pressable style={s.metaItem} onPress={() => router.push(`/brand/${brand.id}`)}>
            <Ionicons name="business-outline" size={14} color={colors.textMuted} />
            <Text style={[s.metaText, { color: colors.accent }]}>{brand.name}</Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={[s.divider, { backgroundColor: colors.border }]} />

        {/* About the project */}
        <Text style={[s.sectionLabel, { color: colors.textMuted }]}>ABOUT THIS PROJECT</Text>
        <Text style={[s.aboutText, { color: colors.textSecondary }]}>{project.about}</Text>

        {/* Details grid */}
        <View style={[s.detailsCard, { backgroundColor: colors.surface }]}>
          <View style={s.detailRow}>
            <Text style={[s.detailLabel, { color: colors.textMuted }]}>City</Text>
            <Text style={[s.detailValue, { color: colors.text }]}>{project.city}</Text>
          </View>
          <View style={[s.detailDivider, { backgroundColor: colors.border }]} />
          <View style={s.detailRow}>
            <Text style={[s.detailLabel, { color: colors.textMuted }]}>Theme</Text>
            <Text style={[s.detailValue, { color: colors.text }]}>{project.theme}</Text>
          </View>
          <View style={[s.detailDivider, { backgroundColor: colors.border }]} />
          <View style={s.detailRow}>
            <Text style={[s.detailLabel, { color: colors.textMuted }]}>Brand</Text>
            <Text style={[s.detailValue, { color: colors.text }]}>{brand.name}</Text>
          </View>
          <View style={[s.detailDivider, { backgroundColor: colors.border }]} />
          <View style={s.detailRow}>
            <Text style={[s.detailLabel, { color: colors.textMuted }]}>Category</Text>
            <Text style={[s.detailValue, { color: colors.text }]}>{brand.category}</Text>
          </View>
        </View>

        {/* Installation images */}
        {project.images.length > 1 && (
          <>
            <Text style={[s.sectionLabel, { color: colors.textMuted }]}>INSTALLATION IMAGES</Text>
            {project.images.slice(1).map((url, i) => (
              <View key={i} style={s.installationImgWrap}>
                <Image source={{ uri: url }} style={s.installationImg} />
              </View>
            ))}
          </>
        )}


      </ScrollView>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'web' ? 14 : 56, paddingBottom: Spacing.sm,
    },
    headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    backBtn: { padding: 4, width: 30 },
    scroll: { paddingBottom: 100 },

    heroImg: { width: '100%', height: 280, resizeMode: 'cover' },

    themeBadge: {
      alignSelf: 'flex-start', marginHorizontal: Spacing.lg, marginTop: Spacing.md,
      paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.full,
    },
    themeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

    projectTitle: {
      fontSize: FontSize.xxl, fontWeight: FontWeight.bold,
      paddingHorizontal: Spacing.lg, marginTop: Spacing.sm, lineHeight: 32,
    },

    metaRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing.md,
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: FontSize.sm },
    metaDot: { width: 4, height: 4, borderRadius: 2 },

    divider: { height: 1, marginHorizontal: Spacing.lg, marginBottom: Spacing.md },

    sectionLabel: {
      fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1,
      paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, marginTop: Spacing.md,
    },

    aboutText: {
      fontSize: FontSize.md, lineHeight: 26,
      paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg,
    },

    detailsCard: {
      marginHorizontal: Spacing.lg, borderRadius: Radius.lg,
      padding: Spacing.lg, marginBottom: Spacing.lg,
    },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm },
    detailLabel: { fontSize: FontSize.sm },
    detailValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textAlign: 'right', flex: 1, marginLeft: Spacing.md },
    detailDivider: { height: 1 },

    installationImgWrap: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.lg, overflow: 'hidden' },
    installationImg: { width: '100%', height: 240, resizeMode: 'cover' },


    notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    notFoundText: { fontSize: FontSize.md },
  });
}
