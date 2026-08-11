import apiClient from './client';
import type {
  League,
  LeagueSeason,
  Franchise,
  FranchiseRoster,
  LeagueGroup,
  LeagueStanding,
  Tie,
  TieSheet,
  KnockoutBracketData,
  CreateLeagueInput,
  CreateSeasonInput,
  CreateFranchiseInput,
  AddRosterPlayerInput,
  GroupAssignment,
} from '../types/league.types';

// ═══════════════════════════════════════════════════════════════════════
// League CRUD
// ═══════════════════════════════════════════════════════════════════════

export const createLeague = (data: CreateLeagueInput) =>
  apiClient.post<League>('/leagues', data).then((r) => (r.data as any)?.data ?? r.data);

export const getLeagues = (params?: { organizerId?: string; city?: string; status?: string }) =>
  apiClient.get<League[]>('/leagues', { params }).then((r) => (r.data as any)?.data ?? r.data);

export const getLeague = (leagueId: string) =>
  apiClient.get<League>(`/leagues/${leagueId}`).then((r) => (r.data as any)?.data ?? r.data);

export const updateLeague = (leagueId: string, data: Partial<CreateLeagueInput>) =>
  apiClient.patch<League>(`/leagues/${leagueId}`, data).then((r) => (r.data as any)?.data ?? r.data);

export const deleteLeague = (leagueId: string) =>
  apiClient.delete(`/leagues/${leagueId}`).then((r) => (r.data as any)?.data ?? r.data);

export const importMasterCSV = (leagueId: string, seasonId: string, csvData: string) =>
  apiClient.post(`/leagues/${leagueId}/seasons/${seasonId}/import-csv`, { csvData }).then((r) => (r.data as any)?.data ?? r.data);

export const generateCaptainTokens = (leagueId: string) =>
  apiClient.post(`/captain-portal/generate-tokens/${leagueId}`).then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Season
// ═══════════════════════════════════════════════════════════════════════

export const createSeason = (leagueId: string, data: CreateSeasonInput) =>
  apiClient.post<LeagueSeason>(`/leagues/${leagueId}/seasons`, data).then((r) => (r.data as any)?.data ?? r.data);

export const getSeasons = (leagueId: string) =>
  apiClient.get<LeagueSeason[]>(`/leagues/${leagueId}/seasons`).then((r) => (r.data as any)?.data ?? r.data);

export const getSeason = (leagueId: string, seasonId: string) =>
  apiClient.get<LeagueSeason>(`/leagues/${leagueId}/seasons/${seasonId}`).then((r) => (r.data as any)?.data ?? r.data);

export const updateSeason = (leagueId: string, seasonId: string, data: Partial<CreateSeasonInput>) =>
  apiClient.patch<LeagueSeason>(`/leagues/${leagueId}/seasons/${seasonId}`, data).then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Franchises
// ═══════════════════════════════════════════════════════════════════════

export const createFranchise = (leagueId: string, data: CreateFranchiseInput) =>
  apiClient.post<Franchise>(`/leagues/${leagueId}/franchises`, data).then((r) => (r.data as any)?.data ?? r.data);

export const getFranchises = (leagueId: string) =>
  apiClient.get<Franchise[]>(`/leagues/${leagueId}/franchises`).then((r) => (r.data as any)?.data ?? r.data);

export const getFranchise = (franchiseId: string) =>
  apiClient.get<Franchise>(`/franchises/${franchiseId}`).then((r) => (r.data as any)?.data ?? r.data);

export const updateFranchise = (franchiseId: string, data: Partial<CreateFranchiseInput>) =>
  apiClient.patch<Franchise>(`/franchises/${franchiseId}`, data).then((r) => (r.data as any)?.data ?? r.data);

export const deleteFranchise = (franchiseId: string) =>
  apiClient.delete(`/franchises/${franchiseId}`).then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Roster
// ═══════════════════════════════════════════════════════════════════════

export const addRosterPlayer = (franchiseId: string, data: AddRosterPlayerInput) =>
  apiClient.post<FranchiseRoster>(`/franchises/${franchiseId}/roster`, data).then((r) => (r.data as any)?.data ?? r.data);

export const getRoster = (franchiseId: string, seasonId: string) =>
  apiClient.get<FranchiseRoster[]>(`/franchises/${franchiseId}/roster`, { params: { seasonId } }).then((r) => (r.data as any)?.data ?? r.data);

