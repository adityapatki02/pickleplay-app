import React from 'react';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { YoidenTabNavigator } from './YoidenTabNavigator';
import { useAuthStore } from '../store/authStore';
import PlayerRecapScreen from '../screens/yoiden/PlayerRecapScreen';
import { ProfileSetupScreen } from '../screens/auth/ProfileSetupScreen';
import {
  IS_INDOOR_KIOSK,
  IS_LEAGUE_KIOSK,
  LEAGUE_KIOSK_ID,
  IS_TOURNAMENT_KIOSK,
} from '../config/appMode';
import { IndoorNavigator } from './IndoorNavigator';
import { TournamentKioskNavigator } from './TournamentKioskNavigator';
import TournamentPublicScreen from '../screens/public/TournamentPublicScreen';
import StandingsScreen from '../screens/yoiden/StandingsScreen';
import { ManageProvider } from '../screens/indoor/manageContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

// League-kiosk build (mumbaiopen.yoiden.com etc.): on a bare visit to "/",
// rewrite the URL to the league's dashboard route before NavigationContainer
// reads the initial URL. replaceState avoids a reload and keeps the address
// bar clean while linking resolves the event screen.
function applyKioskRoute(): void {
  if (!IS_LEAGUE_KIOSK) return;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const path = window.location.pathname || '/';
  if (path === '/' || path === '') {
    window.history.replaceState(null, '', `/event/${LEAGUE_KIOSK_ID}${window.location.search || ''}`);
  }
}
applyKioskRoute();

// Public routes that bypass auth — anyone with the URL can view.
// /player/:userId — daily-recap WhatsApp links.
function isPublicRoute(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  return /^\/player\/[^/]+/i.test(window.location?.pathname || '');
}

// /t/:slug — public tournament pages on the normal console build. This is
// also the future "generic tournament domain" path: point any domain at the
// standard web export and every tournament is served by slug, no per-event
// build needed.
function isPublicTournamentRoute(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  return /^\/t\/[^/]+/i.test(window.location?.pathname || '');
}

export const RootNavigator: React.FC = () => {
  // IS_INDOOR_KIOSK / IS_TOURNAMENT_KIOSK are Expo build-time constants.
  // These branches are dead-code-eliminated at bundle time for non-kiosk
  // builds, so the early returns never exist at runtime in the main app and
  // the hook call below is always reached in the builds where it matters.
  // Textually they precede the hook, which trips react-hooks/rules-of-hooks —
  // safe to suppress because the rule doesn't apply to build-constant branches.
  if (IS_INDOOR_KIOSK) {
    const origin = (Platform.OS === 'web' && typeof window !== 'undefined') ? window.location.origin : '';
    const indoorLinking = {
      prefixes: [origin],
      config: { screens: { IndoorOverview: '', IndoorEvent: 'event/:competitionId', IndoorManage: 'manage' } },
    };
    return (
      <ManageProvider>
        <NavigationContainer linking={indoorLinking as any}>
          <IndoorNavigator />
        </NavigationContainer>
      </ManageProvider>
    );
  }

  if (IS_TOURNAMENT_KIOSK) {
    const origin = (Platform.OS === 'web' && typeof window !== 'undefined') ? window.location.origin : '';
    // Bare "/" falls through to the initial route (TournamentPublic with the
    // baked-in tournament id); /t/:slug resolves any tournament by slug on
    // the same domain.
    const kioskLinking = {
      prefixes: [origin],
      config: {
        screens: {
          TournamentPublic: 't/:slug',
          TournamentStandings: 'standings',
        },
      },
    };
    return (
      <NavigationContainer
        linking={kioskLinking as any}
        documentTitle={{ formatter: () => 'Yoiden' }}
      >
        <TournamentKioskNavigator />
      </NavigationContainer>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const publicRoute = isPublicRoute();
  const publicTournamentRoute = isPublicTournamentRoute();
  // Onboarding gate:
  //   needsProfile: authenticated but missing name → show ProfileSetup
  // Location is no longer a gate — users land in AppTabs and set their city from
  // the Home header pill (which opens CityPickerScreen as a modal). See HomeScreen.
  const needsProfile = isAuthenticated && !user?.fullName;

  // Show a brief splash while AsyncStorage rehydrates the persisted auth
  // state on app start. Without this, a logged-in user would see the login
  // screen flash for one frame before being redirected back to the app.
  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#001E40" />
      </View>
    );
  }

  // Web deep-linking: map /player/:userId → PublicPlayerRecap screen,
  // /t/:slug → TournamentPublic (public tournament page).
  const linking = Platform.OS === 'web' ? {
    prefixes: [
      typeof window !== 'undefined' ? window.location.origin : '',
    ],
    config: {
      screens: {
        PublicPlayerRecap: 'player/:userId',
        TournamentPublic: 't/:slug',
        // Deep link straight to a tournament's dashboard (e.g. Mumbai Open):
        //   /event/<leagueId>  → AppTabs > HomeTab > LeagueDashboard
        // The dashboard auto-resolves the latest season, so only leagueId is needed.
        AppTabs: {
          screens: {
            HomeTab: {
              screens: {
                LeagueDashboard: 'event/:leagueId',
              },
            },
          },
        },
      },
    },
  } : undefined;

  return (
    <NavigationContainer
      linking={linking as any}
      documentTitle={{
        formatter: () => 'Yoiden',
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, title: 'Yoiden' }}>
        {publicRoute ? (
          <Stack.Screen name="PublicPlayerRecap" component={PlayerRecapScreen} />
        ) : publicTournamentRoute ? (
          <>
            <Stack.Screen name="TournamentPublic" component={TournamentPublicScreen} />
            <Stack.Screen name="TournamentStandings" component={StandingsScreen as any} />
          </>
        ) : !isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : needsProfile ? (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen as any} />
        ) : (
          <Stack.Screen name="AppTabs" component={YoidenTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
