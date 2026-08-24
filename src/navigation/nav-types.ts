import { NavigatorScreenParams } from '@react-navigation/native';

// ─── Shared deep routes ─────────────────────────────────────────
export type DetailAndManageRoutes = {
  CityPicker: undefined;
  EditProfile: undefined;
  TournamentDetail: { tournamentId: string };
  CreateTournament: undefined;
  Register: { tournamentId: string; categoryId?: string };
  RegistrationManage: { tournamentId: string };
  Seeding: { tournamentId: string; categoryId: string };
  Schedule: { tournamentId: string };
  ScoreEntry: { matchId: string; tournamentId?: string };
  Bracket: { tournamentId: string; categoryId: string };
  ScoreLogger: { tournamentId: string };
  TournamentStandings: { tournamentId: string };
  TournamentRankings: { tournamentId: string };
  LiveLeagues: undefined;
  LeagueDashboard: { leagueId: string; seasonId: string };
  Standings: { leagueId: string; seasonId: string };
  LeagueStats: { leagueId: string; seasonId: string };
  TieDetail: { tieId: string; leagueId?: string; seasonId?: string };
  PlayerProfile: { playerId: string; leagueId?: string; seasonId?: string };
  ScorerMatches: { leagueId: string; seasonId?: string };
  LeagueFantasy: { seasonId: string; leagueId?: string };
  Support: undefined;
  ScorerDemo: {
    homeName?: string;
    awayName?: string;
    slotLabel?: string;
    matchNo?: string;
    court?: string;
  };
};

export type HomeStackParamList = DetailAndManageRoutes & {
  Home: undefined;
};

export type PlayStackParamList = DetailAndManageRoutes & {
  Play: undefined;
};

export type BookStackParamList = {
  Book: undefined;
  VenueDetail: { venueId: string };
  MyBookings: { justBooked?: string } | undefined;
  BookingSuccess: {
    bookingId: string;
    venueName: string;
    venueAddress: string;
    date: string;
    courts: { name: string; startTime: string; endTime: string; price: number }[];
    total: number;
  };
  BookingDetail: { bookingId: string };
};

export type MeStackParamList = DetailAndManageRoutes & {
  Me: undefined;
  VenueAdmin: { venueId: string };
  OwnerDashboard: { venueId?: string };
  HeatmapDetail: { venueId: string; courtId?: string };
  DuesDetail: { venueId: string };
  CustomersDetail: { venueId: string; month?: string; days?: number; daypart?: string };
  RevenueDetail: { venueId: string; month?: string; days?: number; daypart?: string };
  SponsoredDetail: { venueId: string; month?: string; days?: number; daypart?: string };
};

export type YoidenTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  PlayTab: NavigatorScreenParams<PlayStackParamList>;
  BookTab: NavigatorScreenParams<BookStackParamList>;
  MeTab: NavigatorScreenParams<MeStackParamList>;
  ProfileTab: NavigatorScreenParams<MeStackParamList>;
};

// Demo constants — SPPL IDs to wire entry points
export const SPPL = {
  leagueId: '068798a6-4768-4cc6-8121-bc6ea024a6f3',
  seasonId: '35ebbe78-5899-4295-ac64-fba677dd10a4',
} as const;
