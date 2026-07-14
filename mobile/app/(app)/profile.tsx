import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput, Modal, FlatList, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Switch } from 'react-native';
import { useHeaderPaddingTop } from '../../lib/safeArea';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { ALL_BRANDS } from '../../data/brands';
import { getAllBrandsForSearch, type BrandSearchResult } from '../../lib/api';
import { isBeta } from '../../lib/betaConfig';
import { supabase } from '../../lib/supabase';
import { uploadProfilePhoto } from '../../lib/cloudinary';
import { Analytics } from '../../lib/analytics';

const PROFESSIONS = [
  'Interior Designer', 'Architect', 'Furniture Designer', 'Lighting Designer',
  'Product Designer', 'Studio Owner', 'Brand Owner', 'Consultant',
  'Founder', 'Contractor', 'Other',
];

export default function ProfileScreen() {
  const { colors, toggleTheme, isDark } = useTheme();
  const { user, updateUser, isLoading, signOut, resetDemoConnections, clearCardContacts } = useAuth();
  const headerPaddingTop = useHeaderPaddingTop();

  const [qrExpanded, setQrExpanded] = useState(false);
  const [showCardPreview, setShowCardPreview] = useState(false);
  // Snapshot of field values when edit modal opens — used for unsaved-changes guard
  const editOriginalRef = useRef<Record<string, string>>({});
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);


  const submitInvite = async () => {
    const phone = invitePhone.trim();
    if (phone.replace(/\D/g, '').length < 10) return;
    setInviteSubmitting(true);
    await supabase.from('invite_requests').insert({
      invited_by: user?.id ?? null,
      phone,
    });
    setInviteSubmitting(false);
    setInviteSent(true);
  };
  const [showEditDetails, setShowEditDetails] = useState(false);

  // Edit Details local state
  const [editFullName, setEditFullName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editProfession, setEditProfession] = useState('');
  const [editCustomProfession, setEditCustomProfession] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editLinkedin, setEditLinkedin] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editOtherUrl, setEditOtherUrl] = useState('');
  const [showProfessionPicker, setShowProfessionPicker] = useState(false);

  // Link Your Brand
  const [showLinkBrand, setShowLinkBrand] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [linkedBrand, setLinkedBrand] = useState<{ id: string; name: string; category: string } | null>(null);
  const [linkedBrandStatus, setLinkedBrandStatus] = useState<'pending' | 'approved'>('pending');
  const [allSearchBrands, setAllSearchBrands] = useState<BrandSearchResult[]>([]);

  useEffect(() => {
    if (!showLinkBrand) return;
    getAllBrandsForSearch().then((supabrands) => {
      const supaIds = new Set(supabrands.map((b) => b.id));
      const localOnly = ALL_BRANDS
        .filter((b) => !supaIds.has(b.id))
        .map((b): BrandSearchResult => ({ id: b.id, name: b.name, category: b.category }));
      setAllSearchBrands([...supabrands, ...localOnly]);
    }).catch(() => {
      setAllSearchBrands(ALL_BRANDS.map((b): BrandSearchResult => ({ id: b.id, name: b.name, category: b.category })));
    });
  }, [showLinkBrand]);

  // Help & Support modal
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Query state (used inside Help modal)
  const [queryText, setQueryText] = useState('');
  const [querySubmitting, setQuerySubmitting] = useState(false);
  const [queryDone, setQueryDone] = useState(false);

  const s = makeStyles(colors);

  const openEditDetails = () => {
    Analytics.editDetailsTapped();
    if (!user) return;
    setEditFullName(`${user.first_name} ${user.last_name}`.trim());
    setEditDesignation(user.designation ?? '');
    setEditCompany(user.company_name ?? '');
    setEditAddress(user.address ?? '');
    setEditCity(user.city ?? '');
    const prof = user.profession ?? '';
    const isKnown = PROFESSIONS.includes(prof);
    setEditProfession(isKnown ? prof : (prof ? 'Other' : ''));
    setEditCustomProfession(isKnown ? '' : prof);
    setEditEmail(user.email ?? '');
    setEditInstagram(user.instagram_handle ?? '');
    setEditLinkedin(user.linkedin_url ?? '');
    setEditWebsite(user.website_url ?? '');
    setEditOtherUrl(user.other_url ?? '');
    setShowProfessionPicker(false);
    // Capture snapshot for unsaved-changes guard
    editOriginalRef.current = {
      fullName: `${user.first_name} ${user.last_name}`.trim(),
      designation: user.designation ?? '',
      company: user.company_name ?? '',
      address: user.address ?? '',
      city: user.city ?? '',
      profession: (PROFESSIONS.includes(user.profession ?? '') ? (user.profession ?? '') : (user.profession ? 'Other' : '')),
      customProfession: PROFESSIONS.includes(user.profession ?? '') ? '' : (user.profession ?? ''),
      email: user.email ?? '',
      instagram: user.instagram_handle ?? '',
      linkedin: user.linkedin_url ?? '',
      website: user.website_url ?? '',
      otherUrl: user.other_url ?? '',
    };
    setShowEditDetails(true);
  };

  const hasUnsavedEdits = () => {
    const o = editOriginalRef.current;
    return (
      editFullName !== o.fullName ||
      editDesignation !== o.designation ||
      editCompany !== o.company ||
      editAddress !== o.address ||
      editCity !== o.city ||
      editProfession !== o.profession ||
      editCustomProfession !== o.customProfession ||
      editEmail !== o.email ||
      editInstagram !== o.instagram ||
      editLinkedin !== o.linkedin ||
      editWebsite !== o.website ||
      editOtherUrl !== o.otherUrl
    );
  };

  const closeEditWithGuard = () => {
    if (!hasUnsavedEdits()) { setShowEditDetails(false); return; }
    if (Platform.OS === 'web') {
      if ((globalThis as any).window?.confirm('Leave without saving? Your changes will be lost.')) {
        setShowEditDetails(false);
      }
      return;
    }
    Alert.alert('Unsaved changes', 'Leave without saving?', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => setShowEditDetails(false) },
    ]);
  };

  const uploadProfileImage = async (uri: string): Promise<string | null> => {
    if (!user?.id) return null;
    return uploadProfilePhoto(user.id, uri);
  };

  const pickProfilePhoto = async (source: 'library' | 'camera') => {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow camera access to take a profile photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to your photo library to set a profile picture.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
    }
    if (!result.canceled && result.assets[0]) {
      const localUri = result.assets[0].uri;
      setPendingPhotoUri(localUri); // show preview locally without saving blob to Supabase
      setUploadingPhoto(true);
      const publicUrl = await uploadProfileImage(localUri);
      setUploadingPhoto(false);
      setPendingPhotoUri(null);
      if (publicUrl) updateUser({ profile_image_url: publicUrl });
    }
  };

  const showPhotoSourcePicker = () => {
    if (Platform.OS === 'web') { pickProfilePhoto('library'); return; }
    Alert.alert('Profile Photo', 'Choose a source', [
      { text: 'Take Photo', onPress: () => pickProfilePhoto('camera') },
      { text: 'Choose from Library', onPress: () => pickProfilePhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAvatarPress = () => setShowPhotoPreview(true);

  const submitQuery = async () => {
    if (!queryText.trim()) { Alert.alert('Please type your query first.'); return; }
    setQuerySubmitting(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user?.id ?? null,
        name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Anonymous',
        email: user?.email ?? '',
        message: queryText.trim(),
      });
      if (error) throw error;
      Analytics.supportQuerySubmitted();
      setQueryDone(true);
      setQueryText('');
    } catch {
      Alert.alert('Could not submit', 'Please check your internet connection and try again.');
    } finally {
      setQuerySubmitting(false);
    }
  };


if (isLoading) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }]}>
        <Ionicons name="person-circle-outline" size={64} color={colors.textMuted} />
        <Text style={[{ color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.semibold, marginTop: Spacing.md, textAlign: 'center' }]}>
          Set up your card
        </Text>
        <Text style={[{ color: colors.textSecondary, fontSize: FontSize.md, marginTop: Spacing.sm, textAlign: 'center', lineHeight: 22 }]}>
          Create your digital visiting card to share your details when someone scans your QR code.
        </Text>
        <Pressable
          style={[{ backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: Spacing.xl, borderRadius: Radius.md, marginTop: Spacing.xl }]}
          onPress={() => router.push('/(auth)/profile-setup')}
        >
          <Text style={[{ color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold }]}>Create Profile</Text>
        </Pressable>
      </View>
    );
  }

  const qrValue = `https://connect-designup.vercel.app/u/${user.id}`;
  const initials = [user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: headerPaddingTop as any }]}>
        <Text style={[s.headerTitle, { color: colors.text }]}>My Card</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── YOUR QR CODE (top) ───────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>YOUR QR CODE</Text>
        </View>
        <Pressable style={[s.qrCard, { backgroundColor: colors.surface }]} onPress={() => { Analytics.qrExpanded(); setQrExpanded(true); }}>
          <QRCode value={qrValue} size={120} backgroundColor={colors.surface} color={colors.text} />
          <Text style={[s.qrHint, { color: colors.textMuted }]}>Tap to expand</Text>
        </Pressable>
        {/* ── CARD PREVIEW ROW ─────────────────────────────────────────── */}
        <Pressable
          style={[s.settingsNavRow, { backgroundColor: colors.surface, marginTop: Spacing.md }]}
          onPress={() => { Analytics.previewCardTapped(); setShowCardPreview(true); }}
        >
          <Ionicons name="eye-outline" size={20} color={colors.textSecondary} />
          <View style={s.toggleInfo}>
            <Text style={[s.toggleLabel, { color: colors.text }]}>Tap to see how others view your card</Text>
            <Text style={[s.toggleSub, { color: colors.textMuted }]}>Preview what recipients see</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* ── VISITING CARD ─────────────────────────────────────────────── */}
        <View style={[s.sectionHeader, { marginTop: Spacing.lg }]}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>YOUR VISITING CARD</Text>
        </View>

        {/* Card completeness — hidden at 100% */}
        {isBeta && (() => {
          const profileFields = [
            user.designation,
            user.company_name,
            user.email,
            user.phone,
            user.city,
            user.instagram_handle || user.linkedin_url || user.website_url,
          ];
          const filled = profileFields.filter(Boolean).length;
          const pct = Math.round((filled / profileFields.length) * 100);
          const missing = profileFields.filter((f) => !f).length;
          if (pct >= 100) return null;
          return (
            <View style={[s.completenessCard, { backgroundColor: colors.surface }]}>
              <View style={s.completenessRow}>
                <Text style={[s.completenessLabel, { color: colors.text }]}>Card Completeness</Text>
                <Text style={[s.completenessPct, { color: colors.accent }]}>{pct}%</Text>
              </View>
              <View style={[s.completenessTrack, { backgroundColor: colors.border }]}>
                <View style={[s.completenessFill, { backgroundColor: colors.accent, width: `${pct}%` as any }]} />
              </View>
              {missing > 0 && (
                <Pressable onPress={openEditDetails}>
                  <Text style={[s.completenessTip, { color: colors.accent }]}>
                    Add {missing} more detail{missing > 1 ? 's' : ''} to complete your card →
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })()}

        <View style={[s.visitingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.vcTop}>
            <View style={{ flex: 1 }}>
              <Text style={[s.vcName, { color: colors.text }]}>{user.first_name} {user.last_name}</Text>
              {user.designation && <Text style={[s.vcDesig, { color: colors.textSecondary }]}>{user.designation}</Text>}
              {user.company_name && <Text style={[s.vcCompany, { color: colors.accent }]}>{user.company_name}</Text>}
            </View>
            <Pressable style={s.avatarWrap} onPress={handleAvatarPress}>
              <View style={[s.vcInitials, { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={[s.vcInitialsText, { color: '#FFFFFF' }]}>{initials}</Text>
                {(pendingPhotoUri || user.profile_image_url) ? (
                  <Image source={{ uri: pendingPhotoUri || user.profile_image_url! }} style={[s.vcPhoto, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]} />
                ) : null}
              </View>
              <View style={[s.avatarCameraOverlay, { backgroundColor: colors.background + 'CC' }]}>
                {uploadingPhoto
                  ? <ActivityIndicator size="small" color={colors.accent} />
                  : <Ionicons name="camera-outline" size={12} color={colors.textSecondary} />}
              </View>
            </Pressable>
          </View>
          <View style={[s.vcDivider, { backgroundColor: colors.border }]} />
          <View style={s.vcBottom}>
            {user.phone && (
              <View style={s.vcRow}>
                <Ionicons name="call-outline" size={14} color={colors.textMuted} />
                <Text style={[s.vcDetail, { color: colors.textSecondary }]}>{user.phone}</Text>
              </View>
            )}
            {user.email && (
              <View style={s.vcRow}>
                <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
                <Text style={[s.vcDetail, { color: colors.textSecondary }]}>{user.email}</Text>
              </View>
            )}
            {user.city && (
              <View style={s.vcRow}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text style={[s.vcDetail, { color: colors.textSecondary }]}>{user.city}{user.country ? `, ${user.country}` : ''}</Text>
              </View>
            )}
            {user.instagram_handle && (
              <View style={s.vcRow}>
                <Ionicons name="logo-instagram" size={14} color={colors.textMuted} />
                <Text style={[s.vcDetail, { color: colors.textSecondary }]}>@{user.instagram_handle}</Text>
              </View>
            )}
            {user.linkedin_url && (
              <View style={s.vcRow}>
                <Ionicons name="logo-linkedin" size={14} color={colors.textMuted} />
                <Text style={[s.vcDetail, { color: colors.textSecondary }]}>{user.linkedin_url}</Text>
              </View>
            )}
            {user.website_url && (
              <View style={s.vcRow}>
                <Ionicons name="globe-outline" size={14} color={colors.textMuted} />
                <Text style={[s.vcDetail, { color: colors.textSecondary }]}>{user.website_url}</Text>
              </View>
            )}
            {user.other_url && (
              <View style={s.vcRow}>
                <Ionicons name="link-outline" size={14} color={colors.textMuted} />
                <Text style={[s.vcDetail, { color: colors.textSecondary }]}>{user.other_url}</Text>
              </View>
            )}
          </View>
          <Pressable style={[s.editBtn, { borderColor: colors.accent }]} onPress={openEditDetails}>
            <Ionicons name="create-outline" size={14} color={colors.accent} />
            <Text style={[s.editBtnText, { color: colors.accent }]}>Edit Details</Text>
          </Pressable>
        </View>

        {/* ── LINK YOUR BRAND ───────────────────────────────────────────── */}
        {!isBeta && (
          <>
            <View style={[s.sectionHeader, { marginTop: Spacing.lg }]}>
              <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>BRAND AFFILIATION</Text>
            </View>
            {linkedBrand ? (
              <View style={[s.linkedBrandCard, { backgroundColor: colors.surface, borderColor: linkedBrandStatus === 'approved' ? colors.accent : colors.border }]}>
                <View style={[s.linkedBrandInitial, { backgroundColor: colors.accent + '22' }]}>
                  <Text style={[s.linkedBrandInitialText, { color: colors.accent }]}>
                    {linkedBrand.name.charAt(0)}
                  </Text>
                </View>
                <View style={s.linkedBrandInfo}>
                  <Text style={[s.linkedBrandName, { color: colors.text }]}>{linkedBrand.name}</Text>
                  <Text style={[s.linkedBrandCat, { color: colors.textSecondary }]}>{linkedBrand.category}</Text>
                  <View style={[s.linkedBrandStatusBadge, { backgroundColor: linkedBrandStatus === 'approved' ? colors.accent + '18' : colors.gold + '18' }]}>
                    <Text style={[s.linkedBrandStatusText, { color: linkedBrandStatus === 'approved' ? colors.accent : colors.gold }]}>
                      {linkedBrandStatus === 'approved' ? 'Linked' : 'Pending approval'}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => setLinkedBrand(null)}>
                  <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[s.settingsNavRow, { backgroundColor: colors.surface }]}
                onPress={() => { Analytics.linkBrandTapped(); setShowLinkBrand(true); }}
              >
                <Ionicons name="link-outline" size={20} color={colors.textSecondary} />
                <View style={s.toggleInfo}>
                  <Text style={[s.toggleLabel, { color: colors.text }]}>Link Your Brand</Text>
                  <Text style={[s.toggleSub, { color: colors.textMuted }]}>Appear on your brand's page on Designup</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </>
        )}

        {/* ── INVITE TO CONNECT ─────────────────────────────────────────── */}
        <View style={[s.sectionHeader, { marginTop: Spacing.lg }]}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>GROW YOUR NETWORK</Text>
        </View>
        <Pressable
          style={[s.settingsNavRow, { backgroundColor: colors.surface }]}
          onPress={() => { Analytics.inviteToConnectTapped(); setInvitePhone(''); setInviteSent(false); setShowInvite(true); }}
        >
          <Ionicons name="person-add-outline" size={20} color={colors.accent} />
          <View style={s.toggleInfo}>
            <Text style={[s.toggleLabel, { color: colors.text }]}>Invite to Connect</Text>
            <Text style={[s.toggleSub, { color: colors.textMuted }]}>Bring someone onto the platform</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* ── SUPPORT ───────────────────────────────────────────────────── */}
        <View style={[s.sectionHeader, { marginTop: Spacing.lg }]}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>SUPPORT</Text>
        </View>
        <Pressable
          style={[s.settingsNavRow, { backgroundColor: colors.surface }]}
          onPress={() => { Analytics.helpSupportOpened(); setShowHelpModal(true); }}
        >
          <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
          <View style={s.toggleInfo}>
            <Text style={[s.toggleLabel, { color: colors.text }]}>Help & Support</Text>
            <Text style={[s.toggleSub, { color: colors.textMuted }]}>FAQs and contact us</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* ── SETTINGS ──────────────────────────────────────────────────── */}
        <View style={[s.sectionHeader, { marginTop: Spacing.lg }]}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>SETTINGS</Text>
        </View>
        <View style={[s.settingsNavRow, { backgroundColor: colors.surface }]}>
          <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={20} color={colors.textSecondary} />
          <View style={s.toggleInfo}>
            <Text style={[s.toggleLabel, { color: colors.text }]}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.accent + '88' }}
            thumbColor={isDark ? colors.accent : colors.textMuted}
          />
        </View>
        {user?.email === 'niveditasingh0124@gmail.com' && (
        <Pressable
          style={[s.settingsNavRow, { backgroundColor: colors.surface, marginTop: Spacing.sm }]}
          onPress={() => {
            const doReset = () => {
              resetDemoConnections();
              clearCardContacts();
              // Also delete from Supabase so card contacts don't come back on refresh
              if (user?.id) {
                supabase.from('card_contacts').delete().eq('user_id', user.id).then(() => {});
                supabase.from('connections').delete().eq('user_id', user.id).then(() => {});
              }
            };

            if (Platform.OS === 'web') {
              // Alert.alert maps to window.confirm on web which can be unreliable in PWAs
              const ok = (globalThis as any).confirm?.(
                'Simulate New User: clear all card contacts and scanned connections? Your profile stays intact.',
              );
              if (ok) doReset();
            } else {
              Alert.alert(
                'Simulate New User',
                'This will clear all your saved contacts and connections from this device. Your profile stays intact. Use this to test the first-time experience.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear All Contacts', style: 'destructive', onPress: doReset },
                ],
              );
            }
          }}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
          <Text style={[s.toggleLabel, { color: colors.textSecondary }]}>Simulate New User</Text>
        </Pressable>
        )}
{confirmSignOut ? (
          <View style={[s.settingsNavRow, { backgroundColor: colors.surface, marginTop: Spacing.sm, gap: Spacing.sm }]}>
            <Ionicons name="log-out-outline" size={20} color="#FF4444" />
            <Text style={[s.toggleLabel, { color: colors.text, flex: 1 }]}>Are you sure?</Text>
            <Pressable onPress={() => setConfirmSignOut(false)} style={{ paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.medium }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => { Analytics.signedOut(); signOut(); }} style={{ paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.md, backgroundColor: '#FF4444' }}>
              <Text style={{ color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.medium }}>Sign Out</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[s.settingsNavRow, { backgroundColor: colors.surface, marginTop: Spacing.sm }]}
            onPress={() => setConfirmSignOut(true)}
          >
            <Ionicons name="log-out-outline" size={20} color="#FF4444" />
            <Text style={[s.toggleLabel, { color: '#FF4444' }]}>Sign Out</Text>
          </Pressable>
        )}

      </ScrollView>

      {/* Photo preview modal */}
      <Modal visible={showPhotoPreview} transparent animationType="fade" onRequestClose={() => setShowPhotoPreview(false)}>
        <Pressable style={s.photoOverlay} onPress={() => setShowPhotoPreview(false)}>
          <Pressable style={[s.photoPreviewCard, { backgroundColor: colors.surface }]} onPress={() => {}}>
            {(pendingPhotoUri || user?.profile_image_url) ? (
              <Image source={{ uri: pendingPhotoUri || user!.profile_image_url! }} style={s.photoPreviewImg} resizeMode="cover" />
            ) : (
              <View style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.accent + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 64, fontWeight: '700', color: colors.accent }}>{initials}</Text>
              </View>
            )}
            <View style={s.photoPreviewActions}>
              <Pressable
                style={[s.photoPreviewBtn, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '55' }]}
                onPress={() => { setShowPhotoPreview(false); showPhotoSourcePicker(); }}
              >
                <Ionicons name={(pendingPhotoUri || user?.profile_image_url) ? 'pencil-outline' : 'add-outline'} size={16} color={colors.accent} />
                <Text style={[s.photoPreviewBtnText, { color: colors.accent }]}>
                  {(pendingPhotoUri || user?.profile_image_url) ? 'Edit' : 'Add Photo'}
                </Text>
              </Pressable>
              {user?.profile_image_url && (
                <Pressable
                  style={[s.photoPreviewBtn, { backgroundColor: '#ef444418', borderColor: '#ef444455' }]}
                  onPress={() => { setShowPhotoPreview(false); updateUser({ profile_image_url: null as any }); }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text style={[s.photoPreviewBtnText, { color: '#ef4444' }]}>Delete</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* QR expanded modal */}
      <Modal visible={qrExpanded} transparent animationType="fade" onRequestClose={() => setQrExpanded(false)}>
        <Pressable style={s.qrOverlay} onPress={() => setQrExpanded(false)}>
          <Text style={s.qrModalHint}>Let others save your details by scanning</Text>
          <View style={[s.qrModal, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <QRCode value={qrValue} size={240} backgroundColor={colors.surface} color={colors.text} />
            <Text style={[s.qrModalName, { color: colors.text }]}>{user.first_name} {user.last_name}</Text>
            <Text style={[s.qrModalSub, { color: colors.textSecondary }]}>
              {[user.designation ?? user.profession, user.company_name].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Pressable style={s.qrClose} onPress={() => setQrExpanded(false)}>
            <Ionicons name="close-circle" size={36} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Card Preview Modal ───────────────────────────────────────── */}
      <Modal visible={showCardPreview} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Your card preview</Text>
              <Pressable onPress={() => setShowCardPreview(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.lg, paddingBottom: 40 }}>

              {/* Identity — name left, avatar right (matches connection detail layout) */}
              <View style={s.previewIdentity}>
                <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
                  <Text style={[s.previewName, { color: colors.text }]}>{user.first_name} {user.last_name}</Text>
                  {user.company_name && <Text style={[s.previewCompany, { color: colors.accent }]}>{user.company_name}</Text>}
                  {user.designation && <Text style={[s.previewDesig, { color: colors.textMuted }]}>{user.designation}</Text>}
                  {user.city && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                      <Text style={[s.previewDesig, { color: colors.textMuted }]}>
                        {user.city}{user.country ? `, ${user.country}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={[s.previewAvatarCircle, { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={[s.previewAvatarText, { color: '#FFFFFF' }]}>{initials}</Text>
                  {(pendingPhotoUri || user.profile_image_url) ? (
                    <Image source={{ uri: pendingPhotoUri || user.profile_image_url! }} style={[s.previewPhoto, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]} />
                  ) : null}
                </View>
              </View>

              {/* CONTACT section */}
              {(user.phone || user.email) && (
                <View style={{ gap: 6 }}>
                  <Text style={[s.previewSectionLabel, { color: colors.textMuted }]}>CONTACT</Text>
                  <View style={[s.previewSectionCard, { backgroundColor: colors.surface }]}>
                    {user.phone && (
                      <View style={s.previewRow}>
                        <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.previewRowLabel, { color: colors.textMuted }]}>Phone</Text>
                          <Text style={[s.previewRowValue, { color: colors.text }]}>{user.phone}</Text>
                        </View>
                      </View>
                    )}
                    {user.phone && user.email && <View style={[s.previewDivider, { backgroundColor: colors.border }]} />}
                    {user.email && (
                      <View style={s.previewRow}>
                        <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.previewRowLabel, { color: colors.textMuted }]}>Email</Text>
                          <Text style={[s.previewRowValue, { color: colors.text }]}>{user.email}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* ONLINE section */}
              {(user.instagram_handle || user.linkedin_url || user.website_url) && (
                <View style={{ gap: 6 }}>
                  <Text style={[s.previewSectionLabel, { color: colors.textMuted }]}>ONLINE</Text>
                  <View style={[s.previewSectionCard, { backgroundColor: colors.surface }]}>
                    {user.instagram_handle && (
                      <View style={s.previewRow}>
                        <Ionicons name="logo-instagram" size={18} color={colors.textSecondary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.previewRowLabel, { color: colors.textMuted }]}>Instagram</Text>
                          <Text style={[s.previewRowValue, { color: colors.text }]}>@{user.instagram_handle}</Text>
                        </View>
                      </View>
                    )}
                    {user.instagram_handle && user.linkedin_url && <View style={[s.previewDivider, { backgroundColor: colors.border }]} />}
                    {user.linkedin_url && (
                      <View style={s.previewRow}>
                        <Ionicons name="logo-linkedin" size={18} color={colors.textSecondary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.previewRowLabel, { color: colors.textMuted }]}>LinkedIn</Text>
                          <Text style={[s.previewRowValue, { color: colors.text }]}>{user.linkedin_url}</Text>
                        </View>
                      </View>
                    )}
                    {user.linkedin_url && user.website_url && <View style={[s.previewDivider, { backgroundColor: colors.border }]} />}
                    {user.website_url && (
                      <View style={s.previewRow}>
                        <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.previewRowLabel, { color: colors.textMuted }]}>Website</Text>
                          <Text style={[s.previewRowValue, { color: colors.text }]}>{user.website_url}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* LOCATION section */}
              {user.address && (
                <View style={{ gap: 6 }}>
                  <Text style={[s.previewSectionLabel, { color: colors.textMuted }]}>LOCATION</Text>
                  <View style={[s.previewSectionCard, { backgroundColor: colors.surface }]}>
                    <View style={[s.previewRow, { alignItems: 'flex-start' }]}>
                      <Ionicons name="location-outline" size={18} color={colors.textSecondary} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.previewRowLabel, { color: colors.textMuted }]}>Address</Text>
                        <Text style={[s.previewRowValue, { color: colors.text, lineHeight: 20 }]}>{user.address}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

            </ScrollView>
            <View style={[s.editSaveFooter, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
              <Pressable
                style={[s.modalSaveBtn, { backgroundColor: colors.accent }]}
                onPress={() => { setShowCardPreview(false); openEditDetails(); }}
              >
                <Ionicons name="create-outline" size={16} color="#FFF" />
                <Text style={s.modalSaveBtnText}>Edit Details</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Invite to Connect Modal ───────────────────────────────────── */}
      <Modal visible={showInvite} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Invite to Connect</Text>
              <Pressable onPress={() => setShowInvite(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
              {inviteSent ? (
                <View style={{ alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl }}>
                  <Ionicons name="checkmark-circle" size={52} color={colors.accent} />
                  <Text style={[s.modalTitle, { color: colors.text, textAlign: 'center' }]}>Request noted!</Text>
                  <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 22, fontSize: FontSize.sm, alignSelf: 'stretch' }}>
                    We've saved this. Connect will open up to more users after beta — we'll reach out to them directly when it does.
                  </Text>
                  <Pressable style={[s.modalSaveBtn, { backgroundColor: colors.accent }]} onPress={() => setShowInvite(false)}>
                    <Text style={s.modalSaveBtnText}>Done</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={[s.infoBlurbText, { color: colors.textMuted }]}>
                    Enter their phone number. We'll reach out to them when Connect opens up after beta.
                  </Text>
                  <Text style={[s.editLabel, { color: colors.textMuted }]}>PHONE NUMBER</Text>
                  <TextInput
                    style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="+91 98765 43210"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={invitePhone}
                    onChangeText={setInvitePhone}
                    autoFocus
                  />
                  <Pressable
                    style={[s.modalSaveBtn, { backgroundColor: invitePhone.replace(/\D/g, '').length >= 10 ? colors.accent : colors.border }]}
                    onPress={submitInvite}
                    disabled={invitePhone.replace(/\D/g, '').length < 10 || inviteSubmitting}
                  >
                    <Text style={s.modalSaveBtnText}>{inviteSubmitting ? 'Saving…' : 'Send Invite'}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Details Modal ───────────────────────────────────────── */}
      <Modal visible={showEditDetails} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Edit Your Details</Text>
              <Pressable onPress={closeEditWithGuard}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={s.modalScroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets
            >
              <Text style={[s.editLabel, { color: colors.textMuted }]}>FULL NAME</Text>
              <TextInput style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} value={editFullName} onChangeText={setEditFullName} placeholder="Priya Sharma" placeholderTextColor={colors.textMuted} />

              <Text style={[s.editLabel, { color: colors.textMuted }]}>PROFESSION</Text>
              <Pressable
                style={[s.pickerSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowProfessionPicker((v) => !v)}
              >
                <Text style={[s.pickerSelectorText, { color: editProfession ? colors.text : colors.textMuted }]}>
                  {editProfession || 'Select profession'}
                </Text>
                <Ionicons name={showProfessionPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
              </Pressable>
              {showProfessionPicker && (
                <View style={[s.pickerList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {PROFESSIONS.map((p) => (
                    <Pressable
                      key={p}
                      style={[s.pickerItem, editProfession === p && { backgroundColor: colors.accent + '18' }]}
                      onPress={() => { setEditProfession(p); setShowProfessionPicker(false); }}
                    >
                      <Text style={[s.pickerItemText, { color: editProfession === p ? colors.accent : colors.text }]}>{p}</Text>
                      {editProfession === p && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                    </Pressable>
                  ))}
                </View>
              )}
              {editProfession === 'Other' && (
                <TextInput
                  style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, marginTop: 8 }]}
                  value={editCustomProfession}
                  onChangeText={setEditCustomProfession}
                  placeholder="Describe your role"
                  placeholderTextColor={colors.textMuted}
                />
              )}

              <Text style={[s.editLabel, { color: colors.textMuted }]}>COMPANY</Text>
              <TextInput style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} value={editCompany} onChangeText={setEditCompany} placeholder="Studio Forma" placeholderTextColor={colors.textMuted} />

              <Text style={[s.editLabel, { color: colors.textMuted }]}>DESIGNATION</Text>
              <TextInput style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} value={editDesignation} onChangeText={setEditDesignation} placeholder="Principal Designer" placeholderTextColor={colors.textMuted} />

              <Text style={[s.editLabel, { color: colors.textMuted }]}>ADDRESS</Text>
              <TextInput style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} value={editAddress} onChangeText={setEditAddress} placeholder="12 North Drive, Bandra West" placeholderTextColor={colors.textMuted} />

              <Text style={[s.editLabel, { color: colors.textMuted }]}>CITY</Text>
              <TextInput style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} value={editCity} onChangeText={setEditCity} placeholder="Mumbai" placeholderTextColor={colors.textMuted} />

              <Text style={[s.editLabel, { color: colors.textMuted }]}>EMAIL</Text>
              <TextInput style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} value={editEmail} onChangeText={setEditEmail} placeholder="priya@studio.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />

              <Text style={[s.editSectionDivider, { color: colors.textMuted, borderTopColor: colors.border }]}>SOCIAL & LINKS</Text>

              <Text style={[s.editLabel, { color: colors.textMuted }]}>INSTAGRAM</Text>
              <View style={[s.editInputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.editInputPrefix, { color: colors.textMuted }]}>@</Text>
                <TextInput style={[s.editInputInner, { color: colors.text }]} value={editInstagram} onChangeText={setEditInstagram} placeholder="yourhandle" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
              </View>

              <Text style={[s.editLabel, { color: colors.textMuted }]}>LINKEDIN</Text>
              <View style={[s.editInputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="logo-linkedin" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                <TextInput style={[s.editInputInner, { color: colors.text }]} value={editLinkedin} onChangeText={setEditLinkedin} placeholder="linkedin.com/in/yourname" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" />
              </View>

              <Text style={[s.editLabel, { color: colors.textMuted }]}>WEBSITE</Text>
              <View style={[s.editInputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="globe-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                <TextInput style={[s.editInputInner, { color: colors.text }]} value={editWebsite} onChangeText={setEditWebsite} placeholder="yourwebsite.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" />
              </View>

              <Text style={[s.editLabel, { color: colors.textMuted }]}>OTHER LINK</Text>
              <View style={[s.editInputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="link-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                <TextInput style={[s.editInputInner, { color: colors.text }]} value={editOtherUrl} onChangeText={setEditOtherUrl} placeholder="Behance, Pinterest, etc." placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" />
              </View>

            </ScrollView>
            <View style={[s.editSaveFooter, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
              <Pressable
                style={[s.modalSaveBtn, { backgroundColor: colors.accent }]}
                onPress={() => {
                  const nameParts = editFullName.trim().split(/\s+/);
                  updateUser({
                    first_name: nameParts[0] ?? '',
                    last_name: nameParts.slice(1).join(' '),
                    profession: editProfession === 'Other' ? (editCustomProfession.trim() || undefined) : (editProfession || undefined),
                    company_name: editCompany.trim() || undefined,
                    designation: editDesignation.trim() || undefined,
                    address: editAddress.trim() || undefined,
                    city: editCity.trim() || undefined,
                    email: editEmail.trim() || undefined,
                    instagram_handle: editInstagram.trim() || undefined,
                    linkedin_url: editLinkedin.trim() || undefined,
                    website_url: editWebsite.trim() || undefined,
                    other_url: editOtherUrl.trim() || undefined,
                  });
                  Analytics.profileSaved();
                  setShowEditDetails(false);
                }}
              >
                <Text style={s.modalSaveBtnText}>Save Changes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Help & Support Modal ─────────────────────────────────────────── */}
      <Modal visible={showHelpModal} animationType="slide" transparent onRequestClose={() => { setShowHelpModal(false); setQueryDone(false); setQueryText(''); }}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[s.helpModal, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={s.queryModalHeader}>
              <Text style={[s.queryModalTitle, { color: colors.text }]}>Help & Support</Text>
              <Pressable onPress={() => { setShowHelpModal(false); setQueryDone(false); setQueryText(''); }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* FAQ */}
              <Text style={[s.helpModalSection, { color: colors.textMuted }]}>FREQUENTLY ASKED QUESTIONS</Text>
              {[
                { q: 'How do I share my digital visiting card?', a: 'Go to the Profile tab and tap on your QR code. Show it to someone — they scan it with their phone camera or the Connect app and your card is saved instantly.' },
                { q: 'How do I scan someone\'s card?', a: 'Open the Scan tab and point your camera at their QR code. Their contact saves to your Connects automatically.' },
                { q: 'How do I scan a physical visiting card?', a: 'Tap the card icon in the Scan tab to switch to card scan mode. Point your camera at any printed visiting card — the details are read and saved to your contacts.' },
                { q: 'Why does a red bar appear at the top when I open the scanner?', a: 'That\'s iOS confirming your camera is active — it\'s a standard privacy indicator Apple shows whenever any app uses the camera. It disappears as soon as you leave the scanner and does not mean anything is being recorded or stored.' },
                { q: 'How do I update my details on my visiting card?', a: 'Tap "Edit Details" on your card in the Profile tab. Changes update immediately.' },
                { q: 'Is my data private?', a: 'Yes. Your contact details are only shared when you explicitly exchange QR cards with someone.' },
              ].map((item, i) => (
                <FaqItem key={i} question={item.q} answer={item.a} colors={colors} />
              ))}
            </ScrollView>

            {/* Send Query — always visible at bottom */}
            <View style={[s.queryFooter, { borderTopColor: colors.border }]}>
              <Text style={[s.helpModalSection, { color: colors.textMuted, marginTop: 0, marginBottom: Spacing.sm }]}>HAVE A QUESTION?</Text>
              <TextInput
                style={[s.queryInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={queryText}
                onChangeText={setQueryText}
                placeholder="Type your question or feedback here..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={1000}
              />
              <View style={[s.queryFromRow, { backgroundColor: colors.surface }]}>
                <Ionicons name="mail-outline" size={13} color={colors.textMuted} />
                <Text style={[s.queryFromText, { color: colors.textMuted }]}>
                  We'll reply via the Connect support team
                </Text>
              </View>
              {queryDone ? (
                <View style={[s.querySuccessInline, { backgroundColor: colors.surface }]}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  <Text style={[s.querySuccessInlineText, { color: colors.text }]}>
                    Query sent! We'll get back to you soon.
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={[s.querySubmitBtn, { backgroundColor: querySubmitting ? colors.textMuted : colors.accent }]}
                  onPress={submitQuery}
                  disabled={querySubmitting}
                >
                  <Ionicons name={querySubmitting ? 'sync-outline' : 'send-outline'} size={16} color="#FFF" />
                  <Text style={s.querySubmitBtnText}>{querySubmitting ? 'Sending...' : 'Send Query'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      {/* ── Link Your Brand Modal ────────────────────────────────────── */}
      <Modal visible={showLinkBrand} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Link Your Brand</Text>
              <Pressable onPress={() => { setShowLinkBrand(false); setBrandSearch(''); }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <View style={[s.linkBrandBlurb, { backgroundColor: colors.surface }]}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
              <Text style={[s.linkBrandBlurbText, { color: colors.textMuted }]}>
                Search for your brand below and select it. The brand admin will need to approve before it reflects on your profile and visiting card.
              </Text>
            </View>
            <View style={[s.linkBrandSearch, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[s.linkBrandInput, { color: colors.text }]}
                placeholder="Type brand name..."
                placeholderTextColor={colors.textMuted}
                value={brandSearch}
                onChangeText={setBrandSearch}
                autoFocus
              />
              {brandSearch.length > 0 && (
                <Pressable onPress={() => setBrandSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
            <ScrollView contentContainerStyle={s.linkBrandList}>
              {allSearchBrands.length === 0 ? (
                <Text style={[s.linkBrandEmpty, { color: colors.textMuted }]}>Loading brands...</Text>
              ) : (
                <>
                  {allSearchBrands
                    .filter((b) => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
                    .map((b) => (
                      <Pressable
                        key={b.id}
                        style={[s.linkBrandRow, { backgroundColor: colors.surface }]}
                        onPress={() => {
                          setLinkedBrand({ id: b.id, name: b.name, category: b.category });
                          setLinkedBrandStatus('pending');
                          setShowLinkBrand(false);
                          setBrandSearch('');
                          Alert.alert(
                            'Request Sent',
                            `Your request to link to ${b.name} has been sent. It will appear on your profile once the brand approves it.`,
                            [{ text: 'OK' }]
                          );
                        }}
                      >
                        <View style={[s.linkBrandInitial, { backgroundColor: colors.accent + '22' }]}>
                          <Text style={[s.linkBrandInitialText, { color: colors.accent }]}>{b.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={s.linkBrandRowInfo}>
                          <Text style={[s.linkBrandRowName, { color: colors.text }]}>{b.name}</Text>
                          <Text style={[s.linkBrandRowCat, { color: colors.textMuted }]}>{b.category}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </Pressable>
                    ))}
                  {brandSearch.length > 0 && allSearchBrands.filter((b) => b.name.toLowerCase().includes(brandSearch.toLowerCase())).length === 0 && (
                    <Text style={[s.linkBrandEmpty, { color: colors.textMuted }]}>No brands match "{brandSearch}"</Text>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

function FaqItem({ question, answer, colors }: { question: string; answer: string; colors: any }) {
  const [open, setOpen] = useState(false);
  const s = makeStyles(colors);
  return (
    <Pressable style={[s.faqItem, { backgroundColor: colors.surface }]} onPress={() => setOpen((v) => !v)}>
      <View style={s.faqRow}>
        <Text style={[s.faqQ, { color: colors.text }]}>{question}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </View>
      {open && <Text style={[s.faqA, { color: colors.textSecondary }]}>{answer}</Text>}
    </Pressable>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100, gap: Spacing.sm },

    sectionHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginTop: Spacing.lg, marginBottom: 4,
    },
    sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1 },

    infoBlurb: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', borderRadius: Radius.md, padding: Spacing.sm },
    infoBlurbText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },

    identityCard: {
      flexDirection: 'row', gap: Spacing.md, borderRadius: Radius.lg,
      padding: Spacing.lg, alignItems: 'center',
    },
    avatarWrap: { position: 'relative' },
    avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    avatarPhoto: { width: 52, height: 52, borderRadius: 26 },
    avatarCameraOverlay: {
      position: 'absolute', bottom: 0, right: 0,
      width: 20, height: 20, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    identityInfo: { flex: 1 },
    fullName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    userId: { fontSize: FontSize.sm, marginTop: 2 },
    role: { fontSize: FontSize.xs, marginTop: 2 },
    profileNudge: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderWidth: 1, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
      marginTop: Spacing.sm,
    },
    profileNudgeText: { flex: 1, fontSize: FontSize.xs, lineHeight: 16 },

    visitingCard: { borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1 },
    vcTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
    vcName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    vcDesig: { fontSize: FontSize.sm, marginTop: 2 },
    vcCompany: { fontSize: FontSize.sm, marginTop: 2 },
    vcPhoto: { width: 40, height: 40, borderRadius: 20 },
    vcInitials: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    vcInitialsText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    vcDivider: { height: 1, marginBottom: Spacing.md },
    vcBottom: { gap: Spacing.sm, marginBottom: Spacing.md },
    vcRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    vcDetail: { fontSize: FontSize.sm },
    editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1.5 },
    editBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

    qrCard: { borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
    qrHint: { fontSize: FontSize.xs },

    photoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    photoPreviewCard: { width: '100%', maxWidth: 320, borderRadius: Radius.xl, overflow: 'hidden' },
    photoPreviewImg: { width: '100%', aspectRatio: 1 },
    photoPreviewActions: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
    photoPreviewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: Radius.full, borderWidth: 1.5 },
    photoPreviewBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

    qrOverlay: {
      flex: 1, backgroundColor: '#000',
      alignItems: 'center', justifyContent: 'center', gap: Spacing.lg,
    },
    qrModal: {
      borderRadius: Radius.xl, padding: Spacing.xl,
      alignItems: 'center', gap: Spacing.md, width: 300,
    },
    qrModalHint: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)', textAlign: 'center', letterSpacing: 0.3 },
    qrModalName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center' },
    qrModalSub: { fontSize: FontSize.sm, textAlign: 'center' },
    qrClose: { alignItems: 'center', justifyContent: 'center', padding: Spacing.sm },

    settingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
    settingInfo: { flex: 1 },
    settingLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    settingValue: { fontSize: FontSize.xs, marginTop: 2 },

    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
    toggleInfo: { flex: 1 },
    toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    toggleSub: { fontSize: FontSize.xs, marginTop: 2 },

    demoActionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
    demoActionInfo: { flex: 1 },
    demoActionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    demoActionSub: { fontSize: FontSize.xs, marginTop: 2 },

    faqItem: { borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
    faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
    faqQ: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.medium, lineHeight: 20 },
    faqA: { fontSize: FontSize.sm, lineHeight: 20, marginTop: Spacing.sm },
    signOutBtn: { paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, marginTop: Spacing.md },
    signOutText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', alignItems: 'center' },
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '92%', width: '100%', maxWidth: 390 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, paddingBottom: Spacing.sm },
    modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    modalScroll: { padding: Spacing.lg, paddingBottom: 60, gap: Spacing.sm },
    editLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1, marginTop: Spacing.md, marginBottom: Spacing.sm },
    editInput: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 50, fontSize: FontSize.md },
    editInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 50 },
    editInputPrefix: { fontSize: FontSize.md, fontWeight: FontWeight.medium, marginRight: 4 },
    editInputInner: { flex: 1, fontSize: FontSize.md },
    editSectionDivider: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1, marginTop: Spacing.xl, marginBottom: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.lg },
    modalSaveBtn: { paddingVertical: 16, borderRadius: Radius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, width: '100%' },
    modalSaveBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    editSaveFooter: { padding: Spacing.lg, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
    usernameInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 50 },
    usernameAt: { fontSize: FontSize.md, fontWeight: FontWeight.medium, marginRight: 4 },
    usernameInput: { flex: 1, fontSize: FontSize.md },

    // Inline picker
    pickerSelector: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 50,
    },
    pickerSelectorText: { fontSize: FontSize.md },
    pickerList: {
      borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', marginTop: 4,
    },
    pickerItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: 13,
    },
    pickerItemText: { fontSize: FontSize.sm },

    // Settings nav row (tappable, navigates to sub-screen)
    settingsNavRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.sm,
    },

    // Linked brand card
    linkedBrandCard: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, marginTop: Spacing.sm,
    },
    linkedBrandInitial: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    linkedBrandInitialText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    linkedBrandInfo: { flex: 1, gap: 3 },
    linkedBrandName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    linkedBrandCat: { fontSize: FontSize.xs },
    linkedBrandStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, marginTop: 2 },
    linkedBrandStatusText: { fontSize: 10, fontWeight: FontWeight.semibold },

    // Link brand modal
    linkBrandBlurb: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
    linkBrandBlurbText: { flex: 1, fontSize: FontSize.xs, lineHeight: 17 },
    linkBrandSearch: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderWidth: 1, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, height: 44, marginBottom: Spacing.sm,
    },
    linkBrandInput: { flex: 1, fontSize: FontSize.md },
    linkBrandList: { gap: Spacing.sm, paddingBottom: 40 },
    linkBrandRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      borderRadius: Radius.lg, padding: Spacing.md,
    },
    linkBrandInitial: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    linkBrandInitialText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    linkBrandRowInfo: { flex: 1 },
    linkBrandRowName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    linkBrandRowCat: { fontSize: FontSize.xs, marginTop: 2 },
    linkBrandEmpty: { textAlign: 'center', fontSize: FontSize.sm, paddingVertical: Spacing.xl },

    // Help modal
    helpModal: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      width: '100%', maxWidth: 390, maxHeight: '92%', padding: Spacing.lg,
    },
    helpModalSection: {
      fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
      letterSpacing: 1, marginBottom: Spacing.sm,
    },
    helpModalSub: { fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.md },

    queryFooter: {
      borderTopWidth: 1, paddingTop: Spacing.md, paddingBottom: Spacing.lg,
    },
    querySuccessInline: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderRadius: Radius.md, padding: Spacing.md,
    },
    querySuccessInlineText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1 },

    queryModalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    queryModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    queryLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1, marginBottom: Spacing.sm },
    queryInput: {
      borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
      fontSize: FontSize.sm, lineHeight: 22, minHeight: 140,
    },
    queryCharCount: { fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: Spacing.md },
    queryFromRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg,
    },
    queryFromText: { fontSize: FontSize.xs, flex: 1 },
    queryNoteText: { fontSize: FontSize.xs, marginBottom: Spacing.lg, lineHeight: 18 },
    querySubmitBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, paddingVertical: 14, borderRadius: Radius.md,
    },
    querySubmitBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    // Profile completeness (Beta)
    completenessCard: {
      borderRadius: Radius.lg, padding: Spacing.md,
      marginBottom: Spacing.md, gap: Spacing.sm,
    },
    completenessRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    completenessLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    completenessPct: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    completenessTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
    completenessFill: { height: 6, borderRadius: 3 },
    completenessTip: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },

    shareQrBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, paddingVertical: 14, borderRadius: Radius.md,
      marginBottom: Spacing.md,
    },
    shareQrBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    // Card preview modal — mirrors ContactDetailPage in connections.tsx
    previewIdentity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingBottom: Spacing.sm },
    previewPhoto: { width: 64, height: 64, borderRadius: 32 },
    previewAvatarCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    previewAvatarText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
    previewName: { fontSize: 26, fontWeight: FontWeight.bold, letterSpacing: -0.3 },
    previewCompany: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    previewDesig: { fontSize: FontSize.sm },
    previewSectionLabel: { fontSize: 10, fontWeight: FontWeight.semibold, letterSpacing: 1 },
    previewSectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },
    previewRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingVertical: 13,
    },
    previewRowLabel: { fontSize: 10, fontWeight: FontWeight.semibold, letterSpacing: 0.3, marginBottom: 1 },
    previewRowValue: { fontSize: FontSize.sm },
    previewDivider: { height: StyleSheet.hairlineWidth, marginLeft: 50 },
  });
}
