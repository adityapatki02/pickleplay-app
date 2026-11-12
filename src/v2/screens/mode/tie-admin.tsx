// Admin controls for one tie, shown above its games: both lineups (enter one for a captain
// who can't), lock / release them, put a scorer on the tie, and reopen it once finished.
// These use the web admin's own endpoints, so the server applies the same lineup rules
// and its message is shown as is.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Empty, SectionLabel } from '../../components/ui';
import { categoryLabel } from '../../data/league-feed';
import { errorText, leagueAdmin, SUBSTITUTE, type AdminData, type AdminTie, type AdminTieSlot, type AdminTeamRef } from '../../data/modes-api';
import { useLoad } from '../../hooks';
import { xAlert, xConfirm } from '../../../utils/alert';
import { C, body, card, head, label } from '../../theme';
import { PlayerChips } from './CaptainMode';
import { CourtPicker } from './LeagueMode';
import { printTieSheets, tieSheetsHtml, type SheetMode } from './tie-sheets';

type Pick = { p1: string | null; p2: string | null };

/** Players who may play a seat of this game (mixed games set a category per seat). */
function eligible(squad: AdminData['squads'][string], sl: AdminTieSlot, seat: 0 | 1) {
  const allowed = sl.mixed ? [sl.allowedCategories[seat]].filter(Boolean) : sl.allowedCategories;
  return squad.filter((r) => !allowed.length || allowed.includes(r.cat));
}

