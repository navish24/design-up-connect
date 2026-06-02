import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

const PROFESSIONS = [
  'Architect',
  'Interior Designer',
  'Interior Stylist',
  'Buyer',
  'HNI',
  'Other',
];

export default function ProfileSetupScreen() {
  const { colors } = useTheme();
  const { completeProfile } = useAuth();
  const { phone, countryCode, context } = useLocalSearchParams<{ phone: string; countryCode: string; context?: string }>();
  const s = makeStyles(colors);

  const [fullName, setFullName] = useState('');
  const [profession, setProfession] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [showProfPicker, setShowProfPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Full name is required';
    if (!profession) e.profession = 'Please select your profession';
    if (!company.trim()) e.company = 'Company / firm name is required';
    if (!email.trim()) e.email = 'Email address is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    completeProfile({
      full_name: fullName.trim(),
      profession,
      company_name: company.trim(),
      email: email.trim(),
      phone: `${countryCode ?? '+91'}${phone}`,
    });
    router.replace({ pathname: '/(auth)/success', params: { context: context ?? '' } });
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.headerRow}>
        <Text style={[s.stepChip, { color: colors.textMuted, backgroundColor: colors.surface }]}>New profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[s.heading, { color: colors.text }]}>Create your{'\n'}visiting card</Text>
        <Text style={[s.sub, { color: colors.textSecondary }]}>
          This becomes your digital identity at every Designup event.
        </Text>

        {/* Full Name */}
        <Text style={[s.label, { color: colors.textMuted }]}>FULL NAME *</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.surface, borderColor: errors.fullName ? '#FF4444' : colors.border, color: colors.text }]}
          placeholder="Priya Sharma"
          placeholderTextColor={colors.textMuted}
          value={fullName}
          onChangeText={(v) => { setFullName(v); setErrors((e) => ({ ...e, fullName: '' })); }}
        />
        {errors.fullName ? <Text style={s.error}>{errors.fullName}</Text> : null}

        {/* Profession */}
        <Text style={[s.label, { color: colors.textMuted }]}>PROFESSION *</Text>
        <Pressable
          style={[s.pickerSelector, { backgroundColor: colors.surface, borderColor: errors.profession ? '#FF4444' : showProfPicker ? colors.accent : colors.border }]}
          onPress={() => setShowProfPicker((v) => !v)}
        >
          <Text style={[s.pickerSelectorText, { color: profession ? colors.text : colors.textMuted }]}>
            {profession || 'Select your profession'}
          </Text>
          <Ionicons name={showProfPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </Pressable>
        {showProfPicker && (
          <View style={[s.pickerList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {PROFESSIONS.map((p) => (
              <Pressable
                key={p}
                style={[s.pickerItem, { borderBottomColor: colors.border }]}
                onPress={() => { setProfession(p); setShowProfPicker(false); setErrors((e) => ({ ...e, profession: '' })); }}
              >
                <Text style={[s.pickerItemText, { color: colors.text }]}>{p}</Text>
                {profession === p && <Ionicons name="checkmark" size={14} color={colors.accent} />}
              </Pressable>
            ))}
          </View>
        )}
        {errors.profession ? <Text style={s.error}>{errors.profession}</Text> : null}

        {/* Company */}
        <Text style={[s.label, { color: colors.textMuted }]}>COMPANY / FIRM *</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.surface, borderColor: errors.company ? '#FF4444' : colors.border, color: colors.text }]}
          placeholder="Studio Forma"
          placeholderTextColor={colors.textMuted}
          value={company}
          onChangeText={(v) => { setCompany(v); setErrors((e) => ({ ...e, company: '' })); }}
        />
        {errors.company ? <Text style={s.error}>{errors.company}</Text> : null}

        {/* Email */}
        <Text style={[s.label, { color: colors.textMuted }]}>EMAIL ADDRESS *</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.surface, borderColor: errors.email ? '#FF4444' : colors.border, color: colors.text }]}
          placeholder="priya@studio.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); }}
        />
        {errors.email ? <Text style={s.error}>{errors.email}</Text> : null}

        {/* Phone — read-only */}
        <Text style={[s.label, { color: colors.textMuted }]}>PHONE</Text>
        <View style={[s.readOnly, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[s.readOnlyText, { color: colors.textSecondary }]}>
            {countryCode ?? '+91'} {phone}
          </Text>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
        </View>

        <Pressable style={[s.submitBtn, { backgroundColor: colors.accent }]} onPress={handleSubmit}>
          <Text style={s.submitBtnText}>Create My Profile</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    headerRow: { paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.sm },
    stepChip: {
      alignSelf: 'flex-start', fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
      letterSpacing: 0.5, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full,
    },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 60 },
    heading: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, lineHeight: 40, marginBottom: Spacing.sm, marginTop: Spacing.sm },
    sub: { fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.xl },

    label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.md },
    input: {
      borderWidth: 1, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, height: 52, fontSize: FontSize.md,
    },
    error: { color: '#FF4444', fontSize: FontSize.xs, marginTop: 4 },

    pickerSelector: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 52,
    },
    pickerSelectorText: { fontSize: FontSize.md, flex: 1 },
    pickerList: { borderWidth: 1, borderRadius: Radius.md, marginTop: 4, overflow: 'hidden' },
    pickerItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pickerItemText: { fontSize: FontSize.sm },

    readOnly: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 52,
    },
    readOnlyText: { fontSize: FontSize.md },

    submitBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
      paddingVertical: 16, borderRadius: Radius.md, marginTop: Spacing.xl,
    },
    submitBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  });
}
