// Football scorer and admin mode: every match, live first. Open a match to run its clock
// (kick off, half-time, second half, full time, walkover) and record goals against the
// live clock. The app's login stands in for the scorer's phone + PIN; the server holds a
// scorer to their own pitch.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Page } from '../../components/chrome';
import { Button, Empty, SectionLabel } from '../../components/ui';
import { CloseIcon } from '../../components/icons';
import {
  fetchFootball, isDone, isLiveMatch, minuteText, phaseLabel, stageLabel,
  type FbMatch, type FootballFeed,
} from '../../data/football-feed';
import { errorText, football, type ClockAction } from '../../data/modes-api';
import type { YoidenEvent } from '../../data/events';
import type { Role } from '../../store/roles';
import { useLoad } from '../../hooks';
import { xAlert, xConfirm } from '../../../utils/alert';
import { C, body, card, head, label } from '../../theme';

const when = (m: FbMatch) =>
  m.startsAt ? new Date(m.startsAt).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : 'Time to be set';

function MatchControl({ feed, m, slug, reload }: { feed: FootballFeed; m: FbMatch; slug: string; reload: () => void }) {
  const [team, setTeam] = useState<string | null>(null);
  const [own, setOwn] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const name = (id: string | null, fb: string) => feed.teams.find((t) => t.id === id)?.name ?? fb;
  const home = name(m.homeTeamId, m.homeLabel);
  const away = name(m.awayTeamId, m.awayLabel);
  const knockout = m.stage !== 'group';

  const run = async (fn: () => Promise<unknown>, fail: string) => {
    setBusy(true);
    try {
      await fn();
      reload();
    } catch (e) {
      xAlert(fail, errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const clock = (action: ClockAction, result?: 'home' | 'away' | 'draw') => run(() => football.clock(slug, m.id, action, result), 'Clock not changed');

  const fullTime = () => {
    if (knockout && m.homeScore === m.awayScore) {
      xAlert('Pick the winner', 'A knockout needs a winner. Record the shoot-out or use "Winner" below.');
      return;
    }
    xConfirm('End the match?', `${home} ${m.homeScore}–${m.awayScore} ${away}`, () => clock('fulltime'), 'Full time');
  };

  // Own goal: the player comes from the other side.
  const squadTeam = team && own ? (team === m.homeTeamId ? m.awayTeamId : m.homeTeamId) : team;
  const squad = feed.players.filter((p) => p.teamId === squadTeam);
  const addGoal = (playerId: string | null) => {
    if (!team) return;
    const body = { teamId: team, ownGoal: own, ...(playerId ? { playerId } : newName.trim() ? { newPlayerName: newName.trim() } : {}) };
    run(async () => {
      await football.goal(slug, m.id, body);
      setTeam(null);
      setOwn(false);
      setNewName('');
    }, 'Goal not added');
  };

  const phase = m.phase;
  const live = isLiveMatch(m);
  return (
    <View style={s.control}>
      <View style={s.board}>
        <Text style={[head(18, C.white), { flex: 1 }]} numberOfLines={2}>
          {home}
        </Text>
        <View style={s.boardScore}>
          <Text style={head(30, C.bar)}>
            {m.homeScore}–{m.awayScore}
          </Text>
        </View>
        <Text style={[head(18, C.white), { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
          {away}
        </Text>
      </View>
      <Text style={[label(12, live ? C.live : C.soft), { textAlign: 'center' }]}>{phaseLabel(m)}</Text>

      <View style={s.row}>
        {phase === 'pre' ? <Button title="Kick off" onPress={() => clock('kickoff')} /> : null}
        {phase === '1h' ? <Button title="Half-time" tone="navy" onPress={() => clock('halftime')} /> : null}
        {phase === 'ht' ? <Button title="Start 2nd half" onPress={() => clock('second')} /> : null}
        {live ? <Button title="Full time" tone="navy" onPress={fullTime} /> : null}
        {phase === 'ft' ? <Button title="Reopen match" tone="white" onPress={() => clock('reopen')} /> : null}
      </View>
      {phase === 'pre' || (knockout && live && m.homeScore === m.awayScore) ? (
        <View style={s.row}>
          {(['home', 'away'] as const).map((side) => (
            <Pressable
              key={side}
              onPress={() =>
                phase === 'pre'
                  ? xConfirm('Walkover?', `${side === 'home' ? home : away} win without playing.`, () => clock('walkover', side), 'Walkover')
                  : xConfirm('End with this winner?', `${side === 'home' ? home : away} go through.`, () => clock('fulltime', side), 'Full time')
              }
              style={s.link}
            >
              <Text style={label(12.5, C.accent)}>
                {phase === 'pre' ? 'Walkover' : 'Winner'}: {side === 'home' ? home : away}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {phase !== 'pre' ? (
        <>
          <Text style={label(12, C.soft)}>Add a goal</Text>
          <View style={s.row}>
            {[m.homeTeamId, m.awayTeamId].map((id) =>
              id ? (
                <Pressable key={id} onPress={() => setTeam(team === id ? null : id)} style={[s.teamBtn, team === id && s.teamOn]}>
                  <Text style={label(13, team === id ? C.hl : C.bar)} numberOfLines={1}>
                    {name(id, '')}
                  </Text>
                </Pressable>
              ) : null,
            )}
          </View>
          {team ? (
            <View style={{ gap: 8 }}>
              <Pressable onPress={() => setOwn(!own)} style={[s.own, own && s.ownOn]}>
                <Text style={label(12, own ? C.bar : C.soft)}>{own ? '✓ Own goal (scored by the other side)' : 'Own goal?'}</Text>
              </Pressable>
              <Text style={body(12, C.soft)}>Tap the scorer. The minute comes from the match clock.</Text>
              <View style={s.chips}>
                {squad.map((p) => (
                  <Pressable key={p.id} disabled={busy} onPress={() => addGoal(p.id)} style={s.pchip}>
                    <Text style={body(12.5, C.ink, 'semi')}>
                      {p.jersey != null ? `${p.jersey} · ` : ''}
                      {p.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={newName} onChangeText={setNewName} placeholder="Not listed? Type the name" placeholderTextColor={C.mute} style={s.input} />
                <Button title="Add" small onPress={() => addGoal(null)} />
              </View>
              <Pressable onPress={() => addGoal(null)} disabled={!!newName.trim()} style={s.link}>
                <Text style={label(12, C.accent)}>Goal, scorer not known</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      {m.goals.length ? (
        <View style={{ gap: 6 }}>
          <Text style={label(12, C.soft)}>Goals</Text>
          {m.goals.map((g) => (
            <View key={g.id} style={s.goal}>
              <Text style={[body(13, C.ink), { flex: 1 }]}>
                {minuteText(g)} {g.player ?? 'Unknown'}
                {g.ownGoal ? ' (OG)' : ''} · {name(g.teamId, '')}
              </Text>
              <Pressable
                onPress={() => xConfirm('Remove this goal?', `${minuteText(g)} ${g.player ?? ''}`, () => run(() => football.deleteGoal(slug, g.id), 'Goal not removed'), 'Remove')}
                hitSlop={8}
                accessibilityLabel="Remove goal"
              >
                <CloseIcon size={16} color={C.mute} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function FootballMode({ event, role }: { event: YoidenEvent; role: Role }) {
  const slug = event.football!;
  const [openId, setOpenId] = useState<string | null>(null);
  const { state, reload } = useLoad(`fbmode-${slug}`, () => fetchFootball(slug), { pollMs: 10_000, live: () => true });
  const { state: who } = useLoad(`fbrole-${slug}`, () => football.role(slug));

  const groups = useMemo(() => {
    if (state.status !== 'ready') return null;
    const ms = state.data.matches.filter((m) => m.homeTeamId || m.awayTeamId);
    return {
      live: ms.filter(isLiveMatch),
      next: ms.filter((m) => m.phase === 'pre'),
      done: ms.filter(isDone).reverse(),
    };
  }, [state]);

  if (who.status === 'error') {
    return (
      <Page>
        <View style={{ marginTop: 16 }}>
          <Empty>This phone isn't on the scorer list for this event. Ask the organiser to add your number.</Empty>
        </View>
      </Page>
    );
  }
  if (state.status !== 'ready' || !groups) {
    return (
      <Page>
        <View style={{ marginTop: 16 }}>
          <Empty>{state.status === 'error' ? "Couldn't load the matches. Pull down to try again." : 'Loading matches…'}</Empty>
        </View>
      </Page>
    );
  }
  const feed = state.data;
  const divisions = new Set(feed.teams.map((t) => t.division)).size;
  const name = (id: string | null, fb: string) => feed.teams.find((t) => t.id === id)?.name ?? fb;

  const section = (title: string, list: FbMatch[], color?: string) =>
    list.length ? (
      <>
        <SectionLabel color={color}>{`${title} · ${list.length}`}</SectionLabel>
        <View style={{ gap: 10, paddingHorizontal: 16 }}>
          {list.map((m) => (
            <View key={m.id} style={[card, { overflow: 'hidden' }]}>
              <Pressable onPress={() => setOpenId(openId === m.id ? null : m.id)} style={({ pressed }) => [s.match, pressed && { backgroundColor: C.page }]}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={label(11.5, C.soft)}>
                    {stageLabel(m, divisions)}
                    {m.turf ? ` · Pitch ${m.turf}` : ''} · {when(m)}
                  </Text>
                  <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
                    {name(m.homeTeamId, m.homeLabel)}
                  </Text>
                  <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
                    {name(m.awayTeamId, m.awayLabel)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={head(22, isLiveMatch(m) ? C.live : C.ink)}>{m.phase === 'pre' ? '–' : `${m.homeScore}–${m.awayScore}`}</Text>
                  <Text style={label(10.5, isLiveMatch(m) ? C.live : C.mute)}>{phaseLabel(m)}</Text>
                </View>
              </Pressable>
              {openId === m.id ? <MatchControl feed={feed} m={m} slug={slug} reload={reload} /> : null}
            </View>
          ))}
        </View>
      </>
    ) : null;

  return (
    <Page padded={false} onRefresh={reload}>
      {who.status === 'ready' && who.data.turf && role !== 'admin' ? (
        <Text style={[body(12.5, C.soft), { paddingHorizontal: 16, paddingTop: 14 }]}>You score pitch {who.data.turf}.</Text>
      ) : null}
      {section('Live now', groups.live, C.live)}
      {section('To play', groups.next)}
      {section('Played', groups.done)}
      <View style={{ height: 32 }} />
    </Page>
  );
}

const s = StyleSheet.create({
  match: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  control: { borderTopWidth: 1, borderTopColor: C.line, padding: 12, gap: 10, backgroundColor: '#FAFBFC' },
  board: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bar, borderRadius: 10, padding: 12 },
  boardScore: { backgroundColor: C.hl, borderRadius: 7, paddingHorizontal: 10 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  link: { paddingHorizontal: 10, paddingVertical: 8 },
  teamBtn: { flex: 1, minHeight: 46, borderRadius: 9, borderWidth: 1, borderColor: C.bar, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  teamOn: { backgroundColor: C.bar },
  own: { alignSelf: 'flex-start', borderWidth: 1, borderColor: C.line, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  ownOn: { backgroundColor: C.hl, borderColor: C.hl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pchip: { borderWidth: 1, borderColor: C.lineStrong, borderRadius: 8, paddingHorizontal: 10, minHeight: 38, justifyContent: 'center', backgroundColor: C.white },
  input: { flex: 1, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 9, paddingHorizontal: 12, minHeight: 44, fontSize: 14, color: C.ink, backgroundColor: C.white },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
