import { ScrollView, View, Text, StyleSheet, Pressable, Image, Modal, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { getExhibitions, getExhibition, getNewBrands, type ApiExhibition, type NewBrand } from '../../lib/api';
import { ALL_EXHIBITIONS } from '../../data/exhibitions';
import { ALL_BRANDS } from '../../data/brands';
import { getCachedCover, subscribeToCache } from '../../lib/unsplash';
import { isBeta } from '../../lib/betaConfig';
import { Analytics } from '../../lib/analytics';
import { recognizeCardText, recognizeCardTextWeb, parseCardFields } from '../../lib/cardOcr';
import { cardScanStore } from '../../lib/cardScanStore';
import { getCardDisplayName } from './connections';

function getBrandCoverImage(brandId: string): string | null {
  const brand = ALL_BRANDS.find((b) => b.id === brandId);
  return brand?.products?.[0]?.images?.[0] ?? null;
}

const EXHIBITION_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800',
  'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
  'https://images.unsplash.com/photo-1551818255-e6e10579a0d4?w=800',
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800',
];

function getExhibitionImage(exhibition: any): string {
  if (exhibition.cover_image_url) return exhibition.cover_image_url;
  if (exhibition.layout_map_url) return exhibition.layout_map_url;
  const hash = String(exhibition.id).split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
  return EXHIBITION_FALLBACK_IMAGES[hash % EXHIBITION_FALLBACK_IMAGES.length];
}


// Demo connection profiles for item 11
const DEMO_CONNECTIONS = [
  { id: 'dc1', full_name: 'Priya Sharma', designation: 'Principal Designer', company: 'Studio Forma', email: 'priya@studioforma.com', phone: '+91 98765 43210', city: 'Mumbai', qr: 'user:u-priya' },
  { id: 'dc2', full_name: 'Arjun Mehta', designation: 'Sales Manager', company: 'Lumina Lighting', brand_id: 'b01', email: 'arjun@lumina.in', phone: '+91 87654 32109', city: 'Mumbai', qr: 'user:u-arjun' },
  { id: 'dc3', full_name: 'Ananya Kapoor', designation: 'Interior Architect', company: 'Kapoor & Associates', email: 'ananya@kapoorassoc.com', phone: '+91 76543 21098', city: 'Delhi', qr: 'user:u-ananya' },
  { id: 'dc4', full_name: 'Rohan Desai', designation: 'Brand Director', company: 'ClayCraft Ceramics', brand_id: 'b02', email: 'rohan@claycraft.in', phone: '+91 65432 10987', city: 'Ahmedabad', qr: 'user:u-rohan' },
  { id: 'dc5', full_name: 'Meera Nair', designation: 'Creative Director', company: 'Bloom Art Studio', brand_id: 'b11', email: 'meera@bloomart.in', phone: '+91 54321 09876', city: 'Bangalore', qr: 'user:u-meera' },
  { id: 'dc6', full_name: 'Vikram Bose', designation: 'Head of Sales', company: 'Arterra Tiles', email: 'vikram@arterra.in', phone: '+91 43210 98765', city: 'Chennai', qr: 'user:u-vikram' },
];

type DemoConnState = 'idle' | 'capture' | 'saving' | 'success';

