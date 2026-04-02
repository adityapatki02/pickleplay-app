import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius, shadows } from '../../config/theme';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth.api';

type Props = NativeStackScreenProps<AuthStackParamList, 'OTPVerify'>;

const OTP_LENGTH = 6;

export const OTPVerifyScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phone } = route.params;
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef<TextInput[]>([]);
  const { login } = useAuthStore();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((d) => d) && newOtp.join('').length === OTP_LENGTH) {
      verifyOtp(newOtp.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      const firebaseIdToken = 'mock-firebase-token';
      const response = await authApi.verifyOtp({ firebaseIdToken });
      const { user, accessToken, isNewUser } = response.data.data;
      login(user, accessToken);
      if (isNewUser) {
        navigation.replace('ProfileSetup');
      }
    } catch {
      setError('Invalid OTP. Please try again.');
      triggerShake();
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (resendTimer > 0) return;
    setResendTimer(30);
  };

  const maskedPhone = phone.replace(
    /(\+\d{2})(\d{3})(\d{3})(\d{4})/,
    '$1 $2 •••• $4',
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Navy header */}
      <View style={styles.headerAccent}>
        <View style={styles.headerGlow} />
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>BACK</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeIn, transform: [{ translateY: slideUp }] },
          ]}
        >
          {/* Lock icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconBg}>
              <Text style={styles.iconEmoji}>🔐</Text>
            </View>
          </View>

          {/* Header */}
          <Text style={styles.title}>VERIFICATION{'\n'}CODE</Text>
          <Text style={styles.subtitle}>We sent a 6-digit code to</Text>
          <View style={styles.phoneBadge}>
            <Text style={styles.phoneText}>{maskedPhone}</Text>
          </View>

          {/* OTP Inputs */}
          <Animated.View
            style={[
              styles.otpContainer,
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            {otp.map((digit, index) => (
              <View key={index} style={styles.otpWrapper}>
                <TextInput
                  ref={(ref) => {
                    if (ref) inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.otpInput,
                    digit ? styles.otpInputFilled : null,
                    error ? styles.otpInputError : null,
                  ]}
                  value={digit}
                  onChangeText={(value) =>
                    handleOtpChange(value.replace(/[^0-9]/g, ''), index)
                  }
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
                {index === 2 && <View style={styles.otpDash} />}
              </View>
            ))}
          </Animated.View>

          {error ? (
            <View style={styles.errorRow}>
              <View style={styles.errorDot} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              otp.some((d) => !d) && styles.verifyButtonDisabled,
            ]}
            onPress={() => verifyOtp(otp.join(''))}
            disabled={otp.some((d) => !d) || loading}
            activeOpacity={0.85}
          >
            <Text style={styles.verifyText}>
              {loading ? 'VERIFYING...' : 'VERIFY & CONTINUE'}
            </Text>
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendSection}>
            <Text style={styles.resendLabel}>Didn't receive the code?</Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendTimer > 0}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.resendAction,
                  resendTimer > 0 && styles.resendActionDisabled,
                ]}
              >
                {resendTimer > 0
                  ? `RESEND IN ${resendTimer}S`
                  : 'RESEND CODE'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerAccent: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xl,
    paddingBottom: spacing['3xl'],
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.secondaryContainer,
    opacity: 0.06,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  backArrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '600',
  },
  backLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    paddingTop: spacing['2xl'],
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  iconBg: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  iconEmoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 34,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  phoneBadge: {
    backgroundColor: colors.primaryFixed,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.base,
    borderRadius: 4,
    marginTop: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  phoneText: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: colors.primaryLight,
    letterSpacing: 1,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  otpWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otpInput: {
    width: 48,
    height: 58,
    borderWidth: 1.5,
    borderColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    color: colors.primary,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
  },
  otpInputFilled: {
    borderColor: colors.secondaryContainer,
    backgroundColor: `${colors.secondaryContainer}08`,
  },
  otpInputError: {
    borderColor: colors.error,
    backgroundColor: `${colors.error}08`,
  },
  otpDash: {
    width: 12,
    height: 2,
    backgroundColor: colors.outlineVariant,
    marginHorizontal: 4,
    borderRadius: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
    gap: 6,
  },
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  verifyButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  verifyButtonDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
    shadowOpacity: 0,
  },
  verifyText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 2,
  },
  resendSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: 4,
  },
  resendLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  resendAction: {
    fontSize: typography.fontSize.sm,
    color: colors.secondary,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  resendActionDisabled: {
    color: colors.textTertiary,
    fontWeight: '600',
  },
});
