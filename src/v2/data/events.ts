/**
 * Every event and auction shown on the site. Edit this file to add an event —
 * nothing else needs to change.
 *
 * Live / upcoming / past is worked out from `start`/`end` at view time, so an
 * event moves from "Upcoming" to "Live" to "Past" on its own. Dates are IST.
 *
 * Counts for leagues, cups and indoor games come from the production DB
 * (19 Oct 2026). Auction counts come from the auction site's auctions.json and
 * project notes.
 */

export type Sport =
  | "Pickleball"
  | "Badminton"
  | "Football"
  | "Cricket"
  | "Indoor games"
  | "Multi-sport";

export type EventKind = "league" | "tournament" | "cup" | "indoor" | "auction";

export type YoidenEvent = {
  id: string;
  name: string;
  /** Short label used on the initials tile when there is no logo. */
  initials: string;
  sport: Sport;
  kind: EventKind;
  city: string;
  /** ISO date (yyyy-mm-dd). Omit when unknown — the card then shows `when`. */
  start?: string;
  end?: string;
  /** Free-text date for events without exact dates. */
  when?: string;
  logo?: string;
  /** Logo drawn in white: shown on a navy tile. */
  logoOnDark?: boolean;
  url?: string;
  /**
   * Yoiden league slugs (GET /l/:slug/data). When set, the event gets its own
   * page on this site at /events/<id>; several slugs = divisions (men's, women's…).
   */
  leagues?: { slug: string; label: string }[];
  /** Football event slug (GET /fb/:slug/data). When set, the event gets its own page at /events/<id>. */
  football?: string;
  /** Auction board (display) tokens. When set, the auction gets its own page at /events/<id>. */
  auctions?: { token: string; label: string }[];
  /** Recorded or live streams (YouTube links), shown as playable videos on the event page. */
  videos?: { title: string; url: string }[];
  /** Venue line for the event page. */
  venue?: string;
  /** Short facts shown on the card, e.g. ["16 teams", "40 ties"]. */
  facts: string[];
  /** Numbers that feed the totals band. */
  teams?: number;
  players?: number;
  matches?: number;
};

