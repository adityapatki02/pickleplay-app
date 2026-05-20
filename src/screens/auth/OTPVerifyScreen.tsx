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
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth.api';
import { YColors, YFonts } from '../../config/yoiden';

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
    <SafeAreaView style={s.container}>
      {/* Editorial header */}
      <View style={s.header}>
        <View style={s.sideStripe} />
        <TouchableOpacity
          style={s.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={s.backArrow}>←</Text>
          <Text style={s.backLabel}>BACK</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={s.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View
          style={[
            s.content,
            { opacity: fadeIn, transform: [{ translateY: slideUp }] },
          ]}
        >
          <Text style={s.eyebrow}>STEP 2</Text>
          <Text style={s.title}>VERIFICATION</Text>
          <Text style={s.titleAccent}>CODE.</Text>
          <Text style={s.subtitle}>We sent a 6-digit code to</Text>
          <View style={s.phoneBadge}>
            <Text style={s.phoneText}>{maskedPhone}</Text>
          </View>

          {/* OTP Inputs */}
          <Animated.View
            style={[
              s.otpContainer,
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            {otp.map((digit, index) => (
              <View key={index} style={s.otpWrapper}>
                <TextInput
                  ref={(ref) => {
                    if (ref) inputRefs.current[index] = ref;
                  }}
                  style={[
                    s.otpInput,
                    digit ? s.otpInputFilled : null,
                    error ? s.otpInputError : null,
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
                {index === 2 && <View style={s.otpDash} />}
              </View>
            ))}
          </Animated.View>

          {error ? (
            <View style={s.errorRow}>
              <View style={s.errorDot} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              s.verifyButton,
              otp.some((d) => !d) && s.verifyButtonDisabled,
            ]}
            onPress={() => verifyOtp(otp.join(''))}
            disabled={otp.some((d) => !d) || loading}
            activeOpacity={0.85}
          >
            <Text style={s.verifyText}>
              {loading ? 'VERIFYING...' : 'VERIFY & CONTINUE'}
            </Text>
          </TouchableOpacity>

          <View style={s.resendSection}>
            <Text style={s.resendLabel}>Didn't receive the code?</Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendTimer > 0}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  s.resendAction,
                  resendTimer > 0 && s.resendActionDisabled,
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

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: YColors.bg,
  },
  header: {
    backgroundColor: YColors.bg,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 28,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
    position: 'relative',
  },
  sideStripe: {
    position: 'absolute',
    left: 20,
    top: 16,
    bottom: 12,
    width: 4,
    backgroundColor: YColors.lime,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginLeft: 12,
  },
  backArrow: {
    color: YColors.ink2,
    fontSize: 18,
    fontWeight: '600',
  },
  backLabel: {
    fontFamily: YFonts.uiExtrabold,
    color: YColors.ink2,
    fontSize: 10,
    letterSpacing: 2,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  eyebrow: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 11,
    color: YColors.accent,
    letterSpacing: 3,
    marginBottom: 12,
  },
  title: {
    fontFamily: YFonts.display,
    fontSize: 44,
    fontStyle: 'italic',
    color: YColors.ink,
    letterSpacing: 0.5,
    lineHeight: 48,
  },
  titleAccent: {
    fontFamily: YFonts.display,
    fontSize: 44,
    fontStyle: 'italic',
    color: YColors.accent,
    letterSpacing: 0.5,
    lineHeight: 48,
    marginBottom: 14,
  },
  subtitle: {
    fontFamily: YFonts.ui,
    fontSize: 14,
    color: YColors.ink2,
  },
  phoneBadge: {
    backgroundColor: YColors.bg3,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 28,
    alignSelf: 'flex-start',
  },
  phoneText: {
    fontFamily: YFonts.monoBold,
    fontSize: 14,
    color: YColors.ink,
    letterSpacing: 1,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 18,
  },
  otpWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otpInput: {
    width: 48,
    height: 58,
    borderWidth: 1.5,
    borderColor: YColors.line2,
    borderRadius: 8,
    textAlign: 'center',
    fontFamily: YFonts.display,
    fontStyle: 'italic',
    fontSize: 22,
    color: YColors.ink,
    backgroundColor: YColors.bg2,
  },
  otpInputFilled: {
    borderColor: YColors.ink,
    backgroundColor: YColors.bg2,
  },
  otpInputError: {
    borderColor: YColors.live,
    backgroundColor: 'rgba(255,61,92,0.05)',
  },
  otpDash: {
    width: 12,
    height: 2,
    backgroundColor: YColors.ink3,
    marginHorizontal: 4,
    borderRadius: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: YColors.live,
  },
  errorText: {
    fontFamily: YFonts.uiSemibold,
    color: YColors.live,
    fontSize: 13,
  },
  verifyButton: {
    width: '100%',
    backgroundColor: YColors.ink,
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    opacity: 0.35,
  },
  verifyText: {
    fontFamily: YFonts.uiBlack,
    color: YColors.bg,
    fontSize: 14,
    letterSpacing: 2,
  },
  resendSection: {
    alignItems: 'center',
    marginTop: 24,
    gap: 4,
  },
  resendLabel: {
    fontFamily: YFonts.ui,
    fontSize: 13,
    color: YColors.ink3,
  },
  resendAction: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 13,
    color: YColors.accent,
    letterSpacing: 1.5,
  },
  resendActionDisabled: {
    color: YColors.ink3,
  },
});
