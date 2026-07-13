import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Platform,
  Image, PanResponder, Dimensions,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
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

type Stage = 'crop-preview' | 'processing' | 'back-prompt' | 'error';

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
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

  const isCapturing = useRef(false);
  const isSecondSide = useRef(false);
  const frontRef = useRef<{
    imageUri: string;
    fields: ReturnType<typeof parseCardFields>;
    isBlurry: boolean;
  } | null>(null);

  const runOCR = async (imageUri: string) => {
    setStage('processing');
    try {
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

      // VNDocumentCameraViewController cleans up its temp path on dismiss —
      // copy the file to a stable location before reading it.
      const dest = new File(Paths.document, `card_scan_${Date.now()}.jpg`);
      await new File(tempUri).copy(dest);
      const imageUri = dest.uri;

      setCapturedUri(imageUri);
      setStage('crop-preview');
      isCapturing.current = false;
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

  // ── Crop Preview ────────────────────────────────────────────────────────────
  if (stage === 'crop-preview' && capturedUri) {
    return (
      <CropPreview
        uri={capturedUri}
        colors={colors}
        insets={insets}
        onSkip={() => runOCR(capturedUri)}
        onCrop={async (cropParams) => {
          try {
            const result = await ImageManipulator.manipulateAsync(
              capturedUri,
              [{ crop: cropParams }],
              { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );
            runOCR(result.uri);
          } catch {
            runOCR(capturedUri);
          }
        }}
      />
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

async function compressDataUrlToBase64(dataUrl: string, maxW = 1600): Promise<string> {
  const g = globalThis as any;
  return new Promise((resolve) => {
    const img = new g.Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = g.document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl.split(',')[1] ?? ''); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '');
    };
    img.onerror = () => resolve(dataUrl.split(',')[1] ?? '');
    img.src = dataUrl;
  });
}

async function canvasCropToBase64(
  dataUrl: string,
  crop: { originX: number; originY: number; width: number; height: number }
): Promise<string> {
  const g = globalThis as any;
  return new Promise((resolve) => {
    const img = new g.Image();
    img.onload = () => {
      try {
        const canvas = g.document.createElement('canvas');
        canvas.width = Math.max(1, crop.width);
        canvas.height = Math.max(1, crop.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl.split(',')[1] ?? ''); return; }
        ctx.drawImage(img, crop.originX, crop.originY, crop.width, crop.height, 0, 0, crop.width, crop.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '');
      } catch {
        resolve(dataUrl.split(',')[1] ?? '');
      }
    };
    img.onerror = () => resolve(dataUrl.split(',')[1] ?? '');
    img.src = dataUrl;
  });
}

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
  const [stage, setStage] = useState<'idle' | 'crop' | 'processing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [cropDataUrl, setCropDataUrl] = useState<string | null>(null);

  const runWebOCR = async (imageBase64: string, imageDataUrl: string) => {
    setStage('processing');
    try {
      const blocks = await recognizeCardTextWeb(imageBase64);
      const fields = parseCardFields(blocks);
      cardScanStore.set({ imageUri: imageDataUrl, backImageUri: null, fields, isBlurry: blocks.length < 2 });
      Analytics.cardScanned(fields.length > 0);
      router.replace('/card-review');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Something went wrong');
      setStage('error');
    }
  };

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

    input.onchange = (e: any) => {
      cleanup();
      const file = e.target?.files?.[0];
      if (!file) return;
      // Read as data URL so we can show the crop preview
      const reader = new g.FileReader();
      reader.onload = (ev: any) => {
        const dataUrl: string = ev.target?.result ?? '';
        if (dataUrl) { setCropDataUrl(dataUrl); setStage('crop'); }
        else { setErrorMsg('Could not read image'); setStage('error'); }
      };
      reader.onerror = () => { setErrorMsg('Could not read image'); setStage('error'); };
      reader.readAsDataURL(file);
    };

    // Also clean up if the user cancels without picking a file
    input.addEventListener('cancel', cleanup);

    input.click();
  };

  // ── Crop stage ────────────────────────────────────────────────────────────
  if (stage === 'crop' && cropDataUrl) {
    return (
      <CropPreview
        uri={cropDataUrl}
        colors={colors}
        insets={insets}
        onSkip={async () => {
          const base64 = await compressDataUrlToBase64(cropDataUrl);
          await runWebOCR(base64, `data:image/jpeg;base64,${base64}`);
        }}
        onCrop={async (cropParams) => {
          const base64 = await canvasCropToBase64(cropDataUrl, cropParams);
          await runWebOCR(base64, `data:image/jpeg;base64,${base64}`);
        }}
      />
    );
  }

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

