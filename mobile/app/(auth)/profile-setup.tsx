import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Analytics } from '../../lib/analytics';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { CountryCodePicker } from '../../components/CountryCodePicker';

const PROFESSIONS = [
  'Interior Designer',
  'Architect',
  'Furniture Designer',
  'Lighting Designer',
  'Product Designer',
  'Studio Owner',
  'Brand Owner',
  'Consultant',
  'Founder',
  'Contractor',
  'Other',
];

export default function ProfileSetupScreen() {
  const { colors } = useTheme();
  const { completeProfile } = useAuth();
  const { email: authEmail, name: authName, context } = useLocalSearchParams<{ email: string; name?: string; context?: string }>();
  const s = makeStyles(colors);

  useEffect(() => { Analytics.screenViewed('profile_setup'); }, []);

  const [fullName, setFullName] = useState(authName ?? '');
  const [profession, setProfession] = useState('');
  const [customProfession, setCustomProfession] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState(authEmail ?? '');
  const [phone, setPhone] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+91');
  const [showProfPicker, setShowProfPicker] = useState(false);
  const [showPhonePicker, setShowPhonePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Full name is required';
    else if (fullName.trim().length > 100) e.fullName = 'Name is too long';
    if (!profession) e.profession = 'Please select your profession';
    if (profession === 'Other' && !customProfession.trim()) e.profession = 'Please describe your profession';
    else if (customProfession.length > 100) e.profession = 'Too long';
    if (company.length > 150) e.company = 'Company name is too long';
    if (!email.trim()) e.email = 'Email address is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address';
    else if (email.length > 254) e.email = 'Email is too long';
    if (!phone.trim()) e.phone = 'Phone number is required';
    else if (phone.replace(/\D/g, '').length < 6) e.phone = 'Enter a valid phone number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const prof = profession === 'Other' ? customProfession.trim() : profession;
    await completeProfile({
      full_name: fullName.trim(),
      profession: prof,
      company_name: company.trim() || '',
      email: email.trim(),
      phone: `${phonePrefix}${phone.trim()}`,
    });
    Analytics.profileSetupCompleted({ profession: prof, company: company.trim(), hasPhone: !!phone.trim() });
    Analytics.identify('', { name: fullName.trim(), email: email.trim(), phone: phone.trim(), profession: prof, company: company.trim() });
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
          This becomes your digital visiting card on Connect. When someone scans your QR, this is what they receive.
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
        {profession === 'Other' && (
          <TextInput
            style={[s.input, { backgroundColor: colors.surface, borderColor: errors.profession ? '#FF4444' : colors.border, color: colors.text, marginTop: 8 }]}
            placeholder="Describe your role"
            placeholderTextColor={colors.textMuted}
            value={customProfession}
            onChangeText={(v) => { setCustomProfession(v); setErrors((e) => ({ ...e, profession: '' })); }}
            autoFocus
          />
        )}
        {errors.profession ? <Text style={s.error}>{errors.profession}</Text> : null}

        {/* Company */}
        <Text style={[s.label, { color: colors.textMuted }]}>COMPANY / FIRM</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Studio or company (optional)"
          placeholderTextColor={colors.textMuted}
          value={company}
          onChangeText={setCompany}
        />

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

        {/* Phone — required */}
        <Text style={[s.label, { color: colors.textMuted }]}>PHONE *</Text>
        <View style={[s.phoneRow, { borderColor: errors.phone ? '#FF4444' : colors.border, backgroundColor: colors.surface }]}>
          <Pressable
            style={[s.prefixBtn, { borderRightColor: colors.border }]}
            onPress={() => setShowPhonePicker(true)}
          >
            <Text style={[s.prefixText, { color: colors.text }]}>{phonePrefix}</Text>
            <Ionicons name="chevron-down" size={11} color={colors.textMuted} />
          </Pressable>
          <TextInput
            style={[s.phoneInput, { color: colors.text }]}
            placeholder="98765 43210"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(v) => { setPhone(v); setErrors((e) => ({ ...e, phone: '' })); }}
          />
        </View>
        {errors.phone ? <Text style={s.errorText}>{errors.phone}</Text> : null}
        <CountryCodePicker
          visible={showPhonePicker}
          selected={phonePrefix}
          onSelect={setPhonePrefix}
          onClose={() => setShowPhonePicker(false)}
          colors={colors}
        />

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
    headerRow: { paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'web' ? 14 : 60, paddingBottom: Spacing.sm },
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
    errorText: { color: '#FF4444', fontSize: FontSize.xs, marginTop: 4 },

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

    phoneRow: {
      flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md, height: 52, overflow: 'hidden',
    },
    prefixBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, borderRightWidth: 1,
    },
    prefixText: { fontSize: 15, fontWeight: '600' },
    phoneInput: { flex: 1, paddingHorizontal: 12, fontSize: FontSize.md },

    submitBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
      paddingVertical: 16, borderRadius: Radius.md, marginTop: Spacing.xl,
    },
    submitBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  });
}
