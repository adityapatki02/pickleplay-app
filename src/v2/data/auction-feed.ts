/**
 * Public auction feed from the auction server: GET /api/v1/auctions/portal/:token/data
 * with the board (display) token. Same data the big-screen board reads: teams,
 * categories and every player with sold price and buying team. CORS is open.
 */

/** Override with NEXT_PUBLIC_AUCTION_BASE (e.g. http://localhost:3001) to test against a local auction server. */
export const AUCTION_BASE = "https://auction.yoiden.com";

export type AuctionTeam = {
  id: string;
  name: string;
  color: string | null;
  logoUrl: string | null;
  ownerName: string | null;
};

export type AuctionCategory = { slug: string; label: string; quota: number; max: number; base: number; order: number };

export type AuctionPlayer = {
  id: string;
  name: string;
  cat: string;
  base: number;
  status: "sold" | "unsold" | "available" | string;
  soldTo: string | null;
  soldPrice: number | null;
  /** Epoch ms of the sale (for "recent sales"). */
  soldAt?: number | null;
  photo?: string | null;
  sports?: { sport: string; level?: string }[];
};

export type AuctionFeed = {
  auctionId: string;
  name: string;
  currentPlayerId: string | null;
  queue: string[];
  purse: number;
  squadSize: number;
  teams: AuctionTeam[];
  categories: AuctionCategory[];
  players: AuctionPlayer[];
};

export async function fetchAuction(token: string, opts: { server?: boolean } = {}): Promise<AuctionFeed> {
  const res = await fetch(
    `${AUCTION_BASE}/api/v1/auctions/portal/${encodeURIComponent(token)}/data`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Auction feed: HTTP ${res.status}`);
  return trimAuction(await res.json());
}

/** Keep only what the pages show (no photos/stats/sports blobs) so less data is embedded per page. */
function trimAuction(raw: AuctionFeed & Record<string, unknown>): AuctionFeed {
  return {
    auctionId: raw.auctionId,
    name: raw.name,
    currentPlayerId: raw.currentPlayerId ?? null,
    queue: [],
    purse: raw.purse,
    squadSize: raw.squadSize,
    teams: raw.teams,
    categories: raw.categories,
    players: raw.players.map((p) => ({
      id: p.id,
      name: p.name,
      cat: p.cat,
      base: p.base,
      status: p.status,
      soldTo: p.soldTo,
      soldPrice: p.soldPrice,
      soldAt: p.soldAt ?? null,
    })),
  };
}

/** Load every division of an auction on the server; null if the auction host is unreachable. */
export async function fetchAuctionsServer(tokens: string[]): Promise<AuctionFeed[] | null> {
  try {
    return await Promise.all(tokens.map((t) => fetchAuction(t, { server: true })));
  } catch {
    return null;
  }
}

/** Team logos come back either absolute or as /api/... paths on the auction host. */
export const teamLogo = (t: AuctionTeam) =>
  !t.logoUrl ? null : t.logoUrl.startsWith("http") ? t.logoUrl : `${AUCTION_BASE}${t.logoUrl}`;

/** ₹ in Indian units: 4,20,00,000 → "₹4.2 Cr", 7,00,000 → "₹7 L", 52,000 → "₹52,000". */
export function formatMoney(n: number | null | undefined): string {
  if (n == null) return "–";
  const trim = (x: number) => x.toFixed(2).replace(/\.?0+$/, "");
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export const soldPlayers = (f: AuctionFeed) => f.players.filter((p) => p.status === "sold" && p.soldTo);

export function teamSummary(f: AuctionFeed) {
  const sold = soldPlayers(f);
  return f.teams.map((team) => {
    const squad = sold.filter((p) => p.soldTo === team.id).sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0));
    const spent = squad.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
    return { team, squad, spent, left: f.purse - spent };
  });
}

export const catLabel = (f: AuctionFeed, slug: string) => f.categories.find((c) => c.slug === slug)?.label ?? slug;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
