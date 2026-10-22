// A football player within one event (same as yoiden.com/events/<id>/player/<slug>
// for football). The feed records goals but not line-ups, so the page shows
// the player's goals and their team's matches (with the player's goals
// marked), plus the rest of the squad. Ported from the website's
// components/football/player-view.tsx.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppHeader, Page } from '../../components/chrome';
import { Empty, Panel, Stripes, TeamBadge } from '../../components/ui';
import { C, MAX_W, body, head, isLight, label } from '../../theme';
import type { YoidenEvent } from '../../data/events';
import { playerSlug } from '../../data/players';
import { isDone, minuteText, stageLabel } from '../../data/football-feed';
import { divisionsOf, fbTeam, useFootball } from '../event/football-parts';

const initialsOf = (name: string) =>
  name
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export default function FootballPlayer({ event, slug }: { event: YoidenEvent; slug: string }) {
  const nav = useNavigation<any>();
  const { state, reload } = useFootball(event);

  const shell = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader back title={event.name} />
      <Page padded={false} onRefresh={reload} refreshing={false}>
        {children}
      </Page>
    </View>
  );
  const note = (text: string) =>
    shell(
      <View style={s.col}>
        <Empty>{text}</Empty>
      </View>,
    );

  if (state.status === 'loading') return shell(<View style={s.skeleton} />);
  if (state.status === 'error') return note("Couldn't load this player right now.");
  const feed = state.data;
  const player = feed.players.find((p) => playerSlug({ name: p.name, team: fbTeam(feed, p.teamId, '') }) === slug);
  if (!player) return note("This player isn't in the event any more.");

  const team = fbTeam(feed, player.teamId, '');
  const divisions = divisionsOf(feed).length;
  const goals = feed.matches.flatMap((m) =>
    m.goals.filter((g) => g.playerId === player.id && !g.ownGoal).map((g) => ({ m, g })),
  );
  const teamMatches = feed.matches
    .filter((m) => isDone(m) && (m.homeTeamId === player.teamId || m.awayTeamId === player.teamId))
    .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
  const wins = teamMatches.filter((m) => m.winnerTeamId === player.teamId).length;
  const ranked = feed.scorers.filter((x) => x.division === feed.teams.find((t) => t.id === player.teamId)?.division);
  const rank = ranked.findIndex((x) => x.playerId === player.id) + 1;
  const teammates = feed.players
    .filter((p) => p.teamId === player.teamId && p.id !== player.id)
    .sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
  const color = team.color ?? '#2952E3';

  const stats: [string, string | number][] = [
    ['Goals', goals.length],
    ['Penalties', goals.filter((x) => x.g.penalty).length],
    ['Team played', teamMatches.length],
    ['Team won', wins],
    ['Scorer rank', rank ? `#${rank} of ${ranked.length}` : '–'],
    ['Shirt', player.jersey != null ? `#${player.jersey}` : '–'],
  ];

  return shell(
    <>
      <View style={s.band}>
        <Stripes height={260} wide />
        <View style={s.bandInner}>
          <View style={s.who}>
            <View style={[s.avatar, { backgroundColor: color }]}>
              <Text style={head(26, isLight(color) ? C.ink : C.white)}>{initialsOf(player.name)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 40 }}>
              <Text style={head(34, C.white)}>{player.name}</Text>
              <View style={s.teamLine}>
                <TeamBadge team={team} size={20} />
                <Text style={body(15, 'rgba(255,255,255,0.8)')} numberOfLines={1}>
                  {team.name}
                </Text>
              </View>
            </View>
          </View>
          <View style={s.stats}>
            {stats.map(([k, v]) => (
              <View key={k} style={s.stat}>
                <Text style={label(11, 'rgba(255,255,255,0.6)')}>{k}</Text>
                <Text style={[head(24, C.white), { marginTop: 4 }]}>{v}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={[s.col, { gap: 16 }]}>
        <Panel title={`${team.name} matches (${teamMatches.length})`}>
          {teamMatches.length ? (
            teamMatches.map((m, i) => {
              const home = m.homeTeamId === player.teamId;
              const opp = fbTeam(feed, home ? m.awayTeamId : m.homeTeamId, home ? m.awayLabel : m.homeLabel);
              const [us, them] = home ? [m.homeScore, m.awayScore] : [m.awayScore, m.homeScore];
              const res = m.winnerTeamId === player.teamId ? 'W' : m.winnerTeamId ? 'L' : 'D';
              const mine = goals.filter((x) => x.m.id === m.id);
              const line = mine.length
                ? `Scored ${mine.map((x) => `${minuteText(x.g)}${x.g.penalty ? ' (pen)' : ''}`).join(', ')}`
                : m.result?.startsWith('wo')
                  ? 'Walkover'
                  : '';
              return (
                <Pressable
                  key={m.id}
                  onPress={() => nav.push('Match', { eventId: event.id, matchId: m.id })}
                  style={[s.li, i === 0 && { borderTopWidth: 0 }]}
                >
                  <View style={[s.res, { backgroundColor: res === 'W' ? C.bar : C.page }]}>
                    <Text style={head(16, res === 'W' ? C.hl : C.mute)}>{res}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.vsLine}>
                      <Text style={body(14, C.ink, 'semi')}>vs {opp.name}</Text>
                      <Text style={body(12, C.mute)}>{stageLabel(m, divisions)}</Text>
                    </View>
                    {line ? (
                      <Text style={body(13, C.soft)} numberOfLines={1}>
                        {line}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={head(17, C.ink)}>
                    {us}-{them}
                    {m.homePens != null && m.awayPens != null
                      ? ` (${home ? m.homePens : m.awayPens}-${home ? m.awayPens : m.homePens} p)`
                      : ''}
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={[body(14, C.soft), { padding: 16 }]}>No matches played yet.</Text>
          )}
        </Panel>

        <Panel title={`${team.name} squad`}>
          {teammates.map((t, i) => (
            <Pressable
              key={t.id}
              onPress={() => nav.push('Player', { eventId: event.id, slug: playerSlug({ name: t.name, team }) })}
              style={[s.squadRow, i === 0 && { borderTopWidth: 0 }]}
            >
              <Text style={body(14, C.ink, 'semi')}>{t.name}</Text>
              {t.jersey != null && <Text style={body(12, C.mute)}>#{t.jersey}</Text>}
            </Pressable>
          ))}
        </Panel>
      </View>
    </>,
  );
}

const s = StyleSheet.create({
  col: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18 },
  skeleton: { height: 360, margin: 16, borderRadius: 10, backgroundColor: C.white },
  band: { backgroundColor: C.bar, overflow: 'hidden' },
  bandInner: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.barSoft,
    backgroundColor: C.barSoft,
    overflow: 'hidden',
    gap: 1,
  },
  stat: { flexGrow: 1, flexBasis: '32%', backgroundColor: C.bar, paddingHorizontal: 12, paddingVertical: 10 },
  li: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  res: { width: 36, height: 36, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  vsLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 },
  squadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
});