export const updateRosterEntry = (franchiseId: string, rosterId: string, data: Partial<AddRosterPlayerInput>) =>
  apiClient.patch<FranchiseRoster>(`/franchises/${franchiseId}/roster/${rosterId}`, data).then((r) => (r.data as any)?.data ?? r.data);

export const removeRosterPlayer = (franchiseId: string, rosterId: string) =>
  apiClient.delete(`/franchises/${franchiseId}/roster/${rosterId}`).then((r) => (r.data as any)?.data ?? r.data);

export const importRosterCSV = (franchiseId: string, seasonId: string, csvData: string) =>
  apiClient.post(`/franchises/${franchiseId}/roster/import`, { seasonId, csvData }).then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Groups
// ═══════════════════════════════════════════════════════════════════════

export const createGroups = (leagueId: string, seasonId: string, groupNames: string[]) =>
  apiClient.post<LeagueGroup[]>(`/leagues/${leagueId}/seasons/${seasonId}/groups`, { groupNames }).then((r) => (r.data as any)?.data ?? r.data);

export const getGroups = (leagueId: string, seasonId: string) =>
  apiClient.get<LeagueGroup[]>(`/leagues/${leagueId}/seasons/${seasonId}/groups`).then((r) => (r.data as any)?.data ?? r.data);

export const assignFranchisesToGroups = (
  leagueId: string,
  seasonId: string,
  groups: GroupAssignment[],
) =>
  apiClient
    .post(`/leagues/${leagueId}/seasons/${seasonId}/groups/assign`, { groups })
    .then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Ties (Phase 2 — stubs for now)
// ═══════════════════════════════════════════════════════════════════════

export const startLeaguePhase = (leagueId: string, seasonId: string) =>
  apiClient.post(`/leagues/${leagueId}/seasons/${seasonId}/start-league`).then((r) => (r.data as any)?.data ?? r.data);

export const getTies = (leagueId: string, seasonId: string, params?: { round?: string; franchiseId?: string }) =>
  apiClient.get<Tie[]>(`/leagues/${leagueId}/seasons/${seasonId}/ties`, { params }).then((r) => (r.data as any)?.data ?? r.data);

export const getTie = (tieId: string) =>
  apiClient.get<Tie>(`/ties/${tieId}`).then((r) => (r.data as any)?.data ?? r.data);

export const startTie = (tieId: string) =>
  apiClient.post(`/ties/${tieId}/start`).then((r) => (r.data as any)?.data ?? r.data);

export const completeTie = (tieId: string) =>
  apiClient.post(`/ties/${tieId}/complete`).then((r) => (r.data as any)?.data ?? r.data);

export const getTieScoreboard = (tieId: string) =>
  apiClient.get(`/ties/${tieId}/scoreboard`).then((r) => (r.data as any)?.data ?? r.data);

/**
 * Replace `oldPlayerId` with `newPlayerId` on the chosen side across every
 * still-scheduled match in this tie. In-progress and completed matches are
 * preserved. Auth: admin or the tie's assigned scorer (enforced server-side
 * via `verifyTieScoreAccess`).
 */
export const substitutePlayer = (
  tieId: string,
  body: { team: 'home' | 'away'; oldPlayerId: string; newPlayerId: string },
): Promise<{ updatedMatches: number; skippedMatches: number }> =>
  apiClient
    .post(`/ties/${tieId}/substitute`, body)
    .then((r) => (r.data as any)?.data ?? r.data);

/**
 * Admin-only: replace ONE player in ONE slot on ONE side. Updates the
 * tie_sheet always, and tie_match if locked + match not yet started.
 */
export const adminSwapSlotPlayer = (
  tieId: string,
  body: {
    team: 'home' | 'away';
    slotNumber: number;
    position: 'player1' | 'player2';
    newPlayerId: string;
  },
): Promise<{
  tieId: string;
  team: 'home' | 'away';
  slotNumber: number;
  position: 'player1' | 'player2';
  sheetUpdated: boolean;
  matchUpdated: boolean;
  matchSkipped: boolean;
  skipReason?: string;
}> =>
  apiClient
    .post(`/ties/${tieId}/admin-swap-slot-player`, body)
    .then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Tie Sheets (Phase 2)
