import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Auth Stack
export type AuthStackParamList = {
  Splash: undefined;
  PhoneInput: undefined;
  OTPVerify: { phone: string; verificationId: string };
  ProfileSetup: undefined;
};

// Player Tab Stacks
export type HomeStackParamList = {
  Home: undefined;
  Notifications: undefined;
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

// Root Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  PlayerTabs: NavigatorScreenParams<PlayerTabParamList>;
  OrgTabs: NavigatorScreenParams<OrgTabParamList>;
};

// Helper types for screen props
export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;
