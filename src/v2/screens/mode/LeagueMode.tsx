// Scorer and admin mode for a league: every tie of the season, live ones first, then
// today's, then what's next and what's done. Tapping a tie opens it for scoring. Admins
// also get Standings (the public table), Teams, Scorers and Links tabs, and can put a
// tie on a court from its card.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Page } from '../../components/chrome';
import { Empty, SectionLabel, SegTabs, TeamBadge } from '../../components/ui';
import { ChevronRight } from '../../components/icons';
import { fetchLeague, roundLabel } from '../../data/league-feed';
import { errorText, leagueAdmin, scorer, type ScoreTie } from '../../data/modes-api';
import type { YoidenEvent } from '../../data/events';
import type { Role } from '../../store/roles';
import { useLoad } from '../../hooks';
import { LinksTab, ScorersTab, TeamsTab } from './league-admin';
import { StandingsTab } from '../event/LeagueEvent';
import { C, body, card, head, label } from '../../theme';

const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

export function tieWhen(t: Pick<ScoreTie, 'scheduledStart' | 'matchDay'>): string {
  if (t.scheduledStart) {
    return new Date(t.scheduledStart).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  }
  return t.matchDay ? new Date(`${t.matchDay}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Date to be set';
}

function StatusChip({ t }: { t: ScoreTie }) {
  const map: Record<string, [string, string, string]> = {
    in_progress: ['Live', C.live, C.white],
    completed: ['Done', C.greenSoft, C.green],
    lineup_locked: ['Lineups in', C.amberSoft, C.amber],
    lineup_submitted: ['Lineups in', C.amberSoft, C.amber],
  };
  const [text, bg, fg] = map[t.status] ?? ['Not started', C.page, C.soft];
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={label(11, fg)}>{text}</Text>
    </View>
  );
}

/** Admin-only: the tie's court, tap to pick 1-8 or clear it. */
function CourtPicker({ t, leagueId, onSaved }: { t: ScoreTie; leagueId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (court: number | null) => {
    setOpen(false);
    try {
      await leagueAdmin.assignCourt(leagueId, t.id, court);
      setErr(null);
      onSaved();
    } catch (e) {
      setErr(errorText(e, 'Could not set the court.'));
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={({ pressed }) => [s.courtBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
        <Text style={label(11.5, C.bar)}>{t.courtNumber ? `Court ${t.courtNumber}` : 'Set court'} ▾</Text>
      </Pressable>
      {open ? (
        <View style={s.courts}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <Pressable key={n} onPress={() => pick(n)} style={[s.court, t.courtNumber === n && { backgroundColor: C.bar }]}>
              <Text style={label(13, t.courtNumber === n ? C.hl : C.bar)}>{n}</Text>
            </Pressable>
          ))}
          {t.courtNumber ? (
            <Pressable onPress={() => pick(null)} style={[s.court, { paddingHorizontal: 10 }]}>
              <Text style={label(11.5, C.soft)}>None</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {err ? <Text style={body(12, C.live)}>{err}</Text> : null}
    </View>
  );
}

function TieRow({ t, me, onPress, admin, colors }: { t: ScoreTie; me: string; onPress: () => void; admin?: { leagueId: string; onSaved: () => void }; colors?: Record<string, string | null> }) {
  const home = t.homeTeam ?? { name: 'TBD', shortName: '' };
  const away = t.awayTeam ?? { name: 'TBD', shortName: '' };
  const played = t.status === 'completed' || t.status === 'in_progress';
  // The server totals a tie when it's finished; until then count games won.
  const won = (side: 'a' | 'b') =>
    t.matches.filter((g) => g.status === 'completed' && (side === 'a' ? (g.teamAScore ?? 0) > (g.teamBScore ?? 0) : (g.teamBScore ?? 0) > (g.teamAScore ?? 0))).length;
  const score = (i: number) => (t.status === 'completed' ? (i === 0 ? t.homeScore : t.awayScore) : won(i === 0 ? 'a' : 'b'));
  const holder = t.scorerId && t.scorerId !== me ? t.scorerName ?? 'Another scorer' : null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [card, s.tie, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <View style={s.tieHead}>
        <Text style={label(11.5, C.soft)} numberOfLines={1}>
          {roundLabel(t.round)}
          {t.courtNumber ? ` · Court ${t.courtNumber}` : ''} · {tieWhen(t)}
        </Text>
        <StatusChip t={t} />
      </View>
      {[home, away].map((team, i) => (
        <View key={i} style={s.side}>
          <TeamBadge team={{ name: team.name, shortName: team.shortName ?? '', color: ('id' in team && colors?.[team.id]) || null }} size={22} />
          <Text style={[body(14.5, C.ink, 'semi'), { flex: 1 }]} numberOfLines={1}>
            {team.name}
          </Text>
          {played ? <Text style={head(20, C.ink)}>{score(i)}</Text> : null}
        </View>
      ))}
      {admin && t.status !== 'completed' ? <CourtPicker t={t} leagueId={admin.leagueId} onSaved={admin.onSaved} /> : null}
      <View style={s.tieFoot}>
        <Text style={body(12, holder ? C.amber : C.mute)}>{holder ? `Being scored by ${holder}` : t.status === 'completed' ? 'Open to check or fix' : 'Tap to score'}</Text>
        <ChevronRight color={C.mute} />
      </View>
    </Pressable>
  );
}

export default function LeagueMode({ event, slug, leagueId, role }: { event: YoidenEvent; slug: string; leagueId?: string; role: Role }) {
  const nav = useNavigation<any>();
  const [showAllDone, setShowAllDone] = useState(false);
  const [tab, setTab] = useState<'ties' | 'standings' | 'teams' | 'scorers' | 'links'>('ties');
  const [feed, setFeed] = useState<Awaited<ReturnType<typeof fetchLeague>> | null>(null);
  const { state, reload } = useLoad(
    `mode-${slug}`,
    async () => {
      const f = await fetchLeague(slug);
      setFeed(f);
      return scorer.data(f.season.id);
    },
    { pollMs: 20_000, live: () => true },
  );
  const isAdmin = role === 'admin' && !!leagueId;
  const colors = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const g of feed?.groups ?? []) for (const r of g.rows) m[r.team.id] = r.team.color;
    for (const t of feed?.ties ?? []) for (const x of [t.home, t.away]) if (x?.id && !(x.id in m)) m[x.id] = x.color;
    return m;
  }, [feed]);

  const groups = useMemo(() => {
    if (state.status !== 'ready') return null;
    const today = todayIST();
    const ties = state.data.ties.filter((t) => t.homeTeam || t.awayTeam);
    const live = ties.filter((t) => t.status === 'in_progress');
    const todays = ties.filter((t) => t.status !== 'in_progress' && t.status !== 'completed' && t.matchDay === today);
    const next = ties.filter((t) => t.status !== 'in_progress' && t.status !== 'completed' && t.matchDay !== today && (!t.matchDay || t.matchDay > today));
    const done = ties.filter((t) => t.status === 'completed').reverse();
    return { live, todays, next, done };
  }, [state]);

  const open = (t: ScoreTie) =>
    state.status === 'ready' && nav.navigate('ScoreTie', { eventId: event.id, slug, seasonId: state.data.season.id, tieId: t.id, role });

  const section = (title: string, list: ScoreTie[], color?: string) =>
    list.length ? (
      <>
        <SectionLabel color={color}>{`${title} · ${list.length}`}</SectionLabel>
        <View style={{ gap: 10, paddingHorizontal: 16 }}>
          {list.map((t) => (
            <TieRow key={t.id} t={t} me={state.status === 'ready' ? state.data.userId : ''} onPress={() => open(t)} colors={colors} admin={isAdmin ? { leagueId: leagueId!, onSaved: reload } : undefined} />
          ))}
        </View>
      </>
    ) : null;

  const tiesView = (
    <>
      {state.status === 'loading' ? (
        <View style={{ padding: 16 }}>
          <Empty>Loading matches…</Empty>
        </View>
      ) : state.status === 'error' ? (
        <View style={{ padding: 16 }}>
          <Empty>Couldn't load the matches. Pull down to try again.</Empty>
        </View>
      ) : groups && !groups.live.length && !groups.todays.length && !groups.next.length && !groups.done.length ? (
        <View style={{ padding: 16 }}>
          <Empty>No matches have been set for this league yet.</Empty>
        </View>
      ) : groups ? (
        <>
          {section('Live now', groups.live, C.live)}
          {section('Today', groups.todays)}
          {section('Coming up', groups.next.slice(0, 12))}
          {section('Done', showAllDone ? groups.done : groups.done.slice(0, 6))}
          {groups.done.length > 6 && !showAllDone ? (
            <Pressable onPress={() => setShowAllDone(true)} style={s.more}>
              <Text style={label(13, C.accent)}>Show all {groups.done.length} results</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <Page padded={false} onRefresh={reload}>
      {isAdmin ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SegTabs
            tabs={
              [
                { key: 'ties', label: 'Matches' },
                { key: 'standings', label: 'Standings' },
                { key: 'teams', label: 'Teams' },
                { key: 'scorers', label: 'Scorers' },
                { key: 'links', label: 'Links' },
              ] as const
            }
            value={tab}
            onChange={setTab}
          />
        </View>
      ) : null}
      {isAdmin && tab === 'standings' ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>{feed ? <StandingsTab feed={feed} /> : <Empty>Loading…</Empty>}</View>
      ) : isAdmin && tab === 'teams' ? (
        <TeamsTab leagueId={leagueId!} colors={colors} />
      ) : isAdmin && tab === 'scorers' ? (
        <ScorersTab leagueId={leagueId!} />
      ) : isAdmin && tab === 'links' ? (
        <LinksTab leagueId={leagueId!} eventUrl={event.url} />
      ) : (
        tiesView
      )}
      <View style={{ height: 32 }} />
    </Page>
  );
}

const s = StyleSheet.create({
  tie: { padding: 13, gap: 8 },
  tieHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tieFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 9, marginTop: 2 },
  chip: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  more: { alignSelf: 'center', paddingVertical: 14 },
  courtBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: C.lineStrong, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
  courts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  court: { minWidth: 36, height: 34, borderRadius: 7, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
});
