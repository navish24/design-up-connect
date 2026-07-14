import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Linking,
  Platform, ToastAndroid, Alert, Image, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import * as Clipboard from 'expo-clipboard';
import NotesModal from '../components/NotesModal';
import type { CardContact } from '../types';
import type { Note } from '../context/AuthContext';

// Mock QR connection data (mirrors Connection type)
const MOCK_QR = {
  id: '__mock_conn__',
  user: {
    full_name: 'Meera Nair',
    designation: 'Creative Director',
    company_name: 'Bloom Art Studio',
    city: 'Bangalore',
    email: 'meera@bloomart.in',
    phone: '+91 54321 09876',
    instagram_handle: 'meeranair.art',
    website_url: 'bloomartstudio.in',
    linkedin_url: undefined as string | undefined,
    profile_image_url: undefined as string | undefined,
  },
  brand_name: 'Bloom Art Studio',
  brand_id: 'b01',
  is_mutual: false,
};
type QR = typeof MOCK_QR;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function copy(value: string) {
  await Clipboard.setStringAsync(value);
  if (Platform.OS === 'android') ToastAndroid.show('Copied', ToastAndroid.SHORT);
  else Alert.alert('Copied', value);
}
function openLink(url: string) {
  Linking.openURL(url.startsWith('http') ? url : `https://${url}`).catch(() => {});
}
function openWA(phone: string) {
  Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}`).catch(() => {});
}

// Derive display fields from a CardContact
function derive(c: CardContact) {
  const get = (label: string) => c.fields.find((f) => f.label === label)?.value ?? '';
  const name = get('Name') || 'Unknown';
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return {
    id: c.id,
    name, initials,
    company: get('Company'),
    designation: get('Designation'),
    phone: get('Phone') || get('WhatsApp'),
    website: get('Website'),
    instagram: get('Instagram'),
    facebook: get('Facebook'),
    email: get('Email'),
    address: get('Address'),
    scanNotes: c.notes,
    imageUri: c.card_image_uri,
    imageUriBack: c.card_image_uri_back,
    scannedAt: new Date(c.scanned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

// Fallback mock (no real cards saved yet)
const MOCK: ReturnType<typeof derive> = {
  id: '__mock__',
  name: 'Tania Misra', initials: 'TM',
  company: 'Padme Hum Studio India', designation: 'Creative Director',
  phone: '+91 95 4042 2678', website: 'www.padmehumstudioindia.com',
  instagram: '@padmehumstudioindia', facebook: 'padmehumstudioindia',
  email: '', address: 'B-105, 2nd Floor, Chittaranjan Park, New Delhi, 110019',
  scanNotes: 'Met at design expo — interested in collab',
  imageUri: null, imageUriBack: null,
  scannedAt: 'June 24, 2026',
};

// ── Main screen ───────────────────────────────────────────────────────────────

const VARIANTS = ['A', 'B', 'C'] as const;
type Variant = typeof VARIANTS[number];
type ContactType = 'card' | 'qr';

export default function CardUITest() {
  const { colors } = useTheme();
  const { cardContacts, notes, addNote } = useAuth();
  const router = useRouter();
  const [contactType, setContactType] = useState<ContactType>('card');
  const [active, setActive] = useState<Variant>('A');
  const [cardIdx, setCardIdx] = useState(0);
  const [mockNotes, setMockNotes] = useState<Note[]>([]);
  const [mockQrNotes, setMockQrNotes] = useState<Note[]>([]);

  // Card contact data
  const usingReal = cardContacts.length > 0;
  const cards = usingReal ? cardContacts.map(derive) : [MOCK];
  const card = cards[Math.min(cardIdx, cards.length - 1)];
  const hasMultiple = cards.length > 1;
  const cardNotes: Note[] = usingReal ? (notes[card.id] ?? []) : mockNotes;
  const handleAddNote = (text: string) => {
    if (usingReal) addNote(card.id, text);
    else setMockNotes((n) => [...n, { id: Date.now().toString(), text, created_at: new Date().toISOString() }]);
  };

  // QR contact — always uses mock for now (no real Connection in state)
  const handleAddQrNote = (text: string) =>
    setMockQrNotes((n) => [...n, { id: Date.now().toString(), text, created_at: new Date().toISOString() }]);

  const variantLabel = (v: Variant) =>
    v === 'A' ? 'A — Compact' : v === 'B' ? 'B — Bold' : 'C — Grouped';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>UI Preview</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Contact type switcher */}
      <View style={[styles.typeSwitcher, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['card', 'qr'] as ContactType[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.typeTab, contactType === t && { backgroundColor: colors.accent }]}
            onPress={() => setContactType(t)}
          >
            <Ionicons
              name={t === 'card' ? 'card-outline' : 'qr-code-outline'}
              size={14}
              color={contactType === t ? '#FFF' : colors.textMuted}
            />
            <Text style={[styles.typeTabLabel, { color: contactType === t ? '#FFF' : colors.textMuted }]}>
              {t === 'card' ? 'Scanned Card' : 'QR Contact'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Card picker (card mode only) */}
      {contactType === 'card' && hasMultiple && (
        <View style={[styles.picker, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable disabled={cardIdx === 0} onPress={() => setCardIdx((i) => i - 1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={cardIdx === 0 ? colors.border : colors.text} />
          </Pressable>
          <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
            {card.name} ({cardIdx + 1}/{cards.length})
          </Text>
          <Pressable disabled={cardIdx === cards.length - 1} onPress={() => setCardIdx((i) => i + 1)} hitSlop={8}>
            <Ionicons name="chevron-forward" size={18} color={cardIdx === cards.length - 1 ? colors.border : colors.text} />
          </Pressable>
        </View>
      )}

      {/* Variant tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {VARIANTS.map((v) => (
          <Pressable
            key={v}
            style={[styles.tab, active === v && { backgroundColor: colors.accent }]}
            onPress={() => setActive(v)}
          >
            <Text style={[styles.tabLabel, { color: active === v ? '#FFF' : colors.textMuted }]}>
              {variantLabel(v)}
            </Text>
          </Pressable>
        ))}
      </View>

      {contactType === 'card' && active === 'A' && <VariantA card={card} colors={colors} cardNotes={cardNotes} onAddNote={handleAddNote} />}
      {contactType === 'card' && active === 'B' && <VariantB card={card} colors={colors} cardNotes={cardNotes} onAddNote={handleAddNote} />}
      {contactType === 'card' && active === 'C' && <VariantC card={card} colors={colors} cardNotes={cardNotes} onAddNote={handleAddNote} />}

      {contactType === 'qr' && active === 'A' && <QRVariantA conn={MOCK_QR} colors={colors} connNotes={mockQrNotes} onAddNote={handleAddQrNote} />}
      {contactType === 'qr' && active === 'B' && <QRVariantB conn={MOCK_QR} colors={colors} connNotes={mockQrNotes} onAddNote={handleAddQrNote} />}
      {contactType === 'qr' && active === 'C' && <QRVariantC conn={MOCK_QR} colors={colors} connNotes={mockQrNotes} onAddNote={handleAddQrNote} />}
    </View>
  );
}

type D = ReturnType<typeof derive>;

// ── Variant A — "Focused" ─────────────────────────────────────────────────────
// Card photo strips at top (tapable to expand). Avatar circle below if no photo.
// Three action chips. Then plain icon+value rows.

function VariantA({ card, colors, cardNotes, onAddNote }: { card: D; colors: any; cardNotes: Note[]; onAddNote: (t: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notesVisible, setNotesVisible] = useState(false);
  const hasImage = !!card.imageUri;

  return (
    <ScrollView contentContainerStyle={[stylesA.scroll, { paddingBottom: 60 }]}>
      {/* Card photo strip */}
      {hasImage && (
        <View style={stylesA.imageStrip}>
          <Pressable style={stylesA.imageWrap} onPress={() => setExpanded(card.imageUri!)}>
            <Image source={{ uri: card.imageUri! }} style={stylesA.image} resizeMode="cover" />
            <View style={stylesA.expandBadge}>
              <Ionicons name="expand-outline" size={12} color="#FFF" />
              <Text style={stylesA.expandText}>Front</Text>
            </View>
          </Pressable>
          {card.imageUriBack && (
            <Pressable style={stylesA.imageWrap} onPress={() => setExpanded(card.imageUriBack!)}>
              <Image source={{ uri: card.imageUriBack! }} style={stylesA.image} resizeMode="cover" />
              <View style={stylesA.expandBadge}>
                <Ionicons name="expand-outline" size={12} color="#FFF" />
                <Text style={stylesA.expandText}>Back</Text>
              </View>
            </Pressable>
          )}
        </View>
      )}

      {/* Hero: avatar (always shown even with photo for identity) + name */}
      <View style={[stylesA.hero, { backgroundColor: colors.surface }]}>
        <View style={[stylesA.avatar, { backgroundColor: colors.accent + '22' }]}>
          <Text style={[stylesA.avatarText, { color: colors.accent }]}>{card.initials}</Text>
        </View>
        <Text style={[stylesA.name, { color: colors.text }]}>{card.name}</Text>
        {card.designation ? <Text style={[stylesA.designation, { color: colors.textSecondary }]}>{card.designation}</Text> : null}
        {card.company ? <Text style={[stylesA.company, { color: colors.textMuted }]}>{card.company}</Text> : null}

        <View style={stylesA.actions}>
          {card.phone ? (
            <Pressable style={[stylesA.actionBtn, { backgroundColor: '#25D366' }]} onPress={() => openWA(card.phone)}>
              <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
              <Text style={stylesA.actionLabel}>WhatsApp</Text>
            </Pressable>
          ) : null}
          {card.phone ? (
            <Pressable style={[stylesA.actionBtn, { backgroundColor: colors.accent }]} onPress={() => copy(card.phone)}>
              <Ionicons name="call-outline" size={18} color="#FFF" />
              <Text style={stylesA.actionLabel}>Call</Text>
            </Pressable>
          ) : null}
          {card.website ? (
            <Pressable style={[stylesA.actionBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => openLink(card.website)}>
              <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
              <Text style={[stylesA.actionLabel, { color: colors.textSecondary }]}>Website</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Contact rows */}
      <View style={[stylesA.section, { backgroundColor: colors.surface }]}>
        {[
          card.phone && { icon: 'call-outline', value: card.phone, link: false, onPress: () => copy(card.phone) },
          card.email && { icon: 'mail-outline', value: card.email, link: false, onPress: () => copy(card.email) },
          card.website && { icon: 'globe-outline', value: card.website, link: true, onPress: () => openLink(card.website) },
          card.instagram && { icon: 'logo-instagram', value: card.instagram, link: true, onPress: () => openLink(`https://instagram.com/${card.instagram.replace('@', '')}`) },
          card.facebook && { icon: 'logo-facebook', value: card.facebook, link: true, onPress: () => openLink(`https://facebook.com/${card.facebook}`) },
        ].filter(Boolean).map((r: any, i, arr) => (
          <React.Fragment key={i}>
            <ARow icon={r.icon} value={r.value} link={r.link} colors={colors} onPress={r.onPress} />
            {i < arr.length - 1 && <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 54 }]} />}
          </React.Fragment>
        ))}
      </View>

      {card.address ? (
        <View style={[stylesA.section, { backgroundColor: colors.surface }]}>
          <View style={stylesA.addrRow}>
            <Ionicons name="location-outline" size={18} color={colors.textMuted} />
            <Text style={[stylesA.addrText, { color: colors.textSecondary }]}>{card.address}</Text>
          </View>
        </View>
      ) : null}

      {/* Scan-time note (read-only) */}
      {card.scanNotes ? (
        <View style={[stylesA.section, { backgroundColor: colors.surface }]}>
          <View style={stylesA.addrRow}>
            <Ionicons name="create-outline" size={18} color={colors.gold} />
            <Text style={[stylesA.addrText, { color: colors.textSecondary }]}>{card.scanNotes}</Text>
          </View>
        </View>
      ) : null}

      {/* Notes button */}
      <Pressable style={[stylesA.notesBtn, { backgroundColor: colors.surface }]} onPress={() => setNotesVisible(true)}>
        <Ionicons name="create-outline" size={18} color={colors.gold} />
        <Text style={[stylesA.notesBtnText, { color: colors.text }]}>Notes</Text>
        {cardNotes.length > 0 && (
          <View style={[stylesA.notesBadge, { backgroundColor: colors.gold }]}>
            <Text style={stylesA.notesBadgeText}>{cardNotes.length}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
      </Pressable>

      <Text style={[stylesA.scannedAt, { color: colors.textMuted }]}>Scanned {card.scannedAt}</Text>

      {expanded && (
        <Modal visible transparent animationType="fade">
          <Pressable style={stylesA.lightbox} onPress={() => setExpanded(null)}>
            <Image source={{ uri: expanded }} style={stylesA.lightboxImg} resizeMode="contain" />
          </Pressable>
        </Modal>
      )}

      <NotesModal
        visible={notesVisible}
        onClose={() => setNotesVisible(false)}
        entityName={card.name}
        notes={cardNotes}
        onAddNote={onAddNote}
        colors={colors}
      />
    </ScrollView>
  );
}

