// One tie in a league event (same as yoiden.com/events/<id>/match/<tie>):
// score header, now-playing panel, points breakup for bonus / powerplay
// leagues, the game-by-game scorecard, more ties from the round, the court
// stream and match details.
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, MAX_W, body, card, head, isLight, label } from '../../theme';
import { AppHeader, Page } from '../../components/chrome';
import { DetailRows, Panel, ScoreBox, TeamBadge } from '../../components/ui';
import { ChevronLeft, ExternalIcon } from '../../components/icons';
import type { YoidenEvent } from '../../data/events';
import {
  categoryLabel,
  formatDay,
  formatTime,
  gameWinner,
  liveGame,
  roundLabel,
  scoreModeOf,
  tieBreakup,
  tieScore,
  type FeedGame,
  type FeedTeam,
  type FeedTie,
  type LeagueFeed,
} from '../../data/league-feed';
import { isRealName } from '../../data/players';
import { Loading, TieCard, TieStatus, WinnerTag, tieSummary, useLeagueFeeds, useOpen } from '../event/league-parts';

type Open = ReturnType<typeof useOpen>;

export default function LeagueMatch({ event, matchId }: { event: YoidenEvent; matchId: string }) {
  const nav = useNavigation<any>();
  const { state, refresh, refreshing } = useLeagueFeeds(event);
  const open = useOpen(event.id, true);
  const feed = state.status === 'ready' ? state.feeds.find((f) => f.ties.some((x) => x.id === matchId)) : undefined;
  const tie = feed?.ties.find((x) => x.id === matchId);
  const backToEvent = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Event', { id: event.id }));

  let content: React.ReactNode;
  if (state.status === 'loading') {
    content = (
      <View style={{ paddingTop: 16 }}>
        <Loading count={3} height={180} />
      </View>
    );
  } else if (!feed || !tie) {
    content = (
      <View style={{ paddingVertical: 48 }}>
        <Text style={body(15, C.soft)}>
          This match couldn't be found.{' '}
          <Text style={[body(15, C.ink, 'semi'), { textDecorationLine: 'underline' }]} onPress={backToEvent}>
            Back to {event.name}
          </Text>
        </Text>
      </View>
    );
  } else {
    content = <TieBody event={event} feed={feed} tie={tie} open={open} onBack={backToEvent} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader back title={tie ? `${tie.home.name} v ${tie.away.name}` : event.name} />
      <Page padded={false} onRefresh={refresh} refreshing={refreshing}>
        <View style={s.col}>{content}</View>
      </Page>
    </View>
  );
}

