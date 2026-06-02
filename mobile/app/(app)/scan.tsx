import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image,
  TextInput, ScrollView, Modal, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { processScan } from '../../lib/supabase';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { ALL_BRANDS } from '../../data/brands';
import type { ScanResult } from '../../types';

type ScanState = 'idle' | 'scanning' | 'saving_brand' | 'saving_connection' | 'success_brand' | 'success_connection' | 'success_entry' | 'already_saved' | 'error';

export default function ScanScreen() {
  const { colors } = useTheme();
  const { activeExhibitionId, activeExhibitionName, user, addDemoSavedBrand, addDemoConnection, setActiveExhibition } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [brandSearch, setBrandSearch] = useState('');
  const [showMyQR, setShowMyQR] = useState(false);
  const isProcessing = useRef(false);

  const s = makeStyles(colors);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    setScanState('scanning');

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
            // Use the exhibition embedded in the QR; null means showroom visit
            const qrExhibitionName = b.exhibition_name ?? null;
            const qrExhibitionId = qrExhibitionName ? (activeExhibitionId ?? null) : null;
            addDemoSavedBrand({
              id: `scan-save-${b.id}-${Date.now()}`,
              brand_id: b.id,
              brand_name: b.name,
              brand_category: b.category,
              brand_tagline: b.tagline ?? '',
              product_image_url: b.product_images[0] ?? '',
              exhibition_id: qrExhibitionId,
              exhibition_name: qrExhibitionName,
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
            brand_id: u.brand_id,
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

  const resetToIdle = () => {
    setScanState('idle');
    setScanResult(null);
    isProcessing.current = false;
  };

  // ── No permission yet ──────────────────────────────────────────────────────
  if (!permission) return <View style={[s.root, { backgroundColor: colors.background }]} />;

  if (!permission.granted) {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-outline" size={56} color={colors.textSecondary} />
        <Text style={[s.permTitle, { color: colors.text }]}>Camera Access Required</Text>
        <Text style={[s.permBody, { color: colors.textSecondary }]}>
          Designup Connect needs camera access to scan booth QR codes at exhibitions.
        </Text>
        <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={requestPermission}>
          <Text style={s.btnText}>Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  // ── Scanning overlay ───────────────────────────────────────────────────────
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

  // ── Brand saving spinner ──────────────────────────────────────────────────
  if (scanState === 'saving_brand') {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <View style={[s.savingIcon, { backgroundColor: colors.accent + '22' }]}>
          <Ionicons name="sync-outline" size={36} color={colors.accent} />
        </View>
        <Text style={[s.successTitle, { color: colors.text }]}>Saving...</Text>
        <Text style={[s.successSub, { color: colors.textMuted }]}>
          Saving {scanResult?.brand?.name} to your saved
        </Text>
      </View>
    );
  }

  // ── Connection saving spinner ──────────────────────────────────────────────
  if (scanState === 'saving_connection') {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <View style={[s.savingIcon, { backgroundColor: colors.accent + '22' }]}>
          <Ionicons name="sync-outline" size={36} color={colors.accent} />
        </View>
        <Text style={[s.successTitle, { color: colors.text }]}>Saving...</Text>
        <Text style={[s.successSub, { color: colors.textMuted }]}>
          Saving {scanResult?.connection?.user.full_name}'s contact
        </Text>
      </View>
    );
  }

  // ── Brand saved success ────────────────────────────────────────────────────
  if (scanState === 'success_brand' && scanResult?.brand) {
    const { brand } = scanResult;
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={s.successScroll}>
          <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
          <Text style={[s.successTitle, { color: colors.text }]}>
            {brand.name} saved successfully
          </Text>
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

          <Pressable style={[s.outlineBtn, { borderColor: colors.gold }]} onPress={() => { resetToIdle(); router.push(`/brand/${scanResult?.brand?.id ?? 'b1'}`); }}>
            <Text style={[s.outlineBtnText, { color: colors.gold }]}>View Brand Details</Text>
          </Pressable>

          <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={resetToIdle}>
            <Text style={s.btnText}>Scan Next</Text>
          </Pressable>

          <Text style={[s.revisitNote, { color: colors.textMuted }]}>
            You can revisit this anytime after the show
          </Text>
        </ScrollView>
      </View>
    );
  }

  // ── Already saved ──────────────────────────────────────────────────────────
  if (scanState === 'already_saved' && scanResult?.brand) {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Ionicons name="bookmark" size={48} color={colors.accent} />
        <Text style={[s.successTitle, { color: colors.text }]}>Already saved</Text>
        <Text style={[s.successSub, { color: colors.textSecondary }]}>
          {scanResult.brand.name} is already in your saved
        </Text>
        <Pressable style={[s.btn, { backgroundColor: colors.accent, marginTop: Spacing.xl }]} onPress={resetToIdle}>
          <Text style={s.btnText}>Scan Next</Text>
        </Pressable>
      </View>
    );
  }

  // ── Connection created ─────────────────────────────────────────────────────
  if (scanState === 'success_connection' && scanResult?.connection) {
    const { user } = scanResult.connection;
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Ionicons name="person-add" size={52} color={colors.accent} />
        <Text style={[s.successTitle, { color: colors.text }]}>
          {user.full_name} saved in your connections
        </Text>
        <Text style={[s.successSub, { color: colors.textSecondary }]}>
          {user.designation} · {user.company_name}
        </Text>
        <Pressable style={[s.btn, { backgroundColor: colors.accent, marginTop: Spacing.lg }]} onPress={() => { resetToIdle(); router.push('/(app)/connections'); }}>
          <Text style={s.btnText}>View Connections</Text>
        </Pressable>
        <Pressable style={s.textBtn} onPress={resetToIdle}>
          <Text style={[s.textBtnText, { color: colors.textMuted }]}>Done</Text>
        </Pressable>
      </View>
    );
  }

  // ── Exhibition entry activated ─────────────────────────────────────────────
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

  // ── Error ──────────────────────────────────────────────────────────────────
  if (scanState === 'error') {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF4444" />
        <Text style={[s.successTitle, { color: colors.text }]}>Not recognized</Text>
        <Text style={[s.successSub, { color: colors.textSecondary }]}>
          This QR code isn't a Designup code
        </Text>
      </View>
    );
  }

  // ── Main scanner UI ────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
      </View>

      <ScrollView stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
        {/* Camera */}
        <View style={s.cameraWrap}>
          <CameraView
            style={s.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanState === 'idle' ? handleBarCodeScanned : undefined}
          >
            {/* Scan frame indicator centered */}
            <View style={s.scanFrameWrap}>
              <View style={[s.scanFrame, { borderColor: colors.accent }]}>
                <View style={[s.corner, s.cornerTL, { borderColor: colors.accent }]} />
                <View style={[s.corner, s.cornerTR, { borderColor: colors.accent }]} />
                <View style={[s.corner, s.cornerBL, { borderColor: colors.accent }]} />
                <View style={[s.corner, s.cornerBR, { borderColor: colors.accent }]} />
              </View>
              <Text style={s.scanHint}>Scan QR to save brand or connection</Text>
            </View>
          </CameraView>
        </View>

        {/* Manual brand search */}
        <View style={s.belowCamera}>
          <View style={[s.infoBlurb, { backgroundColor: colors.surface }]}>
            <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
            <Text style={[s.infoBlurbText, { color: colors.textMuted }]}>
              Point the camera at a booth QR code to save the brand instantly. Or type a brand name below to search and save manually.
            </Text>
          </View>
          <View style={[s.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={[s.searchInput, { color: colors.text }]}
              placeholder="Type brand name to save"
              placeholderTextColor={colors.textMuted}
              value={brandSearch}
              onChangeText={setBrandSearch}
            />
            {brandSearch.length > 0 && (
              <Pressable onPress={() => setBrandSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          {/* Brand suggestions — show after 1 char */}
          {brandSearch.length >= 1 && (() => {
            const q = brandSearch.toLowerCase();
            const suggestions = ALL_BRANDS.filter((b) =>
              b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q)
            );
            if (suggestions.length === 0) {
              return (
                <View style={[s.suggestEmpty, { backgroundColor: colors.surface }]}>
                  <Text style={[s.suggestEmptyText, { color: colors.textMuted }]}>No brands found matching "{brandSearch}"</Text>
                </View>
              );
            }
            return (
              <View style={[s.suggestList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {suggestions.map((b) => (
                  <Pressable
                    key={b.id}
                    style={[s.suggestItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      handleBarCodeScanned({ data: `booth:${b.id}:exh-001` });
                      setBrandSearch('');
                    }}
                  >
                    <View style={[s.suggestInitial, { backgroundColor: colors.accent + '22' }]}>
                      <Text style={[s.suggestInitialText, { color: colors.accent }]}>{b.logo_initial}</Text>
                    </View>
                    <View style={s.suggestInfo}>
                      <Text style={[s.suggestName, { color: colors.text }]}>{b.name}</Text>
                      <Text style={[s.suggestMeta, { color: colors.textMuted }]}>{b.category} · Booth {b.booth_number}</Text>
                    </View>
                    <View style={[s.suggestSave, { backgroundColor: colors.accent }]}>
                      <Text style={s.suggestSaveText}>Save</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            );
          })()}

          {/* My Visiting QR */}
          <Pressable style={[s.visitingQrBtn, { backgroundColor: colors.surface }]} onPress={() => setShowMyQR(true)}>
            <Ionicons name="qr-code-outline" size={20} color={colors.accent} />
            <Text style={[s.visitingQrText, { color: colors.text }]}>My Visiting QR</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          {/* How it works */}
          <View style={[s.howCard, { backgroundColor: colors.surface }]}>
            <Text style={[s.howTitle, { color: colors.text }]}>How Scanner Works</Text>
            {[
              'Point camera at booth QR code to save a brand',
              "Scan others' personal QR code to exchange digital visiting cards",
              'Revisit it later when you need it',
            ].map((step, i) => (
              <View key={i} style={s.howRow}>
                <Text style={[s.howNum, { color: colors.accent }]}>{i + 1}</Text>
                <Text style={[s.howText, { color: colors.textSecondary }]}>{step}</Text>
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
            <Pressable style={[s.myQrClose, { backgroundColor: colors.accent }]} onPress={() => setShowMyQR(false)}>
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

    // Camera
    cameraWrap: { width: '100%', height: 320 },
    camera: { flex: 1 },
    scanFrameWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    scanFrame: {
      width: 200,
      height: 200,
      position: 'relative',
    },
    corner: {
      position: 'absolute',
      width: 20,
      height: 20,
      borderWidth: 3,
    },
    cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
    cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
    cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
    cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
    scanHint: {
      color: '#FFF',
      fontSize: FontSize.sm,
      marginTop: Spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radius.full,
      overflow: 'hidden',
    },

    // Below camera
    belowCamera: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
    infoBlurb: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', borderRadius: Radius.md, padding: Spacing.sm },
    infoBlurbText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },
    // Brand suggestions
    suggestList: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
    suggestEmpty: { borderRadius: Radius.md, padding: Spacing.md },
    suggestEmptyText: { fontSize: FontSize.sm, textAlign: 'center' },
    suggestItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
    suggestInitial: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    suggestInitialText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
    suggestInfo: { flex: 1 },
    suggestName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    suggestMeta: { fontSize: FontSize.xs, marginTop: 2 },
    suggestSave: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm },
    suggestSaveText: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      height: 48,
    },
    searchInput: { flex: 1, fontSize: FontSize.md },
    saveBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm },
    saveBtnText: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    visitingQrBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: Radius.md,
    },
    visitingQrText: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },
    howCard: { borderRadius: Radius.md, padding: Spacing.md },
    howTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: Spacing.md },
    howRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm, alignItems: 'flex-start' },
    howNum: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, width: 16 },
    howText: { fontSize: FontSize.sm, flex: 1, lineHeight: 20 },

    // Saving spinner
    savingIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },

    // Scanning overlay
    scanningOverlay: { alignItems: 'center', gap: Spacing.lg },
    scanningIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    scanningText: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },

    // Success screens
    successScroll: { alignItems: 'center', padding: Spacing.xl, paddingBottom: 120, gap: Spacing.md },
    successCheck: {},
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
    revisitNote: { fontSize: FontSize.sm, textAlign: 'center' },

    textBtn: { marginTop: Spacing.sm, alignItems: 'center', paddingVertical: Spacing.sm },
    textBtnText: { fontSize: FontSize.sm },

    notesNudge: {
      width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
      borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
    },
    notesNudgeText: { flex: 1, fontSize: FontSize.sm, lineHeight: 18 },

    // Permission screen
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
      paddingBottom: 40, width: '100%', maxWidth: 390,
    },
    myQrTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
    myQrSub: { fontSize: FontSize.sm, textAlign: 'center' },
    myQrBox: { padding: Spacing.lg, borderRadius: Radius.lg },
    myQrId: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    myQrClose: { width: '100%', paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.sm },
    myQrCloseText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  });
}
