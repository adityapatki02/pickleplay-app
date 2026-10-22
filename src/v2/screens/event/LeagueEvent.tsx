// A league event (team ties of several games): the same page as
// yoiden.com/events/<id> — banner with Teams / Ties / Games, division switch,
// tabs Matches / Standings / Players / Teams / About, then the side panels
// (Live now, streams, Champions, Top players, Event details) stacked below.
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, MAX_W, body, head, label } from '../../theme';
import { AppHeader, Page } from '../../components/chrome';
import { EventBanner } from '../../components/event-banner';
import { Chip, DetailRows, Panel, SegTabs, TeamBadge } from '../../components/ui';
import { ExternalIcon, SearchIcon, TrophyIcon } from '../../components/icons';
import { StreamVideos, type StreamVideo } from '../../components/stream-videos';
import { formatWhen, statusOf, type YoidenEvent } from '../../data/events';
import {
  categoryLabel,
  formatDay,
  isKnockout,
  roundLabel,
  roundOrder,
  type FeedTeam,
  type FeedTie,
  type LeagueFeed,
} from '../../data/league-feed';
import { Cell, LoadError, Loading, Note, TieCard, signed, tableStyles as t, useLeagueFeeds, useOpen } from './league-parts';

const TABS = [
  { key: 'matches', label: 'Matches' },
  { key: 'standings', label: 'Standings' },
  { key: 'players', label: 'Players' },
  { key: 'teams', label: 'Teams' },
  { key: 'about', label: 'About' },
] as const;
type Tab = (typeof TABS)[number]['key'];

type MatchFilter = 'live' | 'upcoming' | 'results';

type Open = ReturnType<typeof useOpen>;

