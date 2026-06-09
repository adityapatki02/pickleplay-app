import React from 'react';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { YoidenTabNavigator } from './YoidenTabNavigator';
import { useAuthStore } from '../store/authStore';
import PlayerRecapScreen from '../screens/yoiden/PlayerRecapScreen';
import { CityPickerScreen } from '../screens/auth/CityPickerScreen';
import { ProfileSetupScreen } from '../screens/auth/ProfileSetupScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Public routes that bypass auth — anyone with the URL can view.
// Used for daily-recap WhatsApp links so recipients don't have to log in.
function isPublicRoute(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  return /^\/player\/[^/]+/i.test(window.location?.pathname || '');
}

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const publicRoute = isPublicRoute();
  // Onboarding gates (run in order):
  //   1. needsProfile: authenticated but missing name → show ProfileSetup
  //   2. needsCity:    authenticated, has name, no city → show CityPicker
  // Once both are filled, the user lands in AppTabs.
  const needsProfile = isAuthenticated && !user?.fullName;
  const needsCity = isAuthenticated && !needsProfile && !user?.city;

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

  // Web deep-linking: map /player/:userId → PublicPlayerRecap screen
  const linking = Platform.OS === 'web' ? {
    prefixes: [
      typeof window !== 'undefined' ? window.location.origin : '',
    ],
    config: {
      screens: {
        PublicPlayerRecap: 'player/:userId',
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
        ) : !isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : needsProfile ? (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen as any} />
        ) : needsCity ? (
          <Stack.Screen name="CityPicker" component={CityPickerScreen} />
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
