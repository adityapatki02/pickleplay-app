import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  Animated,
  Image,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius, shadows } from '../../config/theme';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneInput'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NAVY = '#001E40';
const BLUE_ACCENT = '#2196F3';
const LOGO_HEIGHT = 200;

export const PhoneInputScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [countryCode] = useState('+91');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const isValid = phone.length === 10;

  const handleSendOtp = async () => {
    if (!isValid) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const verificationId = 'mock-verification-id';
      navigation.navigate('OTPVerify', {
        phone: `${countryCode}${phone}`,
        verificationId,
      });
    } catch {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.outerContainer}>
      {/* Top half — dark navy, logo full-width edge-to-edge */}
      <View style={styles.logoSection}>
        <View style={styles.logoRow}>
          <Image source={require('../../../assets/Logo.png')} style={styles.iconMark} resizeMode="contain" />
          <Image source={require('../../../assets/name_logo.png')} style={styles.wordMark} resizeMode="contain" />
        </View>
      </View>

      {/* Bottom half — white card slides up over navy */}
      <KeyboardAvoidingView
        style={styles.cardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View
          style={[
            styles.card,
            { opacity: fadeIn, transform: [{ translateY: slideUp }] },
          ]}
        >
          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>GET ON{'\n'}THE COURT.</Text>
            <Text style={styles.subtitle}>
              Enter your phone number to sign in or create your player profile
            </Text>
          </View>

          {/* Phone Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>PHONE NUMBER</Text>
            <View
              style={[
                styles.phoneContainer,
                isFocused && styles.phoneContainerFocused,
                error ? styles.phoneContainerError : null,
              ]}
            >
              <View style={styles.countrySection}>
                <Text style={styles.flag}>🇮🇳</Text>
                <Text style={styles.countryCodeText}>{countryCode}</Text>
                <View style={styles.codeDivider} />
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter 10-digit number"
                placeholderTextColor={colors.textTertiary}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text.replace(/[^0-9]/g, ''));
                  setError('');
                }}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
              {isValid && (
                <View style={styles.checkMark}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </View>
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <Text style={styles.hintText}>
                We'll send a verification code via SMS
              </Text>
            )}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.ctaButton, !isValid && styles.ctaButtonDisabled]}
            onPress={handleSendOtp}
            disabled={!isValid || loading}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>
              {loading ? 'SENDING...' : 'CONTINUE'}
            </Text>
            {!loading && <Text style={styles.ctaArrow}>→</Text>}
          </TouchableOpacity>

          {/* Feature chips — athletic style */}
          <View style={styles.featuresRow}>
            {[
              { label: 'SMART SCHEDULING' },
              { label: 'ELO RATINGS' },
              { label: 'LIVE SCORES' },
            ].map((feature, i) => (
              <View key={i} style={styles.featureChip}>
                <Text style={styles.featureLabel}>{feature.label}</Text>
              </View>
            ))}
          </View>

          {/* Dev bypass — remove in production */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devBypass}
              onPress={() => {
                login(
                  {
                    id: 'dev-user-1',
                    firebaseUid: 'dev-uid',
                    phone: '+919876543210',
                    fullName: 'Alex Player',
                    displayName: 'Alex',
                    role: 'player',
                    selfReportedSkill: 'advanced',
                    isVerified: true,
                    whatsappOptedIn: true,
                    city: 'Mumbai',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                  'dev-token-123',
                );
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.devBypassText}>⚡ DEV: SKIP LOGIN (PLAYER)</Text>
            </TouchableOpacity>
          )}
          {__DEV__ && (
            <TouchableOpacity
              style={[styles.devBypass, { borderColor: BLUE_ACCENT }]}
              onPress={() => {
                login(
                  {
                    id: 'dev-org-1',
                    firebaseUid: 'dev-uid-org',
                    phone: '+919876543211',
                    fullName: 'Alex Organizer',
                    displayName: 'Alex',
                    role: 'organizer',
                    selfReportedSkill: 'pro',
                    isVerified: true,
                    whatsappOptedIn: true,
                    city: 'Mumbai',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                  'dev-token-456',
                );
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.devBypassText, { color: BLUE_ACCENT }]}>⚡ DEV: SKIP LOGIN (ORGANIZER)</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.terms}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' and '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    minHeight: SCREEN_HEIGHT,
    backgroundColor: '#FFFFFF',
  },
  // Logo section — white background so logo renders correctly
  logoSection: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: LOGO_HEIGHT,
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    justifyContent: 'center',
    alignItems: 'center',
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
  // Navy card with rounded top corners
  cardWrapper: {
    flex: 1,
    minHeight: SCREEN_HEIGHT - LOGO_HEIGHT,
  },
  card: {
    flex: 1,
    minHeight: SCREEN_HEIGHT - LOGO_HEIGHT,
    backgroundColor: NAVY,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  titleSection: {
    marginBottom: spacing['2xl'],
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    lineHeight: 40,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: spacing.xl,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: spacing.sm,
    letterSpacing: 2,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing.base,
    height: 58,
  },
  phoneContainerFocused: {
    borderColor: BLUE_ACCENT,
    shadowColor: BLUE_ACCENT,
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  phoneContainerError: {
    borderColor: colors.error,
  },
  countrySection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 20,
    marginRight: 6,
  },
  countryCodeText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  codeDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.md,
  },
  phoneInput: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  checkMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  hintText: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.4)',
    marginTop: spacing.sm,
  },
  ctaButton: {
    backgroundColor: BLUE_ACCENT,
    borderRadius: borderRadius.lg,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  ctaButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowOpacity: 0,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 2,
  },
  ctaArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing['2xl'],
    flexWrap: 'wrap',
  },
  featureChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  featureLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  terms: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 18,
  },
  termsLink: {
    color: BLUE_ACCENT,
    fontWeight: '600',
  },
  devBypass: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  devBypassText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
  },
});
