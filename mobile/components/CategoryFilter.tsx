import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { StallType } from '../data/venue-map';

export type ActiveFilter = StallType | 'all';

const FILTERS: { value: ActiveFilter; label: string; color: string }[] = [
  { value: 'all',       label: 'All',        color: '#555' },
  { value: 'brand',     label: 'Brands',     color: '#c0392b' },
  { value: 'cafe',      label: 'Cafés',      color: '#e67e22' },
  { value: 'lounge',    label: 'Lounges',    color: '#8e44ad' },
  { value: 'feature',   label: 'Features',   color: '#c0392b' },
  { value: 'directory', label: 'Directories',color: '#4a4aaa' },
  { value: 'service',   label: 'Services',   color: '#27ae60' },
  { value: 'entry',     label: 'Entry',      color: '#27ae60' },
  { value: 'exit',      label: 'Exit',       color: '#e74c3c' },
];

interface Props {
  active: ActiveFilter;
  onChange: (f: ActiveFilter) => void;
  topOffset?: number;
}

export default function CategoryFilter({ active, onChange, topOffset = 56 }: Props) {
  return (
    <ScrollView
      horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={[styles.scroll, { top: topOffset }]}
    >
      {FILTERS.map(f => {
        const isActive = f.value === active;
        return (
          <TouchableOpacity
            key={f.value}
            style={[styles.chip, isActive && { backgroundColor: f.color, borderColor: f.color }]}
            onPress={() => onChange(f.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { position: 'absolute', top: 56, left: 0, right: 0 },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  chipText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
});
