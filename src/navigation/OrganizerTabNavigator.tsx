import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, SafeAreaView, StyleSheet } from 'react-native';
import {
  OrganizerTabParamList,
  OrgTournamentsStackParamList,
} from './types';
import { colors, typography, spacing } from '../config/theme';
import OrganizerTournamentsScreen from '../screens/organizer/OrganizerTournamentsScreen';
import TournamentDashboardScreen from '../screens/organizer/TournamentDashboardScreen';
import RegistrationManagementScreen from '../screens/organizer/RegistrationManagementScreen';
import OrganizerBracketScreen from '../screens/organizer/OrganizerBracketScreen';
import ScoreEntryScreen from '../screens/organizer/ScoreEntryScreen';
import CreateTournamentScreen from '../screens/organizer/CreateTournamentScreen';

// Profile placeholder
const OrgProfileScreen = () => (
  <SafeAreaView style={styles.placeholder}>
    <View style={styles.placeholderBody}>
      <Text style={styles.placeholderTitle}>PROFILE</Text>
      <Text style={styles.placeholderSubtitle}>Organizer profile — coming soon</Text>
    </View>
  </SafeAreaView>
);

// Tournaments Stack — all organizer screens reachable from one stack
const TourStack = createNativeStackNavigator<OrgTournamentsStackParamList>();
const TournamentsStackNavigator = () => (
  <TourStack.Navigator screenOptions={{ headerShown: false }}>
    <TourStack.Screen name="OrgTournaments" component={OrganizerTournamentsScreen} />
    <TourStack.Screen name="CreateTournament" component={CreateTournamentScreen} />
    <TourStack.Screen name="TournamentManage" component={TournamentDashboardScreen} />
    <TourStack.Screen name="RegistrationManage" component={RegistrationManagementScreen} />
    <TourStack.Screen name="BracketManage" component={OrganizerBracketScreen} />
    <TourStack.Screen name="ScoreEntry" component={ScoreEntryScreen} />
  </TourStack.Navigator>
);

const Tab = createBottomTabNavigator<OrganizerTabParamList>();

export const OrganizerTabNavigator: React.FC = () => {
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
        name="TournamentsTab"
        component={TournamentsStackNavigator}
        options={{
          tabBarLabel: 'Tournaments',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabStyles.activeIcon : undefined}>
              <Text style={{ fontSize: 18, color }}>{'🏆'}</Text>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={OrgProfileScreen}
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

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: colors.background,
  },
  placeholderBody: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  placeholderTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontStyle: 'italic',
    color: colors.primary,
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  placeholderSubtitle: {
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
});

const tabStyles = StyleSheet.create({
  activeIcon: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
