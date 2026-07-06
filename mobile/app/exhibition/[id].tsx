// Exhibition Detail + Ticket + Explore screen
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Image, Modal, TextInput, Alert, Dimensions, Platform,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';

const SCREEN_H = Dimensions.get('window').height;
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { getExhibition, type ApiExhibition } from '../../lib/api';
import { getCachedCover, subscribeToCache } from '../../lib/unsplash';
import { useHeaderPaddingTop } from '../../lib/safeArea';

// Exhibitions that have an annotator-built interactive floor map.
// Add the exhibition ID here once its map JSON is ready.
const EXHIBITIONS_WITH_MAP = new Set(['exh-001']); // Index Mumbai 2025

type Tab = 'details' | 'ticket' | 'explore' | 'brands';
type RegStep = 'phone' | 'otp' | 'personal' | 'professional' | 'confirm';
type GateSimState = 'idle' | 'scanning' | 'success';

const COUNTRIES = ['India', 'UAE', 'USA', 'UK', 'Singapore', 'Australia', 'Germany', 'Other'];
const CITIES: Record<string, string[]> = {
  India: ['Ahmedabad', 'Bangalore', 'Chennai', 'Delhi', 'Hyderabad', 'Kolkata', 'Mumbai', 'Pune', 'Other'],
  UAE: ['Abu Dhabi', 'Dubai', 'Sharjah', 'Other'],
  USA: ['Chicago', 'Los Angeles', 'New York', 'San Francisco', 'Other'],
  UK: ['Birmingham', 'London', 'Manchester', 'Other'],
  Singapore: ['Singapore', 'Other'],
  Australia: ['Brisbane', 'Melbourne', 'Sydney', 'Other'],
  Germany: ['Berlin', 'Frankfurt', 'Munich', 'Other'],
  Other: ['Other'],
};
const PROFESSIONS = [
  'Architect',
  'Interior Designer',
  'Builder / Developer',
  'Hospitality / Commercial Buyer',
  'Retailer / Store Owner',
  'Distributor / Dealer',
  'Manufacturer',
  'Product / Furniture Designer',
  'Design Studio / Firm',
  'Art Consultant / Curator',
  'Media / Influencer',
  'Design Student',
  'Homeowner / Individual Buyer',
  'Other',
];

