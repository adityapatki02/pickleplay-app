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

// ── League admin (/admin) ─────────────────────────────────────────
// The web admin's own endpoints (event-site /admin), which take the same login.

export type AdminScorer = { userId: string; name: string; phone: string; defaultCourt: number | null; isAdmin: boolean };

export type AdminTeam = {
  id: string;
  name: string;
  shortName: string | null;
  captainName: string | null;
  captainPhone: string | null;
  captainToken: string | null;
  hasPin: boolean;
};

/** A card given to a team. What it costs comes from the league's card rules. */
export type AdminCard = { id: string; franchiseId: string; type: 'yellow' | 'red'; reason: string | null; createdAt: string };

/** Points off for each yellow and each red card. */
export type CardRules = { yellow: number; red: number };

export type AdminTeamRef = { id: string; name: string; shortName: string | null };

export type AdminLineupRow = { slotNumber: number; categorySlug: string; player1Id: string | null; player2Id: string | null; powerplay?: boolean };

export type AdminTieSlot = { slot: number; category: string; allowedCategories: string[]; mixed?: boolean; singles?: boolean; pairing: string; points: number };

export type AdminTie = {
  id: string;
  round: string;
  status: string;
  home: AdminTeamRef | null;
  away: AdminTeamRef | null;
  court: number | null;
  scheduledStart: string | null;
  tieSheetDeadline: string | null;
  presentTeamIds: string[];
  scorerId: string | null;
  sheets: { franchiseId: string; status: string; lineupData: AdminLineupRow[] }[];
  slots: AdminTieSlot[];
  matchDay?: string | null;
  /** Each game's result, for a filled tie sheet. */
  games?: { slotNumber: number; played: boolean; homeScore: number | null; awayScore: number | null }[];
};

export type AdminData = {
  /** The league's event site (https://society.yoiden.com, path of its public page), if it has one. */
  site: { host: string; path: string } | null;
  season: {
    id: string;
    slug: string | null;
    releaseOnCommand?: boolean;
    noDeadline?: boolean;
    /** The rules line printed under a paper tie sheet; null = the default wording. */
    sheetRule?: string | null;
    /** League-stage progress, for the knockout card. */
    leagueTies?: number;
    leagueDone?: number;
    knockoutSeeded?: boolean;
    teamCount?: number;
  };
  leagueName?: string;
  powerplayPoints: number;
  scorers: AdminScorer[];
  franchises: AdminTeam[];
  squads: Record<string, { playerId: string; name: string; cat: string }[]>;
  ties: AdminTie[];
  cards: AdminCard[];
  cardRules?: CardRules;
  /** Points each team has lost to cards, by team id. */
  cardPenalty?: Record<string, number>;
  /** Courts the league's ties and games are on (1-8), for per-court broadcast links. */
  courts?: number[];
};

