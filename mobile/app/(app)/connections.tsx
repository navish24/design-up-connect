import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ToastAndroid, Platform, Image, Modal,
} from 'react-native';
import { useState, useMemo } from 'react';
import { isBeta } from '../../lib/betaConfig';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import NotesModal from '../../components/NotesModal';
import type { Connection, CardContact } from '../../types';

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

type ActiveView =
  | { type: 'list' }
  | { type: 'nexgild_detail'; connection: Connection }
  | { type: 'card_detail'; contact: CardContact };

export default function ConnectionsScreen() {
  const { colors } = useTheme();
  const { demoConnectionsReset, demoAddedConnections, notes, addNote, cardContacts, deleteCardContact, updateCardContact } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'list' });
  const [mutualIds, setMutualIds] = useState<Set<string>>(new Set());
  const s = makeStyles(colors);

  const handleExchangeContact = (connId: string, userName: string) => {
    setMutualIds((prev) => new Set([...prev, connId]));
    Alert.alert('Contact Shared', `Your contact has been shared with ${userName}`);
  };

  // Compute full Nexgild connections list reactively from context
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

  const filteredConnections = allConnections.filter((c) => {
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

  const filteredCards = cardContacts.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const allValues = c.fields.map((f) => f.value.toLowerCase()).join(' ');
    return allValues.includes(q) || c.notes.toLowerCase().includes(q);
  });

  // ── Detail views ────────────────────────────────────────────────────────────

  if (activeView.type === 'nexgild_detail') {
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
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        {/* Scan Card shortcut */}
        <Pressable
          style={[s.scanCardBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.push('/(app)/scan?cardMode=1' as any)}
        >
          <Ionicons name="card-outline" size={15} color="#FFF" />
          <Text style={s.scanCardBtnText}>Scan Card</Text>
        </Pressable>
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

        {/* ── Nexgild connections section ── */}
        {filteredConnections.length > 0 && (
          <>
            <Text style={[s.sectionHeader, { color: colors.textMuted }]}>NEXGILD CONNECTIONS</Text>
            {filteredConnections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                colors={colors}
                onPress={() => setActiveView({ type: 'nexgild_detail', connection: conn })}
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
                ? 'Everyone you\'ve connected with appears here — scan a visiting card or a Nexgild QR to get started.'
                : 'Scan a QR code to connect with someone on Nexgild, or tap "Scan Card" to save a physical visiting card.'}
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
          {nameField?.value ?? 'Unknown'}
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
  const [showNotes, setShowNotes] = useState(false);
  const [expandedUri, setExpandedUri] = useState<string | null>(null);

  const nameField = contact.fields.find((f) => f.label === 'Name');
  const fieldsToShow = contact.fields.filter((f) => f.label !== 'Name');

  const handleDelete = () => {
    Alert.alert(
      'Delete Contact',
      `Remove ${nameField?.value ?? 'this contact'} from your card directory? The card image will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(contact.id) },
      ]
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={s.detailHeader}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        <Pressable onPress={handleDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.detailScroll}>

        {/* Card image(s) */}
        {contact.card_image_uri && (
          <View style={s.detailCardImageRow}>
            <Pressable onPress={() => setExpandedUri(contact.card_image_uri)} style={s.detailCardImageWrap}>
              <Image source={{ uri: contact.card_image_uri }} style={s.detailCardImage} resizeMode="contain" />
              <View style={[s.expandHint, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Ionicons name="expand-outline" size={12} color="#FFF" />
                <Text style={s.expandHintText}>Front</Text>
              </View>
            </Pressable>
            {contact.card_image_uri_back && (
              <Pressable onPress={() => setExpandedUri(contact.card_image_uri_back)} style={s.detailCardImageWrap}>
                <Image source={{ uri: contact.card_image_uri_back }} style={s.detailCardImage} resizeMode="contain" />
                <View style={[s.expandHint, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                  <Ionicons name="expand-outline" size={12} color="#FFF" />
                  <Text style={s.expandHintText}>Back</Text>
                </View>
              </Pressable>
            )}
          </View>
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

        {/* Name + notes CTA */}
        <View style={[s.visitingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.visitingAvatar, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[s.visitingAvatarText, { color: colors.textSecondary }]}>
              {nameField
                ? nameField.value.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                : '?'}
            </Text>
          </View>
          <Text style={[s.visitingName, { color: colors.text }]}>
            {nameField?.value ?? 'Unknown'}
          </Text>

          {/* Physical card badge */}
          <View style={[s.detailCardBadge, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="card-outline" size={11} color={colors.textMuted} />
            <Text style={[s.detailCardBadgeText, { color: colors.textMuted }]}>Physical visiting card</Text>
          </View>

          <Pressable
            style={[s.cardNotesBtn, { borderColor: colors.gold, backgroundColor: colors.background }]}
            onPress={() => setShowNotes(true)}
          >
            <Ionicons name="create-outline" size={13} color={colors.gold} />
            <Text style={[s.cardNotesBtnText, { color: colors.gold }]}>
              {notes.length > 0 ? `${notes.length} Note${notes.length > 1 ? 's' : ''}` : 'Notes'}
            </Text>
          </Pressable>

          {contact.notes.trim().length > 0 && (
            <Text style={[s.scanNote, { color: colors.textSecondary }]}>{contact.notes}</Text>
          )}
        </View>

        {/* All fields */}
        <View style={[s.contactSection, { backgroundColor: colors.surface }]}>
          {fieldsToShow.map((field, idx) => (
            <FieldDetailRow
              key={idx}
              field={field}
              colors={colors}
              isLast={idx === fieldsToShow.length - 1}
            />
          ))}
        </View>

        {/* Scanned at */}
        <Text style={[s.scannedAt, { color: colors.textMuted }]}>
          Scanned {new Date(contact.scanned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
      </ScrollView>

      <NotesModal
        visible={showNotes}
        onClose={() => setShowNotes(false)}
        entityName={nameField?.value ?? 'Contact'}
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

function FieldDetailRow({ field, colors, isLast }: { field: import('../../types').CardContactField; colors: any; isLast: boolean }) {
  const s = makeStyles(colors);
  const icon = FIELD_ICONS[field.label] ?? 'ellipsis-horizontal-outline';
  const isCopyable = ['Phone', 'WhatsApp', 'Email', 'Website', 'LinkedIn', 'Instagram', 'Twitter/X'].includes(field.label);

  return (
    <View style={[s.contactRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Ionicons name={icon as any} size={18} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[s.contactFieldLabel, { color: colors.textMuted }]}>{field.label}</Text>
        <Text style={[s.contactValue, { color: colors.text }]}>{field.value}</Text>
      </View>
      {isCopyable && (
        <Pressable onPress={() => copyToClipboard(field.value, field.label)} hitSlop={8}>
          <Ionicons name="copy-outline" size={16} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

// ── Nexgild connection components (unchanged from before) ─────────────────────

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

        <View style={[s.contactSection, { backgroundColor: colors.surface }]}>
          {user.email && <ContactRow icon="mail-outline" label="Email" value={user.email} colors={colors} />}
          {user.phone && <ContactRow icon="call-outline" label="Phone" value={user.phone} colors={colors} />}
          {user.linkedin_url && <ContactRow icon="logo-linkedin" label="LinkedIn" value={user.linkedin_url} colors={colors} clickable={false} />}
          {user.instagram_handle && <ContactRow icon="logo-instagram" label="Instagram" value={`@${user.instagram_handle}`} colors={colors} clickable={false} />}
          {user.website_url && <ContactRow icon="globe-outline" label="Website" value={user.website_url} colors={colors} />}
        </View>

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

function ContactRow({ icon, label, value, colors, clickable = true }: any) {
  const s = makeStyles(colors);
  return (
    <View style={[s.contactRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[s.contactFieldLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[s.contactValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      </View>
      {clickable && (
        <Pressable onPress={() => copyToClipboard(value, label)} hitSlop={8}>
          <Ionicons name="copy-outline" size={16} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm,
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
  });
}