export default function ExhibitionDetailScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { colors } = useTheme();
  const { activateDemoExhibition, isDemoMode, setActiveExhibition, activeExhibitionId, demoRegisteredExhibitions, addDemoRegistration, user, updateUser } = useAuth();
  const [tab, setTab] = useState<Tab>((initialTab as Tab) ?? 'details');
  const [brandSearch, setBrandSearch] = useState('');
  const headerPaddingTop = useHeaderPaddingTop();

  // Registration flow state
  const [showRegister, setShowRegister] = useState(false);
  const [regStep, setRegStep] = useState<RegStep>('phone');
  const [regPhone, setRegPhone] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCountry, setRegCountry] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regOtherCity, setRegOtherCity] = useState('');
  const [regProfession, setRegProfession] = useState('');
  const [regOtherProfession, setRegOtherProfession] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regDesignation, setRegDesignation] = useState('');
  const [regDone, setRegDone] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showProfessionPicker, setShowProfessionPicker] = useState(false);
  const [gateSimState, setGateSimState] = useState<GateSimState>('idle');
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [exh, setExh] = useState<ApiExhibition | null>(null);
  const [, forceUpdate] = useState(0);
  const s = makeStyles(colors);

  useEffect(() => subscribeToCache(() => forceUpdate(n => n + 1)), []);

  useEffect(() => {
    if (!id) return;
    getExhibition(id, isDemoMode, user?.id)
      .then((data) => { if (data) setExh(data); })
      .catch(console.error);
  }, [id, isDemoMode, user?.id]);

  // Checked in: gate QR scanned (activeExhibitionId set) OR data says checked_in
  const isCheckedIn = activeExhibitionId === exh?.id || exh?.user_registration_status === 'checked_in';
  // Registered: form completed OR in context OR in data OR already checked in (checked-in implies registered)
  const isRegistered = regDone || (exh ? demoRegisteredExhibitions.includes(exh.id) : false) || !!exh?.user_registration_status || isCheckedIn;

  // Visible tabs depend on registration/check-in state
  const visibleTabs: Tab[] = ['details'];
  if (isRegistered) visibleTabs.push('ticket');
  if (isCheckedIn) { visibleTabs.push('explore'); visibleTabs.push('brands'); }

  const handleTabSwipe = (endX: number, endY: number) => {
    const dx = endX - swipeStartX.current;
    const dy = endY - swipeStartY.current;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    const idx = visibleTabs.indexOf(tab);
    if (dx < 0 && idx < visibleTabs.length - 1) setTab(visibleTabs[idx + 1]);
    if (dx > 0 && idx > 0) setTab(visibleTabs[idx - 1]);
  };

  // Logged-in user with a complete profile → straight to confirm
  // Logged-in user with incomplete profile → skip phone/OTP, start at personal
  // Guest → full flow from phone
  const loggedInComplete = !!user && !!user.profile_complete;
  const loggedInIncomplete = !!user && !user.profile_complete;

  const handleRegisterPress = () => {
    // Always pre-fill whatever we have from the user profile
    if (user) {
      setRegFirstName(user.first_name ?? '');
      setRegLastName(user.last_name ?? '');
      setRegEmail(user.email ?? '');
      setRegPhone(user.phone?.replace(/^\+\d{1,3}/, '') ?? '');
      setRegCountry(user.country ?? '');
      setRegCity(user.city ?? '');
      setRegProfession(user.profession ?? '');
      setRegCompany(user.company_name ?? '');
      setRegDesignation(user.designation ?? '');
    }
    setRegStep(user ? 'personal' : 'phone');
    setShowRegister(true);
  };

  const handleRegNext = () => {
    if (regStep === 'phone') {
      if (regPhone.length < 10) { Alert.alert('Enter a valid phone number'); return; }
      setRegStep('otp');
    } else if (regStep === 'otp') {
      if (regOtp.length < 4) { Alert.alert('Enter the OTP sent to your phone'); return; }
      setRegStep('personal');
    } else if (regStep === 'personal') {
      if (!regFirstName) { Alert.alert('Please enter your first name'); return; }
      if (!regCountry) { Alert.alert('Please select your country'); return; }
      const cityValue = regCity === 'Other' ? regOtherCity : regCity;
      if (!cityValue) { Alert.alert('Please select or enter your city'); return; }
      setRegStep('professional');
    } else if (regStep === 'professional') {
      if (!regProfession) { Alert.alert('Please select your profession'); return; }
      if (regProfession === 'Other' && !regOtherProfession) { Alert.alert('Please describe your profession'); return; }
      setRegStep('confirm');
    } else if (regStep === 'confirm') {
      // Save any edits made during registration back to profile
      if (user) {
        updateUser({
          first_name: regFirstName.trim(),
          last_name: regLastName.trim(),
          email: regEmail.trim() || undefined,
          country: regCountry || undefined,
          city: (regCity === 'Other' ? regOtherCity : regCity) || undefined,
          profession: (regProfession === 'Other' ? regOtherProfession : regProfession) || undefined,
          company_name: regCompany.trim() || undefined,
          designation: regDesignation.trim() || undefined,
          profile_complete: true,
        });
      }
      setShowRegister(false);
      setRegDone(true);
      if (exh) addDemoRegistration(exh.id); // persist registered state — does NOT activate exhibition
      setTab('ticket');
    }
  };

  const regStepLabel: Record<RegStep, string> = user
    ? { phone: '', otp: '', personal: 'Step 1 of 3', professional: 'Step 2 of 3', confirm: 'Step 3 of 3' }
    : { phone: 'Step 1 of 4', otp: 'Step 1 of 4', personal: 'Step 2 of 4', professional: 'Step 3 of 4', confirm: 'Step 4 of 4' };

  if (!exh) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: headerPaddingTop as any }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* ── TAB BAR ─────────────────────────────────────────────────────── */}
      <View style={[s.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {visibleTabs.map((t) => (
          <Pressable
            key={t}
            style={[s.tabBtn, tab === t && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabLabel, { color: tab === t ? colors.accent : colors.textMuted }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── DETAILS TAB ─────────────────────────────────────────────────── */}
      {tab === 'details' && (
        <ScrollView key="details" style={s.tabFlex} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}
          onTouchStart={(e) => { swipeStartX.current = e.nativeEvent.pageX; swipeStartY.current = e.nativeEvent.pageY; }}
          onTouchEnd={(e) => handleTabSwipe(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        >
          <Text style={[s.exhName, { color: colors.text }]}>{exh.name}</Text>
          {exh.tagline && <Text style={[s.tagline, { color: colors.accent }]}>{exh.tagline}</Text>}
          <View style={[s.infoCard, { backgroundColor: colors.surface }]}>
            <InfoRow icon="calendar-outline" text={`${fmt(exh.start_date)} – ${fmt(exh.end_date)}`} colors={colors} />
            <InfoRow icon="time-outline" text={exh.timings} colors={colors} />
            <InfoRow icon="location-outline" text={`${exh.venue_name}, ${exh.city}`} colors={colors} />
            {exh.venue_address && <InfoRow icon="navigate-outline" text={exh.venue_address} colors={colors} />}
          </View>
          {exh.about && (
            <>
              <Text style={[s.sectionLabel, { color: colors.textMuted }]}>ABOUT</Text>
              <Text style={[s.aboutText, { color: colors.textSecondary }]}>{exh.about}</Text>
            </>
          )}
          <View style={s.statsRow}>
            <StatBox label="Cities" value={`${exh.stats.cities}+`} colors={colors} />
            <StatBox label="Brands" value={`${exh.stats.brands}+`} colors={colors} />
          </View>
          {exh.brands.length > 0 && (
            <>
              <View style={s.sectionLabelRow}>
                <Text style={[s.sectionLabel, { color: colors.textMuted, marginTop: Spacing.lg, marginBottom: 0 }]}>EXHIBITORS</Text>
                {isCheckedIn && (
                  <Pressable onPress={() => setTab('brands')}>
                    <Text style={[s.seeAll, { color: colors.accent }]}>See All</Text>
                  </Pressable>
                )}
              </View>
              <View style={[s.infoBlurb, { backgroundColor: colors.surface, marginTop: Spacing.sm }]}>
                <Ionicons name="storefront-outline" size={14} color={colors.textMuted} />
                <Text style={[s.infoBlurbText, { color: colors.textMuted }]}>
                  These are the brands exhibiting at this show. Register and get checked in to explore their full booth details and product catalogues.
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.brandsScroll}>
                {exh.brands.map((b: any) => (
                  <Pressable key={b.id} style={[s.brandPill, { backgroundColor: colors.surface }]} onPress={() => router.push(`/brand/${b.id}`)}>
                    <Text style={[s.brandPillName, { color: colors.text }]}>{b.name}</Text>
                    <Text style={[s.brandPillCat, { color: colors.textMuted }]}>{b.category}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
          <View style={s.bottomSpacer} />
        </ScrollView>
      )}

      {/* ── TICKET TAB ──────────────────────────────────────────────────── */}
      {tab === 'ticket' && isRegistered && (
        <ScrollView key="ticket" style={s.tabFlex} showsVerticalScrollIndicator={false} contentContainerStyle={s.ticketScroll}
          onTouchStart={(e) => { swipeStartX.current = e.nativeEvent.pageX; swipeStartY.current = e.nativeEvent.pageY; }}
          onTouchEnd={(e) => handleTabSwipe(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        >
          <View style={[s.infoBlurb, { backgroundColor: colors.surface, marginBottom: Spacing.lg }]}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={[s.infoBlurbText, { color: colors.textMuted }]}>
              This is your entry pass. Show this QR code at the venue entrance to get checked in.
            </Text>
          </View>
          <View style={[s.ticketCard, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
            <Text style={[s.ticketExhName, { color: colors.text }]}>{exh.name}</Text>
            <Text style={[s.ticketVenue, { color: colors.textSecondary }]}>{exh.venue_name}</Text>
            <Text style={[s.ticketDate, { color: colors.textSecondary }]}>{fmt(exh.start_date)} – {fmt(exh.end_date)} · {exh.timings}</Text>
            <View style={[s.ticketDivider, { borderColor: colors.border }]} />
            <View style={[s.qrWrap, { backgroundColor: colors.background }]}>
              <QRCode value={`entry:${exh.id}:user-001`} size={160} backgroundColor={colors.background} color={colors.text} />
            </View>
            <Text style={[s.ticketHint, { color: colors.textMuted }]}>Present this QR at the venue entrance</Text>
            <View style={[s.ticketDivider, { borderColor: colors.border }]} />
            <InfoRow icon="location-outline" text={exh.venue_address || exh.venue_name} colors={colors} />
            <View style={{ height: Spacing.sm }} />
            <InfoRow icon="information-circle-outline" text="Valid for single entry. Non-transferable." colors={colors} />
          </View>
          {isDemoMode && !isCheckedIn && (
            <>
              {gateSimState === 'idle' && (
                <Pressable style={[s.simulateGateBtn, { backgroundColor: colors.accent + '18', borderColor: colors.accent }]} onPress={() => setGateSimState('scanning')}>
                  <Ionicons name="qr-code-outline" size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.simulateGateBtnText, { color: colors.accent }]}>Simulate Gate Scan</Text>
                    <Text style={[s.simulateGateBtnSub, { color: colors.textMuted }]}>Demo: tap to simulate scanning at the venue entrance</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                </Pressable>
              )}
              {gateSimState === 'scanning' && (
                <View style={[s.gateSimCard, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
                  <View style={[s.gateSimQrFrame, { borderColor: colors.accent }]}>
                    <View style={[s.gateSimCorner, s.gateSimCornerTL, { borderColor: colors.accent }]} />
                    <View style={[s.gateSimCorner, s.gateSimCornerTR, { borderColor: colors.accent }]} />
                    <View style={[s.gateSimCorner, s.gateSimCornerBL, { borderColor: colors.accent }]} />
                    <View style={[s.gateSimCorner, s.gateSimCornerBR, { borderColor: colors.accent }]} />
                    <Ionicons name="qr-code-outline" size={52} color={colors.accent + 'AA'} />
                  </View>
                  <Text style={[s.gateSimTitle, { color: colors.text }]}>Scanning at gate...</Text>
                  <Text style={[s.gateSimSub, { color: colors.textMuted }]}>Hold your phone QR near the scanner at {exh.venue_name}</Text>
                  <Pressable style={[s.gateSimConfirmBtn, { backgroundColor: colors.accent }]} onPress={() => { setActiveExhibition(exh.id, exh.name); setGateSimState('success'); }}>
                    <Ionicons name="scan" size={18} color="#FFF" />
                    <Text style={s.gateSimConfirmBtnText}>Confirm Scan</Text>
                  </Pressable>
                  <Pressable onPress={() => setGateSimState('idle')} style={{ marginTop: Spacing.sm }}>
                    <Text style={{ color: colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' }}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
          {isDemoMode && gateSimState === 'success' && (
            <View style={[s.gateSimCard, { backgroundColor: colors.accent + '18', borderColor: colors.accent }]}>
              <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
              <Text style={[s.gateSimTitle, { color: colors.text }]}>Checked in successfully!</Text>
              <Text style={[s.gateSimSub, { color: colors.textMuted }]}>{exh.name} is now active on your home screen.</Text>
              <Pressable style={[s.gateSimConfirmBtn, { backgroundColor: colors.accent }]} onPress={() => router.push('/(app)')}>
                <Text style={s.gateSimConfirmBtnText}>Go to Home</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── EXPLORE TAB ─────────────────────────────────────────────────── */}
      {tab === 'explore' && isCheckedIn && (
        <ScrollView key="explore" style={s.tabFlex} showsVerticalScrollIndicator={false} contentContainerStyle={s.exploreScroll}
          onTouchStart={(e) => { swipeStartX.current = e.nativeEvent.pageX; swipeStartY.current = e.nativeEvent.pageY; }}
          onTouchEnd={(e) => handleTabSwipe(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        >
          <Text style={[s.sectionLabel, { color: colors.textMuted, marginTop: 0 }]}>FLOOR MAP</Text>
          {EXHIBITIONS_WITH_MAP.has(exh.id) ? (
            <Pressable style={[s.mapCard, { backgroundColor: colors.surface }]} onPress={() => router.push(`/map?exhibitionId=${exh.id}`)}>
              <View style={s.mapCardLeft}>
                <Ionicons name="map-outline" size={28} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.mapCardTitle, { color: colors.text }]}>Interactive Floor Map</Text>
                  <Text style={[s.mapCardSub, { color: colors.textMuted }]}>Navigate booths, find brands &amp; facilities</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ) : (
            <View style={[s.mapCard, { backgroundColor: colors.surface }]}>
              <View style={s.mapCardLeft}>
                <Ionicons name="map-outline" size={28} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.mapCardTitle, { color: colors.textMuted }]}>Floor Map Coming Soon</Text>
                  <Text style={[s.mapCardSub, { color: colors.textMuted }]}>Map will be available before the show</Text>
                </View>
              </View>
            </View>
          )}
          <Text style={[s.sectionLabel, { color: colors.textMuted }]}>FOOD STALLS</Text>
          <View style={[s.facilityCard, { backgroundColor: colors.surface }]}>
            {[{ name: 'Central Café', loc: 'Near main entrance, Ground Floor' }, { name: 'Food Court', loc: 'East wing, Level 1' }, { name: 'Snack Corner', loc: 'Lobby, adjacent to registration' }].map((item, i) => (
              <View key={item.name} style={[s.facilityRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <Ionicons name="restaurant-outline" size={14} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.facilityName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[s.facilityLoc, { color: colors.textMuted }]}>{item.loc}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={[s.sectionLabel, { color: colors.textMuted }]}>WASHROOMS</Text>
          <View style={[s.facilityCard, { backgroundColor: colors.surface }]}>
            {[{ hall: 'Hall 1', loc: 'Left of Hall 1 main entrance' }, { hall: 'Hall 2', loc: 'End of East corridor, Hall 2' }, { hall: 'Hall 3', loc: 'Near Hall 3 elevator, Ground Floor' }].map((item, i) => (
              <View key={item.hall} style={[s.facilityRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <Ionicons name="water-outline" size={14} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.facilityName, { color: colors.text }]}>{item.hall}</Text>
                  <Text style={[s.facilityLoc, { color: colors.textMuted }]}>{item.loc}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── BRANDS TAB ──────────────────────────────────────────────────── */}
      {tab === 'brands' && isCheckedIn && (() => {
        const brandCategories = [...new Set(exh.brands.map((b: any) => b.category as string))].sort();
        const filtered = exh.brands.filter((b: any) => {
          const q = brandSearch.toLowerCase();
          const matchSearch = !q || b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q) || b.booth.toLowerCase().includes(q) || b.hall.toLowerCase().includes(q);
          const matchCat = !categoryFilter || b.category === categoryFilter;
          return matchSearch && matchCat;
        });
        const pairs: any[][] = [];
        for (let i = 0; i < filtered.length; i += 2) pairs.push(filtered.slice(i, i + 2));

        return (
          <View key="brands" style={s.brandsTabRoot}
            onTouchStart={(e) => { swipeStartX.current = e.nativeEvent.pageX; swipeStartY.current = e.nativeEvent.pageY; }}
            onTouchEnd={(e) => handleTabSwipe(e.nativeEvent.pageX, e.nativeEvent.pageY)}
          >
            {/* Search + filter icon row */}
            <View style={s.brandsTopRow}>
              <View style={[s.brandsSearchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search" size={15} color={colors.textMuted} />
                <TextInput style={[s.brandsSearchInput, { color: colors.text }]} placeholder="Search brands or booth…" placeholderTextColor={colors.textMuted} value={brandSearch} onChangeText={setBrandSearch} />
                {brandSearch.length > 0 && <Pressable onPress={() => setBrandSearch('')}><Ionicons name="close-circle" size={15} color={colors.textMuted} /></Pressable>}
              </View>
              <Pressable
                style={[s.brandsFilterBtn, { backgroundColor: categoryFilter ? colors.accent + '18' : colors.surface, borderColor: categoryFilter ? colors.accent : colors.border }]}
                onPress={() => setShowCategorySheet(true)}
              >
                <Ionicons name="options-outline" size={18} color={categoryFilter ? colors.accent : colors.textSecondary} />
              </Pressable>
            </View>

            {/* Active filter label */}
            {categoryFilter && (
              <Pressable style={s.activeCatRow} onPress={() => setCategoryFilter(null)}>
                <View style={[s.activeCatPill, { backgroundColor: colors.accent + '18' }]}>
                  <Text style={[s.activeCatText, { color: colors.accent }]}>{categoryFilter}</Text>
                  <Ionicons name="close" size={11} color={colors.accent} />
                </View>
              </Pressable>
            )}

            {/* Brand grid */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.brandsTabScroll}>
              {filtered.length === 0 ? (
                <View style={s.brandsEmpty}>
                  <Text style={[s.brandsEmptyText, { color: colors.textMuted }]}>
                    {categoryFilter && !brandSearch ? `No brands in "${categoryFilter}"` : `No brands match "${brandSearch}"`}
                  </Text>
                </View>
              ) : (
                pairs.map((pair, pi) => (
                  <View key={pi} style={s.brandGridRow}>
                    {pair.map((b: any) => (
                      <Pressable key={b.id} style={[s.brandGridCard, { backgroundColor: colors.surface }]} onPress={() => router.push(`/brand/${b.id}`)}>
                        <Image source={{ uri: getCachedCover(b.category, b.id) }} style={s.brandGridImg} resizeMode="cover" />
                        <View style={s.brandGridBody}>
                          <Text style={[s.brandGridName, { color: colors.text }]} numberOfLines={1}>{b.name}</Text>
                          <Text style={[s.brandGridCat, { color: colors.textMuted }]} numberOfLines={1}>{b.category}</Text>
                          <Text style={[s.brandGridBooth, { color: colors.textMuted }]} numberOfLines={1}>{b.hall} · Booth {b.booth}</Text>
                        </View>
                      </Pressable>
                    ))}
                    {pair.length === 1 && <View style={s.brandGridCard} />}
                  </View>
                ))
              )}
            </ScrollView>

            {/* Category bottom sheet */}
            <Modal visible={showCategorySheet} transparent animationType="slide">
              <Pressable style={s.catSheetOverlay} onPress={() => setShowCategorySheet(false)}>
                <View style={[s.catSheet, { backgroundColor: colors.surface }]}>
                  <View style={[s.catSheetHandle, { backgroundColor: colors.border }]} />
                  <Text style={[s.catSheetTitle, { color: colors.text }]}>Filter by category</Text>
                  <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                    <Pressable
                      style={[s.catSheetOption, !categoryFilter && { backgroundColor: colors.accent + '12' }]}
                      onPress={() => { setCategoryFilter(null); setShowCategorySheet(false); }}
                    >
                      <Text style={[s.catSheetOptionText, { color: !categoryFilter ? colors.accent : colors.text }]}>All categories</Text>
                      {!categoryFilter && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                    </Pressable>
                    {brandCategories.map((cat) => (
                      <Pressable
                        key={cat}
                        style={[s.catSheetOption, categoryFilter === cat && { backgroundColor: colors.accent + '12' }]}
                        onPress={() => { setCategoryFilter(cat); setShowCategorySheet(false); }}
                      >
                        <Text style={[s.catSheetOptionText, { color: categoryFilter === cat ? colors.accent : colors.text }]}>{cat}</Text>
                        {categoryFilter === cat && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </Pressable>
            </Modal>
          </View>
        );
      })()}

      {/* Floating Register CTA */}
      {tab === 'details' && !isRegistered && (
        <View style={[s.floatingCta, { backgroundColor: colors.background }]}>
          <View style={[s.regInfoRow, { backgroundColor: colors.surface }]}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={[s.regInfoText, { color: colors.textMuted }]}>
              Register to get your entry ticket and access the floor map & brand details.
            </Text>
          </View>
          <Pressable style={[s.registerBtn, { backgroundColor: colors.accent }]} onPress={handleRegisterPress}>
            <Text style={s.registerBtnText}>Register Now</Text>
          </Pressable>
        </View>
      )}

      {/* ── REGISTRATION FLOW MODAL ──────────────────────────────────────── */}
      <Modal visible={showRegister} animationType="slide" transparent>
        <View style={s.regOverlay}>
          <View style={[s.regModal, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={s.regModalHeader}>
              <Text style={[s.regStepChip, { color: colors.textMuted }]}>{regStepLabel[regStep]}</Text>
              <Pressable onPress={() => setShowRegister(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.regScroll}>

              {/* STEP 1: Phone */}
              {regStep === 'phone' && (
                <>
                  <Text style={[s.regTitle, { color: colors.text }]}>Register for {exh.name}</Text>
                  <Text style={[s.regSub, { color: colors.textSecondary }]}>
                    Enter your mobile number to receive an OTP and secure your spot at this exhibition.
                  </Text>
                  <Text style={[s.regLabel, { color: colors.textMuted }]}>MOBILE NUMBER</Text>
                  <View style={[s.regInputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[s.regPhonePrefix, { color: colors.textSecondary }]}>+91</Text>
                    <TextInput
                      style={[s.regInput, { color: colors.text }]}
                      placeholder="98765 43210"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={regPhone}
                      onChangeText={setRegPhone}
                    />
                  </View>
                  <Text style={[s.regFieldHint, { color: colors.textMuted }]}>
                    We'll send a one-time password to verify your number. No spam, ever.
                  </Text>
                </>
              )}

              {/* STEP 1B: OTP */}
              {regStep === 'otp' && (
                <>
                  <Text style={[s.regTitle, { color: colors.text }]}>Verify your number</Text>
                  <Text style={[s.regSub, { color: colors.textSecondary }]}>
                    We sent a 6-digit OTP to +91 {regPhone}. Enter it below to continue.
                  </Text>
                  {isDemoMode && (
                    <View style={[s.infoBlurb, { backgroundColor: colors.accent + '18' }]}>
                      <Ionicons name="play-circle-outline" size={13} color={colors.accent} />
                      <Text style={[s.infoBlurbText, { color: colors.accent }]}>Demo mode — enter any 4 digits to continue.</Text>
                    </View>
                  )}
                  <Text style={[s.regLabel, { color: colors.textMuted }]}>OTP</Text>
                  <TextInput
                    style={[s.regInputFull, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="● ● ● ● ● ●"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={regOtp}
                    onChangeText={setRegOtp}
                  />
                  <Pressable onPress={() => {}}>
                    <Text style={[s.regResend, { color: colors.gold }]}>Resend OTP</Text>
                  </Pressable>
                </>
              )}

              {/* STEP 2: Personal details */}
              {regStep === 'personal' && (
                <>
                  <Text style={[s.regTitle, { color: colors.text }]}>Your details</Text>
                  <Text style={[s.regSub, { color: colors.textSecondary }]}>
                    This creates your Designup profile — used for your digital visiting card and connecting with brands at the show.
                  </Text>
                  <Text style={[s.regLabel, { color: colors.textMuted }]}>FIRST NAME *</Text>
                  <TextInput
                    style={[s.regInputFull, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="Priya"
                    placeholderTextColor={colors.textMuted}
                    value={regFirstName}
                    onChangeText={setRegFirstName}
                  />
                  <Text style={[s.regLabel, { color: colors.textMuted }]}>LAST NAME</Text>
                  <TextInput
                    style={[s.regInputFull, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="Sharma"
                    placeholderTextColor={colors.textMuted}
                    value={regLastName}
                    onChangeText={setRegLastName}
                  />
                  <Text style={[s.regLabel, { color: colors.textMuted }]}>EMAIL</Text>
                  <TextInput
                    style={[s.regInputFull, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="priya@studio.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={regEmail}
                    onChangeText={setRegEmail}
                  />
                  <Text style={[s.regLabel, { color: colors.textMuted }]}>COUNTRY *</Text>
                  <Pressable
                    style={[s.regInputFull, s.pickerRow, { backgroundColor: colors.surface, borderColor: showCountryPicker ? colors.accent : colors.border }]}
                    onPress={() => { setShowCountryPicker((v) => !v); setShowCityPicker(false); }}
                  >
                    <Text style={[{ color: regCountry ? colors.text : colors.textMuted, fontSize: FontSize.md, flex: 1 }]}>
                      {regCountry || 'Select country'}
                    </Text>
                    <Ionicons name={showCountryPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </Pressable>
                  {showCountryPicker && (
                    <View style={[s.pickerList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {COUNTRIES.map((c) => (
                        <Pressable
                          key={c}
                          style={[s.pickerItem, { borderBottomColor: colors.border, backgroundColor: regCountry === c ? colors.accent + '18' : 'transparent' }]}
                          onPress={() => { setRegCountry(c); setRegCity(''); setRegOtherCity(''); setShowCountryPicker(false); }}
                        >
                          <Text style={[s.pickerItemText, { color: regCountry === c ? colors.accent : colors.text }]}>{c}</Text>
                          {regCountry === c && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {regCountry && (
                    <>
                      <Text style={[s.regLabel, { color: colors.textMuted }]}>CITY *</Text>
                      <Pressable
                        style={[s.regInputFull, s.pickerRow, { backgroundColor: colors.surface, borderColor: showCityPicker ? colors.accent : colors.border }]}
                        onPress={() => { setShowCityPicker((v) => !v); setShowCountryPicker(false); }}
                      >
                        <Text style={[{ color: regCity ? colors.text : colors.textMuted, fontSize: FontSize.md, flex: 1 }]}>
                          {regCity || 'Select city'}
                        </Text>
                        <Ionicons name={showCityPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                      </Pressable>
                      {showCityPicker && (
                        <View style={[s.pickerList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          {(CITIES[regCountry] ?? ['Other']).map((c) => (
                            <Pressable
                              key={c}
                              style={[s.pickerItem, { borderBottomColor: colors.border, backgroundColor: regCity === c ? colors.accent + '18' : 'transparent' }]}
                              onPress={() => { setRegCity(c); setRegOtherCity(''); setShowCityPicker(false); }}
                            >
                              <Text style={[s.pickerItemText, { color: regCity === c ? colors.accent : colors.text }]}>{c}</Text>
                              {regCity === c && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                            </Pressable>
                          ))}
                        </View>
                      )}
                      {regCity === 'Other' && (
                        <TextInput
                          style={[s.regInputFull, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, marginTop: Spacing.sm }]}
                          placeholder="Enter your city"
                          placeholderTextColor={colors.textMuted}
                          value={regOtherCity}
                          onChangeText={setRegOtherCity}
                        />
                      )}
                    </>
                  )}
                </>
              )}

              {/* STEP 3: Professional details */}
              {regStep === 'professional' && (
                <>
                  <Text style={[s.regTitle, { color: colors.text }]}>Your professional profile</Text>
                  <Text style={[s.regSub, { color: colors.textSecondary }]}>
                    Brands use this to understand who they're meeting. This becomes your digital visiting card at booths.
                  </Text>
                  <Text style={[s.regLabel, { color: colors.textMuted }]}>PROFESSION *</Text>
                  <Pressable
                    style={[s.regInputFull, s.pickerRow, { backgroundColor: colors.surface, borderColor: showProfessionPicker ? colors.accent : colors.border }]}
                    onPress={() => setShowProfessionPicker((v) => !v)}
                  >
                    <Text style={[{ color: regProfession ? colors.text : colors.textMuted, fontSize: FontSize.md, flex: 1 }]}>
                      {regProfession || 'Select your profession'}
                    </Text>
                    <Ionicons name={showProfessionPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </Pressable>
                  {showProfessionPicker && (
                    <View style={[s.pickerList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {PROFESSIONS.map((p) => (
                        <Pressable
                          key={p}
                          style={[s.pickerItem, { borderBottomColor: colors.border, backgroundColor: regProfession === p ? colors.accent + '18' : 'transparent' }]}
                          onPress={() => { setRegProfession(p); setShowProfessionPicker(false); }}
                        >
                          <Text style={[s.pickerItemText, { color: regProfession === p ? colors.accent : colors.text }]}>{p}</Text>
                          {regProfession === p && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {regProfession === 'Other' && (
                    <TextInput
                      style={[s.regInputFull, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                      placeholder="Describe your role"
                      placeholderTextColor={colors.textMuted}
                      value={regOtherProfession}
                      onChangeText={setRegOtherProfession}
                    />
                  )}
                  <Text style={[s.regLabel, { color: colors.textMuted }]}>COMPANY NAME</Text>
                  <TextInput
                    style={[s.regInputFull, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="Studio Forma"
                    placeholderTextColor={colors.textMuted}
                    value={regCompany}
                    onChangeText={setRegCompany}
                  />
                  <Text style={[s.regLabel, { color: colors.textMuted }]}>DESIGNATION</Text>
                  <TextInput
                    style={[s.regInputFull, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="Principal Designer"
                    placeholderTextColor={colors.textMuted}
                    value={regDesignation}
                    onChangeText={setRegDesignation}
                  />
                </>
              )}

              {/* STEP 4: Review & Confirm */}
              {regStep === 'confirm' && (
                <>
                  <Text style={[s.regTitle, { color: colors.text }]}>Review & confirm</Text>
                  <Text style={[s.regSub, { color: colors.textSecondary }]}>
                    Check your details before we generate your entry ticket.
                  </Text>
                  {user && (
                    <View style={[s.infoBlurb, { backgroundColor: colors.accent + '15', marginBottom: Spacing.sm }]}>
                      <Ionicons name="person-circle-outline" size={13} color={colors.accent} />
                      <Text style={[s.infoBlurbText, { color: colors.accent }]}>
                        Any changes here will also be saved to your Designup profile.
                      </Text>
                    </View>
                  )}
                  <View style={[s.confirmCard, { backgroundColor: colors.surface }]}>
                    <ConfirmRow label="Name" value={`${regFirstName} ${regLastName}`.trim()} colors={colors} />
                    <ConfirmRow label="Phone" value={`+91 ${regPhone}`} colors={colors} />
                    {regEmail ? <ConfirmRow label="Email" value={regEmail} colors={colors} /> : null}
                    <ConfirmRow label="Country" value={regCountry} colors={colors} />
                    <ConfirmRow label="City" value={regCity === 'Other' ? regOtherCity : regCity} colors={colors} />
                    <ConfirmRow label="Profession" value={regProfession === 'Other' ? regOtherProfession : regProfession} colors={colors} />
                    {regCompany ? <ConfirmRow label="Company" value={regCompany} colors={colors} /> : null}
                    {regDesignation ? <ConfirmRow label="Designation" value={regDesignation} colors={colors} /> : null}
                  </View>
                  <View style={[s.infoBlurb, { backgroundColor: colors.surface, marginTop: Spacing.md }]}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={colors.accent} />
                    <Text style={[s.infoBlurbText, { color: colors.textSecondary }]}>
                      Your entry ticket will be generated instantly. Valid for single entry — non-transferable.
                    </Text>
                  </View>
                </>
              )}

              <Pressable style={[s.regNextBtn, { backgroundColor: colors.accent }]} onPress={handleRegNext}>
                <Text style={s.regNextBtnText}>
                  {regStep === 'confirm' ? 'Submit & Get Ticket' : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </Pressable>
              {regStep === 'confirm' && (
                <Pressable style={[s.regBackBtn, { borderColor: colors.border }]} onPress={() => setRegStep('professional')}>
                  <Text style={[s.regBackBtnText, { color: colors.textSecondary }]}>Back</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, text, colors }: { icon: any; text: string; colors: any }) {
  const s = makeStyles(colors);
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={15} color={colors.textMuted} />
      <Text style={[s.infoText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

function StatBox({ label, value, colors }: { label: string; value: string; colors: any }) {
  const s = makeStyles(colors);
  return (
    <View style={[s.statBox, { backgroundColor: colors.surface }]}>
      <Text style={[s.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function ConfirmRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: FontSize.sm, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: FontSize.sm, color: colors.text, fontWeight: FontWeight.medium }}>{value}</Text>
    </View>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'web' ? 14 : 56, paddingBottom: Spacing.sm,
    },
    backBtn: { width: 30, padding: 4 },
    headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    tabBar: {
      flexDirection: 'row', borderBottomWidth: 1,
      paddingHorizontal: Spacing.lg,
    },
    tabBtn: { paddingVertical: Spacing.md, marginRight: Spacing.xl, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },
    exhName: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, marginTop: Spacing.lg, marginBottom: 4 },
    tagline: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
    infoCard: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.lg },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    infoText: { fontSize: FontSize.sm, flex: 1, lineHeight: 20 },
    sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.lg },
    sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    seeAll: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.lg },
    aboutText: { fontSize: FontSize.sm, lineHeight: 22 },
    statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
    statBox: { flex: 1, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center' },
    statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
    statLabel: { fontSize: FontSize.xs, marginTop: 2 },
    brandsScroll: { marginBottom: Spacing.lg },
    brandPill: { borderRadius: Radius.lg, padding: Spacing.md, marginRight: Spacing.sm, minWidth: 120 },
    brandPillName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    brandPillCat: { fontSize: FontSize.xs, marginTop: 2 },
    bottomSpacer: { height: 80 },

    // Info blurb
    infoBlurb: {
      flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
      borderRadius: Radius.md, padding: Spacing.sm,
    },
    infoBlurbText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },

    // Floating register CTA
    floatingCta: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: Spacing.lg, paddingBottom: 32, gap: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    },
    regInfoRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', borderRadius: Radius.md, padding: Spacing.sm },
    regInfoText: { flex: 1, fontSize: FontSize.xs, lineHeight: 17 },
    registerBtn: { paddingVertical: 16, borderRadius: Radius.md, alignItems: 'center' },
    registerBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    // Simulate gate scan button (idle state)
    simulateGateBtn: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1,
      marginTop: Spacing.lg,
    },
    simulateGateBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    simulateGateBtnSub: { fontSize: FontSize.xs, marginTop: 2 },
    // Gate sim card (scanning / success states)
    gateSimCard: {
      borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1.5,
      alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg,
    },
    gateSimQrFrame: {
      width: 120, height: 120, borderWidth: 2, borderRadius: Radius.lg,
      alignItems: 'center', justifyContent: 'center', position: 'relative',
    },
    gateSimCorner: { position: 'absolute', width: 20, height: 20, borderWidth: 3 },
    gateSimCornerTL: { top: -2, left: -2, borderBottomWidth: 0, borderRightWidth: 0, borderRadius: 2 },
    gateSimCornerTR: { top: -2, right: -2, borderBottomWidth: 0, borderLeftWidth: 0, borderRadius: 2 },
    gateSimCornerBL: { bottom: -2, left: -2, borderTopWidth: 0, borderRightWidth: 0, borderRadius: 2 },
    gateSimCornerBR: { bottom: -2, right: -2, borderTopWidth: 0, borderLeftWidth: 0, borderRadius: 2 },
    gateSimTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
    gateSimSub: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    gateSimConfirmBtn: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingVertical: 14, paddingHorizontal: Spacing.xl, borderRadius: Radius.md, marginTop: Spacing.sm,
    },
    gateSimConfirmBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    // Ticket
    ticketScroll: { padding: Spacing.lg, paddingBottom: 100 },
    ticketCard: { borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1.5, alignItems: 'center' },
    ticketExhName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center', marginBottom: 4 },
    ticketVenue: { fontSize: FontSize.sm, textAlign: 'center' },
    ticketDate: { fontSize: FontSize.sm, textAlign: 'center', marginBottom: Spacing.lg },
    ticketDivider: { width: '100%', borderTopWidth: 1, borderStyle: 'dashed', marginVertical: Spacing.lg },
    qrWrap: { padding: Spacing.lg, borderRadius: Radius.lg },
    ticketHint: { fontSize: FontSize.xs, marginTop: Spacing.sm, textAlign: 'center' },

    // Explore
    exploreScroll: { padding: Spacing.lg, paddingBottom: 100 },
    mapCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg,
    },
    mapCardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    mapCardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    mapCardSub: { fontSize: FontSize.xs, marginTop: 2 },
    exploreBrandRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    exploreBrandName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    exploreBrandCat: { fontSize: FontSize.xs, marginTop: 2 },

    // Facility cards (food/washroom)
    facilityCard: { borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: 0 },
    facilityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm },
    facilityName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    facilityLoc: { fontSize: FontSize.xs, marginTop: 2 },

    // Brands tab
    tabFlex: { flex: 1 },
    brandsTabRoot: { flex: 1 },
    brandsTopRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: 0,
    },
    brandsSearchWrap: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderWidth: 1, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, height: 44,
    },
    brandsSearchInput: { flex: 1, fontSize: FontSize.sm },
    brandsFilterBtn: {
      width: 44, height: 44, borderRadius: Radius.md, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    },
    activeCatRow: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    activeCatPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: Radius.full,
    },
    activeCatText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
    brandsTabScroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: Spacing.sm },
    // Category bottom sheet
    catSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
    catSheet: {
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 40,
      width: '100%', maxWidth: 430,
      maxHeight: SCREEN_H * 0.5,
    },
    catSheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
    catSheetTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Spacing.sm },
    catSheetOption: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, paddingHorizontal: Spacing.sm, borderRadius: Radius.md,
    },
    catSheetOptionText: { fontSize: FontSize.md },
    brandGridRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
    brandGridCard: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden' },
    brandGridImg: { width: '100%', height: 160 },
    brandGridImgPlaceholder: { width: '100%', height: 160, alignItems: 'center', justifyContent: 'center' },
    brandGridInitial: { fontSize: 32, fontWeight: FontWeight.bold },
    brandGridBody: { padding: Spacing.sm, gap: 2 },
    brandGridName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    brandGridCat: { fontSize: FontSize.xs },
    brandGridBooth: { fontSize: 10 },
    brandsEmpty: { alignItems: 'center', paddingVertical: Spacing.xl },
    brandsEmptyText: { fontSize: FontSize.sm },

    // Registration modal
    regOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', alignItems: 'center' },
    regModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', width: '100%', maxWidth: 390 },
    regModalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
    },
    regStepChip: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1 },
    regScroll: { paddingHorizontal: Spacing.lg, paddingBottom: 60, gap: Spacing.sm },
    regTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: 4 },
    regSub: { fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.md },
    regLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1, marginTop: Spacing.md, marginBottom: Spacing.sm },
    regInputRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 52,
    },
    regPhonePrefix: { fontSize: FontSize.md, marginRight: Spacing.sm, fontWeight: FontWeight.medium },
    regInput: { flex: 1, fontSize: FontSize.md },
    regInputFull: {
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md,
      height: 52, fontSize: FontSize.md,
    },
    regFieldHint: { fontSize: FontSize.xs, lineHeight: 18 },
    regResend: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginTop: Spacing.md },
    profOption: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md,
      paddingVertical: 12, marginBottom: Spacing.sm,
    },
    profOptionText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    confirmCard: { borderRadius: Radius.lg, padding: Spacing.lg },
    regNextBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, paddingVertical: 16, borderRadius: Radius.md,
      marginTop: Spacing.xl,
    },
    regNextBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    regBackBtn: {
      paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center',
      borderWidth: 1, marginTop: Spacing.sm,
    },
    regBackBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
    // Inline pickers
    pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pickerList: {
      borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.sm,
    },
    pickerItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pickerItemText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  });
}
