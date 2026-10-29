// My record (opened from Me). The signed-in player's whole record from the
// career API: a sport picker at the top, then a by-format table with a total
// row and a table for every league they played in that sport.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, body, card, head, label } from '../theme';
import { Empty, Panel, SegTabs, Stripes } from '../components/ui';
import { AppHeader, Page } from '../components/chrome';
import { ChevronRight } from '../components/icons';
import { Cell, tableStyles } from './event/league-parts';
import { useLoad } from '../hooks';
import { useAuthStore } from '../../store/authStore';
import { getPlayerCareer } from '../../api/leagues.api';
import { eventForLeague, SectionLabel } from './MeScreen';

// ── Career API shape (GET /players/:id/career) ───────────────────────
type FormatRow = { format: string; played: number; won: number; lost: number; winPct: number; matchPointsFor?: number; matchPointsAgainst?: number; teamPoints?: number };
type LeagueRow = { seasonId: string; leagueName: string; seasonName: string; team: string; auctionPrice: number | null; byFormat: FormatRow[] };
type SportBlock = { sport: string; headline: { played: number; won: number; winPct: number }; metrics?: string[]; formats: FormatRow[]; leagues: LeagueRow[] };
type Career = { player: { id: string; fullName: string; avatarUrl: string | null; city: string | null }; sports: SportBlock[] };

// Pickleball and Badminton always show (the old app's picker); any other sport
// the player has matches in is added. Sports with matches come first.
const BASE_SPORTS = ['pickleball', 'badminton'];
const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '');

// Columns: P/W/L/Win% always; points columns only when the sport records them.
type Col = { key: string; label: string; w: number; get: (f: FormatRow) => string | number };
const COLS: Col[] = [
  { key: 'played', label: 'P', w: 32, get: (f) => f.played ?? 0 },
  { key: 'won', label: 'W', w: 32, get: (f) => f.won ?? 0 },
  { key: 'lost', label: 'L', w: 32, get: (f) => f.lost ?? 0 },
  { key: 'winPct', label: 'Win%', w: 50, get: (f) => `${f.winPct ?? 0}%` },
  { key: 'matchPoints', label: 'Pts', w: 42, get: (f) => f.matchPointsFor ?? 0 },
  { key: 'teamPoints', label: 'Team', w: 46, get: (f) => f.teamPoints ?? 0 },
];
const ALWAYS = new Set(['played', 'won', 'lost', 'winPct']);
const colsFor = (metrics?: string[]) => COLS.filter((c) => ALWAYS.has(c.key) || (metrics ?? []).includes(c.key));

function totalOf(rows: FormatRow[]): FormatRow {
  const sum = (k: keyof FormatRow) => rows.reduce((a, f) => a + ((f[k] as number) || 0), 0);
  const played = sum('played');
  const won = sum('won');
  return { format: 'Total', played, won, lost: sum('lost'), winPct: played ? Math.round((won / played) * 100) : 0, matchPointsFor: sum('matchPointsFor'), teamPoints: sum('teamPoints') };
}