// ═══════════════════════════════════════════════════════════════════════

export const submitTieSheet = (tieId: string, data: { franchiseId: string; lineupData: any[] }) =>
  apiClient.post<TieSheet>(`/ties/${tieId}/tie-sheet`, data).then((r) => (r.data as any)?.data ?? r.data);

export const getTieSheets = (tieId: string) =>
  apiClient.get<TieSheet[]>(`/ties/${tieId}/tie-sheet`).then((r) => (r.data as any)?.data ?? r.data);

export const approveTieSheet = (tieId: string, sheetId: string) =>
  apiClient.post(`/ties/${tieId}/tie-sheet/${sheetId}/approve`).then((r) => (r.data as any)?.data ?? r.data);

export const lockLineups = (tieId: string) =>
  apiClient.post(`/ties/${tieId}/lock-lineups`).then((r) => (r.data as any)?.data ?? r.data);

/** Admin: (re-)open the captain portal for this tie for `minutes` from now. */
export const openCaptainPortal = (tieId: string, minutes: number) =>
  apiClient
    .post(`/ties/${tieId}/open-captain-portal`, { minutes })
    .then((r) => (r.data as any)?.data ?? r.data);

/** SBPL: set the Kids submission deadline — absolute `deadline` (ISO) or open
 *  for `minutes` from now. Omit both to clear it. */
export const setKidsDeadline = (
  tieId: string,
  opts: { minutes?: number; deadline?: string | null },
) =>
  apiClient
    .post(`/ties/${tieId}/kids-deadline`, opts)
    .then((r) => (r.data as any)?.data ?? r.data);

/** SBPL: lock ONE category's games (e.g. 'kids') ahead of the rest of the tie. */
export const lockCategory = (tieId: string, category: string) =>
  apiClient
    .post(`/ties/${tieId}/lock-category`, { category })
    .then((r) => (r.data as any)?.data ?? r.data);

/** SBPL: reverse a category lock (only if none of its games have started). */
export const unlockCategory = (tieId: string, category: string) =>
  apiClient
    .post(`/ties/${tieId}/unlock-category`, { category })
    .then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Standings (Phase 2)
// ═══════════════════════════════════════════════════════════════════════

export const getStandings = (leagueId: string, seasonId: string) =>
  apiClient.get<LeagueStanding[]>(`/leagues/${leagueId}/seasons/${seasonId}/standings`).then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Knockout (Phase 3)
// ═══════════════════════════════════════════════════════════════════════

export const generateKnockout = (
  leagueId: string,
  seasonId: string,
  overrides?: {
    ab1?: string; ab2?: string; ab3?: string; ab4?: string;
    cd1?: string; cd2?: string; cd3?: string; cd4?: string;
  },
) =>
  apiClient.post(`/leagues/${leagueId}/seasons/${seasonId}/generate-knockout`, overrides || {}).then((r) => (r.data as any)?.data ?? r.data);

export const getKnockoutBracket = (leagueId: string, seasonId: string) =>
  apiClient.get<KnockoutBracketData>(`/leagues/${leagueId}/seasons/${seasonId}/knockout`).then((r) => (r.data as any)?.data ?? r.data);

export const resetKnockout = (leagueId: string, seasonId: string) =>
  apiClient.post(`/leagues/${leagueId}/seasons/${seasonId}/reset-knockout`).then((r) => (r.data as any)?.data ?? r.data);

/**
 * Full season reset — wipes ties, matches, standings, stats, fantasy picks.
 * Preserves league/season config, groups, rosters, admin/scorer grants.
 * Admin confirms destructive action before calling.
 */
export const resetSeason = (leagueId: string, seasonId: string) =>
  apiClient.post(`/leagues/${leagueId}/seasons/${seasonId}/reset-season`).then((r) => r.data as any);

/**
 * Reset a single COMPLETED league tie back to scheduled state. Used for
 * pre-tournament rehearsal so organizers can replay the same tie without
 * touching the rest of the season. Refused for knockout ties and
 * non-completed ties on the backend. Re-triggers standings + stats + fantasy
 * recalculations so the two teams' totals back out the tie's contribution.
 */