// ── Crop Preview Component ──────────────────────────────────────────────────

type CropBox = { x1: number; y1: number; x2: number; y2: number };

function CropPreview({
  uri, colors, insets, onSkip, onCrop,
}: {
  uri: string;
  colors: any;
  insets: any;
  onSkip: () => void;
  onCrop: (params: { originX: number; originY: number; width: number; height: number }) => void;
}) {
  const SCREEN = Dimensions.get('window');
  const BUTTON_AREA = 96 + insets.bottom;
  const IMG_H = SCREEN.height - BUTTON_AREA;

  const [natSize, setNatSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    (Image as any).getSize(uri, (w: number, h: number) => setNatSize({ w, h }));
  }, [uri]);

  const imgFrame = natSize
    ? (() => {
        const scale = Math.min(SCREEN.width / natSize.w, IMG_H / natSize.h);
        const w = natSize.w * scale;
        const h = natSize.h * scale;
        return { x: (SCREEN.width - w) / 2, y: (IMG_H - h) / 2, w, h };
      })()
    : null;

  const initBox = (): CropBox => {
    const fw = imgFrame ? imgFrame.w * 0.9 : SCREEN.width * 0.88;
    const fh = fw * 5 / 8;
    const cx = imgFrame ? imgFrame.x + imgFrame.w / 2 : SCREEN.width / 2;
    const cy = imgFrame ? imgFrame.y + imgFrame.h / 2 : IMG_H / 2;
    return { x1: cx - fw / 2, y1: cy - fh / 2, x2: cx + fw / 2, y2: cy + fh / 2 };
  };

  const cropRef = useRef<CropBox>(initBox());
  const [cropBox, setCropBox] = useState<CropBox>(initBox());

  // Re-centre when image frame becomes available
  useEffect(() => {
    if (!imgFrame) return;
    const box = initBox();
    cropRef.current = box;
    setCropBox(box);
  }, [natSize]);

  const clamp = (box: CropBox): CropBox => {
    const MIN = 60;
    let { x1, y1, x2, y2 } = box;
    if (imgFrame) {
      x1 = Math.max(imgFrame.x, x1);
      y1 = Math.max(imgFrame.y, y1);
      x2 = Math.min(imgFrame.x + imgFrame.w, x2);
      y2 = Math.min(imgFrame.y + imgFrame.h, y2);
    }
    if (x2 - x1 < MIN) x2 = x1 + MIN;
    if (y2 - y1 < MIN) y2 = y1 + MIN;
    return { x1, y1, x2, y2 };
  };

  const update = (box: CropBox) => {
    const b = clamp(box);
    cropRef.current = b;
    setCropBox(b);
  };

  const snapRef = useRef<CropBox>(cropRef.current);

  const makePR = (move: (snap: CropBox, dx: number, dy: number) => CropBox) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { snapRef.current = { ...cropRef.current }; },
      onPanResponderMove: (_, gs) => update(move(snapRef.current, gs.dx, gs.dy)),
    });

  const tlPR = useRef(makePR((s, dx, dy) => ({ ...s, x1: s.x1 + dx, y1: s.y1 + dy }))).current;
  const trPR = useRef(makePR((s, dx, dy) => ({ ...s, x2: s.x2 + dx, y1: s.y1 + dy }))).current;
  const blPR = useRef(makePR((s, dx, dy) => ({ ...s, x1: s.x1 + dx, y2: s.y2 + dy }))).current;
  const brPR = useRef(makePR((s, dx, dy) => ({ ...s, x2: s.x2 + dx, y2: s.y2 + dy }))).current;
  const mvPR = useRef(makePR((s, dx, dy) => ({ x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy }))).current;

  const applyCrop = () => {
    if (!imgFrame || !natSize) { onSkip(); return; }
    const { x1, y1, x2, y2 } = cropRef.current;
    const scaleX = natSize.w / imgFrame.w;
    const scaleY = natSize.h / imgFrame.h;
    const originX = Math.round(Math.max(0, (x1 - imgFrame.x) * scaleX));
    const originY = Math.round(Math.max(0, (y1 - imgFrame.y) * scaleY));
    const width = Math.round(Math.min(natSize.w - originX, (x2 - x1) * scaleX));
    const height = Math.round(Math.min(natSize.h - originY, (y2 - y1) * scaleY));
    onCrop({ originX, originY, width, height });
  };

  const H = 22; // handle touch size
  const { x1, y1, x2, y2 } = cropBox;
  const bw = x2 - x1;
  const bh = y2 - y1;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ width: SCREEN.width, height: IMG_H }}>
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />

        {/* Dimmed areas outside crop rect */}
        <View style={[cp.dim, { top: 0, left: 0, right: 0, height: y1 }]} />
        <View style={[cp.dim, { top: y2, left: 0, right: 0, bottom: 0 }]} />
        <View style={[cp.dim, { top: y1, left: 0, width: x1, height: bh }]} />
        <View style={[cp.dim, { top: y1, left: x2, right: 0, height: bh }]} />

        {/* Crop border */}
        <View style={{ position: 'absolute', top: y1, left: x1, width: bw, height: bh, borderWidth: 1.5, borderColor: '#FFF' }}>
          {/* Rule-of-thirds grid */}
          <View style={[cp.grid, { top: bh / 3, left: 0, right: 0, height: 0.5 }]} />
          <View style={[cp.grid, { top: (bh * 2) / 3, left: 0, right: 0, height: 0.5 }]} />
          <View style={[cp.grid, { left: bw / 3, top: 0, bottom: 0, width: 0.5 }]} />
          <View style={[cp.grid, { left: (bw * 2) / 3, top: 0, bottom: 0, width: 0.5 }]} />
          {/* Centre pan zone */}
          <View style={{ position: 'absolute', top: H, left: H, right: H, bottom: H }} {...mvPR.panHandlers} />
        </View>

        {/* Corner handles */}
        <View style={[cp.handle, { top: y1 - H / 2, left: x1 - H / 2 }]} {...tlPR.panHandlers} />
        <View style={[cp.handle, { top: y1 - H / 2, left: x2 - H / 2 }]} {...trPR.panHandlers} />
        <View style={[cp.handle, { top: y2 - H / 2, left: x1 - H / 2 }]} {...blPR.panHandlers} />
        <View style={[cp.handle, { top: y2 - H / 2, left: x2 - H / 2 }]} {...brPR.panHandlers} />
      </View>

      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
        Drag corners to resize · Drag inside to move
      </Text>

      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 10, paddingBottom: insets.bottom + 12 }}>
        <Pressable style={cp.skipBtn} onPress={onSkip}>
          <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '500' }}>Skip</Text>
        </Pressable>
        <Pressable style={[cp.cropBtn, { backgroundColor: colors.accent }]} onPress={applyCrop}>
          <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Crop & Scan</Text>
        </Pressable>
      </View>
    </View>
  );
}

const cp = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  grid: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.2)' },
  handle: { position: 'absolute', width: 22, height: 22, backgroundColor: '#FFF', borderRadius: 3 },
  skipBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center',
  },
  cropBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});

// ── Card scanner screen styles ──────────────────────────────────────────────

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
