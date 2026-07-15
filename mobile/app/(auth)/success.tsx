import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Analytics } from '../../lib/analytics';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { isBeta } from '../../lib/betaConfig';

export default function SuccessScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { context } = useLocalSearchParams<{ context?: string }>();
  const s = makeStyles(colors);

  const initials = user?.first_name && user?.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : user?.first_name?.[0]?.toUpperCase() ?? 'U';

  useEffect(() => { Analytics.screenViewed('success'); }, []);

  const handleExplore = () => {
    if (context) {
      router.replace(`/${context}` as any);
    } else {
      router.replace('/(app)');
    }
  };

  return (
    <ScrollView
      style={[s.root, { backgroundColor: colors.background }]}
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Headline */}
      <View style={s.topSection}>
        <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
        <Text style={[s.headline, { color: colors.text }]}>
          {isBeta ? 'Your digital visiting\ncard is ready.' : 'Your discovery pass\nis ready'}
        </Text>
        <Text style={[s.sub, { color: colors.textSecondary }]}>
          {isBeta
            ? 'Share your QR to connect with anyone, instantly.'
            : 'Brands you scan will receive this card'}
        </Text>
      </View>

      {/* Visiting card */}
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
        {/* Card header */}
        <View style={s.cardHeader}>
          <View style={[s.avatar, { backgroundColor: colors.accent + '22' }]}>
            <Text style={[s.avatarText, { color: colors.accent }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardName, { color: colors.text }]}>
              {user?.first_name} {user?.last_name}
            </Text>
            <Text style={[s.cardProfession, { color: colors.accent }]}>{user?.profession}</Text>
            <Text style={[s.cardCompany, { color: colors.textSecondary }]}>{user?.company_name}</Text>
          </View>
        </View>

        <View style={[s.cardDivider, { borderColor: colors.border }]} />

        {/* QR code */}
        <View style={[s.qrWrap, { backgroundColor: colors.background }]}>
          <QRCode
            value={`user:${user?.id ?? 'user-001'}`}
            size={140}
            backgroundColor={colors.background}
            color={colors.text}
          />
        </View>
        <Text style={[s.qrHint, { color: colors.textMuted }]}>
          @{user?.designup_user_id ?? 'visitor'}
        </Text>

        <View style={[s.cardDivider, { borderColor: colors.border }]} />

        {/* Contact fields */}
        <View style={s.cardFields}>
          {user?.email && (
            <View style={s.cardField}>
              <Ionicons name="mail-outline" size={13} color={colors.textMuted} />
              <Text style={[s.cardFieldText, { color: colors.textSecondary }]}>{user.email}</Text>
            </View>
          )}
          {user?.phone && (
            <View style={s.cardField}>
              <Ionicons name="call-outline" size={13} color={colors.textMuted} />
              <Text style={[s.cardFieldText, { color: colors.textSecondary }]}>{user.phone}</Text>
            </View>
          )}
        </View>

        {/* Nudge for incomplete fields */}
        <View style={[s.nudge, { backgroundColor: colors.accent + '12' }]}>
          <Ionicons name="information-circle-outline" size={13} color={colors.accent} />
          <Text style={[s.nudgeText, { color: colors.accent }]}>
            {isBeta
              ? 'Add LinkedIn and Instagram so contacts can follow up.'
              : 'Add your portfolio link and city so brands remember you.'}
          </Text>
        </View>
      </View>

      {/* CTA */}
      <Pressable style={[s.exploreBtn, { backgroundColor: colors.accent }]} onPress={handleExplore}>
        <Text style={s.exploreBtnText}>{isBeta ? 'Continue' : 'Explore'}</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFF" />
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: { paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'web' ? 20 : 72, paddingBottom: 60 },

    topSection: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
    headline: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, textAlign: 'center', lineHeight: 32 },
    sub: { fontSize: FontSize.sm, textAlign: 'center' },

    card: {
      borderRadius: Radius.xl, borderWidth: 1.5,
      padding: Spacing.lg, marginBottom: Spacing.xl,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
    avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    cardName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: 2 },
    cardProfession: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    cardCompany: { fontSize: FontSize.sm, marginTop: 2 },

    cardDivider: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: Spacing.md },

    qrWrap: { alignSelf: 'center', padding: Spacing.md, borderRadius: Radius.lg, marginBottom: Spacing.sm },
    qrHint: { textAlign: 'center', fontSize: FontSize.xs, marginBottom: Spacing.sm },

    cardFields: { gap: Spacing.sm, marginTop: Spacing.sm },
    cardField: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    cardFieldText: { fontSize: FontSize.sm },

    nudge: {
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
      borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.md,
    },
    nudgeText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },

    exploreBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
      paddingVertical: 16, borderRadius: Radius.md,
    },
    exploreBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  });
}
