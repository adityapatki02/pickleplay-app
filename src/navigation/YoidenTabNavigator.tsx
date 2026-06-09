import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';

import { YTabBar } from '../components/yoiden';

import HomeScreen from '../screens/yoiden/HomeScreen';
import PlayScreen from '../screens/yoiden/PlayScreen';
import FantasyScreen from '../screens/yoiden/FantasyScreen';
import MeScreen from '../screens/yoiden/MeScreen';

import TournamentDetailScreen from '../screens/yoiden/TournamentDetailScreen';
import CreateTournamentScreen from '../screens/yoiden/CreateTournamentScreen';
import RegisterScreen from '../screens/yoiden/RegisterScreen';
import RegistrationManagementScreen from '../screens/yoiden/RegistrationManagementScreen';
import SeedingScreen from '../screens/yoiden/SeedingScreen';
import ScheduleScreen from '../screens/yoiden/ScheduleScreen';
import ScoreEntryScreen from '../screens/yoiden/ScoreEntryScreen';
import BracketScreen from '../screens/yoiden/BracketScreen';
import ScoreLoggerScreen from '../screens/yoiden/ScoreLoggerScreen';
import StandingsScreen from '../screens/yoiden/StandingsScreen';
import RankingsScreen from '../screens/yoiden/RankingsScreen';

// League (SPPL) screens — themed for demo
import LeagueDashboardScreen from '../screens/league/LeagueDashboardScreen';
import LeagueStandingsScreen from '../screens/league/StandingsScreen';
import LeagueStatsScreen from '../screens/league/StatsScreen';
import LeagueTieDetailScreen from '../screens/league/TieDetailScreen';
import LeaguePlayerProfileScreen from '../screens/league/PlayerProfileScreen';
import LeagueFantasyScreen from '../screens/league/FantasyScreen';
import ScorerDemoScreen from '../screens/league/ScorerDemoScreen';

// Location picker — reused from onboarding, now opened as a modal from the Home header
import { CityPickerScreen } from '../screens/auth/CityPickerScreen';

// ─── Shared deep routes ─────────────────────────────────────────
// Tournament management + SPPL league deep links. Registered on every tab
// stack so MANAGE actions work from Home/Play/Me equally.
type DetailAndManageRoutes = {
  // Location
  CityPicker: undefined;
  // Tournament
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
  // SPPL league — route names match what the existing league screens use internally
  LeagueDashboard: { leagueId: string; seasonId: string };
  Standings: { leagueId: string; seasonId: string };
  LeagueStats: { leagueId: string; seasonId: string };
  TieDetail: { tieId: string; leagueId?: string; seasonId?: string };
  PlayerProfile: { playerId: string; leagueId?: string; seasonId?: string };
  LeagueFantasy: { seasonId: string; leagueId?: string };
  ScorerDemo: {
    homeName?: string;
    awayName?: string;
    slotLabel?: string;
    matchNo?: string;
    court?: string;
  };
};

// ─── Stack param lists ───────────────────────────────────────────
export type HomeStackParamList = DetailAndManageRoutes & {
  Home: undefined;
};

export type PlayStackParamList = DetailAndManageRoutes & {
  Play: undefined;
};

export type FantasyStackParamList = {
  Fantasy: undefined;
};

export type MeStackParamList = DetailAndManageRoutes & {
  Me: undefined;
};

export type YoidenTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  PlayTab: NavigatorScreenParams<PlayStackParamList>;
  FantasyTab: NavigatorScreenParams<FantasyStackParamList>;
  MeTab: NavigatorScreenParams<MeStackParamList>;
};

// ─── Shared screen registration helper ──────────────────────────
function registerDetailAndManageScreens<T extends DetailAndManageRoutes>(
  Stack: ReturnType<typeof createNativeStackNavigator<T>>,
) {
  const S = Stack.Screen as any;
  return (
    <>
      {/* Location — opens as a slide-up modal */}
      <S name="CityPicker" component={CityPickerScreen} options={{ presentation: 'modal' }} />
      {/* Tournament */}
      <S name="TournamentDetail" component={TournamentDetailScreen} />
      <S name="CreateTournament" component={CreateTournamentScreen} />
      <S name="Register" component={RegisterScreen} />
      <S name="RegistrationManage" component={RegistrationManagementScreen} />
      <S name="Seeding" component={SeedingScreen} />
      <S name="Schedule" component={ScheduleScreen} />
      <S name="ScoreEntry" component={ScoreEntryScreen} />
      <S name="Bracket" component={BracketScreen} />
      <S name="ScoreLogger" component={ScoreLoggerScreen} />
      <S name="TournamentStandings" component={StandingsScreen} />
      <S name="TournamentRankings" component={RankingsScreen} />
      {/* SPPL league */}
      <S name="LeagueDashboard" component={LeagueDashboardScreen} />
      <S name="Standings" component={LeagueStandingsScreen} />
      <S name="LeagueStats" component={LeagueStatsScreen} />
      <S name="TieDetail" component={LeagueTieDetailScreen} />
      <S name="PlayerProfile" component={LeaguePlayerProfileScreen} />
      <S name="LeagueFantasy" component={LeagueFantasyScreen} />
      <S name="ScorerDemo" component={ScorerDemoScreen} />
    </>
  );
}

// ─── Per-tab stacks ──────────────────────────────────────────────
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const HomeStackNavigator = () => (
  <HomeStack.Navigator screenOptions={{ headerShown: false }}>
    <HomeStack.Screen name="Home" component={HomeScreen} />
    {registerDetailAndManageScreens(HomeStack)}
  </HomeStack.Navigator>
);

const PlayStack = createNativeStackNavigator<PlayStackParamList>();
const PlayStackNavigator = () => (
  <PlayStack.Navigator screenOptions={{ headerShown: false }}>
    <PlayStack.Screen name="Play" component={PlayScreen} />
    {registerDetailAndManageScreens(PlayStack)}
  </PlayStack.Navigator>
);

const FantasyStack = createNativeStackNavigator<FantasyStackParamList>();
const FantasyStackNavigator = () => (
  <FantasyStack.Navigator screenOptions={{ headerShown: false }}>
    <FantasyStack.Screen name="Fantasy" component={FantasyScreen} />
  </FantasyStack.Navigator>
);

const MeStack = createNativeStackNavigator<MeStackParamList>();
const MeStackNavigator = () => (
  <MeStack.Navigator screenOptions={{ headerShown: false }}>
    <MeStack.Screen name="Me" component={MeScreen} />
    {registerDetailAndManageScreens(MeStack)}
  </MeStack.Navigator>
);

// ─── Bottom tabs ─────────────────────────────────────────────────
const Tab = createBottomTabNavigator<YoidenTabParamList>();

export const YoidenTabNavigator: React.FC = () => (
  <Tab.Navigator
    tabBar={(props) => <YTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="HomeTab" component={HomeStackNavigator} />
    <Tab.Screen name="PlayTab" component={PlayStackNavigator} />
    <Tab.Screen name="FantasyTab" component={FantasyStackNavigator} />
    <Tab.Screen name="MeTab" component={MeStackNavigator} />
  </Tab.Navigator>
);

// Demo constants — SPPL IDs to wire entry points
export const SPPL = {
  leagueId: '068798a6-4768-4cc6-8121-bc6ea024a6f3',
  seasonId: '35ebbe78-5899-4295-ac64-fba677dd10a4',
} as const;
