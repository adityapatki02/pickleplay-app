import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { PlayerTabNavigator } from './PlayerTabNavigator';
import { OrganizerTabNavigator } from './OrganizerTabNavigator';
import { useAuthStore } from '../store/authStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : isOrganizer ? (
          <Stack.Screen name="OrgTabs" component={OrganizerTabNavigator} />
        ) : (
          <Stack.Screen name="PlayerTabs" component={PlayerTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