function TieBody({ event, feed, tie, open, onBack }: { event: YoidenEvent; feed: LeagueFeed; tie: FeedTie; open: Open; onBack: () => void }) {
  const [hs, as] = tieScore(feed, tie);
  const playing = liveGame(tie);
  const stream = tie.court ? feed.streamLinks?.[String(tie.court)] : undefined;
  const sameRound = feed.ties.filter((x) => x.round === tie.round && x.id !== tie.id);

  const scoreRow = (team: FeedTeam, score: number) => {
    const lost = tie.status === 'completed' && !!tie.winnerId && tie.winnerId !== team.id;
    const won = tie.status === 'completed' && tie.winnerId === team.id;
    return (
      <View style={s.scoreRow}>
        <TeamBadge team={team} size={36} />
        <Text style={[head(26, lost ? C.soft : C.ink), { flexShrink: 1 }]} numberOfLines={2}>
          {team.name}
        </Text>
        {won && <WinnerTag text="Winner" />}
        <View style={{ flex: 1 }} />
        {tie.status !== 'scheduled' && <ScoreBox score={score} won={won} lost={lost} big />}
      </View>
    );
  };

  return (
    <View style={{ gap: 16, paddingTop: 16 }}>
      {/* ── Score header ── */}
      <Panel>
        <View style={{ padding: 16 }}>
          <Pressable onPress={onBack} style={s.backLink} hitSlop={6}>
            <ChevronLeft size={16} color={C.ink} />
            <Text style={body(13, C.ink, 'semi')} numberOfLines={1}>
              {event.name}
            </Text>
          </Pressable>
          <Text style={[body(15, C.ink, 'semi'), { marginTop: 8 }]}>
            {roundLabel(tie.round)}: {tie.home.name} vs {tie.away.name}
          </Text>
          <Text style={[body(13, C.soft), { marginTop: 2 }]}>
            {[tie.court ? `Court ${tie.court}` : null, formatDay(tie.scheduledStart ?? tie.matchDay), formatTime(tie.scheduledStart)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <View style={s.statusRow}>
            <TieStatus tie={tie} />
            <Text style={body(12, C.mute)}>
              {tie.gamesDecided}/{tie.gamesTotal} games
              {{ tiePoints: ' · score in tie points', points: ' · score in total points', games: '' }[scoreModeOf(feed)]}
            </Text>
          </View>
          <View style={{ marginTop: 12, gap: 12 }}>
            {scoreRow(tie.home, hs)}
            {scoreRow(tie.away, as)}
          </View>
          <Text style={[s.summary, body(14, tie.status === 'in_progress' ? C.live : C.ink, 'semi')]}>{tieSummary(feed, tie)}</Text>
        </View>
      </Panel>

      {/* ── Now playing ── */}
      {playing && <NowPlaying game={playing} tie={tie} />}

      {/* ── Points breakup (leagues with bonus / powerplay) ── */}
      {feed.tiePoints && tie.status !== 'scheduled' && <Breakup feed={feed} tie={tie} />}

      {/* ── Scorecard ── */}
      <Panel title="Scorecard" right={<Text style={label(12, 'rgba(255,255,255,0.7)')}>{tie.gamesTotal} games</Text>}>
        {tie.games.map((g, i) => (
          <GameRow key={g.slot} g={g} tie={tie} showPoints={feed.tiePoints} open={open} first={i === 0} />
        ))}
      </Panel>

      {sameRound.length > 0 && (
        <View>
          <Text style={[label(15, C.bar), { marginBottom: 10 }]}>More from {roundLabel(tie.round)}</Text>
          <View style={{ gap: 12 }}>
            {sameRound.slice(0, 4).map((x) => (
              <TieCard key={x.id} feed={feed} tie={x} onPress={() => open.match(x.id)} />
            ))}
          </View>
        </View>
      )}

      {stream && (
        <Pressable onPress={() => Linking.openURL(stream)} style={s.stream}>
          <Text style={body(14, C.white, 'bold')}>Watch Court {tie.court} live</Text>
          <ExternalIcon size={16} color={C.white} />
        </Pressable>
      )}
      <Panel title="Match details">
        <DetailRows
          rows={[
            ['Event', event.name],
            ['Round', roundLabel(tie.round)],
            ['Court', tie.court ? `Court ${tie.court}` : '–'],
            ['Date', formatDay(tie.scheduledStart ?? tie.matchDay) || '–'],
            ['Games', `${tie.gamesTotal} games${feed.season.pointsTo ? `, first to ${feed.season.pointsTo}` : ''}`],
          ]}
        />
      </Panel>
    </View>
  );
}

function NowPlaying({ game, tie }: { game: FeedGame; tie: FeedTie }) {
  return (
    <Panel
      title={`Now playing · Game ${game.slot}`}
      right={<Text style={label(12, 'rgba(255,255,255,0.7)')}>{categoryLabel(game.category)}</Text>}
    >
      <View style={s.nowRow}>
        <View style={{ flex: 1 }}>
          <Text style={body(12, C.mute, 'semi')} numberOfLines={1}>
            {tie.home.name}
          </Text>
          <Text style={[body(15, C.ink, 'semi'), { marginTop: 4 }]}>{game.homePair.join(' / ') || '–'}</Text>
        </View>
        <View style={s.nowScore}>
          <Text style={[head(40, C.ink), { fontVariant: ['tabular-nums'] }]}>
            {game.homeScore ?? 0}
            <Text style={{ color: C.mute }}> – </Text>
            {game.awayScore ?? 0}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={body(12, C.mute, 'semi')} numberOfLines={1}>
            {tie.away.name}
          </Text>
          <Text style={[body(15, C.ink, 'semi'), { marginTop: 4, textAlign: 'right' }]}>{game.awayPair.join(' / ') || '–'}</Text>
        </View>
      </View>
    </Panel>
  );
}

function Breakup({ feed, tie }: { feed: LeagueFeed; tie: FeedTie }) {
  const rows = tieBreakup(feed, tie);
  const fmt = (n: number, sgn?: boolean) => (sgn && n > 0 ? `+${n}` : String(n));
  return (
    <Panel title="Points breakup">
      <View style={s.bkHead}>
        <Text style={[body(12, C.mute, 'semi'), { flex: 1 }]} numberOfLines={1}>
          {tie.home.name}
        </Text>
        <Text style={[body(12, C.mute, 'semi'), { flex: 1, textAlign: 'right' }]} numberOfLines={1}>
          {tie.away.name}
        </Text>
      </View>
      {rows.map((r, i) => {
        const val = r.total ? body(17, C.ink, 'heavy') : r.muted ? body(14, C.mute) : body(14, C.ink, 'semi');
        return (
          <View key={r.label} style={[s.bkRow, r.total && { backgroundColor: C.page }, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={[val, s.bkVal]}>{fmt(r.home, r.signed)}</Text>
            <Text style={s.bkLabel}>{r.label}</Text>
            <Text style={[val, s.bkVal, { textAlign: 'right' }]}>{fmt(r.away, r.signed)}</Text>
          </View>
        );
      })}
      {feed.powerplayPoints > 0 && (
        <Text style={[body(12.5, C.soft), s.bkNote]}>
          Powerplay: a team doubles down on one game. Win it for +{feed.powerplayPoints}, lose it for −{Math.abs(feed.powerplayLossPoints)}.
        </Text>
      )}
    </Panel>
  );
}

type Tone = 'ink' | 'hl' | 'pp' | 'neg';
const TONE: Record<Tone, { bg: string; fg: string }> = {
  ink: { bg: C.page, fg: C.ink },
  hl: { bg: C.hl, fg: C.ink },
  pp: { bg: C.ink, fg: C.white },
  neg: { bg: '#FDE8EA', fg: '#B4232A' },
};

function Tag({ children, tone, bg, fg, outline }: { children: string; tone?: Tone; bg?: string; fg?: string; outline?: boolean }) {
  const t = tone ? TONE[tone] : { bg: bg ?? C.ink, fg: fg ?? C.white };
  return (
    <View style={[s.tag, { backgroundColor: t.bg }, outline && { borderWidth: 1, borderColor: 'rgba(11,15,26,0.25)' }]}>
      <Text style={body(11, t.fg, 'bold')}>{children}</Text>
    </View>
  );
}

function GameRow({ g, tie, showPoints, open, first }: { g: FeedGame; tie: FeedTie; showPoints: boolean; open: Open; first: boolean }) {
  const w = gameWinner(g);
  const live = g.status === 'in_progress';
  const side = (sd: 'home' | 'away') => {
    const team = sd === 'home' ? tie.home : tie.away;
    const pair = sd === 'home' ? g.homePair : g.awayPair;
    const bonus = sd === 'home' ? g.homeBonus : g.awayBonus;
    const pp = sd === 'home' ? g.homePP : g.awayPP;
    const ppPts = sd === 'home' ? g.homePPPts : g.awayPPPts;
    const won = w === sd;
    const right = sd === 'away';
    const color = team.color ?? '#0B0F1A';
    return (
      <View style={[{ flex: 1, minWidth: 0 }, right && { alignItems: 'flex-end' }]}>
        {pair.length ? (
          pair.map((p) => (
            <Text
              key={p}
              numberOfLines={1}
              style={[body(14, won ? C.ink : C.soft, won ? 'bold' : 'text'), { lineHeight: 19 }, right && { textAlign: 'right' }]}
              onPress={isRealName(p) ? () => open.player({ name: p, team }) : undefined}
            >
              {p}
            </Text>
          ))
        ) : (
          <Text style={[body(14, C.mute), right && { textAlign: 'right' }]}>To be named</Text>
        )}
        <View style={[s.tags, right && { justifyContent: 'flex-end' }]}>
          {won && (
            <Tag bg={color} fg={isLight(color) ? C.ink : C.white} outline={isLight(color)}>
              {`${team.shortName && team.shortName.length <= 12 ? team.shortName : 'Winner'} won`}
            </Tag>
          )}
          {showPoints && bonus > 0 && <Tag tone="hl">{`+${bonus} bonus`}</Tag>}
          {pp && (
            <Tag tone={ppPts < 0 ? 'neg' : 'pp'}>
              {`Powerplay ${ppPts > 0 ? `won +${ppPts}` : ppPts < 0 ? `lost ${ppPts}` : 'called'}`}
            </Tag>
          )}
        </View>
      </View>
    );
  };
  const score =
    g.status === 'scheduled'
      ? '–'
      : g.status === 'cancelled'
        ? 'Not played'
        : g.sets.length
          ? g.sets.map((x) => `${x.a}–${x.b}`).join(', ')
          : `${g.homeScore ?? 0}–${g.awayScore ?? 0}`;
  return (
    <View style={[s.game, !first && { borderTopWidth: 1, borderTopColor: C.line }, live && { backgroundColor: '#FFF5F5' }]}>
      <View style={s.gameTop}>
        <Text style={s.gameLabel}>
          Game {g.slot} · {categoryLabel(g.category)}
        </Text>
        {showPoints && g.pointValue > 1 && <Tag tone="ink">{`${g.pointValue} pts`}</Tag>}
        {live && <Text style={[s.gameLabel, { color: C.live }]}>● Live</Text>}
      </View>
      <View style={s.gameRow}>
        {side('home')}
        <Text style={[body(15, live ? C.live : C.ink, 'bold'), s.gameScore]}>
          {live ? `${g.homeScore ?? 0}–${g.awayScore ?? 0}` : score}
        </Text>
        {side('away')}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  col: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summary: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  nowScore: { backgroundColor: C.page, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  bkHead: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, gap: 12 },
  bkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  bkVal: { flex: 1, fontVariant: ['tabular-nums'] },
  bkLabel: { ...body(11.5, C.mute, 'bold'), textTransform: 'uppercase', letterSpacing: 0.7, textAlign: 'center', paddingHorizontal: 8 },
  bkNote: { borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 14, paddingVertical: 10 },
  tag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  game: { paddingHorizontal: 14, paddingVertical: 14 },
  gameTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 8 },
  gameLabel: { ...body(11.5, C.mute, 'bold'), textTransform: 'uppercase', letterSpacing: 0.6 },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gameScore: { minWidth: 72, maxWidth: 110, textAlign: 'center', fontVariant: ['tabular-nums'] },
  stream: {
    ...card,
    backgroundColor: C.ink,
    borderColor: C.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
