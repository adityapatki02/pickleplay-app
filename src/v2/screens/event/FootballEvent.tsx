// A football event (same as yoiden.com/events/<id> for football): banner with
// Teams / Matches / Goals, a men / women switch, tabs Matches / Tables /
// Scorers / Teams / About, then Live now, streams, Champions and Top scorers
// stacked below. Ported from the website's components/football/football-view.tsx.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppHeader, Page } from '../../components/chrome';
import { EventBanner } from '../../components/event-banner';
import { StreamVideos } from '../../components/stream-videos';
import { Chip, DetailRows, Empty, Panel, SegTabs, TeamBadge } from '../../components/ui';
import { SearchIcon } from '../../components/icons';
import { C, MAX_W, body, card, head, label } from '../../theme';
import { useNow } from '../../hooks';
import { formatWhen, statusOf, type YoidenEvent } from '../../data/events';
import { playerSlug } from '../../data/players';
import {
  STAGE_ORDER,
  divLabel,
  finals,
  isDone,
  isLiveMatch,
  type FbMatch,
  type FootballFeed,
} from '../../data/football-feed';
import { DivisionSwitch, MatchCard, Note, divisionsOf, fbTeam, useFootball } from './football-parts';

const TABS = [
  { key: 'matches', label: 'Matches' },
  { key: 'tables', label: 'Tables' },
  { key: 'scorers', label: 'Scorers' },
  { key: 'teams', label: 'Teams' },
  { key: 'about', label: 'About' },
] as const;
type Tab = (typeof TABS)[number]['key'];
type MatchFilter = 'live' | 'upcoming' | 'results';

type Go = { match: (id: string) => void; player: (name: string, teamId: string | null, team: string) => void };

export default function FootballEvent({ event }: { event: YoidenEvent }) {
  const nav = useNavigation<any>();
  const now = useNow();
  const { state, reload } = useFootball(event);
  const feed = state.status === 'ready' ? state.data : null;
  const divisions = useMemo(() => (feed ? divisionsOf(feed) : []), [feed]);
  const [div, setDiv] = useState(0);
  const division = divisions[div] ?? null;
  const [tab, setTab] = useState<Tab>('matches');

  const go: Go = {
    match: (matchId) => nav.navigate('Match', { eventId: event.id, matchId }),
    player: (name, teamId, team) =>
      feed && nav.navigate('Player', { eventId: event.id, slug: playerSlug({ name, team: fbTeam(feed, teamId, team) }) }),
  };

  const matches = useMemo(
    () => (feed ? feed.matches.filter((m) => !division || m.division === division) : []),
    [feed, division],
  );
  const stats = useMemo<[string, number][] | undefined>(() => {
    if (!feed) return undefined;
    return [
      ['Teams', feed.teams.length],
      ['Matches', feed.matches.filter(isDone).length],
      ['Goals', feed.matches.reduce((n, m) => n + (isDone(m) || isLiveMatch(m) ? m.homeScore + m.awayScore : 0), 0)],
    ];
  }, [feed]);
  const live = statusOf(event, now) === 'live';

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader back title={event.name} />
      <Page padded={false} onRefresh={reload} refreshing={false}>
        <EventBanner
          event={event}
          line={[feed?.event.presenter, event.venue ?? event.city, formatWhen(event)].filter(Boolean).join(' · ')}
          stats={stats}
        >
          <DivisionSwitch labels={divisions.map(divLabel)} value={div} onChange={setDiv} />
        </EventBanner>

        <View style={s.col}>
          <SegTabs tabs={TABS} value={tab} onChange={setTab} />
          <View style={{ marginTop: 16 }}>
            {state.status === 'loading' && <View style={s.skeleton} />}
            {state.status === 'error' && <Empty>Couldn't load this event right now. Please refresh in a moment.</Empty>}
            {feed && tab === 'matches' && (
              <MatchesTab key={division ?? 'all'} feed={feed} matches={matches} divisions={divisions.length} go={go} />
            )}
            {feed && tab === 'tables' && <TablesTab feed={feed} division={division} />}
            {feed && tab === 'scorers' && <ScorersTab feed={feed} division={division} go={go} />}
            {feed && tab === 'teams' && <TeamsTab feed={feed} division={division} go={go} />}
            {feed && tab === 'about' && <AboutTab feed={feed} event={event} />}
          </View>

          <View style={s.side}>
            {feed && <LiveNow feed={feed} matches={matches} divisions={divisions.length} go={go} />}
            <StreamVideos videos={event.videos ?? []} live={live} />
            {feed && <Champions feed={feed} division={division} go={go} />}
            {feed && <TopScorers feed={feed} division={division} go={go} onSeeAll={() => setTab('scorers')} />}
          </View>
        </View>
      </Page>
    </View>
  );
}

