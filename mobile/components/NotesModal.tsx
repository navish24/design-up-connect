import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import type { Note } from '../context/AuthContext';

const SCREEN_H = Dimensions.get('window').height;
// Sheet is always 58% of screen height — tall enough to show Add Note without scrolling
const SHEET_H = SCREEN_H * 0.58;
// Notes list gets everything between header and the pinned Add Note button
const NOTES_LIST_H = SHEET_H - 56 /* handle+header */ - 52 /* add btn */ - 40 /* padding */;

interface NotesModalProps {
  visible: boolean;
  onClose: () => void;
  entityName: string;
  notes: Note[];
  onAddNote: (text: string) => void;
  colors: any;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function NotesModal({ visible, onClose, entityName, notes, onAddNote, colors }: NotesModalProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const s = makeStyles(colors);

  if (!visible) return null;

  const handleSave = () => {
    if (!text.trim()) return;
    onAddNote(text.trim());
    setText('');
    setAdding(false);
  };

  const handleClose = () => {
    setText('');
    setAdding(false);
    onClose();
  };

  return (
    <View style={s.overlay} pointerEvents="box-none">
      <Pressable style={s.backdrop} onPress={handleClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.kavWrapper}
        pointerEvents="box-none"
      >
        <View style={[s.sheet, { backgroundColor: colors.background }]}>
          {/* Handle */}
          <View style={[s.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={s.sheetHeader}>
            {adding ? (
              <Pressable onPress={() => { setAdding(false); setText(''); }} style={s.iconBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>
            ) : (
              <View style={s.iconBtn} />
            )}
            <View style={s.headerCenter}>
              <Text style={[s.sheetTitle, { color: colors.text }]}>Notes</Text>
              <Text style={[s.sheetSub, { color: colors.textMuted }]} numberOfLines={1}>{entityName}</Text>
            </View>
            <Pressable onPress={handleClose} style={s.iconBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {adding ? (
            /* ── Add note view ── */
            <View style={s.addView}>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="What did you discuss? Any follow-ups?"
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus
                value={text}
                onChangeText={setText}
              />
              <Pressable
                style={[s.saveBtn, { backgroundColor: text.trim() ? colors.accent : colors.border }]}
                onPress={handleSave}
              >
                <Text style={[s.saveBtnText, { color: text.trim() ? '#FFF' : colors.textMuted }]}>Save Note</Text>
              </Pressable>
            </View>
          ) : (
            /* ── List view: scrollable notes + pinned Add Note ── */
            <>
              <ScrollView
                style={{ height: NOTES_LIST_H }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {notes.length === 0 ? (
                  <View style={s.emptyState}>
                    <Ionicons name="create-outline" size={28} color={colors.textMuted} />
                    <Text style={[s.emptyText, { color: colors.textMuted }]}>No notes yet</Text>
                    <Text style={[s.emptySub, { color: colors.textMuted }]}>Jot down what you discussed or follow-ups</Text>
                  </View>
                ) : (
                  notes.map((note) => (
                    <View key={note.id} style={[s.noteCard, { backgroundColor: colors.surface }]}>
                      <Text style={[s.noteText, { color: colors.text }]}>{note.text}</Text>
                      <Text style={[s.noteDate, { color: colors.textMuted }]}>{formatDate(note.created_at)}</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* Always-visible Add Note button */}
              <Pressable
                style={[s.addBtn, { backgroundColor: colors.accent }]}
                onPress={() => setAdding(true)}
              >
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={s.addBtnText}>Add Note</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      zIndex: 100,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    kavWrapper: {
      justifyContent: 'flex-end',
    },
    sheet: {
      height: SHEET_H,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      alignSelf: 'center', marginTop: Spacing.md, marginBottom: 4,
    },
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    iconBtn: { width: 32, alignItems: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    sheetTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    sheetSub: { fontSize: FontSize.xs, marginTop: 1 },

    emptyState: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
    emptyText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    emptySub: { fontSize: FontSize.sm, textAlign: 'center' },

    noteCard: {
      borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    noteText: { fontSize: FontSize.sm, lineHeight: 20 },
    noteDate: { fontSize: FontSize.xs, marginTop: 4 },

    // Pinned add button
    addBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
      borderRadius: Radius.md, paddingVertical: 13, marginTop: Spacing.sm,
    },
    addBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#FFF' },

    // Add note form
    addView: { flex: 1, gap: Spacing.md, paddingTop: Spacing.sm },
    input: {
      borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
      fontSize: FontSize.sm, flex: 1, textAlignVertical: 'top', lineHeight: 22,
    },
    saveBtn: { paddingVertical: 13, borderRadius: Radius.md, alignItems: 'center' },
    saveBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  });
}
