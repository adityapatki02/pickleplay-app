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
import { openMsg91Widget } from '../../config/msg91';
import { YColors, YFonts } from '../../config/yoiden';


type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneInput'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OTP_LENGTH = 6;
const IS_WEB = Platform.OS === 'web';
type Mode = 'login' | 'register';
// register flow: form → (web: widget inline) | (native: otp step) → done
type RegisterStep = 'form' | 'otp';

export const PhoneInputScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuthStore();

  const [mode, setMode]         = useState<Mode>('login');
  const [regStep, setRegStep]   = useState<RegisterStep>('form');

  // Form fields
  const [phone, setPhone] = useState('');
  const [pin, setPin]     = useState('');
  const [name, setName]   = useState('');

  // OTP (native register only)
  const [otpDigits, setOtpDigits]   = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef<(TextInput | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeIn]);


  // Resend countdown
  useEffect(() => {
    if (IS_WEB || regStep !== 'otp' || resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [regStep, resendTimer]);

  const fullPhone = `+91${phone}`;
  const phoneOk  = phone.length === 10 && /^[0-9]+$/.test(phone);
  const pinOk    = pin.length === 6 && /^[0-9]+$/.test(pin);
  const nameOk   = mode === 'login' || name.trim().length >= 2;
  const formOk   = phoneOk && pinOk && nameOk;

  // ─── Login ────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!formOk || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.phoneLogin({ phone: fullPhone, pin });
      login(res.data.data.user, res.data.data.accessToken);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Something went wrong. Please try again.';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Register: create account (called after OTP verified) ────────────────

  const createAccount = async (token: { accessToken: string } | { verificationToken: string }) => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.phoneRegister({
        phone: fullPhone,
        pin,
        name: name.trim(),
        role: 'player',
        ...token,
      });
      login(res.data.data.user, res.data.data.accessToken);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Could not create account. Please try again.';
      setError(Array.isArray(msg) ? msg[0] : msg);
      if (err?.response?.status === 400 || err?.response?.status === 401) {
        setRegStep('form');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Register: web — widget verifies then creates account ─────────────────

  const handleWebRegister = async () => {
    if (!formOk || loading) return;
    setError('');
    setLoading(true);
    try {
      const token = await openMsg91Widget(fullPhone);
      await createAccount({ accessToken: token });
    } catch (err: any) {
      setError(err?.message ?? 'Verification cancelled. Please try again.');
      setLoading(false);
    }
  };

  // ─── Register: native — send OTP via backend ──────────────────────────────

  const handleSendOtp = async () => {
    if (!formOk || loading) return;
    setError('');
    setLoading(true);
    try {
      await authApi.sendPhoneOtp({ phone: fullPhone });
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setRegStep('otp');
      setResendTimer(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Could not send OTP. Please try again.';
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
      await authApi.sendPhoneOtp({ phone: fullPhone });
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setResendTimer(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Could not resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Register: native — verify OTP, then create account ──────────────────

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

  const handleOtpVerify = async () => {
    if (!otpComplete || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.verifyPhoneOtp({ phone: fullPhone, otp });
      await createAccount({ verificationToken: res.data.data.verificationToken });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Invalid OTP. Please try again.';
      setError(Array.isArray(msg) ? msg[0] : msg);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
      setLoading(false);
    }
  };

  // ─── Mode switch ──────────────────────────────────────────────────────────

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setRegStep('form');
    setError('');
    setPin('');
    setName('');
    setOtpDigits(Array(OTP_LENGTH).fill(''));
  };

  // ─── Derived header text ─────────────────────────────────────────────────

  const isOtpStep = mode === 'register' && !IS_WEB && regStep === 'otp';

  const eyebrow   = isOtpStep ? 'VERIFY PHONE' : (mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT');
  const titleMain = isOtpStep ? 'VERIFY' : (mode === 'login' ? 'WELCOME' : "LET'S");
  const titleAccent = isOtpStep ? 'YOUR PHONE.' : (mode === 'login' ? 'BACK.' : 'GET YOU IN.');
  const subtitle  = isOtpStep
    ? "Enter the 6-digit code we just sent to your number."
    : (mode === 'login'
        ? "Phone + PIN. That's it."
        : 'Create your account to find and join tournaments.');

  // ─── Render ───────────────────────────────────────────────────────────────

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
            <Image
              source={require('../../../assets/Logo.png')}
              style={s.iconMark}
              resizeMode="contain"
            />
            <Image
              source={require('../../../assets/name_logo.png')}
              style={s.wordMark}
              resizeMode="contain"
            />
          </View>

          <Animated.View style={[s.body, { opacity: fadeIn }]}>
            <Text style={s.eyebrow}>{eyebrow}</Text>
            <Text style={s.title}>{titleMain}</Text>
            <Text style={s.titleAccent}>{titleAccent}</Text>
            <Text style={s.subtitle}>{subtitle}</Text>

            {/* ── Native register: OTP step ── */}
            {isOtpStep ? (
              <>
                <View style={s.otpRow}>
                  {otpDigits.map((digit, i) => (
                    <React.Fragment key={i}>
                      {i === 3 && (
                        <View style={s.otpDash}>
                          <Text style={s.otpDashText}>—</Text>
                        </View>
                      )}
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
                  style={[s.submitBtn, (!otpComplete || loading) && s.submitBtnDisabled]}
                  onPress={handleOtpVerify}
                  disabled={!otpComplete || loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={YColors.bg} size="small" />
                    : <Text style={s.submitText}>VERIFY & CREATE ACCOUNT</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.switchLink}
                  onPress={() => { setRegStep('form'); setError(''); }}
                  disabled={loading}
                >
                  <Text style={s.switchText}>
                    ← <Text style={s.switchLinkText}>Back to form</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Name (register only) */}
                {mode === 'register' && (
                  <View style={s.field}>
                    <Text style={s.label}>YOUR NAME</Text>
                    <TextInput
                      style={s.input}
                      value={name}
                      onChangeText={t => { setName(t); setError(''); }}
                      placeholder="e.g. Alex Kumar"
                      placeholderTextColor={YColors.ink3}
                      autoCapitalize="words"
                      returnKeyType="next"
                      editable={!loading}
                    />
                  </View>
                )}

                {/* Phone */}
                <View style={s.field}>
                  <Text style={s.label}>PHONE NUMBER</Text>
                  <View style={s.phoneRow}>
                    <View style={s.countryBox}>
                      <Text style={s.countryText}>🇮🇳 +91</Text>
                    </View>
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      value={phone}
                      onChangeText={t => { setPhone(t.replace(/[^0-9]/g, '').slice(0, 10)); setError(''); }}
                      placeholder="98765 43210"
                      placeholderTextColor={YColors.ink3}
                      keyboardType="number-pad"
                      maxLength={10}
                      returnKeyType="next"
                      editable={!loading}
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      {...(IS_WEB ? { nativeID: 'yoiden-phone', name: 'phone' } as any : {})}
                    />
                  </View>
                </View>

                {/* PIN */}
                <View style={s.field}>
                  <Text style={s.label}>6-DIGIT PIN</Text>
                  <TextInput
                    style={s.input}
                    value={pin}
                    onChangeText={t => { setPin(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                    placeholder="• • • • • •"
                    placeholderTextColor={YColors.ink3}
                    keyboardType="number-pad"
                    maxLength={6}
                    secureTextEntry
                    returnKeyType="done"
                    editable={!loading}
                    onSubmitEditing={
                      formOk
                        ? (mode === 'login' ? handleLogin : (IS_WEB ? handleWebRegister : handleSendOtp))
                        : undefined
                    }
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    textContentType={mode === 'register' ? 'newPassword' : 'password'}
                    {...(IS_WEB ? { nativeID: 'yoiden-pin', name: 'password' } as any : {})}
                  />
                  <Text style={s.hint}>
                    {mode === 'register'
                      ? "Remember this PIN — you'll use it to log in"
                      : 'Enter the PIN you chose when signing up'}
                  </Text>
                  {mode === 'login' && (
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('ForgotPin', {
                          phone: phone.length === 10 ? phone : undefined,
                        })
                      }
                      disabled={loading}
                      style={s.forgotRow}
                      activeOpacity={0.7}
                    >
                      <Text style={s.forgotText}>Forgot your PIN?</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!!error && (
                  <View style={s.errorBox}>
                    <Text style={s.errorText}>⚠ {error}</Text>
                  </View>
                )}

                {/* Submit */}
                <TouchableOpacity
                  style={[s.submitBtn, (!formOk || loading) && s.submitBtnDisabled]}
                  onPress={
                    mode === 'login'
                      ? handleLogin
                      : (IS_WEB ? handleWebRegister : handleSendOtp)
                  }
                  disabled={!formOk || loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={YColors.bg} size="small" />
                  ) : (
                    <Text style={s.submitText}>
                      {mode === 'login'
                        ? 'LOG IN'
                        : (IS_WEB ? 'VERIFY & CREATE ACCOUNT' : 'SEND OTP')}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Mode switch */}
                <TouchableOpacity onPress={switchMode} disabled={loading} style={s.switchLink}>
                  <Text style={s.switchText}>
                    {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <Text style={s.switchLinkText}>
                      {mode === 'login' ? 'Sign up' : 'Log in'}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default PhoneInputScreen;

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
    fontSize: 48,
    fontStyle: 'italic',
    color: YColors.ink,
    letterSpacing: 0.5,
    lineHeight: 52,
  },
  titleAccent: {
    fontFamily: YFonts.display,
    fontSize: 48,
    fontStyle: 'italic',
    color: YColors.accent,
    letterSpacing: 0.5,
    lineHeight: 52,
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
  phoneRow: { flexDirection: 'row', gap: 10 },
  countryBox: {
    backgroundColor: YColors.bg2,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: YColors.line2,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  countryText: {
    fontFamily: YFonts.uiBold,
    fontSize: 15,
    color: YColors.ink,
  },
  hint: {
    fontFamily: YFonts.ui,
    fontSize: 11,
    color: YColors.ink3,
    marginTop: 6,
  },
  forgotRow: { marginTop: 10, alignSelf: 'flex-start' },
  forgotText: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 12,
    color: YColors.accent,
    letterSpacing: 0.5,
  },

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
    backgroundColor: 'rgba(24,88,214,0.08)',
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

  errorBox: {
    backgroundColor: 'rgba(255,61,92,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,61,92,0.35)',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  errorText: {
    fontFamily: YFonts.uiSemibold,
    fontSize: 13,
    color: YColors.live,
  },

  submitBtn: {
    backgroundColor: YColors.ink,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnDisabled: { opacity: 0.35 },
  submitText: {
    fontFamily: YFonts.uiBlack,
    fontSize: 14,
    color: YColors.bg,
    letterSpacing: 2,
  },

  switchLink: { marginTop: 20, alignItems: 'center', paddingVertical: 8 },
  switchText: {
    fontFamily: YFonts.ui,
    fontSize: 13,
    color: YColors.ink2,
  },
  switchLinkText: {
    fontFamily: YFonts.uiExtrabold,
    color: YColors.accent,
  },
});
