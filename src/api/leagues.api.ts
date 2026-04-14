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

// ═══════════════════════════════════════════════════════════════════════
// Standings (Phase 2)
// ═══════════════════════════════════════════════════════════════════════

export const getStandings = (leagueId: string, seasonId: string) =>
  apiClient.get<LeagueStanding[]>(`/leagues/${leagueId}/seasons/${seasonId}/standings`).then((r) => (r.data as any)?.data ?? r.data);

// ═══════════════════════════════════════════════════════════════════════
// Knockout (Phase 3)
// ═══════════════════════════════════════════════════════════════════════

export const generateKnockout = (leagueId: string, seasonId: string) =>
  apiClient.post(`/leagues/${leagueId}/seasons/${seasonId}/generate-knockout`).then((r) => (r.data as any)?.data ?? r.data);

export const getKnockoutBracket = (leagueId: string, seasonId: string) =>
  apiClient.get<KnockoutBracketData>(`/leagues/${leagueId}/seasons/${seasonId}/knockout`).then((r) => (r.data as any)?.data ?? r.data);
