// Featured leagues surfaced on Home (slider) and the "Live leagues" page.
// Today this is a curated list (SPPL is the marquee entry). When the leagues
// API exposes a featured/live feed, swap this const for that fetch — the UI
// already renders an array of these, so the shape is the contract.

export type LeagueStatus = 'live' | 'in_season' | 'completed';

export type FeaturedLeague = {
  key: string;
  name: string;
  season: string;
  logo: number; // require() asset handle
  leagueId: string;
  seasonId: string;
  sport: string;
  status: LeagueStatus;
  // Short one-liner shown on the banner tile / list row
  blurb: string;
};

export const FEATURED_LEAGUES: FeaturedLeague[] = [
  {
    key: 'sppl-s1',
    name: 'SPPL',
    season: 'Season 1',
    logo: require('../../assets/sppl-logo.jpg'),
    leagueId: '068798a6-4768-4cc6-8121-bc6ea024a6f3',
    seasonId: '35ebbe78-5899-4295-ac64-fba677dd10a4',
    sport: 'Pickleball',
    status: 'live',
    blurb: '12 teams · 13-match ties',
  },
];

// Leagues currently "going on" — drives the Live Leagues page + slider order.
export const liveLeagues = () =>
  FEATURED_LEAGUES.filter((l) => l.status === 'live' || l.status === 'in_season');
