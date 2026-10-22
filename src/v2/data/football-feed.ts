/**
 * Public football feed from the Yoiden API: GET /api/v1/fb/:slug/data. Football events live in
 * their own tables (football_*), so they get this feed instead of the league one: teams, every
 * match with its goals, the group tables and the scorers list. No auth; CORS is open.
 */
import { API_BASE } from "./league-feed";

export type FbPhase = "pre" | "1h" | "ht" | "2h" | "ft";

export type FbTeam = { id: string; name: string; division: string; groupCode: string | null };
export type FbPlayer = { id: string; teamId: string; name: string; jersey: number | null };

export type FbGoal = {
  id: string;
  teamId: string;
  playerId: string | null;
  player: string | null;
  minute: number;
  addedMinute: number | null;
  ownGoal: boolean;
  penalty: boolean;
};

export type FbMatch = {
  id: string;
  code: string;
  stage: "group" | "qf" | "sf" | "elim" | "final" | string;
  division: string;
  groupCode: string | null;
  turf: number | null;
  startsAt: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeLabel: string;
  awayLabel: string;
  phase: FbPhase | string;
  homeScore: number;
  awayScore: number;
  homePens: number | null;
  awayPens: number | null;
  /** Set when the organiser picked a result: "home" | "away" | "draw" | "wo_h" | "wo_a" (walkover). */
  result: string | null;
  winnerTeamId: string | null;
  goals: FbGoal[];
};

export type FbTableRow = {
  teamId: string;
  name: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
};

export type FootballFeed = {
  event: {
    slug: string;
    name: string;
    presenter: string | null;
    matchDate: string | null;
    halfMinutes: number;
    settings: { teamColors?: Record<string, string>; awards?: Record<string, string> };
  };
  teams: FbTeam[];
  players: FbPlayer[];
  matches: FbMatch[];
  tables: { code: string; division: string; complete: boolean; rows: FbTableRow[] }[];
  scorers: { playerId: string; name: string; teamId: string; team: string; division: string; goals: number }[];
};

export async function fetchFootball(slug: string, opts: { server?: boolean } = {}): Promise<FootballFeed> {
  const res = await fetch(
    `${API_BASE}/fb/${encodeURIComponent(slug)}/data`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Football feed ${slug}: HTTP ${res.status}`);
  const raw = await res.json();
  const d = (raw.data ?? raw) as FootballFeed;
  return { event: d.event, teams: d.teams, players: d.players, matches: d.matches, tables: d.tables, scorers: d.scorers };
}

export async function fetchFootballServer(slug: string): Promise<FootballFeed | null> {
  try {
    return await fetchFootball(slug, { server: true });
  } catch {
    return null;
  }
}

// ── Display helpers ──────────────────────────────────────────────────────

export const isLiveMatch = (m: FbMatch) => m.phase === "1h" || m.phase === "ht" || m.phase === "2h";
export const isDone = (m: FbMatch) => m.phase === "ft";

const STAGE: Record<string, string> = {
  group: "Group",
  qf: "Quarter-final",
  sf: "Semi-final",
  elim: "Knock-off",
  final: "Final",
};

/** "Group A", "Semi-final", "Women's Final"… */
export function stageLabel(m: FbMatch, divisions: number): string {
  const base = m.stage === "group" ? `Group ${m.groupCode ?? ""}`.trim() : (STAGE[m.stage] ?? m.stage);
  return divisions > 1 ? `${divLabel(m.division)} · ${base}` : base;
}

export const divLabel = (d: string) => (d === "women" ? "Women" : d === "men" ? "Men" : d.charAt(0).toUpperCase() + d.slice(1));

export function phaseLabel(m: FbMatch): string {
  switch (m.phase) {
    case "1h":
      return "1st half";
    case "ht":
      return "Half-time";
    case "2h":
      return "2nd half";
    case "ft":
      return m.result?.startsWith("wo") ? "Walkover" : m.homePens != null ? "FT · penalties" : "Full time";
    default:
      return "Upcoming";
  }
}

export const minuteText = (g: FbGoal) => (g.addedMinute ? `${g.minute}+${g.addedMinute}'` : `${g.minute}'`);

export const teamColor = (feed: FootballFeed, teamId: string | null) =>
  (teamId && feed.event.settings?.teamColors?.[teamId]) || null;

/** Knockout order for grouping on the page: final first. */
export const STAGE_ORDER: Record<string, number> = { final: 0, sf: 1, elim: 2, qf: 3, group: 4 };

/** The finals of each division (the men's final is "F", the women's "WF"). */
export const finals = (feed: FootballFeed) => feed.matches.filter((m) => m.stage === "final");
