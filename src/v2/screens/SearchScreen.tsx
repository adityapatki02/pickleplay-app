// Full-screen search over every event, team and player on Yoiden. Uses the
// website's index (yoiden.com/search-index.json, loaded once and kept for the
// session) and the same ranking as yoiden.com's site-search. Results open the
// matching app screen; links outside the app open in the browser.
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, MAX_W, body, label } from '../theme';
import { CloseIcon, SearchIcon } from '../components/icons';
import { EVENTS, formatWhen } from '../data/events';
import { useEventListState } from '../store/event-list';

export type SearchEntry = { k: 'Event' | 'Team' | 'Player' | 'Auction player'; n: string; s: string; h: string };

const INDEX_URL = 'https://yoiden.com/search-index.json';
const KIND_ORDER: Record<SearchEntry['k'], number> = { Event: 0, Team: 1, Player: 2, 'Auction player': 3 };
const MAX = 40;

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');

let indexPromise: Promise<SearchEntry[]> | null = null;
const loadIndex = () =>
  (indexPromise ??= fetch(INDEX_URL)
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => (Array.isArray(d) ? (d as SearchEntry[]) : []))
    .catch(() => {
      indexPromise = null;
      return [] as SearchEntry[];
    }));

/** Same ranking as the website: every word must match; name-prefix beats word-start beats substring, then by kind. */
function rank(index: SearchEntry[], q: string): SearchEntry[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: { e: SearchEntry; score: number }[] = [];
  for (const e of index) {
    const name = norm(e.n);
    const hay = `${name} ${norm(e.s)}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const first = words[0]!;
    const score =
      (name.startsWith(first) ? 0 : name.includes(` ${first}`) ? 1 : name.includes(first) ? 2 : 3) * 10 + (KIND_ORDER[e.k] ?? 4);
    hits.push({ e, score });
  }
  return hits
    .sort((a, b) => a.score - b.score || a.e.n.localeCompare(b.e.n))
    .slice(0, MAX)
    .map((h) => h.e);
}

/** Events are searchable instantly from the app's own list; teams and players join once the index loads. */
const localEntries = (): SearchEntry[] => EVENTS.map((e) => ({
  k: 'Event' as const,
  n: e.name,
  s: `${e.sport} · ${e.city} · ${formatWhen(e)}`,
  h: `/events/${e.id}`,
}));

export default function SearchScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<SearchEntry[]>([]);
  const listVersion = useEventListState((s) => s.version);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const index = useMemo(() => [...localEntries(), ...remote.filter((x) => x.k !== 'Event')], [remote, listVersion]);

  useEffect(() => {
    let alive = true;
    loadIndex().then((d) => alive && setRemote(d));
    return () => {
      alive = false;
    };
  }, []);

  const results = useMemo(() => rank(index, q), [index, q]);

  const close = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs'));

  const go = (e: SearchEntry) => {
    const h = e.h || '';
    if (/^https?:\/\//i.test(h)) {
      Linking.openURL(h).catch(() => {});
      return;
    }
    const path = h.split('#')[0].split('?')[0];
    const m = path.match(/^\/events\/([^/]+)(?:\/(player|match)\/([^/]+))?\/?$/);
    if (m) {
      const [, id, sub, rest] = m;
      const eventId = decodeURIComponent(id);
      if (sub === 'player') nav.navigate('Player', { eventId, slug: decodeURIComponent(rest) });
      else if (sub === 'match') nav.navigate('Match', { eventId, matchId: decodeURIComponent(rest) });
      else nav.navigate('Event', { id: eventId });
      return;
    }
    if (h.startsWith('/')) Linking.openURL(`https://yoiden.com${h}`).catch(() => {});
  };

  const message = !q.trim()
      ? 'Type a player, team or event name. Every league and auction on Yoiden is included.'
      : !results.length
        ? `Nothing matches “${q}”.`
        : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.inner}>
          <View style={s.field}>
            <SearchIcon size={18} color={C.mute} />
            <TextInput
              value={q}
              onChangeText={setQ}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => results[0] && go(results[0])}
              placeholder="Search events, teams and players"
              placeholderTextColor={C.mute}
              style={s.input}
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8}>
                <Text style={label(12, C.mute)}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={close} hitSlop={10} style={s.close} accessibilityLabel="Close search">
            <CloseIcon size={20} color={C.white} />
          </Pressable>
        </View>
      </View>

      {message ? (
        <View style={s.inner}>
          <Text style={[body(14, C.soft), { paddingVertical: 20 }]}>{message}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(e) => `${e.k}-${e.h}-${e.n}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item: e }) => (
            <Pressable onPress={() => go(e)} style={({ pressed }) => [s.rowWrap, pressed && { backgroundColor: C.white }]}>
              <View style={[s.inner, s.row]}>
                <Text style={[label(11, C.accent), s.kind]} numberOfLines={1}>
                  {e.k}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={body(15, C.ink, 'semi')} numberOfLines={1}>
                    {e.n}
                  </Text>
                  {e.s ? (
                    <Text style={body(12.5, C.soft)} numberOfLines={1}>
                      {e.s}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: C.bar, paddingBottom: 12 },
  inner: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: 9, paddingHorizontal: 12, minHeight: 44 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, color: C.ink, paddingVertical: 10, outlineStyle: 'none' } as any,
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  rowWrap: { borderBottomWidth: 1, borderBottomColor: C.line },
  row: { paddingVertical: 11 },
  kind: { width: 92 },
});
