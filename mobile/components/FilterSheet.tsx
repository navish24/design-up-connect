import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { ActiveFilters, ZoneType } from '../data/showTypes';

interface Props {
  visible: boolean;
  allBrandCategories: string[];
  activeFilters: ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  onClose: () => void;
}

const ZONE_CHIPS: { label: string; value: ZoneType }[] = [
  { label: 'Cafés', value: 'cafe' },
  { label: 'Lounges', value: 'lounge' },
  { label: 'Washrooms', value: 'washroom' },
];

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function FilterSheet({
  visible,
  allBrandCategories,
  activeFilters,
  onChange,
  onClose,
}: Props): React.ReactElement {
  function toggleZone(value: ZoneType): void {
    const current = activeFilters.zoneTypes;
    const next = current.includes(value)
      ? current.filter((z) => z !== value)
      : [...current, value];
    onChange({ ...activeFilters, zoneTypes: next });
  }

  function toggleBrandCategory(value: string): void {
    const current = activeFilters.brandCategories;
    const next = current.includes(value)
      ? current.filter((c) => c !== value)
      : [...current, value];
    onChange({ ...activeFilters, brandCategories: next });
  }

  function clearAll(): void {
    onChange({ brandCategories: [], zoneTypes: [] });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet card */}
      <View style={styles.sheet}>
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Filter</Text>
          <Pressable onPress={clearAll} hitSlop={8}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section: Location Type */}
          <Text style={styles.sectionLabel}>LOCATION TYPE</Text>
          <View style={styles.chipRow}>
            {ZONE_CHIPS.map(({ label, value }) => {
              const active = activeFilters.zoneTypes.includes(value);
              return (
                <Pressable
                  key={value}
                  style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                  onPress={() => toggleZone(value)}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Section: Brand Category */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>BRAND CATEGORY</Text>
          <View style={styles.chipWrap}>
            {allBrandCategories.map((cat) => {
              const active = activeFilters.brandCategories.includes(cat);
              return (
                <Pressable
                  key={cat}
                  style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                  onPress={() => toggleBrandCategory(cat)}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Apply button */}
        <View style={styles.applyContainer}>
          <Pressable style={styles.applyButton} onPress={onClose}>
            <Text style={styles.applyButtonText}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.70,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 16,
  },
  handleBar: {
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#6B7280',
    marginBottom: 12,
  },
  sectionLabelSpaced: {
    marginTop: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderColor: '#D1D5DB',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: '#374151',
  },
  applyContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  applyButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
