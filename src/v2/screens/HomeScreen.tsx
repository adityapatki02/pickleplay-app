// Home leads with live events, followed events and readable discovery lists.
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { AppHeader, Page } from '../components/chrome';
import { CompactEventTile, EventRow, RegistrationRow, useOpenRegistrations } from '../components/tiles';
import { SectionLabel } from '../components/ui';
import { ChevronRight, StarIcon } from '../components/icons';
import { EVENTS, byDateDesc, isAuction, statusOf, type YoidenEvent } from '../data/events';
import { useFollows } from '../store/follows';
import { useNow } from '../hooks';
import { useLiveSnapshots } from '../store/live';
import { useEventListState } from '../store/event-list';
import { LiveEventCard } from '../components/live-card';
import { C, MAX_W, body, card, head, label } from '../theme';

const ORDER = { live: 0, upcoming: 1, past: 2 } as const;

function Row({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
      {children}
    </ScrollView>
  );
}

/** How many rows each list on Home shows before "See all". */
const LIST_MAX = 3;

/** White card holding list rows. */
function List({ children }: { children: React.ReactNode }) {
  return <View style={[card, { marginHorizontal: 16, overflow: 'hidden' }]}>{children}</View>;
}

function EventList({ events, status, onOpen }: { events: YoidenEvent[]; status: 'upcoming' | 'past'; onOpen: (e: YoidenEvent) => void }) {
  const shown = events.slice(0, LIST_MAX);
  return (
    <List>
      {shown.map((e, i) => (
        <EventRow key={e.id} e={e} status={status} hideStatus last={i === shown.length - 1} onPress={() => onOpen(e)} />
      ))}
    </List>
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
  const { width } = useWindowDimensions();
  const [livePage, setLivePage] = useState(0);
  const focused = useIsFocused();
  // Explicit, development-only preview. Event records and actual statuses stay untouched.
  const previewLive = __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('previewLive') === '3';
  const now = useNow();
  const followIds = useFollows((s) => s.ids);
  const listVersion = useEventListState((s) => s.version);
  const regs = useOpenRegistrations(now);
  const open = (e: YoidenEvent) => nav.navigate('Event', { id: e.id });

  const { following, live: liveEvents, soon, recent, auctions } = useMemo(() => {
    const st = (e: YoidenEvent) => statusOf(e, now);
    const following = followIds
      .map((id) => EVENTS.find((e) => e.id === id))
      .filter((e): e is YoidenEvent => !!e)
      .sort((a, b) => ORDER[st(a)] - ORDER[st(b)]);
    const actualLive = EVENTS.filter((e) => st(e) === 'live');
    const previewEvents = ['Badminton', 'Cricket', 'Pickleball'].map((sport) =>
      EVENTS.find((e) => e.sport === sport && !isAuction(e))!,
    ).map((e) => ({ ...e, start: undefined, end: undefined, when: 'Live-event layout preview' }));
    const live = (previewLive ? previewEvents : actualLive)
      .sort((a, b) => Number(followIds.includes(b.id)) - Number(followIds.includes(a.id)));
    const soon = EVENTS.filter((e) => st(e) === 'upcoming').sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
    const past = EVENTS.filter((e) => st(e) === 'past').sort(byDateDesc);
    return {
      following,
      live,
      soon: soon.slice(0, 8),
      recent: past.filter((e) => !isAuction(e)).slice(0, 8),
      auctions: past.filter(isAuction).slice(0, 8),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followIds, now, previewLive, listVersion]);
  // Followed first, then the busiest: most matches on right now.
  const fetched = useLiveSnapshots(liveEvents, focused);
  // The design preview's sample events are past, so dress their latest result as live.
  const snaps = useMemo(() => {
    if (!previewLive) return fetched;
    return Object.fromEntries(Object.entries(fetched).map(([id, sn], i) => [id, {
      liveCount: 3 - i,
      match: sn.match && { ...sn.match, live: true, detail: sn.match.detail ?? 'Game 3 · 14–11' },
    }]));
  }, [fetched, previewLive]);
  const live = useMemo(() => {
    const followed = (e: YoidenEvent) => Number(followIds.includes(e.id));
    return [...liveEvents].sort((a, b) => followed(b) - followed(a) || (snaps[b.id]?.liveCount ?? 0) - (snaps[a.id]?.liveCount ?? 0));
  }, [liveEvents, snaps, followIds]);
  const liveCardWidth = Math.min(width, MAX_W) - (live.length > 1 ? 72 : 32);

  // Keep the live row still while someone reads; additional events are a swipe away.
  useEffect(() => {
    setLivePage((page) => Math.min(page, Math.max(0, live.length - 1)));
  }, [live.length]);

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader search />
      <Page padded={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 0 }}>
          <Text style={head(26, C.bar)}>Your front row.</Text>
          <Text style={[body(14, C.soft), { marginTop: 6 }]}>Local leagues. Every score. All here.</Text>
        </View>
        {previewLive && <View style={{ marginHorizontal: 16, marginTop: 16, padding: 10, borderRadius: 8, backgroundColor: C.amberSoft }}><Text style={body(12, C.amber, 'semi')}>Design preview · 3 sample live events</Text></View>}
        {live.length > 0 && (
          <>
            <SectionLabel color={C.live} right={<SeeAll onPress={() => nav.navigate('EventsTab', { tab: 'live' })} />}>{`Live events · ${live.length}`}</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              snapToInterval={liveCardWidth + 12} decelerationRate="fast" snapToAlignment="start"
              disableIntervalMomentum scrollEventThrottle={32}
              onScroll={(e) => {
                const index = Math.max(0, Math.min(live.length - 1, Math.round(e.nativeEvent.contentOffset.x / (liveCardWidth + 12))));
                setLivePage(index);
              }}
              contentContainerStyle={{ paddingLeft: 16, paddingRight: Math.min(width, MAX_W) - liveCardWidth - 16, gap: 12 }}>
              {live.map((e, index) => (
                <LiveEventCard key={`${e.id}-${index}`} e={e} width={liveCardWidth} snap={snaps[e.id]} onPress={() => open(e)} />
              ))}
            </ScrollView>
            {live.length > 1 && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {live.map((e, i) => <View key={e.id} style={{ width: i === livePage ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === livePage ? C.bar : C.lineStrong }} />)}
              </View>
              <Text style={body(13, C.soft)}>Swipe for more</Text>
            </View>}
          </>
        )}
        {following.length > 0 ? (
          <>
            <SectionLabel right={<SeeAll onPress={() => nav.navigate('MyEventsTab')} text="View all" />}>★ Following</SectionLabel>
            <Row>
              {following.map((e) => (
                <CompactEventTile key={e.id} e={e} status={statusOf(e, now)} onPress={() => open(e)} />
              ))}
            </Row>
          </>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Browse events to follow" onPress={() => nav.navigate('EventsTab')} style={{ marginHorizontal: 16, marginTop: 20, paddingVertical: 12, flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line }}>
            <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
              <StarIcon size={18} color={C.bar} fill={C.bar} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={body(14, C.ink, 'bold')}>Follow your events</Text>
              <Text style={[body(13, C.soft), { lineHeight: 18, marginTop: 3 }]}>Save your leagues for quick access.</Text>
            </View>
            <ChevronRight color={C.mute} />
          </Pressable>
        )}



        {regs.length > 0 && (
          <>
            <SectionLabel right={<SeeAll onPress={() => nav.navigate('EventsTab', { tab: 'registrations' })} />}>Registrations open</SectionLabel>
            <List>
              {regs.slice(0, LIST_MAX).map((o, i, a) => (
                <RegistrationRow key={o.r.id} {...o} last={i === a.length - 1} />
              ))}
            </List>
          </>
        )}

        {soon.length > 0 && (
          <>
            <SectionLabel right={<SeeAll onPress={() => nav.navigate('EventsTab', { tab: 'upcoming' })} />}>Coming up</SectionLabel>
            <EventList events={soon} status="upcoming" onOpen={open} />
          </>
        )}

        {recent.length > 0 && <>
          <SectionLabel right={<SeeAll onPress={() => nav.navigate('EventsTab', { tab: 'past' })} />}>Recent events</SectionLabel>
          <EventList events={recent} status="past" onOpen={open} />
        </>}

        {auctions.length > 0 && <>
          <SectionLabel right={<SeeAll onPress={() => nav.navigate('EventsTab', { tab: 'auctions' })} />}>Recent auctions</SectionLabel>
          <EventList events={auctions} status="past" onOpen={open} />
        </>}
      </Page>
    </View>
  );
}
