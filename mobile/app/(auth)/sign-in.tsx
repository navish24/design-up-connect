import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
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
  const [suggestion, setSuggestion] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('connect_last_email').then((saved) => {
      if (saved) setEmail(saved);
    });
  }, []);

  const DOMAIN_FIXES: Record<string, string> = {
    'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmai.com': 'gmail.com',
    'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmaill.com': 'gmail.com',
    'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com',
    'hotmai.com': 'hotmail.com', 'hotmial.com': 'hotmail.com',
    'outlok.com': 'outlook.com', 'outllok.com': 'outlook.com',
  };
  const TLD_FIXES: Record<string, string> = {
    con: 'com', cmo: 'com', ocm: 'com', coml: 'com', vom: 'com', cpm: 'com',
    ner: 'net', og: 'org',
  };

  const validateEmail = (val: string): { error?: string; suggestion?: string } => {
    // Must have exactly one @
    const atCount = (val.match(/@/g) ?? []).length;
    if (atCount === 0) return { error: 'Missing @ in email address.' };
    if (atCount > 1) return { error: 'Email address can only have one @.' };

    const [local, domain] = val.split('@');
    if (!local) return { error: 'Missing username before @.' };
    if (!domain || !domain.includes('.')) return { error: 'Missing domain after @.' };

    const tld = domain.split('.').pop() ?? '';
    if (tld.length < 2) return { error: 'Email domain looks incomplete.' };

    // Known domain typos → suggest fix
    if (DOMAIN_FIXES[domain]) return { suggestion: `${local}@${DOMAIN_FIXES[domain]}` };

    // Known TLD typos → suggest fix
    if (TLD_FIXES[tld]) return { suggestion: val.slice(0, -tld.length) + TLD_FIXES[tld] };

    return {};
  };

  const handleEmailOtp = async () => {
    setError('');
    setEmailError(false);
    setSuggestion('');
    const trimmed = email.trim().toLowerCase();
    const { error: validationError, suggestion: fix } = validateEmail(trimmed);
    if (validationError) {
      setError(validationError);
      setEmailError(true);
      return;
    }
    if (fix) {
      setSuggestion(fix);
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
  const trimmedEmail = email.trim().toLowerCase();
  const emailReady = trimmedEmail.includes('@') && trimmedEmail.split('@').length === 2
    && (trimmedEmail.split('@')[1] ?? '').includes('.')
    && (trimmedEmail.split('@')[1].split('.').pop()?.length ?? 0) >= 2;

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <Pressable style={[s.back, { marginTop: topInset + 8 }]} onPress={() => router.replace('/(auth)/welcome')}>
        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        <Text style={[s.backText, { color: colors.textSecondary }]}>Back</Text>
      </Pressable>

      <View style={s.root}>
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
            onChangeText={(v) => { setEmail(v); setError(''); setEmailError(false); setSuggestion(''); }}
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

        {!!suggestion && (
          <Pressable onPress={() => { setEmail(suggestion); setSuggestion(''); setEmailError(false); }}>
            <Text style={s.error}>
              Did you mean{' '}
              <Text style={s.suggestionLink}>{suggestion}</Text>?
            </Text>
          </Pressable>
        )}
        {!!error && !suggestion && <Text style={s.error}>{error}</Text>}

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
    suggestionLink: { fontWeight: FontWeight.semibold, textDecorationLine: 'underline' },
  });
}
