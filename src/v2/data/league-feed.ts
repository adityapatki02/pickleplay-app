/**
 * Public league feed from the Yoiden API: GET /api/v1/l/:slug/data.
 * One call returns the season, standings, every tie with game-by-game scores
 * and the player table. No auth; CORS is open.
 */

// The app build can point at another API (EXPO_PUBLIC_API_URL, e.g. a local one); the website copy uses prod.
export const API_BASE = process.env.EXPO_PUBLIC_API_URL || "https://yoiden-api-lonnxhto7a-el.a.run.app/api/v1";

export type FeedTeam = { id: string; name: string; shortName: string; color: string | null };

export type FeedGame = {
  slot: number;
  category: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  sets: { a: number; b: number }[];
  homePair: string[];
  awayPair: string[];
  homeScore: number | null;
  awayScore: number | null;
  pointValue: number;
  /** Win-margin bonus earned in this game. */
  homeBonus: number;
  awayBonus: number;
  /** Which side called its powerplay on this game, and the points it earned (+ won, − lost). */
  homePP: boolean;
  awayPP: boolean;
  homePPPts: number;
  awayPPPts: number;
};

export type FeedTie = {
  id: string;
  round: string;
  matchDay: string | null;
  scheduledStart: string | null;
  status: "scheduled" | "in_progress" | "completed";
  court: number | null;
  home: FeedTeam;
  away: FeedTeam;
  homeGames: number;
  awayGames: number;
  /** Everything on top of game points: win-margin bonus + powerplay points. */
  homeBonus: number;
  awayBonus: number;
  homeWon: number;
  awayWon: number;
  gamesDecided: number;
  gamesTotal: number;
  winnerId: string | null;
  games: FeedGame[];
};

export type FeedStandingRow = {
  rank: number;
  team: FeedTeam;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  pointsFor: number;
  pointsAgainst: number;
  tiePoints: number;
  qualified: boolean;
  note: string | null;
};

export type FeedPlayer = {
  name: string;
  team: FeedTeam;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type FeedSquad = {
  team: FeedTeam;
  pool: string | null;
  players: { name: string; grade?: string | null; captain?: boolean }[];
};

export type LeagueFeed = {
  league: { name: string; slug: string };
  season: {
    id: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
    format: string | null;
    pointsTo: number | null;
  };
  /** True when tie scores are points (games + bonus), not games won. */
  tiePoints: boolean;
  /** Points for winning / losing a powerplay game (0 when the league has no powerplays). */
  powerplayPoints: number;
  powerplayLossPoints: number;
  streamLinks: Record<string, string> | null;
  groups: { name: string; rows: FeedStandingRow[] }[];
  ties: FeedTie[];
  players: FeedPlayer[];
  squads: FeedSquad[] | null;
};

/** Seconds a server-rendered event page may reuse the feed before refetching. */
export const SERVER_REVALIDATE = 60;

/**
 * Browser calls go straight to the API (fresh). Server calls (page render) are cached for
 * SERVER_REVALIDATE seconds so search engines get full HTML without hammering the API.
 */
export async function fetchLeague(slug: string, opts: { server?: boolean } = {}): Promise<LeagueFeed> {
  const res = await fetch(
    `${API_BASE}/l/${encodeURIComponent(slug)}/data`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`League feed ${slug}: HTTP ${res.status}`);
  return trimLeague(await res.json());
}

/** Stand-in for a knockout side that isn't known yet (unique id, so it never matches a real team). */
const tbd = (tieId: string, side: "home" | "away"): FeedTeam => ({
  id: `tbd-${tieId}-${side}`,
  name: "To be decided",
  shortName: "TBD",
  color: null,
});

/** Drop feed fields the pages never read, so less data is embedded in each page. */
function trimLeague(raw: LeagueFeed & Record<string, unknown>): LeagueFeed {
  const { league, season, tiePoints, powerplayPoints, powerplayLossPoints, streamLinks, groups, ties, players, squads } = raw;
  return {
    league,
    season,
    tiePoints,
    powerplayPoints: powerplayPoints ?? 0,
    powerplayLossPoints: powerplayLossPoints ?? 0,
    streamLinks,
    groups,
    players,
    squads,
    ties: ties.map((t) => ({
      ...t,
      // Knockout ties come without teams until the draw fills them in.
      home: t.home ?? tbd(t.id, "home"),
      away: t.away ?? tbd(t.id, "away"),
      games: t.games.map((g) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { homeRoles, awayRoles, serviceCourt, ...keep } = g as FeedGame & Record<string, unknown>;
        return keep as FeedGame;
      }),
    })),
  };
}

