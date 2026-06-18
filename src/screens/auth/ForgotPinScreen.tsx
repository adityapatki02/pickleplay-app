import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Animated,
  Image,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth.api';
import { YColors, YFonts } from '../../config/yoiden';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPin'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OTP_LENGTH = 6;

const STEP_EYEBROW = ['STEP 1 OF 3', 'STEP 2 OF 3', 'STEP 3 OF 3'];
const STEP_TITLE   = ['FORGOT', 'VERIFY', 'SET A'];
const STEP_ACCENT  = ['YOUR PIN?', 'YOUR PHONE.', 'NEW PIN.'];
const STEP_SUB = [
  "Enter your registered phone number and we'll send a one-time code via SMS.",
  "Enter the 6-digit code we just sent to your number.",
  "Choose a new 6-digit PIN. You'll use this to log in next time.",
];

export const ForgotPinScreen: React.FC<Props> = ({ navigation, route }) => {
  const { login } = useAuthStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState(route.params?.phone ?? '');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [resetToken, setResetToken] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const fadeIn  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeIn]);

  // countdown on step 2
  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, resendTimer]);

  // — Step 1 helpers —
  const normalizedPhone = phone.startsWith('+91') ? phone : `+91${phone.replace(/^0/, '')}`;
  const phoneOk = /^[0-9]{10}$/.test(phone.trim());

  const handleSendOtp = async () => {
    if (!phoneOk || loading) return;
    setError('');
    setLoading(true);
    try {
      await authApi.sendForgotPinOtp({ phone: normalizedPhone });
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setStep(2);
      setResendTimer(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Could not send OTP. Please try again.';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      await authApi.sendForgotPinOtp({ phone: normalizedPhone });
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setResendTimer(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Could not resend OTP.';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  // — Step 2 helpers —
  const otp = otpDigits.join('');
  const otpComplete = otp.length === OTP_LENGTH;

  const handleOtpChange = useCallback((value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setError('');
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  }, [otpDigits]);

  const handleOtpKeyPress = useCallback((e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }, [otpDigits]);

  // Verify OTP immediately on NEXT — consumes the MSG91 OTP and gets an
  // internal reset token so step 3 doesn't need to re-call MSG91.
  const handleOtpNext = async () => {
    if (!otpComplete || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.checkForgotPinOtp({ phone: normalizedPhone, otp });
      setResetToken(res.data.data.resetToken);
      setStep(3);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Invalid OTP. Please try again.';
      setError(Array.isArray(msg) ? msg[0] : msg);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  // — Step 3 helpers —
  const pinOk = newPin.length === 6 && /^[0-9]+$/.test(newPin);
  const confirmOk = confirmPin === newPin && confirmPin.length === 6;
  const canReset = pinOk && confirmOk && !loading;

  const handleReset = async () => {
    if (!canReset) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.resetPinWithToken({ resetToken, newPin });
      login(res.data.data.user, res.data.data.accessToken);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Could not reset PIN. Please try again.';
      setError(Array.isArray(msg) ? msg[0] : msg);
      if (err?.response?.status === 401) {
        // Reset token expired (10 min window) — restart from OTP
        setStep(2);
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setResetToken('');
      }
    } finally {
      setLoading(false);
    }
  };

  const stepIdx = step - 1;

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo header */}
          <View style={s.logoHeader}>
            <View style={s.sideStripe} />
            <Image source={require('../../../assets/Logo.png')} style={s.iconMark} resizeMode="contain" />
            <Image source={require('../../../assets/name_logo.png')} style={s.wordMark} resizeMode="contain" />
          </View>

          <Animated.View style={[s.body, { opacity: fadeIn }]}>
            <Text style={s.eyebrow}>{STEP_EYEBROW[stepIdx]}</Text>
            <Text style={s.title}>{STEP_TITLE[stepIdx]}</Text>
            <Text style={s.titleAccent}>{STEP_ACCENT[stepIdx]}</Text>
            <Text style={s.subtitle}>{STEP_SUB[stepIdx]}</Text>

            {/* ── Step 1: Phone entry ── */}
            {step === 1 && (
              <>
                <View style={s.field}>
                  <Text style={s.label}>PHONE NUMBER</Text>
                  <View style={s.phoneRow}>
                    <View style={s.countryBadge}>
                      <Text style={s.countryText}>+91</Text>
                    </View>
                    <TextInput
                      style={[s.input, s.phoneInput]}
                      value={phone}
                      onChangeText={t => { setPhone(t.replace(/[^0-9]/g, '').slice(0, 10)); setError(''); }}
                      placeholder="10-digit number"
                      placeholderTextColor={YColors.ink3}
                      keyboardType="number-pad"
                      maxLength={10}
                      returnKeyType="done"
                      onSubmitEditing={handleSendOtp}
                      editable={!loading}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[s.primaryBtn, (!phoneOk || loading) && s.btnDisabled]}
                  onPress={handleSendOtp}
                  disabled={!phoneOk || loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={YColors.bg} size="small" />
                    : <Text style={s.primaryBtnText}>SEND OTP</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 2: OTP entry ── */}
            {step === 2 && (
              <>
                <View style={s.otpRow}>
                  {otpDigits.map((digit, i) => (
                    <React.Fragment key={i}>
                      {i === 3 && <View style={s.otpDash}><Text style={s.otpDashText}>—</Text></View>}
                      <TextInput
                        ref={ref => { otpRefs.current[i] = ref; }}
                        style={[s.otpBox, digit ? s.otpBoxFilled : null]}
                        value={digit}
                        onChangeText={v => handleOtpChange(v, i)}
                        onKeyPress={e => handleOtpKeyPress(e, i)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                        editable={!loading}
                      />
                    </React.Fragment>
                  ))}
                </View>

                <View style={s.resendRow}>
                  {resendTimer > 0 ? (
                    <Text style={s.resendTimer}>Resend in {resendTimer}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend} disabled={loading}>
                      <Text style={s.resendLink}>Resend OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[s.primaryBtn, (!otpComplete || loading) && s.btnDisabled]}
                  onPress={handleOtpNext}
                  disabled={!otpComplete || loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={YColors.bg} size="small" />
                    : <Text style={s.primaryBtnText}>VERIFY OTP</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={s.linkRow} onPress={() => setStep(1)} disabled={loading}>
                  <Text style={s.linkText}>← Change phone number</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 3: New PIN ── */}
            {step === 3 && (
              <>
                <View style={s.field}>
                  <Text style={s.label}>NEW 6-DIGIT PIN</Text>
                  <TextInput
                    style={s.input}
                    value={newPin}
                    onChangeText={t => { setNewPin(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                    placeholder="• • • • • •"
                    placeholderTextColor={YColors.ink3}
                    keyboardType="number-pad"
                    maxLength={6}
                    secureTextEntry
                    returnKeyType="next"
                    editable={!loading}
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>CONFIRM PIN</Text>
                  <TextInput
                    style={s.input}
                    value={confirmPin}
                    onChangeText={t => { setConfirmPin(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                    placeholder="• • • • • •"
                    placeholderTextColor={YColors.ink3}
                    keyboardType="number-pad"
                    maxLength={6}
                    secureTextEntry
                    returnKeyType="done"
                    editable={!loading}
                    onSubmitEditing={canReset ? handleReset : undefined}
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                  {!!confirmPin && !confirmOk && (
                    <Text style={s.warnHint}>PINs don't match</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[s.primaryBtn, !canReset && s.btnDisabled]}
                  onPress={handleReset}
                  disabled={!canReset}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={YColors.bg} size="small" />
                    : <Text style={s.primaryBtnText}>RESET PIN & LOG IN</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={s.linkRow} onPress={() => setStep(2)} disabled={loading}>
                  <Text style={s.linkText}>← Back to OTP</Text>
                </TouchableOpacity>
              </>
            )}

            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>⚠ {error}</Text>
              </View>
            )}

            <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading} style={s.linkRow}>
              <Text style={s.linkText}>
                Remembered it?{' '}
                <Text style={s.linkAction}>Back to log in</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPinScreen;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: YColors.bg },
  scroll: { flexGrow: 1 },

  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: YColors.bg,
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
    position: 'relative',
  },
  sideStripe: {
    position: 'absolute',
    left: 20,
    top: 24,
    bottom: 24,
    width: 4,
    backgroundColor: YColors.lime,
  },
  iconMark: {
    width: Math.min(SCREEN_WIDTH * 0.16, 64),
    height: Math.min(SCREEN_WIDTH * 0.16, 64),
  },
  wordMark: {
    width: Math.min(SCREEN_WIDTH * 0.46, 184),
    height: Math.min(SCREEN_WIDTH * 0.16, 64),
  },

  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 32,
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
    marginBottom: 32,
    lineHeight: 20,
  },

  field: { marginBottom: 18 },
  label: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 10,
    color: YColors.ink2,
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: YColors.bg2,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: YColors.line2,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: YFonts.uiSemibold,
    fontSize: 16,
    color: YColors.ink,
  },
  warnHint: {
    fontFamily: YFonts.uiSemibold,
    fontSize: 11,
    color: YColors.live,
    marginTop: 6,
  },

  // Phone row
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countryBadge: {
    backgroundColor: YColors.bg2,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: YColors.line2,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  countryText: {
    fontFamily: YFonts.uiSemibold,
    fontSize: 16,
    color: YColors.ink,
  },
  phoneInput: { flex: 1 },

  // OTP boxes
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: YColors.line2,
    backgroundColor: YColors.bg2,
    textAlign: 'center',
    fontFamily: YFonts.uiExtrabold,
    fontSize: 20,
    color: YColors.ink,
  },
  otpBoxFilled: {
    borderColor: YColors.accent,
    backgroundColor: 'rgba(200,242,50,0.1)',
  },
  otpDash: { paddingHorizontal: 2 },
  otpDashText: { color: YColors.ink3, fontSize: 16 },

  resendRow: { alignItems: 'center', marginBottom: 20 },
  resendTimer: { fontFamily: YFonts.ui, fontSize: 13, color: YColors.ink3 },
  resendLink: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 13,
    color: YColors.accent,
    letterSpacing: 0.5,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: YColors.ink,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.35 },
  primaryBtnText: {
    fontFamily: YFonts.uiBlack,
    fontSize: 14,
    color: YColors.bg,
    letterSpacing: 2,
  },

  errorBox: {
    backgroundColor: 'rgba(255,61,92,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,61,92,0.35)',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  errorText: {
    fontFamily: YFonts.uiSemibold,
    fontSize: 13,
    color: YColors.live,
  },

  linkRow: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  linkText: { fontFamily: YFonts.ui, fontSize: 13, color: YColors.ink2 },
  linkAction: { fontFamily: YFonts.uiExtrabold, color: YColors.accent },
});
