import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EVENTS, statusOf, type YoidenEvent } from '../data/events';
import { REGISTRATIONS, isOpen } from '../data/registrations';
import { useFollows } from './follows';
import { fetchLeague, roundLabel, tieScore } from '../data/league-feed';
import { fetchFootball, isDone, stageLabel } from '../data/football-feed';

/**
 * The bell's list, worked out on the phone for now: every match result in the
 * events you follow, plus an event going live, starting soon or wrapping up, and
 * registration forms closing soon. When push notifications and a server-side
 * follows table land, the server sends these same lines as pushes.
 */
export type Note = {
  id: string;
  kind: 'live' | 'soon' | 'results' | 'closing' | 'result';
  title: string;
  body: string;
  /** When it became true (ms), for ordering and the unread dot. */
  at: number;
  eventId?: string;
  /** Opens this match (per-match results). */
  matchId?: string;
  url?: string;
};

/** Results older than this stay off the bell. */
const RESULT_WINDOW = 14 * 24 * 60 * 60 * 1000;

/**
 * One note per finished match in the events you follow: "Block Busters beat Lord Of The
 * Strings 4–1". Read from the same live feeds as the event pages, refreshed every minute
 * while the app is open. When push notifications land, the server sends these same lines
 * as pushes the moment a scorer closes a match.
 */
const resultCache = new Map<string, { at: number; notes: Note[] }>();

async function resultsFor(e: YoidenEvent, now: number): Promise<Note[]> {
  const cached = resultCache.get(e.id);
  if (cached && now - cached.at < 60_000) return cached.notes;
  const out: Note[] = [];
  if (e.football) {
    const feed = await fetchFootball(e.football);
    const name = (id: string | null, fallback: string) => feed.teams.find((t) => t.id === id)?.name ?? fallback;
    const divisions = new Set(feed.teams.map((t) => t.division)).size;
    for (const m of feed.matches) {
      if (!isDone(m) || !m.startsAt) continue;
      const home = name(m.homeTeamId, m.homeLabel);
      const away = name(m.awayTeamId, m.awayLabel);
      out.push({
        id: `result-${m.id}`,
        kind: 'result',
        title: `${home} ${m.homeScore}–${m.awayScore} ${away}`,
        body: `${e.name} · ${stageLabel(m, divisions)}`,
        at: Date.parse(m.startsAt),
        eventId: e.id,
        matchId: m.id,
      });
    }
  } else {
    for (const l of e.leagues ?? []) {
      const feed = await fetchLeague(l.slug);
      for (const t of feed.ties) {
        if (t.status !== 'completed' || !t.home || !t.away) continue;
        const when = t.scheduledStart ? Date.parse(t.scheduledStart) : t.matchDay ? Date.parse(`${t.matchDay}T12:00:00+05:30`) : NaN;
        if (!Number.isFinite(when)) continue;
        const [h, a] = tieScore(feed, t);
        const homeWon = t.winnerId === t.home.id;
        const awayWon = t.winnerId === t.away.id;
        const title = homeWon
          ? `${t.home.name} beat ${t.away.name} ${h}–${a}`
          : awayWon
            ? `${t.away.name} beat ${t.home.name} ${a}–${h}`
            : `${t.home.name} ${h}–${a} ${t.away.name}`;
        out.push({
          id: `result-${t.id}`,
          kind: 'result',
          title,
          body: `${e.name}${(e.leagues?.length ?? 0) > 1 ? ` · ${l.label}` : ''} · ${roundLabel(t.round)}`,
          at: when,
          eventId: e.id,
          matchId: t.id,
        });
      }
    }
  }
  resultCache.set(e.id, { at: now, notes: out });
  return out;
}

