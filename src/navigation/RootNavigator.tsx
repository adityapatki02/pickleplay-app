import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { YoidenTabNavigator } from './YoidenTabNavigator';
import { useAuthStore } from '../store/authStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthStore();

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

  return (
    <NavigationContainer
      documentTitle={{
        // Lock the web document.title (and iOS "Add to Home Screen" default) to "Yoiden"
        // regardless of the active screen name.
        formatter: () => 'Yoiden',
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, title: 'Yoiden' }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
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
