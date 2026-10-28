// Calls behind the role modes. Every call carries the app's login (Bearer), which the
// server accepts in place of the scorer / captain / football PINs:
// - league scoring uses the scorer portal's endpoints (/scorer/*), the same ones the web
//   scorers use on match day, so every format's rules (LPBL reversed knockouts, best-of-3
//   finals, score checks) come from one place;
// - captains get a captain session for their phone (/captain-portal/app-session) and then
//   use the portal's own data and submit-lineup endpoints;
// - football writes send the login token instead of phone + PIN.
import apiClient from '../../api/client';

const unwrap = <T>(res: { data: any }): T => (res.data?.data ?? res.data) as T;

/** The server's own message ("Score must reach 15") when it refuses a write. */
export function errorText(err: any, fallback = 'That did not go through. Try again.'): string {
  const m = err?.response?.data?.message;
  return Array.isArray(m) ? m.join(' ') : typeof m === 'string' && m ? m : fallback;
}

// ── League scoring (/scorer) ──────────────────────────────────────

export type ScoreGame = {
  matchId: string;
  bestOf3: boolean;
  games: { a: number; b: number }[];
  slotNumber: number;
  playNo: number;
  categorySlug: string;
  slotLabel: string | null;
  pointValue: number;
  court: number | null;
  status: 'scheduled' | 'in_progress' | 'completed' | string;
  scoringMode: string;
  teamAScore: number | null;
  teamBScore: number | null;
  homePlayer1: string | null;
  homePlayer2: string | null;
  awayPlayer1: string | null;
  awayPlayer2: string | null;
};

export type ScoreTie = {
  id: string;
  decided: boolean;
  round: string;
  matchDay: string | null;
  scheduledStart: string | null;
  courtNumber: number | null;
  pointsToWin: number;
  homeTeam: { id: string; name: string; shortName?: string } | null;
  awayTeam: { id: string; name: string; shortName?: string } | null;
  homeScore: number;
  awayScore: number;
  homeStandingPoints: number;
  awayStandingPoints: number;
  status: string;
  scorerId: string | null;
  scorerName: string | null;
  isMyLock: boolean;
  matches: ScoreGame[];
};

export type ScorerData = {
  league: string;
  leagueSlug: string | null;
  season: { id: string; name: string };
  format: string | null;
  userId: string;
  ties: ScoreTie[];
  roster: Record<string, { id: string; name: string }>;
};

export const scorer = {
  data: (seasonId: string) => apiClient.get('/scorer/data', { params: { seasonId } }).then(unwrap<ScorerData>),
  lock: (tieId: string) => apiClient.post(`/scorer/lock/${tieId}`),
  unlock: (tieId: string) => apiClient.post(`/scorer/unlock/${tieId}`),
  live: (matchId: string, teamAScore: number, teamBScore: number, gameNumber?: number) =>
    apiClient.post(`/scorer/live-score/${matchId}`, { teamAScore, teamBScore, gameNumber }),
  save: (matchId: string, body: { teamAScore: number; teamBScore: number; games?: { a: number; b: number }[] }) =>
    apiClient.post(`/scorer/score/${matchId}`, body),
  declare: (matchId: string, winner: 'home' | 'away', reason: string) =>
    apiClient.post(`/scorer/declare-winner/${matchId}`, { winner, reason }),
  reset: (matchId: string) => apiClient.post(`/scorer/reset-match/${matchId}`),
  complete: (tieId: string) => apiClient.post(`/scorer/complete-tie/${tieId}`),
};

// ── Captain (/captain-portal) ─────────────────────────────────────

export type CaptainTeam = { token: string; team: string; league: string; franchiseId?: string };

export type CaptainSlot = {
  slot: number;
  category: string;
  allowedCategories: string[];
  mixed?: boolean;
  pairing: string;
  points: number;
  singles?: boolean;
};

export type CaptainMatch = {
  slotNumber: number;
  categorySlug: string;
  pointValue: number;
  status: string;
  iWon: boolean;
  locked: boolean;
  revealed: boolean;
  myScore: number | null;
  oppScore: number | null;
  myP1: string | null;
  myP2: string | null;
  oppP1: string | null;
  oppP2: string | null;
};

export type CaptainTie = {
  id: string;
  round: string;
  matchDay: string | null;
  scheduledStart: string | null;
  status: string;
  isHome: boolean;
  opponent: string | null;
  myScore: number | null;
  oppScore: number | null;
  tieSheetDeadline?: string | null;
  powerplayDeadline?: string | null;
  lockedCategories: string[];
  sheet: { status: string; lineupData: { slotNumber: number; categorySlug: string; player1Id: string | null; player2Id: string | null; powerplay?: boolean }[] } | null;
  matches: CaptainMatch[];
};

export type CaptainData = {
  franchise: { id: string; name: string; leagueName: string };
  season: { id: string; name: string };
  roster: { playerId: string; name: string; categorySlug: string }[];
  ties: CaptainTie[];
  slots: CaptainSlot[];
  powerplayPoints: number;
};

/** The roster placeholder the portal uses for "decide at game time". */
export const SUBSTITUTE = 'SUBSTITUTE';

export const captain = {
  session: () =>
    apiClient.get('/captain-portal/app-session').then((r) => ({ teams: (r.data?.data ?? []) as CaptainTeam[], session: r.data?.session as string | null })),
  data: (token: string, session: string) =>
    apiClient.get(`/captain-portal/${token}/data`, { headers: { 'x-captain-session': session } }).then(unwrap<CaptainData>),
  submit: (
    token: string,
    session: string,
    tieId: string,
    lineupData: { slotNumber: number; categorySlug: string; player1Id: string | null; player2Id: string | null; powerplay?: boolean }[],
  ) => apiClient.post(`/captain-portal/${token}/submit-lineup`, { tieId, lineupData }, { headers: { 'x-captain-session': session } }),
};

// ── Football (/fb/:slug) ──────────────────────────────────────────

export type ClockAction = 'kickoff' | 'pause' | 'resume' | 'halftime' | 'second' | 'fulltime' | 'walkover' | 'reopen';

export const football = {
  role: (slug: string) => apiClient.post(`/fb/${slug}/auth`, {}).then(unwrap<{ role: 'admin' | 'scorer'; name: string; turf?: number | null }>),
  clock: (slug: string, matchId: string, action: ClockAction, result?: 'home' | 'away' | 'draw') =>
    apiClient.post(`/fb/${slug}/matches/${matchId}/clock`, { action, result }),
  goal: (slug: string, matchId: string, body: { teamId: string; playerId?: string | null; newPlayerName?: string; ownGoal?: boolean; minute?: number }) =>
    apiClient.post(`/fb/${slug}/matches/${matchId}/goals`, body),
  deleteGoal: (slug: string, goalId: string) => apiClient.post(`/fb/${slug}/goals/${goalId}/delete`, {}),
};
