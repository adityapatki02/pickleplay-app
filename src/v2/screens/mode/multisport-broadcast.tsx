// Admin mode for a multi-sport league run on the auction server (SHPL): the broadcast
// links. Pick a sport, then a court; each court's links follow that sport's live match
// there, so sports played side by side each get their own ticker and scoreboard.
// The same Score ticker and Digital scoreboard as every other league, fed by the sport.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Page } from '../../components/chrome';
import { Empty } from '../../components/ui';
import { AUCTION_BASE } from '../../data/auction-feed';
import { useLoad } from '../../hooks';
import { C, body, card, label } from '../../theme';
import { Heading, LinkRow, NoteBox, type Note } from './league-admin';

type Meta = { ok: boolean; league: string; games: { slug: string; name: string; kind: string; courts: string[] }[] };

function Chips<T extends string>({ items, value, onPick }: { items: { key: T; label: string }[]; value: T; onPick: (k: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((it) => (
        <Pressable key={it.key || 'any'} onPress={() => onPick(it.key)} style={[s.chip, value === it.key && s.chipOn]}>
          <Text style={label(12, value === it.key ? C.white : C.bar)}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function MultiSportBroadcast({ token }: { token: string }) {
  const { state, reload } = useLoad(`msl-meta-${token}`, () =>
    fetch(`${AUCTION_BASE}/api/v1/auctions/league/obs/${encodeURIComponent(token)}/meta`).then((r) => r.json() as Promise<Meta>),
  );
  const [slug, setSlug] = useState('');
  // null until picked: then the sport's first court, as other leagues start on theirs
  const [picked, setCourt] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const copied = (text: string) => setNote({ ok: true, text });

  const games = state.status === 'ready' && state.data.ok ? state.data.games : [];
  const game = games.find((g) => g.slug === slug) ?? games[0];
  const court = picked ?? game?.courts[0] ?? '';
  const base = `${AUCTION_BASE}/api/v1/auctions/league/obs/${token}`;
  const q = game ? `game=${encodeURIComponent(game.slug)}${court ? `&court=${encodeURIComponent(court)}` : ''}` : '';
  const where = [game?.name, court || 'Any court'].filter(Boolean).join(' · ');

  return (
    <Page onRefresh={reload}>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        {state.status === 'loading' ? <Empty>Loading…</Empty> : null}
        {state.status === 'error' ? <Empty>Couldn't load this league. Pull down to try again.</Empty> : null}
        {state.status === 'ready' && !games.length ? <Empty>This event has no league matches yet.</Empty> : null}
        {game ? (
          <>
            <Heading>Broadcast</Heading>
            <Text style={[body(12.5, C.soft), { marginTop: -6 }]}>
              Add these in OBS as browser sources. Pick a sport, then a court: each court's links follow that sport's live match there, so when sports run side by side, use one set per sport and court.
            </Text>
            <Heading>Sport</Heading>
            <Chips
              items={games.map((g) => ({ key: g.slug, label: g.name }))}
              value={game.slug}
              onPick={(k) => {
                setSlug(k);
                setCourt(null);
              }}
            />
            <Heading>Court</Heading>
            <Chips items={[...game.courts.map((c) => ({ key: c, label: c })), { key: '', label: 'Any court' }]} value={court} onPick={setCourt} />
            {!game.courts.length ? (
              <Text style={[body(12, C.soft), { marginTop: -4 }]}>No courts set for {game.name} yet. Any court follows its latest match.</Text>
            ) : null}
            <View style={[card, { paddingVertical: 4 }]}>
              <LinkRow title={`Score ticker · ${where}`} sub="Live score along the bottom of the stream" url={`${base}/ticker?${q}&size=small`} onCopied={copied} />
              <LinkRow title={`Digital scoreboard · ${where}`} sub="Wide board for an LED screen or TV at the court" url={`${base}/scoreboard?${q}`} onCopied={copied} />
            </View>
            <NoteBox note={note} />
            <View style={[card, { paddingVertical: 4 }]}>
              <LinkRow title="Public page" sub="Fixtures, results and standings for every sport" url={`${AUCTION_BASE}/api/v1/auctions/league/${token}`} onCopied={copied} />
            </View>
          </>
        ) : null}
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  chip: { borderRadius: 999, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.white, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: C.bar, borderColor: C.bar },
});
