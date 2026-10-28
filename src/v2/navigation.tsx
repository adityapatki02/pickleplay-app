// v2 app shell: four tabs (Home · Events · My events · Me) and one root stack
// for everything that opens over them: event, match and player pages, search,
// the manage (admin) screen, sign-in, and the existing league admin / scorer
// screens that admin mode opens until their v2 versions exist.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { registerDetailAndManageScreens } from '../navigation/YoidenTabNavigator';
import { AuthNavigator } from '../navigation/AuthNavigator';
import { TabBar } from './components/chrome';
import { useAuthStore } from '../store/authStore';
import HomeScreen from './screens/HomeScreen';
import EventsScreen from './screens/EventsScreen';
import MyEventsScreen from './screens/MyEventsScreen';
import MeScreen from './screens/MeScreen';
import SearchScreen from './screens/SearchScreen';
import EventScreen from './screens/EventScreen';
import MatchScreen from './screens/MatchScreen';
import PlayerScreen from './screens/PlayerScreen';
import ManageScreen from './screens/ManageScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ModeScreen from './screens/mode/ModeScreen';
import ScoreTieScreen from './screens/mode/ScoreTieScreen';
import './store/event-list';
import { usePushTaps } from './store/push';

export type V2Params = {
  Tabs: undefined;
  Event: { id: string };
  Match: { eventId: string; matchId: string };
  Player: { eventId: string; slug: string };
  Search: undefined;
  Manage: { eventId: string; leagueId: string; slug: string };
  Mode: { eventId: string; role: 'admin' | 'scorer' | 'captain'; kind: 'league' | 'football' | 'event'; slug: string | null; leagueId?: string; teamId?: string };
  ScoreTie: { eventId: string; slug: string; seasonId: string; tieId: string; role: 'admin' | 'scorer' | 'captain' };
  Auth: undefined;
  Notifications: undefined;
};

const Tab = createBottomTabNavigator();
function Tabs() {
  return (
    <Tab.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="EventsTab" component={EventsScreen} />
      <Tab.Screen name="MyEventsTab" component={MyEventsScreen} />
      <Tab.Screen name="MeTab" component={MeScreen} />
    </Tab.Navigator>
  );
}

const Stack = createNativeStackNavigator<any>();

/** Sign-in opens straight on the phone + PIN screen; the brand splash is for app start only. */
const SignIn = () => <AuthNavigator initialRouteName="PhoneInput" />;

export function V2Navigator() {
  usePushTaps();
  const S = Stack.Screen as any;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, title: 'Yoiden' }}>
      <S name="Tabs" component={Tabs} />
      <S name="Event" component={EventScreen} />
      <S name="Match" component={MatchScreen} />
      <S name="Player" component={PlayerScreen} />
      <S name="Search" component={SearchScreen} options={{ animation: 'fade' }} />
      <S name="Manage" component={ManageScreen} />
      <S name="Mode" component={ModeScreen} />
      <S name="ScoreTie" component={ScoreTieScreen} />
      <S name="Notifications" component={NotificationsScreen} />
      {/* Sign-in is only reachable while signed out; once the phone is verified the
          screen drops out of the stack and the player lands back where they were. */}
      {!isAuthenticated && <S name="Auth" component={SignIn} options={{ presentation: 'modal' }} />}
      {registerDetailAndManageScreens(Stack as any)}
    </Stack.Navigator>
  );
}
