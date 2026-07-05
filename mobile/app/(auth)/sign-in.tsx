import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { Analytics } from '../../lib/analytics';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

export default function SignInScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ context?: string }>();
  const { top: topInset } = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('connect_last_email').then((saved) => {
      if (saved) setEmail(saved);
    });
  }, []);

  const handleEmailOtp = async () => {
    setError('');
    setEmailError(false);
    const trimmed = email.trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setError('Please enter a valid email address.');
      setEmailError(true);
      return;
    }
    setIsLoading(true);
    Analytics.signInStarted('email');
    const { error: otpError } = await supabase.auth.signInWithOtp({ email: trimmed });
    setIsLoading(false);
    if (otpError) { setError(otpError.message); return; }
    AsyncStorage.setItem('connect_last_email', trimmed).catch(() => {});
    router.replace({
      pathname: '/(auth)/verify-otp',
      params: { email: trimmed, context: params.context ?? '' },
    });
  };

  const s = makeStyles(colors);
  const emailReady = /\S+@\S+\.\S+/.test(email.trim());

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable style={[s.back, { marginTop: topInset + 8 }]} onPress={() => router.replace('/(auth)/welcome')}>
        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        <Text style={[s.backText, { color: colors.textSecondary }]}>Back</Text>
      </Pressable>

      <View style={s.content}>
        <Text style={[s.heading, { color: colors.text }]}>Welcome to{'\n'}Connect</Text>
        <Text style={[s.sub, { color: colors.textSecondary }]}>
          Enter your email to sign in or create an account.
        </Text>

        <View style={[s.inputRow, { borderColor: emailError ? '#FF4444' : colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={{ marginRight: Spacing.sm }} />
          <TextInput
            style={[s.input, { color: colors.text }]}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={(v) => { setEmail(v); setError(''); setEmailError(false); }}
            autoFocus
          />
        </View>

        <Pressable
          style={[s.btn, { backgroundColor: emailReady ? colors.accent : colors.surfaceElevated }]}
          onPress={handleEmailOtp}
          disabled={!emailReady || isLoading}
        >
          {isLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={[s.btnText, { color: emailReady ? '#FFF' : colors.textMuted }]}>Continue</Text>
          }
        </Pressable>

        {!!error && <Text style={s.error}>{error}</Text>}

        <Text style={[s.terms, { color: colors.textMuted }]}>
          By continuing, you agree to Connect's Terms of Service and Privacy Policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, paddingHorizontal: Spacing.lg },
    back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.xl },
    backText: { fontSize: FontSize.md },
    content: { flex: 1 },
    heading: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, lineHeight: 40, marginBottom: Spacing.sm },
    sub: { fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.xl },
    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1.5, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, height: 56, marginBottom: Spacing.sm,
    },
    input: { flex: 1, fontSize: FontSize.lg },
    btn: {
      paddingVertical: 16, borderRadius: Radius.md,
      alignItems: 'center', marginTop: Spacing.sm, marginBottom: Spacing.lg,
    },
    btnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    error: { color: '#FF4444', fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.sm },
    terms: { fontSize: FontSize.xs, lineHeight: 18, textAlign: 'center', paddingHorizontal: Spacing.lg, marginTop: 'auto', paddingBottom: Spacing.xl },
  });
}
