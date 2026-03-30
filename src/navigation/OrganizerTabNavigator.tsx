import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import {
  OrgTabParamList,
  OrgDashboardStackParamList,
  OrgTournamentsStackParamList,
  OrgCreateStackParamList,
  OrgAnalyticsStackParamList,
} from './types';
import { colors, typography } from '../config/theme';
import OrgMyTournamentsScreen from '../screens/organizer/MyTournamentsScreen';
import TournamentDashboardScreen from '../screens/organizer/TournamentDashboardScreen';
import RegistrationManagementScreen from '../screens/organizer/RegistrationManagementScreen';
import BracketManageScreen from '../screens/organizer/BracketManageScreen';
import ScoreEntryScreen from '../screens/organizer/ScoreEntryScreen';
import CreateTournamentScreen from '../screens/organizer/CreateTournamentScreen';

const PlaceholderScreen = ({ title }: { title: string }) => (
  <Text style={{ padding: 20, fontSize: 18 }}>{title}</Text>
);

// Dashboard Stack
const DashStack = createNativeStackNavigator<OrgDashboardStackParamList>();
const DashStackNavigator = () => (
  <DashStack.Navigator screenOptions={{ headerShown: false }}>
    <DashStack.Screen name="OrgDashboard">
      {() => <PlaceholderScreen title="Organizer Dashboard" />}
    </DashStack.Screen>
  </DashStack.Navigator>
);

// Tournaments Stack
const TourStack = createNativeStackNavigator<OrgTournamentsStackParamList>();
const TourStackNavigator = () => (
  <TourStack.Navigator screenOptions={{ headerShown: false }}>
    <TourStack.Screen name="OrgTournaments" component={OrgMyTournamentsScreen} />
    <TourStack.Screen name="TournamentManage" component={TournamentDashboardScreen} />
    <TourStack.Screen name="RegistrationManage" component={RegistrationManagementScreen} />
    <TourStack.Screen name="BracketManage" component={BracketManageScreen} />
    <TourStack.Screen name="ScoreEntry" component={ScoreEntryScreen} />
  </TourStack.Navigator>
);

// Create Stack
const CreateStack = createNativeStackNavigator<OrgCreateStackParamList>();
const CreateStackNavigator = () => (
  <CreateStack.Navigator screenOptions={{ headerShown: false }}>
    <CreateStack.Screen name="CreateTournament" component={CreateTournamentScreen} />
  </CreateStack.Navigator>
);

// Analytics Stack
const AnalyticsStack = createNativeStackNavigator<OrgAnalyticsStackParamList>();
const AnalyticsStackNavigator = () => (
  <AnalyticsStack.Navigator screenOptions={{ headerShown: false }}>
    <AnalyticsStack.Screen name="Analytics">
      {() => <PlaceholderScreen title="Analytics" />}
    </AnalyticsStack.Screen>
  </AnalyticsStack.Navigator>
);

const Tab = createBottomTabNavigator<OrgTabParamList>();

export const OrganizerTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: typography.fontSize.xs,
          fontWeight: '600',
        },
        tabBarStyle: {
          borderTopColor: colors.borderLight,
          paddingTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashStackNavigator}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>{'📊'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="MyTournamentsTab"
        component={TourStackNavigator}
        options={{
          tabBarLabel: 'Tournaments',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>{'🏆'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="CreateTab"
        component={CreateStackNavigator}
        options={{
          tabBarLabel: 'Create',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>{'➕'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsStackNavigator}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>{'📈'}</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
};
