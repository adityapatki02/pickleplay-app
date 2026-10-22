/**
 * Registration forms run on Yoiden. While open (until `closes`) a form shows on the home strip
 * with a live Open / Waitlist / Full state; after that it stays in the Registration forms
 * section and the /events Registrations tab as Closed. Add a form here when it goes live.
 */
import { API_BASE } from "./league-feed";

export type Registration = {
  id: string;
  name: string;
  /** What players are signing up for, e.g. "Player auction registration". */
  kind: string;
  sport: string;
  city: string;
  /** The event the form is for, shown as "Event: 18–19 Dec". Free text. */
  eventWhen: string;
  url: string;
  logo?: string;
  /** Logo drawn in white parts needs the navy tile. */
  logoOnDark?: boolean;
  initials: string;
  /** Last day the form is open (IST, yyyy-mm-dd); after it the card reads Closed. */
  closes: string;
  /** Short label for when it ran, shown once closed, e.g. "Sep 2026". */
  ran?: string;
  /** Live seat counts from the form's own public endpoint. */
  seats?: "ashmavir" | "cns";
  /** Shown when there are no live counts, e.g. ["Teams of 15", "Business cricket league"]. */
  facts?: string[];
};

export const REGISTRATIONS: Registration[] = [
  {
    id: "ashmavir-cup-s11",
    name: "Ashmavir Cup S11",
    kind: "Player auction registration",
    sport: "Cricket",
    city: "Mumbai",
    eventWhen: "Auction 1 Nov · Cup 18–19 Dec",
    url: "https://ashmavir.yoiden.com",
    initials: "AC",
    closes: "2026-10-31",
    seats: "ashmavir",
  },
  {
    id: "cns-pickleball-2026",
    name: "CNS Parents' Pickleball",
    kind: "Player registration",
    sport: "Pickleball",
    city: "Mumbai",
    eventWhen: "21–22 Nov",
    url: "https://cns-pickleball.yoiden.com",
    logo: "/events/cns.png",
    initials: "CNS",
    closes: "2026-11-15",
    seats: "cns",
  },
  {
    id: "makabo-2026",
    name: "MaKaBo Premier League",
    kind: "Player registration",
    sport: "Cricket",
    city: "Mumbai",
    eventWhen: "29 Nov",
    url: "https://makabo.yoiden.com",
    logo: "/events/makabo.png",
    logoOnDark: true,
    initials: "MK",
    closes: "2026-11-22",
    facts: ["Business cricket league"],
  },

  // ── Closed ──
  {
    id: "boa-s3-registration",
    name: "BOA Box Cricket S3",
    kind: "Player auction registration",
    sport: "Cricket",
    city: "Mumbai",
    eventWhen: "Auction 11 Oct",
    url: "https://boa.yoiden.com",
    logo: "/events/boa.png",
    initials: "BOA",
    closes: "2026-10-05",
    ran: "Sep 2026",
    facts: ["Ophthalmologists' league"],
  },
  {
    id: "msca-profiles",
    name: "MSCA Player Profiles",
    kind: "Player profile registration",
    sport: "Multi-sport",
    city: "Mumbai",
    eventWhen: "Badminton, cricket, squash",
    url: "https://msca-badminton.yoiden.com",
    logo: "/events/msca.png",
    initials: "MSCA",
    closes: "2026-10-05",
    ran: "Sep 2026",
  },
  {
    id: "sttpl-s2",
    name: "Sky City Table Tennis Premier League S2",
    kind: "Player registration with payment",
    sport: "Table tennis",
    city: "Mumbai",
    eventWhen: "Season 2",
    url: "https://sttpl.yoiden.com",
    initials: "STT",
    closes: "2026-09-10",
    ran: "Sep 2026",
    facts: ["300 paid places"],
  },
  {
    id: "ipca-s4",
    name: "IPCA Premier League S4",
    kind: "Player registration",
    sport: "Cricket",
    city: "Mumbai",
    eventWhen: "12 Dec",
    url: "https://ipca.yoiden.com",
    logo: "/events/ipca.png",
    initials: "IPCA",
    closes: "2026-09-15",
    ran: "Aug 2026",
  },
  {
    id: "tata-carrom",
    name: "Tata Mutual Fund Carrom",
    kind: "Employee registration",
    sport: "Carrom",
    city: "Mumbai",
    eventWhen: "Corporate tournament",
    url: "https://tatacarrom.yoiden.com",
    logo: "/events/tata.png",
    initials: "TATA",
    closes: "2026-08-25",
    ran: "Aug 2026",
    facts: ["32 places + waitlist"],
  },
];

export const isOpen = (r: Registration, now: number) => now < Date.parse(`${r.closes}T23:59:59+05:30`);

/** One line per category: how full it is and what a new player gets. */
export type SeatLine = { label: string; taken: number; cap: number; note: string; state: "open" | "waitlist" | "closed" };

type AshmavirSeat = {
  caps: { confirmed: number; waitlist: number };
  confirmed: number;
  placesLeft: number;
  waitlistLeft: number;
  state: string;
};

/** One state per category; [] = open, no counts to show. A full form stays listed as Full until `closes`. */
export async function fetchSeats(r: Registration): Promise<SeatLine[] | null> {
  if (!r.seats) return [];
  const res = await fetch(`${API_BASE}/${r.seats}/options`, { method: "POST", cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json())?.data;
  if (r.seats === "ashmavir") {
    const lines = (["Men", "Women"] as const).map((label): SeatLine => {
      const s = data.seats[label] as AshmavirSeat;
      const state = s.state === "open" ? "open" : s.state === "waitlist" && s.waitlistLeft > 0 ? "waitlist" : "closed";
      return {
        label,
        taken: s.confirmed,
        cap: s.caps.confirmed,
        state,
        note:
          state === "open"
            ? `${s.placesLeft} places left`
            : state === "waitlist"
              ? `Full · ${s.waitlistLeft} waitlist spot${s.waitlistLeft === 1 ? "" : "s"}`
              : "Full",
      };
    });
    return lines;
  }
  // CNS reports one state for the whole event.
  const state = data.state as string;
  if (state === "open") return [{ label: "Players", taken: 0, cap: 0, state: "open", note: "Places open" }];
  if (state === "waitlist_paid" || state === "waitlist")
    return [{ label: "Players", taken: 1, cap: 1, state: "waitlist", note: "Full · waitlist open" }];
  return [{ label: "Players", taken: 1, cap: 1, state: "closed", note: "Full" }];
}
