// Shared football pieces for the event, match and player screens: the feed
// hook, team shape for badges, match status, the one-line match summary, the
// match card and the division pill switch. Same as the website's
// components/football/parts.tsx and use-football-feed.ts.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, body, card, label } from '../../theme';
import { ScoreBox, TeamBadge } from '../../components/ui';
import { TrophyIcon } from '../../components/icons';
import { useLoad, useNow } from '../../hooks';
import { statusOf, type YoidenEvent } from '../../data/events';
import { formatDay, formatTime, type FeedTeam } from '../../data/league-feed';
import {
  fetchFootball,
  isDone,
  isLiveMatch,
  minuteText,
  phaseLabel,
  stageLabel,
  teamColor,
  type FbMatch,
  type FootballFeed,
} from '../../data/football-feed';

const LIVE_POLL_MS = 20_000;

/** The event's football feed, polled every 20s while a match is live (and the event isn't over). */
export function useFootball(event: YoidenEvent) {
  const now = useNow();
  const eventOver = statusOf(event, now) === 'past';
  const slug = event.football ?? '';
  return useLoad<FootballFeed>(`fb:${slug}`, () => fetchFootball(slug), {
    pollMs: LIVE_POLL_MS,
    live: (f) => !eventOver && f.matches.some(isLiveMatch),
  });
}

/** A football team in the shape the shared badges expect. */
export function fbTeam(feed: FootballFeed, id: string | null, fallback: string): FeedTeam {
  const t = id ? feed.teams.find((x) => x.id === id) : null;
  return { id: id ?? fallback, name: t?.name ?? fallback, shortName: '', color: teamColor(feed, id) };
}

export const divisionsOf = (feed: FootballFeed) => [...new Set(feed.teams.map((t) => t.division))];

export function MatchStatus({ m }: { m: FbMatch }) {
  if (isLiveMatch(m))
    return (
      <View style={s.statusRow}>
        <View style={s.dot} />
        <Text style={s.statusLive}>{phaseLabel(m)}</Text>
      </View>
    );
  if (isDone(m)) return <Text style={[s.status, { color: C.mute }]}>Result</Text>;
  return <Text style={[s.status, { color: C.hlInk }]}>Upcoming</Text>;
}

/** One line under the score: scorers, the penalty result, a walkover, or the kick-off time. */
export function matchSummary(feed: FootballFeed, m: FbMatch): string {
  if (m.result?.startsWith('wo')) {
    const w = fbTeam(feed, m.winnerTeamId, '');
    return `${w.name} won by walkover`;
  }
  if (isDone(m) || isLiveMatch(m)) {
    const scorers = m.goals
      .filter((g) => g.player)
      .map((g) => `${g.player} ${minuteText(g)}${g.penalty ? ' (pen)' : ''}${g.ownGoal ? ' (og)' : ''}`);
    const pens = m.homePens != null && m.awayPens != null ? `Penalties ${m.homePens}–${m.awayPens}` : '';
    const text = [pens, scorers.join(', ')].filter(Boolean).join(' · ');
    if (text) return text;
    return isDone(m) ? (m.winnerTeamId ? 'Full time' : 'Draw') : phaseLabel(m);
  }
  const when = [formatDay(m.startsAt), formatTime(m.startsAt)].filter(Boolean);
  return when.length ? `Kick-off ${when.join(', ')}` : 'Time to be announced';
}

/** Same card as a league tie, for a football match. Opens the match page. */
export function MatchCard({
  feed,
  m,
  divisions,
  onPress,
}: {
  feed: FootballFeed;
  m: FbMatch;
  divisions: number;
  onPress: () => void;
}) {
  const showScore = isDone(m) || isLiveMatch(m);
  const row = (id: string | null, lbl: string, score: number, pens: number | null) => {
    const team = fbTeam(feed, id, lbl);
    const won = isDone(m) && !!m.winnerTeamId && m.winnerTeamId === id;
    const lost = isDone(m) && !!m.winnerTeamId && m.winnerTeamId !== id;
    return (
      <View style={s.teamRow}>
        <TeamBadge team={team} size={22} />
        <Text style={[label(17, lost ? C.mute : C.ink), s.teamName]} numberOfLines={1}>
          {team.name}
        </Text>
        {won && <TrophyIcon size={14} color={C.bar} strokeWidth={2.5} />}
        <View style={{ flex: 1 }} />
        {pens != null && <Text style={body(12, C.mute)}>({pens})</Text>}
        {showScore && <ScoreBox score={score} won={won} lost={lost} />}
      </View>
    );
  };
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [card, s.card, pressed && { opacity: 0.85 }]}>
      <View style={s.cardTop}>
        <MatchStatus m={m} />
        <Text style={[body(11.5, C.mute, 'medium'), { flexShrink: 1 }]} numberOfLines={1}>
          {stageLabel(m, divisions)}
          {m.turf ? ` · Turf ${m.turf}` : ''}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {row(m.homeTeamId, m.homeLabel, m.homeScore, m.homePens)}
        {row(m.awayTeamId, m.awayLabel, m.awayScore, m.awayPens)}
      </View>
      <Text
        style={[s.summary, isLiveMatch(m) ? body(13, C.live, 'semi') : body(13, C.soft)]}
        numberOfLines={2}
      >
        {matchSummary(feed, m)}
      </Text>
    </Pressable>
  );
}

/** Pill buttons in the banner for men / women etc. (shown only with more than one division). */
export function DivisionSwitch({
  labels,
  value,
  onChange,
}: {
  labels: string[];
  value: number;
  onChange: (i: number) => void;
}) {
  if (labels.length < 2) return null;
  return (
    <View style={s.divRow}>
      {labels.map((l, i) => {
        const on = i === value;
        return (
          <Pressable key={l + i} onPress={() => onChange(i)} style={[s.divPill, on ? { backgroundColor: C.hl } : s.divOff]}>
            <Text style={label(15, on ? C.bar : C.white)}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Plain grey note inside a panel ("No matches here."). */
export function Note({ children }: { children: string }) {
  return <Text style={[body(14, C.soft), { padding: 20 }]}>{children}</Text>;
}

const s = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.live },
  status: { fontFamily: 'Inter_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.9 },
  statusLive: { fontFamily: 'Inter_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.9, color: C.live },
  card: { padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamName: { flexShrink: 1, letterSpacing: 0.5 },
  summary: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line },
  divRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  divPill: { borderRadius: 6, paddingHorizontal: 16, paddingVertical: 6 },
  divOff: { backgroundColor: 'rgba(255,255,255,0.1)' },
});
