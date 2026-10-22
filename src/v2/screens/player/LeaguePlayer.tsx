// A player within one league event (same as
// yoiden.com/events/<id>/player/<slug>): navy header with initials, team and
// a stats strip counted from their games, the match list with W / L, partner
// and opponents, and their team's squad.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, MAX_W, body, head, isLight, label } from '../../theme';
import { AppHeader, Page } from '../../components/chrome';
import { Panel, Stripes, TeamBadge } from '../../components/ui';
import { ChevronLeft } from '../../components/icons';
import type { YoidenEvent } from '../../data/events';
import { categoryLabel, roundLabel, type FeedPlayer, type LeagueFeed } from '../../data/league-feed';
import { findPlayer, gameStats, playerGames, rankPlayers, type PlayerGame } from '../../data/players';
import { LoadError, Loading, signed, useLeagueFeeds, useOpen } from '../event/league-parts';

type Open = ReturnType<typeof useOpen>;

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export default function LeaguePlayer({ event, slug }: { event: YoidenEvent; slug: string }) {
  const nav = useNavigation<any>();
  const { state, refresh, refreshing } = useLeagueFeeds(event);
  const open = useOpen(event.id, true);
  const hit = state.status === 'ready' ? findPlayer(state.feeds, slug) : null;
  const backToEvent = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Event', { id: event.id }));

  let content: React.ReactNode;
  if (state.status === 'loading') {
    content = (
      <View style={s.col}>
        <Loading count={3} height={120} />
      </View>
    );
  } else if (state.status === 'error') {
    content = (
      <View style={s.col}>
        <LoadError />
      </View>
    );
  } else if (!hit) {
    content = (
      <View style={[s.col, { paddingVertical: 48 }]}>
        <Text style={body(15, C.soft)}>
          This player couldn't be found.{' '}
          <Text style={[body(15, C.ink, 'semi'), { textDecorationLine: 'underline' }]} onPress={backToEvent}>
            Back to {event.name}
          </Text>
        </Text>
      </View>
    );
  } else {
    content = (
      <PlayerBody event={event} feeds={(state as { feeds: LeagueFeed[] }).feeds} feed={hit.feed} p={hit.player} open={open} onBack={backToEvent} />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader back title={hit?.player.name ?? event.name} />
      <Page padded={false} onRefresh={refresh} refreshing={refreshing}>
        {content}
      </Page>
    </View>
  );
}

function PlayerBody({
  event,
  feeds,
  feed,
  p,
  open,
  onBack,
}: {
  event: YoidenEvent;
  feeds: LeagueFeed[];
  feed: LeagueFeed;
  p: FeedPlayer;
  open: Open;
  onBack: () => void;
}) {
  const games = playerGames(feed, p);
  const ranked = rankPlayers(feed.players.filter((x) => x.played > 0));
  const rank = ranked.findIndex((x) => x.name === p.name && x.team.id === p.team.id) + 1;
  const teammates = feed.players
    .filter((x) => x.team.id === p.team.id && x.name !== p.name)
    .sort((a, b) => b.won - a.won || a.name.localeCompare(b.name));
  const division = feeds.length > 1 ? event.leagues?.find((l) => l.slug === feed.league.slug)?.label : null;
  const color = p.team.color ?? '#2952E3';
  // Counted from the games listed below, so the numbers always match the list.
  const st = gameStats(games);

  const stats: [string, string | number][] = [
    ['Played', st.played],
    ['Won', st.won],
    ['Lost', st.lost],
    ['Win %', `${st.winPct}%`],
    ['Points +/-', signed(st.diff)],
    ['Event rank', rank ? `#${rank} of ${ranked.length}` : '–'],
  ];

  return (
    <View>
      <View style={s.hero}>
        <Stripes height={260} wide />
        <View style={s.heroInner}>
          <Pressable onPress={onBack} style={s.backLink} hitSlop={6}>
            <ChevronLeft size={16} color="rgba(255,255,255,0.7)" />
            <Text style={label(13, 'rgba(255,255,255,0.7)')} numberOfLines={1}>
              {event.name}
              {division ? ` · ${division}` : ''}
            </Text>
          </Pressable>
          <View style={s.who}>
            <View style={[s.avatar, { backgroundColor: color }]}>
              <Text style={head(26, isLight(color) ? C.ink : C.white)}>{initialsOf(p.name)}</Text>
            </View>
            <View style={{ flex: 1, paddingRight: 40 }}>
              <Text style={head(34, C.white)}>{p.name}</Text>
              <View style={s.teamLine}>
                <TeamBadge team={p.team} size={20} />
                <Text style={[body(15, 'rgba(255,255,255,0.8)'), { flexShrink: 1 }]} numberOfLines={1}>
                  {p.team.name}
                </Text>
              </View>
            </View>
          </View>
          <View style={s.stats}>
            {stats.map(([k, v]) => (
              <View key={k} style={s.stat}>
                <Text style={label(11, 'rgba(255,255,255,0.6)')}>{k}</Text>
                <Text style={[head(String(v).length > 6 ? 18 : 24, C.white), { marginTop: 4 }]} numberOfLines={1}>
                  {v}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={[s.col, { gap: 16 }]}>
        <Panel title={`Matches (${games.length})`}>
          {games.length ? (
            games.map((g, i) => <GameItem key={`${g.tie.id}-${g.game.slot}`} g={g} open={open} first={i === 0} />)
          ) : (
            <Text style={[body(14, C.soft), { paddingHorizontal: 14, paddingVertical: 22 }]}>No games played yet.</Text>
          )}
        </Panel>

        {teammates.length > 0 && (
          <Panel title={`${p.team.shortName || p.team.name} squad`}>
            {teammates.map((x, i) => (
              <Pressable key={x.name} onPress={() => open.player(x)} style={[s.mate, i > 0 && s.divider]}>
                <Text style={[body(14, C.ink, 'semi'), { flexShrink: 1 }]} numberOfLines={1}>
                  {x.name}
                </Text>
                <Text style={body(12, C.mute)}>
                  {x.won}-{x.lost}
                </Text>
              </Pressable>
            ))}
          </Panel>
        )}
      </View>
    </View>
  );
}

function GameItem({ g, open, first }: { g: PlayerGame; open: Open; first: boolean }) {
  const { tie, game, result } = g;
  const sets = game.sets.map((x) => (g.side === 'home' ? `${x.a}-${x.b}` : `${x.b}-${x.a}`)).join(', ');
  const box =
    result === 'won' ? { bg: C.bar, fg: C.hl } : result === 'lost' ? { bg: C.page, fg: C.mute } : { bg: C.page, fg: C.soft };
  const who = `${g.partners.length ? `with ${g.partners.join(' & ')} · ` : ''}${g.opponents.length ? `vs ${g.opponents.join(' & ')}` : ''}`;
  return (
    <Pressable onPress={() => open.match(tie.id)} style={[s.game, !first && s.divider]}>
      <View style={[s.result, { backgroundColor: box.bg }]}>
        <Text style={head(16, box.fg)}>{result === 'won' ? 'W' : result === 'lost' ? 'L' : '–'}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.gameTop}>
          <Text style={body(14, C.ink, 'semi')}>vs {g.opponent.name}</Text>
          <Text style={body(12, C.mute)}>
            {roundLabel(tie.round)} · {categoryLabel(game.category)}
          </Text>
        </View>
        {who ? (
          <Text style={body(13, C.soft)} numberOfLines={1}>
            {who}
          </Text>
        ) : null}
      </View>
      <Text style={head(17, C.ink)}>{sets || (game.status === 'scheduled' ? 'Upcoming' : '')}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  col: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16 },
  hero: { backgroundColor: C.bar, overflow: 'hidden' },
  heroInner: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
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
    marginTop: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.barSoft,
    backgroundColor: C.barSoft,
    overflow: 'hidden',
    gap: 1,
  },
  stat: { flexBasis: '32%', flexGrow: 1, backgroundColor: C.bar, paddingHorizontal: 12, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: C.line },
  mate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  game: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  result: { width: 36, height: 36, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  gameTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 },
});