function ARow({ icon, value, colors, onPress, link }: any) {
  return (
    <Pressable style={stylesA.row} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={[stylesA.rowValue, { color: link ? colors.accent : colors.text }]} numberOfLines={1}>{value}</Text>
      <Ionicons name={link ? 'open-outline' : 'copy-outline'} size={15} color={colors.textMuted} />
    </Pressable>
  );
}

const stylesA = StyleSheet.create({
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  imageStrip: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  imageWrap: { flex: 1, height: 130, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  image: { width: '100%', height: '100%' },
  expandBadge: { position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  expandText: { color: '#FFF', fontSize: 10 },
  hero: { borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: 4 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  avatarText: { fontSize: 26, fontWeight: FontWeight.bold },
  name: { fontSize: 22, fontWeight: FontWeight.bold },
  designation: { fontSize: FontSize.sm, marginTop: 2 },
  company: { fontSize: FontSize.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, flexWrap: 'wrap', justifyContent: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full },
  actionLabel: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  section: { borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  rowValue: { flex: 1, fontSize: FontSize.sm },
  addrRow: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, alignItems: 'flex-start' },
  addrText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  notesBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, borderRadius: Radius.lg },
  notesBtnText: { fontSize: FontSize.sm, flex: 1 },
  notesBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  notesBadgeText: { color: '#FFF', fontSize: 10, fontWeight: FontWeight.bold },
  scannedAt: { fontSize: FontSize.xs, textAlign: 'center' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: '92%', height: '60%', borderRadius: Radius.lg },
});

// ── Variant B — "Editorial" ───────────────────────────────────────────────────
// Card photo IS the header — full-width, fills the top. Name + role sit below the image
// as a clean overlay strip. If no photo, falls back to the accent-color banner.

function VariantB({ card, colors, cardNotes, onAddNote }: { card: D; colors: any; cardNotes: Note[]; onAddNote: (t: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notesVisible, setNotesVisible] = useState(false);
  const hasImage = !!card.imageUri;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Full-width card image header */}
      {hasImage ? (
        <Pressable onPress={() => setExpanded(card.imageUri!)}>
          <Image source={{ uri: card.imageUri! }} style={stylesB.photoHeader} resizeMode="cover" />
          <View style={stylesB.photoOverlay}>
            <View style={stylesB.photoOverlayContent}>
              <Text style={stylesB.photoName}>{card.name}</Text>
              {card.designation ? <Text style={stylesB.photoSub}>{card.designation} · {card.company}</Text> : null}
            </View>
            {card.imageUriBack && (
              <Pressable style={stylesB.backThumbWrap} onPress={(e) => { e.stopPropagation(); setExpanded(card.imageUriBack!); }}>
                <Image source={{ uri: card.imageUriBack! }} style={stylesB.backThumb} resizeMode="cover" />
                <Text style={stylesB.backThumbLabel}>Back</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      ) : (
        <View style={[stylesB.banner, { backgroundColor: colors.accent }]}>
          <View style={stylesB.bannerAvatar}>
            <Text style={stylesB.bannerInitials}>{card.initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={stylesB.photoName}>{card.name}</Text>
            {card.designation ? <Text style={stylesB.photoSub}>{card.designation} · {card.company}</Text> : null}
          </View>
        </View>
      )}

      <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
        {/* Social strip */}
        {(card.instagram || card.facebook) && (
          <View style={[stylesB.block, { backgroundColor: colors.surface }]}>
            {card.instagram && (
              <Pressable style={stylesB.socialRow} onPress={() => openLink(`https://instagram.com/${card.instagram.replace('@', '')}`)}>
                <View style={[stylesB.socialIcon, { backgroundColor: '#E1306C18' }]}>
                  <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[stylesB.blockLabel, { color: colors.textMuted }]}>Instagram</Text>
                  <Text style={[stylesB.blockValue, { color: colors.text }]}>{card.instagram}</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={colors.accent} />
              </Pressable>
            )}
            {card.instagram && card.facebook && <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 54 }]} />}
            {card.facebook && (
              <Pressable style={stylesB.socialRow} onPress={() => openLink(`https://facebook.com/${card.facebook}`)}>
                <View style={[stylesB.socialIcon, { backgroundColor: '#1877F218' }]}>
                  <Ionicons name="logo-facebook" size={20} color="#1877F2" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[stylesB.blockLabel, { color: colors.textMuted }]}>Facebook</Text>
                  <Text style={[stylesB.blockValue, { color: colors.text }]}>{card.facebook}</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={colors.accent} />
              </Pressable>
            )}
          </View>
        )}

        {/* Contact block */}
        <View style={[stylesB.block, { backgroundColor: colors.surface }]}>
          {card.phone && (
            <BRow icon="call-outline" label="Phone" value={card.phone} colors={colors}
              right={<Pressable onPress={() => openWA(card.phone)} hitSlop={8}><Ionicons name="logo-whatsapp" size={18} color="#25D366" /></Pressable>} />
          )}
          {card.phone && card.website && <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 50 }]} />}
          {card.website && (
            <BRow icon="globe-outline" label="Website" value={card.website} colors={colors}
              right={<Pressable onPress={() => openLink(card.website)} hitSlop={8}><Ionicons name="open-outline" size={16} color={colors.accent} /></Pressable>} />
          )}
        </View>

        {card.address && (
          <View style={[stylesB.block, { backgroundColor: colors.surface }]}>
            <View style={stylesB.addrWrap}>
              <Ionicons name="location-outline" size={18} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[stylesB.blockLabel, { color: colors.textMuted }]}>Address</Text>
                <Text style={[stylesB.blockValue, { color: colors.text }]}>{card.address}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Scan-time note (read-only) */}
        {card.scanNotes ? (
          <View style={[stylesB.block, { backgroundColor: colors.gold + '15', borderColor: colors.gold + '40', borderWidth: 1 }]}>
            <View style={stylesB.addrWrap}>
              <Ionicons name="create-outline" size={16} color={colors.gold} />
              <Text style={[stylesB.blockValue, { color: colors.textSecondary, flex: 1 }]}>{card.scanNotes}</Text>
            </View>
          </View>
        ) : null}

        {/* Notes button */}
        <Pressable style={[stylesB.block, { backgroundColor: colors.surface }]} onPress={() => setNotesVisible(true)}>
          <View style={[stylesB.addrWrap, { paddingVertical: 14 }]}>
            <Ionicons name="create-outline" size={18} color={colors.gold} />
            <Text style={[stylesB.blockValue, { color: colors.text, flex: 1 }]}>Notes</Text>
            {cardNotes.length > 0 && (
              <View style={[stylesA.notesBadge, { backgroundColor: colors.gold }]}>
                <Text style={stylesA.notesBadgeText}>{cardNotes.length}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </View>
        </Pressable>

        {card.phone && (
          <Pressable style={[stylesB.waCta, { backgroundColor: '#25D366' }]} onPress={() => openWA(card.phone)}>
            <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
            <Text style={stylesB.waCtaText}>Message on WhatsApp</Text>
          </Pressable>
        )}

        <Text style={[stylesB.scannedAt, { color: colors.textMuted }]}>Scanned {card.scannedAt}</Text>
      </View>

      {expanded && (
        <Modal visible transparent animationType="fade">
          <Pressable style={stylesA.lightbox} onPress={() => setExpanded(null)}>
            <Image source={{ uri: expanded }} style={stylesA.lightboxImg} resizeMode="contain" />
          </Pressable>
        </Modal>
      )}

      <NotesModal
        visible={notesVisible}
        onClose={() => setNotesVisible(false)}
        entityName={card.name}
        notes={cardNotes}
        onAddNote={onAddNote}
        colors={colors}
      />
    </ScrollView>
  );
}

