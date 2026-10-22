/**
 * Player pages are per event: a player is a name within one team in one event (we don't yet
 * know who is the same person across events). Their matches come from the game pairs in the
 * league feed, which use the same names as the player table.
 */
import { gameWinner, type FeedGame, type FeedPlayer, type FeedTeam, type FeedTie, type LeagueFeed } from "./league-feed";

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** "Harsh Verma" in "Leonard Mavericks" → "harsh-verma-leonard-mavericks". Unique within an event. */
export const playerSlug = (p: { name: string; team: FeedTeam }) => `${slugify(p.name)}-${slugify(p.team.name)}`;

export const playerPath = (eventId: string, p: { name: string; team: FeedTeam }) =>
  `/events/${eventId}/player/${playerSlug(p)}`;

/** Placeholder names the scorers use before a lineup is in. */
export const isRealName = (n: string) => !!n && !/^(tbd|tba|-+|\?)$/i.test(n.trim());

/** Same order as the event's Players tab: wins, then point difference, then name. */
export function rankPlayers(players: FeedPlayer[]): FeedPlayer[] {
  return [...players].sort(
    (a, b) =>
      b.won - a.won || b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) || a.name.localeCompare(b.name),
  );
}

/** A player from the stats table, or from a squad list if they haven't played yet. */
export function findPlayer(feeds: LeagueFeed[], slug: string): { feed: LeagueFeed; player: FeedPlayer } | null {
  for (const feed of feeds) {
    const player = feed.players.find((p) => playerSlug(p) === slug);
    if (player) return { feed, player };
    for (const sq of feed.squads ?? []) {
      const m = sq.players.find((p) => playerSlug({ name: p.name, team: sq.team }) === slug);
      if (m) return { feed, player: { name: m.name, team: sq.team, played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0 } };
    }
  }
  return null;
}

export type PlayerGame = {
  tie: FeedTie;
  game: FeedGame;
  side: "home" | "away";
  opponent: FeedTeam;
  partners: string[];
  opponents: string[];
  result: "won" | "lost" | null;
};

/** Every game this player took part in, in the order the ties appear in the feed. */
export function playerGames(feed: LeagueFeed, p: FeedPlayer): PlayerGame[] {
  const out: PlayerGame[] = [];
  if (!p.team) return out;
  for (const tie of feed.ties) {
    if (!tie.home || !tie.away) continue;
    const side = tie.home.id === p.team.id ? "home" : tie.away.id === p.team.id ? "away" : null;
    if (!side) continue;
    for (const game of tie.games) {
      const mine = side === "home" ? game.homePair : game.awayPair;
      if (!mine.includes(p.name)) continue;
      const w = gameWinner(game);
      out.push({
        tie,
        game,
        side,
        opponent: side === "home" ? tie.away : tie.home,
        partners: mine.filter((n) => n !== p.name && isRealName(n)),
        opponents: (side === "home" ? game.awayPair : game.homePair).filter(isRealName),
        result: game.status === "completed" && w ? (w === side ? "won" : "lost") : null,
      });
    }
  }
  return out;
}

export type GameStats = { played: number; won: number; lost: number; diff: number; winPct: number };

/** Played / won / lost / point difference counted from finished games (matches the player page list). */
export function gameStats(games: PlayerGame[]): GameStats {
  const done = games.filter((g) => g.result);
  const won = done.filter((g) => g.result === "won").length;
  const diff = done.reduce(
    (n, g) => n + g.game.sets.reduce((m, st) => m + (g.side === "home" ? st.a - st.b : st.b - st.a), 0),
    0,
  );
  return {
    played: done.length,
    won,
    lost: done.length - won,
    diff,
    winPct: done.length ? Math.round((won / done.length) * 100) : 0,
  };
}