/** Per-match results for followed events, kept fresh every minute. */
function useResultNotes(followIds: string[], now: number): Note[] {
  const [notes, setNotes] = useState<Note[]>([]);
  const key = followIds.join(',');
  // Re-read once a minute (useNow ticks every minute).
  const minute = Math.floor(now / 60_000);
  useEffect(() => {
    let alive = true;
    const events = followIds.map((id) => EVENTS.find((e) => e.id === id)).filter((e): e is YoidenEvent => !!(e && (e.leagues?.length || e.football)));
    Promise.all(events.map((e) => resultsFor(e, Date.now()).catch(() => [] as Note[]))).then((all) => {
      if (!alive) return;
      const cutoff = Date.now() - RESULT_WINDOW;
      setNotes(all.flat().filter((n) => n.at >= cutoff));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, minute]);
  return notes;
}

const DAY = 24 * 60 * 60 * 1000;
const istDay = (d: string) => Date.parse(`${d}T00:00:00+05:30`);
const daysWord = (n: number) => (n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

function forEvent(e: YoidenEvent, now: number): Note | null {
  if (!e.start) return null;
  const st = statusOf(e, now);
  const start = istDay(e.start);
  const end = istDay(e.end ?? e.start) + DAY;
  if (st === 'live') {
    return {
      id: `live-${e.id}`,
      kind: 'live',
      title: `${e.name} is live`,
      body: e.kind === 'auction' ? 'Follow every sale as it happens.' : 'Scores and standings are updating now.',
      at: start,
      eventId: e.id,
    };
  }
  if (st === 'upcoming' && start - now <= 3 * DAY) {
    const days = Math.ceil((start - now) / DAY);
    return {
      id: `soon-${e.id}`,
      kind: 'soon',
      title: `${e.name} starts ${daysWord(days)}`,
      body: 'Fixtures, teams and timings are on the event page.',
      at: start - 3 * DAY,
      eventId: e.id,
    };
  }
  if (st === 'past' && now - end <= 7 * DAY) {
    return {
      id: `results-${e.id}`,
      kind: 'results',
      title: `Results are in: ${e.name}`,
      body: e.kind === 'auction' ? 'See every squad and the top buys.' : 'Final standings, champions and player stats.',
      at: end,
      eventId: e.id,
    };
  }
  return null;
}

export function useNotes(now: number): Note[] {
  const followIds = useFollows((s) => s.ids);
  const results = useResultNotes(followIds, now);
  return useMemo(() => {
    const out: Note[] = [];
    for (const id of followIds) {
      const e = EVENTS.find((x) => x.id === id);
      const n = e && forEvent(e, now);
      if (n) out.push(n);
    }
    for (const r of REGISTRATIONS) {
      if (!isOpen(r, now)) continue;
      const closes = istDay(r.closes) + DAY;
      const days = Math.floor((closes - now) / DAY);
      if (days > 5) continue;
      out.push({
        id: `closing-${r.id}`,
        kind: 'closing',
        title: `Registration closes ${daysWord(days)}: ${r.name}`,
        body: r.kind,
        at: closes - 5 * DAY,
        url: r.url,
      });
    }
    return [...out, ...results].sort((a, b) => b.at - a.at).slice(0, 60);
  }, [followIds, now, results]);
}

/** When the player last opened the bell; anything newer shows the dot. */
const KEY = 'yoiden-notes-seen';
export const useNotesSeen = create<{ seenAt: number; markSeen: () => void }>()((set) => ({
  seenAt: 0,
  markSeen: () => {
    const seenAt = Date.now();
    AsyncStorage.setItem(KEY, String(seenAt)).catch(() => {});
    set({ seenAt });
  },
}));
AsyncStorage.getItem(KEY)
  .then((v) => v && useNotesSeen.setState({ seenAt: Number(v) || 0 }))
  .catch(() => {});

/** True when the bell has something the player hasn't opened yet. */
export function useHasUnread(now: number): boolean {
  const notes = useNotes(now);
  const seenAt = useNotesSeen((s) => s.seenAt);
  return notes.some((n) => n.at > seenAt);
}
