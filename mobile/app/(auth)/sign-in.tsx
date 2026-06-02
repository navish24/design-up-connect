import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+1', flag: '🇺🇸', name: 'USA' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
];

export default function SignInScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ context?: string }>();
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const s = makeStyles(colors);

  const validateAndSend = async () => {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      setError('Please enter a valid phone number.');
      return;
    }
    setIsLoading(true);
    // PLACEHOLDER: await supabase.auth.signInWithOtp({ phone: `${countryCode.code}${digits}` });
    await new Promise((r) => setTimeout(r, 700));
    setIsLoading(false);
    router.push({
      pathname: '/(auth)/verify-otp',
      params: { phone: digits, countryCode: countryCode.code, context: params.context ?? '' },
    });
  };

  const isReady = phone.replace(/\D/g, '').length >= 7;

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable style={s.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        <Text style={[s.backText, { color: colors.textSecondary }]}>Back</Text>
      </Pressable>

      <View style={s.content}>
        <Text style={[s.heading, { color: colors.text }]}>Enter your{'\n'}phone number</Text>
        <Text style={[s.sub, { color: colors.textSecondary }]}>
          We'll send you a one-time verification code.
        </Text>

        {/* Phone input */}
        <View style={[s.inputRow, { borderColor: error ? '#FF4444' : colors.border, backgroundColor: colors.surface }]}>
          {/* Country code selector */}
          <Pressable style={s.ccBtn} onPress={() => setShowPicker((v) => !v)}>
            <Text style={s.ccFlag}>{countryCode.flag}</Text>
            <Text style={[s.ccCode, { color: colors.text }]}>{countryCode.code}</Text>
            <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
          </Pressable>
          <View style={[s.divider, { backgroundColor: colors.border }]} />
          <TextInput
            style={[s.input, { color: colors.text }]}
            placeholder="98765 43210"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(v) => { setPhone(v); setError(''); }}
            maxLength={15}
            autoFocus
          />
        </View>

        {/* Country picker dropdown */}
        {showPicker && (
          <View style={[s.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {COUNTRY_CODES.map((cc) => (
              <Pressable
                key={cc.code}
                style={[s.pickerItem, { borderBottomColor: colors.border }]}
                onPress={() => { setCountryCode(cc); setShowPicker(false); }}
              >
                <Text style={s.ccFlag}>{cc.flag}</Text>
                <Text style={[s.pickerName, { color: colors.text }]}>{cc.name}</Text>
                <Text style={[s.pickerCode, { color: colors.textMuted }]}>{cc.code}</Text>
                {countryCode.code === cc.code && (
                  <Ionicons name="checkmark" size={14} color={colors.accent} />
                )}
              </Pressable>
            ))}
          </View>
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable
          style={[s.btn, { backgroundColor: isReady ? colors.accent : colors.surfaceElevated }]}
          onPress={validateAndSend}
          disabled={!isReady || isLoading}
        >
          <Text style={[s.btnText, { color: isReady ? '#FFF' : colors.textMuted }]}>
            {isLoading ? 'Sending OTP…' : 'Send OTP'}
          </Text>
        </Pressable>

        <Text style={[s.terms, { color: colors.textMuted }]}>
          By continuing, you agree to Designup's Terms of Service and Privacy Policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, paddingHorizontal: Spacing.lg },
    back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 60, marginBottom: Spacing.xl },
    backText: { fontSize: FontSize.md },
    content: { flex: 1 },
    heading: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, lineHeight: 40, marginBottom: Spacing.sm },
    sub: { fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.xl },

    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1.5, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, height: 56, marginBottom: Spacing.sm,
    },
    ccBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: Spacing.sm },
    ccFlag: { fontSize: 18 },
    ccCode: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
    divider: { width: 1, height: 22, marginRight: Spacing.md },
    input: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.medium },

    picker: {
      borderWidth: 1, borderRadius: Radius.md, marginBottom: Spacing.sm, overflow: 'hidden',
    },
    pickerItem: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pickerName: { flex: 1, fontSize: FontSize.sm },
    pickerCode: { fontSize: FontSize.sm },

    error: { color: '#FF4444', fontSize: FontSize.sm, marginBottom: Spacing.sm },

    btn: {
      paddingVertical: 16, borderRadius: Radius.md,
      alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.lg,
    },
    btnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    terms: { fontSize: FontSize.xs, lineHeight: 18, textAlign: 'center', paddingHorizontal: Spacing.lg },
  });
}
