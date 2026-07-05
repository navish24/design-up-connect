import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Analytics } from '../lib/analytics';
import { isInAppBrowser } from '../lib/inAppBrowser';
import InAppBrowserOverlay from '../components/InAppBrowserOverlay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { cardScanStore } from '../lib/cardScanStore';
import { recognizeCardTextWeb, parseCardFields } from '../lib/cardOcr';

// Native-only modules — not available on web
const isNative = Platform.OS !== 'web';
let useCameraPermissions: any = () => [{ granted: false }, async () => {}];
let DocumentScanner: any = null;
let ResponseType: any = { ImageFilePath: 'imageFilePath' };
let File: any = null;
let Paths: any = null;
let Haptics: any = { impactAsync: () => Promise.resolve(), ImpactFeedbackStyle: { Light: 0 } };
let recognizeCardText: any = async () => [];

if (isNative) {
  try { ({ useCameraPermissions } = require('expo-camera')); } catch (_) {}
  try { ({ default: DocumentScanner, ResponseType } = require('react-native-document-scanner-plugin')); } catch (_) {}
  try { ({ File, Paths } = require('expo-file-system')); } catch (_) {}
  try { Haptics = require('expo-haptics'); } catch (_) {}
  try { ({ recognizeCardText } = require('../lib/cardOcr')); } catch (_) {}
}

type Stage = 'processing' | 'back-prompt' | 'error';

