import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { PhoneInputScreen } from '../screens/auth/PhoneInputScreen';
import { ProfileSetupScreen } from '../screens/auth/ProfileSetupScreen';
import { CityPickerScreen } from '../screens/auth/CityPickerScreen';
import { ForgotPinScreen } from '../screens/auth/ForgotPinScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        title: 'Yoiden',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} options={{ title: 'Yoiden' }} />
      <Stack.Screen name="PhoneInput" component={PhoneInputScreen} options={{ title: 'Yoiden' }} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ title: 'Yoiden' }} />
      <Stack.Screen name="CityPicker" component={CityPickerScreen} options={{ title: 'Yoiden' }} />
      <Stack.Screen name="ForgotPin" component={ForgotPinScreen} options={{ title: 'Yoiden' }} />
    </Stack.Navigator>
  );
};
