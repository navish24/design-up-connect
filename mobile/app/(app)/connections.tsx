import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ToastAndroid, Platform, Image, Modal, Linking,
  Animated, PanResponder,
} from 'react-native';
import { useState, useMemo, Fragment, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useHeaderPaddingTop } from '../../lib/safeArea';
import { isBeta } from '../../lib/betaConfig';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarStyle } from './_layout';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import NotesModal from '../../components/NotesModal';
import { Analytics } from '../../lib/analytics';
import { cloudinaryThumb } from '../../lib/cloudinary';
import type { Connection, CardContact } from '../../types';
import { getPendingConnectionOpen, setPendingConnectionOpen, getPendingCardOpen, setPendingCardOpen } from '../../lib/pendingNav';

export function getCardDisplayName(fields: { label: string; value: string }[]): string {
  const get = (label: string) => fields.find((f) => f.label === label)?.value ?? '';
  if (get('Name')) return get('Name');
  if (get('Company')) return get('Company');
  // Instagram: @ZIBA.HOMES → Ziba Homes
  const ig = get('Instagram').replace(/^@/, '');
  if (ig) return ig.replace(/\./g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  // Website: www.zibahomes.in → Zibahomes
  const web = get('Website').replace(/^www\./, '').split('.')[0];
  if (web) return web.charAt(0).toUpperCase() + web.slice(1).toLowerCase();
  // Email domain: connect@zibahomes.com → Zibahomes
  const domain = get('Email').split('@')[1]?.split('.')[0] ?? '';
  if (domain) return domain.charAt(0).toUpperCase() + domain.slice(1).toLowerCase();
  return 'Unknown';
}

function openExternal(url: string) {
  if (Platform.OS === 'web') {
    const isDeepLink = url.startsWith('tel:') || url.startsWith('mailto:') || url.startsWith('whatsapp:');
    if (isDeepLink) {
      // Use location.href for deep links — iOS intercepts the scheme and opens
      // the native app, then returns to the PWA. window.open leaves a blank tab.
      (globalThis as any).window.location.href = url;
    } else {
      (globalThis as any).window?.open(url, '_blank', 'noopener,noreferrer');
    }
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, '');
  Analytics.contactIconTapped('whatsapp');
  if (Platform.OS === 'web') {
    const isAndroid = /Android/i.test((globalThis as any).navigator?.userAgent ?? '');
    // iOS intercepts whatsapp:// and returns to the PWA. Android Chrome doesn't
    // handle that scheme — wa.me redirects to the app via the OS intent system.
    (globalThis as any).window.location.href = isAndroid
      ? `https://wa.me/${digits}`
      : `whatsapp://send?phone=${digits}`;
  } else {
    Linking.openURL(`https://wa.me/${digits}`).catch(() => {});
  }
}

function openLink(label: string, value: string) {
  Analytics.contactIconTapped(
    label === 'LinkedIn' ? 'linkedin'
    : label === 'Instagram' ? 'instagram'
    : 'website'
  );
  let url: string;
  if (label === 'Instagram') url = `https://instagram.com/${value.replace(/^@/, '')}`;
  else if (label === 'Facebook') url = value.includes('facebook.com') ? (value.startsWith('http') ? value : `https://${value}`) : `https://facebook.com/${value}`;
  else if (label === 'Twitter/X') url = (value.includes('twitter.com') || value.includes('x.com')) ? (value.startsWith('http') ? value : `https://${value}`) : `https://x.com/${value}`;
  else url = value.startsWith('http') ? value : `https://${value}`;
  openExternal(url);
}

async function copyToClipboard(value: string, label: string, onSuccess?: () => void) {
  try {
    await Clipboard.setStringAsync(value);
    onSuccess?.();
    if (Platform.OS === 'android') {
      ToastAndroid.show(`${label} copied`, ToastAndroid.SHORT);
    }
  } catch {
    if (Platform.OS !== 'web') {
      Alert.alert('Could not copy', 'Please copy the text manually.');
    }
  }
}

function CopyButton({ value, label, size = 16, style }: { value: string; label: string; size?: number; style?: any }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      onPress={() => copyToClipboard(value, label, () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })}
      hitSlop={8}
      style={style}
    >
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={size} color={copied ? '#4CAF50' : colors.textMuted} />
    </Pressable>
  );
}

// ── PLACEHOLDER DATA ──────────────────────────────────────────────────────────
const MOCK_CONNECTIONS: Connection[] = [
  {
    id: 'c1',
    user: {
      id: 'u1', full_name: 'Priya Sharma', designup_user_id: 'priya_sharma',
      designation: 'Principal Designer', company_name: 'Studio Forma', city: 'Mumbai',
      email: 'priya@studioforma.com', phone: '+919876543211',
      linkedin_url: 'linkedin.com/in/priya-sharma', website_url: 'studioforma.com',
      profile_image_url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200',
    },
    brand_name: 'Studio Forma',
    connection_type: 'networking', scope: 'personal',
    is_mutual: false, to_contact_shared: true, from_contact_shared: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'c2',
    user: {
      id: 'u2', full_name: 'Arjun Mehta', designup_user_id: 'arjun_lumina',
      designation: 'Sales Manager', company_name: 'Lumina Lighting', city: 'Mumbai',
      email: 'arjun@lumina.com', phone: '+919876543212',
    },
    brand_name: 'Lumina Lighting',
    brand_id: 'b01',
    connection_type: 'visitor_scanned_rep', scope: 'brand',
    is_mutual: true, to_contact_shared: true, from_contact_shared: true,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];
// ─────────────────────────────────────────────────────────────────────────────

type SortType = 'newest' | 'oldest' | 'az' | 'za';
const SORT_LABEL: Record<SortType, string> = { newest: 'New → Old', oldest: 'Old → New', az: 'A → Z', za: 'Z → A' };
const FILTER_LABEL: Record<string, string> = { all: 'Filter', cards: 'Physical card', connections: 'QR scanned', notes: 'Has notes' };
const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'cards', label: 'Physical card' },
  { value: 'connections', label: 'QR scanned' },
  { value: 'notes', label: 'Has notes' },
];
const SORT_OPTIONS = [
  { value: 'newest', label: 'New → Old' },
  { value: 'oldest', label: 'Old → New' },
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
];

type ActiveView =
  | { type: 'list' }
  | { type: 'connect_detail'; connection: Connection }
  | { type: 'card_detail'; contact: CardContact };