export const EVENTS: YoidenEvent[] = [
  // ── Upcoming ───────────────────────────────────────────────────────────
  {
    id: "mbl-kids-2026",
    name: "MSCA Badminton League 2026 · Kids",
    initials: "MBL",
    sport: "Badminton",
    kind: "league",
    city: "Mumbai",
    start: "2026-10-22",
    logo: "/events/msca.png",
    url: "https://mbl-kids.yoiden.com",
    leagues: [{ slug: "msca-kids-2026", label: "Kids" }],
    facts: ["3 teams", "Kids league"],
    teams: 3,
  },
  {
    id: "ashmavir-auction-s11",
    name: "Ashmavir Cup S11 · Player Auction",
    initials: "AC",
    sport: "Cricket",
    kind: "auction",
    city: "Mumbai",
    start: "2026-11-01",
    url: "https://ashmavir.yoiden.com",
    facts: ["Men & women", "Season 11"],
  },
  {
    id: "cns-pickleball-2026",
    name: "CNS Parents' Pickleball",
    initials: "CNS",
    sport: "Pickleball",
    kind: "tournament",
    city: "Mumbai",
    start: "2026-11-21",
    end: "2026-11-22",
    logo: "/events/cns.png",
    url: "https://cns-pickleball.yoiden.com",
    facts: ["225 players", "Sold out"],
    players: 225,
  },
  {
    id: "boa-s3-tournament",
    name: "BOA Box Cricket S3",
    initials: "BOA",
    sport: "Cricket",
    kind: "tournament",
    city: "Mumbai",
    start: "2026-11-22",
    logo: "/events/boa.png",
    url: "https://boa.yoiden.com",
    facts: ["12 teams", "Ophthalmologists' league"],
  },
  {
    id: "makabo-2026",
    name: "MaKaBo Premier League",
    initials: "MK",
    sport: "Cricket",
    kind: "league",
    city: "Mumbai",
    start: "2026-11-29",
    logo: "/events/makabo.png",
    logoOnDark: true,
    url: "https://makabo.yoiden.com",
    facts: ["Business cricket"],
  },
  {
    id: "ashmavir-cup-s11",
    name: "Ashmavir Cup S11",
    initials: "AC",
    sport: "Cricket",
    kind: "tournament",
    city: "Mumbai",
    start: "2026-12-18",
    end: "2026-12-19",
    url: "https://ashmavir.yoiden.com",
    facts: ["Season 11"],
  },

  // ── Past events ────────────────────────────────────────────────────────
  {
    id: "nmfc-2026",
    football: "nmfc-2026",
    name: "Navi Mumbai Football Cup",
    initials: "NMFC",
    sport: "Football",
    kind: "cup",
    city: "Navi Mumbai",
    start: "2026-10-11",
    logo: "/events/nmfc.png",
    url: "https://nmfc.yoiden.com",
    facts: ["8 teams", "16 matches", "74 goals"],
    teams: 8,
    matches: 16,
  },
  {
    id: "afl-2026",
    football: "afl-2026",
    name: "Ajanta Football League",
    initials: "AFL",
    sport: "Football",
    kind: "league",
    city: "Mumbai",
    start: "2026-10-10",
    logo: "/events/afl.png",
    url: "https://afl.yoiden.com",
    facts: ["23 teams", "51 matches", "86 goals"],
    teams: 23,
    matches: 51,
  },
  {
    id: "skycity-mini-2",
    leagues: [{ slug: "skycity-mini-2-men-159b1a", label: "Men" }, { slug: "skycity-mini-2-women-a1585d", label: "Women" }],
    name: "SkyCity Mini Pickleball 2",
    initials: "SC",
    sport: "Pickleball",
    kind: "league",
    city: "Mumbai",
    start: "2026-10-04",
    url: "https://skycity.yoiden.com",
    facts: ["Men's & women's", "14 teams", "32 ties"],
    teams: 14,
    matches: 32,
  },
  {
    id: "cbbl-2026",
    leagues: [{ slug: "cbbl-2026-289d7e", label: "Open" }, { slug: "cbbl-seniors-2026-a7dbbc", label: "Seniors" }],
    name: "Crescent Bay Badminton League",
    initials: "CBBL",
    sport: "Badminton",
    kind: "league",
    city: "Mumbai",
    start: "2026-10-01",
    end: "2026-10-04",
    logo: "/events/cbbl.png",
    url: "https://cbbl.yoiden.com",
    facts: ["17 teams", "39 ties", "Incl. seniors"],
    teams: 17,
    matches: 39,
  },
  {
    id: "picklelabs-league",
    leagues: [{ slug: "labs-league-s1-e8062e", label: "League" }],
    name: "Pickle Labs League",
    initials: "PL",
    sport: "Pickleball",
    kind: "league",
    city: "Chhatrapati Sambhajinagar",
    start: "2026-09-20",
    logo: "/events/picklelabs.png",
    url: "https://pl.yoiden.com",
    facts: ["5 teams", "13 ties"],
    teams: 5,
    matches: 13,
  },
  {
    id: "mca-bkc-2026",
    leagues: [{ slug: "mca-bkc-2026-d474ae", label: "League" }],
    name: "MCA BKC Members Badminton",
    initials: "MCA",
    sport: "Badminton",
    kind: "tournament",
    city: "Mumbai",
    start: "2026-08-29",
    end: "2026-08-30",
    url: "https://mca.yoiden.com",
    facts: ["5 teams", "13 ties"],
    teams: 5,
    matches: 13,
  },
  {
    id: "hpsl-games",
    name: "HPSL Games",
    initials: "HPSL",
    sport: "Indoor games",
    kind: "indoor",
    city: "Mumbai",
    when: "Aug 2026",
    logo: "/events/hpsl.png",
    facts: ["TT · Chess · Carrom", "7 franchises", "54 entrants"],
    players: 54,
  },
  {
    id: "csn-open",
    name: "CSN Open",
    initials: "CSN",
    sport: "Pickleball",
    kind: "tournament",
    city: "Mumbai",
    start: "2026-08-09",
    facts: ["DUPR-rated", "Online payments"],
  },
  {
    id: "sbpl-s2",
    leagues: [{ slug: "sbpl-s2-148b9a", label: "League" }],
    name: "Sky City Badminton Premier League S2",
    initials: "SBPL",
    sport: "Badminton",
    kind: "league",
    city: "Mumbai",
    start: "2026-07-31",
    end: "2026-08-02",
    logo: "/events/sbpl.png",
    url: "https://sbpl.yoiden.com",
    facts: ["16 teams", "40 ties", "480 players"],
    teams: 16,
    players: 480,
    matches: 40,
  },
  {
    id: "skycity-mini-1",
    leagues: [{ slug: "21st-june-mumbai-league-test-mqgj8gz3", label: "League" }],
    name: "SkyCity Mini Pickleball",
    initials: "SC",
    sport: "Pickleball",
    kind: "league",
    city: "Mumbai",
    start: "2026-06-21",
    url: "https://mumbaiopen.yoiden.com",
    facts: ["8 teams", "19 ties"],
    teams: 8,
    matches: 19,
  },
  {
    id: "west-zone-2026",
    name: "1st West Zone Pickleball Championship",
    initials: "WZ",
    sport: "Pickleball",
    kind: "tournament",
    city: "Pune",
    start: "2026-05-29",
    end: "2026-05-31",
    facts: ["378 entries", "40 categories", "203 matches"],
    players: 378,
    matches: 203,
  },
  {
    id: "sppl-s1",
    leagues: [{ slug: "sppl-mnyl161q", label: "League" }],
    name: "SPPL Season 1",
    initials: "SPPL",
    sport: "Pickleball",
    kind: "league",
    city: "Mumbai",
    start: "2026-05-01",
    end: "2026-05-03",
    logo: "/events/sppl.jpg",
    facts: ["16 teams", "40 ties", "India Book of Records"],
    teams: 16,
    players: 416,
    matches: 40,
  },
  {
    id: "ajanta-indoor",
    name: "Ajanta Pharma Indoor Games",
    initials: "AJ",
    sport: "Indoor games",
    kind: "indoor",
    city: "Mumbai",
    when: "2026",
    facts: ["Carrom · Chess · TT", "12 events", "475 entrants"],
    players: 475,
  },
  {
    id: "tata-carrom",
    name: "Tata MF Carrom Tournament",
    initials: "TATA",
    sport: "Indoor games",
    kind: "indoor",
    city: "Mumbai",
    when: "2026",
    logo: "/events/tata.png",
    facts: ["Carrom", "Online registration"],
  },

  // ── Past auctions ──────────────────────────────────────────────────────
  // Counts checked against the live auction feeds on 20 Oct 2026.
  {
    id: "boa-s3-auction",
    auctions: [{ token: "7cdb617e74ed32362f05dc89bd9433c0", label: "Auction" }],
    name: "BOA Box Cricket S3",
    initials: "BOA",
    sport: "Cricket",
    kind: "auction",
    city: "Mumbai",
    start: "2026-10-11",
    logo: "/events/boa.png",
    facts: ["12 teams", "148 players"],
    teams: 12,
    players: 148,
  },
  {
    id: "msca-auction",
    auctions: [{ token: "b3ccad0d8c52be0d361c2e5b18133323", label: "Auction" }],
    name: "MSCA Members Badminton League",
    initials: "MSCA",
    sport: "Badminton",
    kind: "auction",
    city: "Mumbai",
    start: "2026-10-09",
    logo: "/events/msca.png",
    facts: ["10 teams", "239 players"],
    teams: 10,
    players: 239,
  },
  {
    id: "mpl-s3-auction",
    auctions: [{ token: "ccc38bfa1e923b9df4c70a78aa6ec13a", label: "Auction" }],
    name: "Memon Premier League S3",
    initials: "MPL",
    sport: "Cricket",
    kind: "auction",
    city: "Mumbai",
    start: "2026-10-07",
    logo: "/events/mpl.png",
    facts: ["12 teams", "132 players sold"],
    teams: 12,
    players: 132,
  },
  {
    id: "picklelabs-auction",
    auctions: [{ token: "60875a422bd9c26799d827933c54622e", label: "Auction" }],
    name: "Pickle Labs League",
    initials: "PL",
    sport: "Pickleball",
    kind: "auction",
    city: "Chhatrapati Sambhajinagar",
    start: "2026-09-13",
    logo: "/events/picklelabs.png",
    facts: ["5 teams", "44 players"],
    teams: 5,
    players: 44,
  },
  {
    id: "ecpl-5",
    auctions: [{ token: "f77704ec6a5d7ac6a5e6728068c63259", label: "Auction" }],
    name: "Evolve Chapter Premier League 5",
    initials: "ECPL",
    sport: "Cricket",
    kind: "auction",
    city: "Mumbai",
    start: "2026-09-10",
    logo: "/events/ecpl.png",
    facts: ["4 teams", "52 players"],
    teams: 4,
    players: 52,
  },
  {
    id: "lpl-2026",
    auctions: [
      { token: "5157e99453f40f9e823c523cfbfc020f", label: "Men" },
      { token: "5187253c32185e84dfa12e6be22ecb05", label: "Women" },
    ],
    name: "La Stella Premier League",
    initials: "LPL",
    sport: "Cricket",
    kind: "auction",
    city: "Mumbai",
    start: "2026-09-06",
    logo: "/events/lpl.png",
    facts: ["Men's & women's", "15 teams", "141 players"],
    teams: 15,
    players: 141,
  },
  {
    id: "shpl-2026",
    auctions: [{ token: "f08ed48516639cb6b2d291b6282f35ba", label: "Auction" }],
    name: "Student Housing Premier League",
    initials: "SHPL",
    sport: "Multi-sport",
    kind: "auction",
    city: "Mumbai",
    start: "2026-09-05",
    logo: "/events/shpl.png",
    facts: ["14 sports", "10 teams", "392 players"],
    teams: 10,
    players: 392,
  },
  {
    id: "hpsl-auction",
    auctions: [{ token: "2789f9a76d54927f965a77ce77181443", label: "Auction" }],
    name: "HPSL Cricket",
    initials: "HPSL",
    sport: "Cricket",
    kind: "auction",
    city: "Mumbai",
    start: "2026-08-06",
    logo: "/events/hpsl.png",
    facts: ["7 teams", "53 players"],
    teams: 7,
    players: 53,
  },
  {
    id: "aoe-s2",
    auctions: [{ token: "6820bb7316e3ee665ddcf8f0db7ae8a2", label: "Auction" }],
    name: "AARADHYA One Earth Turf Championship S2",
    initials: "AOE",
    sport: "Cricket",
    kind: "auction",
    city: "Mumbai",
    start: "2026-07-26",
    logo: "/events/aoe.png",
    facts: ["13 teams", "117 players"],
    teams: 13,
    players: 117,
  },
  {
    id: "sbpl-s2-auction",
    auctions: [{ token: "0b2fcac8d11490a8cbec8131aa6df272", label: "Auction" }],
    name: "Sky City Badminton Premier League S2",
    initials: "SBPL",
    sport: "Badminton",
    kind: "auction",
    city: "Mumbai",
    start: "2026-07-11",
    logo: "/events/sbpl.png",
    facts: ["16 teams", "480 players"],
    teams: 16,
    players: 480,
  },
];

