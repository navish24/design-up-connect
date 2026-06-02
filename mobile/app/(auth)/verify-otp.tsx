import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

// Simulated "existing user" phone numbers for demo branch logic
const RETURNING_USERS = ['9999999999'];

export default function VerifyOTPScreen() {
  const { colors } = useTheme();
  const { setProfileComplete } = useAuth();
  const { phone, countryCode, context } = useLocalSearchParams<{ phone: string; countryCode: string; context?: string }>();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputs = useRef<(TextInput | null)[]>([]);
  const s = makeStyles(colors);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const maskedPhone = phone
    ? `${countryCode ?? '+91'} ${'•'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`
    : '';

  const handleChange = (val: string, idx: number) => {
    setError('');
    const digits = [...otp];
    digits[idx] = val.replace(/\D/g, '').slice(-1);
    setOtp(digits);
    if (val && idx < 5) {
      inputs.current[idx + 1]?.focus();
    }
    if (idx === 5 && val) {
      const code = [...digits.slice(0, 5), val.replace(/\D/g, '').slice(-1)].join('');
      if (code.length === 6) submitOtp(code);
    }
  };

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const submitOtp = async (code: string) => {
    setIsLoading(true);
    setError('');
    await new Promise((r) => setTimeout(r, 700));

    if (code !== '123456' && code !== '000000') {
      setIsLoading(false);
      setError('Incorrect code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      return;
    }

    setIsLoading(false);
    const isReturning = RETURNING_USERS.includes(phone ?? '');
    if (isReturning) {
      router.replace(context ? `/${context}` : '/(app)');
    } else {
      router.push({ pathname: '/(auth)/profile-setup', params: { phone, countryCode, context: context ?? '' } });
    }
  };

  const handleResend = () => {
    if (countdown > 0) return;
    setCountdown(30);
    setError('');
    setOtp(['', '', '', '', '', '']);
    inputs.current[0]?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Back */}
      <Pressable style={s.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        <Text style={[s.backText, { color: colors.textSecondary }]}>Back</Text>
      </Pressable>

      {/* Content — centred in remaining space */}
      <View style={s.body}>
        <Text style={[s.heading, { color: colors.text }]}>Enter the code</Text>
        <Text style={[s.sub, { color: colors.textSecondary }]}>
          Sent to{' '}
          <Text style={{ color: colors.text, fontWeight: FontWeight.semibold }}>{maskedPhone}</Text>
        </Text>

        {/* OTP boxes */}
        <View style={s.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputs.current[i] = r; }}
              style={[
                s.otpBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: error ? '#FF4444' : digit ? colors.accent : colors.border,
                  color: colors.text,
                },
              ]}
              value={digit}
              onChangeText={(v) => handleChange(v, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              autoFocus={i === 0}
            />
          ))}
        </View>

        {/* Status */}
        {isLoading && (
          <Text style={[s.statusText, { color: colors.textMuted }]}>Verifying…</Text>
        )}
        {!!error && <Text style={s.error}>{error}</Text>}

        {/* Resend */}
        <View style={s.resendRow}>
          <Text style={[s.resendLabel, { color: colors.textMuted }]}>Didn't receive it? </Text>
          <Pressable onPress={handleResend} disabled={countdown > 0}>
            <Text style={[s.resendBtn, { color: countdown > 0 ? colors.textMuted : colors.gold }]}>
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
            </Text>
          </Pressable>
        </View>

        <Text style={[s.hint, { color: colors.textMuted }]}>
          Demo: enter 123456 to continue
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, paddingHorizontal: Spacing.lg },
    back: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      marginTop: 60, marginBottom: Spacing.xl,
    },
    backText: { fontSize: FontSize.md },

    body: {
      flex: 1,
      justifyContent: 'center',
      paddingBottom: 80, // offset slightly above center to feel natural
    },

    heading: {
      fontSize: FontSize.xxxl, fontWeight: FontWeight.bold,
      lineHeight: 40, marginBottom: Spacing.sm,
    },
    sub: { fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.xl },

    otpRow: {
      flexDirection: 'row', gap: 8, marginBottom: Spacing.lg,
      justifyContent: 'center',
    },
    otpBox: {
      width: 44, height: 52, borderRadius: Radius.md, borderWidth: 1.5,
      textAlign: 'center', fontSize: FontSize.xl, fontWeight: FontWeight.bold,
    },

    statusText: { fontSize: FontSize.sm, textAlign: 'center', marginBottom: Spacing.sm },
    error: { color: '#FF4444', fontSize: FontSize.sm, textAlign: 'center', marginBottom: Spacing.sm },

    resendRow: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
      marginTop: Spacing.sm,
    },
    resendLabel: { fontSize: FontSize.sm },
    resendBtn: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

    hint: { fontSize: FontSize.xs, textAlign: 'center', marginTop: Spacing.xl },
  });
}
