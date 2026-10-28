import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';

/**
 * Result pushes for followed events. On sign-in (phones only, not web or simulators) the
 * app asks for permission and saves this device's Expo push token against the phone
 * number (`POST /app/me/push-token`); the server sends one push per finished match of
 * every followed event. Signing out removes the token, so the device stops getting them.
 */
const native = Platform.OS !== 'web';

if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

let current: string | null = null;

async function register() {
  if (!native || !Device.isDevice) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('results', { name: 'Match results', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const perm = await Notifications.getPermissionsAsync();
  const status = perm.granted ? 'granted' : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  current = token;
  await apiClient.post('/app/me/push-token', { token, platform: Platform.OS });
}

async function unregister(authToken: string) {
  if (!current) return;
  const token = current;
  current = null;
  await apiClient.delete(`/app/me/push-token/${encodeURIComponent(token)}`, { headers: { Authorization: `Bearer ${authToken}` } });
}

// Register at start-up when already signed in, and on every sign-in; drop on sign-out.
if (useAuthStore.getState().token) register().catch(() => {});
useAuthStore.subscribe((s, prev) => {
  if (s.token && s.token !== prev.token) register().catch(() => {});
  if (!s.token && prev.token) unregister(prev.token).catch(() => {});
});

/** Opens the match (or the event) when a result push is tapped. Mounted inside the v2 navigator. */
export const usePushTaps = native ? usePushTapsNative : () => {};

function usePushTapsNative() {
  const nav = useNavigation<any>();
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const data = last?.notification.request.content.data as { eventId?: string; matchId?: string } | undefined;
    if (!data?.eventId) return;
    if (data.matchId) nav.navigate('Match', { eventId: data.eventId, matchId: data.matchId });
    else nav.navigate('Event', { id: data.eventId });
  }, [last, nav]);
}