function LineupEditor({ d, leagueId, tie, team, onClose, onSaved }: { d: AdminData; leagueId: string; tie: AdminTie; team: AdminTeamRef; onClose: () => void; onSaved: () => void }) {
  const sheet = tie.sheets.find((x) => x.franchiseId === team.id);
  const squad = d.squads[team.id] ?? [];
  const initial = useMemo(() => {
    const m: Record<number, Pick> = {};
    for (const sl of tie.slots) {
      const e = sheet?.lineupData.find((x) => x.slotNumber === sl.slot);
      m[sl.slot] = { p1: e?.player1Id ?? null, p2: e?.player2Id ?? null };
    }
    return m;
  }, [tie, sheet]);
  const [sel, setSel] = useState(initial);
  const [pp, setPp] = useState<number | null>(sheet?.lineupData.find((x) => x.powerplay)?.slotNumber ?? null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSel(initial), [initial]);
  const ppOn = d.powerplayPoints > 0 && /^league_week_/.test(tie.round);

  const set = (slot: number, seat: 'p1' | 'p2', id: string) => setSel((x) => ({ ...x, [slot]: { ...x[slot], [seat]: x[slot]?.[seat] === id ? null : id } }));

  const save = async () => {
    for (const sl of tie.slots) {
      const v = sel[sl.slot];
      if (!v?.p1 || (!sl.singles && !v.p2)) {
        xAlert('Lineup not complete', `Pick ${sl.singles ? 'a player' : 'both players'} for game ${sl.slot}. Use Substitute to decide at game time.`);
        return;
      }
    }
    setBusy(true);
    try {
      await leagueAdmin.saveLineup(
        leagueId,
        tie.id,
        team.id,
        tie.slots.map((sl) => ({
          slotNumber: sl.slot,
          categorySlug: sl.category,
          player1Id: sel[sl.slot].p1,
          player2Id: sl.singles ? null : sel[sl.slot].p2,
          powerplay: ppOn && pp === sl.slot,
        })),
      );
      onSaved();
    } catch (e) {
      xAlert('Lineup not saved', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 10, marginTop: 10 }}>
      <Text style={head(16, C.bar)}>{team.name}</Text>
      {tie.slots.map((sl) => {
        const v = sel[sl.slot] ?? { p1: null, p2: null };
        const opts = (seat: 0 | 1) => [...eligible(squad, sl, seat).map((r) => ({ id: r.playerId, name: r.name })), { id: SUBSTITUTE, name: 'Substitute' }];
        return (
          <View key={sl.slot} style={s.slot}>
            <View style={s.row}>
              <Text style={[head(15, C.bar), { flex: 1 }]}>Game {sl.slot}</Text>
              <Text style={label(11.5, C.soft)}>
                {sl.pairing || sl.category} · {sl.points} pt{sl.points === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={label(11, C.mute)}>{sl.singles ? 'Player' : sl.mixed ? `Player 1 · ${categoryLabel(sl.allowedCategories[0] ?? '')}` : 'Player 1'}</Text>
            <PlayerChips options={opts(0)} value={v.p1} onPick={(id) => set(sl.slot, 'p1', id)} />
            {!sl.singles ? (
              <>
                <Text style={label(11, C.mute)}>{sl.mixed ? `Player 2 · ${categoryLabel(sl.allowedCategories[1] ?? '')}` : 'Player 2'}</Text>
                <PlayerChips options={opts(1)} value={v.p2} onPick={(id) => set(sl.slot, 'p2', id)} />
              </>
            ) : null}
            {ppOn ? (
              <Pressable onPress={() => setPp(pp === sl.slot ? null : sl.slot)} style={[s.pp, pp === sl.slot && s.ppOn]}>
                <Text style={label(12, pp === sl.slot ? C.bar : C.soft)}>{pp === sl.slot ? '★ Powerplay game' : 'Make this the powerplay game'}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {tie.slots.length ? <Button title={busy ? 'Saving…' : 'Save lineup'} onPress={save} /> : <Text style={body(13, C.soft)}>This match has no games set up yet, so there's no lineup to enter.</Text>}
      <Button title="Cancel" tone="white" small onPress={onClose} />
    </View>
  );
}

/** When captains can submit until, and buttons to open it again for late teams. */
function CaptainWindow({ tie, open }: { tie: AdminTie; open: (minutes: 15 | 30 | 60) => void }) {
  const closes = tie.tieSheetDeadline ? new Date(tie.tieSheetDeadline) : tie.scheduledStart ? new Date(new Date(tie.scheduledStart).getTime() - 30 * 60_000) : null;
  const isOpen = !closes || Date.now() < closes.getTime();
  const when = closes?.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  return (
    <View style={{ gap: 6 }}>
      <Text style={body(12.5, isOpen ? C.green : C.live, 'semi')}>{isOpen ? (when ? `Captains can submit until ${when}` : 'Captains can submit') : `Captain submissions closed ${when}`}</Text>
      <View style={[s.row, { gap: 6 }]}>
        {([[15, 'Open 15 min'], [30, 'Open 30 min'], [60, 'Open 1 hour']] as const).map(([m, t]) => (
          <Pressable key={m} onPress={() => open(m)} style={s.small} accessibilityRole="button">
            <Text style={label(11.5, C.bar)}>{t}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function TieAdminPanel({ leagueId, tieId, onChanged }: { leagueId: string; tieId: string; onChanged: () => void }) {
  const { state, reload } = useLoad(`tie-admin-${tieId}`, () => leagueAdmin.data(leagueId));
  const [editing, setEditing] = useState<string | null>(null);
  const changed = () => {
    reload();
    onChanged();
  };

  if (state.status !== 'ready') {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Empty>{state.status === 'loading' ? 'Loading admin controls…' : "Couldn't load the admin controls."}</Empty>
      </View>
    );
  }
  const d = state.data;
  const tie = d.ties.find((t) => t.id === tieId);
  if (!tie) return null;

  const run = async (title: string, call: () => Promise<unknown>) => {
    try {
      await call();
      changed();
    } catch (e) {
      xAlert(title, errorText(e));
    }
  };

  // Paper sheets for this tie: blank for captains, filled with lineups and scores for the scorer.
  const print = (mode: SheetMode) => {
    const html = tieSheetsHtml(d, [tie], mode);
    if (!html) return xAlert('Nothing to print', 'Both teams are needed on a tie sheet.');
    printTieSheets(html).catch((e) => xAlert('Not printed', errorText(e)));
  };
  const printRow = (
    <View style={[s.row, { flexWrap: 'wrap' }]}>
      <Text style={[label(11.5, C.soft), { flex: 1 }]}>Tie sheet</Text>
      <Pressable onPress={() => print('blank')} style={s.small} accessibilityRole="button">
        <Text style={label(12, C.bar)}>Print blank</Text>
      </Pressable>
      <Pressable onPress={() => print('filled')} style={s.small} accessibilityRole="button">
        <Text style={label(12, C.bar)}>Print filled</Text>
      </Pressable>
    </View>
  );

  if (tie.status === 'completed') {
    return (
      <View style={{ padding: 16, paddingBottom: 0, gap: 10 }}>
        {printRow}
        <Button
          title="Reopen this tie"
          tone="white"
          small
          onPress={() =>
            xConfirm('Reopen this tie?', 'It stops counting in the standings until it is finished again. Games and lineups stay as they are.', () => run('Not reopened', () => leagueAdmin.reopenTie(leagueId, tieId)), 'Reopen')
          }
        />
      </View>
    );
  }

  const teams = [tie.home, tie.away].filter((t): t is AdminTeamRef => !!t);
  const sheetOf = (t: AdminTeamRef) => tie.sheets.find((x) => x.franchiseId === t.id);
  const bothIn = teams.length === 2 && teams.every((t) => !!sheetOf(t));
  const locked = teams.length === 2 && teams.every((t) => sheetOf(t)?.status === 'locked');
  const held = !!d.season.releaseOnCommand;
  const editingTeam = teams.find((t) => t.id === editing);

  return (
    <>
      <SectionLabel>Admin</SectionLabel>
      <View style={[card, s.panel]}>
        <Text style={label(11.5, C.soft)}>Arrived at the venue</Text>
        {teams.map((t) => {
          const here = tie.presentTeamIds.includes(t.id);
          return (
            <View key={t.id} style={s.row}>
              <Text style={[body(14, C.ink, 'semi'), { flex: 1 }]} numberOfLines={1}>
                {t.name}
              </Text>
              <Pressable onPress={() => run('Not saved', () => leagueAdmin.setPresence(leagueId, tieId, t.id, !here))} style={[s.small, here && s.smallOn]} accessibilityRole="button">
                <Text style={label(12, here ? C.hl : C.bar)}>{here ? 'Present ✓' : 'Mark present'}</Text>
              </Pressable>
            </View>
          );
        })}

        {printRow}

        <Text style={[label(11.5, C.soft), { marginTop: 6 }]}>Lineups</Text>
        {teams.map((t) => {
          const st = sheetOf(t)?.status;
          return (
            <View key={t.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={body(12, st === 'locked' ? C.green : st ? C.ink : C.amber)}>{st === 'locked' ? 'Locked' : st ? 'Submitted' : 'Not in yet'}</Text>
              </View>
              <Pressable onPress={() => setEditing(editing === t.id ? null : t.id)} style={s.small} accessibilityRole="button">
                <Text style={label(12, C.bar)}>{st ? 'Edit' : 'Enter'}</Text>
              </Pressable>
            </View>
          );
        })}
        {!locked && teams.length === 2 && !(d.season.noDeadline && !tie.tieSheetDeadline) ? <CaptainWindow tie={tie} open={(m) => run('Not opened', () => leagueAdmin.openCaptains(leagueId, tieId, m))} /> : null}
        {editingTeam ? (
          <LineupEditor
            key={editingTeam.id}
            d={d}
            leagueId={leagueId}
            tie={tie}
            team={editingTeam}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              changed();
            }}
          />
        ) : null}
        {locked ? (
          <Text style={body(12.5, C.green, 'semi')}>{held ? 'Line-ups released to the public and the other team.' : 'Both lineups are locked.'}</Text>
        ) : (
          <>
            {bothIn ? (
              <Button
                title={held ? 'Release line-ups to public' : 'Lock lineups'}
                tone="navy"
                onPress={() =>
                  xConfirm(held ? 'Release both line-ups?' : 'Lock both lineups?', held ? 'They become public and captains can no longer edit them.' : 'Captains can no longer edit them.', () => run('Not locked', () => leagueAdmin.lockLineups(leagueId, tieId)), held ? 'Release' : 'Lock')
                }
              />
            ) : (
              <Text style={body(12, C.soft)}>You can lock these once both lineups are in. Enter one above for a team that hasn't.</Text>
            )}
          </>
        )}

        <Text style={[label(11.5, C.soft), { marginTop: 6 }]}>Court for the whole tie</Text>
        <CourtPicker court={tie.court} save={(c) => leagueAdmin.assignCourt(leagueId, tieId, c).then(changed)} />

        <Text style={[label(11.5, C.soft), { marginTop: 6 }]}>Scorer</Text>
        <PlayerChips
          options={d.scorers.map((x) => ({ id: x.userId, name: x.name }))}
          value={tie.scorerId}
          onPick={(id) => run('Scorer not set', () => leagueAdmin.assignScorer(leagueId, tieId, id === tie.scorerId ? null : id))}
        />
        {!d.scorers.length ? <Text style={body(12, C.soft)}>Add scorers under Management first.</Text> : null}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  panel: { marginHorizontal: 16, padding: 13, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallOn: { backgroundColor: C.bar, borderColor: C.bar },
  small: { borderWidth: 1, borderColor: C.lineStrong, borderRadius: 7, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.white },
  slot: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 8 },
  pp: { alignSelf: 'flex-start', borderWidth: 1, borderColor: C.line, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  ppOn: { backgroundColor: C.hl, borderColor: C.hl },
});
