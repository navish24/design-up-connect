import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import FloorMap from '../components/FloorMap';
import EventsScreen from '../components/EventsScreen';
import InfoScreen from '../components/InfoScreen';

type MapTab = 'map' | 'events' | 'info';

const TAB_BAR_H = 56;

export default function MapScreen() {
  const [activeTab, setActiveTab] = useState<MapTab>('map');
  // Pending zone navigation from Events tab → Map tab
  const [pendingZoneId, setPendingZoneId] = useState<string | null>(null);

  function handleNavigateToZone(zoneId: string) {
    setPendingZoneId(zoneId);
    setActiveTab('map');
  }

  function handleZoneNavHandled() {
    setPendingZoneId(null);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Venue Map', headerShown: true }} />
      <View style={styles.root}>
        {/* ── Tab content ── */}
        <View style={styles.content}>
          {activeTab === 'map' && (
            <FloorMap
              bottomInset={TAB_BAR_H}
              initialZoneId={pendingZoneId}
              onViewEvents={() => setActiveTab('events')}
            />
          )}
          {activeTab === 'events' && (
            <EventsScreen onNavigateToZone={handleNavigateToZone} />
          )}
          {activeTab === 'info' && (
            <InfoScreen />
          )}
        </View>

        {/* ── Tab bar ── */}
        <View style={styles.tabBar}>
          <TabBtn label="Map"    active={activeTab === 'map'}    onPress={() => setActiveTab('map')} />
          <TabBtn label="Events" active={activeTab === 'events'} onPress={() => setActiveTab('events')} />
          <TabBtn label="Info"   active={activeTab === 'info'}   onPress={() => setActiveTab('info')} />
        </View>
      </View>
    </>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tabBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1 },

  tabBar: {
    height: TAB_BAR_H,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    paddingBottom: Platform.OS === 'ios' ? 0 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 10,
  },
  tabBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  tabIndicator: {
    width: 24, height: 3, borderRadius: 2,
    backgroundColor: 'transparent', marginBottom: 4,
  },
  tabIndicatorActive: { backgroundColor: '#2980b9' },
  tabLabel:           { fontSize: 12, color: '#aaa', fontWeight: '600' },
  tabLabelActive:     { color: '#2980b9' },
});
