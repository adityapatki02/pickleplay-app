// Scorer and admin mode for a league: every tie of the season, live ones first, then
// today's, then what's next and what's done. Tapping a tie opens it for scoring. Admins
// also get the league tools (teams, groups, standings), which still open the existing
// screens.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Page } from '../../components/chrome';
import { Empty, SectionLabel, TeamBadge } from '../../components/ui';
import { ChevronRight } from '../../components/icons';
import { fetchLeague, roundLabel } from '../../data/league-feed';
import { scorer, type ScoreTie } from '../../data/modes-api';
import type { YoidenEvent } from '../../data/events';
import type { Role } from '../../store/roles';
import { useLoad } from '../../hooks';
import { C, body, card, head, label } from '../../theme';

const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

export function tieWhen(t: Pick<ScoreTie, 'scheduledStart' | 'matchDay'>): string {
  if (t.scheduledStart) {
    return new Date(t.scheduledStart).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  }
  return t.matchDay ? new Date(`${t.matchDay}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Date to be set';
}

function StatusChip({ t }: { t: ScoreTie }) {
  const map: Record<string, [string, string, string]> = {
    in_progress: ['Live', C.live, C.white],
    completed: ['Done', C.greenSoft, C.green],
    lineup_locked: ['Lineups in', C.amberSoft, C.amber],
    lineup_submitted: ['Lineups in', C.amberSoft, C.amber],
  };
  const [text, bg, fg] = map[t.status] ?? ['Not started', C.page, C.soft];
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={label(11, fg)}>{text}</Text>
    </View>
  );
}

function TieRow({ t, me, onPress }: { t: ScoreTie; me: string; onPress: () => void }) {
  const home = t.homeTeam ?? { name: 'TBD', shortName: '' };
  const away = t.awayTeam ?? { name: 'TBD', shortName: '' };
  const played = t.status === 'completed' || t.status === 'in_progress';
  // The server totals a tie when it's finished; until then count games won.
  const won = (side: 'a' | 'b') =>
    t.matches.filter((g) => g.status === 'completed' && (side === 'a' ? (g.teamAScore ?? 0) > (g.teamBScore ?? 0) : (g.teamBScore ?? 0) > (g.teamAScore ?? 0))).length;
  const score = (i: number) => (t.status === 'completed' ? (i === 0 ? t.homeScore : t.awayScore) : won(i === 0 ? 'a' : 'b'));
  const holder = t.scorerId && t.scorerId !== me ? t.scorerName ?? 'Another scorer' : null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [card, s.tie, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <View style={s.tieHead}>
        <Text style={label(11.5, C.soft)} numberOfLines={1}>
          {roundLabel(t.round)}
          {t.courtNumber ? ` · Court ${t.courtNumber}` : ''} · {tieWhen(t)}
        </Text>
        <StatusChip t={t} />
      </View>
      {[home, away].map((team, i) => (
        <View key={i} style={s.side}>
          <TeamBadge team={{ name: team.name, shortName: team.shortName ?? '', color: null }} size={22} />
          <Text style={[body(14.5, C.ink, 'semi'), { flex: 1 }]} numberOfLines={1}>
            {team.name}
          </Text>
          {played ? <Text style={head(20, C.ink)}>{score(i)}</Text> : null}
        </View>
      ))}
      <View style={s.tieFoot}>
        <Text style={body(12, holder ? C.amber : C.mute)}>{holder ? `Being scored by ${holder}` : t.status === 'completed' ? 'Open to check or fix' : 'Tap to score'}</Text>
        <ChevronRight color={C.mute} />
      </View>
    </Pressable>
  );
}

export default function LeagueMode({ event, slug, leagueId, role }: { event: YoidenEvent; slug: string; leagueId?: string; role: Role }) {
  const nav = useNavigation<any>();
  const [showAllDone, setShowAllDone] = useState(false);
  const { state, reload } = useLoad(
    `mode-${slug}`,
    async () => {
      const feed = await fetchLeague(slug);
      return scorer.data(feed.season.id);
    },
    { pollMs: 20_000, live: () => true },
  );

  const groups = useMemo(() => {
    if (state.status !== 'ready') return null;
    const today = todayIST();
    const ties = state.data.ties.filter((t) => t.homeTeam || t.awayTeam);
    const live = ties.filter((t) => t.status === 'in_progress');
    const todays = ties.filter((t) => t.status !== 'in_progress' && t.status !== 'completed' && t.matchDay === today);
    const next = ties.filter((t) => t.status !== 'in_progress' && t.status !== 'completed' && t.matchDay !== today && (!t.matchDay || t.matchDay > today));
    const done = ties.filter((t) => t.status === 'completed').reverse();
    return { live, todays, next, done };
  }, [state]);

  const open = (t: ScoreTie) =>
    state.status === 'ready' && nav.navigate('ScoreTie', { eventId: event.id, slug, seasonId: state.data.season.id, tieId: t.id, role });

  const section = (title: string, list: ScoreTie[], color?: string) =>
    list.length ? (
      <>
        <SectionLabel color={color}>{`${title} · ${list.length}`}</SectionLabel>
        <View style={{ gap: 10, paddingHorizontal: 16 }}>
          {list.map((t) => (
            <TieRow key={t.id} t={t} me={state.status === 'ready' ? state.data.userId : ''} onPress={() => open(t)} />
          ))}
        </View>
      </>
    ) : null;

  return (
    <Page padded={false} onRefresh={reload}>
      {role === 'admin' && leagueId && state.status === 'ready' ? (
        <AdminTools leagueId={leagueId} seasonId={state.data.season.id} />
      ) : null}
      {state.status === 'loading' ? (
        <View style={{ padding: 16 }}>
          <Empty>Loading matches…</Empty>
        </View>
      ) : state.status === 'error' ? (
        <View style={{ padding: 16 }}>
          <Empty>Couldn't load the matches. Pull down to try again.</Empty>
        </View>
      ) : groups && !groups.live.length && !groups.todays.length && !groups.next.length && !groups.done.length ? (
        <View style={{ padding: 16 }}>
          <Empty>No matches have been set for this league yet.</Empty>
        </View>
      ) : groups ? (
        <>
          {section('Live now', groups.live, C.live)}
          {section('Today', groups.todays)}
          {section('Coming up', groups.next.slice(0, 12))}
          {section('Done', showAllDone ? groups.done : groups.done.slice(0, 6))}
          {groups.done.length > 6 && !showAllDone ? (
            <Pressable onPress={() => setShowAllDone(true)} style={s.more}>
              <Text style={label(13, C.accent)}>Show all {groups.done.length} results</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      <View style={{ height: 32 }} />
    </Page>
  );
}

/** League tools for admins. Most still open the existing screens. */
function AdminTools({ leagueId, seasonId }: { leagueId: string; seasonId: string }) {
  const nav = useNavigation<any>();
  const tools: [string, string, () => void][] = [
    ['Courts & lineups', 'Courts, scorers, lineups, walkovers', () => nav.navigate('LeagueDashboard', { leagueId, seasonId })],
    ['Standings', 'Table and tie-breaks', () => nav.navigate('Standings', { leagueId, seasonId })],
    ['Teams', 'Names, colours, captains', () => nav.navigate('FranchiseManagement', { leagueId })],
    ['Groups', 'Pools and draws', () => nav.navigate('GroupManagement', { leagueId, seasonId })],
  ];
  return (
    <>
      <SectionLabel>League tools</SectionLabel>
      <View style={s.grid}>
        {tools.map(([title, sub, go]) => (
          <Pressable key={title} onPress={go} style={({ pressed }) => [card, s.tool, pressed && { opacity: 0.85 }]}>
            <View style={{ flex: 1 }}>
              <Text style={body(14, C.ink, 'bold')}>{title}</Text>
              <Text style={[body(12, C.soft), { marginTop: 2 }]}>{sub}</Text>
            </View>
            <ChevronRight color={C.mute} />
          </Pressable>
        ))}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  tie: { padding: 13, gap: 8 },
  tieHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tieFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 9, marginTop: 2 },
  chip: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  more: { alignSelf: 'center', paddingVertical: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  tool: { flexBasis: '47%', flexGrow: 1, minHeight: 68, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
