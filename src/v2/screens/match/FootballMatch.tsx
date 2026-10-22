// One football match (same as yoiden.com/events/<id>/match/<matchId> for
// football): navy band with the big scoreboard, goals by minute for each
// side (own goals credited to the other side's player) and the match
// details. Ported from the website's components/football/match-view.tsx.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppHeader, Page } from '../../components/chrome';
import { DetailRows, Empty, Panel, ScoreBox, Stripes, TeamBadge } from '../../components/ui';
import { C, MAX_W, body, head } from '../../theme';
import type { YoidenEvent } from '../../data/events';
import { formatDay, formatTime } from '../../data/league-feed';
import { playerSlug } from '../../data/players';
import { isDone, isLiveMatch, minuteText, phaseLabel, stageLabel, type FbGoal } from '../../data/football-feed';
import { MatchStatus, divisionsOf, fbTeam, useFootball } from '../event/football-parts';

export default function FootballMatch({ event, matchId }: { event: YoidenEvent; matchId: string }) {
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
  if (state.status === 'error') return note("Couldn't load this match right now.");
  const feed = state.data;
  const m = feed.matches.find((x) => x.id === matchId);
  if (!m) return note("This match isn't in the event any more.");

  const divisions = divisionsOf(feed).length;
  const home = fbTeam(feed, m.homeTeamId, m.homeLabel);
  const away = fbTeam(feed, m.awayTeamId, m.awayLabel);
  const showScore = isDone(m) || isLiveMatch(m);
  const homeWon = isDone(m) && !!m.winnerTeamId && m.winnerTeamId === m.homeTeamId;
  const awayWon = isDone(m) && !!m.winnerTeamId && m.winnerTeamId === m.awayTeamId;
  const goals = [...m.goals].sort((a, b) => a.minute - b.minute || (a.addedMinute ?? 0) - (b.addedMinute ?? 0));
  const side = (teamId: string | null) => goals.filter((g) => g.teamId === teamId);

  const scorer = (g: FbGoal, teamId: string | null, right: boolean) => {
    // An own goal counts for this side but was scored by the other team's player.
    const playerTeam = g.ownGoal ? (teamId === m.homeTeamId ? away : home) : teamId === m.homeTeamId ? home : away;
    const text = `${g.player ?? 'Unknown'}${g.penalty ? ' (pen)' : ''}${g.ownGoal ? ' (og)' : ''}`;
    const minute = <Text style={head(15, C.mute)}>{minuteText(g)}</Text>;
    const name = <Text style={[body(14, C.ink), { flexShrink: 1, textAlign: right ? 'right' : 'left' }]}>{text}</Text>;
    const inner = right ? (
      <>
        {name}
        {minute}
      </>
    ) : (
      <>
        {minute}
        {name}
      </>
    );
    const rowStyle = [s.goal, right && { justifyContent: 'flex-end' as const }];
    return g.player ? (
      <Pressable
        key={g.id}
        onPress={() => nav.push('Player', { eventId: event.id, slug: playerSlug({ name: g.player!, team: playerTeam }) })}
        style={rowStyle}
      >
        {inner}
      </Pressable>
    ) : (
      <View key={g.id} style={rowStyle}>
        {inner}
      </View>
    );
  };

  const kickOff = m.startsAt ? [formatDay(m.startsAt), formatTime(m.startsAt)].filter(Boolean).join(', ') : '';

  return shell(
    <>
      <View style={s.band}>
        <Stripes height={200} wide />
        <View style={s.bandInner}>
          <Text style={[head(26, C.white), { paddingRight: 40 }]}>
            {stageLabel(m, divisions)}: {home.name} vs {away.name}
          </Text>
          <View style={s.board}>
            <View style={s.boardTeam}>
              <TeamBadge team={home} size={44} />
              <Text style={[head(20, awayWon ? C.mute : C.ink), { textAlign: 'center' }]} numberOfLines={3}>
                {home.name}
              </Text>
            </View>
            <View style={s.boardMid}>
              <MatchStatus m={m} />
              {showScore ? (
                <View style={s.scores}>
                  <ScoreBox score={m.homeScore} won={homeWon} lost={awayWon} big />
                  <Text style={body(16, C.mute)}>–</Text>
                  <ScoreBox score={m.awayScore} won={awayWon} lost={homeWon} big />
                </View>
              ) : (
                <Text style={head(28, C.mute)}>vs</Text>
              )}
              {m.homePens != null && m.awayPens != null && (
                <Text style={body(13, C.soft)}>
                  Penalties {m.homePens}–{m.awayPens}
                </Text>
              )}
              {m.result?.startsWith('wo') && <Text style={body(13, C.soft)}>Walkover</Text>}
            </View>
            <View style={s.boardTeam}>
              <TeamBadge team={away} size={44} />
              <Text style={[head(20, homeWon ? C.mute : C.ink), { textAlign: 'center' }]} numberOfLines={3}>
                {away.name}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[s.col, { gap: 16 }]}>
        <Panel title="Goals">
          {goals.length ? (
            <View style={{ flexDirection: 'row' }}>
              {[m.homeTeamId, m.awayTeamId].map((tid, i) => (
                <View key={i} style={[s.goalCol, i === 1 && s.goalColRight]}>
                  {side(tid).map((g) => scorer(g, tid, i === 1))}
                  {!side(tid).length && (
                    <Text style={[body(13, C.mute), i === 1 && { textAlign: 'right' }]}>No goals</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={[body(14, C.soft), { padding: 14 }]}>{showScore ? 'No goals in this match.' : 'Not played yet.'}</Text>
          )}
        </Panel>

        <Panel title="Match details">
          <DetailRows
            rows={[
              ['Stage', stageLabel(m, divisions)],
              ['Status', phaseLabel(m)],
              ...(m.turf ? [['Turf', String(m.turf)] as [string, string]] : []),
              ...(kickOff ? [['Kick-off', kickOff] as [string, string]] : []),
              ['Match length', `2 × ${feed.event.halfMinutes} minutes`],
            ]}
          />
        </Panel>
      </View>
    </>,
  );
}

const s = StyleSheet.create({
  col: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18 },
  skeleton: { height: 360, margin: 16, borderRadius: 10, backgroundColor: C.white },
  band: { backgroundColor: C.bar, overflow: 'hidden' },
  bandInner: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  board: {
    marginTop: 18,
    backgroundColor: C.white,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  boardTeam: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8 },
  boardMid: { alignItems: 'center', gap: 6 },
  scores: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalCol: { flex: 1, padding: 14, gap: 8 },
  goalColRight: { borderLeftWidth: 1, borderLeftColor: C.line },
  goal: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
});