export const resetLeagueTie = (
  leagueId: string,
  seasonId: string,
  tieId: string,
): Promise<{ tieId: string; seasonId: string; matchesReset: number }> =>
  apiClient.post(`/leagues/${leagueId}/seasons/${seasonId}/ties/${tieId}/reset-tie`).then((r) => (r.data as any)?.data ?? r.data);

/**
 * Apply the official SPPL 2026 schedule (date / time / court) to every
 * league + knockout tie. Server reads from the rulebook PDF data baked
 * into `sppl-default-schedule.const.ts`. Returns counts + any unmatched
 * fixtures so the admin can verify nothing was missed.
 */
export const applyDefaultSchedule = (
  leagueId: string,
  seasonId: string,
): Promise<{
  leagueApplied: number;
  knockoutApplied: number;
  leagueUnmatched: string[];
  knockoutUnmatched: string[];
}> =>
  apiClient
    .post(`/leagues/${leagueId}/seasons/${seasonId}/apply-default-schedule`)
    .then((r) => {
      const body = r.data as any;
      // Service returns the result spread directly into the response body
      // (see tie.controller.ts), so unwrap defensively.
      return body?.data ?? body;
    });

// ═══════════════════════════════════════════════════════════════════════
// Default Lineups (fallback when captain misses deadline)
// ═══════════════════════════════════════════════════════════════════════

export const importDefaultLineupsCSV = (leagueId: string, seasonId: string, csvData: string) =>
  apiClient.post(`/leagues/${leagueId}/seasons/${seasonId}/default-lineups/import-csv`, { csvData }).then((r) => (r.data as any)?.data ?? r.data);

export const getAllDefaultLineups = (leagueId: string, seasonId: string) =>
  apiClient.get(`/leagues/${leagueId}/seasons/${seasonId}/default-lineups`).then((r) => (r.data as any)?.data ?? r.data);

export const getFranchiseDefaultLineups = (leagueId: string, seasonId: string, franchiseId: string) =>
  apiClient.get(`/leagues/${leagueId}/seasons/${seasonId}/default-lineups/${franchiseId}`).then((r) => (r.data as any)?.data ?? r.data);

export const setDefaultLineupSlot = (
  leagueId: string,
  seasonId: string,
  franchiseId: string,
  slot: number,
  player1Id: string,
  player2Id: string,
) =>
  apiClient
    .post(`/leagues/${leagueId}/seasons/${seasonId}/default-lineups/${franchiseId}/slot/${slot}`, {
      player1Id,
      player2Id,
    })
    .then((r) => (r.data as any)?.data ?? r.data);

export const autoApplyDefaultLineups = (leagueId: string, seasonId: string) =>
  apiClient.post(`/leagues/${leagueId}/seasons/${seasonId}/default-lineups/auto-apply`).then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Player Stats
// ═══════════════════════════════════════════════════════════════════════

export const getAllPlayerStats = (leagueId: string, seasonId: string) =>
  apiClient.get(`/leagues/${leagueId}/seasons/${seasonId}/player-stats`).then((r) => (r.data as any)?.data ?? r.data);

export const getPlayerStat = (leagueId: string, seasonId: string, playerId: string) =>
  apiClient.get(`/leagues/${leagueId}/seasons/${seasonId}/player-stats/${playerId}`).then((r) => (r.data as any)?.data ?? r.data);

export const getTopPerformers = (
  leagueId: string,
  seasonId: string,
  params?: { metric?: string; category?: string; limit?: number; stage?: string },
) =>
  apiClient
    .get(`/leagues/${leagueId}/seasons/${seasonId}/player-stats/top/performers`, { params })
    .then((r) => (r.data as any)?.data ?? r.data);

export const getLifetimeStats = (playerId: string) =>
  apiClient.get(`/players/${playerId}/lifetime-stats`).then((r) => (r.data as any)?.data ?? r.data);

export const getPlayerCareer = (playerId: string, include?: 'private') =>
  apiClient
    .get(`/players/${playerId}/career`, { params: include ? { include } : {} })
    .then((r) => (r.data as any)?.data ?? r.data);

export const getPlayerBasicInfo = (playerId: string) =>
  apiClient.get(`/players/${playerId}`).then((r) => (r.data as any)?.data ?? r.data);

export const getPlayerMatches = (playerId: string, opts?: { seasonId?: string; limit?: number }) =>
  apiClient
    .get(`/players/${playerId}/matches`, { params: opts })
    .then((r) => (r.data as any)?.data ?? r.data);

