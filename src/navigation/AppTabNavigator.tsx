import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import {
  AppTabParamList,
  HomeStackParamList,
  DiscoverStackParamList,
  MyEventsStackParamList,
  ProfileStackParamList,
  LeagueStackParamList,
} from './types';
import { FloatingTabBar } from './FloatingTabBar';
import { colors, spacing, typography } from '../config/theme';

// ─── NEW SCREENS ───
import HomeScreen from '../screens/HomeScreen';
import OrganizerHomeScreen from '../screens/organizer/OrganizerHomeScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import MyEventsScreen from '../screens/MyEventsScreen';

// ─── ORGANIZER SCREENS ───
import TournamentDashboardScreen from '../screens/organizer/TournamentDashboardScreen';
import RegistrationManagementScreen from '../screens/organizer/RegistrationManagementScreen';
import OrganizerBracketScreen from '../screens/organizer/OrganizerBracketScreen';
import ScoreEntryScreen from '../screens/organizer/ScoreEntryScreen';
import CreateTournamentScreen from '../screens/organizer/CreateTournamentScreen';

// ─── TOURNAMENT DETAIL (unified) ───
import TournamentDetailScreen from '../screens/TournamentDetailScreen';

// ─── SEEDING & MATCH SETUP SCREENS ───
import SeedingScreen from '../screens/organizer/SeedingScreen';
import MatchSetupScreen from '../screens/organizer/MatchSetupScreen';
import MatchHubScreen from '../screens/organizer/MatchHubScreen';
import OrganizerScheduleScreen from '../screens/organizer/ScheduleScreen';

// ─── LEAGUE SCREENS ───
import CreateLeagueScreen from '../screens/league/CreateLeagueScreen';
import FranchiseManagementScreen from '../screens/league/FranchiseManagementScreen';
import RosterManagementScreen from '../screens/league/RosterManagementScreen';
import GroupManagementScreen from '../screens/league/GroupManagementScreen';
import LeagueDashboardScreen from '../screens/league/LeagueDashboardScreen';
import TieDetailScreen from '../screens/league/TieDetailScreen';
import StandingsScreen from '../screens/league/StandingsScreen';

// ─── PROFILE SCREENS ───
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import RegisterScreen from '../screens/player/RegisterScreen';
import MatchScheduleScreen from '../screens/player/MatchScheduleScreen';
import BracketViewScreen from '../screens/player/BracketViewScreen';

const NAVY = '#001E40';

const Placeholder = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <SafeAreaView style={ph.root}>
    <View style={ph.header} />
    <View style={ph.body}>
      <Text style={ph.title}>{title.toUpperCase()}</Text>
      {subtitle && <Text style={ph.sub}>{subtitle}</Text>}
    </View>
  </SafeAreaView>
);

const ph = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F5' },
  header: { height: 4, backgroundColor: NAVY },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'] },
  title: { fontSize: 28, fontWeight: '900', fontStyle: 'italic', color: NAVY, letterSpacing: -1, marginBottom: spacing.sm },
  sub: { fontSize: typography.fontSize.md, color: colors.textSecondary },
});

// ─── HOME STACK ───
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const HomeStackNavigator = () => (
  <HomeStack.Navigator screenOptions={{ headerShown: false }}>
    <HomeStack.Screen name="Home" component={OrganizerHomeScreen} />
    <HomeStack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    <HomeStack.Screen name="Registration" component={RegisterScreen} />
    <HomeStack.Screen name="Notifications">
      {() => <Placeholder title="Notifications" subtitle="Your match alerts & updates" />}
    </HomeStack.Screen>
  </HomeStack.Navigator>
);

// ─── DISCOVER STACK ───
const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();
const DiscoverStackNavigator = () => (
  <DiscoverStack.Navigator screenOptions={{ headerShown: false }}>
    <DiscoverStack.Screen name="Discover" component={DiscoverScreen} />
    <DiscoverStack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    <DiscoverStack.Screen name="Registration" component={RegisterScreen} />
  </DiscoverStack.Navigator>
);

// ─── MY EVENTS STACK (unified player + organizer) ───
const MyEventsStack = createNativeStackNavigator<MyEventsStackParamList>();
const MyEventsStackNavigator = () => (
  <MyEventsStack.Navigator screenOptions={{ headerShown: false }}>
    <MyEventsStack.Screen name="MyEvents" component={MyEventsScreen} />
    <MyEventsStack.Screen name="CreateTournament" component={CreateTournamentScreen} />
    <MyEventsStack.Screen name="TournamentManage" component={TournamentDashboardScreen} />
    <MyEventsStack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    <MyEventsStack.Screen name="RegistrationManage" component={RegistrationManagementScreen} />
    <MyEventsStack.Screen name="MatchSetup" component={MatchSetupScreen} />
    <MyEventsStack.Screen name="MatchHub" component={MatchHubScreen} />
    <MyEventsStack.Screen name="Seeding" component={SeedingScreen} />
    <MyEventsStack.Screen name="BracketManage" component={OrganizerBracketScreen} />
    <MyEventsStack.Screen name="ScoreEntry" component={ScoreEntryScreen} />
    <MyEventsStack.Screen name="Schedule" component={OrganizerScheduleScreen} />
    <MyEventsStack.Screen name="Bracket" component={BracketViewScreen} />
    <MyEventsStack.Screen name="Registration" component={RegisterScreen} />
    <MyEventsStack.Screen name="PartnerSearch">
      {() => <Placeholder title="Partner Search" subtitle="Find your ideal doubles partner" />}
    </MyEventsStack.Screen>
    {/* League screens */}
    <MyEventsStack.Screen name="CreateLeague" component={CreateLeagueScreen} />
    <MyEventsStack.Screen name="FranchiseManagement" component={FranchiseManagementScreen} />
    <MyEventsStack.Screen name="RosterManagement" component={RosterManagementScreen} />
    <MyEventsStack.Screen name="GroupManagement" component={GroupManagementScreen} />
    <MyEventsStack.Screen name="LeagueDashboard" component={LeagueDashboardScreen} />
    <MyEventsStack.Screen name="TieDetail" component={TieDetailScreen} />
    <MyEventsStack.Screen name="Standings" component={StandingsScreen} />
  </MyEventsStack.Navigator>
);

// ─── PROFILE STACK ───
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStack.Screen name="Profile" component={ProfileScreen} />
    <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
  </ProfileStack.Navigator>
);

// ─── UNIFIED TAB NAVIGATOR ───
const Tab = createBottomTabNavigator<AppTabParamList>();

export const AppTabNavigator: React.FC = () => (
  <Tab.Navigator
    tabBar={(props) => <FloatingTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="HomeTab" component={HomeStackNavigator} />
    <Tab.Screen name="MyEventsTab" component={MyEventsStackNavigator} />
    <Tab.Screen name="DiscoverTab" component={DiscoverStackNavigator} />
    <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} />
  </Tab.Navigator>
);
