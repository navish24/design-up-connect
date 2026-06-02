import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { getShowData } from '../lib/showDataService';
import type { ShowJSON } from '../data/showTypes';

export default function InfoScreen() {
  const [show, setShow]       = useState<ShowJSON | null>(null);
  const [loading, setLoading] = useState(true);

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

  const { meta } = show;

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  const entries  = show.stalls.filter(s => s.stallType === 'entry');
  const exits    = show.stalls.filter(s => s.stallType === 'exit');
  const services = show.stalls.filter(s => s.stallType === 'service');

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Show hero */}
      <View style={styles.hero}>
        <Text style={styles.heroName}>{meta.name}</Text>
        <Text style={styles.heroVenue}>{meta.venue}</Text>
        <Text style={styles.heroDates}>
          {fmtDate(meta.dates.start)} – {fmtDate(meta.dates.end)}
        </Text>
      </View>

      {/* Opening hours */}
      <Section title="Opening Hours">
        <InfoRow left="Hours" right={meta.hours} />
      </Section>

      {/* Location */}
      {meta.address && (
        <Section title="Venue Address">
          <Text style={styles.address}>{meta.address}</Text>
        </Section>
      )}

      {/* Entry & Exit */}
      <Section title="Entry & Exit">
        {entries.map(s => (
          <InfoRow key={s.id} left="Entry" right={s.brandName} accent="#27ae60" />
        ))}
        {exits.map(s => (
          <InfoRow key={s.id} left="Exit" right={s.brandName} accent="#e74c3c" />
        ))}
        {entries.length === 0 && exits.length === 0 && (
          <Text style={styles.empty}>No entry/exit information available.</Text>
        )}
      </Section>

      {/* Services */}
      {services.length > 0 && (
        <Section title="Services">
          {services.map(s => (
            <InfoRow key={s.id} left="Service" right={s.brandName} />
          ))}
        </Section>
      )}

      {/* Show stats */}
      <Section title="About the Show">
        <InfoRow left="Exhibitors" right={`${show.stalls.filter(s => s.stallType === 'brand').length} brands`} />
        <InfoRow left="Events"     right={`${show.events.length} programmed talks`} />
        <InfoRow left="Cafés"      right={`${show.specialZones.filter(z => z.type === 'cafe').length} AD Cafés`} />
      </Section>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function InfoRow({ left, right, accent }: { left: string; right: string; accent?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLeft}>{left}</Text>
      <Text style={[styles.rowRight, accent ? { color: accent } : undefined]}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#f5f6f7' },
  content: { padding: 16, gap: 14 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: {
    backgroundColor: '#0f2a44', borderRadius: 18,
    paddingHorizontal: 22, paddingVertical: 24, gap: 6,
  },
  heroName:   { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroVenue:  { fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  heroDates:  { fontSize: 13, color: '#5dade2', fontWeight: '600', marginTop: 4 },

  section: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#aaa',
    letterSpacing: 0.8, textTransform: 'uppercase',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 10 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  rowLeft:  { fontSize: 13, color: '#888', fontWeight: '500' },
  rowRight: { fontSize: 14, color: '#111', fontWeight: '600', textAlign: 'right', flexShrink: 1, marginLeft: 12 },

  address: { fontSize: 14, color: '#555', lineHeight: 22, paddingVertical: 8 },
  empty:   { fontSize: 13, color: '#bbb', paddingVertical: 8 },
});
