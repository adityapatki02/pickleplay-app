import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { YColors, YFonts } from '../../config/yoiden';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const { setLoading } = useAuthStore();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Loading bar animation
    Animated.timing(barWidth, {
      toValue: 1,
      duration: 1800,
      useNativeDriver: false,
    }).start();

    const checkAuth = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch {
        // No valid session
      } finally {
        setLoading(false);
        navigation.replace('PhoneInput');
      }
    };
    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      {/* Lime side stripe — editorial chrome */}
      <View style={styles.sideStripe} />

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeIn, transform: [{ translateY: slideUp }] },
        ]}
      >
        {/* Logo — icon mark + wordmark side by side */}
        <View style={styles.logoRow}>
          <Image source={require('../../../assets/Logo.png')} style={styles.iconMark} resizeMode="contain" />
          <Image source={require('../../../assets/name_logo.png')} style={styles.wordMark} resizeMode="contain" />
        </View>

        {/* Accent divider */}
        <View style={styles.divider} />

        <Text style={styles.tagline}>SCHEDULE · COMPETE · DOMINATE</Text>
      </Animated.View>

      {/* Bottom loading bar */}
      <View style={styles.loaderContainer}>
        <View style={styles.loadingTrack}>
          <Animated.View
            style={[
              styles.loadingFill,
              {
                width: barWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: YColors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  sideStripe: {
    position: 'absolute',
    top: 80,
    left: 20,
    width: 4,
    height: 180,
    backgroundColor: YColors.lime,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMark: {
    width: 72,
    height: 72,
  },
  wordMark: {
    width: 200,
    height: 72,
    marginLeft: 8,
  },
  divider: {
    width: 48,
    height: 2,
    backgroundColor: YColors.accent,
    marginTop: 28,
    marginBottom: 14,
  },
  tagline: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 11,
    color: YColors.ink2,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 64,
    width: 140,
    alignItems: 'center',
  },
  loadingTrack: {
    width: '100%',
    height: 2,
    backgroundColor: YColors.line,
    borderRadius: 1,
    overflow: 'hidden',
  },
  loadingFill: {
    height: '100%',
    backgroundColor: YColors.ink,
    borderRadius: 1,
  },
});