export default function HomeScreen() {
  if (isBeta) return <BetaHomeScreen />;

  const { colors } = useTheme();
  const { activeExhibitionId, activeExhibitionName, isDemoMode, addDemoConnection, demoAddedConnections, demoSavedBrands, demoSavedReset, showProfileNudge, dismissProfileNudge, user } = useAuth();
  const unreadNotifCount = demoAddedConnections.length + demoSavedBrands.length;
  const [demoConnTarget, setDemoConnTarget] = useState<typeof DEMO_CONNECTIONS[0] | null>(null);
  const [demoConnState, setDemoConnState] = useState<DemoConnState>('idle');
  const [exhibitions, setExhibitions] = useState<ApiExhibition[]>([]);
  const [activeExh, setActiveExh] = useState<ApiExhibition | null>(null);
  const [newBrands, setNewBrands] = useState<NewBrand[]>([]);
  const [, forceUpdate] = useState(0);
  const s = makeStyles(colors);

  // Re-render when Unsplash cache fills so brand cards swap to real photos
  useEffect(() => subscribeToCache(() => forceUpdate(n => n + 1)), []);

  useEffect(() => {
    getExhibitions(isDemoMode, user?.id)
      .then(setExhibitions)
      .catch(console.error);
    getNewBrands().then((brands) => {
      if (brands.length > 0) setNewBrands(brands);
    }).catch(console.warn);
  }, [isDemoMode, user?.id]);

  // Retry once the user session fully loads (SecureStore has a brief delay on first open)
  useEffect(() => {
    if (!user?.id) return;
    getNewBrands().then((brands) => {
      if (brands.length > 0) setNewBrands(brands);
    }).catch(console.warn);
  }, [user?.id]);

  // Fetch the active exhibition separately to get the brands list
  useEffect(() => {
    if (!activeExhibitionId) { setActiveExh(null); return; }
    getExhibition(activeExhibitionId, isDemoMode, user?.id)
      .then(setActiveExh)
      .catch(console.error);
  }, [activeExhibitionId, isDemoMode, user?.id]);

  // Use API data if available, fall back to local data (ensures section is never empty)
  const upcomingSource = exhibitions.length > 0 ? exhibitions : ALL_EXHIBITIONS;
  const UPCOMING_EXHIBITIONS = upcomingSource.filter((e) => e.status === 'upcoming');

  const startDemoConn = (person: typeof DEMO_CONNECTIONS[0]) => {
    setDemoConnTarget(person);
    setDemoConnState('capture');
  };

  const handleDemoCapture = () => {
    setDemoConnState('saving');
    setTimeout(() => {
      setDemoConnState('success');
      if (demoConnTarget) addDemoConnection(demoConnTarget);
    }, 1800);
  };

  const closeDemoConn = () => {
    setDemoConnTarget(null);
    setDemoConnState('idle');
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.push('/preview')}>
          <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        </Pressable>
        <View style={s.headerRight}>
          <Pressable style={s.iconBtn} onPress={() => router.push('/map')}>
            <Ionicons name="map-outline" size={22} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={s.iconBtn} onPress={() => router.push('/wishlist')}>
            <Ionicons name="heart-outline" size={22} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={s.iconBtn} onPress={() => router.push('/notifications')}>
            <View>
              <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
              {unreadNotifCount > 0 && (
                <View style={[s.notifBadge, { backgroundColor: colors.accent }]}>
                  <Text style={s.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {activeExhibitionId ? (
          <>
            {/* 1. Active Exhibition card */}
            <View style={s.section}>
              <View style={[s.activeCard, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
                <View style={[s.liveBadge, { backgroundColor: colors.accent + '22' }]}>
                  <View style={[s.liveDot, { backgroundColor: colors.accent }]} />
                  <Text style={[s.liveText, { color: colors.accent }]}>LIVE NOW</Text>
                </View>
                <Text style={[s.activeExhName, { color: colors.text }]}>{activeExhibitionName}</Text>
                {activeExh && (
                  <Text style={[s.activeExhVenue, { color: colors.textSecondary }]}>
                    {activeExh.venue_name} · {activeExh.timings}
                  </Text>
                )}
                <Text style={[s.activeExhCopy, { color: colors.textMuted }]}>
                  You are checked in. Scan booths to save brands, exchange visiting cards, and revisit everything after the show.
                </Text>
                <View style={s.activeCtaRow}>
                  <Pressable
                    style={[s.primaryCta, { backgroundColor: colors.accent }]}
                    onPress={() => router.push('/(app)/scan')}
                  >
                    <Ionicons name="scan" size={16} color="#FFF" />
                    <Text style={s.primaryCtaText}>Open Scanner</Text>
                  </Pressable>
                  <Pressable
                    style={[s.secondaryCta, { borderColor: colors.border }]}
                    onPress={() => router.push(`/exhibition/${activeExhibitionId}?tab=explore`)}
                  >
                    <Text style={[s.secondaryCtaText, { color: colors.text }]}>Explore Floor</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* 2. Exhibition Ticket — opens ticket tab */}
            <View style={s.section}>
              <Pressable
                style={[s.ticketRow, { backgroundColor: colors.surface, borderColor: colors.gold }]}
                onPress={() => router.push(`/exhibition/${activeExhibitionId}?tab=ticket`)}
              >
                <Ionicons name="ticket-outline" size={20} color={colors.gold} />
                <View style={s.ticketRowInfo}>
                  <Text style={[s.ticketRowTitle, { color: colors.text }]}>Your Exhibition Ticket</Text>
                  <Text style={[s.ticketRowSub, { color: colors.textMuted }]}>Show QR code at venue entrance · Tap to view</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* 3. Floor Map Preview */}
            {activeExh?.layout_map_url && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: colors.text }]}>Floor Map</Text>
                  <Pressable onPress={() => router.push(`/exhibition/${activeExhibitionId}?tab=explore`)}>
                    <Text style={[s.viewAll, { color: colors.gold }]}>Full View</Text>
                  </Pressable>
                </View>
                <Text style={[s.sectionBlurb, { color: colors.textMuted }]}>
                  Navigate the venue and find booth locations before you walk in.
                </Text>
                <Pressable onPress={() => router.push(`/exhibition/${activeExhibitionId}?tab=explore`)}>
                  <Image source={{ uri: activeExh.layout_map_url }} style={s.mapPreview} resizeMode="cover" />
                  <View style={[s.mapPreviewOverlay]}>
                    <Ionicons name="expand-outline" size={16} color="#FFF" />
                    <Text style={s.mapPreviewOverlayText}>Tap to explore full map</Text>
                  </View>
                </Pressable>
              </View>
            )}

            {/* 4. Explore Exhibition Brands */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Brands at this Show</Text>
                <Pressable onPress={() => router.push(`/exhibition/${activeExhibitionId}?tab=brands`)}>
                  <Text style={[s.viewAll, { color: colors.gold }]}>See All</Text>
                </Pressable>
              </View>
              <Text style={[s.sectionBlurb, { color: colors.textMuted }]}>
                Tap a brand to view their products and contact details before visiting their booth.
              </Text>
              {activeExh && (() => {
                const preview = activeExh.brands.slice(0, 4);
                const pairs: any[][] = [];
                for (let i = 0; i < preview.length; i += 2) pairs.push(preview.slice(i, i + 2));
                return pairs.map((pair, pi) => (
                  <View key={pi} style={s.brandGridRow}>
                    {pair.map((b) => {
                      return (
                        <Pressable key={b.id} style={[s.brandGridCard, { backgroundColor: colors.surface }]} onPress={() => router.push(`/brand/${b.id}`)}>
                          <Image
                            source={{ uri: getCachedCover(b.category, b.id) }}
                            style={s.brandGridImg}
                            resizeMode="cover"
                          />
                          <View style={s.brandGridBody}>
                            <Text style={[s.brandGridName, { color: colors.text }]} numberOfLines={1}>{b.name}</Text>
                            <Text style={[s.brandGridCat, { color: colors.textMuted }]} numberOfLines={1}>{b.category}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                    {pair.length === 1 && <View style={s.brandGridCard} />}
                  </View>
                ));
              })()}
            </View>

            {/* 5. Recently Saved */}
            <RecentlySavedSection colors={colors} s={s} demoSavedBrands={demoSavedBrands} demoSavedReset={demoSavedReset} />

            {/* 6. New on Designup */}
            <NewOnDesignupSection colors={colors} s={s} liveBrands={newBrands} />

            {/* 7. Upcoming Exhibitions — informational only */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Upcoming Exhibitions</Text>
                <Pressable onPress={() => router.push('/exhibition')}>
                  <Text style={[s.viewAll, { color: colors.gold }]}>View All</Text>
                </Pressable>
              </View>
              <Text style={[s.sectionBlurb, { color: colors.textMuted }]}>Industry shows and events coming up soon.</Text>
              {UPCOMING_EXHIBITIONS.slice(0, 3).map((exh) => (
                <UpcomingExhCard key={exh.id} exhibition={exh} colors={colors} s={s} />
              ))}
            </View>

            {/* 7. Demo Connections Trigger — demo mode only */}
            {isDemoMode && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: colors.text }]}>Demo Connections</Text>
                  <View style={[s.demoBadge, { backgroundColor: colors.accent + '22' }]}>
                    <Text style={[s.demoBadgeText, { color: colors.accent }]}>DEMO</Text>
                  </View>
                </View>
                <Text style={[s.sectionBlurb, { color: colors.textMuted }]}>
                  Simulate exchanging visiting cards with people at the show. Tap a person, then capture to connect.
                </Text>
                {DEMO_CONNECTIONS.map((person) => (
                  <Pressable
                    key={person.id}
                    style={[s.demoConnCard, { backgroundColor: colors.surface }]}
                    onPress={() => startDemoConn(person)}
                  >
                    <View style={[s.demoConnAvatar, { backgroundColor: colors.accent + '22' }]}>
                      <Text style={[s.demoConnAvatarText, { color: colors.accent }]}>
                        {person.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </Text>
                    </View>
                    <View style={s.demoConnInfo}>
                      <Text style={[s.demoConnName, { color: colors.text }]}>{person.full_name}</Text>
                      <Text style={[s.demoConnMeta, { color: colors.textMuted }]}>{person.designation} · {person.company}</Text>
                    </View>
                    <View style={[s.demoConnCta, { backgroundColor: colors.accent }]}>
                      <Ionicons name="scan" size={14} color="#FFF" />
                      <Text style={s.demoConnCtaText}>Connect</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {/* 1. Recently Saved */}
            <RecentlySavedSection colors={colors} s={s} demoSavedBrands={demoSavedBrands} demoSavedReset={demoSavedReset} />

            {/* 2. New on Designup */}
            <NewOnDesignupSection colors={colors} s={s} liveBrands={newBrands} />

            {/* 3. Upcoming Exhibitions — informational only */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Upcoming Exhibitions</Text>
                <Pressable onPress={() => router.push('/exhibition')}>
                  <Text style={[s.viewAll, { color: colors.gold }]}>View All</Text>
                </Pressable>
              </View>
              <Text style={[s.sectionBlurb, { color: colors.textMuted }]}>Industry shows and events coming up soon.</Text>
              {UPCOMING_EXHIBITIONS.slice(0, 3).map((exh) => (
                <UpcomingExhCard key={exh.id} exhibition={exh} colors={colors} s={s} />
              ))}
            </View>
          </>
        )}

      </ScrollView>

      {/* Demo Connection Scanner Modal */}
      <Modal visible={!!demoConnTarget} animationType="slide" transparent>
        <View style={s.demoConnOverlay}>
          <View style={[s.demoConnModal, { backgroundColor: colors.background }]}>
            {/* Close */}
            <Pressable style={s.demoConnClose} onPress={closeDemoConn}>
              <Ionicons name="close" size={24} color="#FFF" />
            </Pressable>

            {demoConnState === 'capture' && (
              <>
                {/* Simulated camera */}
                <View style={[s.demoCamera, { backgroundColor: '#0A0A0A' }]}>
                  <View style={[s.scanFrame, { borderColor: colors.accent }]}>
                    <View style={[s.corner, s.cornerTL, { borderColor: colors.accent }]} />
                    <View style={[s.corner, s.cornerTR, { borderColor: colors.accent }]} />
                    <View style={[s.corner, s.cornerBL, { borderColor: colors.accent }]} />
                    <View style={[s.corner, s.cornerBR, { borderColor: colors.accent }]} />
                    {/* QR placeholder inside frame */}
                    <View style={[s.demoQrPlaceholder, { borderColor: colors.accent + '44' }]}>
                      <Ionicons name="qr-code-outline" size={48} color={colors.accent + '88'} />
                    </View>
                  </View>
                  <Text style={s.scanHint}>
                    Scanning {demoConnTarget?.full_name}'s QR
                  </Text>
                </View>
                <View style={[s.demoConnCaptureArea, { backgroundColor: colors.background }]}>
                  <Text style={[s.demoConnCaptureName, { color: colors.text }]}>{demoConnTarget?.full_name}</Text>
                  <Text style={[s.demoConnCaptureMeta, { color: colors.textMuted }]}>{demoConnTarget?.designation} · {demoConnTarget?.company}</Text>
                  <Pressable style={[s.captureBtn, { backgroundColor: colors.accent }]} onPress={handleDemoCapture}>
                    <Ionicons name="scan" size={20} color="#FFF" />
                    <Text style={s.captureBtnText}>Tap to Capture</Text>
                  </Pressable>
                </View>
              </>
            )}

            {demoConnState === 'saving' && (
              <View style={[s.demoConnResult, { backgroundColor: colors.background }]}>
                <View style={[s.savingIcon, { backgroundColor: colors.accent + '22' }]}>
                  <Ionicons name="sync-outline" size={36} color={colors.accent} />
                </View>
                <Text style={[s.demoConnResultTitle, { color: colors.text }]}>Saving...</Text>
                <Text style={[s.demoConnResultSub, { color: colors.textMuted }]}>
                  Saving {demoConnTarget?.full_name}'s contact
                </Text>
              </View>
            )}

            {demoConnState === 'success' && (
              <View style={[s.demoConnResult, { backgroundColor: colors.background }]}>
                <Ionicons name="person-add" size={52} color={colors.accent} />
                <Text style={[s.demoConnResultTitle, { color: colors.text }]}>
                  {demoConnTarget?.full_name} saved in your connections
                </Text>
                <Text style={[s.demoConnResultSub, { color: colors.textMuted }]}>
                  {demoConnTarget?.designation} · {demoConnTarget?.company}
                </Text>
                <Pressable
                  style={[s.captureBtn, { backgroundColor: colors.accent, marginTop: Spacing.xl }]}
                  onPress={() => { closeDemoConn(); router.push('/(app)/connections'); }}
                >
                  <Text style={s.captureBtnText}>View Connections</Text>
                </Pressable>
                <Pressable style={{ marginTop: Spacing.md }} onPress={closeDemoConn}>
                  <Text style={[{ color: colors.textMuted, fontSize: FontSize.sm }]}>Close</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Recently Saved — horizontal scroll ────────────────────────────────────────
const MOCK_RECENT_SAVES: any[] = [
  {
    id: 's1', brand_id: 'b01', brand_name: 'Lumina Lighting', brand_category: 'Lighting',
    brand_tagline: 'Light that tells stories',
    product_image_url: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=400',
    exhibition_id: 'exh-001', exhibition_name: 'Index Mumbai 2025',
    saved_at: new Date().toISOString(),
  },
  {
    id: 's2', brand_id: 'b02', brand_name: 'ClayCraft Ceramics', brand_category: 'Decor',
    brand_tagline: 'Earth shaped into art',
    product_image_url: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400',
    exhibition_id: 'exh-001', exhibition_name: 'Index Mumbai 2025',
    saved_at: new Date().toISOString(),
  },
  {
    id: 's3', brand_id: 'b03', brand_name: 'Studio Forma', brand_category: 'Furniture',
    brand_tagline: 'Form follows feeling',
    product_image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400',
    exhibition_id: 'exh-001', exhibition_name: 'Index Mumbai 2025',
    saved_at: new Date().toISOString(),
  },
];

function RecentlySavedSection({ colors, s, demoSavedBrands, demoSavedReset }: { colors: any; s: any; demoSavedBrands: any[]; demoSavedReset: boolean }) {
  const recentSaves = demoSavedReset
    ? []
    : [...demoSavedBrands, ...MOCK_RECENT_SAVES].slice(0, 4);

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Recently Saved</Text>
        <Pressable onPress={() => router.push('/(app)/saved')}>
          <Text style={[s.viewAll, { color: colors.gold }]}>View All</Text>
        </Pressable>
      </View>
      <Text style={[s.sectionBlurb, { color: colors.textMuted }]}>
        Brands you've saved while exploring.
      </Text>
      {recentSaves.length === 0 ? (
        <View style={[s.recentSaveEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="scan-outline" size={20} color={colors.textMuted} />
          <Text style={[s.recentSaveEmptyText, { color: colors.textMuted }]}>
            Scan a booth QR to save your first brand
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentSaveScroll}>
          {recentSaves.map((brand: any) => (
            <Pressable
              key={brand.id}
              style={[s.recentSaveCard, { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/brand/${brand.brand_id}`)}
            >
              <Image
                source={{ uri: brand.product_image_url || getCachedCover(brand.brand_category, brand.brand_id) }}
                style={s.recentSaveImg}
                resizeMode="cover"
              />
              <View style={s.recentSaveBody}>
                <Text style={[s.recentSaveName, { color: colors.text }]} numberOfLines={1}>{brand.brand_name}</Text>
                <Text style={[s.recentSaveCat, { color: colors.textMuted }]} numberOfLines={1}>{brand.brand_category}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── New on Designup ────────────────────────────────────────────────────────────
const NEW_ON_DESIGNUP = [
  { id: 'b11', name: 'Bloom Art Studio', category: 'Art & Décor', logo: 'BA', image_url: 'https://images.unsplash.com/photo-1579783901586-a03c72ab261d?w=200' },
  { id: 'b07', name: 'Verdant Living', category: 'Sustainable Furniture', logo: 'VL', image_url: 'https://images.unsplash.com/photo-1416879595882-61ca26db9bcc?w=200' },
  { id: 'b13', name: 'Prism Surfaces', category: 'Materials', logo: 'PS', image_url: 'https://images.unsplash.com/photo-1583845112203-29329902332e?w=200' },
  { id: 'b10', name: 'Nexus Studio', category: 'Furniture', logo: 'NS', image_url: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=200' },
];

function NewOnDesignupSection({ colors, s, liveBrands }: { colors: any; s: any; liveBrands: NewBrand[] }) {
  const source = liveBrands.length > 0 ? liveBrands : NEW_ON_DESIGNUP;
  const preview = source.slice(0, 4);
  const pairs: typeof source[] = [];
  for (let i = 0; i < preview.length; i += 2) pairs.push(preview.slice(i, i + 2));
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>New on Designup</Text>
        <Pressable onPress={() => router.push('/brands')}>
          <Text style={[s.viewAll, { color: colors.gold }]}>View All</Text>
        </Pressable>
      </View>
      <Text style={[s.sectionBlurb, { color: colors.textMuted }]}>
        Brands recently joined the platform.
      </Text>
      {pairs.map((pair, pi) => (
        <View key={pi} style={s.brandGridRow}>
          {pair.map((brand, bi) => (
            <Pressable
              key={brand.id}
              style={[s.brandGridCard, { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/brand/${brand.id}`)}
            >
              <Image
                source={{ uri: brand.image_url ?? getCachedCover(brand.category, brand.id) }}
                style={s.brandGridImg}
                resizeMode="cover"
              />
              <View style={s.brandGridBody}>
                <Text style={[s.brandGridName, { color: colors.text }]} numberOfLines={1}>{brand.name}</Text>
                <Text style={[s.brandGridCat, { color: colors.textMuted }]} numberOfLines={1}>{brand.category}</Text>
              </View>
            </Pressable>
          ))}
          {pair.length === 1 && <View style={s.brandGridCard} />}
        </View>
      ))}
    </View>
  );
}

// ── Upcoming Exhibition Card (informational, no registration CTA) ──────────────
function UpcomingExhCard({ exhibition, colors, s }: { exhibition: any; colors: any; s: any }) {
  const coverUrl = getExhibitionImage(exhibition);
  return (
    <View style={[s.upcomingExhCard, { backgroundColor: colors.surface }]}>
      <Image source={{ uri: coverUrl }} style={s.upcomingExhCover} resizeMode="cover" />
      <View style={s.upcomingExhBody}>
        <View style={s.upcomingExhTop}>
          <Text style={[s.upcomingExhName, { color: colors.text }]}>{exhibition.name}</Text>
        </View>
        <Text style={[s.upcomingExhVenue, { color: colors.textSecondary }]}>
          {exhibition.venue_name} · {exhibition.city}
        </Text>
        <Text style={[s.upcomingExhDate, { color: colors.textMuted }]}>
          {fmt(exhibition.start_date)} – {fmt(exhibition.end_date)}
        </Text>
        {(exhibition.stats?.brands || exhibition.brand_count) && (
          <Text style={[s.upcomingExhBrands, { color: colors.textMuted }]}>
            ~{exhibition.stats?.brands ?? exhibition.brand_count} brands
          </Text>
        )}
        <View style={s.upcomingExhActions}>
          <Pressable
            style={s.upcomingExhDetailsBtn}
            onPress={() => router.push(`/exhibition/${exhibition.id}`)}
          >
            <Text style={[s.upcomingExhDetailsBtnText, { color: colors.accent }]}>View Show Details →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ExhibitionCard({ exhibition, colors }: { exhibition: any; colors: any }) {
  const s = makeStyles(colors);
  const isRegistered = !!exhibition.user_registration_status;
  return (
    <View style={[s.exhCard, { backgroundColor: colors.surface }]}>
      <View style={s.exhCardTop}>
        <Text style={[s.exhName, { color: colors.text }]}>{exhibition.name}</Text>
        {isRegistered && (
          <View style={[s.regBadge, { backgroundColor: colors.accent + '22' }]}>
            <Text style={[s.regBadgeText, { color: colors.accent }]}>Registered</Text>
          </View>
        )}
      </View>
      <Text style={[s.exhVenue, { color: colors.textSecondary }]}>{exhibition.venue_name} · {exhibition.city}</Text>
      <Text style={[s.exhDate, { color: colors.textSecondary }]}>
        {fmt(exhibition.start_date)} – {fmt(exhibition.end_date)}
      </Text>
      <View style={s.exhActions}>
        <Pressable onPress={() => router.push(`/exhibition/${exhibition.id}`)}>
          <Text style={[s.viewDetails, { color: colors.accent }]}>View Details →</Text>
        </Pressable>
        <Pressable
          style={[s.registerBtn, {
            backgroundColor: isRegistered ? 'transparent' : colors.accent,
            borderColor: isRegistered ? colors.gold : 'transparent',
            borderWidth: isRegistered ? 1 : 0,
          }]}
          onPress={() => router.push(`/exhibition/${exhibition.id}${isRegistered ? '?tab=ticket' : ''}`)}
        >
          <Text style={[s.registerBtnText, { color: isRegistered ? colors.gold : '#FFF' }]}>
            {isRegistered ? 'View Ticket' : 'Register Now'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function RecentSaveCard({ brand, colors }: { brand: SavedBrand; colors: any }) {
  const s = makeStyles(colors);
  return (
    <View style={[s.saveCard, { backgroundColor: colors.surface }]}>
      <Image
        source={{ uri: brand.product_image_url || getCachedCover(brand.brand_category, brand.brand_id) }}
        style={s.saveImg}
        resizeMode="cover"
      />
      <View style={s.saveBody}>
        <View style={s.saveCardHeader}>
          <Text style={[s.saveName, { color: colors.text }]}>{brand.brand_name}</Text>
          <Text style={[s.saveCat, { color: colors.textSecondary }]}>{brand.brand_category}</Text>
        </View>
        {brand.brand_tagline && (
          <Text style={[s.saveTagline, { color: colors.textSecondary }]} numberOfLines={2}>
            {brand.brand_tagline}
          </Text>
        )}
        <Pressable onPress={() => router.push(`/brand/${brand.brand_id}`)}>
          <Text style={[s.saveCta, { color: colors.gold }]}>View Brand Details</Text>
        </Pressable>
      </View>
    </View>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    nudgeBanner: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderWidth: 1, borderRadius: Radius.md,
      marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    nudgeBannerText: { flex: 1, fontSize: FontSize.xs, lineHeight: 16 },
    nudgeBannerCta: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    nudgeClose: { padding: 2 },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'web' ? 14 : 56, paddingBottom: Spacing.md,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    headerRight: { flexDirection: 'row', gap: Spacing.md },
    iconBtn: { padding: 4 },
    notifBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
    notifBadgeText: { color: '#FFF', fontSize: 9, fontWeight: FontWeight.bold },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 16 },
    profileNudgeStrip: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderWidth: 1, borderRadius: Radius.md,
      marginHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: 100,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    },
    profileNudgeText: { flex: 1, fontSize: FontSize.xs, lineHeight: 16 },
    section: { marginBottom: Spacing.xl },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    sectionBlurb: { fontSize: FontSize.xs, lineHeight: 17, marginBottom: Spacing.md },
    viewAll: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

    demoPrompt: {
      flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
      borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1,
    },
    demoPromptText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },

    // Active exhibition
    activeCard: { borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, gap: Spacing.sm },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, alignSelf: 'flex-start' },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    liveText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },
    activeExhName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
    activeExhVenue: { fontSize: FontSize.sm },
    activeExhCopy: { fontSize: FontSize.sm, lineHeight: 20 },
    activeCtaRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    primaryCta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
    primaryCtaText: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    secondaryCta: { paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
    secondaryCtaText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

    // Ticket row
    ticketRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1,
    },
    ticketRowInfo: { flex: 1 },
    ticketRowTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    ticketRowSub: { fontSize: FontSize.xs, marginTop: 2 },

    // Floor map preview
    mapPreview: { width: '100%', height: 160, borderRadius: Radius.lg },
    mapPreviewOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg,
      backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row',
      alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10,
    },
    mapPreviewOverlayText: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.medium },


    // Exhibition card
    exhCard: { borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
    exhCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    exhName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flex: 1, marginRight: Spacing.sm },
    regBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    regBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    exhVenue: { fontSize: FontSize.sm, marginBottom: 2 },
    exhDate: { fontSize: FontSize.sm, marginBottom: Spacing.md },
    exhActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    viewDetails: { fontSize: FontSize.sm },
    registerBtn: { paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
    registerBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

    // Recently saved horizontal scroll
    recentSaveScroll: { gap: Spacing.sm, paddingRight: Spacing.lg },
    recentSaveCard: { width: 140, borderRadius: Radius.lg, overflow: 'hidden' },
    recentSaveImg: { width: 140, height: 110, resizeMode: 'cover' },
    recentSaveBody: { padding: Spacing.sm, gap: 2 },
    recentSaveName: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    recentSaveCat: { fontSize: 10 },
    recentSaveEmpty: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderStyle: 'dashed',
    },
    recentSaveEmptyText: { fontSize: FontSize.sm, flex: 1 },

    // Brand grid — shared by "New on Designup" + "Brands at this Show"
    brandGridRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
    brandGridCard: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden' },
    brandGridImg: { width: '100%', height: 160 },
    brandGridImgPlaceholder: { width: '100%', height: 160, alignItems: 'center', justifyContent: 'center' },
    brandGridInitial: { fontSize: 32, fontWeight: FontWeight.bold },
    brandGridBody: { padding: Spacing.sm, gap: 2 },
    brandGridName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    brandGridCat: { fontSize: FontSize.xs },

    // Upcoming exhibition card (informational)
    upcomingExhCard: { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.md },
    upcomingExhCover: { width: '100%', height: 140 },
    upcomingExhBody: { padding: Spacing.lg, gap: 4 },
    upcomingExhTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    upcomingExhName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flex: 1 },
    upcomingExhVenue: { fontSize: FontSize.sm },
    upcomingExhDate: { fontSize: FontSize.sm },
    upcomingExhBrands: { fontSize: FontSize.xs, marginTop: 4 },
    upcomingExhActions: { flexDirection: 'row', marginTop: Spacing.sm },
    upcomingExhDetailsBtn: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 4,
    },
    upcomingExhDetailsBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },

    emptyState: { borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center' },
    emptyIcon: { fontSize: 32, marginBottom: Spacing.sm },
    emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Spacing.sm },
    emptyBody: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },

    // Demo badge
    demoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    demoBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },

    // Demo connection cards
    demoConnCard: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    demoConnAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    demoConnAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    demoConnInfo: { flex: 1 },
    demoConnName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    demoConnMeta: { fontSize: FontSize.xs, marginTop: 2 },
    demoConnCta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md },
    demoConnCtaText: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

    // Demo connection modal
    demoConnOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center' },
    demoConnModal: { flex: 1, width: '100%', maxWidth: 390 },
    demoConnClose: { position: 'absolute', top: 52, right: Spacing.lg, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 6 },

    // Simulated camera
    demoCamera: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 360 },
    scanFrame: { width: 200, height: 200, position: 'relative', alignItems: 'center', justifyContent: 'center' },
    corner: { position: 'absolute', width: 24, height: 24, borderWidth: 3 },
    cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
    cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
    cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
    cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
    demoQrPlaceholder: { width: 130, height: 130, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    scanHint: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.sm, marginTop: Spacing.xl, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, overflow: 'hidden' },

    // Capture area
    demoConnCaptureArea: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
    demoConnCaptureName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    demoConnCaptureMeta: { fontSize: FontSize.sm },
    captureBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 14, paddingHorizontal: Spacing.xl, borderRadius: Radius.md, marginTop: Spacing.md },
    captureBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    // Result states
    demoConnResult: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
    savingIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
    demoConnResultTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center' },
    demoConnResultSub: { fontSize: FontSize.md, textAlign: 'center' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Beta Home Screen
// ─────────────────────────────────────────────────────────────────────────────

const POPUP_SHOWN_KEY = 'onboarding_popup_shown';

function BetaHomeScreen() {
  const { colors } = useTheme();
  const { top: topInset } = useSafeAreaInsets();
  const { user, cardContacts, demoAddedConnections, updateUser, signOut, clearCardContacts, resetDemoConnections } = useAuth();

  const [qrExpanded, setQrExpanded] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [importing, setImporting] = useState(false);

  // Popup fields
  const [popupLinkedin, setPopupLinkedin] = useState('');
  const [popupInstagram, setPopupInstagram] = useState('');
  const [popupEmail, setPopupEmail] = useState(user?.email ?? '');
  const [popupWebsite, setPopupWebsite] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(POPUP_SHOWN_KEY).then((val) => {
      if (!val) setShowPopup(true);
    });
  }, []);

  const dismissPopup = async (save: boolean) => {
    if (save) {
      const updates: Record<string, string> = {};
      if (popupLinkedin.trim()) updates.linkedin = popupLinkedin.trim();
      if (popupInstagram.trim()) updates.instagram = popupInstagram.trim();
      if (popupEmail.trim()) updates.email = popupEmail.trim();
      if (popupWebsite.trim()) updates.website = popupWebsite.trim();
      if (Object.keys(updates).length) updateUser(updates as any);
    }
    await AsyncStorage.setItem(POPUP_SHOWN_KEY, '1');
    setShowPopup(false);
  };

  // Merge card contacts + demo QR connections, most recent first, max 5
  const recentContacts = useMemo(() => {
    const cards = cardContacts.map((c) => ({
      id: c.id,
      name: getCardDisplayName(c.fields),
      sub: [
        c.fields.find((f) => f.label === 'Designation')?.value,
        c.fields.find((f) => f.label === 'Company')?.value,
      ].filter(Boolean).join(' · '),
      source: 'card' as const,
      ts: new Date(c.scanned_at).getTime(),
    }));
    const qrs = (demoAddedConnections as any[]).map((c) => {
      const isConnection = c.user && typeof c.user === 'object';
      return {
        id: String(c.id),
        name: (isConnection ? c.user.full_name : c.full_name) as string,
        sub: [
          isConnection ? c.user.designation : c.designation,
          isConnection ? c.user.company_name : (c.company_name ?? c.company),
        ].filter(Boolean).join(' · '),
        source: 'qr' as const,
        ts: Date.now(),
      };
    });
    return [...cards, ...qrs].sort((a, b) => b.ts - a.ts).slice(0, 5);
  }, [cardContacts, demoAddedConnections]);

  const hasContacts = recentContacts.length > 0;

  const handleGalleryImport = async () => {
    if (Platform.OS === 'web') {
      const g = globalThis as any;
      if (!g.document) return;
      const input = g.document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
      g.document.body.appendChild(input);
      input.addEventListener('change', async (ev: any) => {
        const file = ev.target?.files?.[0];
        try { g.document.body.removeChild(input); } catch (_) {}
        if (!file) return;
        setImporting(true);
        try {
          // URL.createObjectURL lets iOS Safari decode HEIC gallery photos natively
          const base64: string = await new Promise((res, rej) => {
            const objectUrl = g.URL.createObjectURL(file);
            const img = new g.Image();
            img.onload = () => {
              g.URL.revokeObjectURL(objectUrl);
              const scale = Math.min(1, 1200 / Math.max(img.width, img.height, 1));
              const canvas = g.document.createElement('canvas');
              canvas.width = Math.round(img.width * scale);
              canvas.height = Math.round(img.height * scale);
              const ctx = canvas.getContext('2d');
              if (!ctx) { rej(new Error('no canvas')); return; }
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              canvas.toBlob((blob: any) => {
                if (!blob) { rej(new Error('toBlob')); return; }
                const r = new g.FileReader();
                r.onload = (e: any) => { const b = (e.target?.result as string ?? '').split(',')[1]; b ? res(b) : rej(new Error('read')); };
                r.onerror = rej;
                r.readAsDataURL(blob);
              }, 'image/jpeg', 0.85);
            };
            img.onerror = () => { g.URL.revokeObjectURL(objectUrl); rej(new Error('img load')); };
            img.src = objectUrl;
          });
          const imageDataUrl = `data:image/jpeg;base64,${base64}`;
          let blocks: any[] = [];
          try { blocks = await recognizeCardTextWeb(base64); } catch (_) {}
          const fields = parseCardFields(blocks);
          cardScanStore.set({ imageUri: imageDataUrl, backImageUri: null, fields, isBlurry: blocks.length < 2 });
          setImporting(false);
          router.push('/card-review');
        } catch { setImporting(false); }
      });
      input.click();
      return;
    }
    // Native: ImagePicker + ML Kit
    setImporting(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.[0]) { setImporting(false); return; }
      const imageUri = result.assets[0].uri;
      const blocks = await recognizeCardText(imageUri);
      const fields = parseCardFields(blocks);
      cardScanStore.set({ imageUri, backImageUri: null, fields, isBlurry: blocks.length < 2 });
      setImporting(false);
      router.push('/card-review');
    } catch {
      setImporting(false);
    }
  };

  const initials = user?.first_name
    ? `${user.first_name[0]}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : 'U';

  const b = betaStyles(colors);

  return (
    <View style={[b.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[b.header, { paddingTop: topInset + 12 }]}>
        <Text style={[b.headerTitle, { color: colors.text }]}>Home</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[b.scroll, { flexGrow: 1 }]}>

        {/* QR card — profile-style centered layout */}
        <View style={b.qrSectionLabel}>
          <Text style={[b.qrSectionLabelText, { color: colors.textSecondary }]}>YOUR QR CODE</Text>
        </View>
        <Pressable
          style={[b.qrCard, { backgroundColor: colors.surface }]}
          onPress={() => { Analytics.qrExpanded(); setQrExpanded(true); }}
        >
          <QRCode
            value={`https://connect-designup.vercel.app/u/${user?.id ?? ''}`}
            size={120}
            backgroundColor={colors.surface}
            color={colors.text}
          />
          <Text style={[b.qrHint, { color: colors.textMuted }]}>Tap to expand</Text>
        </Pressable>

        {/* Contacts */}
        {hasContacts ? (
          <View style={b.section}>
            <View style={b.sectionHeader}>
              <Text style={[b.sectionTitle, { color: colors.text }]}>Recent Contacts</Text>
              <Pressable onPress={() => router.push('/(app)/connections')}>
                <Text style={[b.seeAll, { color: colors.accent }]}>See all →</Text>
              </Pressable>
            </View>
            {recentContacts.map((contact) => {
              const avatarLetters = contact.name
                .split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <Pressable
                  key={contact.id}
                  style={[b.contactRow, { backgroundColor: colors.surface }]}
                  onPress={() => router.push('/(app)/connections')}
                >
                  <View style={[b.contactAvatar, { backgroundColor: colors.accent + '18' }]}>
                    <Text style={[b.contactAvatarText, { color: colors.accent }]}>{avatarLetters}</Text>
                  </View>
                  <View style={b.contactInfo}>
                    <Text style={[b.contactName, { color: colors.text }]} numberOfLines={1}>{contact.name}</Text>
                    {!!contact.sub && (
                      <Text style={[b.contactSub, { color: colors.textMuted }]} numberOfLines={1}>{contact.sub}</Text>
                    )}
                  </View>
                  <View style={[b.sourceTag, {
                    backgroundColor: contact.source === 'card' ? colors.accent + '18' : colors.gold + '22',
                  }]}>
                    <Text style={[b.sourceTagText, {
                      color: contact.source === 'card' ? colors.accent : colors.gold,
                    }]}>
                      {contact.source === 'card' ? 'Card' : 'QR'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={b.emptyState}>
            <View style={[b.emptyIconWrap, { backgroundColor: colors.accent + '18' }]}>
              <Ionicons name="people-outline" size={32} color={colors.accent} />
            </View>
            <Text style={[b.emptyTitle, { color: colors.text }]}>No contacts yet</Text>
            <Text style={[b.emptySub, { color: colors.textMuted }]}>
              Scan a visiting card or someone's Connect QR to add your first contact
            </Text>
            <Pressable
              style={[b.primaryCta, { backgroundColor: colors.accent }]}
              onPress={() => router.push('/(app)/scan')}
            >
              <Ionicons name="camera-outline" size={18} color="#FFF" />
              <Text style={b.primaryCtaText}>Scan a card</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>


      {/* Post-onboarding popup — shown once */}
      <Modal visible={showPopup} animationType="slide" transparent>
        <View style={b.popupOverlay}>
          <View style={[b.popup, { backgroundColor: colors.surface }]}>
            <Text style={[b.popupTitle, { color: colors.text }]}>Make your card complete</Text>
            <Text style={[b.popupSub, { color: colors.textSecondary }]}>
              Add your socials so contacts can find and follow you.
            </Text>
            <View style={b.popupFields}>
              {[
                { icon: 'logo-linkedin' as const, placeholder: 'LinkedIn URL', value: popupLinkedin, onChange: setPopupLinkedin },
                { icon: 'logo-instagram' as const, placeholder: 'Instagram handle', value: popupInstagram, onChange: setPopupInstagram },
                { icon: 'mail-outline' as const, placeholder: 'Email address', value: popupEmail, onChange: setPopupEmail },
                { icon: 'globe-outline' as const, placeholder: 'Website URL', value: popupWebsite, onChange: setPopupWebsite },
              ].map(({ icon, placeholder, value, onChange }) => (
                <View key={placeholder} style={[b.popupField, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name={icon} size={16} color={colors.textMuted} />
                  <TextInput
                    style={[b.popupInput, { color: colors.text }]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={onChange}
                    autoCapitalize="none"
                    keyboardType={icon === 'mail-outline' ? 'email-address' : 'default'}
                  />
                </View>
              ))}
            </View>
            <Pressable
              style={[b.popupPrimary, { backgroundColor: colors.accent }]}
              onPress={() => dismissPopup(true)}
            >
              <Text style={b.popupPrimaryText}>Add details</Text>
            </Pressable>
            <Pressable style={b.popupSkip} onPress={() => dismissPopup(false)}>
              <Text style={[b.popupSkipText, { color: colors.textMuted }]}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>


      {/* Fullscreen QR modal — matches My Card page UI */}
      <Modal visible={qrExpanded} transparent animationType="fade" onRequestClose={() => setQrExpanded(false)}>
        <Pressable style={b.qrOverlay} onPress={() => setQrExpanded(false)}>
          <Text style={b.qrModalHint}>Let others save your details by scanning</Text>
          <View style={[b.qrModal, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <QRCode
              value={`https://connect-designup.vercel.app/u/${user?.id ?? ''}`}
              size={240}
              backgroundColor={colors.surface}
              color={colors.text}
            />
            <Text style={[b.qrModalName, { color: colors.text }]}>
              {user?.first_name} {user?.last_name}
            </Text>
            <Text style={[b.qrModalSub, { color: colors.textSecondary }]}>
              {[user?.designation ?? user?.profession, user?.company_name].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Pressable style={b.qrClose} onPress={() => setQrExpanded(false)}>
            <Ionicons name="close-circle" size={36} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function betaStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },

    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    iconBtn: { padding: 4 },

    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 24 },

    // QR section label
    qrSectionLabel: { marginBottom: Spacing.sm },
    qrSectionLabelText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 0.8 },

    // QR card — centered layout matching My Card page
    qrCard: {
      borderRadius: Radius.lg, padding: Spacing.xl,
      alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl,
    },
    qrHint: { fontSize: FontSize.xs },

    // Fullscreen QR modal — matching My Card page expand UI
    qrOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
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

    section: { marginBottom: Spacing.xl },
    sectionHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: Spacing.md,
    },
    sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    seeAll: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

    // Contact rows
    contactRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    contactAvatar: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    contactAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    contactInfo: { flex: 1 },
    contactName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    contactSub: { fontSize: FontSize.xs, marginTop: 2 },
    sourceTag: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
    },
    sourceTagText: { fontSize: 10, fontWeight: FontWeight.bold },

    // Scan row
    scanRow: {
      flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl,
    },
    scanAction: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 13, borderRadius: Radius.md,
    },
    scanActionPrimaryText: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    scanActionSecondaryText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

    // Empty state
    emptyState: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: Spacing.lg, paddingBottom: 60, gap: Spacing.md,
    },
    emptyIconWrap: {
      width: 64, height: 64, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
    emptySub: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
    primaryCta: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, paddingVertical: 14, paddingHorizontal: Spacing.xl,
      borderRadius: Radius.md, width: '100%',
    },
    primaryCtaText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    secondaryCta: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, paddingVertical: 13, paddingHorizontal: Spacing.xl,
      borderRadius: Radius.md, borderWidth: 1, width: '100%',
    },
    secondaryCtaText: { fontSize: FontSize.md, fontWeight: FontWeight.medium },


    // Post-onboarding popup
    popupOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    popup: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: 44,
      gap: Spacing.sm,
    },
    popupTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
    popupSub: { fontSize: FontSize.sm, lineHeight: 20, marginBottom: 4 },
    popupFields: { gap: Spacing.sm, marginVertical: Spacing.sm },
    popupField: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderWidth: 1, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, height: 44,
    },
    popupInput: { flex: 1, fontSize: FontSize.sm },
    popupPrimary: {
      paddingVertical: 15, borderRadius: Radius.md,
      alignItems: 'center', marginTop: Spacing.sm,
    },
    popupPrimaryText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    popupSkip: { alignItems: 'center', paddingVertical: 12 },
    popupSkipText: { fontSize: FontSize.sm },

    // How-to items in empty state
    howList: { gap: Spacing.md, width: '100%', marginVertical: Spacing.sm },
    howItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    howIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    howText: { flex: 1 },
    howLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 2 },
    howDesc: { fontSize: FontSize.xs, lineHeight: 18 },

    // Settings bottom sheet
    settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    settingsSheet: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 44,
    },
    settingsHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
    settingsTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.lg },
    settingsRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    settingsLabel: { flex: 1, fontSize: FontSize.md },
  });
}
