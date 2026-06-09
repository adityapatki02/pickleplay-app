import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Auth Stack
export type AuthStackParamList = {
  Splash: undefined;
  PhoneInput: undefined;
  OTPVerify: { phone: string; verificationId: string };
  ProfileSetup: undefined;
  CityPicker: undefined;
  ForgotPin: { phone?: string } | undefined;
};

// Player Tab Stacks
export type HomeStackParamList = {
  Home: undefined;
  Notifications: undefined;
  TournamentDetail: { tournamentId: string };
  Registration: { tournamentId: string; categoryId: string };
  Fantasy: { seasonId: string; leagueId?: string };
};

export type DiscoverStackParamList = {
  Discover: undefined;
  TournamentDetail: { tournamentId: string };
  CategoryDetail: { categoryId: string };
  Registration: { tournamentId: string; categoryId: string };
  PartnerSearch: { categoryId: string };
  Payment: { registrationId: string; amount: number };
  RegistrationConfirm: { registrationId: string };
};

export type MyMatchesStackParamList = {
  MyTournaments: undefined;
  TournamentLive: { tournamentId: string };
  Schedule: { tournamentId: string };
  MatchDetail: { matchId: string };
  LiveScore: { matchId: string };
  GroupStandings: { categoryId: string };
  Bracket: { categoryId: string };
  CheckIn: { matchId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  StatsDetail: undefined;
  RatingHistory: undefined;
  MatchHistory: undefined;
  HeadToHead: { opponentId: string };
  Leaderboard: undefined;
  Settings: undefined;
  EditProfile: undefined;
};

// Player Tab Navigator
export type PlayerTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  DiscoverTab: NavigatorScreenParams<DiscoverStackParamList>;
  MyMatchesTab: NavigatorScreenParams<MyMatchesStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// Organizer Tab Stacks
export type OrgDashboardStackParamList = {
  OrgDashboard: undefined;
  RevenueDetail: { tournamentId: string };
};

export type OrgTournamentsStackParamList = {
  OrgTournaments: undefined;
  CreateTournament: undefined;
  TournamentManage: { tournamentId: string };
  EditTournament: { tournamentId: string };
  ManageCategories: { tournamentId: string };
  ManageCourts: { tournamentId: string };
  RegistrationManage: { tournamentId: string };
  DrawManage: { categoryId: string };
  ScheduleManage: { tournamentId: string };
  ScoreEntry: { matchId: string };
  BracketManage: { categoryId: string };
  RefereeAssign: { tournamentId: string };
  SponsorManage: { tournamentId: string };
  ExpenseManage: { tournamentId: string };
  WhatsAppBulk: { tournamentId: string };
  WhatsAppHistory: { tournamentId: string };
};

export type OrgCreateStackParamList = {
  CreateTournament: undefined;
  CloneTournament: undefined;
};

export type OrgAnalyticsStackParamList = {
  Analytics: { tournamentId?: string };
  Export: { tournamentId: string };
};

// Organizer Tab Navigator
export type OrgTabParamList = {
  DashboardTab: NavigatorScreenParams<OrgDashboardStackParamList>;
  MyTournamentsTab: NavigatorScreenParams<OrgTournamentsStackParamList>;
  CreateTab: NavigatorScreenParams<OrgCreateStackParamList>;
  AnalyticsTab: NavigatorScreenParams<OrgAnalyticsStackParamList>;
};

// Simplified Organizer stack/tab types (used by OrganizerTabNavigator)
export type OrganizerStackParamList = {
  OrganizerTournaments: undefined;
  CreateTournament: undefined;
  TournamentDashboard: { tournamentId: string };
  RegistrationManagement: { tournamentId: string };
  OrganizerBracket: { tournamentId: string };
  ScoreEntry: { tournamentId: string; matchId?: string; categoryId?: string };
};

export type OrganizerTabParamList = {
  TournamentsTab: undefined;
  ProfileTab: undefined;
};

// League Stack
export type LeagueStackParamList = {
  CreateLeague: undefined;
  FranchiseManagement: { leagueId: string };
  RosterManagement: { franchiseId: string; seasonId: string };
  GroupManagement: { leagueId: string; seasonId: string };
  LeagueDashboard: { leagueId: string; seasonId: string };
  TieDetail: { tieId: string };
  Standings: { leagueId: string; seasonId: string };
  LeagueStats: { leagueId: string; seasonId: string };
  PlayerProfile: { playerId: string; leagueId?: string; seasonId?: string };
  Fantasy: { seasonId: string; leagueId?: string };
};

// My Events unified stack
export type MyEventsStackParamList = {
  MyEvents: undefined;
  CreateTournament: undefined;
  TournamentManage: { tournamentId: string };
  TournamentDetail: { tournamentId: string };
  RegistrationManage: { tournamentId: string };
  MatchSetup: { tournamentId: string };
  MatchHub: { tournamentId: string };
  Seeding: { tournamentId: string; categoryId: string };
  BracketManage: { categoryId: string };
  ScoreEntry: { matchId: string };
  Schedule: { tournamentId: string };
  Bracket: { categoryId: string };
  PartnerSearch: { tournamentId: string };
  Registration: { tournamentId: string; categoryId: string };
  // League screens (nested in MyEvents)
  CreateLeague: undefined;
  FranchiseManagement: { leagueId: string };
  RosterManagement: { franchiseId: string; seasonId: string };
  GroupManagement: { leagueId: string; seasonId: string };
  LeagueDashboard: { leagueId: string; seasonId: string };
  TieDetail: { tieId: string };
  Standings: { leagueId: string; seasonId: string };
  LeagueStats: { leagueId: string; seasonId: string };
  PlayerProfile: { playerId: string; leagueId?: string; seasonId?: string };
  Fantasy: { seasonId: string; leagueId?: string };
};

// Stats stack
export type StatsStackParamList = {
  Stats: undefined;
};

// Unified App Tab Navigator
export type AppTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  MyEventsTab: NavigatorScreenParams<MyEventsStackParamList>;
  DiscoverTab: NavigatorScreenParams<DiscoverStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// Root Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  PlayerTabs: NavigatorScreenParams<PlayerTabParamList>;
  OrgTabs: NavigatorScreenParams<OrganizerTabParamList>;
  AppTabs: NavigatorScreenParams<AppTabParamList>;
};

// Helper types for screen props
export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;
