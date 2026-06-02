import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, TextInput, Modal, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { ALL_BRANDS } from '../../data/brands';
import { getAllBrandsForSearch, type BrandSearchResult } from '../../lib/api';

// ── Free Google Sheets query submission via Google Apps Script ──────────────
// Setup: go to script.google.com → new project → paste the script below → Deploy as Web App
// Script: function doPost(e){const s=SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
//   const d=JSON.parse(e.postData.contents);
//   s.appendRow([new Date(),d.name,d.email,d.query]);
//   return ContentService.createTextOutput(JSON.stringify({success:true})).setMimeType(ContentService.MimeType.JSON);}
// Then replace the URL below with your deployment URL.
const QUERY_SHEET_URL = 'https://script.google.com/macros/s/AKfycbyTP6pllSJ8m2fGRZcmfpy94CVo6JYAwh6urjeps1vfESEJFzF4IJMkA7yf7aFVrUMxCw/exec';

const COUNTRIES = ['India', 'UAE', 'USA', 'UK', 'Singapore', 'Australia', 'Germany', 'Other'];
const PROFESSIONS = [
  'Architect', 'Interior Designer', 'Builder / Developer',
  'Hospitality / Commercial Buyer', 'Retailer / Store Owner',
  'Distributor / Dealer', 'Manufacturer', 'Product / Furniture Designer',
  'Design Studio / Firm', 'Art Consultant / Curator', 'Media / Influencer',
  'Design Student', 'Homeowner / Individual Buyer', 'Other',
];

export default function ProfileScreen() {
  const { colors, toggleTheme, isDark } = useTheme();
  const { user, signOut, isDemoMode, toggleDemoMode, activateDemoExhibition, resetDemoSaved, resetDemoConnections, updateUser } = useAuth();

  const [qrExpanded, setQrExpanded] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);

  // Edit Details local state
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editProfession, setEditProfession] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editLinkedin, setEditLinkedin] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editOtherUrl, setEditOtherUrl] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
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

  const handleDemoToggle = () => {
    toggleDemoMode();
    if (!isDemoMode) {
      activateDemoExhibition();
      Alert.alert(
        'Demo Mode On',
        'Index Mumbai 2025 is now active on your dashboard. Open any exhibition ticket to simulate gate scan, or tap brands to simulate scanning their booth QR.',
        [{ text: 'Got it' }]
      );
    }
  };

  const openEditDetails = () => {
    if (!user) return;
    setEditFirstName(user.first_name);
    setEditLastName(user.last_name);
    setEditDesignation(user.designation ?? '');
    setEditCompany(user.company_name ?? '');
    setEditCity(user.city ?? '');
    setEditCountry(user.country ?? '');
    setEditProfession(user.profession ?? '');
    setEditEmail(user.email ?? '');
    setEditInstagram(user.instagram_handle ?? '');
    setEditLinkedin(user.linkedin_url ?? '');
    setEditWebsite(user.website_url ?? '');
    setEditOtherUrl(user.other_url ?? '');
    setShowCountryPicker(false);
    setShowProfessionPicker(false);
    setShowEditDetails(true);
  };

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      updateUser({ profile_image_url: result.assets[0].uri });
    }
  };

  const submitQuery = async () => {
    if (!queryText.trim()) { Alert.alert('Please type your query first.'); return; }
    setQuerySubmitting(true);
    try {
      await fetch(QUERY_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Anonymous',
          email: user?.email ?? '',
          query: queryText.trim(),
        }),
      });
      setQueryDone(true);
      setQueryText('');
    } catch {
      Alert.alert('Could not submit', 'Please check your internet connection and try again.');
    } finally {
      setQuerySubmitting(false);
    }
  };


