// Admin mode for one event. A lime "Managing" bar sits on top with "View as
// public", which returns to the public event page. Match-day controls open the
// existing league tools (the 5,800-line LeagueDashboard and the scorer screens)
// until their v2 versions are built; people and registration management wait
// for roles-by-phone and in-app registration on the server.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Page } from '../components/chrome';
import { EventLogo, SectionLabel } from '../components/ui';
import { ChevronLeft, ChevronRight, GearIcon } from '../components/icons';
import { eventById } from '../data/events';
import { fetchLeague } from '../data/league-feed';
import { useLoad } from '../hooks';
import { C, MAX_W, body, card, head, label } from '../theme';

type Action = { title: string; sub: string; onPress?: () => void; soon?: boolean };

function Grid({ items }: { items: Action[] }) {
  return (
    <View style={s.grid}>
      {items.map((a) => (
        <Pressable
          key={a.title}
          disabled={!a.onPress}
          onPress={a.onPress}
          style={({ pressed }) => [card, s.action, a.soon && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={body(14.5, C.ink, 'bold')}>{a.title}</Text>
            <Text style={[body(12.5, C.soft), { marginTop: 2 }]}>{a.sub}</Text>
          </View>
          {a.soon ? <Text style={label(10.5, C.mute)}>Soon</Text> : <ChevronRight color={C.mute} />}
        </Pressable>
      ))}
    </View>
  );
}

export default function ManageScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { eventId, leagueId, slug } = useRoute<any>().params as { eventId: string; leagueId: string; slug: string };
  const event = eventById(eventId);
  const { state } = useLoad(`manage-${slug}`, () => fetchLeague(slug));
  const seasonId = state.status === 'ready' ? state.data.season.id : undefined;
  const division = event?.leagues && event.leagues.length > 1 ? event.leagues.find((l) => l.slug === slug)?.label : null;
  if (!event) return null;

  const go = (screen: string, params: object) => () => nav.navigate(screen, params);
  const ready = !!seasonId;

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      {/* Lime admin bar: always visible while managing */}
      <View style={[s.adminBar, { paddingTop: insets.top + 8 }]}>
        <View style={s.adminInner}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={s.back}>
            <ChevronLeft size={20} color={C.bar} />
          </Pressable>
          <GearIcon size={16} color={C.bar} />
          <Text style={[label(15, C.bar), { flex: 1 }]} numberOfLines={1}>
            Managing · {event.name}
            {division ? ` · ${division}` : ''}
          </Text>
          <Pressable onPress={() => nav.goBack()} style={s.publicBtn}>
            <Text style={label(13, C.hl)}>View as public</Text>
          </Pressable>
        </View>
      </View>

      <Page padded={false}>
        <View style={s.head}>
          <EventLogo e={event} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={head(22, C.white)} numberOfLines={2}>
              {event.name}
            </Text>
            <Text style={body(12.5, 'rgba(255,255,255,0.75)')}>You're an admin of this event</Text>
          </View>
        </View>

        <SectionLabel>Match day</SectionLabel>
        <Grid
          items={[
            { title: 'Live scores', sub: ready ? 'Score a match, fix a result' : 'Loading…', onPress: ready ? go('ScorerMatches', { leagueId, seasonId }) : undefined },
            { title: 'Matches & courts', sub: 'Start ties, move courts, lineups', onPress: ready ? go('LeagueDashboard', { leagueId, seasonId }) : undefined },
            { title: 'Standings', sub: 'Table and tie-breaks', onPress: ready ? go('Standings', { leagueId, seasonId }) : undefined },
            { title: 'Player stats', sub: 'Every player in the league', onPress: ready ? go('LeagueStats', { leagueId, seasonId }) : undefined },
          ]}
        />

        <SectionLabel>Teams & players</SectionLabel>
        <Grid
          items={[
            { title: 'Teams', sub: 'Names, colours, captains', onPress: go('FranchiseManagement', { leagueId }) },
            { title: 'Groups', sub: 'Pools and draws', onPress: ready ? go('GroupManagement', { leagueId, seasonId }) : undefined },
          ]}
        />

        <SectionLabel>People</SectionLabel>
        <Grid
          items={[
            { title: 'Scorers', sub: 'Add by phone number', soon: true },
            { title: 'Captains', sub: 'Add by phone number', soon: true },
          ]}
        />

        <SectionLabel>Registrations</SectionLabel>
        <Grid
          items={[
            { title: 'Entries & payments', sub: 'Who has registered and paid', soon: true },
            { title: 'Waitlist', sub: 'Move players in', soon: true },
          ]}
        />

        <Text style={[body(12.5, C.mute), { marginHorizontal: 16, marginTop: 18 }]}>
          Setup jobs (spreadsheet imports, building fixtures, running an auction floor) stay on the web console.
        </Text>
      </Page>
    </View>
  );
}

const s = StyleSheet.create({
  adminBar: { backgroundColor: C.hl, paddingBottom: 10 },
  adminInner: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,30,64,0.08)' },
  publicBtn: { backgroundColor: C.bar, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7 },
  head: { backgroundColor: C.bar, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  action: { flexBasis: '47%', flexGrow: 1, minHeight: 72, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
