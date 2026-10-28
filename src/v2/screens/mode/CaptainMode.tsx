// Captain mode: the captain's team, its matches, and the lineup for each. The app's login
// gets a captain session for the phone (no team PIN), then reads and submits through the
// captain portal's own endpoints, so the server applies every lineup rule (categories,
// no-repeat pairs, powerplay, deadlines, locks) and its message is shown as is.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Page } from '../../components/chrome';
import { Button, Empty, SectionLabel } from '../../components/ui';
import { categoryLabel, roundLabel } from '../../data/league-feed';
import { captain, errorText, SUBSTITUTE, type CaptainData, type CaptainSlot, type CaptainTie } from '../../data/modes-api';
import type { YoidenEvent } from '../../data/events';
import { useLoad } from '../../hooks';
import { xAlert } from '../../../utils/alert';
import { C, body, card, head, label } from '../../theme';
import { tieWhen } from './LeagueMode';

type Pick = { p1: string | null; p2: string | null };

async function loadCaptain(slug: string, teamId?: string) {
  const { teams, session } = await captain.session();
  if (!session || !teams.length) throw new Error('not-captain');
  const team = teams.find((t) => t.franchiseId === teamId) ?? teams[0];
  const data = await captain.data(team.token, session);
  return { token: team.token, session, data, slug };
}

const slugOf = (sl: CaptainSlot) => sl.category.toLowerCase().replace(/ /g, '');

/** Players who may play a seat of this slot (mixed slots set a category per seat). */
function eligible(d: CaptainData, sl: CaptainSlot, seat: 0 | 1) {
  const allowed = sl.mixed ? [sl.allowedCategories[seat]].filter(Boolean) : sl.allowedCategories;
  return d.roster.filter((r) => !allowed.length || allowed.includes(r.categorySlug));
}

