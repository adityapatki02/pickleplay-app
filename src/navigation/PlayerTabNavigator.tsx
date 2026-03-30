import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import {
  PlayerTabParamList,
  HomeStackParamList,
  DiscoverStackParamList,
  MyMatchesStackParamList,
  ProfileStackParamList,
} from './types';
import { colors, typography, spacing, shadows } from '../config/theme';
import { useAuthStore } from '../store/authStore';
import DiscoverScreen from '../screens/player/DiscoverScreen';
import TournamentDetailScreen from '../screens/player/TournamentDetailScreen';
import RegisterScreen from '../screens/player/RegisterScreen';
import MyTournamentsScreen from '../screens/player/MyTournamentsScreen';
import MatchScheduleScreen from '../screens/player/MatchScheduleScreen';
import BracketViewScreen from '../screens/player/BracketViewScreen';

// Placeholder screens with new design
const PlaceholderScreen = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <SafeAreaView style={ph.container}>
    <View style={ph.header}>
      <View style={ph.headerGlow} />
      <Text style={ph.brand}>PRO PICKLEBALL</Text>
    </View>
    <View style={ph.body}>
      <Text style={ph.title}>{title.toUpperCase()}</Text>
      {subtitle && <Text style={ph.subtitle}>{subtitle}</Text>}
      <View style={ph.card}>
        <Text style={ph.cardLabel}>COMING SOON</Text>
        <Text style={ph.cardDesc}>This screen is under development</Text>
      </View>
    </View>
  </SafeAreaView>
);

const ph = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute', top: -80, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: colors.secondaryContainer, opacity: 0.06,
  },
  brand: {
    fontSize: typography.fontSize.base,
    fontWeight: '900', fontStyle: 'italic',
    color: '#FFFFFF', letterSpacing: -0.3,
  },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'] },
  title: {
    fontSize: 28, fontWeight: '900', fontStyle: 'italic',
    color: colors.primary, letterSpacing: -1, marginBottom: spacing.sm,
  },
  subtitle: { fontSize: typography.fontSize.md, color: colors.textSecondary, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12, padding: spacing.xl,
    borderWidth: 1, borderColor: colors.surfaceVariant,
    ...shadows.sm,
  },
  cardLabel: {
    fontSize: 10, fontWeight: '700', color: colors.secondaryContainer,
    letterSpacing: 2, marginBottom: spacing.xs,
  },
  cardDesc: { fontSize: typography.fontSize.md, color: colors.textSecondary },
});

// Home Stack
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const HomeStackNavigator = () => {
  const { user } = useAuthStore();
  const displayName = user?.displayName || user?.fullName || 'Player';

  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home">
        {() => (
          <SafeAreaView style={ph.container}>
            <View style={ph.header}>
              <View style={ph.headerGlow} />
              <Text style={ph.brand}>PRO PICKLEBALL</Text>
            </View>
            <View style={ph.body}>
              <Text style={ph.title}>{'WELCOME BACK,\n' + displayName.toUpperCase() + '.'}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing['2xl'] }}>
                <View style={{ backgroundColor: colors.primary, paddingVertical: 3, paddingHorizontal: spacing.md, borderRadius: 3 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>
                    {(user?.selfReportedSkill || 'PLAYER').toUpperCase()}
                  </Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.secondaryContainer, letterSpacing: 1.5, alignSelf: 'center' }}>
                  {(user?.city || '').toUpperCase()}
                </Text>
              </View>

              <View style={ph.card}>
                <Text style={ph.cardLabel}>MY NEXT MATCH</Text>
                <Text style={ph.cardDesc}>No upcoming matches. Browse tournaments to register.</Text>
              </View>
            </View>
          </SafeAreaView>
        )}
      </HomeStack.Screen>
      <HomeStack.Screen name="Notifications">
        {() => <PlaceholderScreen title="Notifications" subtitle="Stay updated on matches & results" />}
      </HomeStack.Screen>
    </HomeStack.Navigator>
  );
};

// Discover Stack
const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();
const DiscoverStackNavigator = () => (
  <DiscoverStack.Navigator screenOptions={{ headerShown: false }}>
    <DiscoverStack.Screen name="Discover" component={DiscoverScreen} />
    <DiscoverStack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    <DiscoverStack.Screen name="Registration" component={RegisterScreen} />
  </DiscoverStack.Navigator>
);

// Matches Stack
const MatchesStack = createNativeStackNavigator<MyMatchesStackParamList>();
const MatchesStackNavigator = () => (
  <MatchesStack.Navigator screenOptions={{ headerShown: false }}>
    <MatchesStack.Screen name="MyTournaments" component={MyTournamentsScreen} />
    <MatchesStack.Screen name="Schedule" component={MatchScheduleScreen} />
    <MatchesStack.Screen name="Bracket" component={BracketViewScreen} />
  </MatchesStack.Navigator>
);

// Profile Stack
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStack.Screen name="Profile">
      {() => <PlaceholderScreen title="Profile" subtitle="Your stats and rating history" />}
    </ProfileStack.Screen>
  </ProfileStack.Navigator>
);

const Tab = createBottomTabNavigator<PlayerTabParamList>();

export const PlayerTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.surfaceContainerLowest,
          borderTopColor: colors.surfaceVariant,
          paddingTop: 6,
          height: 60,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabStyles.activeIcon : undefined}>
              <Text style={{ fontSize: 18, color }}>{'📊'}</Text>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="DiscoverTab"
        component={DiscoverStackNavigator}
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18, color }}>{'🔍'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="MyMatchesTab"
        component={MatchesStackNavigator}
        options={{
          tabBarLabel: 'Matches',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18, color }}>{'🏓'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18, color }}>{'👤'}</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const tabStyles = StyleSheet.create({
  activeIcon: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
