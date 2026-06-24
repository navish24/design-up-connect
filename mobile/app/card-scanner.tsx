import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import DocumentScanner, { ResponseType } from 'react-native-document-scanner-plugin';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { recognizeCardText, parseCardFields } from '../lib/cardOcr';
import { cardScanStore } from '../lib/cardScanStore';

type Stage = 'processing' | 'back-prompt' | 'error';

export default function CardScannerScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage | null>(null); // null = DocumentScanner not yet returned
  const [errorMsg, setErrorMsg] = useState('');

  const isCapturing = useRef(false);
  const isSecondSide = useRef(false);
  const frontRef = useRef<{
    imageUri: string;
    fields: ReturnType<typeof parseCardFields>;
    isBlurry: boolean;
  } | null>(null);

  // Open DocumentScanner immediately when the screen mounts (or after permission granted).
  // No custom "align card" pre-scan UI — the native scanner provides all guidance.
  useEffect(() => {
    if (permission?.granted) handleCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted]);

  const handleCapture = async () => {
    if (isCapturing.current) return;
    isCapturing.current = true;
    setStage(null); // clear any previous state while scanner is open

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const { scannedImages } = await DocumentScanner.scanDocument({
        maxNumDocuments: 1,
        responseType: ResponseType.ImageFilePath,
      });

      const tempUri = scannedImages?.[0] ?? null;
      if (!tempUri) {
        // User tapped Cancel inside DocumentScanner → go back
        isCapturing.current = false;
        router.back();
        return;
      }

      setStage('processing');

      // VNDocumentCameraViewController cleans up its temp path on dismiss —
      // copy immediately to keep the URI stable for card-review.
      const dest = new File(Paths.document, `card_scan_${Date.now()}.jpg`);
      new File(tempUri).copy(dest);
      const imageUri = dest.uri;

      const blocks = await recognizeCardText(imageUri);
      const fields = parseCardFields(blocks);
      const isBlurry = blocks.length < 2;

      if (isSecondSide.current) {
        const front = frontRef.current;
        cardScanStore.set({
          imageUri: front?.imageUri ?? null,
          backImageUri: imageUri,
          fields: [...(front?.fields ?? []), ...fields],
          isBlurry: (front?.isBlurry ?? false) || isBlurry,
        });
        frontRef.current = null;
        isCapturing.current = false;
        router.replace('/card-review');
      } else {
        frontRef.current = { imageUri, fields, isBlurry };
        isCapturing.current = false;
        setStage('back-prompt');
      }
    } catch (e: any) {
      isCapturing.current = false;
      setErrorMsg(e?.message ?? 'Something went wrong');
      setStage('error');
    }
  };

  const handleScanBack = () => {
    isSecondSide.current = true;
    setStage(null);
    handleCapture();
  };

  const handleSkip = () => {
    const front = frontRef.current;
    cardScanStore.set({
      imageUri: front?.imageUri ?? null,
      backImageUri: null,
      fields: front?.fields ?? [],
      isBlurry: front?.isBlurry ?? false,
    });
    router.replace('/card-review');
  };

  if (!permission) {
    return <View style={[s.root, { paddingTop: insets.top }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[s.root, s.centered]}>
        <Ionicons name="camera-outline" size={52} color={colors.accent} />
        <Text style={[s.title, { color: colors.text }]}>Camera required</Text>
        <Text style={[s.body, { color: colors.textMuted }]}>
          Allow camera access to scan visiting cards
        </Text>
        <Pressable
          style={[s.btn, { backgroundColor: colors.accent }]}
          onPress={requestPermission}
        >
          <Text style={s.btnLabel}>Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  // ── Processing ──────────────────────────────────────────────────────────────
  if (stage === 'processing') {
    return (
      <View style={[s.root, s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[s.title, { color: colors.text, marginTop: 20 }]}>Reading card...</Text>
        <Text style={[s.body, { color: colors.textMuted }]}>On-device — no data sent</Text>
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <View style={[s.root, s.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={52} color="#FF4444" />
        <Text style={[s.title, { color: colors.text }]}>Couldn't read card</Text>
        <Text style={[s.body, { color: colors.textMuted }]}>{errorMsg}</Text>
        <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={handleCapture}>
          <Text style={s.btnLabel}>Try again</Text>
        </Pressable>
        <Pressable style={s.link} onPress={() => router.back()}>
          <Text style={[s.linkText, { color: colors.textMuted }]}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // ── Back-side prompt ────────────────────────────────────────────────────────
  if (stage === 'back-prompt') {
    return (
      <View style={[s.root, s.centered, { backgroundColor: colors.background }]}>
        <View style={[s.iconWrap, { backgroundColor: colors.accent + '22' }]}>
          <Ionicons name="sync-outline" size={44} color={colors.accent} />
        </View>
        <Text style={[s.title, { color: colors.text }]}>Scan the other side?</Text>
        <Text style={[s.body, { color: colors.textMuted }]}>
          Many cards have company details, address, or social handles on the back too.
        </Text>
        <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={handleScanBack}>
          <Text style={s.btnLabel}>Scan back</Text>
        </Pressable>
        <Pressable style={[s.outlineBtn, { borderColor: colors.border }]} onPress={handleSkip}>
          <Text style={[s.outlineBtnText, { color: colors.text }]}>Skip — use front only</Text>
        </Pressable>
      </View>
    );
  }

  // ── Waiting for DocumentScanner to open (null stage) ────────────────────────
  return (
    <View style={[s.root, s.centered, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },

  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 8 },

  btn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnLabel: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  outlineBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  outlineBtnText: { fontSize: 15, fontWeight: '500' },

  link: { paddingVertical: 10 },
  linkText: { fontSize: 15 },
});
