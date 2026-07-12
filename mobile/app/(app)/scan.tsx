import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image,
  ScrollView, Modal, ActivityIndicator, LogBox, Platform,
} from 'react-native';
import { isInAppBrowser } from '../../lib/inAppBrowser';
import InAppBrowserOverlay from '../../components/InAppBrowserOverlay';
import WebQRScanner from '../../components/WebQRScanner';
import WebCardScanner, { type WebCardScannerHandle } from '../../components/WebCardScanner';

LogBox.ignoreLogs([
  'Warning: Camera',
  'ExpoCamera',
  '[expo-camera]',
  'Open debugger',
]);
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderPaddingTop } from '../../lib/safeArea';
import { router, useLocalSearchParams } from 'expo-router';
import { getTabBarStyle } from './_layout';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { processScan } from '../../lib/supabase';
import { Analytics } from '../../lib/analytics';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import jsQR from 'jsqr';
import { recognizeCardText, recognizeCardTextWeb, parseCardFields } from '../../lib/cardOcr';
import { cardScanStore } from '../../lib/cardScanStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanResult } from '../../types';
import { setPendingConnectionOpen } from '../../lib/pendingNav';

type ScanState =
  | 'idle'
  | 'scanning'
  | 'saving_brand'
  | 'saving_connection'
  | 'success_brand'
  | 'success_connection'
  | 'success_entry'
  | 'already_saved'
  | 'already_connected'
  | 'error';

// Only process QRs that belong to this app; silently ignore everything else
// (website links, social QRs, etc. printed on physical visiting cards).
const isDesignupQR = (payload: string): boolean =>
  payload.startsWith('https://connect-designup.vercel.app/') ||
  payload.startsWith('https://connect.designup.in/') || // legacy
  payload.startsWith('https://designup.in/') || // legacy
  payload.startsWith('designup://') ||
  // Legacy / dev formats kept for backward compatibility
  payload.startsWith('booth:') ||
  payload.startsWith('user:') ||
  payload.startsWith('entry:');

const HOW_IT_WORKS = [
  {
    icon: 'people-outline' as const,
    label: 'Connect with people',
    description:
      "Scan someone's Connect QR to save their digital visiting card instantly — no number sharing, no typing.",
  },
  {
    icon: 'card-outline' as const,
    label: 'Scan physical visiting cards',
    description:
      'Tap "Scan Visiting Card", place the card flat and capture it. Contacts are saved and organised automatically.',
  },
];

// Compress any image file (JPEG, PNG, HEIC) to a small JPEG base64 string.
// Uses URL.createObjectURL so iOS Safari can decode HEIC natively via its image engine.
async function compressImageToBase64(file: any, maxPx = 1200): Promise<string> {
  const g = globalThis as any;
  const blobToBase64 = (blob: any): Promise<string> =>
    new Promise((res, rej) => {
      const r = new g.FileReader();
      r.onload = (e: any) => { const b = (e.target?.result as string ?? '').split(',')[1]; b ? res(b) : rej(new Error('read')); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });

  return new Promise((resolve, reject) => {
    const objectUrl = g.URL.createObjectURL(file);
    const img = new g.Image();
    img.onload = () => {
      g.URL.revokeObjectURL(objectUrl);
      try {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = g.document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('no canvas')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob: any) => {
          if (!blob) { reject(new Error('toBlob')); return; }
          blobToBase64(blob).then(resolve, reject);
        }, 'image/jpeg', 0.85);
      } catch (err) { reject(err); }
    };
    img.onerror = () => {
      g.URL.revokeObjectURL(objectUrl);
      reject(new Error('img load failed'));
    };
    img.src = objectUrl;
  });
}