function RecordTable({ rows, cols, total }: { rows: FormatRow[]; cols: Col[]; total?: boolean }) {
  const all = total && rows.length > 1 ? [...rows, totalOf(rows)] : rows;
  return (
    <View>
      <View style={tableStyles.headRow}>
        <Cell head flex>Format</Cell>
        {cols.map((c) => (
          <Cell key={c.key} head right w={c.w}>
            {c.label}
          </Cell>
        ))}
      </View>
      {all.map((f, i) => {
        const isTotal = total && rows.length > 1 && i === all.length - 1;
        return (
          <View key={f.format + i} style={[tableStyles.row, i === all.length - 1 && { borderBottomWidth: 0 }, isTotal && s.totalRow]}>
            <View style={{ flexGrow: 1, paddingHorizontal: 6 }}>
              <Text style={body(14, C.ink, isTotal ? 'bold' : 'semi')} numberOfLines={1}>
                {titleCase(f.format)}
              </Text>
            </View>
            {cols.map((c) => (
              <View key={c.key} style={{ width: c.w, alignItems: 'flex-end', paddingHorizontal: 6 }}>
                <Text style={[body(14, isTotal ? C.ink : C.soft, isTotal ? 'bold' : 'text'), { fontVariant: ['tabular-nums'] }]}>{c.get(f)}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export default function MyRecordScreen() {
  const nav = useNavigation<any>();
  const user = useAuthStore((st) => st.user);
  const { state, reload } = useLoad<Career>(`career-${user?.id}`, () => getPlayerCareer(user!.id, 'private'));
  const career = state.status === 'ready' ? state.data : null;

  const sports = useMemo(() => {
    const played = (career?.sports ?? []).filter((sp) => (sp.headline?.played ?? 0) > 0 || sp.leagues?.length).sort((a, b) => (b.headline?.played ?? 0) - (a.headline?.played ?? 0)).map((sp) => sp.sport);
    return [...played, ...BASE_SPORTS.filter((k) => !played.includes(k))];
  }, [career]);

  const [sport, setSport] = useState<string>('pickleball');
  useEffect(() => {
    if (career) setSport(sports[0]);
  }, [career, sports]);

  const block = career?.sports.find((sp) => sp.sport === sport) ?? null;
  const cols = colsFor(block?.metrics);
  const total = block ? totalOf(block.formats ?? []) : null;
  const name = user?.displayName || user?.fullName || career?.player.fullName || 'Yoiden player';

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader title="My record" back />
      <Page onRefresh={reload}>
        {state.status === 'loading' && !career ? (
          <View style={[card, { padding: 24, marginTop: 16 }]}>
            <ActivityIndicator color={C.accent} />
          </View>
        ) : state.status === 'error' ? (
          <View style={{ marginTop: 16 }}>
            <Empty>Could not load your record. Pull down to try again.</Empty>
          </View>
        ) : (
          <>
            {/* Sport picker */}
            <View style={{ marginTop: 16, marginHorizontal: -16 }}>
              <SegTabs tabs={sports.map((k) => ({ key: k, label: titleCase(k) }))} value={sport} onChange={setSport} />
            </View>

            {/* Headline for the picked sport */}
            <View style={s.banner}>
              <View pointerEvents="none" style={s.stripeBand}><Stripes height={64} wide /></View>
              <Text style={label(12, 'rgba(255,255,255,0.7)')}>{titleCase(sport)}</Text>
              <Text style={[head(24, C.white), { paddingRight: 80 }]} numberOfLines={1}>
                {name}
              </Text>
              <View style={s.stats}>
                {(
                  [
                    ['Played', total ? String(total.played) : '0'],
                    ['Won', total ? String(total.won) : '0'],
                    ['Lost', total ? String(total.lost) : '0'],
                    ['Win rate', total && total.played ? `${total.winPct}%` : '—'],
                  ] as [string, string][]
                ).map(([k, v], i) => (
                  <View key={k} style={[s.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.barSoft }]}>
                    <Text style={head(24, C.hl)}>{v}</Text>
                    <Text style={label(11, 'rgba(255,255,255,0.7)')}>{k}</Text>
                  </View>
                ))}
              </View>
            </View>

            {!block || !(block.formats?.length || block.leagues?.length) ? (
              <View style={{ marginTop: 16 }}>
                <Empty>{`No ${titleCase(sport).toLowerCase()} matches yet. Play in an event run on Yoiden and your record shows up here.`}</Empty>
              </View>
            ) : (
              <>
                <SectionLabel>By format</SectionLabel>
                <Panel>
                  <RecordTable rows={block.formats ?? []} cols={cols} total />
                </Panel>
                {cols.some((c) => c.key === 'matchPoints' || c.key === 'teamPoints') ? (
                  <Text style={[body(12, C.mute), { marginTop: 8 }]}>
                    {[cols.some((c) => c.key === 'matchPoints') && 'Pts: points you won in your games', cols.some((c) => c.key === 'teamPoints') && 'Team: points you earned for your team'].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}

                {block.leagues?.length ? (
                  <>
                    <SectionLabel>By league</SectionLabel>
                    <View style={{ gap: 12 }}>
                      {block.leagues.map((l) => {
                        const ev = eventForLeague(l.leagueName, l.seasonName);
                        return (
                          <View key={l.seasonId} style={[card, { overflow: 'hidden' }]}>
                            <Pressable
                              disabled={!ev}
                              onPress={() => ev && nav.navigate('Event', { id: ev.id })}
                              style={({ pressed }) => [s.leagueHead, pressed && ev && { backgroundColor: C.page }]}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={body(14.5, C.ink, 'semi')} numberOfLines={1}>
                                  {l.leagueName}
                                  {l.seasonName ? ` · ${l.seasonName}` : ''}
                                </Text>
                                {l.team || l.auctionPrice != null ? (
                                  <Text style={[body(12.5, C.soft), { marginTop: 1 }]} numberOfLines={1}>
                                    {[l.team, l.auctionPrice != null ? `Bought for ₹${l.auctionPrice.toLocaleString('en-IN')}` : null].filter(Boolean).join(' · ')}
                                  </Text>
                                ) : null}
                              </View>
                              {ev ? <ChevronRight size={16} color={C.mute} /> : null}
                            </Pressable>
                            {l.byFormat?.length ? <RecordTable rows={l.byFormat} cols={cols} /> : <Text style={[body(13, C.soft), { padding: 14 }]}>No matches played yet.</Text>}
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : null}
              </>
            )}
          </>
        )}
      </Page>
    </View>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: C.bar, borderRadius: 10, marginTop: 12, padding: 16, overflow: 'hidden' },
  stripeBand: { position: 'absolute', top: 0, left: 0, right: 0, height: 64 },
  stats: { flexDirection: 'row', marginTop: 14, borderTopWidth: 1, borderTopColor: C.barSoft, paddingTop: 12 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  totalRow: { backgroundColor: '#F7F8FA', borderTopWidth: 1, borderTopColor: C.lineStrong },
  leagueHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
});