function PlayerChips({ options, value, onPick, disabled }: { options: { id: string; name: string }[]; value: string | null; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <Pressable key={o.id} disabled={disabled} onPress={() => onPick(o.id)} style={[s.pchip, on && s.pchipOn, o.id === SUBSTITUTE && !on && s.subChip]}>
            <Text style={body(12.5, on ? C.hl : o.id === SUBSTITUTE ? C.amber : C.ink, 'semi')}>{o.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LineupEditor({ d, tie, token, session, onSaved }: { d: CaptainData; tie: CaptainTie; token: string; session: string; onSaved: () => void }) {
  const initial = useMemo(() => {
    const m: Record<number, Pick> = {};
    for (const sl of d.slots) {
      const e = tie.sheet?.lineupData.find((x) => x.slotNumber === sl.slot);
      m[sl.slot] = { p1: e?.player1Id ?? null, p2: e?.player2Id ?? null };
    }
    return m;
  }, [d, tie]);
  const [sel, setSel] = useState(initial);
  const [pp, setPp] = useState<number | null>(tie.sheet?.lineupData.find((x) => x.powerplay)?.slotNumber ?? null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSel(initial), [initial]);

  const locked = (slot: number) => !!tie.matches.find((m) => m.slotNumber === slot)?.locked;
  const set = (slot: number, seat: 'p1' | 'p2', id: string) => setSel((x) => ({ ...x, [slot]: { ...x[slot], [seat]: x[slot]?.[seat] === id ? null : id } }));

  const submit = async () => {
    const open = d.slots.filter((sl) => !locked(sl.slot));
    for (const sl of open) {
      const v = sel[sl.slot];
      if (!v?.p1 || (!sl.singles && !v.p2)) {
        xAlert('Lineup not complete', `Pick ${sl.singles ? 'a player' : 'both players'} for ${sl.pairing || sl.category} (game ${sl.slot}). Use Substitute to decide at game time.`);
        return;
      }
    }
    setBusy(true);
    try {
      await captain.submit(
        token,
        session,
        tie.id,
        open.map((sl) => ({
          slotNumber: sl.slot,
          categorySlug: slugOf(sl),
          player1Id: sel[sl.slot].p1,
          player2Id: sl.singles ? null : sel[sl.slot].p2,
          powerplay: pp === sl.slot,
        })),
      );
      xAlert('Lineup submitted', `Your lineup against ${tie.opponent ?? 'your opponent'} is in.`);
      onSaved();
    } catch (e) {
      xAlert('Lineup not submitted', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 10, paddingHorizontal: 16 }}>
      {d.slots.map((sl) => {
        const lock = locked(sl.slot);
        const v = sel[sl.slot] ?? { p1: null, p2: null };
        const opts = (seat: 0 | 1) => [...eligible(d, sl, seat).map((r) => ({ id: r.playerId, name: r.name })), { id: SUBSTITUTE, name: 'Substitute' }];
        return (
          <View key={sl.slot} style={[card, s.slot, lock && { opacity: 0.6 }]}>
            <View style={s.slotHead}>
              <Text style={head(16, C.bar)}>Game {sl.slot}</Text>
              <Text style={label(11.5, C.soft)}>
                {sl.pairing || sl.category} · {sl.points} pt{sl.points === 1 ? '' : 's'}
              </Text>
            </View>
            {lock ? <Text style={body(12.5, C.soft)}>Locked: this game has started or your organiser closed it.</Text> : null}
            <Text style={label(11, C.mute)}>{sl.singles ? 'Player' : sl.mixed ? `Player 1 · ${categoryLabel(sl.allowedCategories[0] ?? '')}` : 'Player 1'}</Text>
            <PlayerChips options={opts(0)} value={v.p1} onPick={(id) => set(sl.slot, 'p1', id)} disabled={lock} />
            {!sl.singles ? (
              <>
                <Text style={label(11, C.mute)}>{sl.mixed ? `Player 2 · ${categoryLabel(sl.allowedCategories[1] ?? '')}` : 'Player 2'}</Text>
                <PlayerChips options={opts(1)} value={v.p2} onPick={(id) => set(sl.slot, 'p2', id)} disabled={lock} />
              </>
            ) : null}
            {d.powerplayPoints > 0 && !lock ? (
              <Pressable onPress={() => setPp(pp === sl.slot ? null : sl.slot)} style={[s.pp, pp === sl.slot && s.ppOn]}>
                <Text style={label(12, pp === sl.slot ? C.bar : C.soft)}>{pp === sl.slot ? '★ Powerplay game' : 'Make this the powerplay game'}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <Button title={busy ? 'Submitting…' : tie.sheet ? 'Update lineup' : 'Submit lineup'} onPress={submit} />
    </View>
  );
}

function Result({ t }: { t: CaptainTie }) {
  const won = (t.myScore ?? 0) > (t.oppScore ?? 0);
  return (
    <View style={[card, s.result]}>
      <View style={{ flex: 1 }}>
        <Text style={label(11, C.soft)}>
          {roundLabel(t.round)} · {tieWhen(t)}
        </Text>
        <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
          vs {t.opponent ?? 'TBD'}
        </Text>
      </View>
      <View style={[s.wl, { backgroundColor: won ? C.greenSoft : C.page }]}>
        <Text style={label(12, won ? C.green : C.soft)}>{won ? 'W' : 'L'}</Text>
      </View>
      <Text style={head(20, C.ink)}>
        {t.myScore ?? 0}–{t.oppScore ?? 0}
      </Text>
    </View>
  );
}

export default function CaptainMode({ event, slug, teamId }: { event: YoidenEvent; slug: string; teamId?: string }) {
  const { state, reload } = useLoad(`captain-${slug}-${teamId ?? ''}`, () => loadCaptain(slug, teamId));
  const [tieId, setTieId] = useState<string | null>(null);

  if (state.status !== 'ready') {
    return (
      <Page>
        <View style={{ marginTop: 16 }}>
          <Empty>{state.status === 'loading' ? 'Loading your team…' : "This phone isn't a captain of a team here. Ask your organiser to add your number as captain."}</Empty>
        </View>
      </Page>
    );
  }
  const { data: d, token, session } = state.data;
  const upcoming = d.ties.filter((t) => t.status !== 'completed' && t.opponent);
  const done = d.ties.filter((t) => t.status === 'completed').reverse();
  const current = upcoming.find((t) => t.id === tieId) ?? upcoming[0];

  return (
    <Page padded={false} onRefresh={reload}>
      <View style={s.team}>
        <Text style={label(12, 'rgba(255,255,255,0.7)')}>{d.franchise.leagueName}</Text>
        <Text style={head(26, C.white)}>{d.franchise.name}</Text>
        <Text style={body(12.5, 'rgba(255,255,255,0.75)')}>
          {d.roster.length} players · {done.length} played · {upcoming.length} to play
        </Text>
      </View>

      {current ? (
        <>
          <SectionLabel>{upcoming.length > 1 ? 'Your matches' : 'Next match'}</SectionLabel>
          {upcoming.length > 1 ? (
            <View style={[s.chips, { paddingHorizontal: 16, marginBottom: 10 }]}>
              {upcoming.slice(0, 6).map((t) => (
                <Pressable key={t.id} onPress={() => setTieId(t.id)} style={[s.pchip, t.id === current.id && s.pchipOn]}>
                  <Text style={body(12.5, t.id === current.id ? C.hl : C.ink, 'semi')}>vs {t.opponent}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={[card, s.next]}>
            <Text style={label(11.5, C.soft)}>
              {roundLabel(current.round)} · {tieWhen(current)}
            </Text>
            <Text style={head(22, C.bar)}>vs {current.opponent}</Text>
            <Text style={body(12.5, current.sheet ? C.green : C.amber, 'semi')}>
              {current.sheet ? 'Lineup submitted. You can change it until it locks.' : 'Lineup not submitted yet'}
            </Text>
            {current.tieSheetDeadline ? (
              <Text style={body(12, C.soft)}>
                Lineups close {new Date(current.tieSheetDeadline).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
              </Text>
            ) : null}
          </View>
          <SectionLabel>Lineup</SectionLabel>
          <LineupEditor key={current.id} d={d} tie={current} token={token} session={session} onSaved={reload} />
        </>
      ) : (
        <View style={{ padding: 16 }}>
          <Empty>No matches to set a lineup for right now.</Empty>
        </View>
      )}

      {done.length ? (
        <>
          <SectionLabel>{`Results · ${done.length}`}</SectionLabel>
          <View style={{ gap: 8, paddingHorizontal: 16 }}>
            {done.map((t) => (
              <Result key={t.id} t={t} />
            ))}
          </View>
        </>
      ) : null}

      <SectionLabel>{`Squad · ${d.roster.length}`}</SectionLabel>
      <View style={[card, { marginHorizontal: 16 }]}>
        {d.roster.map((r, i) => (
          <View key={r.playerId} style={[s.player, i === d.roster.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={[body(14, C.ink), { flex: 1 }]}>{r.name}</Text>
            <Text style={label(11.5, C.soft)}>{categoryLabel(r.categorySlug)}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 32 }} />
    </Page>
  );
}

const s = StyleSheet.create({
  team: { backgroundColor: C.bar, padding: 16, gap: 4 },
  next: { marginHorizontal: 16, padding: 14, gap: 4 },
  slot: { padding: 12, gap: 8 },
  slotHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pchip: { borderWidth: 1, borderColor: C.lineStrong, borderRadius: 8, paddingHorizontal: 10, minHeight: 36, justifyContent: 'center', backgroundColor: C.white },
  pchipOn: { backgroundColor: C.bar, borderColor: C.bar },
  subChip: { borderColor: '#F4C38B', backgroundColor: '#FFF7ED' },
  pp: { alignSelf: 'flex-start', borderWidth: 1, borderColor: C.line, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  ppOn: { backgroundColor: C.hl, borderColor: C.hl },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  wl: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  player: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
});