if (!user) return null;

  const qrValue = `user:${user.id}`;
  const initials = [user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── IDENTITY ─────────────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>YOUR DESIGNUP IDENTITY</Text>
        </View>
        <View style={[s.identityCard, { backgroundColor: colors.surface }]}>
          <Pressable style={s.avatarWrap} onPress={pickProfilePhoto}>
            {user.profile_image_url ? (
              <Image source={{ uri: user.profile_image_url }} style={s.avatarPhoto} />
            ) : (
              <View style={[s.avatar, { backgroundColor: colors.accent + '22' }]}>
                <Text style={[s.avatarText, { color: colors.accent }]}>{initials}</Text>
              </View>
            )}
            <View style={[s.avatarCameraOverlay, { backgroundColor: colors.background + 'CC' }]}>
              <Ionicons name="camera-outline" size={12} color={colors.textSecondary} />
            </View>
          </Pressable>
          <View style={s.identityInfo}>
            <Text style={[s.fullName, { color: colors.text }]}>{user.first_name} {user.last_name}</Text>
            <Text style={[s.role, { color: colors.textSecondary }]}>
              {user.profession}{user.company_name ? ` · ${user.company_name}` : ''}
            </Text>
          </View>
        </View>
        {/* ── VISITING CARD ─────────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>YOUR VISITING CARD</Text>
        </View>
        <View style={[s.infoBlurb, { backgroundColor: colors.surface }]}>
          <Ionicons name="card-outline" size={13} color={colors.textMuted} />
          <Text style={[s.infoBlurbText, { color: colors.textMuted }]}>
            This card is shared when you exchange contacts at a booth or when someone scans your personal QR. Keep it up to date.
          </Text>
        </View>
        <View style={[s.visitingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.vcTop}>
            <View style={{ flex: 1 }}>
              <Text style={[s.vcName, { color: colors.text }]}>{user.first_name} {user.last_name}</Text>
              {user.designation && <Text style={[s.vcDesig, { color: colors.textSecondary }]}>{user.designation}</Text>}
              {user.company_name && <Text style={[s.vcCompany, { color: colors.accent }]}>{user.company_name}</Text>}
            </View>
            {user.profile_image_url ? (
              <Image source={{ uri: user.profile_image_url }} style={s.vcPhoto} />
            ) : (
              <View style={[s.vcInitials, { backgroundColor: colors.accent + '22' }]}>
                <Text style={[s.vcInitialsText, { color: colors.accent }]}>{initials}</Text>
              </View>
            )}
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
          <Pressable style={[s.editBtn, { borderColor: colors.gold }]} onPress={openEditDetails}>
            <Ionicons name="create-outline" size={14} color={colors.gold} />
            <Text style={[s.editBtnText, { color: colors.gold }]}>Edit Details</Text>
          </Pressable>
        </View>

        {/* ── QR CODE ───────────────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>YOUR QR CODE</Text>
        </View>
        <View style={[s.infoBlurb, { backgroundColor: colors.surface }]}>
          <Ionicons name="qr-code-outline" size={13} color={colors.textMuted} />
          <Text style={[s.infoBlurbText, { color: colors.textMuted }]}>
            Others scan this QR to exchange visiting cards with you. Share it at booths or when networking at the show.
          </Text>
        </View>
        <Pressable style={[s.qrCard, { backgroundColor: colors.surface }]} onPress={() => setQrExpanded(true)}>
          <QRCode value={qrValue} size={120} backgroundColor={colors.surface} color={colors.text} />
          <Text style={[s.qrHint, { color: colors.textMuted }]}>Tap to expand</Text>
        </Pressable>

        {/* QR expanded modal */}
        {qrExpanded && (
          <Pressable style={s.qrOverlay} onPress={() => setQrExpanded(false)}>
            <View style={[s.qrModal, { backgroundColor: colors.surface }]}>
              <QRCode value={qrValue} size={240} backgroundColor={colors.surface} color={colors.text} />
              <Text style={[s.qrModalName, { color: colors.text }]}>{user.first_name} {user.last_name}</Text>
              <Pressable onPress={() => setQrExpanded(false)} style={s.qrClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
          </Pressable>
        )}

        {/* ── LINK YOUR BRAND ───────────────────────────────────────────── */}
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
            onPress={() => setShowLinkBrand(true)}
          >
            <Ionicons name="link-outline" size={20} color={colors.textSecondary} />
            <View style={s.toggleInfo}>
              <Text style={[s.toggleLabel, { color: colors.text }]}>Link Your Brand</Text>
              <Text style={[s.toggleSub, { color: colors.textMuted }]}>Appear on your brand's page on Designup</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        {/* ── SETTINGS ──────────────────────────────────────────────────── */}
        <View style={[s.sectionHeader, { marginTop: Spacing.lg }]}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>SETTINGS</Text>
        </View>

        {/* Theme toggle */}
        <View style={[s.toggleRow, { backgroundColor: colors.surface }]}>
          <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={20} color={colors.textSecondary} />
          <View style={s.toggleInfo}>
            <Text style={[s.toggleLabel, { color: colors.text }]}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            <Text style={[s.toggleSub, { color: colors.textMuted }]}>Switch the full app appearance</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.accent + '88' }}
            thumbColor={isDark ? colors.accent : colors.textMuted}
          />
        </View>

        {/* ── HELP & SUPPORT ────────────────────────────────────────────── */}
        <Pressable
          style={[s.settingsNavRow, { backgroundColor: colors.surface }]}
          onPress={() => setShowHelpModal(true)}
        >
          <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
          <View style={s.toggleInfo}>
            <Text style={[s.toggleLabel, { color: colors.text }]}>Help & Support</Text>
            <Text style={[s.toggleSub, { color: colors.textMuted }]}>FAQs and contact us</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* ── DEMO MODE ─────────────────────────────────────────────────── */}
        <View style={[s.sectionHeader, { marginTop: Spacing.lg }]}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>DEMO MODE</Text>
        </View>
        <View style={[s.infoBlurb, { backgroundColor: colors.surface }]}>
          <Ionicons name="play-circle-outline" size={13} color={colors.textMuted} />
          <Text style={[s.infoBlurbText, { color: colors.textMuted }]}>
            Demo Mode simulates attending Index Mumbai 2025 without a real QR scanner. Use it to explore every feature of the app end-to-end.
          </Text>
        </View>
        <View style={[s.toggleRow, { backgroundColor: colors.surface }]}>
          <Ionicons name="play-circle-outline" size={20} color={isDemoMode ? colors.accent : colors.textSecondary} />
          <View style={s.toggleInfo}>
            <Text style={[s.toggleLabel, { color: colors.text }]}>Demo Mode</Text>
            <Text style={[s.toggleSub, { color: colors.textMuted }]}>
              {isDemoMode ? 'Active — Index Mumbai 2025 is simulated' : 'Off — enable to simulate a live show'}
            </Text>
          </View>
          <Switch
            value={isDemoMode}
            onValueChange={handleDemoToggle}
            trackColor={{ false: colors.border, true: colors.accent + '88' }}
            thumbColor={isDemoMode ? colors.accent : colors.textMuted}
          />
        </View>

        {/* ── DATA & RESETS ─────────────────────────────────────────────── */}
        <View style={[s.sectionHeader, { marginTop: Spacing.lg }]}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>DATA & RESETS</Text>
        </View>
        <Pressable
          style={[s.demoActionBtn, { backgroundColor: colors.surface }]}
          onPress={() => {
            resetDemoSaved();
            Alert.alert('Saved Brands Reset', 'Your saved brands list is now cleared. Go to Saved tab to see the fresh state.');
          }}
        >
          <Ionicons name="bookmark-outline" size={18} color={colors.textSecondary} />
          <View style={s.demoActionInfo}>
            <Text style={[s.demoActionLabel, { color: colors.text }]}>Reset Saved Brands</Text>
            <Text style={[s.demoActionSub, { color: colors.textMuted }]}>Clear saved brands to see empty state</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable
          style={[s.demoActionBtn, { backgroundColor: colors.surface }]}
          onPress={() => {
            resetDemoConnections();
            Alert.alert('Connections Reset', 'Your connections list is now cleared. Go to Connections tab to see the fresh state.');
          }}
        >
          <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
          <View style={s.demoActionInfo}>
            <Text style={[s.demoActionLabel, { color: colors.text }]}>Reset Connections</Text>
            <Text style={[s.demoActionSub, { color: colors.textMuted }]}>Clear all connections to see empty state</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>

        {/* Sign out */}
        <Pressable style={[s.signOutBtn, { borderColor: colors.border }]} onPress={signOut}>
          <Text style={[s.signOutText, { color: colors.textSecondary }]}>Sign Out</Text>
        </Pressable>

      </ScrollView>

      {/* ── Edit Details Modal ───────────────────────────────────────── */}
      <Modal visible={showEditDetails} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Edit Your Details</Text>
              <Pressable onPress={() => setShowEditDetails(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.modalScroll}>
              <Text style={[s.editLabel, { color: colors.textMuted }]}>FIRST NAME</Text>
              <TextInput style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} value={editFirstName} onChangeText={setEditFirstName} placeholder="First name" placeholderTextColor={colors.textMuted} />
              <Text style={[s.editLabel, { color: colors.textMuted }]}>LAST NAME</Text>
              <TextInput style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} value={editLastName} onChangeText={setEditLastName} placeholder="Last name" placeholderTextColor={colors.textMuted} />
              <Text style={[s.editLabel, { color: colors.textMuted }]}>DESIGNATION</Text>
              <TextInput style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} value={editDesignation} onChangeText={setEditDesignation} placeholder="Principal Designer" placeholderTextColor={colors.textMuted} />
              <Text style={[s.editLabel, { color: colors.textMuted }]}>COMPANY</Text>
              <TextInput style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} value={editCompany} onChangeText={setEditCompany} placeholder="Studio Forma" placeholderTextColor={colors.textMuted} />
              <Text style={[s.editLabel, { color: colors.textMuted }]}>CITY</Text>
              <TextInput style={[s.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} value={editCity} onChangeText={setEditCity} placeholder="Mumbai" placeholderTextColor={colors.textMuted} />

              <Text style={[s.editLabel, { color: colors.textMuted }]}>COUNTRY</Text>
              <Pressable
                style={[s.pickerSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => { setShowCountryPicker((v) => !v); setShowProfessionPicker(false); }}
              >
                <Text style={[s.pickerSelectorText, { color: editCountry ? colors.text : colors.textMuted }]}>
                  {editCountry || 'Select country'}
                </Text>
                <Ionicons name={showCountryPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
              </Pressable>
              {showCountryPicker && (
                <View style={[s.pickerList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {COUNTRIES.map((c) => (
                    <Pressable
                      key={c}
                      style={[s.pickerItem, editCountry === c && { backgroundColor: colors.accent + '18' }]}
                      onPress={() => { setEditCountry(c); setShowCountryPicker(false); }}
                    >
                      <Text style={[s.pickerItemText, { color: editCountry === c ? colors.accent : colors.text }]}>{c}</Text>
                      {editCountry === c && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={[s.editLabel, { color: colors.textMuted }]}>PROFESSION</Text>
              <Pressable
                style={[s.pickerSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => { setShowProfessionPicker((v) => !v); setShowCountryPicker(false); }}
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

              <Pressable
                style={[s.modalSaveBtn, { backgroundColor: colors.accent }]}
                onPress={() => {
                  updateUser({
                    first_name: editFirstName.trim(),
                    last_name: editLastName.trim(),
                    designation: editDesignation.trim() || undefined,
                    company_name: editCompany.trim() || undefined,
                    city: editCity.trim() || undefined,
                    country: editCountry || undefined,
                    profession: editProfession || undefined,
                    email: editEmail.trim() || undefined,
                    instagram_handle: editInstagram.trim() || undefined,
                    linkedin_url: editLinkedin.trim() || undefined,
                    website_url: editWebsite.trim() || undefined,
                    other_url: editOtherUrl.trim() || undefined,
                  });
                  setShowEditDetails(false);
                }}
              >
                <Text style={s.modalSaveBtnText}>Save Changes</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Help & Support Modal ─────────────────────────────────────────── */}
      <Modal visible={showHelpModal} animationType="slide" transparent onRequestClose={() => { setShowHelpModal(false); setQueryDone(false); setQueryText(''); }}>
        <View style={s.modalOverlay}>
          <View style={[s.helpModal, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={s.queryModalHeader}>
              <Text style={[s.queryModalTitle, { color: colors.text }]}>Help & Support</Text>
              <Pressable onPress={() => { setShowHelpModal(false); setQueryDone(false); setQueryText(''); }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* FAQ */}
              <Text style={[s.helpModalSection, { color: colors.textMuted }]}>FREQUENTLY ASKED QUESTIONS</Text>
              {[
                { q: 'How do I scan a brand at a booth?', a: 'Open the Scan tab and point your camera at the QR code displayed at any brand booth. The brand will be saved to your Saved tab instantly.' },
                { q: 'How do I exchange contacts with someone?', a: "Ask them to show their Designup QR (from their Profile), then scan it via the Scan tab. Both of you will appear in each other's Connects." },
                { q: 'Why is my exhibition not showing as active?', a: 'You need to scan the entry QR at the venue gate to check in. Once scanned, the exhibition becomes active on your Home screen.' },
                { q: 'Can I use the app without attending an exhibition?', a: 'Yes — enable Demo Mode in Settings to explore all features of the app with a simulated exhibition.' },
                { q: 'How do I update my visiting card?', a: 'Tap "Edit Details" on your visiting card in the Profile page. Changes are reflected immediately across the app.' },
              ].map((item, i) => (
                <FaqItem key={i} question={item.q} answer={item.a} colors={colors} />
              ))}

              {/* Send Query */}
              <Text style={[s.helpModalSection, { color: colors.textMuted, marginTop: Spacing.xl }]}>HAVE A QUESTION?</Text>
              <Text style={[s.helpModalSub, { color: colors.textMuted }]}>
                Didn't find what you were looking for? Send us a message.
              </Text>
              <Text style={[s.queryLabel, { color: colors.textMuted }]}>YOUR MESSAGE</Text>
              <TextInput
                style={[s.queryInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={queryText}
                onChangeText={setQueryText}
                placeholder="Type your question or feedback here..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={1000}
              />
              <Text style={[s.queryCharCount, { color: colors.textMuted }]}>{queryText.length}/1000</Text>

              {user?.email ? (
                <View style={[s.queryFromRow, { backgroundColor: colors.surface }]}>
                  <Ionicons name="mail-outline" size={13} color={colors.textMuted} />
                  <Text style={[s.queryFromText, { color: colors.textMuted }]}>
                    Reply will go to <Text style={{ color: colors.text }}>{user.email}</Text>
                  </Text>
                </View>
              ) : (
                <Text style={[s.queryNoteText, { color: colors.textMuted }]}>
                  Add your email in profile to receive a reply.
                </Text>
              )}

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
            </ScrollView>
          </View>
        </View>
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
    header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm },
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

    qrOverlay: {
      position: 'absolute', top: 0, left: -Spacing.lg, right: -Spacing.lg,
      bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)',
      alignItems: 'center', justifyContent: 'center', zIndex: 100,
    },
    qrModal: { borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md },
    qrModalName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    qrModalId: { fontSize: FontSize.sm },
    qrClose: { position: 'absolute', top: Spacing.md, right: Spacing.md, padding: Spacing.sm },

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
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', width: '100%', maxWidth: 390 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, paddingBottom: Spacing.sm },
    modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    modalScroll: { padding: Spacing.lg, paddingBottom: 60, gap: Spacing.sm },
    editLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1, marginTop: Spacing.md, marginBottom: Spacing.sm },
    editInput: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 50, fontSize: FontSize.md },
    editInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 50 },
    editInputPrefix: { fontSize: FontSize.md, fontWeight: FontWeight.medium, marginRight: 4 },
    editInputInner: { flex: 1, fontSize: FontSize.md },
    editSectionDivider: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1, marginTop: Spacing.xl, marginBottom: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.lg },
    modalSaveBtn: { paddingVertical: 16, borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.md },
    modalSaveBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
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
  });
}