export const recalculatePlayerStats = (leagueId: string, seasonId: string) =>
  apiClient.post(`/leagues/${leagueId}/seasons/${seasonId}/player-stats/recalculate`).then((r) => (r.data as any)?.data ?? r.data);

/** Recalculate league standings — re-aggregates rally totals, match wins, etc. from all completed ties. */
export const recalculateStandings = (leagueId: string, seasonId: string) =>
  apiClient.post(`/leagues/${leagueId}/seasons/${seasonId}/recalculate`).then((r) => (r.data as any)?.data ?? r.data);

/** Backfill user.gender from roster category + optional teen CSV (for Teen-F/Teen-M split). */
export const backfillGender = (leagueId: string, seasonId: string, teenCsvData?: string) =>
  apiClient
    .post(`/leagues/${leagueId}/seasons/${seasonId}/backfill-gender`, { teenCsvData })
    .then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Scorers (league-scoped)
// ═══════════════════════════════════════════════════════════════════════

export const listScorers = (leagueId: string) =>
  apiClient.get(`/leagues/${leagueId}/scorers`).then((r) => (r.data as any)?.data ?? r.data);

export const addScorer = (leagueId: string, name: string, phone: string, pin = '') =>
  apiClient.post(`/leagues/${leagueId}/scorers`, { name, phone, pin }).then((r) => (r.data as any)?.data ?? r.data);

/** Recognise a phone before adding: { exists, name, hasPin, alreadyScorer }. */
export const lookupScorer = (leagueId: string, phone: string) =>
  apiClient
    .get(`/leagues/${leagueId}/scorers/lookup`, { params: { phone } })
    .then((r) => (r.data as any)?.data ?? r.data);

export const resetScorerPin = (leagueId: string, scorerUserId: string, pin: string) =>
  apiClient.post(`/leagues/${leagueId}/scorers/${scorerUserId}/reset-pin`, { pin }).then((r) => (r.data as any)?.data ?? r.data);

export const removeScorer = (leagueId: string, scorerUserId: string) =>
  apiClient.delete(`/leagues/${leagueId}/scorers/${scorerUserId}`).then((r) => (r.data as any)?.data ?? r.data);

export const sendScorerInvite = (leagueId: string, scorerUserId: string) =>
  apiClient.post(`/leagues/${leagueId}/scorers/${scorerUserId}/send-invite`, {}).then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// League Admins — co-organizers with operational powers
// ═══════════════════════════════════════════════════════════════════════

export type LeagueAdminRow = {
  id: string | null;
  userId: string;
  name: string;
  phone: string;
  isOwner: boolean;
  addedAt: string | null;
};

export const listLeagueAdmins = (leagueId: string): Promise<LeagueAdminRow[]> =>
  apiClient.get(`/leagues/${leagueId}/admins`).then((r) => (r.data as any)?.data ?? r.data);

export const addLeagueAdmin = (leagueId: string, name: string, phone: string) =>
  apiClient.post(`/leagues/${leagueId}/admins`, { name, phone }).then((r) => (r.data as any)?.data ?? r.data);

export const removeLeagueAdmin = (leagueId: string, adminUserId: string) =>
  apiClient.delete(`/leagues/${leagueId}/admins/${adminUserId}`).then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Tie config (admin) — court, time, points, games
// ═══════════════════════════════════════════════════════════════════════

export type TieConfigUpdate = {
  tieId: string;
  matchDay?: string;
  scheduledStart?: string;
  notes?: string; // free-text court label shown in the overlay footer
  pointsToWin?: number; // 11, 15, 21
  gamesPerMatch?: number; // 1, 3, 5
  /** Court number (1, 2, 3...) — drives persistent overlay URLs for streaming. null clears. */
  courtNumber?: number | null;
  /** Second court for two-court (SBPL) ties. null clears. */
  courtNumber2?: number | null;
  /** Optional 3rd/4th courts for a 4-court tie (e.g. the 3rd-place playoff). */
  courtNumber3?: number | null;
  courtNumber4?: number | null;
  /** Two authorized scorers for two-court (SBPL) ties. null to unassign. */
  scorer1Id?: string | null;
  scorer2Id?: string | null;
  /** Optional 3rd/4th scorers for a 4-court tie. null to unassign. */
  scorer3Id?: string | null;
  scorer4Id?: string | null;
  /** Manually set home/away team on a tie (used for knockout stage confirmations). null to clear. */
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  /** Assigned scorer userId. null to unassign. */
  scorerId?: string | null;
};

