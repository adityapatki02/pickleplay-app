// Scoring one tie: every game with its players and score. Tap a game to score it point by
// point; each tap is sent as a live score (debounced) so spectators see it, and Save files
// the result. The server checks the score against the game's rules and says what's wrong.
// Opening the tie claims it for this scorer, like the web scorer portal.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { ModeBar } from '../../components/mode-bar';
import { Page } from '../../components/chrome';
import { Button, Empty, SectionLabel } from '../../components/ui';
import { categoryLabel, roundLabel } from '../../data/league-feed';
import { errorText, scorer, type ScoreGame, type ScoreTie, type ScorerData } from '../../data/modes-api';
import { eventById } from '../../data/events';
import type { Role } from '../../store/roles';
import { useLoad } from '../../hooks';
import { xAlert, xConfirm } from '../../../utils/alert';
import { C, body, card, head, label } from '../../theme';
import { tieWhen } from './LeagueMode';

type Params = { eventId: string; slug: string; seasonId: string; tieId: string; role: Role };

const names = (d: ScorerData, a: string | null, b: string | null) =>
  [a, b].map((id) => (id ? d.roster[id]?.name ?? 'Player' : 'Substitute')).join(' & ');

function Stepper({ team, value, onStep, disabled }: { team: string; value: number; onStep: (delta: number) => void; disabled?: boolean }) {
  return (
    <View style={s.stepper}>
      <Text style={[label(12.5, C.soft), { textAlign: 'center' }]} numberOfLines={1}>
        {team}
      </Text>
      <Text style={[head(54, C.bar), { textAlign: 'center', marginVertical: 4 }]}>{value}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable disabled={disabled || value === 0} onPress={() => onStep(-1)} style={[s.stepBtn, s.minus]} accessibilityLabel={`${team} minus one`}>
          <Text style={head(26, C.bar)}>−</Text>
        </Pressable>
        <Pressable disabled={disabled} onPress={() => onStep(1)} style={[s.stepBtn, s.plus]} accessibilityLabel={`${team} plus one`}>
          <Text style={head(26, C.bar)}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The score pad for one game. Best-of-3 games keep one row per game. */
function GamePad({ tie, g, onDone, role }: { tie: ScoreTie; g: ScoreGame; onDone: () => void; role: Role }) {
  const home = tie.homeTeam?.name ?? 'Home';
  const away = tie.awayTeam?.name ?? 'Away';
  const [games, setGames] = useState<{ a: number; b: number }[]>(() =>
    g.bestOf3 ? (g.games.length ? g.games : [{ a: 0, b: 0 }]) : [{ a: g.teamAScore ?? 0, b: g.teamBScore ?? 0 }],
  );
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = g.status === 'completed';
  const cur = games.length - 1;

  // Taps can land faster than a render, so each one works from the latest score in the ref.
  const latest = useRef(games);
  const bump = (i: number, side: 'a' | 'b', delta: number) => {
    const next = latest.current.map((x, k) => (k === i ? { ...x, [side]: Math.max(0, x[side] + delta) } : x));
    latest.current = next;
    setGames(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      scorer.live(g.matchId, next[i].a, next[i].b, g.bestOf3 ? i + 1 : undefined).catch(() => {});
    }, 400);
  };
  const addGame = () => {
    latest.current = [...latest.current, { a: 0, b: 0 }];
    setGames(latest.current);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const save = async () => {
    setBusy(true);
    try {
      if (g.bestOf3) {
        const played = games.filter((x) => x.a > 0 || x.b > 0);
        const wa = played.filter((x) => x.a > x.b).length;
        const wb = played.filter((x) => x.b > x.a).length;
        await scorer.save(g.matchId, { teamAScore: wa, teamBScore: wb, games: played });
      } else {
        await scorer.save(g.matchId, { teamAScore: games[0].a, teamBScore: games[0].b });
      }
      onDone();
    } catch (e) {
      xAlert('Score not saved', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const declare = (winner: 'home' | 'away') =>
    xConfirm(
      'Award this game?',
      `${winner === 'home' ? home : away} win game ${g.playNo} without a played score (walkover, injury or forfeit).`,
      async () => {
        try {
          await scorer.declare(g.matchId, winner, 'Walkover');
          onDone();
        } catch (e) {
          xAlert('Not saved', errorText(e));
        }
      },
      'Award',
    );

  const reset = () =>
    xConfirm('Reset this game?', 'The score is cleared and the game goes back to not started.', async () => {
      try {
        await scorer.reset(g.matchId);
        onDone();
      } catch (e) {
        xAlert('Not reset', errorText(e));
      }
    }, 'Reset');

  return (
    <View style={s.pad}>
      {games.map((x, i) => (
        <View key={i}>
          {g.bestOf3 ? <Text style={[label(12, C.soft), { marginBottom: 6 }]}>Game {i + 1}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stepper team={home} value={x.a} onStep={(d) => bump(i, 'a', d)} disabled={done || (g.bestOf3 && i !== cur)} />
            <Stepper team={away} value={x.b} onStep={(d) => bump(i, 'b', d)} disabled={done || (g.bestOf3 && i !== cur)} />
          </View>
        </View>
      ))}
      {g.bestOf3 && !done && games.length < 3 ? (
        <Button title={`Start game ${games.length + 1}`} tone="white" small onPress={addGame} />
      ) : null}
      {done ? (
        <Text style={[body(13, C.soft), { textAlign: 'center' }]}>This game is filed. {role === 'admin' ? 'Reset it to change the score.' : 'Ask an admin to change it.'}</Text>
      ) : (
        <Button title={busy ? 'Saving…' : 'Save result'} onPress={save} />
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {!done ? (
          <>
            <Pressable onPress={() => declare('home')} style={s.link}>
              <Text style={label(12.5, C.accent)}>Award to {tie.homeTeam?.shortName || home}</Text>
            </Pressable>
            <Pressable onPress={() => declare('away')} style={s.link}>
              <Text style={label(12.5, C.accent)}>Award to {tie.awayTeam?.shortName || away}</Text>
            </Pressable>
          </>
        ) : null}
        {role === 'admin' && (done || g.status === 'in_progress') ? (
          <Pressable onPress={reset} style={s.link}>
            <Text style={label(12.5, C.live)}>Reset game</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function ScoreTieScreen() {
  const p = useRoute<any>().params as Params;
  const event = eventById(p.eventId);
  const [openId, setOpenId] = useState<string | null>(null);
  const { state, reload } = useLoad(`score-${p.tieId}`, () => scorer.data(p.seasonId), { pollMs: 10_000, live: () => true });
  const data = state.status === 'ready' ? state.data : null;
  const tie = data?.ties.find((t) => t.id === p.tieId);

  // Claim the tie on open, as the web scorer portal does.
  const claimed = useRef(false);
  useEffect(() => {
    if (!tie || claimed.current || tie.status === 'completed' || tie.scorerId) return;
    claimed.current = true;
    scorer.lock(tie.id).then(reload, () => {});
  }, [tie, reload]);

  const lockedByOther = !!tie && !!tie.scorerId && !tie.isMyLock;
  const games = tie ? [...tie.matches].sort((a, b) => a.playNo - b.playNo) : [];
  const allFiled = games.length > 0 && games.every((g) => g.status === 'completed');
  const canComplete = !!tie && tie.status !== 'completed' && (allFiled || tie.decided);
  // The server totals a tie when it's finished; until then count the games each side has won.
  const won = (side: 'a' | 'b') => games.filter((g) => g.status === 'completed' && (side === 'a' ? (g.teamAScore ?? 0) > (g.teamBScore ?? 0) : (g.teamBScore ?? 0) > (g.teamAScore ?? 0))).length;
  const tieTotal = tie?.status === 'completed' ? `${tie.homeScore}–${tie.awayScore}` : `${won('a')}–${won('b')}`;

  const complete = () =>
    xConfirm('Finish this tie?', 'The result goes into the standings. Only an admin can reopen it.', async () => {
      try {
        await scorer.complete(p.tieId);
        reload();
      } catch (e) {
        xAlert('Not finished', errorText(e));
      }
    }, 'Finish tie');

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <ModeBar role={p.role} title={event?.name ?? 'Event'} />
      <Page padded={false} onRefresh={reload}>
        {!tie ? (
          <View style={{ padding: 16 }}>
            <Empty>{state.status === 'loading' ? 'Loading the tie…' : "Couldn't find this tie."}</Empty>
          </View>
        ) : (
          <>
            <View style={s.head}>
              <Text style={label(12, 'rgba(255,255,255,0.7)')}>
                {roundLabel(tie.round)}
                {tie.courtNumber ? ` · Court ${tie.courtNumber}` : ''} · {tieWhen(tie)}
              </Text>
              <View style={s.scoreRow}>
                <Text style={[head(22, C.white), { flex: 1 }]} numberOfLines={2}>
                  {tie.homeTeam?.name ?? 'TBD'}
                </Text>
                <View style={s.tieScore}>
                  <Text style={head(30, C.bar)}>{tieTotal}</Text>
                </View>
                <Text style={[head(22, C.white), { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                  {tie.awayTeam?.name ?? 'TBD'}
                </Text>
              </View>
              {lockedByOther ? (
                <Text style={[body(12.5, C.hl), { marginTop: 8 }]}>{tie.scorerName ?? 'Another scorer'} is scoring this tie. You can watch it here.</Text>
              ) : null}
            </View>

            <SectionLabel>Games</SectionLabel>
            <View style={{ gap: 10, paddingHorizontal: 16 }}>
              {games.map((g) => {
                const open = openId === g.matchId;
                const filed = g.status === 'completed';
                return (
                  <View key={g.matchId} style={[card, { overflow: 'hidden' }]}>
                    <Pressable
                      disabled={lockedByOther}
                      onPress={() => setOpenId(open ? null : g.matchId)}
                      style={({ pressed }) => [s.game, pressed && { backgroundColor: C.page }]}
                    >
                      <View style={s.gameNo}>
                        <Text style={head(16, C.white)}>{g.playNo}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={label(11.5, C.soft)}>
                          {g.slotLabel || categoryLabel(g.categorySlug)}
                          {g.court ? ` · Court ${g.court}` : ''}
                        </Text>
                        <Text style={body(13, C.ink, 'semi')} numberOfLines={1}>
                          {data ? names(data, g.homePlayer1, g.homePlayer2) : ''}
                        </Text>
                        <Text style={body(13, C.ink, 'semi')} numberOfLines={1}>
                          {data ? names(data, g.awayPlayer1, g.awayPlayer2) : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={head(22, filed ? C.ink : g.status === 'in_progress' ? C.live : C.mute)}>
                          {g.teamAScore ?? 0}–{g.teamBScore ?? 0}
                        </Text>
                        <Text style={label(10.5, filed ? C.green : g.status === 'in_progress' ? C.live : C.mute)}>
                          {filed ? 'Filed' : g.status === 'in_progress' ? 'Live' : 'To play'}
                        </Text>
                      </View>
                    </Pressable>
                    {open && tie ? (
                      <GamePad key={`${g.matchId}-${g.status}`} tie={tie} g={g} role={p.role} onDone={() => { setOpenId(null); reload(); }} />
                    ) : null}
                  </View>
                );
              })}
            </View>

            {canComplete && !lockedByOther ? (
              <View style={{ padding: 16 }}>
                <Button title="Finish tie" tone="navy" onPress={complete} />
              </View>
            ) : tie.status === 'completed' ? (
              <Text style={[body(13, C.soft), { textAlign: 'center', padding: 16 }]}>
                This tie is finished.{p.role === 'admin' ? ' Reopen it from Courts & lineups if a result must change.' : ''}
              </Text>
            ) : null}
          </>
        )}
        <View style={{ height: 32 }} />
      </Page>
    </View>
  );
}

const s = StyleSheet.create({
  head: { backgroundColor: C.bar, padding: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  tieScore: { backgroundColor: C.hl, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 2 },
  game: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  gameNo: { width: 30, height: 30, borderRadius: 6, backgroundColor: C.bar, alignItems: 'center', justifyContent: 'center' },
  pad: { borderTopWidth: 1, borderTopColor: C.line, padding: 12, gap: 12, backgroundColor: '#FAFBFC' },
  stepper: { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10 },
  stepBtn: { flex: 1, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  minus: { backgroundColor: C.page, borderWidth: 1, borderColor: C.line },
  plus: { backgroundColor: C.hl },
  link: { paddingHorizontal: 10, paddingVertical: 8 },
});