/** Load every division of an event on the server; null if the API is unreachable (the page then loads in the browser). */
export async function fetchLeaguesServer(slugs: string[]): Promise<LeagueFeed[] | null> {
  try {
    return await Promise.all(slugs.map((s) => fetchLeague(s, { server: true })));
  } catch {
    return null;
  }
}

// ── Display helpers ──────────────────────────────────────────────────────

/** "league_week_2" → "League · Week 2", "knockout_sf1" → "Semi-final 1". */
export function roundLabel(round: string): string {
  const r = round.toLowerCase();
  const week = r.match(/^league_week_(\d+)$/);
  if (week) return `League · Week ${week[1]}`;
  const ko = r.replace(/^knockout_/, "");
  const map: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^qf(\d*)$/, (m) => `Quarter-final ${m[1]}`.trim()],
    [/^sf(\d*)$/, (m) => `Semi-final ${m[1]}`.trim()],
    [/^final$/, () => "Final"],
    [/^third_place$/, () => "Third place"],
    [/^eliminator$/, () => "Eliminator"],
    [/^q(\d)$/, (m) => `Qualifier ${m[1]}`],
  ];
  for (const [re, fn] of map) {
    const m = ko.match(re);
    if (m) return fn(m);
  }
  return round.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const isKnockout = (round: string) => round.toLowerCase().startsWith("knockout");

/** Short category codes ("aa", "bc") read as grades; everything else is title-cased. */
export function categoryLabel(cat: string): string {
  if (/^[a-e]{2}$/i.test(cat)) return cat.toUpperCase();
  if (cat.toLowerCase() === "aplus") return "A+";
  const split = cat.match(/^([a-z]+)([A-Z0-9].*)$/);
  const text = split ? `${split[1]} ${split[2]}` : cat;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Total rally points each side scored across a tie. */
export function tieRallies(t: FeedTie): [number, number] {
  let h = 0;
  let a = 0;
  for (const g of t.games) for (const x of g.sets) {
    h += x.a;
    a += x.b;
  }
  return [h, a];
}

export type ScoreMode = "tiePoints" | "games" | "points";

/**
 * What decides a tie in this league: tie points (games + bonus), games won, or
 * total points scored (e.g. MCA). Points mode is used when the league's format
 * says so, or when any result was won by the side with fewer games.
 */
export function scoreModeOf(feed: Pick<LeagueFeed, "tiePoints" | "ties" | "season">): ScoreMode {
  if (feed.tiePoints) return "tiePoints";
  if (feed.season.format === "mca_5doubles") return "points";
  const byPoints = feed.ties.some((t) => {
    if (t.status !== "completed" || !t.winnerId || t.homeWon === t.awayWon) return false;
    return (t.homeWon > t.awayWon) !== (t.winnerId === t.home.id);
  });
  return byPoints ? "points" : "games";
}

/** The headline tie score, in whatever decides the tie in this league. */
export function tieScore(feed: Pick<LeagueFeed, "tiePoints" | "ties" | "season">, t: FeedTie): [number, number] {
  const mode = scoreModeOf(feed);
  if (mode === "tiePoints") return [t.homeGames + t.homeBonus, t.awayGames + t.awayBonus];
  if (mode === "points") return tieRallies(t);
  return [t.homeWon, t.awayWon];
}

export function gameWinner(g: FeedGame): "home" | "away" | null {
  if (g.status !== "completed") return null;
  let h = 0;
  let a = 0;
  for (const s of g.sets) {
    if (s.a > s.b) h++;
    else if (s.b > s.a) a++;
  }
  if (h === a) return null;
  return h > a ? "home" : "away";
}

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { ...IST, hour: "numeric", minute: "2-digit" });
}

