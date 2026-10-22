// Shared pieces of the league event, match and player screens: the feed hook
// (poll every 20s while live, settle stale ties once the event is over), tie
// cards, status labels, table cells and the loading / error states. Same
// shapes as the website's components/event/parts.tsx.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, F, body, card, head, label } from '../../theme';
import { Panel, ScoreBox, TeamBadge } from '../../components/ui';
import { TrophyIcon } from '../../components/icons';
import { useLoad, useNow } from '../../hooks';
import { statusOf, type YoidenEvent } from '../../data/events';
import {
  fetchLeague,
  formatDay,
  formatTime,
  liveGame,
  roundLabel,
  scoreModeOf,
  settleStaleTies,
  tieRallies,
  tieScore,
  type FeedTeam,
  type FeedTie,
  type LeagueFeed,
} from '../../data/league-feed';
import { playerSlug } from '../../data/players';

/** While any tie is live, refresh this often (same as the event sites). */
const LIVE_POLL_MS = 20_000;

const anyLive = (feeds: LeagueFeed[]) => feeds.some((f) => f.ties.some((t) => t.status === 'in_progress'));

export type FeedsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; feeds: LeagueFeed[] };

/** One feed per division of the event. Once the event's dates have passed, leftover "in progress" ties show as results. */
export function useLeagueFeeds(event: YoidenEvent) {
  const now = useNow();
  const eventOver = statusOf(event, now) === 'past';
  const slugs = (event.leagues ?? []).map((l) => l.slug);
  const [refreshing, setRefreshing] = React.useState(false);
  const { state, reload } = useLoad(`league:${slugs.join(',')}:${eventOver ? 'over' : 'on'}`, () => Promise.all(slugs.map((s) => fetchLeague(s))), {
    pollMs: LIVE_POLL_MS,
    live: (feeds) => !eventOver && anyLive(feeds),
  });
  // The pull-to-refresh spinner stops once the reload lands (or fails).
  React.useEffect(() => {
    if (refreshing && state.status !== 'loading') setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const settled = React.useMemo<FeedsState>(
    () =>
      state.status === 'ready'
        ? { status: 'ready', feeds: eventOver ? state.data.map(settleStaleTies) : state.data }
        : state,
    [state, eventOver],
  );
  const refresh = () => {
    setRefreshing(true);
    reload();
  };
  return { state: settled, refresh, refreshing, now };
}

/** Open a match or player page. `push` stacks a new screen (used from match / player screens so back works). */
export function useOpen(eventId: string, push = false) {
  const nav = useNavigation<any>();
  const go = (name: string, params: object) => (push && nav.push ? nav.push(name, params) : nav.navigate(name, params));
  return {
    match: (tieId: string) => go('Match', { eventId, matchId: tieId }),
    player: (p: { name: string; team: FeedTeam }) => go('Player', { eventId, slug: playerSlug(p) }),
  };
}

export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function TieStatus({ tie }: { tie: FeedTie }) {
  if (tie.status === 'in_progress')
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.live }} />
        <Text style={[s.statusText, { color: C.live }]}>Live</Text>
      </View>
    );
  if (tie.status === 'completed') return <Text style={[s.statusText, { color: C.mute }]}>Result</Text>;
  return <Text style={[s.statusText, { color: C.hlInk }]}>Upcoming</Text>;
}

/** Small navy tag with a lime trophy, used next to the winning team. */
export function WinnerTag({ text = 'Won' }: { text?: string }) {
  return (
    <View style={s.winner}>
      <TrophyIcon size={12} color={C.hl} strokeWidth={2.5} />
      <Text style={label(11, C.hl)}>{text}</Text>
    </View>
  );
}