function BRow({ icon, label, value, colors, right }: any) {
  return (
    <View style={stylesB.contactRow}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[stylesB.blockLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[stylesB.blockValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      </View>
      {right}
    </View>
  );
}

const stylesB = StyleSheet.create({
  photoHeader: { width: '100%', height: 220 },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.md, paddingBottom: 14, backgroundColor: 'rgba(0,0,0,0.45)' },
  photoOverlayContent: { flex: 1 },
  photoName: { fontSize: 20, fontWeight: FontWeight.bold, color: '#FFF' },
  photoSub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  backThumbWrap: { width: 60, height: 42, borderRadius: 6, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center' },
  backThumb: { width: '100%', height: '100%' },
  backThumbLabel: { position: 'absolute', bottom: 1, fontSize: 8, color: '#FFF', fontWeight: FontWeight.semibold },
  banner: { padding: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  bannerAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  bannerInitials: { fontSize: 22, fontWeight: FontWeight.bold, color: '#FFF' },
  block: { borderRadius: Radius.lg, overflow: 'hidden' },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  socialIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  addrWrap: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.md, alignItems: 'flex-start' },
  blockLabel: { fontSize: 10, fontWeight: FontWeight.semibold, letterSpacing: 0.3, marginBottom: 2 },
  blockValue: { fontSize: FontSize.sm, lineHeight: 20 },
  waCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radius.md },
  waCtaText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  scannedAt: { fontSize: FontSize.xs, textAlign: 'center' },
});

// ── Variant C — "Grouped" ─────────────────────────────────────────────────────
// Card image shown as a compact horizontal thumbnail strip beside the name block.
// Details below in labelled sections. No avatar circle.

function VariantC({ card, colors, cardNotes, onAddNote }: { card: D; colors: any; cardNotes: Note[]; onAddNote: (t: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notesVisible, setNotesVisible] = useState(false);
  const hasImage = !!card.imageUri;

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60, gap: Spacing.lg }}>
      {/* Name + card photo side by side */}
      <View style={stylesC.topRow}>
        <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
          <Text style={[stylesC.name, { color: colors.text }]}>{card.name}</Text>
          {card.company ? <Text style={[stylesC.company, { color: colors.accent }]}>{card.company}</Text> : null}
          {card.designation ? <Text style={[stylesC.designation, { color: colors.textMuted }]}>{card.designation}</Text> : null}
        </View>
        {hasImage && (
          <View style={stylesC.thumbStack}>
            <Pressable onPress={() => setExpanded(card.imageUri!)} style={stylesC.thumb}>
              <Image source={{ uri: card.imageUri! }} style={stylesC.thumbImg} resizeMode="cover" />
              <Text style={stylesC.thumbLabel}>Front</Text>
            </Pressable>
            {card.imageUriBack && (
              <Pressable onPress={() => setExpanded(card.imageUriBack!)} style={[stylesC.thumb, { marginTop: -18 }]}>
                <Image source={{ uri: card.imageUriBack! }} style={stylesC.thumbImg} resizeMode="cover" />
                <Text style={stylesC.thumbLabel}>Back</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Section: Contact */}
      {(card.phone || card.email) && (
        <CSection label="Contact" colors={colors}>
          {card.phone && (
            <CRow icon="call-outline" value={card.phone} colors={colors} actions={[
              { icon: 'logo-whatsapp', color: '#25D366', onPress: () => openWA(card.phone) },
              { icon: 'copy-outline', color: colors.textMuted, onPress: () => copy(card.phone) },
            ]} />
          )}
          {card.phone && card.email && <CDivider colors={colors} />}
          {card.email && (
            <CRow icon="mail-outline" value={card.email} colors={colors} actions={[
              { icon: 'copy-outline', color: colors.textMuted, onPress: () => copy(card.email) },
            ]} />
          )}
        </CSection>
      )}

      {/* Section: Online */}
      {(card.website || card.instagram || card.facebook) && (
        <CSection label="Online" colors={colors}>
          {card.website && (
            <CRow icon="globe-outline" value={card.website} colors={colors} actions={[
              { icon: 'open-outline', color: colors.accent, onPress: () => openLink(card.website) },
            ]} />
          )}
          {card.website && card.instagram && <CDivider colors={colors} />}
          {card.instagram && (
            <CRow icon="logo-instagram" value={card.instagram} colors={colors} actions={[
              { icon: 'open-outline', color: '#E1306C', onPress: () => openLink(`https://instagram.com/${card.instagram.replace('@', '')}`) },
            ]} />
          )}
          {card.instagram && card.facebook && <CDivider colors={colors} />}
          {card.facebook && (
            <CRow icon="logo-facebook" value={card.facebook} colors={colors} actions={[
              { icon: 'open-outline', color: '#1877F2', onPress: () => openLink(`https://facebook.com/${card.facebook}`) },
            ]} />
          )}
        </CSection>
      )}

      {card.address && (
        <CSection label="Location" colors={colors}>
          <View style={stylesC.addrRow}>
            <Ionicons name="location-outline" size={18} color={colors.textMuted} />
            <Text style={[stylesC.addrText, { color: colors.textSecondary }]}>{card.address}</Text>
          </View>
        </CSection>
      )}

      {/* Scan-time note (read-only) shown inline in Notes section */}
      <CSection label="Notes" colors={colors}>
        {card.scanNotes ? (
          <View style={stylesC.addrRow}>
            <Ionicons name="create-outline" size={16} color={colors.gold} />
            <Text style={[stylesC.addrText, { color: colors.textSecondary }]}>{card.scanNotes}</Text>
          </View>
        ) : null}
        <Pressable onPress={() => setNotesVisible(true)} style={[stylesC.addrRow, card.scanNotes ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : {}]}>
          <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
          <Text style={[stylesC.addrText, { color: colors.accent }]}>
            {cardNotes.length > 0 ? `View ${cardNotes.length} note${cardNotes.length > 1 ? 's' : ''}` : 'Add a note'}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
        </Pressable>
      </CSection>

      {card.phone && (
        <Pressable style={[stylesC.waCta, { backgroundColor: '#25D366' }]} onPress={() => openWA(card.phone)}>
          <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
          <Text style={stylesC.waCtaText}>Message on WhatsApp</Text>
        </Pressable>
      )}

      <Text style={[stylesC.scannedAt, { color: colors.textMuted }]}>Scanned {card.scannedAt}</Text>

      {expanded && (
        <Modal visible transparent animationType="fade">
          <Pressable style={stylesA.lightbox} onPress={() => setExpanded(null)}>
            <Image source={{ uri: expanded }} style={stylesA.lightboxImg} resizeMode="contain" />
          </Pressable>
        </Modal>
      )}

      <NotesModal
        visible={notesVisible}
        onClose={() => setNotesVisible(false)}
        entityName={card.name}
        notes={cardNotes}
        onAddNote={onAddNote}
        colors={colors}
      />
    </ScrollView>
  );
}

function CSection({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[stylesC.sectionLabel, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <View style={[stylesC.sectionCard, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

function CRow({ icon, value, colors, actions = [] }: { icon: string; value: string; colors: any; actions?: { icon: string; color: string; onPress: () => void }[] }) {
  return (
    <View style={stylesC.row}>
      <Ionicons name={icon as any} size={18} color={colors.textSecondary} />
      <Text style={[stylesC.rowValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {actions.map((a, i) => (
          <Pressable key={i} onPress={a.onPress} hitSlop={8}>
            <Ionicons name={a.icon as any} size={17} color={a.color} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CDivider({ colors }: any) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 42 }]} />;
}

const stylesC = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  name: { fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: -0.3 },
  company: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  designation: { fontSize: FontSize.sm },
  thumbStack: { gap: 0, alignItems: 'flex-end' },
  thumb: { width: 110, height: 68, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
  thumbImg: { width: '100%', height: '100%' },
  thumbLabel: { position: 'absolute', bottom: 4, right: 6, fontSize: 9, color: '#FFF', fontWeight: FontWeight.semibold, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  sectionLabel: { fontSize: 10, fontWeight: FontWeight.semibold, letterSpacing: 1 },
  sectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 13 },
  rowValue: { flex: 1, fontSize: FontSize.sm },
  addrRow: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 13, alignItems: 'flex-start' },
  addrText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  waCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radius.md },
  waCtaText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  scannedAt: { fontSize: FontSize.xs, textAlign: 'center' },
});

// ── Shared styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  backBtn: { padding: 4 },
  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerLabel: { fontSize: FontSize.sm },
  typeSwitcher: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    gap: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  typeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: Radius.md },
  typeTabLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  tabs: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    gap: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: Radius.md, alignItems: 'center' },
  tabLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});

// ═══════════════════════════════════════════════════════════════════════════════
// QR Contact Variants
// ═══════════════════════════════════════════════════════════════════════════════

type QRProps = { conn: QR; colors: any; connNotes: Note[]; onAddNote: (t: string) => void };

function qrInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── QR Variant A — "Compact" ──────────────────────────────────────────────────
// Three action chips replace four CTAs. Notes count on avatar badge.
// WhatsApp + Exchange in one chip row. Brand as inline pill in hero.

function QRVariantA({ conn, colors, connNotes, onAddNote }: QRProps) {
  const [notesVisible, setNotesVisible] = useState(false);
  const { user } = conn;
  const initials = qrInitials(user.full_name);

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60, gap: Spacing.md }}>
      {/* Hero card */}
      <View style={[stylesQA.hero, { backgroundColor: colors.surface }]}>
        <View style={stylesQA.avatarWrap}>
          {user.profile_image_url ? (
            <Image source={{ uri: user.profile_image_url }} style={stylesQA.avatarImg} />
          ) : (
            <View style={[stylesQA.avatar, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[stylesQA.avatarText, { color: colors.textSecondary }]}>{initials}</Text>
            </View>
          )}
          {connNotes.length > 0 && (
            <View style={[stylesQA.notesBadge, { backgroundColor: colors.gold }]}>
              <Text style={stylesQA.notesBadgeText}>{connNotes.length}</Text>
            </View>
          )}
        </View>
        <Text style={[stylesQA.name, { color: colors.text }]}>{user.full_name}</Text>
        {user.designation && <Text style={[stylesQA.designation, { color: colors.textSecondary }]}>{user.designation}</Text>}
        {user.company_name && <Text style={[stylesQA.company, { color: colors.textMuted }]}>{user.company_name}</Text>}
        {user.city && <Text style={[stylesQA.city, { color: colors.textMuted }]}>{user.city}</Text>}

        {/* Three focused action chips */}
        <View style={stylesQA.chips}>
          {user.phone && (
            <Pressable style={[stylesQA.chip, { backgroundColor: '#25D366' }]}
              onPress={() => Linking.openURL(`https://wa.me/${user.phone!.replace(/\D/g, '')}`)}>
              <Ionicons name="logo-whatsapp" size={16} color="#FFF" />
              <Text style={stylesQA.chipLabel}>WhatsApp</Text>
            </Pressable>
          )}
          {!conn.is_mutual && (
            <Pressable style={[stylesQA.chip, { backgroundColor: colors.accent }]}
              onPress={() => Alert.alert('Exchange', 'Send your contact card to ' + user.full_name + '?')}>
              <Ionicons name="swap-horizontal-outline" size={16} color="#FFF" />
              <Text style={stylesQA.chipLabel}>Exchange</Text>
            </Pressable>
          )}
          <Pressable style={[stylesQA.chip, { backgroundColor: colors.surfaceElevated }]}
            onPress={() => setNotesVisible(true)}>
            <Ionicons name="create-outline" size={16} color={connNotes.length > 0 ? colors.gold : colors.textMuted} />
            <Text style={[stylesQA.chipLabel, { color: connNotes.length > 0 ? colors.gold : colors.textMuted }]}>Notes</Text>
          </Pressable>
        </View>
      </View>

      {/* Contact rows */}
      <View style={[stylesQA.section, { backgroundColor: colors.surface }]}>
        {user.phone && <QARow icon="call-outline" label="Phone" value={user.phone} colors={colors} onCopy={() => copy(user.phone!)} />}
        {user.phone && user.email && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 50 }} />}
        {user.email && <QARow icon="mail-outline" label="Email" value={user.email} colors={colors} onCopy={() => copy(user.email!)} />}
        {user.email && user.website_url && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 50 }} />}
        {user.website_url && <QARow icon="globe-outline" label="Website" value={user.website_url} colors={colors} onOpen={() => Linking.openURL(`https://${user.website_url}`).catch(() => {})} />}
        {user.website_url && user.instagram_handle && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 50 }} />}
        {user.instagram_handle && <QARow icon="logo-instagram" label="Instagram" value={`@${user.instagram_handle}`} colors={colors} onOpen={() => Linking.openURL(`https://instagram.com/${user.instagram_handle}`).catch(() => {})} />}
        {user.instagram_handle && user.linkedin_url && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 50 }} />}
        {user.linkedin_url && <QARow icon="logo-linkedin" label="LinkedIn" value={user.linkedin_url} colors={colors} onOpen={() => Linking.openURL(`https://${user.linkedin_url}`).catch(() => {})} />}
      </View>

      {/* Brand inline — compact, not a standalone section */}
      {conn.brand_id && conn.brand_name && (
        <View style={[stylesQA.brandPill, { backgroundColor: colors.surface }]}>
          <View style={[stylesQA.brandLetter, { backgroundColor: colors.accent + '22' }]}>
            <Text style={[stylesQA.brandLetterText, { color: colors.accent }]}>{conn.brand_name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[stylesQA.brandMeta, { color: colors.textMuted }]}>Represents</Text>
            <Text style={[stylesQA.brandName, { color: colors.text }]}>{conn.brand_name}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      )}

      <NotesModal visible={notesVisible} onClose={() => setNotesVisible(false)}
        entityName={user.full_name} notes={connNotes} onAddNote={onAddNote} colors={colors} />
    </ScrollView>
  );
}

