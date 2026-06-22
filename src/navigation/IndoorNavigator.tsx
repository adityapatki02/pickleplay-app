import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import IndoorOverviewScreen from '../screens/indoor/IndoorOverviewScreen';
import IndoorEventScreen from '../screens/indoor/IndoorEventScreen';
import IndoorManageScreen from '../screens/indoor/IndoorManageScreen';

const Stack = createNativeStackNavigator();
export const IndoorNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="IndoorOverview" component={IndoorOverviewScreen} />
    <Stack.Screen name="IndoorEvent" component={IndoorEventScreen} />
    <Stack.Screen name="IndoorManage" component={IndoorManageScreen} />
  </Stack.Navigator>
);
