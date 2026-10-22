// A player auction (same as yoiden.com/events/<id> for auctions): banner with
// Players sold / Total spent / Top bid, a division switch, tabs Teams / Top
// buys / All players / About, then streams, Top buy, Team spend and By
// category stacked below. Players show as initials, with no player pages.
// The website's live socket panel is not ported: on auction day a panel
// opens the event's own auction site instead.
// Ported from the website's components/auction/auction-view.tsx.
import React, { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Page } from '../../components/chrome';
import { EventBanner } from '../../components/event-banner';
import { StreamVideos } from '../../components/stream-videos';
import { Button, Chip, DetailRows, Empty, Panel, SegTabs } from '../../components/ui';
import { GavelIcon, SearchIcon, TrophyIcon } from '../../components/icons';
import { C, MAX_W, body, card, head, label } from '../../theme';
import { useLoad, useNow } from '../../hooks';
import { formatWhen, statusOf, type YoidenEvent } from '../../data/events';
import {
  catLabel,
  fetchAuction,
  formatMoney,
  soldPlayers,
  teamSummary,
  type AuctionFeed,
  type AuctionPlayer,
} from '../../data/auction-feed';
import { DivisionSwitch } from './football-parts';
import { Avatar, Price, TeamMark } from './auction-parts';

const TABS = [
  { key: 'teams', label: 'Teams' },
  { key: 'top', label: 'Top buys' },
  { key: 'players', label: 'All players' },
  { key: 'about', label: 'About' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default function AuctionEvent({ event }: { event: YoidenEvent }) {
  const divisions = event.auctions ?? [];
  const tokens = divisions.map((d) => d.token);
  const { state, reload } = useLoad<AuctionFeed[]>(`auction:${tokens.join(',')}`, () =>
    Promise.all(tokens.map((t) => fetchAuction(t))),
  );
  const [div, setDiv] = useState(0);
  const [tab, setTab] = useState<Tab>('teams');
  const now = useNow();
  const live = statusOf(event, now) === 'live';

  const feeds = state.status === 'ready' ? state.data : [];
  const feed = feeds[div] ?? null;
  const totals = useMemo(() => {
    const sold = feeds.flatMap(soldPlayers);
    return {
      teams: feeds.reduce((n, f) => n + f.teams.length, 0),
      sold: sold.length,
      spent: sold.reduce((n, p) => n + (p.soldPrice ?? 0), 0),
      top: sold.reduce((m, p) => Math.max(m, p.soldPrice ?? 0), 0),
    };
  }, [feeds]);

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader back title={event.name} />
      <Page padded={false} onRefresh={reload} refreshing={false}>
        <EventBanner
          event={event}
          line={[event.city, formatWhen(event), totals.teams ? `${totals.teams} teams` : null].filter(Boolean).join(' · ')}
          stats={
            state.status === 'ready'
              ? [
                  ['Players sold', String(totals.sold)],
                  ['Total spent', formatMoney(totals.spent)],
                  ['Top bid', formatMoney(totals.top)],
                ]
              : undefined
          }
        >
          <DivisionSwitch labels={divisions.map((d) => d.label)} value={div} onChange={setDiv} />
        </EventBanner>

        <View style={s.col}>
          {live && event.url ? (
            <View style={[card, s.livePanel]}>
              <View style={s.liveHead}>
                <View style={s.dot} />
                <Text style={head(20, C.white)}>Auction is live</Text>
              </View>
              <Text style={[body(13.5, 'rgba(255,255,255,0.8)'), { marginTop: 6 }]}>
                Follow every bid as it happens on the auction board.
              </Text>
              <View style={{ marginTop: 14, alignSelf: 'flex-start' }}>
                <Button title="Watch the auction" onPress={() => Linking.openURL(event.url!)} tone="lime" />
              </View>
            </View>
          ) : null}
          <SegTabs tabs={TABS} value={tab} onChange={setTab} />
          <View style={{ marginTop: 16 }}>
            {state.status === 'loading' && <View style={s.skeleton} />}
            {state.status === 'error' && <Empty>Couldn't load this auction right now. Please refresh in a moment.</Empty>}
            {feed && tab === 'teams' && <TeamsTab feed={feed} />}
            {feed && tab === 'top' && <TopBuysTab feed={feed} />}
            {feed && tab === 'players' && <PlayersTab key={div} feed={feed} />}
            {feed && tab === 'about' && <AboutTab feed={feed} event={event} />}
          </View>

          <View style={s.side}>
            <StreamVideos videos={event.videos ?? []} live={live} />
            {feed && <TopBuyCard feed={feed} />}
            {feed && <BigSpender feed={feed} />}
            {feed && <CategoryAverages feed={feed} />}
          </View>
        </View>
      </Page>
    </View>
  );
}

// ── Teams ──────────────────────────────────────────────────────────────

function TeamsTab({ feed }: { feed: AuctionFeed }) {
  const rows = teamSummary(feed);
  return (
    <View style={{ gap: 12 }}>
      {rows.map(({ team, squad, spent, left }) => (
        <View key={team.id} style={[card, { overflow: 'hidden' }]}>
          <View style={{ height: 6, backgroundColor: team.color ?? C.bar }} />
          <View style={s.teamHead}>
            <TeamMark team={team} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={label(18, C.ink)} numberOfLines={1}>
                {team.name}
              </Text>
              {team.ownerName ? (
                <Text style={body(12, C.mute)} numberOfLines={1}>
                  Owner: {team.ownerName}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={s.teamStats}>
            {[
              ['Players', String(squad.length)],
              ['Spent', formatMoney(spent)],
              ['Left', formatMoney(Math.max(left, 0))],
            ].map(([k, v]) => (
              <View key={k} style={s.teamStat}>
                <Text style={head(18, C.ink)}>{v}</Text>
                <Text style={label(11, C.mute)}>{k}</Text>
              </View>
            ))}
          </View>
          {squad.map((p, i) => (
            <View key={p.id} style={[s.squadRow, i === 0 && { borderTopWidth: 0 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={body(11.5, C.mute)} numberOfLines={1}>
                  {catLabel(feed, p.cat)}
                </Text>
              </View>
              <Price value={p.soldPrice} top={i === 0} />
            </View>
          ))}
          {!squad.length && <Text style={[body(13, C.mute), { paddingHorizontal: 14, paddingVertical: 12 }]}>No players bought.</Text>}
        </View>
      ))}
    </View>
  );
}

// ── Top buys ───────────────────────────────────────────────────────────

function TopBuysTab({ feed }: { feed: AuctionFeed }) {
  const top = [...soldPlayers(feed)].sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0)).slice(0, 25);
  const teamOf = (p: AuctionPlayer) => feed.teams.find((t) => t.id === p.soldTo);
  return (
    <Panel title="Top buys">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: '100%' }}>
          <View style={[s.tr, { paddingVertical: 9 }]}>
            <Text style={[label(13, C.mute), s.cRank]}>#</Text>
            <Text style={[label(13, C.mute), s.cPlayer]}>Player</Text>
            <Text style={[label(13, C.mute), s.cTeam]}>Team</Text>
            <Text style={[label(13, C.mute), s.cBase]}>Base</Text>
            <Text style={[label(13, C.ink), s.cSold]}>Sold for</Text>
          </View>
          {top.map((p, i) => {
            const t = teamOf(p);
            return (
              <View key={p.id} style={[s.tr, i === top.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.cRank}>
                  <View style={[s.rank, i < 3 && { backgroundColor: C.bar }]}>
                    <Text style={head(16, i < 3 ? C.hl : C.mute)}>{i + 1}</Text>
                  </View>
                </View>
                <View style={[s.cPlayer, s.rowCell]}>
                  <Avatar name={p.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={body(12, C.mute)} numberOfLines={1}>
                      {catLabel(feed, p.cat)}
                    </Text>
                  </View>
                </View>
                <View style={[s.cTeam, s.rowCell]}>
                  {t ? (
                    <>
                      <TeamMark team={t} size={22} />
                      <Text style={[body(14, C.soft), { flex: 1 }]} numberOfLines={1}>
                        {t.name}
                      </Text>
                    </>
                  ) : null}
                </View>
                <Text style={[body(14, C.mute), s.cBase]}>{formatMoney(p.base)}</Text>
                <View style={[s.cSold, { alignItems: 'flex-end' }]}>
                  <Price value={p.soldPrice} top={i === 0} />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Panel>
  );
}

// ── All players ────────────────────────────────────────────────────────

function PlayersTab({ feed }: { feed: AuctionFeed }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const cats = feed.categories.filter((c) => feed.players.some((p) => p.cat === c.slug));
  const teamOf = (p: AuctionPlayer) => feed.teams.find((t) => t.id === p.soldTo);
  const list = feed.players
    .filter((p) => cat === 'all' || p.cat === cat)
    .filter((p) => !q || `${p.name} ${teamOf(p)?.name ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.soldPrice ?? -1) - (a.soldPrice ?? -1) || a.name.localeCompare(b.name));

  return (
    <View>
      {cats.length > 1 && (
        <View style={s.chips}>
          <Chip on={cat === 'all'} onPress={() => setCat('all')}>
            {`All (${feed.players.length})`}
          </Chip>
          {cats.map((c) => (
            <Chip key={c.slug} on={cat === c.slug} onPress={() => setCat(c.slug)}>
              {c.label}
            </Chip>
          ))}
        </View>
      )}
      <Panel title={`Players (${list.length})`}>
        <View style={s.searchWrap}>
          <View style={s.search}>
            <SearchIcon size={14} color={C.mute} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Find a player or team"
              placeholderTextColor={C.mute}
              style={s.searchInput}
            />
          </View>
        </View>
        {list.map((p, i) => {
          const t = teamOf(p);
          return (
            <View key={p.id} style={[s.li, i === 0 && { borderTopWidth: 0 }]}>
              <Avatar name={p.name} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={body(12, C.mute)} numberOfLines={1}>
                  {catLabel(feed, p.cat)} · base {formatMoney(p.base)}
                </Text>
              </View>
              {t ? (
                <View style={s.playerTeam}>
                  <TeamMark team={t} size={20} />
                  <Text style={[body(13, C.soft), { flexShrink: 1 }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                </View>
              ) : (
                <Text style={label(12, C.mute)}>Unsold</Text>
              )}
              {p.soldPrice ? (
                <View style={{ minWidth: 70, alignItems: 'flex-end' }}>
                  <Price value={p.soldPrice} />
                </View>
              ) : null}
            </View>
          );
        })}
      </Panel>
    </View>
  );
}

// ── About ──────────────────────────────────────────────────────────────

function AboutTab({ feed, event }: { feed: AuctionFeed; event: YoidenEvent }) {
  return (
    <Panel title="About this auction">
      <DetailRows
        rows={[
          ['Auction', feed.name],
          ['Sport', event.sport],
          ['Date', formatWhen(event)],
          ['Teams', String(feed.teams.length)],
          ['Purse per team', formatMoney(feed.purse)],
          ...(feed.squadSize ? ([['Squad size', `${feed.squadSize} players`]] as [string, string][]) : []),
          ['Categories', feed.categories.map((c) => c.label).join(', ') || '–'],
          ['Run on', 'Yoiden Auction: live board, team-owner phones and OBS layers'],
        ]}
      />
    </Panel>
  );
}

// ── Side panels ────────────────────────────────────────────────────────

function TopBuyCard({ feed }: { feed: AuctionFeed }) {
  const top = [...soldPlayers(feed)].sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))[0];
  if (!top) return null;
  const team = feed.teams.find((t) => t.id === top.soldTo);
  return (
    <Panel title="Top buy">
      <View style={{ padding: 14 }}>
        <View style={s.topBuy}>
          <View style={s.topBuyStripe} />
          <TrophyIcon size={24} color={C.hl} strokeWidth={2.25} />
          <View style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
            <Text style={head(22, C.white)} numberOfLines={1}>
              {top.name}
            </Text>
            <Text style={body(12, 'rgba(255,255,255,0.7)')} numberOfLines={1}>
              {catLabel(feed, top.cat)}
              {team ? ` · ${team.name}` : ''}
            </Text>
          </View>
        </View>
        <View style={s.soldFor}>
          <Text style={label(12, C.mute)}>Sold for</Text>
          <Text style={head(30, C.bar)}>{formatMoney(top.soldPrice)}</Text>
        </View>
      </View>
    </Panel>
  );
}

function BigSpender({ feed }: { feed: AuctionFeed }) {
  const rows = teamSummary(feed).sort((a, b) => b.spent - a.spent);
  if (!rows.length || !rows[0].spent) return null;
  const max = rows[0].spent;
  return (
    <Panel title="Team spend">
      {rows.slice(0, 6).map((r, i) => (
        <View key={r.team.id} style={[s.spend, i === 0 && { borderTopWidth: 0 }]}>
          <View style={s.rowCell}>
            <TeamMark team={r.team} size={22} />
            <Text style={[body(14, C.ink, 'semi'), { flex: 1 }]} numberOfLines={1}>
              {r.team.name}
            </Text>
            <Text style={head(16, C.ink)}>{formatMoney(r.spent)}</Text>
          </View>
          <View style={s.barTrack}>
            <View
              style={[
                s.barFill,
                { width: `${Math.max(4, (r.spent / max) * 100)}%`, backgroundColor: i === 0 ? C.bar : 'rgba(41,82,227,0.6)' },
              ]}
            />
          </View>
        </View>
      ))}
    </Panel>
  );
}

function CategoryAverages({ feed }: { feed: AuctionFeed }) {
  const sold = soldPlayers(feed);
  const rows = feed.categories
    .map((c) => {
      const list = sold.filter((p) => p.cat === c.slug);
      const avg = list.length ? list.reduce((n, p) => n + (p.soldPrice ?? 0), 0) / list.length : 0;
      return { c, n: list.length, avg };
    })
    .filter((r) => r.n > 0);
  if (rows.length < 2) return null;
  return (
    <Panel title="By category">
      {rows.map((r, i) => (
        <View key={r.c.slug} style={[s.li, { justifyContent: 'space-between' }, i === 0 && { borderTopWidth: 0 }]}>
          <View style={[s.rowCell, { flex: 1 }]}>
            <GavelIcon size={14} color={C.mute} />
            <Text style={body(14, C.ink, 'semi')} numberOfLines={1}>
              {r.c.label}
            </Text>
            <Text style={body(12, C.mute)}>{r.n} sold</Text>
          </View>
          <Text style={body(14, C.soft)}>avg {formatMoney(Math.round(r.avg))}</Text>
        </View>
      ))}
    </Panel>
  );
}

const s = StyleSheet.create({
  col: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18 },
  side: { gap: 16, marginTop: 16 },
  skeleton: { height: 360, borderRadius: 10, backgroundColor: C.white },
  livePanel: { backgroundColor: C.bar, borderColor: C.bar, padding: 16, marginBottom: 16 },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.live },
  teamHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  teamStats: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line },
  teamStat: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  squadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 10 },
  cRank: { width: 52, paddingLeft: 14 },
  cPlayer: { width: 200, paddingRight: 8 },
  cTeam: { width: 160, paddingRight: 8 },
  cBase: { width: 80, textAlign: 'right' },
  cSold: { width: 110, paddingRight: 14 },
  rowCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { width: 28, height: 28, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  searchWrap: { padding: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 7,
    paddingHorizontal: 10,
    backgroundColor: C.white,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink, paddingVertical: 8 },
  li: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  playerTeam: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 110 },
  topBuy: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bar, borderRadius: 7, padding: 12, overflow: 'hidden' },
  topBuyStripe: { position: 'absolute', top: -10, bottom: -10, right: -12, width: 32, backgroundColor: C.hl, transform: [{ skewX: '-20deg' }] },
  soldFor: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 },
  spend: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line },
  barTrack: { marginTop: 6, height: 6, borderRadius: 3, backgroundColor: C.page, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});
