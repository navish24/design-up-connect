import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Stall, StallType } from '../data/venue-map';

const TYPE_COLOR: Record<StallType, string> = {
  brand: '#c0392b', cafe: '#e67e22', lounge: '#8e44ad',
  feature: '#c0392b', directory: '#4a4aaa',
  service: '#27ae60', entry: '#27ae60', exit: '#e74c3c',
};

const TYPE_LABEL: Record<StallType, string> = {
  brand: 'Brand', cafe: 'Café', lounge: 'Lounge',
  feature: 'Feature', directory: 'Directory',
  service: 'Service', entry: 'Entry', exit: 'Exit',
};

interface Props {
  stall: Stall;
  onNavigate: (stall: Stall) => void;
  onViewProfile: (stall: Stall) => void;
  onClose: () => void;
}

export default function StallMiniCard({ stall, onNavigate, onViewProfile, onClose }: Props) {
  const isBrand = stall.type === 'brand' || stall.type === 'feature';
  const color = TYPE_COLOR[stall.type];

  return (
    <View style={styles.card}>
      <View style={styles.handle} />

      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={[styles.typeBadge, { backgroundColor: color }]}>
          <Text style={styles.typeBadgeText}>{TYPE_LABEL[stall.type]}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.name} numberOfLines={2}>{stall.label}</Text>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnNav]}
          onPress={() => onNavigate(stall)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnNavText}>Navigate Here</Text>
        </TouchableOpacity>
        {isBrand && (
          <TouchableOpacity
            style={[styles.btn, styles.btnProfile]}
            onPress={() => onViewProfile(stall)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnProfileText}>View Profile</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, paddingBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  typeBadge: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, marginRight: 'auto' as any,
  },
  typeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#aaa' },
  name: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 16, lineHeight: 26 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
  },
  btnNav: { backgroundColor: '#c0392b' },
  btnNavText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnProfile: { backgroundColor: '#f2f2f2' },
  btnProfileText: { color: '#333', fontWeight: '600', fontSize: 15 },
});
