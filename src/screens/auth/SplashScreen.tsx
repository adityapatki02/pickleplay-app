import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

const { width } = Dimensions.get('window');

const NAVY = '#001E40';
const BLUE_ACCENT = '#2196F3';

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
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeIn, transform: [{ translateY: slideUp }] },
        ]}
      >
        {/* Logo — icon mark + wordmark side by side */}
        <View style={styles.logoBg}>
          <View style={styles.logoRow}>
            <Image source={require('../../../assets/Logo.png')} style={styles.iconMark} resizeMode="contain" />
            <Image source={require('../../../assets/name_logo.png')} style={styles.wordMark} resizeMode="contain" />
          </View>
        </View>

        {/* Blue accent divider */}
        <View style={styles.divider} />

        <Text style={styles.tagline}>SCHEDULE. COMPETE. DOMINATE.</Text>
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
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
  },
  logoBg: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  iconMark: {
    width: 80,
    height: 80,
  },
  wordMark: {
    width: 200,
    height: 80,
    marginLeft: 8,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: BLUE_ACCENT,
    marginTop: 24,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 80,
    width: 140,
    alignItems: 'center',
  },
  loadingTrack: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  loadingFill: {
    height: '100%',
    backgroundColor: BLUE_ACCENT,
    borderRadius: 1,
  },
});
