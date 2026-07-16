import { useEffect, useCallback } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { RazorpayCheckoutHost } from './src/components/RazorpayCheckoutHost';
import { YoidenFontMap } from './src/config/yoiden-fonts';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts(YoidenFontMap);

  // On web, React Navigation auto-syncs document.title to the active screen name
  // (e.g. "PhoneInput"), which then leaks into iOS "Add to Home Screen".
  // Pin the title to "Yoiden" on every navigation change.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const APP_TITLE = 'Yoiden';
    document.title = APP_TITLE;
    const observer = new MutationObserver(() => {
      if (document.title !== APP_TITLE) document.title = APP_TITLE;
    });
    const titleEl = document.querySelector('title');
    if (titleEl) observer.observe(titleEl, { childList: true });
    return () => observer.disconnect();
  }, []);

  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StatusBar style="dark" />
      <RootNavigator />
      {/* App-root Razorpay WebView checkout overlay (driven imperatively). */}
      <RazorpayCheckoutHost />
    </View>
  );
}