export const bulkUpdateTies = (_leagueId: string, updates: TieConfigUpdate[]) =>
  apiClient
    .post(`/ties/bulk-update`, { updates })
    .then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Admin match scoring (in-app score modal — TieDetailScreen)
// Mirrors scorer portal endpoints but authed via Firebase admin JWT.
// ═══════════════════════════════════════════════════════════════════════

/** Push an in-progress score. Overlay picks it up within ~3s. Match set to in_progress. */
export const adminLiveScore = (tieId: string, matchId: string, teamAScore: number, teamBScore: number) =>
  apiClient
    .post(`/ties/${tieId}/matches/${matchId}/live-score`, { teamAScore, teamBScore })
    .then((r) => (r.data as any)?.data ?? r.data);

/** Finalize a match with a manually-picked winner (score must be valid for scoringMode). */
export const adminFinalizeMatch = (
  tieId: string,
  matchId: string,
  teamAScore: number,
  teamBScore: number,
  winnerId: string,
) =>
  apiClient
    .post(`/ties/${tieId}/matches/${matchId}/finalize`, { teamAScore, teamBScore, winnerId })
    .then((r) => (r.data as any)?.data ?? r.data);

/** Persist the current serve state (config + events) so OBS overlays show server/receiver. Pass config=null to clear. */
export const adminSyncServe = (tieId: string, matchId: string, config: any | null, events: any[]) =>
  apiClient
    .post(`/ties/${tieId}/matches/${matchId}/serve-sync`, { config, events })
    .then((r) => (r.data as any)?.data ?? r.data);

/** Override (or clear) a single game's court. Pass null to revert to the rulebook default. */
export const adminSetMatchCourt = (tieId: string, matchId: string, courtNumber: number | null) =>
  apiClient
    .post(`/ties/${tieId}/matches/${matchId}/set-court`, { courtNumber })
    .then((r) => (r.data as any)?.data ?? r.data);

/** Emergency: declare winner at any score (forfeit/injury/decision). */
export const adminDeclareWinner = (
  tieId: string,
  matchId: string,
  winnerId: string,
  teamAScore = 0,
  teamBScore = 0,
) =>
  apiClient
    .post(`/ties/${tieId}/matches/${matchId}/declare-winner`, { winnerId, teamAScore, teamBScore })
    .then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════════════

export const sendCaptainPortalLinks = (leagueId: string) =>
  apiClient.post(`/leagues/${leagueId}/notify/captain-links`).then((r) => (r.data as any)?.data ?? r.data);

/** The logged-in user's captain team(s), matched by phone. Powers the home "Open Captain's Portal" tile. */
export const getMyCaptainTeams = (): Promise<{ leagueId: string; leagueName: string; franchiseId: string; franchiseName: string; url: string }[]> =>
  apiClient.get('/captain-portal/my-teams').then((r) => (r.data as any)?.teams ?? (r.data as any)?.data?.teams ?? []);

export const setCaptain = (franchiseId: string, captainName: string, captainPhone: string) =>
  apiClient.post(`/franchises/${franchiseId}/set-captain`, { captainName, captainPhone }).then((r) => (r.data as any)?.data ?? r.data);

export const sendCaptainLinkToOne = (franchiseId: string) =>
  apiClient.post(`/franchises/${franchiseId}/notify/captain-link`).then((r) => (r.data as any)?.data ?? r.data);

// Default-lineup deadline reminders — uses the dedicated DEFAULT_LINEUP_REMINDER
// template (Twilio HX57eb08…) but reuses the same {{3}}=captain token variable
// so the reminder lands the captain on the same portal page.
export const sendDefaultLineupReminderToOne = (franchiseId: string) =>
  apiClient
    .post(`/franchises/${franchiseId}/notify/default-lineup-reminder`)
    .then((r) => (r.data as any)?.data ?? r.data);

export const sendDefaultLineupReminders = (leagueId: string) =>
  apiClient
    .post(`/leagues/${leagueId}/notify/default-lineup-reminders`)
    .then((r) => (r.data as any)?.data ?? r.data);
