// Home: search at the top, then the events you follow, then what's live,
// registrations that are open, what's coming up and recent results. Rows
// scroll sideways, the same tiles as the yoiden.com strip.
import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppHeader, Page } from '../components/chrome';
import { CompactEventTile, RegistrationTile, useOpenRegistrations } from '../components/tiles';
import { SectionLabel } from '../components/ui';
import { ChevronRight, StarIcon } from '../components/icons';
import { EVENTS, byDateDesc, isAuction, statusOf, type YoidenEvent } from '../data/events';
import { useFollows } from '../store/follows';
import { useNow } from '../hooks';
import { C, body, card, label } from '../theme';

const ORDER = { live: 0, upcoming: 1, past: 2 } as const;

function Row({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
      {children}
    </ScrollView>
  );
}

function SeeAll({ onPress, text = 'See all' }: { onPress: () => void; text?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Text style={label(13, C.accent)}>{text}</Text>
      <ChevronRight size={14} color={C.accent} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const now = useNow();
  const followIds = useFollows((s) => s.ids);
  const regs = useOpenRegistrations(now);
  const open = (e: YoidenEvent) => nav.navigate('Event', { id: e.id });

  const { following, live, soon, recent, auctions } = useMemo(() => {
    const st = (e: YoidenEvent) => statusOf(e, now);
    const following = followIds
      .map((id) => EVENTS.find((e) => e.id === id))
      .filter((e): e is YoidenEvent => !!e)
      .sort((a, b) => ORDER[st(a)] - ORDER[st(b)]);
    const live = EVENTS.filter((e) => st(e) === 'live');
    const soon = EVENTS.filter((e) => st(e) === 'upcoming').sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
    const past = EVENTS.filter((e) => st(e) === 'past').sort(byDateDesc);
    return {
      following,
      live,
      soon: soon.slice(0, 8),
      recent: past.filter((e) => !isAuction(e)).slice(0, 8),
      auctions: past.filter(isAuction).slice(0, 8),
    };
  }, [followIds, now]);

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader search />
      <Page padded={false}>
        {following.length > 0 ? (
          <>
            <SectionLabel right={<SeeAll onPress={() => nav.navigate('MyEventsTab')} text="Manage" />}>★ Following</SectionLabel>
            <Row>
              {following.map((e) => (
                <CompactEventTile key={e.id} e={e} status={statusOf(e, now)} onPress={() => open(e)} />
              ))}
            </Row>
          </>
        ) : (
          <Pressable onPress={() => nav.navigate('EventsTab')} style={[card, { marginHorizontal: 16, marginTop: 16, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }]}>
            <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: C.hl, alignItems: 'center', justifyContent: 'center' }}>
              <StarIcon size={18} color={C.bar} fill={C.bar} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={body(14, C.ink, 'bold')}>Follow your events</Text>
              <Text style={body(12.5, C.soft)}>Tap Follow on any event and it stays at the top of Home.</Text>
            </View>
            <ChevronRight color={C.mute} />
          </Pressable>
        )}

        {live.length > 0 && (
          <>
            <SectionLabel color={C.live}>● Live now</SectionLabel>
            <Row>
              {live.map((e) => (
                <CompactEventTile key={e.id} e={e} status="live" onPress={() => open(e)} />
              ))}
            </Row>
          </>
        )}

        {regs.length > 0 && (
          <>
            <SectionLabel right={<SeeAll onPress={() => nav.navigate('EventsTab', { tab: 'registrations' })} />}>Registrations open</SectionLabel>
            <Row>
              {regs.map((o) => (
                <RegistrationTile key={o.r.id} {...o} compact />
              ))}
            </Row>
          </>
        )}

        {soon.length > 0 && (
          <>
            <SectionLabel right={<SeeAll onPress={() => nav.navigate('EventsTab', { tab: 'upcoming' })} />}>Coming up</SectionLabel>
            <Row>
              {soon.map((e) => (
                <CompactEventTile key={e.id} e={e} status="upcoming" onPress={() => open(e)} />
              ))}
            </Row>
          </>
        )}

        <SectionLabel right={<SeeAll onPress={() => nav.navigate('EventsTab', { tab: 'past' })} />}>Recent events</SectionLabel>
        <Row>
          {recent.map((e) => (
            <CompactEventTile key={e.id} e={e} status="past" onPress={() => open(e)} />
          ))}
        </Row>

        <SectionLabel right={<SeeAll onPress={() => nav.navigate('EventsTab', { tab: 'auctions' })} />}>Recent auctions</SectionLabel>
        <Row>
          {auctions.map((e) => (
            <CompactEventTile key={e.id} e={e} status="past" onPress={() => open(e)} />
          ))}
        </Row>
      </Page>
    </View>
  );
}
