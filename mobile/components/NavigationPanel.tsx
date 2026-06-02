import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Stall } from '../data/venue-map';

interface FieldRowProps {
  label: string;
  dotColor: string;
  stall: Stall | null;
  search: string;
  placeholder: string;
  onChangeText: (t: string) => void;
  onClear: () => void;
  onFocus: () => void;
}

function FieldRow({ label, dotColor, stall, search, placeholder, onChangeText, onClear, onFocus }: FieldRowProps) {
  return (
    <View style={styles.fieldRow}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {stall ? (
          <View style={styles.chip}>
            <Text style={[styles.chipText, { color: dotColor }]} numberOfLines={1}>{stall.label}</Text>
            <TouchableOpacity onPress={onClear} hitSlop={10}>
              <Text style={styles.chipClear}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#bbb"
            onFocus={onFocus}
            returnKeyType="search"
            autoCorrect={false}
          />
        )}
      </View>
    </View>
  );
}

interface Props {
  pointA: Stall | null;
  pointB: Stall | null;
  searchA: string;
  searchB: string;
  onChangeA: (t: string) => void;
  onChangeB: (t: string) => void;
  onClearA: () => void;
  onClearB: () => void;
  onFocusA: () => void;
  onFocusB: () => void;
  onSwap: () => void;
}

export default function NavigationPanel(props: Props) {
  const {
    pointA, pointB, searchA, searchB,
    onChangeA, onChangeB, onClearA, onClearB,
    onFocusA, onFocusB, onSwap,
  } = props;

  return (
    <View style={styles.panel}>
      <FieldRow
        label="You are at"
        dotColor="#2980b9"
        stall={pointA}
        search={searchA}
        placeholder="Tap a stall or type to search…"
        onChangeText={onChangeA}
        onClear={onClearA}
        onFocus={onFocusA}
      />

      {/* Vertical connector line between dots */}
      <View style={styles.connector} />

      <FieldRow
        label="Going to"
        dotColor="#27ae60"
        stall={pointB}
        search={searchB}
        placeholder="Tap a stall or type to search…"
        onChangeText={onChangeB}
        onClear={onClearB}
        onFocus={onFocusB}
      />

      {/* Swap button — only when at least one point is set */}
      {(pointA || pointB) && (
        <TouchableOpacity style={styles.swapBtn} onPress={onSwap} hitSlop={10}>
          <Text style={styles.swapBtnText}>⇅</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    paddingTop: 14, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 12, zIndex: 40,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 52 },
  dot: { width: 13, height: 13, borderRadius: 7, marginTop: 18, flexShrink: 0 },
  fieldBody: { flex: 1, paddingTop: 4 },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: '#aaa',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2,
  },
  input: { fontSize: 15, color: '#111', paddingVertical: 3 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f4f4f4', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  chipText: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  chipClear: { fontSize: 14, color: '#bbb' },

  // Dotted line connecting the two dots
  connector: {
    width: 1, height: 10, backgroundColor: '#ddd',
    marginLeft: 22, marginVertical: 2,
    borderStyle: 'dashed',
  },

  swapBtn: {
    position: 'absolute', right: 16, top: '50%',
    marginTop: -18,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0',
    alignItems: 'center', justifyContent: 'center',
  },
  swapBtnText: { fontSize: 18, color: '#666' },
});
