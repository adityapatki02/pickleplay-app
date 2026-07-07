import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TournamentPublicScreen from '../screens/public/TournamentPublicScreen';
import StandingsScreen from '../screens/yoiden/StandingsScreen';
import { TOURNAMENT_KIOSK_ID } from '../config/appMode';

export type TournamentKioskParamList = {
  TournamentPublic: { tournamentId?: string; slug?: string } | undefined;
  TournamentStandings: { tournamentId: string };
};

const Stack = createNativeStackNavigator<TournamentKioskParamList>();

/** Auth-free stack for the tournament-kiosk build (pattern: IndoorNavigator).
 *  The baked-in tournament id arrives via initialParams; a /t/:slug link on
 *  the kiosk domain overrides it (the screen prefers slug). StandingsScreen
 *  is read-only and only calls unauthenticated GETs. */
export const TournamentKioskNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen
      name="TournamentPublic"
      component={TournamentPublicScreen}
      initialParams={{ tournamentId: TOURNAMENT_KIOSK_ID }}
    />
    <Stack.Screen name="TournamentStandings" component={StandingsScreen as any} />
  </Stack.Navigator>
);
