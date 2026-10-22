// Events: every event on Yoiden, in the same tabs as yoiden.com/events
// (Live · Upcoming · Registrations · Past events · Past auctions), with a
// sport filter. Opens on Live when something is on.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppHeader, Page } from '../components/chrome';
import { EventRow, RegistrationRow, useAllRegistrations } from '../components/tiles';
import { Chip, ChipRow, Empty, SegTabs } from '../components/ui';
import { SearchIcon } from '../components/icons';
import { EVENTS, byDateDesc, isAuction, statusOf, type YoidenEvent } from '../data/events';
import { useNow } from '../hooks';
import { C, MAX_W, card } from '../theme';

const TABS = [
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'registrations', label: 'Registrations' },
  { key: 'past', label: 'Past events' },
  { key: 'auctions', label: 'Past auctions' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default function EventsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const now = useNow();
  const { width } = useWindowDimensions();
  const anyLive = EVENTS.some((e) => statusOf(e, now) === 'live');
  const [tab, setTab] = useState<Tab>(anyLive ? 'live' : 'upcoming');
  const [sport, setSport] = useState<string>('All');
  const regs = useAllRegistrations(now);

  // Home's "See all" links open a specific tab.
  useEffect(() => {
    const t = route.params?.tab as Tab | undefined;
    if (t && TABS.some((x) => x.key === t)) {
      setTab(t);
      setSport('All');
    }
  }, [route.params?.tab]);

  const list = useMemo(() => {
    const st = (e: YoidenEvent) => statusOf(e, now);
    switch (tab) {
      case 'live':
        return EVENTS.filter((e) => st(e) === 'live');
      case 'upcoming':
        return EVENTS.filter((e) => st(e) === 'upcoming').sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
      case 'past':
        return EVENTS.filter((e) => st(e) === 'past' && !isAuction(e)).sort(byDateDesc);
      case 'auctions':
        return EVENTS.filter((e) => st(e) === 'past' && isAuction(e)).sort(byDateDesc);
      default:
        return [];
    }
  }, [tab, now]);

  const sports = useMemo(() => [...new Set(list.map((e) => e.sport))], [list]);
  const shown = sport === 'All' ? list : list.filter((e) => e.sport === sport);

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader
        title="Events"
        right={
          <Pressable onPress={() => nav.navigate('Search')} hitSlop={10}>
            <SearchIcon size={20} />
          </Pressable>
        }
      />
      <Page padded={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <SegTabs
            tabs={TABS}
            value={tab}
            onChange={(t) => {
              setTab(t);
              setSport('All');
            }}
          />
        </View>
        {tab !== 'registrations' && sports.length > 1 && (
          <View style={{ marginTop: 12 }}>
            <ChipRow>
              {['All', ...sports].map((s) => (
                <Chip key={s} on={s === sport} onPress={() => setSport(s)}>
                  {s}
                </Chip>
              ))}
            </ChipRow>
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginTop: 14 }}>
          {tab === 'registrations' ? (
            regs.length ? (
              <View style={[card, { width: '100%', overflow: 'hidden' }]}>
                {regs.map((o, i) => (
                  <RegistrationRow key={o.r.id} {...o} last={i === regs.length - 1} />
                ))}
              </View>
            ) : (
              <View style={{ width: '100%' }}>
                <Empty>No registration forms yet.</Empty>
              </View>
            )
          ) : shown.length ? (
            <View style={[card, { width: '100%', overflow: 'hidden' }]}>
              {shown.map((e, i) => (
                <EventRow
                  key={e.id}
                  e={e}
                  status={statusOf(e, now)}
                  last={i === shown.length - 1}
                  onPress={() => nav.navigate('Event', { id: e.id })}
                />
              ))}
            </View>
          ) : (
            <View style={{ width: '100%' }}>
              <Empty>
                {tab === 'live'
                  ? "No events are live right now. See what's coming up under Upcoming."
                  : tab === 'upcoming'
                    ? 'Nothing scheduled right now. Check back soon.'
                    : 'Nothing here yet.'}
              </Empty>
            </View>
          )}
        </View>
      </Page>
    </View>
  );
}
