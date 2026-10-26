import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { fetchLeague, liveGame, roundLabel, tieScore } from '../data/league-feed';
import { fetchFootball, isDone, isLiveMatch, phaseLabel, stageLabel, teamColor } from '../data/football-feed';
import type { YoidenEvent } from '../data/events';

/** One side of the match shown on a live card. */
export type SnapSide = { name: string; shortName: string; color: string | null; score: number };

/**
 * What a live card shows for an event: how many matches are on right now, and one match,
 * the first one in progress, or the latest result when nothing is being played between
 * matches.
 */
export type LiveSnapshot = {
  liveCount: number;
  match?: {
    live: boolean;
    /** "Court 2 · League · Week 3" / "Group A · 2nd half". */
    label: string;
    /** Current game in a tie, "Game 3 · 12–9". */
    detail?: string;
    home: SnapSide;
    away: SnapSide;
  };
};

async function snapshotFor(e: YoidenEvent): Promise<LiveSnapshot> {
  if (e.football) {
    const feed = await fetchFootball(e.football);
    const divisions = new Set(feed.teams.map((t) => t.division)).size;
    const side = (id: string | null, label: string, score: number): SnapSide => ({
      name: feed.teams.find((t) => t.id === id)?.name ?? label,
      shortName: '',
      color: teamColor(feed, id),
      score,
    });
    const live = feed.matches.filter(isLiveMatch);
    const latest = [...feed.matches].filter(isDone).sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''))[0];
    const m = live[0] ?? latest;
    return {
      liveCount: live.length,
      match: m && {
        live: !!live[0],
        label: `${stageLabel(m, divisions)} · ${phaseLabel(m)}`,
        home: side(m.homeTeamId, m.homeLabel, m.homeScore),
        away: side(m.awayTeamId, m.awayLabel, m.awayScore),
      },
    };
  }

  const feeds = await Promise.all((e.leagues ?? []).map((l) => fetchLeague(l.slug)));
  const all = feeds.flatMap((feed) => feed.ties.map((tie) => ({ feed, tie })));
  const live = all.filter((x) => x.tie.status === 'in_progress' && x.tie.home && x.tie.away);
  const latest = all
    .filter((x) => x.tie.status === 'completed' && x.tie.home && x.tie.away)
    .sort((a, b) => (b.tie.scheduledStart ?? b.tie.matchDay ?? '').localeCompare(a.tie.scheduledStart ?? a.tie.matchDay ?? ''))[0];
  const pick = live[0] ?? latest;
  if (!pick) return { liveCount: 0 };
  const { feed, tie } = pick;
  const [h, a] = tieScore(feed, tie);
  const g = liveGame(tie);
  return {
    liveCount: live.length,
    match: {
      live: !!live[0],
      label: [tie.court ? `Court ${tie.court}` : null, roundLabel(tie.round)].filter(Boolean).join(' · '),
      detail: g ? `Game ${g.slot} · ${g.homeScore ?? 0}–${g.awayScore ?? 0}` : undefined,
      home: { name: tie.home.name, shortName: tie.home.shortName, color: tie.home.color, score: h },
      away: { name: tie.away.name, shortName: tie.away.shortName, color: tie.away.color, score: a },
    },
  };
}

/** Refresh rate while the app is open, the same as the event sites. */
const POLL_MS = 20_000;

/**
 * Live snapshots for a set of events, refreshed every 20 seconds while the app is in the
 * foreground. Auctions have no matches, so they are skipped.
 */
export function useLiveSnapshots(events: YoidenEvent[], active = true): Record<string, LiveSnapshot> {
  const [snaps, setSnaps] = useState<Record<string, LiveSnapshot>>({});
  const ids = useMemo(() => events.filter((e) => e.leagues?.length || e.football).map((e) => e.id).join(','), [events]);

  useEffect(() => {
    if (!active || !ids) return;
    let alive = true;
    const targets = events.filter((e) => ids.split(',').includes(e.id));
    const load = () => {
      if (AppState.currentState !== 'active') return;
      targets.forEach((e) =>
        snapshotFor(e)
          .then((s) => alive && setSnaps((m) => ({ ...m, [e.id]: s })))
          .catch(() => {}),
      );
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, active]);

  return snaps;
}
