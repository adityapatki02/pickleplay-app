import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { Colors, Fonts } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const { setLoading } = useAuthStore();

  // Animation drivers
  const glyphOpacity = useRef(new Animated.Value(0)).current;
  const glyphScale = useRef(new Animated.Value(0.85)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordShift = useRef(new Animated.Value(14)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Glyph fades + scales in
      Animated.parallel([
        Animated.timing(glyphOpacity, {
          toValue: 1, duration: 500, useNativeDriver: true,
        }),
        Animated.spring(glyphScale, {
          toValue: 1, friction: 7, tension: 60, useNativeDriver: true,
        }),
      ]),
      // 2. Wordmark fades up
      Animated.parallel([
        Animated.timing(wordOpacity, {
          toValue: 1, duration: 450, useNativeDriver: true,
        }),
        Animated.timing(wordShift, {
          toValue: 0, duration: 450, useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 3. Lime accent line draws (width is not native-driver compatible)
    Animated.timing(lineWidth, {
      toValue: 1, duration: 600, delay: 650, useNativeDriver: false,
    }).start();

    // Hold on the brand, then move on. Auth-state restore + routing is
    // handled in Plan 1B; for now this preserves the existing behaviour.
    const timer = setTimeout(() => {
      setLoading(false);
      navigation.replace('PhoneInput');
    }, 2100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.Image
          source={require('../../../assets/Logo.png')}
          style={[
            styles.glyph,
            { opacity: glyphOpacity, transform: [{ scale: glyphScale }] },
          ]}
          resizeMode="contain"
        />
        <Animated.Image
          source={require('../../../assets/name_logo.png')}
          style={[
            styles.wordmark,
            { opacity: wordOpacity, transform: [{ translateY: wordShift }] },
          ]}
          resizeMode="contain"
        />
        <Animated.View
          style={[
            styles.accentLine,
            {
              width: lineWidth.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 48],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.tagline}>RACKET SPORTS, ORGANIZED</Text>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  glyph: {
    width: 96,
    height: 96,
  },
  wordmark: {
    width: 200,
    height: 56,
    marginTop: 12,
  },
  accentLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.lime,
    marginTop: 20,
  },
  tagline: {
    position: 'absolute',
    bottom: 56,
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.muted,
  },
});