function QARow({ icon, label, value, colors, onCopy, onOpen }: any) {
  return (
    <View style={stylesQA.row}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[stylesQA.rowLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[stylesQA.rowValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      </View>
      {onOpen && <Pressable onPress={onOpen} hitSlop={8}><Ionicons name="open-outline" size={16} color={colors.accent} /></Pressable>}
      {onCopy && <Pressable onPress={onCopy} hitSlop={8} style={{ marginLeft: onOpen ? 10 : 0 }}><Ionicons name="copy-outline" size={15} color={colors.textMuted} /></Pressable>}
    </View>
  );
}

const stylesQA = StyleSheet.create({
  hero: { borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: 4 },
  avatarWrap: { position: 'relative', marginBottom: Spacing.sm },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarText: { fontSize: 26, fontWeight: FontWeight.bold },
  notesBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  notesBadgeText: { color: '#FFF', fontSize: 9, fontWeight: FontWeight.bold },
  name: { fontSize: 20, fontWeight: FontWeight.bold, textAlign: 'center' },
  designation: { fontSize: FontSize.sm, textAlign: 'center', marginTop: 2 },
  company: { fontSize: FontSize.sm, textAlign: 'center' },
  city: { fontSize: FontSize.xs, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full },
  chipLabel: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  section: { borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 13 },
  rowLabel: { fontSize: 10, fontWeight: FontWeight.semibold, letterSpacing: 0.3, marginBottom: 1 },
  rowValue: { fontSize: FontSize.sm },
  brandPill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.lg, padding: Spacing.md },
  brandLetter: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  brandLetterText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  brandMeta: { fontSize: 10, letterSpacing: 0.3 },
  brandName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});

// ── QR Variant B — "Bold" ─────────────────────────────────────────────────────
// Large accent banner with name prominent. WhatsApp is the primary CTA at bottom.
// Exchange Contact is a secondary outlined button — less visual weight.
// Notes lives in the banner as a small count chip.

function QRVariantB({ conn, colors, connNotes, onAddNote }: QRProps) {
  const [notesVisible, setNotesVisible] = useState(false);
  const { user } = conn;
  const initials = qrInitials(user.full_name);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Bold banner */}
      <View style={[stylesQB.banner, { backgroundColor: colors.accent }]}>
        <View style={stylesQB.bannerTop}>
          <View style={stylesQB.bannerAvatar}>
            {user.profile_image_url
              ? <Image source={{ uri: user.profile_image_url }} style={stylesQB.bannerAvatarImg} />
              : <Text style={stylesQB.bannerInitials}>{initials}</Text>}
          </View>
          <Pressable style={stylesQB.notesPill} onPress={() => setNotesVisible(true)}>
            <Ionicons name="create-outline" size={13} color={connNotes.length > 0 ? '#FFD700' : 'rgba(255,255,255,0.7)'} />
            <Text style={[stylesQB.notesPillText, connNotes.length > 0 && { color: '#FFD700' }]}>
              {connNotes.length > 0 ? `${connNotes.length} Note${connNotes.length > 1 ? 's' : ''}` : 'Notes'}
            </Text>
          </Pressable>
        </View>
        <Text style={stylesQB.bannerName}>{user.full_name}</Text>
        {user.designation && <Text style={stylesQB.bannerRole}>{user.designation}{user.company_name ? ` · ${user.company_name}` : ''}</Text>}
        {user.city && <Text style={stylesQB.bannerCity}>{user.city}</Text>}
      </View>

      <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
        {/* Contact block */}
        <View style={[stylesQB.block, { backgroundColor: colors.surface }]}>
          {user.phone && (
            <View style={stylesQB.contactRow}>
              <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[stylesQB.rowLabel, { color: colors.textMuted }]}>Phone</Text>
                <Text style={[stylesQB.rowValue, { color: colors.text }]}>{user.phone}</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => copy(user.phone!)}><Ionicons name="copy-outline" size={15} color={colors.textMuted} /></Pressable>
            </View>
          )}
          {user.phone && user.email && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 50 }} />}
          {user.email && (
            <View style={stylesQB.contactRow}>
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[stylesQB.rowLabel, { color: colors.textMuted }]}>Email</Text>
                <Text style={[stylesQB.rowValue, { color: colors.text }]}>{user.email}</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => copy(user.email!)}><Ionicons name="copy-outline" size={15} color={colors.textMuted} /></Pressable>
            </View>
          )}
        </View>

        {/* Social block */}
        {(user.instagram_handle || user.linkedin_url || user.website_url) && (
          <View style={[stylesQB.block, { backgroundColor: colors.surface }]}>
            {user.instagram_handle && (
              <Pressable style={stylesQB.socialRow} onPress={() => Linking.openURL(`https://instagram.com/${user.instagram_handle}`).catch(() => {})}>
                <View style={[stylesQB.socialIcon, { backgroundColor: '#E1306C18' }]}>
                  <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                </View>
                <Text style={[stylesQB.rowValue, { flex: 1, color: colors.text }]}>@{user.instagram_handle}</Text>
                <Ionicons name="open-outline" size={15} color={colors.accent} />
              </Pressable>
            )}
            {user.instagram_handle && user.website_url && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 54 }} />}
            {user.website_url && (
              <Pressable style={stylesQB.socialRow} onPress={() => Linking.openURL(`https://${user.website_url}`).catch(() => {})}>
                <View style={[stylesQB.socialIcon, { backgroundColor: colors.accent + '18' }]}>
                  <Ionicons name="globe-outline" size={18} color={colors.accent} />
                </View>
                <Text style={[stylesQB.rowValue, { flex: 1, color: colors.text }]}>{user.website_url}</Text>
                <Ionicons name="open-outline" size={15} color={colors.accent} />
              </Pressable>
            )}
          </View>
        )}

        {/* Brand */}
        {conn.brand_id && conn.brand_name && (
          <View style={[stylesQB.block, { backgroundColor: colors.surface }]}>
            <View style={stylesQB.contactRow}>
              <View style={[stylesQA.brandLetter, { backgroundColor: colors.accent + '22' }]}>
                <Text style={[stylesQA.brandLetterText, { color: colors.accent }]}>{conn.brand_name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[stylesQB.rowLabel, { color: colors.textMuted }]}>Represents</Text>
                <Text style={[stylesQB.rowValue, { color: colors.text }]}>{conn.brand_name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </View>
        )}

        {/* Primary: WhatsApp */}
        {user.phone && (
          <Pressable style={stylesQB.waCta} onPress={() => Linking.openURL(`https://wa.me/${user.phone!.replace(/\D/g, '')}`).catch(() => {})}>
            <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
            <Text style={stylesQB.waCtaText}>Message on WhatsApp</Text>
          </Pressable>
        )}

        {/* Secondary: Exchange — outlined, less dominant */}
        {!conn.is_mutual && (
          <Pressable
            style={[stylesQB.exchangeBtn, { borderColor: colors.accent }]}
            onPress={() => Alert.alert('Exchange', 'Send your contact card?')}>
            <Ionicons name="swap-horizontal-outline" size={18} color={colors.accent} />
            <Text style={[stylesQB.exchangeText, { color: colors.accent }]}>Exchange Contact</Text>
          </Pressable>
        )}
      </View>

      <NotesModal visible={notesVisible} onClose={() => setNotesVisible(false)}
        entityName={user.full_name} notes={connNotes} onAddNote={onAddNote} colors={colors} />
    </ScrollView>
  );
}