function MatchesTab({ feed, matches, divisions, go }: { feed: FootballFeed; matches: FbMatch[]; divisions: number; go: Go }) {
  const counts = {
    live: matches.filter(isLiveMatch).length,
    upcoming: matches.filter((m) => m.phase === 'pre').length,
    results: matches.filter(isDone).length,
  };
  const [filter, setFilter] = useState<MatchFilter>(
    counts.live ? 'live' : counts.upcoming && !counts.results ? 'upcoming' : 'results',
  );
  const shown = matches.filter((m) =>
    filter === 'live' ? isLiveMatch(m) : filter === 'upcoming' ? m.phase === 'pre' : isDone(m),
  );
  // Knockouts first (final at the top), then each group.
  const groups = new Map<string, FbMatch[]>();
  for (const m of [...shown].sort(
    (a, b) =>
      (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9) ||
      (a.groupCode ?? '').localeCompare(b.groupCode ?? '') ||
      (a.startsAt ?? '').localeCompare(b.startsAt ?? ''),
  )) {
    const key = m.stage === 'group' ? `Group ${m.groupCode ?? ''}` : 'Knockouts';
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  return (
    <View>
      <View style={s.chips}>
        {(['live', 'upcoming', 'results'] as const).map((f) => (
          <Chip key={f} on={filter === f} onPress={() => setFilter(f)}>
            {`${f === 'live' ? 'Live' : f === 'upcoming' ? 'Upcoming' : 'Results'} (${counts[f]})`}
          </Chip>
        ))}
      </View>
      {!shown.length && <Empty>No matches here.</Empty>}
      {[...groups.entries()].map(([title, list]) => (
        <View key={title} style={{ marginBottom: 22 }}>
          <Text style={[label(15, C.bar), { marginBottom: 10 }]}>{title}</Text>
          <View style={{ gap: 12 }}>
            {list.map((m) => (
              <MatchCard key={m.id} feed={feed} m={m} divisions={divisions} onPress={() => go.match(m.id)} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const COLS = ['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'] as const;

function TablesTab({ feed, division }: { feed: FootballFeed; division: string | null }) {
  const tables = feed.tables.filter((t) => !division || t.division === division);
  if (!tables.length) return <Empty>No group tables for this event.</Empty>;
  return (
    <View style={{ gap: 16 }}>
      {tables.map((t) => (
        <Panel key={`${t.division}-${t.code}`} title={`Group ${t.code}`}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: '100%' }}>
              <View style={[s.tr, s.thRow]}>
                <Text style={[s.th, s.cRank]}>#</Text>
                <Text style={[s.th, s.cTeam]}>Team</Text>
                {COLS.map((h) => (
                  <Text key={h} style={[s.th, s.cNum, h === 'Pts' && { color: C.ink }]}>
                    {h}
                  </Text>
                ))}
              </View>
              {t.rows.map((r, i) => (
                <View key={r.teamId} style={[s.tr, i === t.rows.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={[body(14, C.soft), s.cRank]}>{i + 1}</Text>
                  <View style={[s.cTeam, s.teamCell]}>
                    <TeamBadge team={fbTeam(feed, r.teamId, r.name)} size={20} />
                    <Text style={[body(14, C.ink, 'semi'), { flexShrink: 1 }]} numberOfLines={1}>
                      {r.name}
                    </Text>
                  </View>
                  {[r.p, r.w, r.d, r.l, r.gf, r.ga, r.gd > 0 ? `+${r.gd}` : r.gd].map((v, j) => (
                    <Text key={j} style={[body(14, C.soft), s.cNum]}>
                      {v}
                    </Text>
                  ))}
                  <Text style={[head(17, C.ink), s.cNum]}>{r.pts}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Panel>
      ))}
    </View>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.search}>
      <SearchIcon size={14} color={C.mute} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Find a player or team"
        placeholderTextColor={C.mute}
        style={s.searchInput}
      />
    </View>
  );
}

function ScorersTab({ feed, division, go }: { feed: FootballFeed; division: string | null; go: Go }) {
  const [q, setQ] = useState('');
  const rows = feed.scorers
    .filter((x) => !division || x.division === division)
    .filter((x) => !q || `${x.name} ${x.team}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel title="Goal scorers">
      <View style={s.searchWrap}>
        <SearchBox value={q} onChange={setQ} />
      </View>
      {rows.length ? (
        rows.map((x, i) => (
          <Pressable key={x.playerId} onPress={() => go.player(x.name, x.teamId, x.team)} style={[s.li, i === 0 && { borderTopWidth: 0 }]}>
            <Text style={[body(13, C.mute), { width: 24 }]}>{i + 1}</Text>
            <TeamBadge team={fbTeam(feed, x.teamId, x.team)} size={20} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
                {x.name}
              </Text>
              <Text style={body(12, C.soft)} numberOfLines={1}>
                {x.team}
              </Text>
            </View>
            <Text style={head(20, C.ink)}>{x.goals}</Text>
          </Pressable>
        ))
      ) : (
        <Note>No goals scored yet.</Note>
      )}
    </Panel>
  );
}

function TeamsTab({ feed, division, go }: { feed: FootballFeed; division: string | null; go: Go }) {
  const teams = feed.teams.filter((t) => !division || t.division === division);
  return (
    <View style={{ gap: 12 }}>
      {teams.map((t) => {
        const team = fbTeam(feed, t.id, t.name);
        const squad = feed.players.filter((p) => p.teamId === t.id).sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
        return (
          <View key={t.id} style={[card, { overflow: 'hidden' }]}>
            <View style={s.teamHead}>
              <TeamBadge team={team} size={32} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={body(15, C.ink, 'bold')} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={body(12, C.mute)}>
                  {[t.groupCode ? `Group ${t.groupCode}` : null, `${squad.length} players`].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            {squad.map((p, i) => (
              <Pressable key={p.id} onPress={() => go.player(p.name, t.id, t.name)} style={[s.squadRow, i === 0 && { borderTopWidth: 0 }]}>
                <Text style={body(14, C.ink)}>{p.name}</Text>
                {p.jersey != null && <Text style={body(12, C.mute, 'semi')}>#{p.jersey}</Text>}
              </Pressable>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function AboutTab({ feed, event }: { feed: FootballFeed; event: YoidenEvent }) {
  const groups = new Set(feed.tables.map((t) => `${t.division}-${t.code}`)).size;
  return (
    <Panel title="About">
      <DetailRows
        rows={[
          ['Event', feed.event.name],
          ...(feed.event.presenter ? [['Presented by', feed.event.presenter] as [string, string]] : []),
          ['Sport', 'Football'],
          ['Format', `${feed.teams.length} teams${groups ? ` in ${groups} groups` : ''}, then knockouts`],
          ['Match length', `2 × ${feed.event.halfMinutes} minutes`],
          ['When', formatWhen(event)],
          ['Where', event.venue ?? event.city],
        ]}
      />
    </Panel>
  );
}

function LiveNow({ feed, matches, divisions, go }: { feed: FootballFeed; matches: FbMatch[]; divisions: number; go: Go }) {
  const live = matches.filter(isLiveMatch);
  if (!live.length) return null;
  return (
    <Panel title="Live now">
      <View style={{ gap: 12, padding: 12 }}>
        {live.map((m) => (
          <MatchCard key={m.id} feed={feed} m={m} divisions={divisions} onPress={() => go.match(m.id)} />
        ))}
      </View>
    </Panel>
  );
}

function Champions({ feed, division, go }: { feed: FootballFeed; division: string | null; go: Go }) {
  const final = finals(feed).find((m) => (!division || m.division === division) && isDone(m) && m.winnerTeamId);
  if (!final) return null;
  const winner = fbTeam(feed, final.winnerTeamId, '');
  const runnerId = final.winnerTeamId === final.homeTeamId ? final.awayTeamId : final.homeTeamId;
  const runner = fbTeam(feed, runnerId, final.winnerTeamId === final.homeTeamId ? final.awayLabel : final.homeLabel);
  return (
    <Panel title="Champions">
      <View style={{ padding: 14, gap: 12 }}>
        <View style={s.winner}>
          <TeamBadge team={winner} size={30} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={label(11, C.hl)}>Winner</Text>
            <Text style={head(20, C.white)}>{winner.name}</Text>
          </View>
        </View>
        <View style={s.runner}>
          <TeamBadge team={runner} size={24} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={label(11, C.mute)}>Runner-up</Text>
            <Text style={label(16, C.ink)} numberOfLines={1}>
              {runner.name}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => go.match(final.id)} hitSlop={6}>
          <Text style={label(13, C.bar)}>View the final →</Text>
        </Pressable>
      </View>
    </Panel>
  );
}

function TopScorers({
  feed,
  division,
  go,
  onSeeAll,
}: {
  feed: FootballFeed;
  division: string | null;
  go: Go;
  onSeeAll: () => void;
}) {
  const top = feed.scorers.filter((x) => !division || x.division === division).slice(0, 5);
  if (!top.length) return null;
  return (
    <Panel title="Top scorers">
      {top.map((x, i) => (
        <Pressable key={x.playerId} onPress={() => go.player(x.name, x.teamId, x.team)} style={[s.li, i === 0 && { borderTopWidth: 0 }]}>
          <View style={[s.rank, i === 0 && { backgroundColor: C.bar }]}>
            <Text style={head(16, i === 0 ? C.hl : C.mute)}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
              {x.name}
            </Text>
            <Text style={body(12, C.soft)} numberOfLines={1}>
              {x.team}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={head(18, C.ink)}>{x.goals}</Text>
            <Text style={body(11, C.mute)}>goals</Text>
          </View>
        </Pressable>
      ))}
      <Pressable onPress={onSeeAll} style={s.seeAll}>
        <Text style={label(13, C.bar)}>All scorers →</Text>
      </Pressable>
    </Panel>
  );
}

const s = StyleSheet.create({
  col: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18 },
  side: { gap: 16, marginTop: 8 },
  skeleton: { height: 360, borderRadius: 10, backgroundColor: C.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 10 },
  thRow: { paddingVertical: 9 },
  th: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: C.mute },
  cRank: { width: 40, paddingLeft: 14 },
  cTeam: { width: 190, paddingRight: 8 },
  cNum: { width: 40, textAlign: 'center' },
  teamCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchWrap: { padding: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 7,
    paddingHorizontal: 10,
    backgroundColor: C.white,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink, paddingVertical: 8 },
  li: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  teamHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  squadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  winner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bar, borderRadius: 7, padding: 12 },
  runner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  rank: { width: 28, height: 28, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  seeAll: { borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 11, alignItems: 'center' },
});
