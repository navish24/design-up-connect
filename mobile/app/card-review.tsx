import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, Modal, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cardScanStore } from '../lib/cardScanStore';
import { Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import type { CardContact, CardContactField } from '../types';

const FIELD_LABELS = [
  'Name', 'Company', 'Designation', 'Phone', 'WhatsApp',
  'Email', 'Website', 'LinkedIn', 'Instagram', 'Facebook', 'Twitter/X',
  'Behance', 'YouTube', 'Social Handle', 'Address', 'Other',
];

function generateId() {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function CardReviewScreen() {
  const { colors } = useTheme();
  const { addCardContact, updateCardContact, cardContacts } = useAuth();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [backImageUri, setBackImageUri] = useState<string | null>(null);
  const [fields, setFields] = useState<CardContactField[]>([]);
  const [notes, setNotes] = useState('');
  const [isBlurry, setIsBlurry] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [editingLabelIdx, setEditingLabelIdx] = useState<number | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [expandedUri, setExpandedUri] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const data = cardScanStore.consume();
    if (data) {
      setImageUri(data.imageUri);
      setBackImageUri(data.backImageUri);
      setFields(data.fields);
      setIsBlurry(data.isBlurry);
    }
  }, []);

  const updateFieldValue = useCallback((idx: number, value: string) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, value } : f)));
  }, []);

  const updateFieldLabel = useCallback((idx: number, label: string) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, label } : f)));
  }, []);

  const deleteField = useCallback((idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addField = useCallback(() => {
    if (!newFieldValue.trim()) return;
    const label = newFieldLabel.trim() || 'Other';
    setFields((prev) => [...prev, { label, value: newFieldValue.trim() }]);
    setNewFieldLabel('');
    setNewFieldValue('');
    setShowAddField(false);
  }, [newFieldLabel, newFieldValue]);

  const findDuplicate = useCallback((): CardContact | null => {
    const phones = fields.filter((f) => f.label === 'Phone' || f.label === 'WhatsApp').map((f) => f.value.replace(/\D/g, ''));
    const emails = fields.filter((f) => f.label === 'Email').map((f) => f.value.toLowerCase());
    return cardContacts.find((c) => {
      const cPhones = c.fields.filter((f) => f.label === 'Phone' || f.label === 'WhatsApp').map((f) => f.value.replace(/\D/g, ''));
      const cEmails = c.fields.filter((f) => f.label === 'Email').map((f) => f.value.toLowerCase());
      return phones.some((p) => cPhones.includes(p)) || emails.some((e) => cEmails.includes(e));
    }) ?? null;
  }, [fields, cardContacts]);

  const doSave = useCallback(() => {
    const contact: CardContact = {
      id: generateId(),
      source: 'card_scan',
      scanned_at: new Date().toISOString(),
      card_image_uri: imageUri,
      card_image_uri_back: backImageUri,
      fields: fields.filter((f) => f.value.trim()),
      notes: notes.trim(),
      tags: [],
      nexgild_user_id: null,
    };
    addCardContact(contact);
    setSaved(true);
  }, [imageUri, backImageUri, fields, notes, addCardContact]);

  const handleSave = useCallback(() => {
    const dup = findDuplicate();
    if (dup) {
      const dupName = dup.fields.find((f) => f.label === 'Name')?.value ?? 'this contact';
      Alert.alert(
        'Possible Duplicate',
        `A contact matching ${dupName} already exists.`,
        [
          { text: 'View Existing', style: 'cancel', onPress: () => router.back() },
          {
            text: 'Update Existing',
            onPress: () => {
              const existingLabels = new Set(dup.fields.map((f) => f.label));
              const newFields = fields.filter((f) => f.value.trim() && !existingLabels.has(f.label));
              updateCardContact({ ...dup, fields: [...dup.fields, ...newFields] });
              setSaved(true);
            },
          },
          { text: 'Save New', onPress: doSave },
        ]
      );
    } else {
      doSave();
    }
  }, [findDuplicate, doSave, fields, updateCardContact]);

  // ── Success ──────────────────────────────────────────────────────────────────

  if (saved) {
    const nameField = fields.find((f) => f.label === 'Name');
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <View style={[s.successIcon, { backgroundColor: colors.accent + '18' }]}>
          <Ionicons name="checkmark-circle" size={52} color={colors.accent} />
        </View>
        <Text style={[s.successTitle, { color: colors.text }]}>
          {nameField ? `${nameField.value} saved!` : 'Contact saved!'}
        </Text>
        <Text style={[s.successSub, { color: colors.textSecondary }]}>
          Added to your visiting card contacts
        </Text>
        <Pressable
          style={[s.solidBtn, { backgroundColor: colors.accent, marginTop: Spacing.xl }]}
          onPress={() => {
            setFields([]); setImageUri(null); setBackImageUri(null); setNotes(''); setSaved(false);
            router.back();
            router.push('/(app)/scan?cardMode=1' as any);
          }}
        >
          <Ionicons name="scan-outline" size={18} color="#FFF" />
          <Text style={s.solidBtnText}>Scan Another Card</Text>
        </Pressable>
        <Pressable style={s.ghostBtn} onPress={() => router.replace('/(app)/connections')}>
          <Text style={[s.ghostBtnText, { color: colors.textMuted }]}>Done — View Contacts</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main review ──────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Review Card</Text>
        <Pressable onPress={handleSave} style={s.headerBtn} hitSlop={8}>
          <Text style={[s.headerSave, { color: colors.accent }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        {/* Card image strip */}
        {imageUri ? (
          <View style={s.imageStrip}>
            <Pressable onPress={() => setExpandedUri(imageUri)} style={[s.imageThumb, { backgroundColor: '#000' }]}>
              <Image source={{ uri: imageUri }} style={s.thumbImg} resizeMode="contain" />
              <View style={s.thumbBadge}>
                <Ionicons name="expand-outline" size={11} color="#FFF" />
                <Text style={s.thumbBadgeText}>Front</Text>
              </View>
            </Pressable>
            {backImageUri && (
              <Pressable onPress={() => setExpandedUri(backImageUri)} style={[s.imageThumb, { backgroundColor: '#000' }]}>
                <Image source={{ uri: backImageUri }} style={s.thumbImg} resizeMode="contain" />
                <View style={s.thumbBadge}>
                  <Ionicons name="expand-outline" size={11} color="#FFF" />
                  <Text style={s.thumbBadgeText}>Back</Text>
                </View>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={[s.noImageBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="card-outline" size={28} color={colors.textMuted} />
            <Text style={[s.noImageText, { color: colors.textMuted }]}>No image captured</Text>
          </View>
        )}

        {/* Blur warning */}
        {isBlurry && (
          <View style={[s.banner, { backgroundColor: '#C4622D18', borderColor: '#C4622D55' }]}>
            <Ionicons name="warning-outline" size={15} color="#C4622D" />
            <Text style={[s.bannerText, { color: '#C4622D' }]}>
              Image may be unclear — check fields carefully before saving.
            </Text>
          </View>
        )}

        {/* Empty state */}
        {fields.length === 0 && (
          <View style={[s.emptyBox, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.textMuted} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>Couldn't read this card</Text>
            <Text style={[s.emptyBody, { color: colors.textSecondary }]}>
              Add contact details manually below.
            </Text>
          </View>
        )}

        {/* Fields */}
        {fields.length > 0 && (
          <View style={[s.fieldsCard, { backgroundColor: colors.surface }]}>
            {fields.map((field, idx) => (
              <FieldRow
                key={idx}
                field={field}
                colors={colors}
                onChangeValue={(v) => updateFieldValue(idx, v)}
                onPressLabel={() => { setEditingLabelIdx(idx); setShowLabelPicker(true); }}
                onDelete={() => deleteField(idx)}
                isLast={idx === fields.length - 1}
              />
            ))}
          </View>
        )}

        {/* Add field */}
        <Pressable
          style={[s.addBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowAddField(true)}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
          <Text style={[s.addBtnText, { color: colors.accent }]}>Add Field</Text>
        </Pressable>

        {/* Notes */}
        <View style={[s.notesCard, { backgroundColor: colors.surface }]}>
          <View style={s.notesHeader}>
            <Ionicons name="create-outline" size={15} color={colors.textMuted} />
            <Text style={[s.notesLabel, { color: colors.textMuted }]}>NOTES</Text>
          </View>
          <TextInput
            style={[s.notesInput, { color: colors.text }]}
            placeholder="Where you met, what you discussed..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={notes}
            onChangeText={setNotes}
          />
        </View>
      </ScrollView>

      {/* Sticky save footer */}
      <View style={[s.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable style={[s.solidBtn, { backgroundColor: colors.accent }]} onPress={handleSave}>
          <Ionicons name="checkmark-circle" size={19} color="#FFF" />
          <Text style={s.solidBtnText}>Save Contact</Text>
        </Pressable>
        <Pressable style={s.ghostBtn} onPress={() => router.back()}>
          <Text style={[s.ghostBtnText, { color: colors.textMuted }]}>Discard</Text>
        </Pressable>
      </View>

      {/* Label picker */}
      <Modal visible={showLabelPicker} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={() => setShowLabelPicker(false)}>
          <View style={[s.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[s.sheetTitle, { color: colors.text }]}>Change Label</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {FIELD_LABELS.map((label) => (
                <Pressable
                  key={label}
                  style={[s.sheetRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    if (editingLabelIdx !== null) updateFieldLabel(editingLabelIdx, label);
                    setShowLabelPicker(false);
                    setEditingLabelIdx(null);
                  }}
                >
                  <Ionicons name={(LABEL_ICONS[label] ?? 'ellipsis-horizontal-outline') as any} size={16} color={colors.accent} />
                  <Text style={[s.sheetRowText, { color: colors.text }]}>{label}</Text>
                </Pressable>
              ))}
              <Pressable style={[s.sheetRow, { borderBottomColor: 'transparent' }]} onPress={() => setShowLabelPicker(false)}>
                <Text style={[s.sheetRowText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Add field sheet */}
      <Modal visible={showAddField} transparent animationType="slide">
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[s.sheetTitle, { color: colors.text }]}>Add Field</Text>

            <Text style={[s.inputLabel, { color: colors.textMuted }]}>LABEL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {FIELD_LABELS.map((lbl) => (
                <Pressable
                  key={lbl}
                  style={[
                    s.chip,
                    {
                      backgroundColor: newFieldLabel === lbl ? colors.accent : colors.surfaceElevated,
                      borderColor: newFieldLabel === lbl ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setNewFieldLabel(lbl)}
                >
                  <Text style={[s.chipText, { color: newFieldLabel === lbl ? '#FFF' : colors.textSecondary }]}>
                    {lbl}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              style={[s.textField, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
              placeholder="Or type a custom label..."
              placeholderTextColor={colors.textMuted}
              value={newFieldLabel}
              onChangeText={setNewFieldLabel}
            />

            <Text style={[s.inputLabel, { color: colors.textMuted, marginTop: Spacing.md }]}>VALUE</Text>
            <TextInput
              style={[s.textField, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter value..."
              placeholderTextColor={colors.textMuted}
              value={newFieldValue}
              onChangeText={setNewFieldValue}
              autoFocus
            />

            <View style={s.sheetActions}>
              <Pressable
                style={[s.sheetCancelBtn, { borderColor: colors.border }]}
                onPress={() => { setShowAddField(false); setNewFieldLabel(''); setNewFieldValue(''); }}
              >
                <Text style={[s.sheetCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.sheetConfirmBtn, { backgroundColor: colors.accent }]} onPress={addField}>
                <Text style={s.sheetConfirmText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Lightbox */}
      {expandedUri && (
        <Modal visible transparent animationType="fade">
          <Pressable style={s.lightbox} onPress={() => setExpandedUri(null)}>
            <Image source={{ uri: expandedUri }} style={s.lightboxImg} resizeMode="contain" />
            <Pressable style={s.lightboxClose} onPress={() => setExpandedUri(null)}>
              <Ionicons name="close" size={20} color="#FFF" />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────
// Stacked layout: colored icon badge → label (small caps, tappable) → value (full-width input)

function FieldRow({
  field, colors, onChangeValue, onPressLabel, onDelete, isLast,
}: {
  field: CardContactField;
  colors: any;
  onChangeValue: (v: string) => void;
  onPressLabel: () => void;
  onDelete: () => void;
  isLast: boolean;
}) {
  const icon = (LABEL_ICONS[field.label] ?? 'ellipsis-horizontal-outline') as any;
  const isMultiline = field.label === 'Address' || field.label === 'Other' || field.label === 'Notes';

  return (
    <View style={[s.fieldRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      {/* Icon badge */}
      <View style={[s.iconBadge, { backgroundColor: colors.accent + '18' }]}>
        <Ionicons name={icon} size={17} color={colors.accent} />
      </View>

      {/* Label + value stacked */}
      <View style={s.fieldBody}>
        <Pressable onPress={onPressLabel} style={s.labelRow} hitSlop={6}>
          <Text style={[s.fieldLabelText, { color: colors.textMuted }]}>{field.label.toUpperCase()}</Text>
          <Ionicons name="chevron-down" size={10} color={colors.textMuted} style={{ marginLeft: 2 }} />
        </Pressable>
        <TextInput
          style={[s.fieldValueInput, { color: colors.text }]}
          value={field.value}
          onChangeText={onChangeValue}
          multiline={isMultiline}
          numberOfLines={isMultiline ? 2 : 1}
          returnKeyType={isMultiline ? 'default' : 'done'}
        />
      </View>

      {/* Delete */}
      <Pressable onPress={onDelete} hitSlop={10} style={s.deleteBtn}>
        <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const LABEL_ICONS: Record<string, string> = {
  Name: 'person-outline',
  Company: 'business-outline',
  Designation: 'briefcase-outline',
  Phone: 'call-outline',
  WhatsApp: 'logo-whatsapp',
  Email: 'mail-outline',
  Website: 'globe-outline',
  LinkedIn: 'logo-linkedin',
  Instagram: 'logo-instagram',
  Facebook: 'logo-facebook',
  'Twitter/X': 'logo-twitter',
  Behance: 'color-palette-outline',
  YouTube: 'logo-youtube',
  'Social Handle': 'at-outline',
  Address: 'location-outline',
  Other: 'ellipsis-horizontal-outline',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 44, alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  headerSave: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },

  // Scroll
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 120, gap: Spacing.md },

  // Card images
  imageStrip: { flexDirection: 'row', gap: Spacing.sm },
  imageThumb: {
    flex: 1, height: 110, borderRadius: Radius.lg, overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbBadge: {
    position: 'absolute', bottom: 7, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
  },
  thumbBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
  noImageBox: {
    height: 80, borderRadius: Radius.lg, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 6, flexDirection: 'row',
  },
  noImageText: { fontSize: FontSize.sm },

  // Banners
  banner: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
  },
  bannerText: { flex: 1, fontSize: FontSize.sm, lineHeight: 18 },
  emptyBox: {
    borderRadius: Radius.lg, padding: Spacing.xl,
    alignItems: 'center', gap: Spacing.sm,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  emptyBody: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },

  // Fields card
  fieldsCard: { borderRadius: Radius.lg, overflow: 'hidden' },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    gap: Spacing.md,
  },
  iconBadge: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  fieldBody: { flex: 1, gap: 3 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  fieldLabelText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  fieldValueInput: {
    fontSize: 15, lineHeight: 21,
    paddingVertical: 0, paddingHorizontal: 0,
  },
  deleteBtn: { paddingTop: 10 },

  // Add field
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: 13,
    borderWidth: 1, borderRadius: Radius.lg, borderStyle: 'dashed',
  },
  addBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  // Notes
  notesCard: { borderRadius: Radius.lg, overflow: 'hidden', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: 8 },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  notesLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  notesInput: { fontSize: FontSize.sm, lineHeight: 20, minHeight: 70 },

  // Footer
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 36,
    gap: 6,
  },
  solidBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: 15, borderRadius: Radius.md,
  },
  solidBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  ghostBtn: { alignItems: 'center', paddingVertical: 10 },
  ghostBtnText: { fontSize: FontSize.sm },

  // Shared modal overlay
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 44,
    maxHeight: '70%',
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowText: { fontSize: FontSize.md },

  // Add field inputs
  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 6 },
  chipScroll: { maxHeight: 40, marginBottom: 10 },
  chip: {
    borderWidth: 1, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6, marginRight: 7,
  },
  chipText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  textField: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, height: 44,
    fontSize: FontSize.sm,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  sheetCancelBtn: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center' },
  sheetCancelText: { fontSize: FontSize.md },
  sheetConfirmBtn: { flex: 1, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center' },
  sheetConfirmText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },

  // Lightbox
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: '92%', height: '60%', borderRadius: Radius.lg },
  lightboxClose: {
    position: 'absolute', top: 52, right: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: 9,
  },

  // Success
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, textAlign: 'center', marginTop: 4 },
  successSub: { fontSize: FontSize.md, textAlign: 'center' },
});