export function formatDay(isoOrDate: string | null): string {
  if (!isoOrDate) return "";
  const d = isoOrDate.length === 10 ? new Date(`${isoOrDate}T12:00:00+05:30`) : new Date(isoOrDate);
  return d.toLocaleDateString("en-IN", { ...IST, weekday: "short", day: "numeric", month: "short" });
}

/** The game being played right now in a tie, if any. */
export const liveGame = (t: FeedTie) => t.games.find((g) => g.status === "in_progress") ?? null;

export const teamInitials = (t: FeedTeam) =>
  t.shortName && t.shortName.length <= 4
    ? t.shortName.toUpperCase()
    : t.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

/**
 * Events sometimes end with a tie still marked in progress (nobody closed it).
 * Once the event's dates have passed, show such ties as results: the side with
 * a majority of games wins; otherwise the tie stays without a winner.
 */
export function settleStaleTies(feed: LeagueFeed): LeagueFeed {
  return {
    ...feed,
    ties: feed.ties.map((t) => {
      if (t.status !== "in_progress") return t;
      const need = Math.floor(t.gamesTotal / 2) + 1;
      const winnerId = t.homeWon >= need ? t.home.id : t.awayWon >= need ? t.away.id : null;
      return {
        ...t,
        status: "completed",
        winnerId,
        games: t.games.map((g) => (g.status === "in_progress" ? { ...g, status: "cancelled" } : g)),
      };
    }),
  };
}

/** Stage order for sorting: league weeks, then QFs, qualifiers, SFs, third place, final. */
export function roundOrder(round: string): number {
  const r = round.toLowerCase();
  const n = (re: RegExp) => Number(r.match(re)?.[1] ?? 0);
  if (r.startsWith("league_week_")) return n(/(\d+)$/);
  if (/knockout_qf/.test(r)) return 100 + n(/qf(\d+)/);
  if (r === "knockout_q1") return 110;
  if (r === "knockout_eliminator") return 111;
  if (r === "knockout_q2") return 112;
  if (/knockout_sf/.test(r)) return 120 + n(/sf(\d+)/);
  if (r === "knockout_third_place") return 130;
  if (r === "knockout_final") return 140;
  return 50;
}

export type BreakupRow = { label: string; home: number; away: number; signed?: boolean; total?: boolean; muted?: boolean };

/**
 * How a tie score is made up, for leagues that count tie points: points from
 * games won, bonus points, powerplay points, the total, plus games won and
 * rallies won for context. Bonus and powerplay rows only appear when used.
 */
export function tieBreakup(feed: LeagueFeed, t: FeedTie): BreakupRow[] {
  const sum = (f: (g: FeedGame) => number) => t.games.reduce((s, g) => s + f(g), 0);
  const ppH = sum((g) => g.homePPPts ?? 0);
  const ppA = sum((g) => g.awayPPPts ?? 0);
  const bonusH = t.homeBonus - ppH;
  const bonusA = t.awayBonus - ppA;
  const hasPP = feed.powerplayPoints > 0 || t.games.some((g) => g.homePP || g.awayPP);
  const rally = (side: "a" | "b") => sum((g) => g.sets.reduce((s, x) => s + x[side], 0));
  const rows: BreakupRow[] = [{ label: "Game points", home: t.homeGames, away: t.awayGames }];
  if (bonusH || bonusA || !hasPP) rows.push({ label: "Bonus", home: bonusH, away: bonusA, signed: true });
  if (hasPP) rows.push({ label: "Powerplay", home: ppH, away: ppA, signed: true });
  rows.push({ label: "Tie points", home: t.homeGames + t.homeBonus, away: t.awayGames + t.awayBonus, total: true });
  rows.push({ label: "Games won", home: t.homeWon, away: t.awayWon, muted: true });
  rows.push({ label: "Rallies won", home: rally("a"), away: rally("b"), muted: true });
  return rows;
}
