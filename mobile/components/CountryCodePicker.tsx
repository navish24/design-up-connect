import { View, Text, Pressable, Modal, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const COUNTRY_CODES: Array<{ code: string; flag: string; label: string }> = [
  { code: '+91', flag: '🇮🇳', label: 'India' },
  { code: '+1', flag: '🇺🇸', label: 'USA / Canada' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+971', flag: '🇦🇪', label: 'UAE' },
  { code: '+65', flag: '🇸🇬', label: 'Singapore' },
  { code: '+974', flag: '🇶🇦', label: 'Qatar' },
  { code: '+966', flag: '🇸🇦', label: 'Saudi Arabia' },
  { code: '+49', flag: '🇩🇪', label: 'Germany' },
  { code: '+33', flag: '🇫🇷', label: 'France' },
  { code: '+39', flag: '🇮🇹', label: 'Italy' },
  { code: '+60', flag: '🇲🇾', label: 'Malaysia' },
  { code: '+61', flag: '🇦🇺', label: 'Australia' },
  { code: '+81', flag: '🇯🇵', label: 'Japan' },
  { code: '+86', flag: '🇨🇳', label: 'China' },
];

interface Props {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  colors: any;
}

export function CountryCodePicker({ visible, selected, onSelect, onClose, colors }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <View
          style={[s.sheet, { backgroundColor: colors.surface }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[s.handle, { backgroundColor: colors.border }]} />
          <Text style={[s.title, { color: colors.text }]}>Country Code</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {COUNTRY_CODES.map(({ code, flag, label }) => (
              <Pressable
                key={code}
                style={[s.row, { borderBottomColor: colors.border }]}
                onPress={() => { onSelect(code); onClose(); }}
              >
                <Text style={s.flag}>{flag}</Text>
                <Text style={[s.rowLabel, { color: colors.text, flex: 1 }]}>{label}</Text>
                <Text style={[s.rowCode, { color: colors.textMuted }]}>{code}</Text>
                {selected === code && (
                  <Ionicons name="checkmark" size={16} color={colors.accent} style={{ marginLeft: 8 }} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 44, paddingTop: 12, maxHeight: '72%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 20, marginRight: 12 },
  rowLabel: { fontSize: 15 },
  rowCode: { fontSize: 14, fontWeight: '600' },
});
