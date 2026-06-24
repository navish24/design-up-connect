import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image,
  ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { processScan } from '../../lib/supabase';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { recognizeCardText, parseCardFields } from '../../lib/cardOcr';
import { cardScanStore } from '../../lib/cardScanStore';
import type { ScanResult } from '../../types';

type ScanState =
  | 'idle'
  | 'scanning'
  | 'saving_brand'
  | 'saving_connection'
  | 'success_brand'
  | 'success_connection'
  | 'success_entry'
  | 'already_saved'
  | 'error';

// Only process QRs that belong to this app; silently ignore everything else
// (website links, social QRs, etc. printed on physical visiting cards).
const isDesignupQR = (payload: string): boolean =>
  payload.startsWith('https://nexgild.com/') ||
  payload.startsWith('designup://') ||
  // Legacy / dev formats kept for backward compatibility
  payload.startsWith('booth:') ||
  payload.startsWith('user:') ||
  payload.startsWith('entry:');

const HOW_IT_WORKS = [
  {
    icon: 'card-outline' as const,
    label: 'Scan physical visiting cards',
    description:
      'Tap "Scan Visiting Card", place the card flat and capture it. Contacts are saved and organised automatically.',
  },
  {
    icon: 'people-outline' as const,
    label: 'Connect with people',
    description:
      "Scan someone's Nexgild personal QR to exchange digital visiting cards instantly — no number sharing needed.",
  },
  {
    icon: 'storefront-outline' as const,
    label: 'Save a brand (coming soon)',
    description:
      "At an exhibition, point at a brand's booth QR to save their catalogue and stay updated on new products.",
  },
];

