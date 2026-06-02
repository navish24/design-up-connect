import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SpecialZone, ShowEvent, ZoneType } from '../data/showTypes';

interface Props {
  zone: SpecialZone | null;
  events: ShowEvent[];
  onNavigateHere: (zone: SpecialZone) => void;
  onNavigateToStall: (stallId: string) => void;
  onViewAllEvents: () => void;
  onDismiss: () => void;
}

export default function ZoneCard({
  zone,
  events,
  onNavigateHere,
  onNavigateToStall,
  onViewAllEvents,
  onDismiss,
}: Props): React.ReactElement | null {
  if (!zone) return null;

  const nextEvent: ShowEvent | undefined = events.find(
    (e) => e.locationZoneId === zone.id,
  );

  function renderContent(): React.ReactElement {
    switch ((zone as SpecialZone).type as ZoneType) {
      case 'cafe':
        return <CafeContent zone={zone as SpecialZone} />;

      case 'lounge':
        return (
          <LoungeContent
            zone={zone as SpecialZone}
            nextEvent={nextEvent}
            onViewAllEvents={onViewAllEvents}
            onNavigateHere={onNavigateHere}
          />
        );

      case 'curated':
        return (
          <CuratedContent
            zone={zone as SpecialZone}
            onNavigateToStall={onNavigateToStall}
          />
        );

      case 'directory':
      case 'pro-directory':
        return <DirectoryContent zone={zone as SpecialZone} />;

      default:
        return (
          <DefaultContent
            zone={zone as SpecialZone}
            onNavigateHere={onNavigateHere}
          />
        );
    }
  }

  return (
    <View style={styles.card}>
      {/* Dismiss handle bar */}
      <Pressable style={styles.handleTouchArea} onPress={onDismiss}>
        <View style={styles.handleBar} />
      </Pressable>

      {renderContent()}
    </View>
  );
}

// ─── Cafe ────────────────────────────────────────────────────────────────────

function CafeContent({ zone }: { zone: SpecialZone }): React.ReactElement {
  return (
    <>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.cardTitle}>AD Café</Text>
          <Text style={styles.cardSubtitle}>Food & Beverages</Text>
        </View>
      </View>
      <ScrollView
        style={styles.itemList}
        contentContainerStyle={styles.itemListContent}
        showsVerticalScrollIndicator={false}
      >
        {(zone.items ?? []).map((item) => (
          <View key={item.id} style={styles.vendorRow}>
            <Text style={styles.vendorName}>{item.name}</Text>
            {item.category ? (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{item.category}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

// ─── Lounge ──────────────────────────────────────────────────────────────────

function LoungeContent({
  zone,
  nextEvent,
  onViewAllEvents,
  onNavigateHere,
}: {
  zone: SpecialZone;
  nextEvent: ShowEvent | undefined;
  onViewAllEvents: () => void;
  onNavigateHere: (zone: SpecialZone) => void;
}): React.ReactElement {
  return (
    <>
      <Text style={styles.cardTitle}>{zone.name}</Text>

      {nextEvent ? (
        <View style={styles.eventCard}>
          <Text style={styles.eventTime}>
            Day {nextEvent.day} · {nextEvent.time}
          </Text>
          <Text style={styles.eventTitle}>{nextEvent.title}</Text>
          {nextEvent.inviteOnly ? (
            <View style={styles.inviteChip}>
              <Text style={styles.inviteChipText}>Invite Only</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.emptyText}>No upcoming events scheduled.</Text>
      )}

      <Pressable style={styles.secondaryButton} onPress={onViewAllEvents}>
        <Text style={styles.secondaryButtonText}>See All Events</Text>
      </Pressable>

      <Pressable style={styles.primaryButton} onPress={() => onNavigateHere(zone)}>
        <Text style={styles.primaryButtonText}>Navigate Here</Text>
      </Pressable>
    </>
  );
}

// ─── Curated ─────────────────────────────────────────────────────────────────

function CuratedContent({
  zone,
  onNavigateToStall,
}: {
  zone: SpecialZone;
  onNavigateToStall: (stallId: string) => void;
}): React.ReactElement {
  return (
    <>
      <Text style={styles.cardTitle}>{zone.name}</Text>
      <ScrollView
        style={styles.itemList}
        contentContainerStyle={styles.itemListContent}
        showsVerticalScrollIndicator={false}
      >
        {(zone.items ?? []).map((item) => (
          <View key={item.id} style={styles.curatedRow}>
            <Text style={styles.curatedItemName}>{item.name}</Text>
            {item.stallId ? (
              <Pressable
                style={styles.navigateStallButton}
                onPress={() => onNavigateToStall(item.stallId as string)}
              >
                <Text style={styles.navigateStallText}>Navigate to Stall</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

// ─── Directory / Pro-Directory ───────────────────────────────────────────────

function DirectoryContent({ zone }: { zone: SpecialZone }): React.ReactElement {
  const items = zone.items ?? [];
  const description = items[0]?.description;

  return (
    <>
      <Text style={styles.cardTitle}>{zone.name}</Text>
      {description ? (
        <Text style={styles.descriptionText}>{description}</Text>
      ) : null}
      <ScrollView
        style={styles.itemList}
        contentContainerStyle={styles.itemListContent}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => (
          <View key={item.id} style={styles.directoryRow}>
            <Text style={styles.directoryItemName}>{item.name}</Text>
            {item.category ? (
              <Text style={styles.directoryItemCategory}>{item.category}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

// ─── Default ─────────────────────────────────────────────────────────────────

function DefaultContent({
  zone,
  onNavigateHere,
}: {
  zone: SpecialZone;
  onNavigateHere: (zone: SpecialZone) => void;
}): React.ReactElement {
  return (
    <>
      <Text style={styles.cardTitle}>{zone.name}</Text>
      <Pressable style={styles.primaryButton} onPress={() => onNavigateHere(zone)}>
        <Text style={styles.primaryButtonText}>Navigate Here</Text>
      </Pressable>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '60%',
    zIndex: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 20,
  },
  handleTouchArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  itemList: {
    marginTop: 4,
    maxHeight: 200,
  },
  itemListContent: {
    paddingBottom: 8,
    gap: 10,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  vendorName: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    flexShrink: 1,
    marginRight: 8,
  },
  categoryChip: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryChipText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
  },
  eventCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventTime: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  inviteChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  inviteChipText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginVertical: 14,
  },
  curatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  curatedItemName: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    flexShrink: 1,
    marginRight: 8,
  },
  navigateStallButton: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  navigateStallText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  directoryRow: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  directoryItemName: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  directoryItemCategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
