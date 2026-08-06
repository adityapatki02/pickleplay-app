/**
 * Badminton doubles service-state tracking (SBPL rulebook §4).
 *
 * Pure, dependency-free reducer. Whose serve it is depends on rally HISTORY —
 * a pair swaps its Right/Left service courts only when it wins a point on its
 * own serve — so serve state is folded over an ordered event list, not derived
 * from the final score.
 *
 * Events are either a rally result (`winner`) or a manual `override` (scorer
 * fixes the server/positions). Score-correction and undo are handled by the
 * CALLER editing the event array and re-folding — because both score and serve
 * derive from the same list, editing the last rally recomputes both.
 *
 * This util has NO persistence and NO framework deps so it can be unit-tested
 * exhaustively and mirrored 1:1 in the app.
 */

export type Side = 'home' | 'away';
export type Court = 'R' | 'L';

/** The two players of each side, by the service court they currently stand in. */
export interface Positions {
  home: { R: string; L: string };
  away: { R: string; L: string };
}

export interface ServeConfig {
  /** Which side serves the first rally (0-0). */
  firstServingSide: Side;
  /** Starting R/L player for both sides. At 0-0 the serving side's R player serves. */
  positions: Positions;
}

export type ServeEvent =
  | { type: 'rally'; winner: Side }
  | { type: 'override'; servingSide: Side; positions: Positions };

export interface ServeState {
  servingSide: Side;
  /** Current R/L occupant per side. */
  positions: Positions;
  score: { home: number; away: number };
  /** Service court the current serve is delivered from (serving side's score parity). */
  serviceCourt: Court;
  /** Player currently serving. */
  serverId: string;
  /** Player currently receiving (diagonally opposite). */
  receiverId: string;
}

const otherSide = (s: Side): Side => (s === 'home' ? 'away' : 'home');

/** Service court from a side's score: even → Right, odd → Left (rulebook §4a). */
export function courtForScore(score: number): Court {
  return score % 2 === 0 ? 'R' : 'L';
}

function clonePositions(p: Positions): Positions {
  return { home: { ...p.home }, away: { ...p.away } };
}

/** Derive server/receiver/serviceCourt from side + positions + score. */
function derive(
  servingSide: Side,
  positions: Positions,
  score: { home: number; away: number },
): Pick<ServeState, 'serviceCourt' | 'serverId' | 'receiverId'> {
  const court = courtForScore(score[servingSide]);
  return {
    serviceCourt: court,
    serverId: positions[servingSide][court],
    // Diagonal: server's court letter maps to the receiver in the same letter
    // on the opposing side (the two are diagonally opposite across the net).
    receiverId: positions[otherSide(servingSide)][court],
  };
}

/** Initial state at 0-0 for a config. */
export function initialServeState(config: ServeConfig): ServeState {
  const positions = clonePositions(config.positions);
  const score = { home: 0, away: 0 };
  return {
    servingSide: config.firstServingSide,
    positions,
    score,
    ...derive(config.firstServingSide, positions, score),
  };
}

/** Apply a single event to a state, returning a new state (no mutation). */
export function applyServeEvent(state: ServeState, ev: ServeEvent): ServeState {
  if (ev.type === 'override') {
    const positions = clonePositions(ev.positions);
    return {
      ...state,
      servingSide: ev.servingSide,
      positions,
      ...derive(ev.servingSide, positions, state.score),
    };
  }

  // rally
  const winner = ev.winner;
  const score = { ...state.score, [winner]: state.score[winner] + 1 };
  let servingSide = state.servingSide;
  const positions = clonePositions(state.positions);

  if (winner === state.servingSide) {
    // Serving side wins: same server serves again from the ALTERNATE court —
    // i.e. the serving pair swaps R/L. Receiving side does not move.
    const p = positions[winner];
    [p.R, p.L] = [p.L, p.R];
  } else {
    // Receiving side wins: serve passes over. No swaps on either side; the new
    // server is whoever stands in the court matching the new server's score.
    servingSide = winner;
  }

  return {
    servingSide,
    positions,
    score,
    ...derive(servingSide, positions, score),
  };
}

/**
 * Fold a full event list to the current serve state. This is the entry point;
 * callers pass the persisted event array. Undo = drop the last event and
 * re-fold; correct-a-point = edit the last rally's `winner` and re-fold.
 */
export function foldServe(config: ServeConfig, events: ServeEvent[]): ServeState {
  return events.reduce(applyServeEvent, initialServeState(config));
}

/** Convenience: derived score from the event list (rallies only). */
export function scoreFromEvents(events: ServeEvent[]): { home: number; away: number } {
  const score = { home: 0, away: 0 };
  for (const e of events) if (e.type === 'rally') score[e.winner] += 1;
  return score;
}
