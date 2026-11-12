// Scoring one tie: every game with its players and score. Tap a game to open the web
// scorer portal on it, full screen: the exact screen courtside scorers use, with serve,
// swap sides and change of ends. DONE (or the portal's own back) returns here.
// Opening the tie claims it for this scorer, like the web scorer portal.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { ModeBar } from '../../components/mode-bar';
import { Page } from '../../components/chrome';
import { Button, Empty, SectionLabel } from '../../components/ui';
import { categoryLabel, roundLabel } from '../../data/league-feed';
import { errorText, leagueAdmin, scorer, type ScorerData } from '../../data/modes-api';
import { eventById } from '../../data/events';
import type { Role } from '../../store/roles';
import { useLoad } from '../../hooks';
import { xAlert, xConfirm } from '../../../utils/alert';
import { C, body, card, head, label } from '../../theme';
import { API_BASE_URL } from '../../../config/constants';
import { useAuthStore } from '../../../store/authStore';
import { CourtPicker, tieWhen } from './LeagueMode';
import { TieAdminPanel } from './tie-admin';
import { ScorerFrame } from './scorer-frame';

// The login token rides in the fragment, which the browser never sends to the server.
const scorerUrl = (seasonId: string, tieId: string, matchId: string) =>
  `${API_BASE_URL}/scorer?embed=app&season=${encodeURIComponent(seasonId)}&tie=${encodeURIComponent(tieId)}` +
  `&match=${encodeURIComponent(matchId)}#t=${encodeURIComponent(useAuthStore.getState().token ?? '')}`;

type Params = { eventId: string; slug: string; seasonId: string; tieId: string; role: Role; leagueId?: string };

const names = (d: ScorerData, a: string | null, b: string | null) =>
  [a, b].map((id) => (id ? d.roster[id]?.name ?? 'Player' : 'Substitute')).join(' & ');

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

  const closeScorer = () => {
    setOpenId(null);
    reload();
  };

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

            {p.role === 'admin' && p.leagueId ? <TieAdminPanel leagueId={p.leagueId} tieId={p.tieId} onChanged={reload} /> : null}

            <SectionLabel>Games</SectionLabel>
            <View style={{ gap: 10, paddingHorizontal: 16 }}>
              {games.map((g) => {
                const filed = g.status === 'completed';
                return (
                  <View key={g.matchId} style={[card, { overflow: 'hidden' }]}>
                    <Pressable
                      disabled={lockedByOther}
                      onPress={() => setOpenId(g.matchId)}
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
                    {p.role === 'admin' && p.leagueId && !filed && tie.status !== 'completed' ? (
                      <View style={s.gameCourt}>
                        <CourtPicker court={g.court} save={(c) => leagueAdmin.gameCourt(p.leagueId!, tie.id, g.slotNumber, c).then(reload)} />
                      </View>
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
                This tie is finished.{p.role === 'admin' ? ' Reopen it above if a result must change.' : ''}
              </Text>
            ) : null}
          </>
        )}
        <View style={{ height: 32 }} />
      </Page>
      {openId && tie ? (
        <Modal visible animationType="slide" onRequestClose={closeScorer}>
          <SafeAreaView style={{ flex: 1, backgroundColor: C.bar }} edges={['top', 'bottom']}>
            <View style={s.scBar}>
              <Text style={[label(12.5, C.white), { flex: 1 }]} numberOfLines={1}>
                Scoring · {tie.homeTeam?.shortName || tie.homeTeam?.name} v {tie.awayTeam?.shortName || tie.awayTeam?.name}
              </Text>
              <Pressable onPress={closeScorer} style={s.done} accessibilityLabel="Close scoring">
                <Text style={label(12.5, C.bar)}>Done</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
              <ScorerFrame src={scorerUrl(p.seasonId, tie.id, openId)} onClose={closeScorer} />
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { backgroundColor: C.bar, padding: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  tieScore: { backgroundColor: C.hl, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 2 },
  game: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  gameNo: { width: 30, height: 30, borderRadius: 6, backgroundColor: C.bar, alignItems: 'center', justifyContent: 'center' },
  gameCourt: { borderTopWidth: 1, borderTopColor: C.line, padding: 12 },
  scBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.bar },
  done: { backgroundColor: C.hl, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
});