export default function ConnectionsScreen() {
  const { colors } = useTheme();
  const { demoConnectionsReset, demoAddedConnections, notes, addNote, cardContacts, deleteCardContact, updateCardContact, user, refreshConnections } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const headerPaddingTop = useHeaderPaddingTop();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'cards' | 'connections' | 'notes'>('all');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [showFilterDrop, setShowFilterDrop] = useState(false);
  const [showSortDrop, setShowSortDrop] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'list' });
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');
  const scrollRef = useRef<ScrollView>(null);
  const savedScrollY = useRef(0);
  const [mutualIds, setMutualIds] = useState<Set<string>>(new Set());
  // When set, we're waiting for allConnections to include this userId before opening detail.
  // State triggers a re-render so useEffect below always re-evaluates after useFocusEffect sets it,
  // even when allConnections was already populated (which would otherwise skip the watcher).
  const [pendingOpenUserId, setPendingOpenUserId] = useState<string | null>(null);
  // Ref mirrors state so useFocusEffect (empty deps, stable callback) can read current value.
  const pendingOpenUserIdRef = useRef<string | null>(null);
  pendingOpenUserIdRef.current = pendingOpenUserId;
  const exchangingRef = useRef<Set<string>>(new Set());
  const allConnectionsRef = useRef<Connection[]>([]);
  const cardContactsRef = useRef<CardContact[]>([]);
  cardContactsRef.current = cardContacts;
  const refreshConnectionsRef = useRef(refreshConnections);
  refreshConnectionsRef.current = refreshConnections;
  // On web (Expo Router), useFocusEffect can fire a spurious second time after a
  // programmatic tab switch (e.g. "View Card" navigation). That second fire has no
  // pending userId, so it would reset activeView to 'list' and close the just-opened
  // detail. This flag absorbs exactly that one extra fire; it is cleared by onBack /
  // onExchange so subsequent manual tab taps work normally.
  const navOpenedDetailRef = useRef(false);

  // Reset to list whenever the Connects tab gains focus, unless a QR scan just
  // requested that we open a specific connection's detail view.
  useFocusEffect(
    useCallback(() => {
      // Check for pending card (physically scanned) open first
      const pendingCardId = getPendingCardOpen();
      setPendingCardOpen(null);
      if (pendingCardId) {
        navOpenedDetailRef.current = true;
        const card = cardContactsRef.current.find((c) => c.id === pendingCardId);
        if (card) { setActiveView({ type: 'card_detail', contact: card }); return; }
        // Card list might not be populated yet — store and wait
        setPendingOpenUserId(`card:${pendingCardId}`);
        return;
      }

      const pendingUserId = getPendingConnectionOpen();
      setPendingConnectionOpen(null);
      if (pendingUserId) {
        // Mark that this focus came from a "View Card" navigation so we can absorb
        // the spurious second useFocusEffect fire that Expo Router web emits.
        navOpenedDetailRef.current = true;
        const conn = allConnectionsRef.current.find(
          (c) => c.user.id === pendingUserId ||
                 c.user.designup_user_id === pendingUserId ||
                 c.id === `demo-${pendingUserId}`
        );
        if (conn) { setActiveView({ type: 'connect_detail', connection: conn }); return; }
        // allConnectionsRef may be stale if React deferred the off-screen render.
        // Setting state triggers a re-render so the useEffect below finds the connection.
        // Don't refresh here: loadConnections would replace demoAddedConnections, wiping the new entry.
        setPendingOpenUserId(pendingUserId);
        return;
      }
      // No pending userId. If this is the spurious second fire that follows a "View Card"
      // navigation, absorb it: clear the flag and bail out without resetting activeView.
      if (navOpenedDetailRef.current) {
        navOpenedDetailRef.current = false;
        return;
      }
      // Only refresh profiles when showing the list — not when navigating to a specific connection.
      refreshConnectionsRef.current();
      if (!pendingOpenUserIdRef.current) setActiveView({ type: 'list' });
    }, [])
  );

  const s = makeStyles(colors);

  const handleExchangeContact = async (connId: string, userName: string) => {
    if (exchangingRef.current.has(connId)) return; // prevent double-tap
    exchangingRef.current.add(connId);
    Analytics.exchangeContactTapped('list');

    // connId is "demo-{uuid}" — extract the target user's real Supabase ID
    const targetUserId = connId.startsWith('demo-') ? connId.slice(5) : connId;
    const isRealUser = targetUserId.length === 36 && targetUserId.includes('-');

    if (user?.id && isRealUser) {
      // Use RPC so the insert runs as postgres (SECURITY DEFINER),
      // bypassing the RLS policy that blocks inserting rows owned by another user.
      const { error } = await supabase.rpc('exchange_contact', {
        target_user_id: targetUserId,
        exh_id: null,
      });
      if (error) {
        exchangingRef.current.delete(connId);
        Alert.alert('Error', `Couldn't share contact: ${error.message}`);
        return;
      }
    }

    setMutualIds((prev) => new Set([...prev, connId]));
    exchangingRef.current.delete(connId);

    // Show feedback: toast on Android, Alert on iOS/web
    if (Platform.OS === 'android') {
      ToastAndroid.show(`Contact shared with ${userName}`, ToastAndroid.SHORT);
    } else {
      Alert.alert('Contact Shared', `Your contact has been shared with ${userName}. They'll see you in their connections.`);
    }
  };

  // Compute full connections list reactively from context
  const allConnections = useMemo<Connection[]>(() => {
    if (demoConnectionsReset) return [];
    const addedConns: Connection[] = (demoAddedConnections as any[]).map((person) => {
      // loadConnections stores full Connection objects; addDemoConnection stores flat objects
      if (person.user && typeof person.user === 'object') {
        const id = String(person.id);
        return { ...person, id: id.startsWith('demo-') ? id : `demo-${id}` } as Connection;
      }
      return {
        id: `demo-${person.id}`,
        user: {
          id: person.id,
          full_name: person.full_name || '',
          designup_user_id: person.designup_user_id ?? person.id,
          designation: person.designation || undefined,
          company_name: (person.company_name ?? person.company) || undefined,
          email: person.email || undefined,
          phone: person.phone || undefined,
          city: person.city || undefined,
          profile_image_url: person.profile_image_url || undefined,
          instagram_handle: person.instagram_handle || undefined,
          linkedin_url: person.linkedin_url || undefined,
          website_url: person.website_url || undefined,
          address: person.address || undefined,
        },
        brand_name: (person.company_name ?? person.company) || undefined,
        brand_id: person.brand_id || undefined,
        connection_type: 'networking' as const,
        scope: 'personal' as const,
        is_mutual: false,
        to_contact_shared: true,
        from_contact_shared: false,
        created_at: new Date().toISOString(),
      };
    });
    const all = isBeta ? addedConns : [...MOCK_CONNECTIONS, ...addedConns];
    return all.map((c) =>
      mutualIds.has(c.id) ? { ...c, is_mutual: true, from_contact_shared: true } : c
    );
  }, [demoConnectionsReset, demoAddedConnections, mutualIds]);
  // Keep ref in sync so useFocusEffect (which has no deps) can read current value
  allConnectionsRef.current = allConnections;

  // Open deferred connection once allConnections or pendingOpenUserId changes.
  // Using state (pendingOpenUserId) guarantees this effect re-runs even when allConnections
  // was already populated before useFocusEffect set the pending userId.
  useEffect(() => {
    if (!pendingOpenUserId) return;
    // Deferred card open: pendingOpenUserId is prefixed "card:{id}"
    if (pendingOpenUserId.startsWith('card:')) {
      const cardId = pendingOpenUserId.slice(5);
      const card = cardContacts.find((c) => c.id === cardId);
      if (card) {
        navOpenedDetailRef.current = true;
        setPendingOpenUserId(null);
        setActiveView({ type: 'card_detail', contact: card });
      }
      return;
    }
    const conn = allConnections.find(
      (c) => c.user.id === pendingOpenUserId ||
             c.user.designup_user_id === pendingOpenUserId ||
             c.id === `demo-${pendingOpenUserId}`
    );
    if (conn) {
      // Keep navOpenedDetailRef true so the spurious second useFocusEffect fire
      // (which may arrive after this effect) gets absorbed rather than resetting to list.
      navOpenedDetailRef.current = true;
      setPendingOpenUserId(null);
      setActiveView({ type: 'connect_detail', connection: conn });
    }
  }, [allConnections, cardContacts, pendingOpenUserId]);

  useEffect(() => {
    const isDetail = activeView.type !== 'list';
    navigation.setOptions({
      tabBarStyle: isDetail
        ? { display: 'none' }
        : getTabBarStyle(colors, Platform.OS === 'web' ? 0 : bottomInset),
    });
  }, [activeView.type, colors, bottomInset, navigation]);

  // Restore scroll position when returning to list from a detail view
  useEffect(() => {
    if (activeView.type !== 'list' || savedScrollY.current <= 0) return;
    const y = savedScrollY.current;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [activeView.type]);

  const filteredConnections = useMemo(() => {
    if (filterType === 'cards') return [];
    const q = search.toLowerCase();
    return allConnections.filter((c) => {
      if (q) {
        const connNotes = (notes[c.id] ?? []).map((n) => n.text).join(' ').toLowerCase();
        if (
          !c.user.full_name.toLowerCase().includes(q) &&
          !(c.brand_name || '').toLowerCase().includes(q) &&
          !(c.user.designation || '').toLowerCase().includes(q) &&
          !(c.user.city || '').toLowerCase().includes(q) &&
          !connNotes.includes(q)
        ) return false;
      }
      if (filterType === 'notes') return (notes[c.id] ?? []).length > 0;
      return true;
    });
  }, [allConnections, search, notes, filterType]);

  const filteredCards = useMemo(() => {
    if (filterType === 'connections') return [];
    const q = search.toLowerCase();
    return cardContacts.filter((c) => {
      if (q) {
        const allValues = c.fields.map((f) => f.value.toLowerCase()).join(' ');
        const modalNotes = (notes[c.id] ?? []).map((n) => n.text).join(' ').toLowerCase();
        if (!allValues.includes(q) && !c.notes.toLowerCase().includes(q) && !modalNotes.includes(q)) return false;
      }
      if (filterType === 'notes') return c.notes.trim().length > 0 || (notes[c.id] ?? []).length > 0;
      return true;
    });
  }, [cardContacts, search, notes, filterType]);

  type ListItem = { type: 'connect'; data: Connection } | { type: 'card'; data: CardContact };

  const filteredItems = useMemo((): ListItem[] => {
    const items: (ListItem & { ts: number })[] = [
      ...filteredConnections.map((c) => ({ type: 'connect' as const, data: c, ts: new Date(c.created_at).getTime() })),
      ...filteredCards.map((c) => ({ type: 'card' as const, data: c, ts: new Date(c.scanned_at).getTime() })),
    ];
    if (sortType === 'newest') items.sort((a, b) => b.ts - a.ts);
    else if (sortType === 'oldest') items.sort((a, b) => a.ts - b.ts);
    else if (sortType === 'az') items.sort((a, b) => {
      const na = a.type === 'connect' ? a.data.user.full_name : getCardDisplayName(a.data.fields);
      const nb = b.type === 'connect' ? b.data.user.full_name : getCardDisplayName(b.data.fields);
      return na.localeCompare(nb);
    });
    else if (sortType === 'za') items.sort((a, b) => {
      const na = a.type === 'connect' ? a.data.user.full_name : getCardDisplayName(a.data.fields);
      const nb = b.type === 'connect' ? b.data.user.full_name : getCardDisplayName(b.data.fields);
      return nb.localeCompare(na);
    });
    return items;
  }, [filteredConnections, filteredCards, sortType]);

  // ── Detail views ────────────────────────────────────────────────────────────

  if (activeView.type === 'connect_detail') {
    const currentConn = allConnections.find((c) => c.id === activeView.connection.id) ?? activeView.connection;
    return (
      <ContactDetailPage
        connection={currentConn}
        colors={colors}
        onBack={() => { navOpenedDetailRef.current = false; setActiveView({ type: 'list' }); }}
        onExchange={(id, name) => { navOpenedDetailRef.current = false; handleExchangeContact(id, name); setActiveView({ type: 'list' }); }}
        notes={notes[currentConn.id] ?? []}
        onAddNote={(text) => { addNote(currentConn.id, text); Analytics.noteAdded(); }}
        router={router}
      />
    );
  }

  if (activeView.type === 'card_detail') {
    return (
      <CardContactDetailPage
        contact={activeView.contact}
        colors={colors}
        onBack={() => setActiveView({ type: 'list' })}
        onDelete={(id) => { deleteCardContact(id); Analytics.contactDeleted(); setActiveView({ type: 'list' }); }}
        onUpdate={updateCardContact}
        notes={notes[activeView.contact.id] ?? []}
        onAddNote={(text) => { addNote(activeView.contact.id, text); Analytics.noteAdded(); }}
      />
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: headerPaddingTop as any }]}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Connects</Text>
      </View>

      <View style={s.searchWrap}>
        <View style={[s.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            placeholder="Search by name, brand, role, city, notes"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={(t) => { setSearch(t); if (t.length > 0) Analytics.connectionSearched(t); }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Backdrop — closes dropdowns when tapping outside */}
      {(showFilterDrop || showSortDrop) && (
        <Pressable
          style={[StyleSheet.absoluteFillObject, { zIndex: 10 }]}
          onPress={() => { setShowFilterDrop(false); setShowSortDrop(false); }}
        />
      )}

      {/* Filter + Sort + View toggle */}
      <View style={[s.filterBar, { zIndex: 20 }]}>

        {/* Filter CTA */}
        <View style={{ position: 'relative' }}>
          <Pressable
            style={[s.dropBtn, {
              backgroundColor: colors.surface,
              borderColor: filterType !== 'all' ? colors.accent : colors.border,
            }]}
            onPress={() => { setShowFilterDrop((v) => !v); setShowSortDrop(false); }}
          >
            <Ionicons name="options-outline" size={14} color={filterType !== 'all' ? colors.accent : colors.textSecondary} />
            <Text style={[s.dropBtnText, { color: filterType !== 'all' ? colors.accent : colors.textSecondary }]}>
              {FILTER_LABEL[filterType]}
            </Text>
            <Ionicons name={showFilterDrop ? 'chevron-up' : 'chevron-down'} size={12} color={filterType !== 'all' ? colors.accent : colors.textMuted} />
          </Pressable>
          {showFilterDrop && (
            <View style={[s.dropdown, { backgroundColor: colors.surface, borderColor: colors.border, left: 0 }]}>
              {FILTER_OPTIONS.map((opt, i) => (
                <Pressable
                  key={opt.value}
                  style={[s.dropItem, i < FILTER_OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  onPress={() => { setFilterType(opt.value as any); setShowFilterDrop(false); }}
                >
                  <Text style={[s.dropItemText, { color: filterType === opt.value ? colors.accent : colors.text }]}>{opt.label}</Text>
                  {filterType === opt.value && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Sort CTA */}
        <View style={{ position: 'relative' }}>
          <Pressable
            style={[s.dropBtn, {
              backgroundColor: colors.surface,
              borderColor: sortType !== 'newest' ? colors.accent : colors.border,
            }]}
            onPress={() => { setShowSortDrop((v) => !v); setShowFilterDrop(false); }}
          >
            <Ionicons name="swap-vertical-outline" size={14} color={sortType !== 'newest' ? colors.accent : colors.textSecondary} />
            <Text style={[s.dropBtnText, { color: sortType !== 'newest' ? colors.accent : colors.textSecondary }]}>
              {SORT_LABEL[sortType]}
            </Text>
            <Ionicons name={showSortDrop ? 'chevron-up' : 'chevron-down'} size={12} color={sortType !== 'newest' ? colors.accent : colors.textMuted} />
          </Pressable>
          {showSortDrop && (
            <View style={[s.dropdown, { backgroundColor: colors.surface, borderColor: colors.border, left: 0 }]}>
              {SORT_OPTIONS.map((opt, i) => (
                <Pressable
                  key={opt.value}
                  style={[s.dropItem, i < SORT_OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  onPress={() => { setSortType(opt.value as SortType); setShowSortDrop(false); }}
                >
                  <Text style={[s.dropItemText, { color: sortType === opt.value ? colors.accent : colors.text }]}>{opt.label}</Text>
                  {sortType === opt.value && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* View toggle */}
        <Pressable
          style={[s.dropBtn, {
            backgroundColor: colors.surface,
            borderColor: viewMode === 'gallery' ? colors.accent : colors.border,
            paddingHorizontal: 10,
          }]}
          onPress={() => setViewMode((v) => v === 'list' ? 'gallery' : 'list')}
        >
          <Ionicons
            name={viewMode === 'gallery' ? 'list-outline' : 'grid-outline'}
            size={16}
            color={viewMode === 'gallery' ? colors.accent : colors.textSecondary}
          />
        </Pressable>



      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={viewMode === 'gallery' ? s.galleryScroll : s.scroll}
        onScroll={(e) => { savedScrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={100}
      >

        {viewMode === 'gallery' ? (
          /* ── Gallery view ─────────────────────────────────────────────── */
          <>
            {filteredItems.map((item) => {
              const id = item.data.id;
              const isCard = item.type === 'card';
              const contact = isCard ? (item.data as CardContact) : null;
              const conn = !isCard ? (item.data as Connection) : null;
              const imgUri = isCard
                ? cloudinaryThumb(contact!.card_image_uri, 400)
                : cloudinaryThumb(conn!.user.profile_image_url, 400);
              const name = isCard ? getCardDisplayName(contact!.fields) : conn!.user.full_name;
              const initials = name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
              return (
                <Pressable
                  key={id}
                  style={[s.galleryCell, { backgroundColor: colors.surface }]}
                  onPress={() => {
                    if (isCard) {
                      Analytics.contactDetailOpened('card', id);
                      setActiveView({ type: 'card_detail', contact: item.data as CardContact });
                    } else {
                      Analytics.contactDetailOpened('connection', id);
                      setActiveView({ type: 'connect_detail', connection: item.data as Connection });
                    }
                  }}
                >
                  {imgUri ? (
                    <ImageWithFallback uri={imgUri} style={s.galleryCellImg} fallback={
                      <View style={[s.galleryCellPlaceholder, { backgroundColor: colors.accent + '18' }]}>
                        <Text style={[s.galleryCellInitials, { color: colors.accent }]}>{initials}</Text>
                      </View>
                    } />
                  ) : (
                    <View style={[s.galleryCellPlaceholder, { backgroundColor: colors.accent + '18' }]}>
                      <Text style={[s.galleryCellInitials, { color: colors.accent }]}>{initials}</Text>
                    </View>
                  )}
                  <Text style={[s.galleryCellName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                </Pressable>
              );
            })}
            {filteredItems.length === 0 && (
              <View style={[s.emptyState, { backgroundColor: colors.surface, width: '100%' }]}>
                <Text style={s.emptyIcon}>{search ? '🔍' : '🤝'}</Text>
                <Text style={[s.emptyTitle, { color: colors.text }]}>
                  {search ? `No results for "${search}"` : 'No connections yet'}
                </Text>
                <Text style={[s.emptyBody, { color: colors.textSecondary }]}>
                  {search ? 'Try a different name, company, or role.' : 'Scan a visiting card or Connect QR to get started.'}
                </Text>
              </View>
            )}
          </>
        ) : (
          /* ── List view ────────────────────────────────────────────────── */
          <>
            {filteredItems.map((item) =>
              item.type === 'connect' ? (
                <ConnectionCard
                  key={item.data.id}
                  connection={item.data}
                  colors={colors}
                  onPress={() => { Analytics.contactDetailOpened('connection', item.data.id); setActiveView({ type: 'connect_detail', connection: item.data }); }}
                  onExchange={(id, name) => handleExchangeContact(id, name)}
                  notes={notes[item.data.id] ?? []}
                  search={search}
                />
              ) : (
                <CardContactCard
                  key={item.data.id}
                  contact={item.data}
                  colors={colors}
                  onPress={() => { Analytics.contactDetailOpened('card', item.data.id); setActiveView({ type: 'card_detail', contact: item.data }); }}
                  search={search}
                />
              )
            )}

            {/* ── Empty state ── */}
            {filteredItems.length === 0 && (
              <View style={[s.emptyState, { backgroundColor: colors.surface }]}>
                <Text style={s.emptyIcon}>{search ? '🔍' : filterType === 'notes' ? '📝' : '🤝'}</Text>
                <Text style={[s.emptyTitle, { color: colors.text }]}>
                  {search
                    ? `No results for "${search}"`
                    : filterType === 'notes'
                      ? 'No contacts with notes'
                      : 'No connections yet'}
                </Text>
                <Text style={[s.emptyBody, { color: colors.textSecondary }]}>
                  {search
                    ? 'Try searching by a different name, company, role, or city.'
                    : filterType === 'notes'
                      ? 'Open a contact and tap "Add a note" to start keeping notes about your connections.'
                      : isBeta
                        ? 'Everyone you\'ve connected with appears here — scan a visiting card or a Connect QR to get started.'
                        : 'Scan a QR code to connect with someone on Connect, or tap "Scan Card" to save a physical visiting card.'}
                </Text>
                {!search && filterType !== 'notes' && (
                  <Pressable
                    style={[s.emptyCardBtn, { backgroundColor: colors.accent }]}
                    onPress={() => router.push('/(app)/scan?mode=card' as any)}
                  >
                    <Ionicons name="card-outline" size={16} color="#FFF" />
                    <Text style={s.emptyCardBtnText}>Scan a Visiting Card</Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Card contact list card ────────────────────────────────────────────────────

function ImageWithFallback({ uri, style, fallback }: { uri: string; style: any; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
}

function CardContactCard({ contact, colors, onPress, search }: {
  contact: CardContact;
  colors: any;
  onPress: () => void;
  search: string;
}) {
  const s = makeStyles(colors);
  const nameField = contact.fields.find((f) => f.label === 'Name');
  const companyField = contact.fields.find((f) => f.label === 'Company');
  const desigField = contact.fields.find((f) => f.label === 'Designation');
  const displayName = getCardDisplayName(contact.fields);
  const date = new Date(contact.scanned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const initials = nameField
    ? nameField.value.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const q = search.toLowerCase();
  const matchedField = q
    ? contact.fields.find((f) => f.value.toLowerCase().includes(q) && f.label !== 'Name')
    : null;
  const matchedNote = q && contact.notes.toLowerCase().includes(q) ? contact.notes : null;

  return (
    <Pressable
      style={[s.cardDivider, { borderBottomColor: colors.border }]}
      onPress={onPress}
    >
      {/* Avatar or card thumbnail */}
      {contact.card_image_uri ? (
        <Image source={{ uri: cloudinaryThumb(contact.card_image_uri, 400) ?? contact.card_image_uri }} style={s.cardThumb} resizeMode="cover" />
      ) : (
        <View style={[s.avatar, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[s.avatarText, { color: colors.textSecondary }]}>{initials}</Text>
        </View>
      )}

      <View style={s.cardInfo}>
        <Text style={[s.userName, { color: colors.text }]}>
          {displayName}
        </Text>
        {companyField && (
          <Text style={[s.brandName, { color: colors.textSecondary }]}>{companyField.value}</Text>
        )}
        {desigField && (
          <Text style={[s.designation, { color: colors.textMuted }]}>{desigField.value}</Text>
        )}
        {matchedField && (
          <View style={[s.matchRow, { backgroundColor: colors.accent + '12' }]}>
            <Ionicons name="search" size={10} color={colors.accent} />
            <Text style={[s.matchText, { color: colors.accent }]} numberOfLines={1}>
              {matchedField.label}: {matchedField.value}
            </Text>
          </View>
        )}
        {matchedNote && !matchedField && (
          <View style={[s.matchRow, { backgroundColor: colors.accent + '12' }]}>
            <Ionicons name="create-outline" size={10} color={colors.accent} />
            <Text style={[s.matchText, { color: colors.accent }]} numberOfLines={1}>
              {contact.notes}
            </Text>
          </View>
        )}
      </View>

      <View style={s.cardRight}>
        <Text style={[s.date, { color: colors.textMuted }]}>{date}</Text>
      </View>
    </Pressable>
  );
}

// ── Card contact detail page ──────────────────────────────────────────────────

const IDENTITY_LABELS = new Set(['Name', 'Company', 'Designation']);
const CONTACT_LABELS_SET = new Set(['Phone', 'WhatsApp', 'Email']);
const ONLINE_LABELS_SET = new Set(['Website', 'Instagram', 'LinkedIn', 'Twitter/X', 'Facebook', 'Behance', 'YouTube', 'Social Handle']);
const LOCATION_LABELS_SET = new Set(['Address']);
const isAddressLabel = (label: string) => label === 'Address' || label.startsWith('Address (');


function CardContactDetailPage({ contact, colors, onBack, onDelete, onUpdate, notes, onAddNote }: {
  contact: CardContact;
  colors: any;
  onBack: () => void;
  onDelete: (id: string) => void;
  onUpdate: (c: CardContact) => void;
  notes: import('../../context/AuthContext').Note[];
  onAddNote: (text: string) => void;
}) {
  const s = makeStyles(colors);
  const headerPaddingTop = useHeaderPaddingTop();
  const { user } = useAuth();
  const [showNotes, setShowNotes] = useState(false);
  const [expandedUri, setExpandedUri] = useState<string | null>(null);
  const [callSheetPhone, setCallSheetPhone] = useState<string | null>(null);
  const [phonePicker, setPhonePicker] = useState<{ mode: 'call' | 'whatsapp'; numbers: string[] } | null>(null);

  const phoneFields = contact.fields.filter((f) => f.label === 'Phone');
  const waFields = contact.fields.filter((f) => f.label === 'WhatsApp');
  const faxFields = contact.fields.filter((f) => f.label === 'Fax');
  const phoneField = phoneFields[0] ?? faxFields[0]; // fax as call fallback
  const waField = waFields[0] ?? phoneFields[0]; // no fax for WhatsApp
  const emailField = contact.fields.find((f) => f.label === 'Email');
  const hasQuickActions = !!(waField || phoneField || emailField);

  const company = contact.fields.find((f) => f.label === 'Company')?.value;
  const name = getCardDisplayName(contact.fields);
  const designation = contact.fields.find((f) => f.label === 'Designation')?.value;

  const contactFields = contact.fields.filter((f) => CONTACT_LABELS_SET.has(f.label));
  const onlineFields = contact.fields.filter((f) => ONLINE_LABELS_SET.has(f.label));
  const locationFields = contact.fields.filter((f) => isAddressLabel(f.label));
  const otherFields = contact.fields.filter(
    (f) => !IDENTITY_LABELS.has(f.label) && !CONTACT_LABELS_SET.has(f.label) &&
            !ONLINE_LABELS_SET.has(f.label) && !isAddressLabel(f.label)
  );

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if ((globalThis as any).window?.confirm(`Remove ${name} from your card directory?`)) {
        onDelete(contact.id);
      }
      return;
    }
    Alert.alert(
      'Delete Contact',
      `Remove ${name} from your card directory? The card image will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(contact.id) },
      ]
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.detailHeader, { paddingTop: headerPaddingTop as any }]}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Connects</Text>
        <Pressable onPress={handleDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.detailScroll}>
        {/* Name + card thumbnails side by side (matches VariantC test layout) */}
        <View style={s.gTopRow}>
          <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
            <Text style={[s.gName, { color: colors.text }]}>{name}</Text>
            {company && <Text style={[s.gCompany, { color: colors.accent }]}>{company}</Text>}
            {designation && <Text style={[s.gDesignation, { color: colors.textMuted }]}>{designation}</Text>}
            <Text style={[s.scannedAt, { color: colors.textMuted, textAlign: 'left', marginTop: 4 }]}>
              {'Scanned ' + new Date(contact.updated_at || contact.scanned_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
            </Text>
          </View>
          {contact.card_image_uri && (
            <View style={s.gThumbStack}>
              <Pressable onPress={() => setExpandedUri(contact.card_image_uri)} style={s.gThumb}>
                <Image source={{ uri: cloudinaryThumb(contact.card_image_uri, 400) ?? contact.card_image_uri! }} style={s.gThumbImg} resizeMode="cover" />
                <Text style={s.gThumbLabel}>Front</Text>
              </Pressable>
              {contact.card_image_uri_back && (
                <Pressable onPress={() => setExpandedUri(contact.card_image_uri_back)} style={[s.gThumb, { marginTop: -18 }]}>
                  <Image source={{ uri: cloudinaryThumb(contact.card_image_uri_back, 400) ?? contact.card_image_uri_back! }} style={s.gThumbImg} resizeMode="cover" />
                  <Text style={s.gThumbLabel}>Back</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {hasQuickActions && (
          <View style={s.quickActionRow}>
            {waField && (
              <Pressable style={[s.quickActionPill, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '66' }]}
                onPress={() => {
                  const targets = waFields.length > 0 ? waFields : phoneFields;
                  if (targets.length <= 1) {
                    openWhatsApp(targets[0].value);
                  } else {
                    setPhonePicker({ mode: 'whatsapp', numbers: targets.map((f) => f.value) });
                  }
                }}>
                <Ionicons name="logo-whatsapp" size={15} color={colors.accent} />
                <Text style={[s.quickActionText, { color: colors.accent }]}>WhatsApp</Text>
              </Pressable>
            )}
            {phoneField && (
              <Pressable style={[s.quickActionPill, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '66' }]}
                onPress={() => {
                  if (phoneFields.length <= 1) {
                    setCallSheetPhone(phoneField.value);
                  } else {
                    setPhonePicker({ mode: 'call', numbers: phoneFields.map((f) => f.value) });
                  }
                }}>
                <Ionicons name="call-outline" size={15} color={colors.accent} />
                <Text style={[s.quickActionText, { color: colors.accent }]}>Call</Text>
              </Pressable>
            )}
            {emailField && (
              <Pressable style={[s.quickActionPill, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '66' }]}
                onPress={() => openExternal(`mailto:${emailField.value}`)}>
                <Ionicons name="mail-outline" size={15} color={colors.accent} />
                <Text style={[s.quickActionText, { color: colors.accent }]}>Email</Text>
              </Pressable>
            )}
          </View>
        )}

        {contactFields.length > 0 && (
          <GroupedSection label="CONTACT" colors={colors} s={s}>
            {contactFields.map((f, i) => (
              <Fragment key={i}>
                <GroupedFieldRow field={f} colors={colors} s={s} />
                {i < contactFields.length - 1 && <View style={[s.gDivider, { backgroundColor: colors.border }]} />}
              </Fragment>
            ))}
          </GroupedSection>
        )}

        {onlineFields.length > 0 && (
          <GroupedSection label="ONLINE" colors={colors} s={s}>
            {onlineFields.map((f, i) => (
              <Fragment key={i}>
                <GroupedFieldRow field={f} colors={colors} s={s} />
                {i < onlineFields.length - 1 && <View style={[s.gDivider, { backgroundColor: colors.border }]} />}
              </Fragment>
            ))}
          </GroupedSection>
        )}

        {locationFields.length > 0 && (
          <GroupedSection label="LOCATION" colors={colors} s={s}>
            {locationFields.map((f, i) => (
              <Fragment key={i}>
                <GroupedFieldRow field={f} colors={colors} s={s} />
                {i < locationFields.length - 1 && <View style={[s.gDivider, { backgroundColor: colors.border }]} />}
              </Fragment>
            ))}
          </GroupedSection>
        )}

        {otherFields.length > 0 && (
          <GroupedSection label="OTHER" colors={colors} s={s}>
            {otherFields.map((f, i) => (
              <Fragment key={i}>
                <GroupedFieldRow field={f} colors={colors} s={s} />
                {i < otherFields.length - 1 && <View style={[s.gDivider, { backgroundColor: colors.border }]} />}
              </Fragment>
            ))}
          </GroupedSection>
        )}

        {/* Notes */}
        <View style={s.gSectionWrap}>
          <Text style={[s.gSectionLabel, { color: colors.textMuted }]}>NOTES</Text>
          <View style={[s.gSectionCard, { backgroundColor: colors.surface }]}>
            {contact.notes.trim().length > 0 && (
              <>
                <View style={s.gRow}>
                  <Ionicons name="create-outline" size={17} color={colors.gold} />
                  <Text style={[s.gRowValue, { color: colors.textSecondary, flex: 1, lineHeight: 20 }]}>{contact.notes}</Text>
                </View>
                <View style={[s.gDivider, { backgroundColor: colors.border }]} />
              </>
            )}
            <Pressable style={s.gRow} onPress={() => setShowNotes(true)}>
              <Ionicons name="add-circle-outline" size={17} color={colors.accent} />
              <Text style={[s.gRowValue, { color: colors.accent, flex: 1 }]}>
                {notes.length > 0 ? `View ${notes.length} note${notes.length > 1 ? 's' : ''}` : 'Add a note'}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

      </ScrollView>

      {callSheetPhone && (
        <Modal visible transparent animationType="slide">
          <Pressable style={s.sheetOverlay} onPress={() => setCallSheetPhone(null)}>
            <Pressable style={[s.callSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <Text style={[s.callSheetNumber, { color: colors.textMuted }]}>{callSheetPhone}</Text>
              <Pressable style={s.callSheetOption} onPress={() => {
                openExternal(`tel:${callSheetPhone.replace(/[\s\-()]/g, '')}`);
                setCallSheetPhone(null);
              }}>
                <Ionicons name="call-outline" size={20} color={colors.text} />
                <Text style={[s.callSheetOptionText, { color: colors.text }]}>Call</Text>
              </Pressable>
              <View style={[s.gDivider, { backgroundColor: colors.border, marginLeft: 0 }]} />
              <Pressable style={s.callSheetOption} onPress={() => {
                Clipboard.setStringAsync(callSheetPhone);
                setCallSheetPhone(null);
              }}>
                <Ionicons name="copy-outline" size={20} color={colors.text} />
                <Text style={[s.callSheetOptionText, { color: colors.text }]}>Copy number</Text>
              </Pressable>
              <Pressable style={[s.callSheetCancel, { borderTopColor: colors.border }]} onPress={() => setCallSheetPhone(null)}>
                <Text style={[s.callSheetCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {phonePicker && (
        <Modal visible transparent animationType="slide">
          <Pressable style={s.sheetOverlay} onPress={() => setPhonePicker(null)}>
            <Pressable style={[s.callSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <Text style={[s.callSheetNumber, { color: colors.textMuted }]}>
                {phonePicker.mode === 'call' ? 'Call via' : 'WhatsApp via'}
              </Text>
              {phonePicker.numbers.map((num, i) => (
                <Fragment key={i}>
                  {i > 0 && <View style={[s.gDivider, { backgroundColor: colors.border, marginLeft: 0 }]} />}
                  <Pressable style={s.callSheetOption} onPress={() => {
                    setPhonePicker(null);
                    if (phonePicker.mode === 'call') setCallSheetPhone(num);
                    else openWhatsApp(num);
                  }}>
                    <Ionicons name={phonePicker.mode === 'call' ? 'call-outline' : 'logo-whatsapp'} size={20} color={colors.text} />
                    <Text style={[s.callSheetOptionText, { color: colors.text }]}>{num}</Text>
                  </Pressable>
                </Fragment>
              ))}
              <Pressable style={[s.callSheetCancel, { borderTopColor: colors.border }]} onPress={() => setPhonePicker(null)}>
                <Text style={[s.callSheetCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {expandedUri && (
        <Modal visible transparent animationType="fade">
          <Pressable style={s.lightboxOverlay} onPress={() => setExpandedUri(null)}>
            <Image source={{ uri: expandedUri }} style={s.lightboxImage} resizeMode="contain" />
            <Pressable style={s.lightboxClose} onPress={() => setExpandedUri(null)}>
              <Ionicons name="close" size={22} color="#FFF" />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <NotesModal
        visible={showNotes}
        onClose={() => setShowNotes(false)}
        entityName={name}
        notes={notes}
        onAddNote={onAddNote}
        colors={colors}
      />
    </View>
  );
}

// ── Field row for detail view ─────────────────────────────────────────────────

const FIELD_ICONS: Record<string, string> = {
  Company: 'business-outline',
  Designation: 'briefcase-outline',
  Phone: 'call-outline',
  WhatsApp: 'logo-whatsapp',
  Email: 'mail-outline',
  Website: 'globe-outline',
  LinkedIn: 'logo-linkedin',
  Instagram: 'logo-instagram',
  'Twitter/X': 'logo-twitter',
  Behance: 'color-palette-outline',
  YouTube: 'logo-youtube',
  Address: 'location-outline',
  Services: 'list-outline',
  'Name 2': 'person-outline',
  Other: 'ellipsis-horizontal-outline',
};

const LINKABLE_FIELDS = new Set(['Website', 'Instagram', 'LinkedIn']);

function FieldDetailRow({ field, colors, isLast }: { field: import('../../types').CardContactField; colors: any; isLast: boolean }) {
  const s = makeStyles(colors);
  const icon = FIELD_ICONS[field.label] ?? (isAddressLabel(field.label) ? 'location-outline' : 'ellipsis-horizontal-outline');
  const isCopyable = ['Phone', 'WhatsApp', 'Email', 'Website', 'LinkedIn', 'Instagram', 'Twitter/X'].includes(field.label);
  const isLinkable = LINKABLE_FIELDS.has(field.label);

  return (
    <View style={[s.contactRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Ionicons name={icon as any} size={18} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[s.contactFieldLabel, { color: colors.textMuted }]}>{field.label}</Text>
        <Text style={[s.contactValue, { color: colors.text }]}>{field.value}</Text>
      </View>
      {isLinkable && (
        <Pressable onPress={() => openLink(field.label, field.value)} hitSlop={8}>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </Pressable>
      )}
      {isCopyable && <CopyButton value={field.value} label={field.label} size={16} />}
    </View>
  );
}

// ── Grouped design helpers ────────────────────────────────────────────────────

function GroupedSection({ label, children, colors, s }: { label: string; children: React.ReactNode; colors: any; s: any }) {
  return (
    <View style={s.gSectionWrap}>
      <Text style={[s.gSectionLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[s.gSectionCard, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

function GroupedFieldRow({ field, colors, s }: { field: import('../../types').CardContactField; colors: any; s: any }) {
  const icon = FIELD_ICONS[field.label] ?? (isAddressLabel(field.label) ? 'location-outline' : 'ellipsis-horizontal-outline');
  const isPhone = field.label === 'Phone' || field.label === 'WhatsApp';
  const isLinkable = ONLINE_LABELS_SET.has(field.label) && field.label !== 'Social Handle';
  const isCopyable = CONTACT_LABELS_SET.has(field.label);
  const multiLine = isAddressLabel(field.label) || field.label === 'Other' || field.label === 'Services';

  return (
    <View style={[s.gRow, multiLine && { alignItems: 'flex-start' }]}>
      <Ionicons name={icon as any} size={18} color={colors.textSecondary} style={multiLine ? { marginTop: 2 } : undefined} />
      <View style={{ flex: 1 }}>
        <Text style={[s.gRowLabel, { color: colors.textMuted }]}>{field.label}</Text>
        <Text style={[s.gRowValue, { color: colors.text }]} numberOfLines={multiLine ? 5 : 1}>{field.value}</Text>
      </View>
      {isLinkable && (
        <Pressable onPress={() => openLink(field.label, field.value)} hitSlop={8}>
          <Ionicons name="open-outline" size={16} color={colors.accent} />
        </Pressable>
      )}
      {(isPhone || isCopyable) && <CopyButton value={field.value} label={field.label} size={15} style={{ marginLeft: 8 }} />}
    </View>
  );
}

// ── Connection components ─────────────────────────────────────────────────────

function ConnectionCard({ connection, colors, onPress, onExchange, notes = [], search = '' }: {
  connection: Connection; colors: any; onPress: () => void;
  onExchange: (id: string, name: string) => void;
  notes?: import('../../context/AuthContext').Note[];
  search?: string;
}) {
  const s = makeStyles(colors);
  const { user } = connection;
  const date = new Date(connection.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const q = search.toLowerCase();
  const matchedNote = q.length > 0
    ? notes.find((n) => n.text.toLowerCase().includes(q))
    : null;

  return (
    <Pressable
      style={[s.cardDivider, { borderBottomColor: colors.border }]}
      onPress={onPress}
    >
      <View style={[s.avatar, { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[s.avatarText, { color: '#FFFFFF' }]}>
          {user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
        </Text>
        {user.profile_image_url ? (
          <Image source={{ uri: cloudinaryThumb(user.profile_image_url, 120) ?? user.profile_image_url }} style={[s.avatarPhoto, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]} />
        ) : null}
      </View>

      <View style={s.cardInfo}>
        <Text style={[s.userName, { color: colors.text }]}>{user.full_name}</Text>
        {connection.brand_name && (
          <Text style={[s.brandName, { color: colors.textSecondary }]}>{connection.brand_name}</Text>
        )}
        {user.designation && (
          <Text style={[s.designation, { color: colors.textMuted }]}>{user.designation}</Text>
        )}
        {matchedNote && (
          <View style={[s.matchRow, { backgroundColor: colors.accent + '12' }]}>
            <Ionicons name="create-outline" size={10} color={colors.accent} />
            <Text style={[s.matchText, { color: colors.accent }]} numberOfLines={1}>
              {matchedNote.text}
            </Text>
          </View>
        )}
      </View>

      <View style={s.cardRight}>
        <Text style={[s.date, { color: colors.textMuted }]}>{date}</Text>
      </View>
    </Pressable>
  );
}

const SLIDE_THUMB = 44;
const SLIDE_PAD = 4;

function SlideToExchange({ onComplete, colors }: { onComplete: () => void; colors: any }) {
  const s = makeStyles(colors);
  const pan = useRef(new Animated.Value(0)).current;
  const trackWidthRef = useRef(0);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [done, setDone] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !doneRef.current,
      onMoveShouldSetPanResponder: () => !doneRef.current,
      onPanResponderMove: (_, g) => {
        if (doneRef.current) return;
        const max = trackWidthRef.current - SLIDE_THUMB - SLIDE_PAD * 2;
        pan.setValue(Math.max(0, Math.min(g.dx, max)));
      },
      onPanResponderRelease: (_, g) => {
        if (doneRef.current) return;
        const max = trackWidthRef.current - SLIDE_THUMB - SLIDE_PAD * 2;
        if (g.dx >= max * 0.75) {
          Animated.spring(pan, { toValue: max, useNativeDriver: false }).start();
          doneRef.current = true;
          setDone(true);
          onCompleteRef.current();
        } else {
          Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const textOpacity = pan.interpolate({
    inputRange: [0, Math.max(1, (trackWidth - SLIDE_THUMB - SLIDE_PAD * 2) * 0.45)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[s.slideTrack, {
        backgroundColor: done ? colors.accent + '22' : colors.accent + '14',
        borderColor: colors.accent + '55',
      }]}
      onLayout={(e) => {
        trackWidthRef.current = e.nativeEvent.layout.width;
        setTrackWidth(e.nativeEvent.layout.width);
      }}
    >
      {done ? (
        <View style={s.slideSuccess}>
          <Ionicons name="checkmark-circle-outline" size={17} color={colors.accent} />
          <Text style={[s.slideLabel, { color: colors.accent }]}>Contact Exchanged</Text>
        </View>
      ) : (
        <>
          <Animated.Text style={[s.slideLabel, { color: colors.accent, opacity: textOpacity }]}>
            Slide to exchange {'→'}
          </Animated.Text>
          <Animated.View
            style={[s.slideThumb, { backgroundColor: colors.accent, left: SLIDE_PAD, transform: [{ translateX: pan }] }]}
            {...panResponder.panHandlers}
          >
            <Ionicons name="arrow-forward" size={19} color="#FFF" />
          </Animated.View>
        </>
      )}
    </View>
  );
}

function ContactDetailPage({ connection, colors, onBack, onExchange, notes, onAddNote, router }: {
  connection: Connection; colors: any; onBack: () => void;
  onExchange: (id: string, name: string) => void;
  notes: import('../../context/AuthContext').Note[];
  onAddNote: (text: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const s = makeStyles(colors);
  const headerPaddingTop = useHeaderPaddingTop();
  const { user: connUser } = connection;
  const [showNotes, setShowNotes] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [callSheetPhone, setCallSheetPhone] = useState<string | null>(null);

  const hasQRQuickActions = !!(connUser.phone || connUser.email);
  const user = connUser;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.detailHeader, { paddingTop: headerPaddingTop as any }]}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Connects</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={s.detailScroll}>
        {photoExpanded && user.profile_image_url && (
          <Modal transparent animationType="fade" onRequestClose={() => setPhotoExpanded(false)}>
            <Pressable style={s.lightboxOverlay} onPress={() => setPhotoExpanded(false)}>
              <Image source={{ uri: user.profile_image_url }} style={s.lightboxImage} resizeMode="contain" />
              <Pressable style={s.lightboxClose} onPress={() => setPhotoExpanded(false)}>
                <Ionicons name="close" size={22} color="#FFF" />
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {/* Identity */}
        <View style={[s.gTopRow, { paddingBottom: Spacing.md }]}>
          <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
            <Text style={[s.gName, { color: colors.text }]}>{user.full_name}</Text>
            {(connection.brand_name || user.company_name) && (
              <Text style={[s.gCompany, { color: colors.accent }]}>{connection.brand_name || user.company_name}</Text>
            )}
            {user.designation && (
              <Text style={[s.gDesignation, { color: colors.textMuted }]}>{user.designation}</Text>
            )}
            <Text style={[s.scannedAt, { color: colors.textMuted, textAlign: 'left', marginTop: 4 }]}>
              Connected {new Date(connection.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
            </Text>
          </View>
          <Pressable
            onPress={() => user.profile_image_url ? setPhotoExpanded(true) : undefined}
            style={[s.gProfileThumb, { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }]}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF' }}>
              {user.full_name.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
            </Text>
            {user.profile_image_url ? (
              <Image source={{ uri: cloudinaryThumb(user.profile_image_url, 160) ?? user.profile_image_url }} style={[s.gProfileThumbImg, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]} />
            ) : null}
          </Pressable>
        </View>

        {hasQRQuickActions && (
          <View style={s.quickActionRow}>
            {user.phone && (
              <Pressable style={[s.quickActionPill, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '66' }]}
                onPress={() => openWhatsApp(user.phone!)}>
                <Ionicons name="logo-whatsapp" size={15} color={colors.accent} />
                <Text style={[s.quickActionText, { color: colors.accent }]}>WhatsApp</Text>
              </Pressable>
            )}
            {user.phone && (
              <Pressable style={[s.quickActionPill, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '66' }]}
                onPress={() => setCallSheetPhone(user.phone!)}>
                <Ionicons name="call-outline" size={15} color={colors.accent} />
                <Text style={[s.quickActionText, { color: colors.accent }]}>Call</Text>
              </Pressable>
            )}
            {user.email && (
              <Pressable style={[s.quickActionPill, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '66' }]}
                onPress={() => openExternal(`mailto:${user.email}`)}>
                <Ionicons name="mail-outline" size={15} color={colors.accent} />
                <Text style={[s.quickActionText, { color: colors.accent }]}>Email</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* CONTACT */}
        {(user.phone || user.email) && (
          <GroupedSection label="CONTACT" colors={colors} s={s}>
            {user.phone && (
              <View style={s.gRow}>
                <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.gRowLabel, { color: colors.textMuted }]}>Phone</Text>
                  <Text style={[s.gRowValue, { color: colors.text }]}>{user.phone}</Text>
                </View>
                <CopyButton value={user.phone!} label="Phone" size={15} />
              </View>
            )}
            {user.phone && user.email && <View style={[s.gDivider, { backgroundColor: colors.border }]} />}
            {user.email && (
              <View style={s.gRow}>
                <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.gRowLabel, { color: colors.textMuted }]}>Email</Text>
                  <Text style={[s.gRowValue, { color: colors.text }]}>{user.email}</Text>
                </View>
                <CopyButton value={user.email!} label="Email" size={15} />
              </View>
            )}
          </GroupedSection>
        )}

        {/* ONLINE */}
        {(user.instagram_handle || user.linkedin_url || user.website_url) && (
          <GroupedSection label="ONLINE" colors={colors} s={s}>
            {user.instagram_handle && (
              <Pressable style={s.gRow} onPress={() => openLink('Instagram', user.instagram_handle!)}>
                <Ionicons name="logo-instagram" size={18} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.gRowLabel, { color: colors.textMuted }]}>Instagram</Text>
                  <Text style={[s.gRowValue, { color: colors.text }]}>@{user.instagram_handle}</Text>
                </View>
                <Ionicons name="open-outline" size={15} color={colors.accent} />
              </Pressable>
            )}
            {user.instagram_handle && user.linkedin_url && <View style={[s.gDivider, { backgroundColor: colors.border }]} />}
            {user.linkedin_url && (
              <Pressable style={s.gRow} onPress={() => openLink('LinkedIn', user.linkedin_url!)}>
                <Ionicons name="logo-linkedin" size={18} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.gRowLabel, { color: colors.textMuted }]}>LinkedIn</Text>
                  <Text style={[s.gRowValue, { color: colors.text }]}>{user.linkedin_url}</Text>
                </View>
                <Ionicons name="open-outline" size={15} color={colors.accent} />
              </Pressable>
            )}
            {user.linkedin_url && user.website_url && <View style={[s.gDivider, { backgroundColor: colors.border }]} />}
            {user.website_url && (
              <Pressable style={s.gRow} onPress={() => openLink('Website', user.website_url!)}>
                <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.gRowLabel, { color: colors.textMuted }]}>Website</Text>
                  <Text style={[s.gRowValue, { color: colors.text }]}>{user.website_url}</Text>
                </View>
                <Ionicons name="open-outline" size={15} color={colors.accent} />
              </Pressable>
            )}
          </GroupedSection>
        )}

        {/* LOCATION */}
        {(user.address || user.city) && (
          <GroupedSection label="LOCATION" colors={colors} s={s}>
            <View style={s.gRow}>
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.gRowLabel, { color: colors.textMuted }]}>Address</Text>
                <Text style={[s.gRowValue, { color: colors.text }]}>
                  {[user.address, user.city].filter(Boolean).join(', ')}
                </Text>
              </View>
              <CopyButton value={[user.address, user.city].filter(Boolean).join(', ')} label="Address" size={15} />
            </View>
          </GroupedSection>
        )}

        {/* REPRESENTS */}
        {connection.brand_id && connection.brand_name && (
          <View style={s.gSectionWrap}>
            <Text style={[s.gSectionLabel, { color: colors.textMuted }]}>REPRESENTS</Text>
            <Pressable style={[s.gSectionCard, { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/brand/${connection.brand_id}` as any)}>
              <View style={s.gRow}>
                <View style={[s.gBrandLetter, { backgroundColor: colors.accent + '22' }]}>
                  <Text style={[s.gBrandLetterText, { color: colors.accent }]}>{connection.brand_name[0]}</Text>
                </View>
                <Text style={[s.gRowValue, { flex: 1, color: colors.text }]}>{connection.brand_name}</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>
        )}

        {/* NOTES */}
        <View style={s.gSectionWrap}>
          <Text style={[s.gSectionLabel, { color: colors.textMuted }]}>NOTES</Text>
          <Pressable style={[s.gSectionCard, { backgroundColor: colors.surface }]} onPress={() => setShowNotes(true)}>
            <View style={s.gRow}>
              <Ionicons name="add-circle-outline" size={17} color={colors.accent} />
              <Text style={[s.gRowValue, { flex: 1, color: notes.length > 0 ? colors.text : colors.accent }]}>
                {notes.length > 0 ? `View ${notes.length} note${notes.length > 1 ? 's' : ''}` : 'Add a note'}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </View>
          </Pressable>
        </View>

        {/* Connection status / Exchange */}
        {connection.is_mutual ? (
          <View style={s.gActions}>
            <View style={[s.gMutualBadge, { backgroundColor: colors.accent + '18' }]}>
              <Ionicons name="checkmark-circle" size={13} color={colors.accent} />
              <Text style={[s.gMutualBadgeText, { color: colors.accent }]}>Mutual Connection</Text>
            </View>
          </View>
        ) : (
          <View style={s.gActions}>
            <SlideToExchange
              colors={colors}
              onComplete={() => { Analytics.exchangeContactTapped('detail'); onExchange(connection.id, connection.user.full_name); }}
            />
          </View>
        )}
      </ScrollView>

      {callSheetPhone && (
        <Modal visible transparent animationType="slide">
          <Pressable style={s.sheetOverlay} onPress={() => setCallSheetPhone(null)}>
            <Pressable style={[s.callSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <Text style={[s.callSheetNumber, { color: colors.textMuted }]}>{callSheetPhone}</Text>
              <Pressable style={s.callSheetOption} onPress={() => {
                openExternal(`tel:${callSheetPhone.replace(/[\s\-()]/g, '')}`);
                setCallSheetPhone(null);
              }}>
                <Ionicons name="call-outline" size={20} color={colors.text} />
                <Text style={[s.callSheetOptionText, { color: colors.text }]}>Call</Text>
              </Pressable>
              <View style={[s.gDivider, { backgroundColor: colors.border, marginLeft: 0 }]} />
              <Pressable style={s.callSheetOption} onPress={() => {
                Clipboard.setStringAsync(callSheetPhone);
                setCallSheetPhone(null);
              }}>
                <Ionicons name="copy-outline" size={20} color={colors.text} />
                <Text style={[s.callSheetOptionText, { color: colors.text }]}>Copy number</Text>
              </Pressable>
              <Pressable style={[s.callSheetCancel, { borderTopColor: colors.border }]} onPress={() => setCallSheetPhone(null)}>
                <Text style={[s.callSheetCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <NotesModal
        visible={showNotes}
        onClose={() => setShowNotes(false)}
        entityName={user.full_name}
        notes={notes}
        onAddNote={onAddNote}
        colors={colors}
      />
    </View>
  );
}

function ContactRow({ icon, label, value, colors, clickable = true }: any) {
  const s = makeStyles(colors);
  const isLinkable = LINKABLE_FIELDS.has(label);
  return (
    <View style={[s.contactRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[s.contactFieldLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[s.contactValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      </View>
      {isLinkable && (
        <Pressable onPress={() => openLink(label, value)} hitSlop={8}>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </Pressable>
      )}
      {clickable && <CopyButton value={value} label={label} size={16} />}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    scanCardBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: Spacing.md, paddingVertical: 7,
      borderRadius: Radius.full,
    },
    scanCardBtnText: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    searchWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44,
    },
    searchInput: { flex: 1, fontSize: FontSize.md },
    filterBar: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
    },
    dropBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: Spacing.md, paddingVertical: 9,
      borderRadius: Radius.md, borderWidth: 1,
    },
    dropBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    dropdown: {
      position: 'absolute', top: 42, zIndex: 30,
      borderRadius: Radius.md, borderWidth: 1,
      minWidth: 150,
      shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 }, elevation: 8,
    },
    dropItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: 12,
    },
    dropItemText: { fontSize: FontSize.sm },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    galleryScroll: { paddingHorizontal: Spacing.md, paddingBottom: 100, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    galleryCell: { width: '48%', borderRadius: Radius.lg, overflow: 'hidden' },
    galleryCellImg: { width: '100%', aspectRatio: 1.6 },
    galleryCellPlaceholder: { width: '100%', aspectRatio: 1.6, alignItems: 'center', justifyContent: 'center' },
    galleryCellInitials: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
    galleryCellName: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, paddingHorizontal: Spacing.sm, paddingVertical: 7 },
    sectionHeader: {
      fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
      letterSpacing: 0.5, marginBottom: Spacing.sm,
    },

    // Connection / card list card
    card: {
      flexDirection: 'row', borderRadius: Radius.lg, padding: Spacing.md,
      marginBottom: Spacing.md, gap: Spacing.md, alignItems: 'flex-start',
    },
    cardDivider: {
      flexDirection: 'row', paddingVertical: Spacing.md, paddingHorizontal: 2,
      gap: Spacing.md, alignItems: 'flex-start',
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarPhoto: { width: 44, height: 44, borderRadius: 22 },
    cardThumb: { width: 56, height: 36, borderRadius: 4 },
    avatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    cardInfo: { flex: 1, gap: 3 },
    userName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    brandName: { fontSize: FontSize.sm },
    designation: { fontSize: FontSize.xs },
    matchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start', maxWidth: '100%' },
    matchText: { fontSize: 10, fontWeight: FontWeight.medium, flexShrink: 1 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, alignSelf: 'flex-start', marginTop: 4 },
    statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    cardBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.full, alignSelf: 'flex-start', marginTop: 4 },
    cardBadgeText: { fontSize: 10 },
    cardRight: { alignItems: 'flex-end', gap: Spacing.sm },
    date: { fontSize: FontSize.xs },
    exchangeBtn: { borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm },
    exchangeBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    sharedBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm },
    sharedBtnText: { fontSize: FontSize.xs },

    // Detail page
    detailHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    },
    backBtn: { padding: 4 },
    detailScroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 100 },
    visitingCard: {
      borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center',
      borderWidth: 1, gap: Spacing.sm,
    },
    visitingAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
    visitingAvatarPhoto: { width: 64, height: 64, borderRadius: 32, marginBottom: Spacing.sm },
    visitingAvatarText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
    visitingName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
    visitingBrand: { fontSize: FontSize.md },
    visitingDesig: { fontSize: FontSize.sm },
    visitingCity: { fontSize: FontSize.sm },
    detailCardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full, marginTop: Spacing.sm },
    detailCardBadgeText: { fontSize: FontSize.xs },
    scanNote: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 18, paddingHorizontal: Spacing.md },
    cardNotesBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderWidth: 1, borderRadius: Radius.full,
      paddingHorizontal: Spacing.sm, paddingVertical: 5,
      alignSelf: 'center', marginTop: Spacing.md,
    },
    cardNotesBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
    contactSection: { borderRadius: Radius.lg, overflow: 'hidden' },
    contactRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    contactFieldLabel: { fontSize: 10, fontWeight: FontWeight.medium, letterSpacing: 0.2, marginBottom: 1 },
    contactValue: { fontSize: FontSize.sm },
    scannedAt: { fontSize: FontSize.xs, textAlign: 'center' },

    whatsappBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, backgroundColor: '#25D366',
      paddingVertical: 14, borderRadius: Radius.md,
    },
    whatsappBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    bigExchangeBtn: { paddingVertical: 16, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1.5 },
    bigExchangeText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    linkedBrandSection: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      borderRadius: Radius.lg, padding: Spacing.md,
    },
    linkedBrandInitial: {
      width: 44, height: 44, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    linkedBrandInitialText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    linkedBrandInfo: { flex: 1 },
    linkedBrandLabel: { fontSize: FontSize.xs, marginBottom: 2 },
    linkedBrandName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    linkedBrandView: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    // Card image in detail
    detailCardImageRow: { flexDirection: 'row', gap: Spacing.sm },
    detailCardImageWrap: {
      flex: 1,
      borderRadius: Radius.lg, overflow: 'hidden', height: 140, backgroundColor: '#000',
    },
    detailCardImage: { width: '100%', height: '100%' },
    expandHint: {
      position: 'absolute', bottom: Spacing.sm, right: Spacing.sm,
      flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full,
    },
    expandHintText: { color: '#FFF', fontSize: 10 },
    lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    lightboxImage: { width: '92%', height: '55%', borderRadius: Radius.lg },
    lightboxClose: {
      position: 'absolute', top: 52, right: Spacing.lg,
      backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: 8,
    },

    // Empty state
    emptyState: { borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.xl, gap: Spacing.md },
    emptyIcon: { fontSize: 36 },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
    emptyBody: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    emptyCardBtn: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.lg, paddingVertical: 12, borderRadius: Radius.md, marginTop: Spacing.sm,
    },
    emptyCardBtnText: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

    // Grouped (C) design styles
    gTopRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    gThumbStack: { gap: 0, alignItems: 'flex-end' },
    gThumb: { width: 110, height: 68, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
    gThumbImg: { width: '100%', height: '100%' },
    gThumbLabel: { position: 'absolute', bottom: 4, right: 6, fontSize: 9, color: '#FFF', fontWeight: FontWeight.semibold, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
    gIdentity: { gap: 4, paddingBottom: Spacing.md },
    gProfileThumb: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden' },
    gProfileThumbImg: { width: '100%', height: '100%' },
    gName: { fontSize: 26, fontWeight: FontWeight.bold, letterSpacing: -0.3 },
    gCompany: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    gDesignation: { fontSize: FontSize.sm },
    gCityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    gCardBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.md, paddingVertical: 4,
      borderRadius: Radius.full, alignSelf: 'flex-start', marginTop: Spacing.sm,
    },
    gCardBadgeText: { fontSize: FontSize.xs },
    gSectionWrap: { gap: 6 },
    gSectionLabel: { fontSize: 10, fontWeight: FontWeight.semibold, letterSpacing: 1 },
    gSectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },
    gRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 13 },
    gRowLabel: { fontSize: 10, fontWeight: FontWeight.semibold, letterSpacing: 0.3, marginBottom: 1 },
    gRowValue: { fontSize: FontSize.sm },
    gDivider: { height: StyleSheet.hairlineWidth, marginLeft: 50 },
    gBrandLetter: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    gBrandLetterText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    gActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    gMutualBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: Radius.sm, alignSelf: 'flex-start' },
    gMutualBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
    slideTrack: { flex: 1, height: 52, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    slideThumb: { position: 'absolute', top: SLIDE_PAD, width: SLIDE_THUMB, height: SLIDE_THUMB, borderRadius: SLIDE_THUMB / 2, alignItems: 'center', justifyContent: 'center' },
    slideLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, letterSpacing: 0.2 },
    slideSuccess: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    gWaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: '#25D366' },
    quickActionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' },
    quickActionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full, borderWidth: 1 },
    quickActionText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    callSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8, paddingBottom: 32 },
    callSheetNumber: { fontSize: FontSize.xs, textAlign: 'center', paddingVertical: 12, letterSpacing: 0.3 },
    callSheetOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.xl, paddingVertical: 16 },
    callSheetOptionText: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
    callSheetCancel: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingVertical: 16, alignItems: 'center' },
    callSheetCancelText: { fontSize: FontSize.sm },
    gWaChipText: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    gExchangePill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: Radius.full, borderWidth: 1.5 },
    gExchangePillText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  });
}
