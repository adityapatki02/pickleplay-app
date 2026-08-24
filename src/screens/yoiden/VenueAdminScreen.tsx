import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import type { MeStackParamList } from '../../navigation/nav-types';
import { YColors, YDisplay, YUiText } from '../../components/yoiden';
import { venuesApi } from '../../api/venues.api';
import type { Venue } from '../../types/booking.types';
import VenueBookingBoard from '../../components/venue/VenueBookingBoard';

type Props = NativeStackScreenProps<MeStackParamList, 'VenueAdmin'>;

const Chevron = ({ open }: { open: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export default function VenueAdminScreen({ route }: Props) {
  const nav = useNavigation();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    venuesApi.getMyVenues().then((res: any) => {
      const list: Venue[] = res?.data?.data ?? res?.data ?? [];
      const owned = Array.isArray(list) ? list : [];
      setVenues(owned);
      // Prefer the venue we were opened with (e.g. from "My court"); else the
      // sole venue auto-selects so the slots show without picking anything.
      const wanted = route.params?.venueId
        ? owned.find(v => v.id === route.params.venueId)
        : null;
      if (wanted) setSelectedVenue(wanted);
      else if (owned.length === 1) setSelectedVenue(owned[0]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
          <YDisplay size={32} color={YColors.accent} style={{ marginTop: 8 }}>
            VENUE ADMIN
          </YDisplay>

          {/* Primary CTA — the dashboard is the most valuable screen; keep it unmissable. */}
          <Pressable
            onPress={() => (nav as any).navigate('OwnerDashboard', { venueId: selectedVenue?.id })}
            style={styles.dashCta}
          >
            <View style={styles.dashCtaIcon}>
              <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                <Path d="M3 13h4v8H3zM10 3h4v18h-4zM17 9h4v12h-4z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <YUiText size={14} weight={900} color={YColors.accent} style={{ letterSpacing: 0.3 }}>VIEW FULL DASHBOARD</YUiText>
              <YUiText size={11} color={YColors.ink3} style={{ marginTop: 1 }}>Revenue, demand, customers &amp; more</YUiText>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M9 6l6 6-6 6" stroke={YColors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>

        <View style={styles.content}>
          {/* Venue picker — only when the owner has more than one venue */}
          {venues.length > 1 && (
            <View style={{ marginBottom: 20 }}>
              <YUiText size={12} weight={700} color={YColors.ink2} style={styles.dropdownLabel}>SELECT YOUR VENUE</YUiText>
              <View style={styles.dropdownWrap}>
                <Pressable style={styles.dropdownTrigger} onPress={() => setDropdownOpen(o => !o)}>
                  <YUiText size={14} color={selectedVenue ? YColors.ink : YColors.ink3} style={{ flex: 1 }}>
                    {selectedVenue ? selectedVenue.name : 'Choose a location'}
                  </YUiText>
                  <Chevron open={dropdownOpen} />
                </Pressable>
                {dropdownOpen && (
                  <View style={styles.dropdownList}>
                    {venues.map((v, i) => (
                      <Pressable
                        key={v.id}
                        style={[styles.dropdownItem, i < venues.length - 1 && styles.itemBorder, selectedVenue?.id === v.id && styles.dropdownItemActive]}
                        onPress={() => { setSelectedVenue(v); setDropdownOpen(false); }}
                      >
                        <YUiText size={14} color={YColors.ink}>{v.name}</YUiText>
                        <YUiText size={11} color={YColors.ink3} style={{ marginTop: 2 }} numberOfLines={1}>{v.address}</YUiText>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* The full booking board (cashflow + sport + date + grid + modals) */}
          {selectedVenue && <VenueBookingBoard venue={selectedVenue} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: { flexDirection: 'column', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  dashCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#EEF1F6', borderWidth: 1, borderColor: '#E1E6EE',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    marginTop: 16, alignSelf: 'stretch',
    shadowColor: '#0A1B3D', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  dashCtaIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: YColors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: 16 },

  dropdownLabel: { marginBottom: 8, letterSpacing: 1 },
  dropdownWrap: {},
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: YColors.bg, borderWidth: 1.5, borderColor: YColors.line2,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  dropdownList: {
    backgroundColor: YColors.bg, borderWidth: 1.5, borderColor: YColors.line2,
    borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 14 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: YColors.line },
  dropdownItemActive: { backgroundColor: 'rgba(24,88,214,0.07)' },
});
