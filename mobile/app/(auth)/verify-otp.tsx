import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { Analytics } from '../../lib/analytics';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

export default function VerifyOTPScreen() {
  const { colors } = useTheme();
  const { email, context } = useLocalSearchParams<{ email: string; context?: string }>();
  const { top: topInset } = useSafeAreaInsets();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [resendSent, setResendSent] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);
  const s = makeStyles(colors);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const maskedEmail = email
    ? (() => {
        const [local, domain] = email.split('@');
        return `${local.slice(0, 2)}${'•'.repeat(Math.max(2, local.length - 2))}@${domain}`;
      })()
    : '';

  const handleChange = (val: string, idx: number) => {
    setError('');
    const digits = [...otp];
    digits[idx] = val.replace(/\D/g, '').slice(-1);
    setOtp(digits);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
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
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    setIsLoading(false);
    if (verifyError) {
      setError('Incorrect code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', data.user!.id)
      .single();
    const isNewUser = !profile?.first_name;
    Analytics.signInCompleted('email', isNewUser);
    Analytics.identify(data.user!.id, { email });
    if (!isNewUser) {
      router.replace(context ? `/${context}` : '/(app)');
    } else {
      router.push({ pathname: '/(auth)/profile-setup', params: { email, context: context ?? '' } });
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setCountdown(60);
    setError('');
    setResendSent(false);
    setOtp(['', '', '', '', '', '']);
    inputs.current[0]?.focus();
    const { error: resendError } = await supabase.auth.signInWithOtp({ email });
    if (resendError) {
      setError('Failed to resend code. Please try again.');
      setCountdown(0);
    } else {
      setResendSent(true);
    }
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <Pressable style={[s.back, { marginTop: topInset + 8 }]} onPress={() => router.replace('/(auth)/sign-in')}>
        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        <Text style={[s.backText, { color: colors.textSecondary }]}>Back</Text>
      </Pressable>

      <View style={s.root}>
      <View style={s.body}>
        <Text style={[s.heading, { color: colors.text }]}>Enter the code</Text>
        <Text style={[s.sub, { color: colors.textSecondary }]}>
          Sent to{' '}
          <Text style={{ color: colors.text, fontWeight: FontWeight.semibold }}>{maskedEmail}</Text>
        </Text>

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

        {isLoading && <Text style={[s.statusText, { color: colors.textMuted }]}>Verifying…</Text>}
        {!!error && <Text style={s.error}>{error}</Text>}

        <View style={s.resendRow}>
          <Text style={[s.resendLabel, { color: colors.textMuted }]}>Didn't receive it? </Text>
          <Pressable onPress={handleResend} disabled={countdown > 0}>
            <Text style={[s.resendBtn, { color: countdown > 0 ? colors.textMuted : colors.gold }]}>
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
            </Text>
          </Pressable>
        </View>
        {resendSent && (
          <Text style={[s.resendLabel, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
            Code sent — also check your spam folder.
          </Text>
        )}
      </View>
      </View>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    screen: { flex: 1 },
    root: { flex: 1, paddingHorizontal: Spacing.lg },
    back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
    backText: { fontSize: FontSize.md },
    body: { flex: 1, justifyContent: 'center', paddingBottom: 80 },
    heading: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, lineHeight: 40, marginBottom: Spacing.sm },
    sub: { fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.xl },
    otpRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg, justifyContent: 'center' },
    otpBox: {
      width: 44, height: 52, borderRadius: Radius.md, borderWidth: 1.5,
      textAlign: 'center', fontSize: FontSize.xl, fontWeight: FontWeight.bold,
    },
    statusText: { fontSize: FontSize.sm, textAlign: 'center', marginBottom: Spacing.sm },
    error: { color: '#FF4444', fontSize: FontSize.sm, textAlign: 'center', marginBottom: Spacing.sm },
    resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.sm },
    resendLabel: { fontSize: FontSize.sm },
    resendBtn: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  });
}