export type EventStatus = "live" | "upcoming" | "past";

/** When the data above was last checked. Server renders and totals use this date. */
export const DATA_AS_OF = Date.parse("2026-10-19T00:00:00+05:30");

/** Day boundaries in IST, so an event is "live" for the whole of its last day. */
function istDayStart(iso: string) {
  return new Date(`${iso}T00:00:00+05:30`).getTime();
}

export function statusOf(e: YoidenEvent, now: number): EventStatus {
  if (!e.start) return "past";
  const start = istDayStart(e.start);
  const end = istDayStart(e.end ?? e.start) + 24 * 60 * 60 * 1000;
  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "past";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatWhen(e: YoidenEvent): string {
  if (!e.start) return e.when ?? "";
  const [y, m, d] = e.start.split("-").map(Number);
  if (!e.end || e.end === e.start) return `${d} ${MONTHS[m - 1]} ${y}`;
  const [y2, m2, d2] = e.end.split("-").map(Number);
  if (m === m2 && y === y2) return `${d}–${d2} ${MONTHS[m - 1]} ${y}`;
  return `${d} ${MONTHS[m - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
}

/** Newest first. Events without a start date go last. */
export function byDateDesc(a: YoidenEvent, b: YoidenEvent) {
  return (b.start ?? "0000").localeCompare(a.start ?? "0000");
}

/** Event logos are served by yoiden.com; the app loads them from there. */
export const logoUrl = (path?: string) => (path ? (path.startsWith("http") ? path : `https://yoiden.com${path}`) : undefined);

export const isAuction = (e: YoidenEvent) => e.kind === "auction";

/** Permanent URL of an event page on yoiden.com. */
export const eventPath = (id: string) => `/events/${id}`;
/** Permanent URL of one match (tie) inside an event. */
export const matchPath = (id: string, matchId: string) => `/events/${id}/match/${matchId}`;

/** True when yoiden.com carries the event's data and has its own page for it. */
export const hasPage = (e: YoidenEvent) => !!(e.leagues?.length || e.auctions?.length || e.football);

/** Where an event card links: our own event page when we have its league feed, else the event site. */
export function eventHref(e: YoidenEvent): { href: string; external: boolean } | null {
  if (hasPage(e)) return { href: eventPath(e.id), external: false };
  if (e.url) return { href: e.url, external: true };
  return null;
}

export const eventById = (id: string) => EVENTS.find((e) => e.id === id);
