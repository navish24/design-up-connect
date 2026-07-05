import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ToastAndroid, Platform, Image, Modal, Linking,
} from 'react-native';
import { useState, useMemo, Fragment, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isBeta } from '../../lib/betaConfig';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import NotesModal from '../../components/NotesModal';
import { Analytics } from '../../lib/analytics';
import type { Connection, CardContact } from '../../types';

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
    (globalThis as any).window?.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, '');
  Analytics.contactIconTapped('whatsapp');
  openExternal(`https://wa.me/${digits}`);
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

type SortType = 'newest' | 'oldest' | 'az';
const SORT_CYCLE: Record<SortType, SortType> = { newest: 'oldest', oldest: 'az', az: 'newest' };
const SORT_LABEL: Record<SortType, string> = { newest: 'Newest', oldest: 'Oldest', az: 'A → Z' };
const SORT_ICON: Record<SortType, string> = { newest: 'arrow-down-outline', oldest: 'arrow-up-outline', az: 'text-outline' };

type ActiveView =
  | { type: 'list' }
  | { type: 'connect_detail'; connection: Connection }
  | { type: 'card_detail'; contact: CardContact };

export default function ConnectionsScreen() {
  const { colors } = useTheme();
  const { demoConnectionsReset, demoAddedConnections, notes, addNote, cardContacts, deleteCardContact, updateCardContact, user } = useAuth();
  const router = useRouter();
  const { top: topInset } = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'cards' | 'connections' | 'notes'>('all');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'list' });
  const [mutualIds, setMutualIds] = useState<Set<string>>(new Set());
  const exchangingRef = useRef<Set<string>>(new Set());

  // Reset to list whenever the Connects tab gains focus (handles both tab switching
  // and tapping the Connects icon while already on it)
  useFocusEffect(
    useCallback(() => {
      setActiveView({ type: 'list' });
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
          full_name: person.full_name,
          designup_user_id: person.designup_user_id ?? person.id,
          designation: person.designation,
          company_name: person.company_name ?? person.company,
          email: person.email,
          phone: person.phone,
          city: person.city,
        },
        brand_name: person.company_name ?? person.company,
        brand_id: person.brand_id,
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

  const cycleSortType = () => setSortType((cur) => SORT_CYCLE[cur]);

  const filteredConnections = useMemo(() => {
    if (filterType === 'cards') return [];
    const q = search.toLowerCase();
    let list = allConnections.filter((c) => {
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
    if (sortType === 'newest') list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortType === 'oldest') list = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortType === 'az') list = [...list].sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));
    return list;
  }, [allConnections, search, notes, filterType, sortType]);

  const filteredCards = useMemo(() => {
    if (filterType === 'connections') return [];
    const q = search.toLowerCase();
    let list = cardContacts.filter((c) => {
      if (q) {
        const allValues = c.fields.map((f) => f.value.toLowerCase()).join(' ');
        const modalNotes = (notes[c.id] ?? []).map((n) => n.text).join(' ').toLowerCase();
        if (!allValues.includes(q) && !c.notes.toLowerCase().includes(q) && !modalNotes.includes(q)) return false;
      }
      if (filterType === 'notes') return c.notes.trim().length > 0 || (notes[c.id] ?? []).length > 0;
      return true;
    });
    if (sortType === 'newest') list = [...list].sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime());
    else if (sortType === 'oldest') list = [...list].sort((a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime());
    else if (sortType === 'az') list = [...list].sort((a, b) => getCardDisplayName(a.fields).localeCompare(getCardDisplayName(b.fields)));
    return list;
  }, [cardContacts, search, notes, filterType, sortType]);

  // ── Detail views ────────────────────────────────────────────────────────────

  if (activeView.type === 'connect_detail') {
    const currentConn = allConnections.find((c) => c.id === activeView.connection.id) ?? activeView.connection;
    return (
      <ContactDetailPage
        connection={currentConn}
        colors={colors}
        onBack={() => setActiveView({ type: 'list' })}
        onExchange={(id, name) => { handleExchangeContact(id, name); setActiveView({ type: 'list' }); }}
        notes={notes[currentConn.id] ?? []}
        onAddNote={(text) => addNote(currentConn.id, text)}
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
        onDelete={(id) => { deleteCardContact(id); setActiveView({ type: 'list' }); }}
        onUpdate={updateCardContact}
        notes={notes[activeView.contact.id] ?? []}
        onAddNote={(text) => addNote(activeView.contact.id, text)}
      />
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topInset + 12 }]}>
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

      {/* Filter + Sort bar */}
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChips}>
          {(['all', 'cards', 'connections', 'notes'] as const).map((f) => {
            const labels = { all: 'All', cards: 'Cards', connections: 'Connects', notes: 'Has Notes' };
            const active = filterType === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilterType(f)}
                style={[s.filterChip, {
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                }]}
              >
                <Text style={[s.filterChipText, { color: active ? '#FFF' : colors.textSecondary }]}>
                  {labels[f]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          onPress={cycleSortType}
          style={[s.sortPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name={SORT_ICON[sortType] as any} size={12} color={colors.textSecondary} />
          <Text style={[s.sortPillText, { color: colors.textSecondary }]}>{SORT_LABEL[sortType]}</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Connections section ── */}
        {filteredConnections.length > 0 && (
          <>
            <Text style={[s.sectionHeader, { color: colors.textMuted }]}>CONNECTIONS</Text>
            {filteredConnections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                colors={colors}
                onPress={() => setActiveView({ type: 'connect_detail', connection: conn })}
                onExchange={(id, name) => handleExchangeContact(id, name)}
                notes={notes[conn.id] ?? []}
                search={search}
              />
            ))}
          </>
        )}

        {/* ── Physical card contacts section ── */}
        {filteredCards.length > 0 && (
          <>
            <Text style={[s.sectionHeader, { color: colors.textMuted, marginTop: Spacing.lg }]}>
              PHYSICAL CARDS
            </Text>
            {filteredCards.map((card) => (
              <CardContactCard
                key={card.id}
                contact={card}
                colors={colors}
                onPress={() => setActiveView({ type: 'card_detail', contact: card })}
                search={search}
              />
            ))}
          </>
        )}

        {/* ── Empty state ── */}
        {filteredConnections.length === 0 && filteredCards.length === 0 && (
          <View style={[s.emptyState, { backgroundColor: colors.surface }]}>
            <Text style={s.emptyIcon}>🤝</Text>
            <Text style={[s.emptyTitle, { color: colors.text }]}>No connections yet</Text>
            <Text style={[s.emptyBody, { color: colors.textSecondary }]}>
              {isBeta
                ? 'Everyone you\'ve connected with appears here — scan a visiting card or a Connect QR to get started.'
                : 'Scan a QR code to connect with someone on Connect, or tap "Scan Card" to save a physical visiting card.'}
            </Text>
            <Pressable
              style={[s.emptyCardBtn, { backgroundColor: colors.accent }]}
              onPress={() => router.push('/(app)/scan?cardMode=1' as any)}
            >
              <Ionicons name="card-outline" size={16} color="#FFF" />
              <Text style={s.emptyCardBtnText}>Scan a Visiting Card</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Card contact list card ────────────────────────────────────────────────────

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
    <Pressable style={[s.card, { backgroundColor: colors.surface }]} onPress={onPress}>
      {/* Avatar or card thumbnail */}
      {contact.card_image_uri ? (
        <Image source={{ uri: contact.card_image_uri }} style={s.cardThumb} resizeMode="cover" />
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
        {/* Physical card badge */}
        <View style={[s.cardBadge, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="card-outline" size={10} color={colors.textMuted} />
          <Text style={[s.cardBadgeText, { color: colors.textMuted }]}>Physical card</Text>
        </View>
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
  const { top: topInset } = useSafeAreaInsets();
  const [showNotes, setShowNotes] = useState(false);
  const [expandedUri, setExpandedUri] = useState<string | null>(null);

  const company = contact.fields.find((f) => f.label === 'Company')?.value;
  const name = getCardDisplayName(contact.fields);
  const designation = contact.fields.find((f) => f.label === 'Designation')?.value;

  const contactFields = contact.fields.filter((f) => CONTACT_LABELS_SET.has(f.label));
  const onlineFields = contact.fields.filter((f) => ONLINE_LABELS_SET.has(f.label));
  const locationFields = contact.fields.filter((f) => LOCATION_LABELS_SET.has(f.label));
  const otherFields = contact.fields.filter(
    (f) => !IDENTITY_LABELS.has(f.label) && !CONTACT_LABELS_SET.has(f.label) &&
            !ONLINE_LABELS_SET.has(f.label) && !LOCATION_LABELS_SET.has(f.label)
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
      <View style={[s.detailHeader, { paddingTop: topInset + 12 }]}>
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
            <View style={[s.gCardBadge, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="card-outline" size={11} color={colors.textMuted} />
              <Text style={[s.gCardBadgeText, { color: colors.textMuted }]}>Physical visiting card</Text>
            </View>
          </View>
          {contact.card_image_uri && (
            <View style={s.gThumbStack}>
              <Pressable onPress={() => setExpandedUri(contact.card_image_uri)} style={s.gThumb}>
                <Image source={{ uri: contact.card_image_uri! }} style={s.gThumbImg} resizeMode="cover" />
                <Text style={s.gThumbLabel}>Front</Text>
              </Pressable>
              {contact.card_image_uri_back && (
                <Pressable onPress={() => setExpandedUri(contact.card_image_uri_back)} style={[s.gThumb, { marginTop: -18 }]}>
                  <Image source={{ uri: contact.card_image_uri_back! }} style={s.gThumbImg} resizeMode="cover" />
                  <Text style={s.gThumbLabel}>Back</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

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

        <Text style={[s.scannedAt, { color: colors.textMuted }]}>
          Scanned {new Date(contact.scanned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
      </ScrollView>

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
  Other: 'ellipsis-horizontal-outline',
};

const LINKABLE_FIELDS = new Set(['Website', 'Instagram', 'LinkedIn']);

function FieldDetailRow({ field, colors, isLast }: { field: import('../../types').CardContactField; colors: any; isLast: boolean }) {
  const s = makeStyles(colors);
  const icon = FIELD_ICONS[field.label] ?? 'ellipsis-horizontal-outline';
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
  const icon = FIELD_ICONS[field.label] ?? 'ellipsis-horizontal-outline';
  const isPhone = field.label === 'Phone' || field.label === 'WhatsApp';
  const isLinkable = ONLINE_LABELS_SET.has(field.label) && field.label !== 'Social Handle';
  const isCopyable = CONTACT_LABELS_SET.has(field.label);
  const multiLine = field.label === 'Address' || field.label === 'Other';

  return (
    <View style={[s.gRow, multiLine && { alignItems: 'flex-start' }]}>
      <Ionicons name={icon as any} size={18} color={colors.textSecondary} style={multiLine ? { marginTop: 2 } : undefined} />
      <View style={{ flex: 1 }}>
        <Text style={[s.gRowLabel, { color: colors.textMuted }]}>{field.label}</Text>
        <Text style={[s.gRowValue, { color: colors.text }]} numberOfLines={multiLine ? 5 : 1}>{field.value}</Text>
      </View>
      {isPhone && (
        <Pressable onPress={() => openWhatsApp(field.value)} hitSlop={8}>
          <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
        </Pressable>
      )}
      {isLinkable && (
        <Pressable onPress={() => openLink(field.label, field.value)} hitSlop={8} style={isPhone ? { marginLeft: 10 } : undefined}>
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
    <Pressable style={[s.card, { backgroundColor: colors.surface }]} onPress={onPress}>
      {user.profile_image_url ? (
        <Image source={{ uri: user.profile_image_url }} style={s.avatarPhoto} />
      ) : (
        <View style={[s.avatar, { backgroundColor: '#E8EAE6' }]}>
          <Text style={[s.avatarText, { color: '#6B7280' }]}>
            {user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}

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
        <View style={[s.statusBadge, {
          backgroundColor: connection.is_mutual ? colors.accent + '22' : colors.surfaceElevated,
        }]}>
          <Text style={[s.statusText, {
            color: connection.is_mutual ? colors.accent : colors.textMuted,
          }]}>
            {connection.is_mutual ? 'Mutual' : 'One-way'}
          </Text>
        </View>
      </View>

      <View style={s.cardRight}>
        <Text style={[s.date, { color: colors.textMuted }]}>{date}</Text>
        {!connection.is_mutual && (
          <Pressable
            style={[s.exchangeBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
            onPress={(e) => { e.stopPropagation(); onExchange(connection.id, connection.user.full_name); }}
          >
            <Text style={[s.exchangeBtnText, { color: '#FFF' }]}>Exchange Contact</Text>
          </Pressable>
        )}
        {connection.is_mutual && (
          <View style={[s.sharedBtn, { backgroundColor: colors.surface }]}>
            <Text style={[s.sharedBtnText, { color: colors.textMuted }]}>Contact Shared</Text>
          </View>
        )}
      </View>
    </Pressable>
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
  const { top: topInset } = useSafeAreaInsets();
  const { user } = connection;
  const [showNotes, setShowNotes] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.detailHeader, { paddingTop: topInset + 12 }]}>
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
        <View style={s.gIdentity}>
          {user.profile_image_url && (
            <Pressable onPress={() => setPhotoExpanded(true)} style={s.gProfileThumb}>
              <Image source={{ uri: user.profile_image_url }} style={s.gProfileThumbImg} />
            </Pressable>
          )}
          <Text style={[s.gName, { color: colors.text }]}>{user.full_name}</Text>
          {connection.brand_name && (
            <Text style={[s.gCompany, { color: colors.accent }]}>{connection.brand_name}</Text>
          )}
          {user.designation && (
            <Text style={[s.gDesignation, { color: colors.textMuted }]}>{user.designation}</Text>
          )}
          {user.city && (
            <View style={s.gCityRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={[s.gDesignation, { color: colors.textMuted }]}>{user.city}</Text>
            </View>
          )}
        </View>

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
                <Pressable onPress={() => openWhatsApp(user.phone!)} hitSlop={8}>
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                </Pressable>
                <CopyButton value={user.phone!} label="Phone" size={15} style={{ marginLeft: 10 }} />
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
              <Ionicons name="create-outline" size={18} color={notes.length > 0 ? colors.gold : colors.textMuted} />
              <Text style={[s.gRowValue, { flex: 1, color: notes.length > 0 ? colors.text : colors.textMuted }]}>
                {notes.length > 0 ? `${notes.length} note${notes.length > 1 ? 's' : ''}` : 'Add a note'}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </View>
          </Pressable>
        </View>

        {/* Exchange Contact pill */}
        {!connection.is_mutual && (
          <View style={s.gActions}>
            <Pressable
              style={[s.gExchangePill, { borderColor: colors.accent }]}
              onPress={() => { Analytics.exchangeContactTapped('detail'); onExchange(connection.id, connection.user.full_name); }}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color={colors.accent} />
              <Text style={[s.gExchangePillText, { color: colors.accent }]}>Exchange Contact</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

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
    filterChips: { flexDirection: 'row', gap: Spacing.sm },
    filterChip: {
      paddingHorizontal: Spacing.md, paddingVertical: 6,
      borderRadius: Radius.full, borderWidth: 1,
    },
    filterChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    sortPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.sm, paddingVertical: 6,
      borderRadius: Radius.full, borderWidth: 1,
    },
    sortPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    sectionHeader: {
      fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
      letterSpacing: 0.5, marginBottom: Spacing.sm,
    },

    // Connection / card list card
    card: {
      flexDirection: 'row', borderRadius: Radius.lg, padding: Spacing.md,
      marginBottom: Spacing.md, gap: Spacing.md, alignItems: 'flex-start',
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
    gProfileThumb: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', marginBottom: Spacing.sm },
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
    gWaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: '#25D366' },
    gWaChipText: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    gExchangePill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: Radius.full, borderWidth: 1.5 },
    gExchangePillText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  });
}