const stylesQB = StyleSheet.create({
  banner: { padding: Spacing.xl, paddingTop: Spacing.lg, gap: 4 },
  bannerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.md },
  bannerAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  bannerAvatarImg: { width: 64, height: 64, borderRadius: 32 },
  bannerInitials: { fontSize: 24, fontWeight: FontWeight.bold, color: '#FFF' },
  notesPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  notesPillText: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.85)', fontWeight: FontWeight.semibold },
  bannerName: { fontSize: 26, fontWeight: FontWeight.bold, color: '#FFF' },
  bannerRole: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)' },
  bannerCity: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  block: { borderRadius: Radius.lg, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 13 },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  socialIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 10, fontWeight: FontWeight.semibold, letterSpacing: 0.3, marginBottom: 1 },
  rowValue: { fontSize: FontSize.sm },
  waCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: '#25D366', paddingVertical: 14, borderRadius: Radius.md },
  waCtaText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  exchangeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderWidth: 1.5, paddingVertical: 13, borderRadius: Radius.md },
  exchangeText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
});

// ── QR Variant C — "Grouped" ──────────────────────────────────────────────────
// No avatar. Large name + company in accent. WhatsApp inline with phone row.
// Exchange Contact is a subtle text-level action. Notes as section row.

function QRVariantC({ conn, colors, connNotes, onAddNote }: QRProps) {
  const [notesVisible, setNotesVisible] = useState(false);
  const { user } = conn;

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60, gap: Spacing.lg }}>
      {/* Identity block — no avatar, typography-first */}
      <View style={{ gap: 4 }}>
        <Text style={[stylesQC.name, { color: colors.text }]}>{user.full_name}</Text>
        {user.company_name && <Text style={[stylesQC.company, { color: colors.accent }]}>{user.company_name}</Text>}
        {user.designation && <Text style={[stylesQC.designation, { color: colors.textMuted }]}>{user.designation}</Text>}
        {user.city && (
          <View style={stylesQC.cityRow}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={[stylesQC.city, { color: colors.textMuted }]}>{user.city}</Text>
          </View>
        )}
      </View>

      {/* Contact section */}
      {(user.phone || user.email) && (
        <View style={{ gap: 6 }}>
          <Text style={[stylesQC.sectionLabel, { color: colors.textMuted }]}>CONTACT</Text>
          <View style={[stylesQC.sectionCard, { backgroundColor: colors.surface }]}>
            {user.phone && (
              <View style={stylesQC.row}>
                <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
                <Text style={[stylesQC.rowValue, { flex: 1, color: colors.text }]}>{user.phone}</Text>
                <Pressable onPress={() => Linking.openURL(`https://wa.me/${user.phone!.replace(/\D/g, '')}`).catch(() => {})} hitSlop={8}>
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                </Pressable>
                <Pressable onPress={() => copy(user.phone!)} hitSlop={8} style={{ marginLeft: 10 }}>
                  <Ionicons name="copy-outline" size={15} color={colors.textMuted} />
                </Pressable>
              </View>
            )}
            {user.phone && user.email && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 46 }} />}
            {user.email && (
              <View style={stylesQC.row}>
                <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                <Text style={[stylesQC.rowValue, { flex: 1, color: colors.text }]}>{user.email}</Text>
                <Pressable onPress={() => copy(user.email!)} hitSlop={8}>
                  <Ionicons name="copy-outline" size={15} color={colors.textMuted} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Online section */}
      {(user.instagram_handle || user.website_url || user.linkedin_url) && (
        <View style={{ gap: 6 }}>
          <Text style={[stylesQC.sectionLabel, { color: colors.textMuted }]}>ONLINE</Text>
          <View style={[stylesQC.sectionCard, { backgroundColor: colors.surface }]}>
            {user.instagram_handle && (
              <Pressable style={stylesQC.row} onPress={() => Linking.openURL(`https://instagram.com/${user.instagram_handle}`).catch(() => {})}>
                <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                <Text style={[stylesQC.rowValue, { flex: 1, color: colors.text }]}>@{user.instagram_handle}</Text>
                <Ionicons name="open-outline" size={15} color={colors.accent} />
              </Pressable>
            )}
            {user.instagram_handle && user.website_url && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 46 }} />}
            {user.website_url && (
              <Pressable style={stylesQC.row} onPress={() => Linking.openURL(`https://${user.website_url}`).catch(() => {})}>
                <Ionicons name="globe-outline" size={18} color={colors.accent} />
                <Text style={[stylesQC.rowValue, { flex: 1, color: colors.text }]}>{user.website_url}</Text>
                <Ionicons name="open-outline" size={15} color={colors.accent} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Brand */}
      {conn.brand_id && conn.brand_name && (
        <View style={{ gap: 6 }}>
          <Text style={[stylesQC.sectionLabel, { color: colors.textMuted }]}>REPRESENTS</Text>
          <View style={[stylesQC.sectionCard, { backgroundColor: colors.surface }]}>
            <View style={stylesQC.row}>
              <View style={[stylesQA.brandLetter, { backgroundColor: colors.accent + '22' }]}>
                <Text style={[stylesQA.brandLetterText, { color: colors.accent }]}>{conn.brand_name[0]}</Text>
              </View>
              <Text style={[stylesQC.rowValue, { flex: 1, color: colors.text }]}>{conn.brand_name}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </View>
          </View>
        </View>
      )}

      {/* Notes */}
      <View style={{ gap: 6 }}>
        <Text style={[stylesQC.sectionLabel, { color: colors.textMuted }]}>NOTES</Text>
        <Pressable style={[stylesQC.sectionCard, { backgroundColor: colors.surface }]} onPress={() => setNotesVisible(true)}>
          <View style={stylesQC.row}>
            <Ionicons name="create-outline" size={18} color={connNotes.length > 0 ? colors.gold : colors.textMuted} />
            <Text style={[stylesQC.rowValue, { flex: 1, color: connNotes.length > 0 ? colors.text : colors.textMuted }]}>
              {connNotes.length > 0 ? `${connNotes.length} note${connNotes.length > 1 ? 's' : ''}` : 'Add a note'}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </View>
        </Pressable>
      </View>

      {/* Actions: Exchange as subtle text link, WhatsApp as chip */}
      <View style={stylesQC.actions}>
        {user.phone && (
          <Pressable style={[stylesQC.waChip, { backgroundColor: '#25D366' }]}
            onPress={() => Linking.openURL(`https://wa.me/${user.phone!.replace(/\D/g, '')}`).catch(() => {})}>
            <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
            <Text style={stylesQC.waChipText}>WhatsApp</Text>
          </Pressable>
        )}
        {!conn.is_mutual && (
          <Pressable style={[stylesQC.exchangeLink, { borderColor: colors.border }]}
            onPress={() => Alert.alert('Exchange', 'Send your contact card?')}>
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.textSecondary} />
            <Text style={[stylesQC.exchangeLinkText, { color: colors.textSecondary }]}>Exchange Contact</Text>
          </Pressable>
        )}
      </View>

      <NotesModal visible={notesVisible} onClose={() => setNotesVisible(false)}
        entityName={user.full_name} notes={connNotes} onAddNote={onAddNote} colors={colors} />
    </ScrollView>
  );
}

const stylesQC = StyleSheet.create({
  name: { fontSize: 26, fontWeight: FontWeight.bold, letterSpacing: -0.3 },
  company: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  designation: { fontSize: FontSize.sm },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  city: { fontSize: FontSize.xs },
  sectionLabel: { fontSize: 10, fontWeight: FontWeight.semibold, letterSpacing: 1 },
  sectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 13 },
  rowValue: { fontSize: FontSize.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  waChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.full },
  waChipText: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  exchangeLink: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: Radius.full, borderWidth: 1 },
  exchangeLinkText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