export default function CardScannerScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!isNative) {
    if (isInAppBrowser()) {
      return <InAppBrowserOverlay />;
    }
    return <WebCardScanner colors={colors} insets={insets} />;
  }
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
  const handleCapture = async () => {
    if (isCapturing.current) return;
    isCapturing.current = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const { scannedImages } = await DocumentScanner.scanDocument({
        maxNumDocuments: 1,
        responseType: ResponseType.ImageFilePath,
      });

      // Use the LAST image — if the user tapped capture multiple times before confirming,
      // the last frame is the one they were satisfied with.
      const tempUri = scannedImages?.length ? scannedImages[scannedImages.length - 1] : null;
      if (!tempUri) {
        // User tapped Cancel inside DocumentScanner → go back
        isCapturing.current = false;
        router.back();
        return;
      }

      setStage('processing');

      // VNDocumentCameraViewController cleans up its temp path on dismiss —
      // copy the file to a stable location before reading it.
      const dest = new File(Paths.document, `card_scan_${Date.now()}.jpg`);
      await new File(tempUri).copy(dest);
      const imageUri = dest.uri;

      const blocks = await recognizeCardText(imageUri);
      const fields = parseCardFields(blocks);

      if (isSecondSide.current && frontRef.current) {
        const merged = [...frontRef.current.fields, ...fields];
        cardScanStore.set({
          imageUri: frontRef.current.imageUri,
          backImageUri: imageUri,
          fields: merged,
          isBlurry: frontRef.current.isBlurry,
        });
        Analytics.cardScanned(true);
        frontRef.current = null;
        isCapturing.current = false;
        router.replace('/card-review');
      } else {
        frontRef.current = { imageUri, fields, isBlurry: blocks.length < 2 };
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
        <Ionicons name="camera-off-outline" size={52} color={colors.accent} />
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
        <Text style={[s.title, { color: colors.text }]}>Want to scan the other side?</Text>
        <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={handleSkip}>
          <Text style={s.btnLabel}>Skip</Text>
        </Pressable>
        <Pressable style={[s.outlineBtn, { borderColor: colors.border }]} onPress={handleScanBack}>
          <Text style={[s.outlineBtnText, { color: colors.text }]}>Scan back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Waiting for DocumentScanner to open (null stage) ────────────────────────
  // Auto-launch the scanner as soon as permission is confirmed
  if (!isCapturing.current) {
    handleCapture();
  }

  return (
    <View style={[s.root, s.centered, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

// ── Web card capture (browser only) ──────────────────────────────────────────

async function compressToBase64(file: any): Promise<string> {
  const g = globalThis as any;

  // Read original file as data URL (fallback path — also used when canvas.toBlob returns null)
  const readOriginalAsBase64 = (): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new g.FileReader();
      reader.onload = (e: any) => {
        const b64 = (e.target?.result as string ?? '').split(',')[1];
        b64 ? res(b64) : rej(new Error('Failed to read image'));
      };
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

  return new Promise((resolve, reject) => {
    const img = new g.Image();
    // Use FileReader for the source so it works even when blob URLs are restricted
    const reader = new g.FileReader();
    reader.onload = (e: any) => { img.src = e.target?.result; };
    reader.onerror = reject;
    reader.readAsDataURL(file);

    img.onload = () => {
      try {
        const MAX_W = 800;
        const scale = Math.min(1, MAX_W / img.width);
        const canvas = g.document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) { readOriginalAsBase64().then(resolve, reject); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob: any) => {
            if (!blob) {
              // canvas.toBlob returned null (can happen on iOS with HEIC photos) — send original
              readOriginalAsBase64().then(resolve, reject);
              return;
            }
            const r = new g.FileReader();
            r.onload = () => resolve((r.result as string).split(',')[1]);
            r.onerror = reject;
            r.readAsDataURL(blob);
          },
          'image/jpeg',
          0.8
        );
      } catch {
        readOriginalAsBase64().then(resolve, reject);
      }
    };
    img.onerror = () => readOriginalAsBase64().then(resolve, reject);
  });
}

function WebCardScanner({ colors, insets }: { colors: any; insets: any }) {
  const [stage, setStage] = useState<'idle' | 'processing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCapture = () => {
    const g = globalThis as any;
    const input = g.document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    // Must be in the DOM for iOS Safari to fire onchange after "Use Photo"
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
    g.document.body.appendChild(input);

    const cleanup = () => { try { g.document.body.removeChild(input); } catch (_) {} };

    input.onchange = async (e: any) => {
      cleanup();
      const file = e.target?.files?.[0];
      if (!file) return;
      setStage('processing');
      try {
        const imageBase64 = await compressToBase64(file);
        const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;
        const blocks = await recognizeCardTextWeb(imageBase64);
        const fields = parseCardFields(blocks);
        cardScanStore.set({
          imageUri: imageDataUrl,
          backImageUri: null,
          fields,
          isBlurry: blocks.length < 2,
        });
        Analytics.cardScanned(fields.length > 0);
        router.replace('/card-review');
      } catch (err: any) {
        setErrorMsg(err?.message ?? 'Something went wrong');
        setStage('error');
      }
    };

    // Also clean up if the user cancels without picking a file
    input.addEventListener('cancel', cleanup);

    input.click();
  };

  if (stage === 'processing') {
    return (
      <View style={[s.root, s.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[s.title, { color: colors.text, marginTop: 20 }]}>Reading card...</Text>
        <Text style={[s.body, { color: colors.textMuted }]}>On-device compression → Cloud Vision</Text>
      </View>
    );
  }

  if (stage === 'error') {
    return (
      <View style={[s.root, s.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={52} color="#FF4444" />
        <Text style={[s.title, { color: colors.text }]}>Couldn't read card</Text>
        <Text style={[s.body, { color: colors.textMuted }]}>{errorMsg}</Text>
        <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={() => setStage('idle')}>
          <Text style={s.btnLabel}>Try again</Text>
        </Pressable>
        <Pressable style={s.link} onPress={() => router.back()}>
          <Text style={[s.linkText, { color: colors.textMuted }]}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.root, s.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[s.iconWrap, { backgroundColor: colors.accent + '22' }]}>
        <Ionicons name="scan-outline" size={44} color={colors.accent} />
      </View>
      <Text style={[s.title, { color: colors.text }]}>Scan a visiting card</Text>
      <Text style={[s.body, { color: colors.textMuted }]}>
        Take a photo of the card — we'll read the details automatically.
      </Text>
      <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={handleCapture}>
        <Text style={s.btnLabel}>Open Camera</Text>
      </Pressable>
      <Pressable style={s.link} onPress={() => router.back()}>
        <Text style={[s.linkText, { color: colors.textMuted }]}>Cancel</Text>
      </Pressable>
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
