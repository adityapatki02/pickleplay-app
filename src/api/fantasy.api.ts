import apiClient from './client';

// ── Types ────────────────────────────────────────────────────────────────

export type FantasyConfig = {
  seasonId: string;
  deadline: string | null;
  locked: boolean;
  /** true = admin has paused scoring; leaderboard doesn't move even if matches complete. */
  fantasyFrozen: boolean;
  now: string;
  form2Shape: Record<string, number>; // bucket key → number of picks
};

export type FantasyRosterOption = {
  playerId: string;
  playerName: string;
  franchiseId: string;
  franchiseName: string;
  categorySlug: string;
};

export type FantasyOptions = Record<string, FantasyRosterOption[]>; // bucket → options

export type FantasyForm1 = {
  abQualifiers?: string[];
  cdQualifiers?: string[];
  semifinalists?: string[];
  finalists?: string[];
  champion?: string;
};

export type FantasyForm2 = {
  kids?: string[];
  teenBoys?: string;
  teenGirls?: string;
  m1?: string[];
  w1?: string[];
  m2?: string[];
  w2?: string[];
  m3?: string[];
};

export type FantasyEntry = {
  id: string;
  seasonId: string;
  userId: string;
  form1: FantasyForm1;
  form2: FantasyForm2;
  totalPoints: number;
  pointsBreakdown: null | {
    form1?: { bucket: string; earned: number; max: number }[];
    form2?: { playerId: string; playerName: string; category: string; earned: number }[];
    form1Total?: number;
    form2Total?: number;
  };
  submittedAt: string | null;
  lockedAt: string | null;
};

export type FantasyLeaderboardRow = {
  rank: number;
  userId: string;
  userName: string;
  totalPoints: number;
  submittedAt: string | null;
};

export type FantasyTrends = {
  totalEntries: number;
  abQualifiers: Array<{ franchiseId: string; franchiseName: string; count: number; pct: number }>;
  cdQualifiers: Array<{ franchiseId: string; franchiseName: string; count: number; pct: number }>;
  semifinalists: Array<{ franchiseId: string; franchiseName: string; count: number; pct: number }>;
  finalists: Array<{ franchiseId: string; franchiseName: string; count: number; pct: number }>;
  champions: Array<{ franchiseId: string; franchiseName: string; count: number; pct: number }>;
  topPicks: Record<string, Array<{ playerId: string; playerName: string; franchiseName: string | null; count: number; pct: number }>>;
};

// ── Calls ────────────────────────────────────────────────────────────────

const unwrap = (r: any) => (r.data as any)?.data ?? r.data;

export const getFantasyConfig = (seasonId: string): Promise<FantasyConfig> =>
  apiClient.get(`/fantasy/${seasonId}/config`).then(unwrap);

export const getFantasyOptions = (seasonId: string): Promise<FantasyOptions> =>
  apiClient.get(`/fantasy/${seasonId}/options`).then(unwrap);

export const getFantasyMyEntry = (seasonId: string): Promise<FantasyEntry> =>
  apiClient.get(`/fantasy/${seasonId}/my-entry`).then(unwrap);

export const upsertFantasyEntry = (
  seasonId: string,
  payload: { form1?: FantasyForm1; form2?: FantasyForm2 },
): Promise<FantasyEntry> =>
  apiClient.post(`/fantasy/${seasonId}/my-entry`, payload).then(unwrap);

export const getFantasyLeaderboard = (seasonId: string, limit = 100): Promise<FantasyLeaderboardRow[]> =>
  apiClient.get(`/fantasy/${seasonId}/leaderboard`, { params: { limit } }).then(unwrap);

export const getFantasyTrends = (seasonId: string): Promise<FantasyTrends> =>
  apiClient.get(`/fantasy/${seasonId}/trends`).then(unwrap);

/**
 * Admin export — every entry's picks resolved to franchise + player names.
 * Used by the organizer's CSV download on the fantasy leaderboard.
 */
export type FantasyAdminExportRow = {
  rank: number | null;
  userId: string;
  userName: string;
  userPhone: string | null;
  totalPoints: number;
  form1Total: number;
  form2Total: number;
  submittedAt: string | null;
  lockedAt: string | null;
  ab1: string; ab2: string; ab3: string; ab4: string;
  cd1: string; cd2: string; cd3: string; cd4: string;
  semifinalists: string;
  finalists: string;
  champion: string;
  kids: string;
  teenBoys: string;
  teenGirls: string;
  m1: string;
  w1: string;
  m2: string;
  w2: string;
  m3: string;
};

export type FantasyAdminExport = {
  seasonId: string;
  generatedAt: string;
  entries: FantasyAdminExportRow[];
};

export const getFantasyAdminExport = (seasonId: string): Promise<FantasyAdminExport> =>
  apiClient.get(`/fantasy/${seasonId}/admin-export`).then(unwrap);

export const recalculateFantasy = (seasonId: string): Promise<{ updatedEntries: number }> =>
  apiClient.post(`/fantasy/${seasonId}/recalculate`).then(unwrap);

export const setFantasyFrozen = (
  seasonId: string,
  frozen: boolean,
): Promise<{ seasonId: string; fantasyFrozen: boolean }> =>
  apiClient.post(`/fantasy/${seasonId}/set-frozen`, { frozen }).then(unwrap);
