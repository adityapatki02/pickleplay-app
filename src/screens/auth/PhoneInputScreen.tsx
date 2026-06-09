import React, { useState, useRef, useEffect } from 'react';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneInput'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Mode = 'login' | 'register';

export const PhoneInputScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeIn]);

  const phoneOk = phone.length === 10 && /^[0-9]+$/.test(phone);
  const pinOk = pin.length === 6 && /^[0-9]+$/.test(pin);
  const nameOk = mode === 'login' || name.trim().length >= 2;
  const canSubmit = phoneOk && pinOk && nameOk && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);

    const fullPhone = `+91${phone}`;

    try {
      if (mode === 'register') {
        const res = await authApi.phoneRegister({
          phone: fullPhone,
          pin,
          name: name.trim(),
          role: 'player',
        });
        login(res.data.data.user, res.data.data.accessToken);
      } else {
        const res = await authApi.phoneLogin({ phone: fullPhone, pin });
        login(res.data.data.user, res.data.data.accessToken);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Something went wrong. Please try again.';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setPin('');
    setName('');
  };

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
          {/* ── LOGO HEADER (cream w/ lime stripe) ── */}
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

          {/* ── EDITORIAL BODY ── */}
          <Animated.View style={[s.body, { opacity: fadeIn }]}>
            <Text style={s.eyebrow}>{mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}</Text>
            <Text style={s.title}>
              {mode === 'login' ? 'WELCOME' : "LET'S"}
            </Text>
            <Text style={s.titleAccent}>
              {mode === 'login' ? 'BACK.' : 'GET YOU IN.'}
            </Text>
            <Text style={s.subtitle}>
              {mode === 'login'
                ? 'Phone + PIN. That\'s it.'
                : 'Create your account to find and join tournaments.'}
            </Text>

            {/* Name (register only) */}
            {mode === 'register' && (
              <View style={s.field}>
                <Text style={s.label}>YOUR NAME</Text>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={(t) => { setName(t); setError(''); }}
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
                  onChangeText={(t) => { setPhone(t.replace(/[^0-9]/g, '').slice(0, 10)); setError(''); }}
                  placeholder="98765 43210"
                  placeholderTextColor={YColors.ink3}
                  keyboardType="number-pad"
                  maxLength={10}
                  returnKeyType="next"
                  editable={!loading}
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  {...(Platform.OS === 'web' ? { nativeID: 'yoiden-phone', name: 'phone' } as any : {})}
                />
              </View>
            </View>

            {/* PIN */}
            <View style={s.field}>
              <Text style={s.label}>6-DIGIT PIN</Text>
              <TextInput
                style={s.input}
                value={pin}
                onChangeText={(t) => { setPin(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                placeholder="• • • • • •"
                placeholderTextColor={YColors.ink3}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                returnKeyType="done"
                editable={!loading}
                onSubmitEditing={canSubmit ? handleSubmit : undefined}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                textContentType={mode === 'register' ? 'newPassword' : 'password'}
                {...(Platform.OS === 'web' ? { nativeID: 'yoiden-pin', name: 'password' } as any : {})}
              />
              <Text style={s.hint}>
                {mode === 'register'
                  ? 'Remember this PIN — you\'ll use it to log in'
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

            {/* Error */}
            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>⚠ {error}</Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={YColors.bg} size="small" />
              ) : (
                <Text style={s.submitText}>
                  {mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Mode switch */}
            <TouchableOpacity onPress={switchMode} disabled={loading} style={s.switchLink}>
              <Text style={s.switchText}>
                {mode === 'login'
                  ? "Don't have an account? "
                  : 'Already have an account? '}
                <Text style={s.switchLinkText}>
                  {mode === 'login' ? 'Sign up' : 'Log in'}
                </Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default PhoneInputScreen;

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  forgotRow: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  forgotText: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 12,
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