export default function LeagueEvent({ event }: { event: YoidenEvent }) {
  const divisions = event.leagues ?? [];
  const { state, refresh, refreshing, now } = useLeagueFeeds(event);
  const open = useOpen(event.id);
  const [div, setDiv] = useState(0);
  const [tab, setTab] = useState<Tab>('matches');

  const feeds = state.status === 'ready' ? state.feeds : [];
  const feed = feeds[div] ?? null;

  // Videos listed on the event, then any court streams the league itself carries.
  const videos = useMemo(() => {
    const out: StreamVideo[] = [...(event.videos ?? [])];
    feeds.forEach((f, i) =>
      Object.entries(f.streamLinks ?? {}).forEach(([court, url]) => {
        if (out.some((v) => v.url === url)) return;
        const division = feeds.length > 1 ? `${event.leagues?.[i]?.label ?? ''} · ` : '';
        out.push({ title: `${division}Court ${court} stream`, url });
      }),
    );
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.videos, event.leagues, state]);

  const totals = useMemo(() => {
    const ties = feeds.flatMap((f) => f.ties);
    return {
      teams: feeds.reduce((s, f) => s + (f.squads?.length ?? f.groups.reduce((n, g) => n + g.rows.length, 0)), 0),
      ties: ties.length,
      games: ties.reduce((s, x) => s + x.gamesDecided, 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const status = statusOf(event, now);

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader back title={event.name} />
      <Page padded={false} onRefresh={refresh} refreshing={refreshing}>
        <EventBanner
          event={event}
          line={[event.venue ?? event.city, formatWhen(event), `${totals.teams || '–'} teams`].filter(Boolean).join(' · ')}
          stats={
            state.status === 'ready'
              ? [
                  ['Teams', totals.teams],
                  ['Ties', totals.ties],
                  ['Games', totals.games],
                ]
              : undefined
          }
        >
          {divisions.length > 1 && (
            <View style={s.divs}>
              {divisions.map((d, i) => (
                <Pressable key={d.slug} onPress={() => setDiv(i)} style={[s.div, i === div ? s.divOn : s.divOff]}>
                  <Text style={label(15, i === div ? C.bar : C.white)}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </EventBanner>

        <View style={s.col}>
          <SegTabs tabs={TABS} value={tab} onChange={setTab} />

          <View style={{ marginTop: 16 }}>
            {state.status === 'loading' && <Loading />}
            {state.status === 'error' && <LoadError />}
            {feed && tab === 'matches' && <MatchesTab key={feed.league.slug} feed={feed} open={open} />}
            {feed && tab === 'standings' && <StandingsTab feed={feed} />}
            {feed && tab === 'players' && <PlayersTab key={feed.league.slug} feed={feed} open={open} />}
            {feed && tab === 'teams' && <TeamsTab feed={feed} open={open} />}
            {feed && tab === 'about' && <AboutTab feed={feed} event={event} />}
          </View>

          <View style={s.side}>
            {feed && <LiveNow feed={feed} open={open} />}
            <StreamVideos videos={videos} live={status === 'live'} />
            {feed && <Champions feed={feed} open={open} />}
            {feed && <TopPlayers feed={feed} open={open} onSeeAll={() => setTab('players')} />}
            <Panel title="Event details">
              <DetailRows
                rows={[
                  ['Sport', event.sport],
                  ['Dates', formatWhen(event)],
                  ['Venue', event.venue ?? event.city],
                  ...(feed?.season.pointsTo ? ([['Games to', `${feed.season.pointsTo} points`]] as [string, string][]) : []),
                ]}
              />
            </Panel>
            {event.url ? (
              <Pressable onPress={() => Linking.openURL(event.url!)} style={s.siteLink}>
                <Text style={body(13, C.soft, 'semi')}>Organiser's event site</Text>
                <ExternalIcon size={16} color={C.soft} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </Page>
    </View>
  );
}

// ── Matches ────────────────────────────────────────────────────────────

function MatchesTab({ feed, open }: { feed: LeagueFeed; open: Open }) {
  const counts = {
    live: feed.ties.filter((x) => x.status === 'in_progress').length,
    upcoming: feed.ties.filter((x) => x.status === 'scheduled').length,
    results: feed.ties.filter((x) => x.status === 'completed').length,
  };
  const initial: MatchFilter = counts.live ? 'live' : counts.upcoming && !counts.results ? 'upcoming' : 'results';
  const [filter, setFilter] = useState<MatchFilter>(initial);

  const want = { live: 'in_progress', upcoming: 'scheduled', results: 'completed' }[filter];
  const ties = feed.ties.filter((x) => x.status === want);

  // One block per stage: each league week, and all knockouts of a day together. Results run newest first.
  const dir = filter === 'results' ? -1 : 1;
  const byStage = (a: FeedTie, b: FeedTie) =>
    dir * ((a.matchDay ?? '').localeCompare(b.matchDay ?? '') || roundOrder(a.round) - roundOrder(b.round) || (a.court ?? 0) - (b.court ?? 0));
  const groups = new Map<string, FeedTie[]>();
  for (const x of [...ties].sort(byStage)) {
    const key = isKnockout(x.round) ? `ko|${x.matchDay ?? ''}` : x.round;
    groups.set(key, [...(groups.get(key) ?? []), x]);
  }
  const stageLabel = (key: string, list: FeedTie[]) =>
    `${key.startsWith('ko|') ? 'Knockouts' : roundLabel(key)}${list[0].matchDay ? ` · ${formatDay(list[0].matchDay)}` : ''}`;

  return (
    <View>
      <View style={s.chips}>
        {(['live', 'upcoming', 'results'] as MatchFilter[]).map((f) => (
          <Chip key={f} on={f === filter} onPress={() => setFilter(f)}>
            {`${f === 'live' ? 'Live' : f === 'upcoming' ? 'Upcoming' : 'Results'} (${counts[f]})`}
          </Chip>
        ))}
      </View>

      {ties.length === 0 ? (
        <Note>{filter === 'live' ? 'No ties are being played right now.' : filter === 'upcoming' ? 'No upcoming ties.' : 'No results yet.'}</Note>
      ) : (
        <View style={{ gap: 22 }}>
          {[...groups.entries()].map(([key, list]) => (
            <View key={key}>
              <Text style={[label(15, C.bar), { marginBottom: 10 }]}>{stageLabel(key, list)}</Text>
              <View style={{ gap: 12 }}>
                {list.map((x) => (
                  <TieCard key={x.id} feed={feed} tie={x} onPress={() => open.match(x.id)} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Side panels ────────────────────────────────────────────────────────

function LiveNow({ feed, open }: { feed: LeagueFeed; open: Open }) {
  const live = feed.ties.filter((x) => x.status === 'in_progress');
  if (!live.length) return null;
  return (
    <Panel title="Live now">
      {live.map((x, i) => {
        const g = x.games.find((y) => y.status === 'in_progress');
        return (
          <Pressable key={x.id} onPress={() => open.match(x.id)} style={[s.listItem, i > 0 && s.divider]}>
            <Text style={body(12, C.mute, 'semi')}>Court {x.court ?? '–'}</Text>
            <Text style={[body(14, C.ink, 'semi'), { marginTop: 2 }]}>
              {x.home.name} v {x.away.name}
            </Text>
            {g && (
              <Text style={[body(13, C.live, 'semi'), { marginTop: 2 }]}>
                Game {g.slot}: {g.homeScore ?? 0}–{g.awayScore ?? 0}
              </Text>
            )}
          </Pressable>
        );
      })}
    </Panel>
  );
}

/** Winner + runner-up from the final; for a league with no knockouts, the table leader once all ties are done. */
function Champions({ feed, open }: { feed: LeagueFeed; open: Open }) {
  const final = feed.ties.find((x) => x.round.toLowerCase() === 'knockout_final');
  let winner: FeedTeam | null = null;
  let runnerUp: FeedTeam | null = null;
  let finalId: string | null = null;
  if (final?.status === 'completed' && final.winnerId) {
    winner = final.winnerId === final.home.id ? final.home : final.away;
    runnerUp = final.winnerId === final.home.id ? final.away : final.home;
    finalId = final.id;
  } else if (!final && feed.ties.length && feed.ties.every((x) => x.status === 'completed') && feed.groups.length === 1) {
    winner = feed.groups[0].rows[0]?.team ?? null;
    runnerUp = feed.groups[0].rows[1]?.team ?? null;
  }
  if (!winner) return null;
  return (
    <Panel title="Champions">
      <View style={{ padding: 14, gap: 8 }}>
        <View style={s.champ}>
          <View style={s.champStripe} />
          <TrophyIcon size={24} color={C.hl} strokeWidth={2.25} />
          <TeamBadge team={winner} size={30} />
          <View style={{ flex: 1, paddingRight: 24 }}>
            <Text style={label(11, C.hl)}>Winner</Text>
            <Text style={head(22, C.white)} numberOfLines={1}>
              {winner.name}
            </Text>
          </View>
        </View>
        {runnerUp && (
          <View style={s.runner}>
            <TrophyIcon size={20} color={C.mute} />
            <TeamBadge team={runnerUp} size={24} />
            <View style={{ flex: 1 }}>
              <Text style={label(11, C.mute)}>Runner-up</Text>
              <Text style={label(16, C.ink)} numberOfLines={1}>
                {runnerUp.name}
              </Text>
            </View>
          </View>
        )}
        {finalId && (
          <Pressable onPress={() => open.match(finalId!)} style={{ paddingTop: 4 }}>
            <Text style={label(13, C.bar)}>View the final →</Text>
          </Pressable>
        )}
      </View>
    </Panel>
  );
}

const byWins = (a: LeagueFeed['players'][number], b: LeagueFeed['players'][number]) =>
  b.won - a.won || b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) || a.name.localeCompare(b.name);

/** Best five players by games won, then points difference. */
function TopPlayers({ feed, open, onSeeAll }: { feed: LeagueFeed; open: Open; onSeeAll: () => void }) {
  const top = [...feed.players].filter((p) => p.played > 0).sort(byWins).slice(0, 5);
  if (!top.length) return null;
  return (
    <Panel title="Top players">
      {top.map((p, i) => (
        <Pressable key={`${p.name}-${p.team.id}`} onPress={() => open.player(p)} style={[s.topRow, i > 0 && s.divider]}>
          <View style={[t.rank, i === 0 && { backgroundColor: C.bar }]}>
            <Text style={head(16, i === 0 ? C.hl : C.mute)}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
              {p.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <TeamBadge team={p.team} size={14} />
              <Text style={[body(12, C.soft), { flexShrink: 1 }]} numberOfLines={1}>
                {p.team.name}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={head(18, C.ink)}>
              {p.won}-{p.lost}
            </Text>
            <Text style={body(11, C.mute)}>{signed(p.pointsFor - p.pointsAgainst)} pts</Text>
          </View>
        </Pressable>
      ))}
      <Pressable onPress={onSeeAll} style={[s.seeAll, s.divider]}>
        <Text style={label(13, C.bar)}>All player stats →</Text>
      </Pressable>
    </Panel>
  );
}

// ── Standings ──────────────────────────────────────────────────────────

const ST = { rank: 44, team: 200, num: 52, games: 64, diff: 72, pts: 72 };

function StandingsTab({ feed }: { feed: LeagueFeed }) {
  return (
    <View style={{ gap: 18 }}>
      {feed.groups.map((g) => (
        <Panel key={g.name} title={g.name}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ minWidth: 600, flexGrow: 1 }}>
              <View style={t.headRow}>
                <Cell w={ST.rank} head>#</Cell>
                <Cell w={ST.team} flex head>Team</Cell>
                <Cell w={ST.num} right head>P</Cell>
                <Cell w={ST.num} right head>W</Cell>
                <Cell w={ST.num} right head>L</Cell>
                <Cell w={ST.games} right head>Games</Cell>
                <Cell w={ST.diff} right head>Pts +/-</Cell>
                <Cell w={ST.pts} right head strong>Points</Cell>
              </View>
              {g.rows.map((r, i) => (
                <View key={r.team.id} style={[t.row, i === g.rows.length - 1 && { borderBottomWidth: 0 }]}>
                  <Cell w={ST.rank}>
                    <View style={[t.rank, r.qualified && { backgroundColor: C.hl }]}>
                      <Text style={head(16, r.qualified ? C.bar : C.mute)}>{r.rank}</Text>
                    </View>
                  </Cell>
                  <Cell w={ST.team} flex>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TeamBadge team={r.team} size={22} />
                      <Text style={[label(16, C.ink), { letterSpacing: 0.5, flexShrink: 1 }]} numberOfLines={1}>
                        {r.team.name}
                      </Text>
                    </View>
                  </Cell>
                  <Cell w={ST.num} right>{r.played}</Cell>
                  <Cell w={ST.num} right>{r.won}</Cell>
                  <Cell w={ST.num} right>{r.lost}</Cell>
                  <Cell w={ST.games} right>{r.gamesWon}</Cell>
                  <Cell w={ST.diff} right>{signed(r.pointsFor - r.pointsAgainst)}</Cell>
                  <Cell w={ST.pts} right strong>{r.tiePoints}</Cell>
                </View>
              ))}
            </View>
          </ScrollView>
          {g.rows.some((r) => r.note) && (
            <View style={s.notes}>
              {g.rows
                .filter((r) => r.note)
                .map((r) => (
                  <Text key={r.team.id} style={body(12.5, C.soft)}>
                    <Text style={body(12.5, C.ink, 'bold')}>{r.team.name}:</Text> {r.note}
                  </Text>
                ))}
            </View>
          )}
        </Panel>
      ))}
    </View>
  );
}

// ── Players ────────────────────────────────────────────────────────────

const PL = { rank: 40, name: 170, team: 170, num: 44, pct: 64, diff: 72 };

function PlayersTab({ feed, open }: { feed: LeagueFeed; open: Open }) {
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => [...feed.players].sort(byWins), [feed.players]);
  const filtered = q ? sorted.filter((p) => `${p.name} ${p.team.name}`.toLowerCase().includes(q.toLowerCase())) : sorted;
  const shown = showAll || q ? filtered : filtered.slice(0, 30);

  return (
    <Panel title="Player stats">
      <View style={s.search}>
        <SearchIcon size={14} color={C.mute} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Find a player or team"
          placeholderTextColor={C.mute}
          style={[body(13, C.ink), s.searchInput]}
          autoCorrect={false}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ minWidth: 600, flexGrow: 1 }}>
          <View style={t.headRow}>
            <Cell w={PL.rank} head>#</Cell>
            <Cell w={PL.name} flex head>Player</Cell>
            <Cell w={PL.team} head>Team</Cell>
            <Cell w={PL.num} right head>P</Cell>
            <Cell w={PL.num} right head>W</Cell>
            <Cell w={PL.num} right head>L</Cell>
            <Cell w={PL.pct} right head>Win %</Cell>
            <Cell w={PL.diff} right head strong>Pts +/-</Cell>
          </View>
          {shown.map((p, i) => (
            <Pressable
              key={`${p.name}-${p.team.id}`}
              onPress={() => open.player(p)}
              style={[t.row, i === shown.length - 1 && { borderBottomWidth: 0 }]}
            >
              <Cell w={PL.rank}>{sorted.indexOf(p) + 1}</Cell>
              <Cell w={PL.name} flex>
                <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
                  {p.name}
                </Text>
              </Cell>
              <Cell w={PL.team}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TeamBadge team={p.team} size={18} />
                  <Text style={[body(14, C.soft), { flexShrink: 1 }]} numberOfLines={1}>
                    {p.team.name}
                  </Text>
                </View>
              </Cell>
              <Cell w={PL.num} right>{p.played}</Cell>
              <Cell w={PL.num} right>{p.won}</Cell>
              <Cell w={PL.num} right>{p.lost}</Cell>
              <Cell w={PL.pct} right>{`${p.played ? Math.round((p.won / p.played) * 100) : 0}%`}</Cell>
              <Cell w={PL.diff} right strong>{signed(p.pointsFor - p.pointsAgainst)}</Cell>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {!q && !showAll && filtered.length > 30 && (
        <Pressable onPress={() => setShowAll(true)} style={[s.seeAll, s.divider]}>
          <Text style={body(13, C.ink, 'semi')}>Show all {filtered.length} players</Text>
        </Pressable>
      )}
    </Panel>
  );
}

// ── Teams ──────────────────────────────────────────────────────────────

function TeamsTab({ feed, open }: { feed: LeagueFeed; open: Open }) {
  const squads = feed.squads ?? [];
  if (!squads.length) return <Note>Team lists haven't been published for this event.</Note>;
  return (
    <View style={{ gap: 12 }}>
      {squads.map((sq) => (
        <Panel key={sq.team.id}>
          <View style={s.squadHead}>
            <TeamBadge team={sq.team} size={32} />
            <View style={{ flex: 1 }}>
              <Text style={body(15, C.ink, 'bold')} numberOfLines={1}>
                {sq.team.name}
              </Text>
              <Text style={body(12, C.mute)}>{[sq.pool, `${sq.players.length} players`].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          {sq.players.map((p, i) => (
            <Pressable
              key={p.name}
              onPress={() => open.player({ name: p.name, team: sq.team })}
              style={[s.squadRow, i > 0 && s.divider]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Text style={[body(14, C.ink), { flexShrink: 1 }]} numberOfLines={1}>
                  {p.name}
                </Text>
                {p.captain && (
                  <View style={s.captain}>
                    <Text style={body(10, C.white, 'bold')}>C</Text>
                  </View>
                )}
              </View>
              {p.grade ? <Text style={body(12, C.mute, 'semi')}>{p.grade}</Text> : null}
            </Pressable>
          ))}
        </Panel>
      ))}
    </View>
  );
}

// ── About ──────────────────────────────────────────────────────────────

function AboutTab({ feed, event }: { feed: LeagueFeed; event: YoidenEvent }) {
  const games = feed.ties[0]?.games ?? [];
  const cats = [...new Set(games.map((g) => categoryLabel(g.category)))];
  return (
    <Panel title="About this event">
      <DetailRows
        rows={[
          ['Event', event.name],
          ['Season', feed.season.name],
          ['Format', `Team ties of ${games.length || '–'} games${cats.length ? `: ${cats.join(', ')}` : ''}`],
          ...(feed.season.pointsTo ? ([['Each game', `First to ${feed.season.pointsTo} points`]] as [string, string][]) : []),
          ['Pools', feed.groups.map((g) => g.name).join(', ') || '–'],
          ['Scored on', 'Yoiden, live from every court'],
        ]}
      />
    </Panel>
  );
}

const s = StyleSheet.create({
  col: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16 },
  side: { gap: 16, marginTop: 22 },
  divs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  div: { borderRadius: 6, paddingHorizontal: 16, paddingVertical: 6 },
  divOn: { backgroundColor: C.hl },
  divOff: { backgroundColor: 'rgba(255,255,255,0.1)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  divider: { borderTopWidth: 1, borderTopColor: C.line },
  listItem: { paddingHorizontal: 14, paddingVertical: 12 },
  champ: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bar, borderRadius: 6, padding: 12, overflow: 'hidden' },
  champStripe: { position: 'absolute', top: -10, bottom: -10, right: -12, width: 32, backgroundColor: C.hl, transform: [{ skewX: '-20deg' }] },
  runner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  seeAll: { alignItems: 'center', paddingVertical: 11 },
  notes: { gap: 4, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 14, paddingVertical: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 7,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, paddingVertical: 8, outlineStyle: 'none' } as any,
  squadHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  squadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 9 },
  captain: { backgroundColor: C.ink, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  siteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
