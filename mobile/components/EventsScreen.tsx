import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { getShowData } from '../lib/showDataService';
import type { ShowJSON } from '../data/showTypes';

interface Props {
  onNavigateToZone?: (zoneId: string) => void;
}

export default function EventsScreen({ onNavigateToZone }: Props) {
  const [show, setShow]       = useState<ShowJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<1 | 2>(1);

  useEffect(() => {
    getShowData()
      .then(data => { setShow(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2980b9" />
      </View>
    );
  }
  if (!show) return null;

  const startDate = new Date(show.meta.dates.start);
  function dayDate(day: 1 | 2) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + (day - 1));
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }

  const events = show.events.filter(e => e.day === activeDay);
  const zoneMap = new Map(show.specialZones.map(z => [z.id, z]));

  return (
    <View style={styles.root}>
      {/* Day selector */}
      <View style={styles.dayBar}>
        {([1, 2] as const).map(day => (
          <TouchableOpacity
            key={day}
            style={[styles.dayBtn, activeDay === day && styles.dayBtnActive]}
            onPress={() => setActiveDay(day)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dayLabel, activeDay === day && styles.dayLabelActive]}>
              Day {day}
            </Text>
            <Text style={[styles.dayDate, activeDay === day && styles.dayDateActive]}>
              {dayDate(day)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {events.length === 0 ? (
          <Text style={styles.empty}>No events scheduled for this day.</Text>
        ) : (
          events.map(evt => {
            const zone = zoneMap.get(evt.locationZoneId);
            return (
              <View key={evt.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.time}>{evt.time}</Text>
                  {evt.inviteOnly && (
                    <View style={styles.inviteBadge}>
                      <Text style={styles.inviteTxt}>Invite Only</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.title}>{evt.title}</Text>
                <Text style={styles.desc}>{evt.description}</Text>
                {zone && (
                  <View style={styles.locationRow}>
                    <View style={styles.locationDot} />
                    <Text style={styles.locationName}>{zone.name}</Text>
                  </View>
                )}
                {onNavigateToZone && zone && (
                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={() => onNavigateToZone(evt.locationZoneId)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.navBtnTxt}>Navigate to Location</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#f5f6f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  dayBar: {
    flexDirection: 'row', gap: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  dayBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  dayBtnActive: { backgroundColor: '#2980b9', borderColor: '#2980b9' },
  dayLabel:      { fontSize: 14, fontWeight: '700', color: '#555' },
  dayLabelActive:{ color: '#fff' },
  dayDate:       { fontSize: 12, color: '#aaa', marginTop: 2 },
  dayDateActive: { color: 'rgba(255,255,255,0.75)' },

  list:  { padding: 16, gap: 14 },
  empty: { textAlign: 'center', color: '#bbb', fontSize: 14, marginTop: 48 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: { fontSize: 12, color: '#888', fontWeight: '600' },
  inviteBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  inviteTxt: { fontSize: 11, color: '#D97706', fontWeight: '700' },

  title: { fontSize: 17, fontWeight: '700', color: '#111', lineHeight: 24 },
  desc:  { fontSize: 13, color: '#666', lineHeight: 20 },

  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2,
  },
  locationDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8e44ad' },
  locationName: { fontSize: 13, color: '#555', fontWeight: '600' },

  navBtn: {
    backgroundColor: '#2980b9', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  navBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
