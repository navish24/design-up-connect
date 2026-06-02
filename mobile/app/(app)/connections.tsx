import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ToastAndroid, Platform, Image, Modal } from 'react-native';
import { useState, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import NotesModal from '../../components/NotesModal';
import type { Connection } from '../../types';

async function copyToClipboard(value: string, label: string) {
  await Clipboard.setStringAsync(value);
  if (Platform.OS === 'android') {
    ToastAndroid.show(`${label} copied`, ToastAndroid.SHORT);
  } else {
    Alert.alert('Copied', `${label} copied to clipboard`);
  }
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

export default function ConnectionsScreen() {
  const { colors } = useTheme();
  const { demoConnectionsReset, demoAddedConnections, notes, addNote } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Connection | null>(null);
  const [mutualIds, setMutualIds] = useState<Set<string>>(new Set());
  const s = makeStyles(colors);

  const handleExchangeContact = (connId: string, userName: string) => {
    setMutualIds((prev) => new Set([...prev, connId]));
    Alert.alert('Contact Shared', `Your contact has been shared with ${userName}`);
  };

  // Compute full connections list reactively from context
  const allConnections = useMemo<Connection[]>(() => {
    if (demoConnectionsReset) return [];
    const addedConns: Connection[] = (demoAddedConnections as any[]).map((person) => ({
      id: `demo-${person.id}`,
      user: {
        id: person.id,
        full_name: person.full_name,
        designup_user_id: person.id,
        designation: person.designation,
        company_name: person.company,
        email: person.email,
        phone: person.phone,
        city: person.city,
      },
      brand_name: person.company,
      brand_id: person.brand_id,
      connection_type: 'networking' as const,
      scope: 'personal' as const,
      is_mutual: false,
      to_contact_shared: true,
      from_contact_shared: false,
      created_at: new Date().toISOString(),
    }));
    const all = [...MOCK_CONNECTIONS, ...addedConns];
    return all.map((c) =>
      mutualIds.has(c.id) ? { ...c, is_mutual: true, from_contact_shared: true } : c
    );
  }, [demoConnectionsReset, demoAddedConnections, mutualIds]);

  const filtered = allConnections.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const connectionNotes = (notes[c.id] ?? []).map((n) => n.text).join(' ').toLowerCase();
    return (
      c.user.full_name.toLowerCase().includes(q) ||
      (c.brand_name || '').toLowerCase().includes(q) ||
      (c.user.designation || '').toLowerCase().includes(q) ||
      (c.user.city || '').toLowerCase().includes(q) ||
      connectionNotes.includes(q)
    );
  });

  // Contact detail page
  if (selected) {
    // Re-apply mutual state from current allConnections
    const currentConn = allConnections.find((c) => c.id === selected.id) ?? selected;
    return (
      <ContactDetailPage
        connection={currentConn}
        colors={colors}
        onBack={() => setSelected(null)}
        onExchange={(id, name) => { handleExchangeContact(id, name); setSelected(null); }}
        notes={notes[currentConn.id] ?? []}
        onAddNote={(text) => addNote(currentConn.id, text)}
        router={router}
      />
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
      </View>

      <View style={s.searchWrap}>
        <View style={[s.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            placeholder="Search by name, brand, role, city, notes"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {filtered.length === 0 ? (
          <View style={[s.emptyState, { backgroundColor: colors.surface }]}>
            <Text style={s.emptyIcon}>🤝</Text>
            <Text style={[s.emptyTitle, { color: colors.text }]}>No connections yet</Text>
            <Text style={[s.emptyBody, { color: colors.textSecondary }]}>
              Scan someone's personal QR code to exchange digital visiting cards.
            </Text>
          </View>
        ) : (
          filtered.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              colors={colors}
              onPress={() => setSelected(conn)}
              onExchange={(id, name) => handleExchangeContact(id, name)}
              notes={notes[conn.id] ?? []}
              search={search}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ConnectionCard({ connection, colors, onPress, onExchange, notes = [], search = '' }: {
  connection: Connection; colors: any; onPress: () => void;
  onExchange: (id: string, name: string) => void;
  notes?: import('../../context/AuthContext').Note[];
  search?: string;
}) {
  const s = makeStyles(colors);
  const { user } = connection;
  const date = new Date(connection.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  // Find a note snippet that matches the search query
  const q = search.toLowerCase();
  const matchedNote = q.length > 0
    ? notes.find((n) => n.text.toLowerCase().includes(q))
    : null;

  return (
    <Pressable style={[s.card, { backgroundColor: colors.surface }]} onPress={onPress}>
      {/* Avatar */}
      {user.profile_image_url ? (
        <Image source={{ uri: user.profile_image_url }} style={s.avatarPhoto} />
      ) : (
        <View style={[s.avatar, { backgroundColor: '#E8EAE6' }]}>
          <Text style={[s.avatarText, { color: '#6B7280' }]}>
            {user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Info */}
      <View style={s.cardInfo}>
        <Text style={[s.userName, { color: colors.text }]}>{user.full_name}</Text>
        {connection.brand_name && (
          <Text style={[s.brandName, { color: colors.textSecondary }]}>{connection.brand_name}</Text>
        )}
        {user.designation && (
          <Text style={[s.designation, { color: colors.textMuted }]}>{user.designation}</Text>
        )}
        {matchedNote && (
          <View style={[s.noteSnippetRow, { backgroundColor: colors.accent + '12' }]}>
            <Ionicons name="create-outline" size={10} color={colors.accent} />
            <Text style={[s.noteSnippet, { color: colors.accent }]} numberOfLines={1}>
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

      {/* Date + Exchange CTA */}
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
  const { user } = connection;
  const [showNotes, setShowNotes] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.detailHeader}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={s.detailScroll}>
        {/* Expanded photo lightbox */}
        {photoExpanded && user.profile_image_url && (
          <Modal transparent animationType="fade" onRequestClose={() => setPhotoExpanded(false)}>
            <Pressable style={s.photoLightboxOverlay} onPress={() => setPhotoExpanded(false)}>
              <Image source={{ uri: user.profile_image_url }} style={s.photoLightboxImg} resizeMode="contain" />
              <Pressable style={s.photoLightboxClose} onPress={() => setPhotoExpanded(false)}>
                <Ionicons name="close" size={22} color="#FFF" />
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {/* Visiting card preview */}
        <View style={[s.visitingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {user.profile_image_url ? (
            <Pressable onPress={() => setPhotoExpanded(true)}>
              <Image source={{ uri: user.profile_image_url }} style={s.visitingAvatarPhoto} />
            </Pressable>
          ) : (
            <View style={[s.visitingAvatar, { backgroundColor: '#E8EAE6' }]}>
              <Text style={[s.visitingAvatarText, { color: '#6B7280' }]}>
                {user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[s.visitingName, { color: colors.text }]}>{user.full_name}</Text>
          {connection.brand_name && (
            <Text style={[s.visitingBrand, { color: colors.textMuted }]}>{connection.brand_name}</Text>
          )}
          {user.designation && (
            <Text style={[s.visitingDesig, { color: colors.textSecondary }]}>{user.designation}</Text>
          )}
          {user.city && (
            <Text style={[s.visitingCity, { color: colors.textMuted }]}>{user.city}</Text>
          )}
          {/* Notes CTA — oval pill, same as brand page */}
          <Pressable
            style={[s.cardNotesBtn, { borderColor: colors.gold, backgroundColor: colors.background }]}
            onPress={() => setShowNotes(true)}
          >
            <Ionicons name="create-outline" size={13} color={colors.gold} />
            <Text style={[s.cardNotesBtnText, { color: colors.gold }]}>
              {notes.length > 0 ? `${notes.length} Note${notes.length > 1 ? 's' : ''}` : 'Notes'}
            </Text>
          </Pressable>
        </View>

        {/* Contact details */}
        <View style={[s.contactSection, { backgroundColor: colors.surface }]}>
          {user.email && (
            <ContactRow icon="mail-outline" value={user.email} colors={colors} />
          )}
          {user.phone && (
            <ContactRow icon="call-outline" value={user.phone} colors={colors} />
          )}
          {user.linkedin_url && (
            <ContactRow icon="logo-linkedin" value={user.linkedin_url} colors={colors} clickable={false} />
          )}
          {user.instagram_handle && (
            <ContactRow icon="logo-instagram" value={`@${user.instagram_handle}`} colors={colors} clickable={false} />
          )}
          {user.website_url && (
            <ContactRow icon="globe-outline" value={user.website_url} colors={colors} />
          )}
        </View>

        {/* Brand on Designup section — only shown if contact has a linked brand */}
        {connection.brand_id && connection.brand_name && (
          <Pressable
            style={[s.linkedBrandSection, { backgroundColor: colors.surface }]}
            onPress={() => router.push(`/brand/${connection.brand_id}` as any)}
          >
            <View style={[s.linkedBrandInitial, { backgroundColor: colors.accent + '22' }]}>
              <Text style={[s.linkedBrandInitialText, { color: colors.accent }]}>
                {connection.brand_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={s.linkedBrandInfo}>
              <Text style={[s.linkedBrandLabel, { color: colors.textMuted }]}>Represents</Text>
              <Text style={[s.linkedBrandName, { color: colors.text }]}>{connection.brand_name}</Text>
            </View>
            <Text style={[s.linkedBrandView, { color: colors.accent }]}>View →</Text>
          </Pressable>
        )}

        {!connection.is_mutual && (
          <Pressable
            style={[s.bigExchangeBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
            onPress={() => onExchange(connection.id, connection.user.full_name)}
          >
            <Text style={[s.bigExchangeText, { color: '#FFF' }]}>Exchange Contact</Text>
          </Pressable>
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

function ContactRow({ icon, value, colors, clickable = true }: any) {
  const s = makeStyles(colors);
  return (
    <View style={s.contactRow}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={[s.contactValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      {clickable && (
        <Pressable onPress={() => copyToClipboard(value, 'Contact')}>
          <Ionicons name="copy-outline" size={16} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    searchWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44,
    },
    searchInput: { flex: 1, fontSize: FontSize.md },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },

    card: {
      flexDirection: 'row', borderRadius: Radius.lg, padding: Spacing.md,
      marginBottom: Spacing.md, gap: Spacing.md, alignItems: 'flex-start',
    },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarPhoto: { width: 44, height: 44, borderRadius: 22 },
    avatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    cardInfo: { flex: 1, gap: 3 },
    userName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    brandName: { fontSize: FontSize.sm },
    designation: { fontSize: FontSize.xs },
    noteSnippetRow: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start', maxWidth: '100%' },
    noteSnippet: { fontSize: 10, fontWeight: FontWeight.medium, flexShrink: 1 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, alignSelf: 'flex-start', marginTop: 4 },
    statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    cardRight: { alignItems: 'flex-end', gap: Spacing.sm },
    date: { fontSize: FontSize.xs },
    exchangeBtn: { borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm },
    exchangeBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    sharedBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm },
    sharedBtnText: { fontSize: FontSize.xs },

    // Detail page
    detailHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
    },
    backBtn: { padding: 4 },
    detailScroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 100 },
    visitingCard: {
      borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center',
      borderWidth: 1, gap: Spacing.sm,
    },
    visitingAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
    visitingAvatarPhoto: { width: 64, height: 64, borderRadius: 32, marginBottom: Spacing.sm },
    photoLightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
    photoLightboxImg: { width: 280, height: 280, borderRadius: Radius.lg },
    photoLightboxClose: { position: 'absolute', top: 52, right: Spacing.lg, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 6 },
    visitingAvatarText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
    visitingName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
    visitingBrand: { fontSize: FontSize.md },
    visitingDesig: { fontSize: FontSize.sm },
    visitingCity: { fontSize: FontSize.sm },
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
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    contactValue: { flex: 1, fontSize: FontSize.sm },
    bigExchangeBtn: { paddingVertical: 16, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1.5 },
    bigExchangeText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    // Brand on Designup section
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

    emptyState: { borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.xl },
    emptyIcon: { fontSize: 36, marginBottom: Spacing.sm },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.sm },
    emptyBody: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  });
}