// Decode a QR code from a base64 JPEG string using jsQR (web only).
async function decodeQRFromBase64(base64Jpeg: string): Promise<string | null> {
  const g = globalThis as any;
  if (!g.document) return null;
  return new Promise((resolve) => {
    const img = new g.Image();
    img.onload = () => {
      try {
        const canvas = g.document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, img.width, img.height);
        resolve(code?.data ?? null);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/jpeg;base64,${base64Jpeg}`;
  });
}

// Decode a QR code from an image File using jsQR (web only).
// Returns the decoded string or null if no QR code found.
async function decodeQRFromFile(file: any): Promise<string | null> {
  const g = globalThis as any;
  return new Promise((resolve) => {
    const objectUrl = g.URL.createObjectURL(file);
    const img = new g.Image();
    img.onload = () => {
      g.URL.revokeObjectURL(objectUrl);
      try {
        const maxPx = 800;
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = g.document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, w, h);
        resolve(code?.data ?? null);
      } catch { resolve(null); }
    };
    img.onerror = () => { g.URL.revokeObjectURL(objectUrl); resolve(null); };
    img.src = objectUrl;
  });
}

export default function ScanScreen() {
  const { colors } = useTheme();
  const { activeExhibitionId, user, addDemoSavedBrand, addDemoConnection, setActiveExhibition } =
    useAuth();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const headerPaddingTop = useHeaderPaddingTop();
  const navigation = useNavigation();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string>('');
  const [isGalleryImporting, setIsGalleryImporting] = useState(false);
  const [isCaptureProcessing, setIsCaptureProcessing] = useState(false);
  const [scanView, setScanView] = useState<'choice' | 'card' | 'qr'>('choice');
  const [showInfo, setShowInfo] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [webTorchSupported, setWebTorchSupported] = useState(false);
  const [showCameraNotice, setShowCameraNotice] = useState(false);
  const [cardScanError, setCardScanError] = useState<string | null>(null);
  const cardScanErrorTimer = useRef<any>(null);
  const pendingScanView = useRef<'card' | 'qr'>('card');
  const isProcessing = useRef(false);
  const isManualCapture = useRef(false);
  const webCardScannerRef = useRef<WebCardScannerHandle>(null);
  const webGalleryInputRef = useRef<any>(null);
  const webGalleryHandlerRef = useRef<(e: any) => void>(() => {});

  useEffect(() => {
    if (!isFocused) {
      setScanState('idle');
      setScanResult(null);
      isProcessing.current = false;
      setScanView('choice');
    } else if (mode === 'card') {
      // Arrived from "Scan Another Card" on the success screen — skip choice screen
      setScanView('card');
    }
  }, [isFocused, mode]);

  // Hide tab bar only while actively scanning — restore on choice screen AND
  // all result/error states so the user is never fully stuck without navigation.
  const isActivelyScanning = scanView !== 'choice' &&
    !['success_brand', 'success_connection', 'success_entry', 'already_saved', 'already_connected', 'error'].includes(scanState);
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: isActivelyScanning
        ? { display: 'none' }
        : getTabBarStyle(colors, Platform.OS === 'web' ? 0 : bottomInset),
    });
  }, [isActivelyScanning, colors, bottomInset, navigation]);

  // Reset torch and web torch support detection when switching scanner modes
  useEffect(() => {
    setTorchOn(false);
    if (Platform.OS === 'web') setWebTorchSupported(false);
  }, [scanView]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const g = globalThis as any;
    if (!g.document) return;

    const style = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:0;left:0;';

    // Gallery input — shows photo library picker on iOS
    const gal = g.document.createElement('input');
    gal.type = 'file'; gal.accept = 'image/*';
    gal.style.cssText = style;
    g.document.body.appendChild(gal);
    webGalleryInputRef.current = gal;
    const galHandler = (e: any) => webGalleryHandlerRef.current(e);
    gal.addEventListener('change', galHandler);

    return () => {
      gal.removeEventListener('change', galHandler);
      try { g.document.body.removeChild(gal); } catch (_) {}
    };
  }, []);

  const handleGalleryImport = () => {
    Analytics.galleryImportTapped();
    if (Platform.OS === 'web') {
      // Pause auto-capture immediately so the scanner doesn't fire while the picker is open
      setIsGalleryImporting(true);
      const g = globalThis as any;
      const onFocus = () => {
        // If picker was dismissed without selecting a file, reset the flag
        setTimeout(() => {
          if (!webGalleryInputRef.current?.files?.length) setIsGalleryImporting(false);
        }, 500);
        g.window?.removeEventListener('focus', onFocus);
      };
      g.window?.addEventListener('focus', onFocus);
      webGalleryInputRef.current?.click();
      return;
    }
    // Native: ImagePicker + ML Kit OCR
    setIsGalleryImporting(true);
    ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    }).then(async (result) => {
      if (result.canceled || !result.assets?.[0]) { setIsGalleryImporting(false); return; }
      const imageUri = result.assets[0].uri;
      // Try QR decode before OCR — handles screenshots of Connect QR pages
      try {
        const codes = await scanFromURLAsync(imageUri, ['qr']);
        const qrData = codes?.[0]?.data;
        if (qrData && isDesignupQR(qrData)) {
          setIsGalleryImporting(false);
          handleBarCodeScanned({ data: qrData });
          return;
        }
      } catch (_) {}
      const blocks = await recognizeCardText(imageUri);
      const fields = parseCardFields(blocks);
      cardScanStore.set({ imageUri, backImageUri: null, fields, isBlurry: blocks.length < 2 });
      setIsGalleryImporting(false);
      router.push('/card-review');
    }).catch(() => setIsGalleryImporting(false));
  };

  // Gallery handler ref — uses web OCR (same pipeline as camera capture)
  webGalleryHandlerRef.current = async (e: any) => {
    const file = e.target?.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) { setIsGalleryImporting(false); return; }
    setIsGalleryImporting(true);
    try {
      // Try QR decode before OCR — handles screenshots of Connect QR pages without
      // producing garbage card fields from surrounding UI text.
      const qrData = await decodeQRFromFile(file);
      if (qrData && isDesignupQR(qrData)) {
        setIsGalleryImporting(false);
        handleBarCodeScanned({ data: qrData });
        return;
      }
      const imageBase64 = await compressImageToBase64(file);
      const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;
      let blocks: any[] = [];
      try { blocks = await recognizeCardTextWeb(imageBase64); } catch (_) {}
      const fields = parseCardFields(blocks);
      cardScanStore.set({ imageUri: imageDataUrl, backImageUri: null, fields, isBlurry: blocks.length < 2 });
      Analytics.cardScanned(fields.length > 0);
      setIsGalleryImporting(false);
      router.push('/card-review');
    } catch { setIsGalleryImporting(false); }
  };



  const s = makeStyles(colors);

  const resetToIdle = () => {
    setScanState('idle');
    setScanResult(null);
    setScanError('');
    isProcessing.current = false;
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!isDesignupQR(data)) return; // silently discard foreign QRs
    if (isProcessing.current) return;
    isProcessing.current = true;
    setScanState('scanning');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const result: ScanResult = await processScan(data, activeExhibitionId, user?.id ?? null);
      setScanResult(result);
      Analytics.qrScanned(result.scan_type as any);

      if (result.scan_type === 'booth') {
        if (result.action === 'already_saved') {
          setScanState('already_saved');
        } else {
          setScanState('saving_brand');
          if (result.brand) {
            const b = result.brand;
            addDemoSavedBrand({
              id: `scan-save-${b.id}-${Date.now()}`,
              brand_id: b.id,
              brand_name: b.name,
              brand_category: b.category,
              brand_tagline: b.tagline ?? '',
              product_image_url: b.product_images[0] ?? '',
              exhibition_id: activeExhibitionId ?? null,
              exhibition_name: b.exhibition_name ?? null,
              booth_number: b.booth_number,
              hall_number: b.hall_number,
              saved_at: new Date().toISOString(),
            });
          }
          setTimeout(() => setScanState('success_brand'), 1800);
        }
      } else if (result.scan_type === 'user') {
        if (result.action === 'already_connected') {
          setScanState('already_connected');
        } else {
          setScanState('saving_connection');
          if (result.connection) {
            const u = result.connection.user;
            addDemoConnection({
              id: (u as any).id ?? u.designup_user_id,
              full_name: u.full_name,
              designation: u.designation || undefined,
              company: u.company_name || undefined,
              brand_id: (u as any).brand_id || undefined,
              email: (u as any).email || undefined,
              phone: (u as any).phone || undefined,
              city: (u as any).city || undefined,
              profile_image_url: u.profile_image_url || undefined,
            });
          }
          setTimeout(() => setScanState('success_connection'), 1800);
        }
      } else if (result.scan_type === 'entry') {
        if (result.exhibition) {
          setActiveExhibition(result.exhibition.id, result.exhibition.name);
        }
        setScanState('success_entry');
        const exhId = result.exhibition?.id;
        const isDemoUser = user?.email === 'niveditasingh0124@gmail.com';
        setTimeout(() => {
          resetToIdle();
          if (isDemoUser && exhId) {
            router.replace(`/exhibition/${exhId}` as any);
          } else {
            router.replace('/(app)');
          }
        }, 2000);
      }
    } catch (err: any) {
      setScanError(err?.message ?? 'unknown error');
      setScanState('error');
      // No auto-dismiss — user must tap "Try Again" so they can read the error
    }
  };

  // ── Web: in-app browser guard (app-wide guard in _layout.tsx is primary) ──
  if (Platform.OS === 'web' && isInAppBrowser()) {
    return <InAppBrowserOverlay />;
  }

  // ── Native-only: camera permission guard ──────────────────────────────────
  // On web, WebQRScanner manages its own getUserMedia permission; card mode uses
  // the file picker (no camera permission needed until the user taps the QR tab).
  if (Platform.OS !== 'web') {
    if (!permission) return <View style={[s.root, { backgroundColor: colors.background }]} />;

    if (!permission.granted) {
      return (
        <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
          <Ionicons name="camera-off-outline" size={56} color={colors.textSecondary} />
          <Text style={[s.permTitle, { color: colors.text }]}>Camera Access Required</Text>
          <Text style={[s.permBody, { color: colors.textSecondary }]}>
            Connect needs camera access to scan QR codes and visiting cards.
          </Text>
          <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={requestPermission}>
            <Text style={s.btnText}>Allow Camera</Text>
          </Pressable>
        </View>
      );
    }
  }

  // ── Scanning overlay ──────────────────────────────────────────────────────
  if (scanState === 'scanning') {
    return (
      <View style={[s.root, s.center, { backgroundColor: '#000' }]}>
        <View style={s.scanningOverlay}>
          <View style={[s.scanningIcon, { backgroundColor: colors.accent + '22' }]}>
            <Ionicons name="scan" size={40} color={colors.accent} />
          </View>
          <Text style={[s.scanningText, { color: '#FFF' }]}>Scanning QR...</Text>
        </View>
      </View>
    );
  }

  // ── Saving spinners ───────────────────────────────────────────────────────
  if (scanState === 'saving_brand') {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <View style={[s.savingIcon, { backgroundColor: colors.accent + '22' }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
        <Text style={[s.successTitle, { color: colors.text }]}>Saving...</Text>
        <Text style={[s.successSub, { color: colors.textMuted }]}>
          Saving {scanResult?.brand?.name} to your saves
        </Text>
      </View>
    );
  }

  if (scanState === 'saving_connection') {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <View style={[s.savingIcon, { backgroundColor: colors.accent + '22' }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
        <Text style={[s.successTitle, { color: colors.text }]}>Saving...</Text>
        <Text style={[s.successSub, { color: colors.textMuted }]}>
          Saving {scanResult?.connection?.user.full_name}'s contact
        </Text>
      </View>
    );
  }

  // ── Brand saved ───────────────────────────────────────────────────────────
  if (scanState === 'success_brand' && scanResult?.brand) {
    const { brand } = scanResult;
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={s.successScroll}>
          <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
          <Text style={[s.successTitle, { color: colors.text }]}>{brand.name} saved!</Text>
          <Text style={[s.successSub, { color: colors.textSecondary }]}>
            Added to your saves. Open the brand page to add notes.
          </Text>
          {brand.product_images.length > 0 && (
            <View style={s.productImgRow}>
              {brand.product_images.slice(0, 2).map((url, i) => (
                <Image key={i} source={{ uri: url }} style={s.productImg} />
              ))}
            </View>
          )}
          <View style={[s.boothTag, { backgroundColor: colors.surface }]}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={[s.boothTagText, { color: colors.textSecondary }]}>
              {brand.hall_number} · Booth {brand.booth_number}
            </Text>
          </View>
          <Pressable
            style={[s.outlineBtn, { borderColor: colors.gold }]}
            onPress={() => { resetToIdle(); router.push(`/brand/${scanResult?.brand?.id ?? 'b1'}`); }}
          >
            <Text style={[s.outlineBtnText, { color: colors.gold }]}>View Brand Details</Text>
          </Pressable>
          <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={resetToIdle}>
            <Text style={s.btnText}>Scan Next</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Already saved ─────────────────────────────────────────────────────────
  if (scanState === 'already_saved' && scanResult?.brand) {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Ionicons name="bookmark" size={48} color={colors.accent} />
        <Text style={[s.successTitle, { color: colors.text }]}>Already saved</Text>
        <Text style={[s.successSub, { color: colors.textSecondary }]}>
          {scanResult.brand.name} is already in your saves
        </Text>
        <Pressable
          style={[s.btn, { backgroundColor: colors.accent, marginTop: Spacing.xl }]}
          onPress={resetToIdle}
        >
          <Text style={s.btnText}>Scan Next</Text>
        </Pressable>
      </View>
    );
  }

  // ── Already connected ─────────────────────────────────────────────────────
  if (scanState === 'already_connected' && scanResult?.connection) {
    const { user: connUser } = scanResult.connection;
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Ionicons name="people" size={52} color={colors.accent} />
        <Text style={[s.successTitle, { color: colors.text }]}>Already connected</Text>
        <Text style={[s.successSub, { color: colors.textSecondary }]}>
          You're already connected with {connUser.full_name}
        </Text>
        <Pressable
          style={[s.btn, { backgroundColor: colors.accent, marginTop: Spacing.lg }]}
          onPress={() => {
            resetToIdle();
            setPendingConnectionOpen((connUser as any).id ?? connUser.designup_user_id ?? null);
            router.push('/(app)/connections');
          }}
        >
          <Text style={s.btnText}>View Connection</Text>
        </Pressable>
        <Pressable style={s.textBtn} onPress={resetToIdle}>
          <Text style={[s.textBtnText, { color: colors.textMuted }]}>Done</Text>
        </Pressable>
      </View>
    );
  }

  // ── Connection created ────────────────────────────────────────────────────
  if (scanState === 'success_connection' && scanResult?.connection) {
    const { user: connUser } = scanResult.connection;
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Ionicons name="person-add" size={52} color={colors.accent} />
        <Text style={[s.successTitle, { color: colors.text }]}>
          {connUser.full_name} saved!
        </Text>
        <Text style={[s.successSub, { color: colors.textSecondary }]}>
          {connUser.designation} · {connUser.company_name}
        </Text>
        <Pressable
          style={[s.btn, { backgroundColor: colors.accent, marginTop: Spacing.lg }]}
          onPress={() => {
            resetToIdle();
            setPendingConnectionOpen((connUser as any).id ?? connUser.designup_user_id ?? null);
            router.push('/(app)/connections');
          }}
        >
          <Text style={s.btnText}>View Card</Text>
        </Pressable>
        <Pressable style={s.textBtn} onPress={resetToIdle}>
          <Text style={[s.textBtnText, { color: colors.textMuted }]}>Done</Text>
        </Pressable>
      </View>
    );
  }

  // ── Exhibition entry ──────────────────────────────────────────────────────
  if (scanState === 'success_entry' && scanResult?.exhibition) {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Ionicons name="checkmark-circle" size={56} color={colors.accent} />
        <Text style={[s.successTitle, { color: colors.text }]}>Welcome!</Text>
        <Text style={[s.successSub, { color: colors.textSecondary }]}>
          {scanResult.exhibition.name} is now active on your dashboard
        </Text>
        <Pressable
          style={[s.btn, { backgroundColor: colors.accent, marginTop: Spacing.xl }]}
          onPress={() => {
            resetToIdle();
            router.replace('/(app)');
          }}
        >
          <Text style={s.btnText}>Go to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (scanState === 'error') {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF4444" />
        <Text style={[s.successTitle, { color: colors.text }]}>Couldn't connect</Text>
        <Text style={[s.successSub, { color: colors.textSecondary }]} selectable>{scanError || 'Try scanning again'}</Text>
        <Pressable
          style={[s.btn, { backgroundColor: colors.accent, marginTop: Spacing.xl }]}
          onPress={resetToIdle}
        >
          <Text style={s.btnText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  // ── Choice screen ─────────────────────────────────────────────────────────
  if (scanView === 'choice') {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: headerPaddingTop as any }]}>
          <Text style={[s.headerTitle, { color: colors.text }]}>Scanner</Text>
          <Pressable onPress={() => setShowInfo(true)} hitSlop={12}>
            <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={s.choiceWrap}>
          <Pressable
            style={[s.choiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              if (Platform.OS === 'web') {
                const seen = await AsyncStorage.getItem('camera_notice_seen');
                if (!seen) { pendingScanView.current = 'card'; setShowCameraNotice(true); return; }
              }
              setScanView('card');
            }}
          >
            <View style={[s.choiceIconWrap, { backgroundColor: colors.accent + '18' }]}>
              <Ionicons name="card-outline" size={36} color={colors.accent} />
            </View>
            <Text style={[s.choiceTitle, { color: colors.text }]}>Scan a visiting card</Text>
            <Text style={[s.choiceSub, { color: colors.textMuted }]}>Auto-reads name, phone and email</Text>
          </Pressable>

          <Pressable
            style={[s.choiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              if (Platform.OS === 'web') {
                const seen = await AsyncStorage.getItem('camera_notice_seen');
                if (!seen) { pendingScanView.current = 'qr'; setShowCameraNotice(true); return; }
              }
              setScanView('qr');
            }}
          >
            <View style={[s.choiceIconWrap, { backgroundColor: colors.accent + '18' }]}>
              <Ionicons name="qr-code-outline" size={36} color={colors.accent} />
            </View>
            <Text style={[s.choiceTitle, { color: colors.text }]}>Scan a Connect QR</Text>
            <Text style={[s.choiceSub, { color: colors.textMuted }]}>Saves their contact instantly</Text>
          </Pressable>

        </View>

        <Modal visible={showInfo} transparent animationType="slide" onRequestClose={() => setShowInfo(false)}>
          <Pressable style={s.infoBackdrop} onPress={() => setShowInfo(false)} />
          <View style={[s.infoSheet, { backgroundColor: colors.surface }]}>
            <View style={[s.infoSheetHandle, { backgroundColor: colors.border }]} />
            <View style={s.infoSheetHeaderRow}>
              <Text style={[s.infoSheetTitle, { color: colors.text }]}>How it works</Text>
              <Pressable onPress={() => setShowInfo(false)} hitSlop={12}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
            </View>
            {[
              { n: '1', line: 'Choose "Scan a visiting card" to read paper cards' },
              { n: '2', line: 'Choose "Scan a Connect QR" to connect with someone on Connect' },
              { n: '3', line: "Card scan auto-captures when steady; QR saves the moment it's detected" },
            ].map((item, i, arr) => (
              <View key={item.n}>
                <View style={s.infoStep}>
                  <View style={[s.infoStepNum, { backgroundColor: colors.accent }]}><Text style={s.infoStepNumText}>{item.n}</Text></View>
                  <Text style={[s.infoStepLine, { color: colors.text }]}>{item.line}</Text>
                </View>
                {i < arr.length - 1 && <View style={[s.infoRule, { backgroundColor: colors.border }]} />}
              </View>
            ))}
          </View>
        </Modal>

        {/* One-time camera notice — web/PWA only */}
        <Modal visible={showCameraNotice} transparent animationType="slide" onRequestClose={() => setShowCameraNotice(false)}>
          <Pressable style={s.infoBackdrop} onPress={() => setShowCameraNotice(false)} />
          <View style={[s.infoSheet, { backgroundColor: colors.surface }]}>
            <View style={[s.infoSheetHandle, { backgroundColor: colors.border }]} />
            <View style={[s.noticeIconRow]}>
              <View style={[s.noticeIconWrap, { backgroundColor: '#FF3B3020' }]}>
                <Ionicons name="videocam-outline" size={28} color="#FF3B30" />
              </View>
            </View>
            <Text style={[s.infoSheetTitle, { color: colors.text, textAlign: 'center' }]}>Camera access notice</Text>
            <Text style={[s.noticeSub, { color: colors.textSecondary }]}>
              The red bar at the top of your screen confirms your camera is active — this is iOS letting you know the app is using it to scan.{'\n\n'}It disappears as soon as you leave the scanner.
            </Text>
            <Pressable
              style={[s.noticeCta, { backgroundColor: colors.accent }]}
              onPress={async () => {
                await AsyncStorage.setItem('camera_notice_seen', '1');
                setShowCameraNotice(false);
                setScanView(pendingScanView.current);
              }}
            >
              <Text style={s.noticeCtaText}>Got it, open scanner</Text>
            </Pressable>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Card mode ─────────────────────────────────────────────────────────────
  if (scanView === 'card') {
    return (
      <View style={[s.root, { backgroundColor: '#000' }]}>
        <View style={[s.modeHeader, { paddingTop: headerPaddingTop as any }]}>
          <Pressable onPress={() => setScanView('choice')} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
          <Text style={[s.modeHeaderTitle, { color: '#FFF' }]}>Visiting Card</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Full-bleed camera — no container, fills remaining space */}
        <View style={{ flex: 1 }}>
          {Platform.OS === 'web' ? (
            <WebCardScanner
              ref={webCardScannerRef}
              active={isFocused && !isCaptureProcessing && !isGalleryImporting}
              autoCapture
              torchOn={torchOn}
              onTorchSupportChange={setWebTorchSupported}
              errorHint={cardScanError}
              onQRDetected={(data) => {
                if (!isDesignupQR(data)) return false;
                handleBarCodeScanned({ data });
                return true;
              }}
              onCapture={async (base64Jpeg) => {
                const wasManual = isManualCapture.current;
                isManualCapture.current = false;
                // Manual capture stops the camera and shows a loading state.
                // Auto-capture leaves the camera live — WebCardScanner's pauseUntilRef
                // already blocks re-capture for 5 s, so there's no need to stop the stream.
                // Stopping the camera on auto-captures caused getUserMedia restart failures on iOS.
                if (wasManual) setIsCaptureProcessing(true);
                // jsQR check before OCR — ~50ms, no API cost.
                // If a Connect QR is in frame, route immediately and skip OCR entirely.
                const qrFromFrame = await decodeQRFromBase64(base64Jpeg);
                if (qrFromFrame && isDesignupQR(qrFromFrame)) {
                  if (wasManual) setIsCaptureProcessing(false);
                  handleBarCodeScanned({ data: qrFromFrame });
                  return;
                }
                const imageDataUrl = `data:image/jpeg;base64,${base64Jpeg}`;
                let blocks: any[] = [];
                try { blocks = await recognizeCardTextWeb(base64Jpeg); } catch (_) {}
                const fields = parseCardFields(blocks);
                // For auto-capture: only proceed if OCR found a phone or email.
                // Vision boards, keyboards, and other non-card objects won't have these.
                // Manual capture bypasses this check — the user explicitly chose to scan.
                const hasContactInfo = fields.some(
                  (f: any) => f.label === 'Phone' || f.label === 'WhatsApp' || f.label === 'Email' || f.label === 'Fax'
                );
                if (!hasContactInfo && !wasManual) {
                  setCardScanError('No card detected — position card fully in the frame');
                  if (cardScanErrorTimer.current) clearTimeout(cardScanErrorTimer.current);
                  cardScanErrorTimer.current = setTimeout(() => setCardScanError(null), 2500);
                  return;
                }
                cardScanStore.set({ imageUri: imageDataUrl, backImageUri: null, fields, isBlurry: blocks.length < 2 });
                Analytics.cardScanned(fields.length > 0);
                if (wasManual) setIsCaptureProcessing(false);
                router.push('/card-review');
              }}
            />
          ) : isFocused ? (
            <CameraView style={s.camera} facing="back" active enableTorch={torchOn}>
              <View style={s.cardBracketOverlay}>
                <View style={s.cardBracket}>
                  <View style={[s.cCorner, s.cCornerTL, { borderColor: colors.accent }]} />
                  <View style={[s.cCorner, s.cCornerTR, { borderColor: colors.accent }]} />
                  <View style={[s.cCorner, s.cCornerBL, { borderColor: colors.accent }]} />
                  <View style={[s.cCorner, s.cCornerBR, { borderColor: colors.accent }]} />
                </View>
              </View>
            </CameraView>
          ) : (
            <View style={[s.camera, { backgroundColor: '#000' }]} />
          )}
        </View>

        {/* Round icon buttons */}
        <View style={[s.roundBtnRow, { paddingBottom: bottomInset + 36 }]}>
          <View style={s.roundBtnItem}>
            <Pressable
              style={[s.roundBtnSm, { backgroundColor: 'rgba(255,255,255,0.12)' }]}
              onPress={handleGalleryImport}
              disabled={isGalleryImporting || isCaptureProcessing}
            >
              {isGalleryImporting
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Ionicons name="images-outline" size={22} color="#FFF" />
              }
            </Pressable>
            <Text style={s.roundBtnLabel}>Upload Card</Text>
          </View>

          <View style={s.roundBtnItem}>
            <Pressable
              style={[s.roundBtnLg, { backgroundColor: colors.accent, opacity: isCaptureProcessing ? 0.7 : 1 }]}
              disabled={isCaptureProcessing || isGalleryImporting}
              onPress={() => {
                Analytics.captureCardTapped();
                if (Platform.OS === 'web') { isManualCapture.current = true; webCardScannerRef.current?.capture(); }
                else { router.push('/card-scanner'); }
              }}
            >
              {isCaptureProcessing
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Ionicons name="camera-outline" size={30} color="#FFF" />
              }
            </Pressable>
            <Text style={s.roundBtnLabel}>Capture Card</Text>
          </View>

          {(Platform.OS !== 'web' || webTorchSupported) && (
            <View style={s.roundBtnItem}>
              <Pressable
                style={[s.roundBtnSm, { backgroundColor: torchOn ? 'rgba(255,224,102,0.25)' : 'rgba(255,255,255,0.12)' }]}
                onPress={() => setTorchOn(v => !v)}
              >
                <Ionicons name={torchOn ? 'flashlight' : 'flashlight-outline'} size={22} color={torchOn ? '#FFE066' : '#FFF'} />
              </Pressable>
              <Text style={s.roundBtnLabel}>Torch</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── QR mode ───────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: '#000' }]}>
      {/* Header — sits at top in normal flow, no absolute positioning */}
      <View style={[s.qrHeader, { paddingTop: headerPaddingTop as any }]}>
        <Pressable onPress={() => setScanView('choice')} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </Pressable>
        <Text style={s.qrHeaderTitle}>Connect QR</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Camera fills remaining vertical space */}
      {Platform.OS === 'web' ? (
        <WebQRScanner
          active={isFocused && scanState === 'idle'}
          onScan={(data) => handleBarCodeScanned({ data })}
          torchOn={torchOn}
          onTorchSupportChange={setWebTorchSupported}
        />
      ) : isFocused ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          active
          enableTorch={torchOn}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanState === 'idle' ? handleBarCodeScanned : undefined}
        >
          <View style={[s.cardFrameWrap, { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }]}>
            <View style={[s.qrFrame, { borderColor: colors.accent + '50' }]}>
              <View style={[s.cCorner, s.cCornerTL, { borderColor: colors.accent }]} />
              <View style={[s.cCorner, s.cCornerTR, { borderColor: colors.accent }]} />
              <View style={[s.cCorner, s.cCornerBL, { borderColor: colors.accent }]} />
              <View style={[s.cCorner, s.cCornerBR, { borderColor: colors.accent }]} />
            </View>
          </View>
        </CameraView>
      ) : (
        <View style={{ flex: 1, backgroundColor: '#000' }} />
      )}

      {/* Bottom controls — torch + switch hint, sit below camera in normal flow */}
      <View style={[s.qrBottom, { paddingBottom: bottomInset + 16 }]}>
        {(Platform.OS !== 'web' || webTorchSupported) && (
          <View style={s.roundBtnItem}>
            <Pressable
              style={[s.roundBtnSm, { backgroundColor: torchOn ? 'rgba(255,224,102,0.25)' : 'rgba(255,255,255,0.12)' }]}
              onPress={() => setTorchOn(v => !v)}
            >
              <Ionicons name={torchOn ? 'flashlight' : 'flashlight-outline'} size={22} color={torchOn ? '#FFE066' : '#FFF'} />
            </Pressable>
            <Text style={s.roundBtnLabel}>Torch</Text>
          </View>
        )}
        <Pressable style={s.qrSwitchBtn} onPress={() => setScanView('card')}>
          <Ionicons name="card-outline" size={16} color={colors.accent} />
          <Text style={[s.qrSwitchBtnText, { color: colors.accent }]}>Have a visiting card instead?</Text>
        </Pressable>
      </View>
    </View>
  );

}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },

    // Choice screen
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    choiceWrap: { flex: 1, padding: Spacing.lg, gap: Spacing.md, justifyContent: 'center' },
    galleryLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
    galleryLinkText: { fontSize: FontSize.sm },
    choiceCard: {
      flex: 1, borderRadius: Radius.lg, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg,
    },
    choiceIconWrap: {
      width: 72, height: 72, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
    },
    choiceTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
    choiceSub: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 18 },

    // Mode headers (card / QR modes)
    modeHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    },
    modeHeaderTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    // Camera
    camera: { flex: 1 },
    // Card mode — native bracket overlay (corner brackets only, no border)
    cardBracketOverlay: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
    },
    cardBracket: { width: 300, height: 188, position: 'relative' as any },
    // QR frame (kept for QR mode)
    cardFrameWrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.28)', gap: Spacing.md,
    },
    qrFrame: { width: 200, height: 200, borderRadius: 10, borderWidth: 1, position: 'relative' },
    // Shared corner bracket pieces (used by both card and QR modes)
    cCorner: { position: 'absolute', width: 28, height: 28, borderWidth: 3 },
    cCornerTL: { top: -2, left: -2, borderBottomWidth: 0, borderRightWidth: 0 },
    cCornerTR: { top: -2, right: -2, borderBottomWidth: 0, borderLeftWidth: 0 },
    cCornerBL: { bottom: -2, left: -2, borderTopWidth: 0, borderRightWidth: 0 },
    cCornerBR: { bottom: -2, right: -2, borderTopWidth: 0, borderLeftWidth: 0 },

    // Card mode — round icon buttons
    roundBtnRow: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
      gap: 48, paddingTop: 28, backgroundColor: '#000',
    },
    roundBtnItem: { alignItems: 'center', gap: 8 },
    roundBtnLg: {
      width: 72, height: 72, borderRadius: 36,
      alignItems: 'center', justifyContent: 'center',
    },
    roundBtnSm: {
      width: 56, height: 56, borderRadius: 28,
      alignItems: 'center', justifyContent: 'center',
    },
    roundBtnLabel: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.medium },

    // QR mode header — normal flow, no absolute positioning
    qrHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    },
    qrHeaderTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#FFF' },
    // QR mode bottom bar — sits below camera in normal flow
    qrBottom: {
      alignItems: 'center',
      gap: 16,
      paddingTop: 20,
      backgroundColor: '#000',
    },
    qrSwitchBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 10, paddingHorizontal: 20,
      borderRadius: Radius.full,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    qrSwitchBtnText: {
      fontSize: FontSize.sm, fontWeight: FontWeight.medium,
    },

    // Info bottom sheet
    infoBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    infoSheet: {
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.md, gap: Spacing.sm,
    },
    infoSheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.sm },
    infoSheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
    infoSheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    noticeIconRow: { alignItems: 'center', marginBottom: Spacing.md },
    noticeIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    noticeSub: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.lg },
    noticeCta: { borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    noticeCtaText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    infoStep: {
      flexDirection: 'row', gap: Spacing.md,
      paddingHorizontal: Spacing.md, paddingVertical: 12, alignItems: 'flex-start',
    },
    infoStepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    infoStepNumText: { color: '#FFF', fontSize: 11, fontWeight: FontWeight.bold },
    infoStepLine: { fontSize: FontSize.sm, flex: 1 },
    infoRule: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.md + 22 + Spacing.md },

    // Scanning / saving states
    savingIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
    scanningOverlay: { alignItems: 'center', gap: Spacing.lg },
    scanningIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    scanningText: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },

    // Success / result screens
    successScroll: { alignItems: 'center', padding: Spacing.xl, paddingBottom: 120, gap: Spacing.md },
    successTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, textAlign: 'center' },
    successSub: { fontSize: FontSize.md, textAlign: 'center' },
    productImgRow: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },
    productImg: { flex: 1, height: 140, borderRadius: Radius.md },
    boothTag: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full,
    },
    boothTagText: { fontSize: FontSize.sm },
    outlineBtn: { width: '100%', paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center' },
    outlineBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    btn: { width: '100%', paddingVertical: 16, borderRadius: Radius.md, alignItems: 'center' },
    btnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    textBtn: { marginTop: Spacing.sm, alignItems: 'center', paddingVertical: Spacing.sm },
    textBtnText: { fontSize: FontSize.sm },
    permTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center', marginTop: Spacing.lg },
    permBody: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22, marginVertical: Spacing.lg },
  });
}