export const leagueAdmin = {
  data: (leagueId: string) => apiClient.get('/admin/data', { params: { leagueId } }).then(unwrap<AdminData>),
  addScorer: (leagueId: string, body: { name?: string; phone: string; pin?: string }) =>
    apiClient
      .post('/admin/scorers', { leagueId, ...body })
      .then(unwrap<{ userId: string; name: string | null; phone: string; generatedPin: string | null }>),
  removeScorer: (leagueId: string, userId: string) => apiClient.post(`/admin/scorers/${userId}/remove`, { leagueId }),
  scorerPin: (leagueId: string, userId: string) =>
    apiClient.post(`/admin/scorers/${userId}/reveal-pin`, { leagueId }).then(unwrap<{ pin: string | null }>),
  /** Put a tie on a court (1-8), or clear it with null. */
  assignCourt: (leagueId: string, tieId: string, courtNumber: number | null) =>
    apiClient.post('/admin/assign-court', { leagueId, tieId, courtNumber }),
  /** Move one game to a court (1-8), or clear it with null. */
  gameCourt: (leagueId: string, tieId: string, slotNumber: number, courtNumber: number | null) =>
    apiClient.post('/admin/game-court', { leagueId, tieId, slotNumber, courtNumber }),
  assignScorer: (leagueId: string, tieId: string, scorerId: string | null) =>
    apiClient.post('/admin/assign-scorer', { leagueId, tieId, scorerId }),
  /** Save one team's lineup for a tie, on the captain's behalf. */
  saveLineup: (leagueId: string, tieId: string, franchiseId: string, lineupData: AdminLineupRow[]) =>
    apiClient.post('/admin/lineup', { leagueId, tieId, franchiseId, lineupData }),
  /** Lock both lineups (in release-on-command leagues this also publishes them). */
  lockLineups: (leagueId: string, tieId: string) => apiClient.post(`/admin/lock/${tieId}`, { leagueId }),
  /** Open the captain portal for this tie for 15, 30 or 60 minutes from now. */
  openCaptains: (leagueId: string, tieId: string, minutes: 15 | 30 | 60) => apiClient.post('/admin/open-captain-portal', { leagueId, tieId, minutes }),
  captainPin: (leagueId: string, franchiseId: string) =>
    apiClient.post('/admin/captain-pin/reveal', { leagueId, franchiseId }).then(unwrap<{ pin: string | null; reason: string | null }>),
  setCaptainPin: (leagueId: string, franchiseId: string, pin: string) => apiClient.post('/admin/captain-pin', { leagueId, franchiseId, pin }),
  /** The court a scorer covers; also puts them on that court's remaining ties. */
  scorerCourt: (leagueId: string, userId: string, court: number | null) => apiClient.post('/admin/scorer-court', { leagueId, userId, court }),
  /** Replace a squad player. Played games stay with the outgoing player. */
  swapPlayer: (leagueId: string, franchiseId: string, outPlayerId: string, newName: string) =>
    apiClient.post('/admin/roster/swap', { leagueId, franchiseId, outPlayerId, newName }).then(unwrap<{ outName: string; inName: string; gamesMoved: number; sheetsMoved: number }>),
  /** Add a player to a squad. With a phone, the entry is that person's own account. */
  addPlayer: (leagueId: string, franchiseId: string, body: { name: string; category: string; phone?: string }) =>
    apiClient.post('/admin/roster/add', { leagueId, franchiseId, ...body }).then(unwrap<{ playerId: string; name: string; existingAccount: boolean }>),
  addCard: (leagueId: string, franchiseId: string, type: 'yellow' | 'red', reason?: string) =>
    apiClient.post('/admin/cards', { leagueId, franchiseId, type, reason }),
  /** Draw the knockout from the final table (top 4: 1v4, 2v3; three teams: 2nd v 3rd, winner meets 1st). */
  knockout: (leagueId: string) => apiClient.post('/admin/knockout', { leagueId }).then(unwrap<{ sf1?: string; sf2?: string; final?: string }>),
  /** Points off for each yellow and each red; re-prices cards already given. */
  setCardRules: (leagueId: string, rules: CardRules) => apiClient.post('/admin/card-rules', { leagueId, ...rules }),
  removeCard: (leagueId: string, cardId: string) => apiClient.post(`/admin/cards/${cardId}/remove`, { leagueId }),
  setPresence: (leagueId: string, tieId: string, franchiseId: string, present: boolean) => apiClient.post('/admin/presence', { leagueId, tieId, franchiseId, present }),
  /** Put a finished league tie back in play to correct a result. */
  reopenTie: (leagueId: string, tieId: string) => apiClient.post(`/admin/reopen-tie/${tieId}`, { leagueId }),
  /** Rename a team (the league organiser's own franchise endpoint). */
  renameTeam: (franchiseId: string, name: string, shortName?: string) =>
    apiClient.patch(`/franchises/${franchiseId}`, { name, ...(shortName ? { shortName } : {}) }),
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