/** One-line summary under a tie: result, live state or start time. */
export function tieSummary(feed: LeagueFeed, t: FeedTie): string {
  if (t.status === 'completed') {
    const winner = t.winnerId === t.home.id ? t.home : t.winnerId === t.away.id ? t.away : null;
    if (!winner) return 'Tie drawn';
    if (scoreModeOf(feed) === 'points') {
      const [h, a] = tieRallies(t);
      const how = h === a ? 'on games, level on points' : 'on points';
      return `${winner.name} won ${how} · games ${t.homeWon}–${t.awayWon}`;
    }
    return `${winner.name} won`;
  }
  if (t.status === 'in_progress') {
    const g = liveGame(t);
    return g
      ? `Game ${g.slot} of ${t.gamesTotal} in progress · ${g.homeScore ?? 0}–${g.awayScore ?? 0}`
      : `${t.gamesDecided} of ${t.gamesTotal} games done`;
  }
  const when = [formatDay(t.scheduledStart ?? t.matchDay), formatTime(t.scheduledStart)].filter(Boolean);
  return when.length ? `Starts ${when.join(', ')}` : 'Time to be announced';
}

/** Cricinfo-style match card for a tie. */
export function TieCard({ feed, tie, onPress }: { feed: LeagueFeed; tie: FeedTie; onPress: () => void }) {
  const [hs, as] = tieScore(feed, tie);
  const showScore = tie.status !== 'scheduled';
  const row = (team: FeedTeam, score: number) => {
    const lost = tie.status === 'completed' && !!tie.winnerId && tie.winnerId !== team.id;
    const won = tie.status === 'completed' && tie.winnerId === team.id;
    return (
      <View style={s.tieRow}>
        <TeamBadge team={team} size={22} />
        <Text style={[label(17, lost ? C.mute : C.ink), { letterSpacing: 0.5, flexShrink: 1 }]} numberOfLines={1}>
          {team.name}
        </Text>
        {won && <TrophyIcon size={14} color={C.bar} strokeWidth={2.5} />}
        <View style={{ flex: 1 }} />
        {showScore && <ScoreBox score={score} won={won} lost={lost} />}
      </View>
    );
  };
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [card, s.tieCard, pressed && { opacity: 0.85 }]}>
      <View style={s.tieTop}>
        <TieStatus tie={tie} />
        <Text style={[body(11.5, C.mute, 'medium'), { flexShrink: 1 }]} numberOfLines={1}>
          {roundLabel(tie.round)}
          {tie.court ? ` · Court ${tie.court}` : ''}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {row(tie.home, hs)}
        {row(tie.away, as)}
      </View>
      <Text
        style={[
          s.tieSummary,
          tie.status === 'in_progress' ? body(13, C.live, 'semi') : body(13, C.soft),
        ]}
      >
        {tieSummary(feed, tie)}
      </Text>
    </Pressable>
  );
}

/** Text in a fixed-width table cell. */
export function Cell({
  w,
  children,
  right,
  strong,
  head: isHead,
  flex,
}: {
  w?: number;
  children: React.ReactNode;
  right?: boolean;
  strong?: boolean;
  head?: boolean;
  flex?: boolean;
}) {
  const style = isHead
    ? label(13, strong ? C.ink : C.mute)
    : strong
      ? head(20, C.ink)
      : body(14, C.soft);
  return (
    <View style={[{ width: w, justifyContent: 'center', paddingHorizontal: 6 }, flex && { flexGrow: 1 }, right && { alignItems: 'flex-end' }]}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={[style, { fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

/** Grey placeholder cards while the feed loads. */
export function Loading({ count = 4, height = 132 }: { count?: number; height?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[card, { height, backgroundColor: '#FAFBFC' }]} />
      ))}
    </View>
  );
}

export function LoadError() {
  return (
    <Panel>
      <Text style={[body(14, C.soft), { padding: 22 }]}>Couldn't load this event right now. Please refresh in a moment.</Text>
    </Panel>
  );
}

/** Plain message inside a white panel ("No results yet."). */
export function Note({ children }: { children: string }) {
  return (
    <Panel>
      <Text style={[body(14, C.soft), { padding: 22 }]}>{children}</Text>
    </Panel>
  );
}

export const tableStyles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  rank: { width: 28, height: 28, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});

const s = StyleSheet.create({
  statusText: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' },
  winner: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bar, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tieCard: { padding: 14 },
  tieTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  tieRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
  tieSummary: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line },
});