export default function ScanScreen() {
  const { colors } = useTheme();
  const { activeExhibitionId, user, addDemoSavedBrand, addDemoConnection, setActiveExhibition } =
    useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showMyQR, setShowMyQR] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const isProcessing = useRef(false);

  const handleGalleryImport = async () => {
    setIsImporting(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.[0]) { setIsImporting(false); return; }
      const imageUri = result.assets[0].uri;
      const blocks = await recognizeCardText(imageUri);
      const fields = parseCardFields(blocks);
      cardScanStore.set({ imageUri, backImageUri: null, fields, isBlurry: blocks.length < 2 });
      setIsImporting(false);
      router.push('/card-review');
    } catch {
      setIsImporting(false);
    }
  };

  const s = makeStyles(colors);

  const resetToIdle = () => {
    setScanState('idle');
    setScanResult(null);
    isProcessing.current = false;
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!isDesignupQR(data)) return; // silently discard foreign QRs
    if (isProcessing.current) return;
    isProcessing.current = true;
    setScanState('scanning');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const result: ScanResult = await processScan(data, activeExhibitionId);
      setScanResult(result);

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
        setScanState('saving_connection');
        if (result.connection) {
          const u = result.connection.user;
          addDemoConnection({
            id: u.designup_user_id,
            full_name: u.full_name,
            designation: u.designation ?? '',
            company: u.company_name ?? '',
            brand_id: (u as any).brand_id,
            email: (u as any).email ?? '',
            phone: (u as any).phone ?? '',
            city: (u as any).city ?? '',
          });
        }
        setTimeout(() => setScanState('success_connection'), 1800);
      } else if (result.scan_type === 'entry') {
        if (result.exhibition) {
          setActiveExhibition(result.exhibition.id, result.exhibition.name);
        }
        setScanState('success_entry');
        setTimeout(() => {
          resetToIdle();
          router.replace('/(app)');
        }, 2000);
      }
    } catch {
      setScanState('error');
      setTimeout(resetToIdle, 2000);
    }
  };

  // ── No permission ─────────────────────────────────────────────────────────
  if (!permission) return <View style={[s.root, { backgroundColor: colors.background }]} />;

  if (!permission.granted) {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-outline" size={56} color={colors.textSecondary} />
        <Text style={[s.permTitle, { color: colors.text }]}>Camera Access Required</Text>
        <Text style={[s.permBody, { color: colors.textSecondary }]}>
          Designup Connect needs camera access to scan booth QR codes and visiting cards.
        </Text>
        <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={requestPermission}>
          <Text style={s.btnText}>Allow Camera</Text>
        </Pressable>
      </View>
    );
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
          onPress={() => { resetToIdle(); router.push('/(app)/connections'); }}
        >
          <Text style={s.btnText}>View Connections</Text>
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
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (scanState === 'error') {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF4444" />
        <Text style={[s.successTitle, { color: colors.text }]}>Couldn't connect</Text>
        <Text style={[s.successSub, { color: colors.textSecondary }]}>Try scanning again</Text>
      </View>
    );
  }

  // ── Main scanner UI ───────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Live viewfinder — always on for QR detection */}
        <View style={s.cameraWrap}>
          <CameraView
            style={s.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanState === 'idle' ? handleBarCodeScanned : undefined}
          >
            <View style={s.scanFrameWrap}>
              <View style={s.scanFrame}>
                <View style={[s.corner, s.cornerTL, { borderColor: colors.accent }]} />
                <View style={[s.corner, s.cornerTR, { borderColor: colors.accent }]} />
                <View style={[s.corner, s.cornerBL, { borderColor: colors.accent }]} />
                <View style={[s.corner, s.cornerBR, { borderColor: colors.accent }]} />
              </View>
              <Text style={s.scanHint}>Point at any Nexgild QR code to save</Text>
            </View>
          </CameraView>
        </View>

        <View style={s.below}>
          {/* Scan Visiting Card — primary CTA */}
          <Pressable
            style={[s.scanCardBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/card-scanner')}
          >
            <Ionicons name="card-outline" size={18} color="#FFF" />
            <Text style={s.scanCardBtnText}>Scan Visiting Card</Text>
          </Pressable>

          {/* Import from Gallery */}
          <Pressable
            style={[s.galleryBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleGalleryImport}
            disabled={isImporting}
          >
            {isImporting ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <>
                <Ionicons name="images-outline" size={18} color={colors.textSecondary} />
                <Text style={[s.galleryBtnText, { color: colors.textSecondary }]}>Import from Gallery</Text>
              </>
            )}
          </Pressable>

          <View style={[s.divider, { backgroundColor: colors.border }]} />

          {/* My Visiting QR */}
          <Pressable
            style={[s.qrRow, { backgroundColor: colors.surface }]}
            onPress={() => setShowMyQR(true)}
          >
            <Ionicons name="qr-code-outline" size={22} color={colors.accent} />
            <Text style={[s.qrRowText, { color: colors.text }]}>My Visiting QR</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={[s.divider, { backgroundColor: colors.border }]} />

          {/* How it works */}
          <View style={s.howSection}>
            <Text style={[s.howHeading, { color: colors.textMuted }]}>HOW IT WORKS</Text>
            {HOW_IT_WORKS.map((item) => (
              <View key={item.label} style={s.howItem}>
                <View style={[s.howIconWrap, { backgroundColor: colors.accent + '18' }]}>
                  <Ionicons name={item.icon} size={20} color={colors.accent} />
                </View>
                <View style={s.howContent}>
                  <Text style={[s.howLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[s.howDesc, { color: colors.textMuted }]}>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* My Visiting QR modal */}
      <Modal visible={showMyQR} animationType="slide" transparent>
        <View style={s.myQrOverlay}>
          <View style={[s.myQrModal, { backgroundColor: colors.surface }]}>
            <Text style={[s.myQrTitle, { color: colors.text }]}>My Visiting QR</Text>
            <Text style={[s.myQrSub, { color: colors.textSecondary }]}>
              Ask others to scan this to connect with you
            </Text>
            <View style={[s.myQrBox, { backgroundColor: colors.background }]}>
              <QRCode
                value={`user:${user?.id ?? 'user-001'}`}
                size={200}
                backgroundColor={colors.background}
                color={colors.text}
              />
            </View>
            {user?.designup_user_id && user.designup_user_id !== 'demo_user' && (
              <Text style={[s.myQrId, { color: colors.accent }]}>@{user.designup_user_id}</Text>
            )}
            <Pressable
              style={[s.myQrClose, { backgroundColor: colors.accent }]}
              onPress={() => setShowMyQR(false)}
            >
              <Text style={s.myQrCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: 56,
      paddingBottom: Spacing.md,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },

    // Viewfinder
    cameraWrap: { width: '100%', height: 420 },
    camera: { flex: 1 },
    scanFrameWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
      gap: Spacing.md,
    },
    scanFrame: {
      width: 200,
      height: 200,
      position: 'relative',
    },
    corner: {
      position: 'absolute',
      width: 22,
      height: 22,
      borderWidth: 3,
    },
    cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
    cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
    cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
    cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
    scanHint: {
      color: '#FFF',
      fontSize: FontSize.sm,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radius.full,
      overflow: 'hidden',
    },

    // Below camera
    below: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },

    scanCardBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: 16,
      borderRadius: Radius.md,
    },
    scanCardBtnText: {
      color: '#FFF',
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
    },

    galleryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: 14,
      borderRadius: Radius.md,
      borderWidth: 1,
    },
    galleryBtnText: {
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
    },

    divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },

    qrRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radius.md,
    },
    qrRowText: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },

    // How it works
    howSection: { gap: Spacing.md },
    howHeading: {
      fontSize: 11,
      fontWeight: FontWeight.semibold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    howItem: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    howIconWrap: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    howContent: { flex: 1, gap: 2 },
    howLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    howDesc: { fontSize: FontSize.xs, lineHeight: 18 },

    // Saving / scanning states
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
      paddingHorizontal: Spacing.md, paddingVertical: 6,
      borderRadius: Radius.full,
    },
    boothTagText: { fontSize: FontSize.sm },
    outlineBtn: {
      width: '100%', paddingVertical: 14, borderRadius: Radius.md,
      borderWidth: 1.5, alignItems: 'center',
    },
    outlineBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    btn: { width: '100%', paddingVertical: 16, borderRadius: Radius.md, alignItems: 'center' },
    btnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    textBtn: { marginTop: Spacing.sm, alignItems: 'center', paddingVertical: Spacing.sm },
    textBtnText: { fontSize: FontSize.sm },

    // Permission
    permTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center', marginTop: Spacing.lg },
    permBody: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22, marginVertical: Spacing.lg },

    // My QR modal
    myQrOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end', alignItems: 'center',
    },
    myQrModal: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: Spacing.xl, alignItems: 'center', gap: Spacing.md,
      paddingBottom: 40, width: '100%',
    },
    myQrTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
    myQrSub: { fontSize: FontSize.sm, textAlign: 'center' },
    myQrBox: { padding: Spacing.lg, borderRadius: Radius.lg },
    myQrId: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    myQrClose: { width: '100%', paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.sm },
    myQrCloseText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  });
}
