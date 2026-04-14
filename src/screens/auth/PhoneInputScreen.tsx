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
import { xAlert } from '../../utils/alert';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneInput'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NAVY = '#001E40';
const BLUE_ACCENT = '#2196F3';
const WHITE = '#FFFFFF';
const GRAY = '#737780';
const BORDER = '#E1E3E4';
const RED = '#BA1A1A';

type Mode = 'login' | 'register';

export const PhoneInputScreen: React.FC<Props> = () => {
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
          {/* ── LOGO HEADER (white) ── */}
          <View style={s.logoHeader}>
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

          {/* ── NAVY BODY ── */}
          <Animated.View style={[s.body, { opacity: fadeIn }]}>
            <Text style={s.eyebrow}>YOIDEN</Text>
            <Text style={s.title}>
              {mode === 'login' ? 'Welcome back.' : 'Let\'s get you started.'}
            </Text>
            <Text style={s.subtitle}>
              {mode === 'login'
                ? 'Log in with your phone and PIN.'
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
                  placeholderTextColor="rgba(255,255,255,0.4)"
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
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="number-pad"
                  maxLength={10}
                  returnKeyType="next"
                  editable={!loading}
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
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                returnKeyType="done"
                editable={!loading}
                onSubmitEditing={canSubmit ? handleSubmit : undefined}
              />
              <Text style={s.hint}>
                {mode === 'register'
                  ? 'Remember this PIN — you\'ll use it to log in'
                  : 'Enter the PIN you chose when signing up'}
              </Text>
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
                <ActivityIndicator color={NAVY} size="small" />
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
  screen: { flex: 1, backgroundColor: NAVY },
  scroll: { flexGrow: 1 },

  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
    paddingVertical: 28,
    paddingHorizontal: 24,
    gap: 12,
  },
  iconMark: {
    width: SCREEN_WIDTH * 0.18,
    height: SCREEN_WIDTH * 0.18,
  },
  wordMark: {
    flex: 1,
    height: SCREEN_WIDTH * 0.36,
  },

  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 32,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: BLUE_ACCENT,
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: WHITE,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 32,
    lineHeight: 20,
  },

  field: { marginBottom: 18 },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    color: WHITE,
  },
  phoneRow: { flexDirection: 'row', gap: 10 },
  countryBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  countryText: { fontSize: 15, fontWeight: '700', color: WHITE },
  hint: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
  },

  errorBox: {
    backgroundColor: 'rgba(186,26,26,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(186,26,26,0.35)',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  errorText: { fontSize: 13, fontWeight: '600', color: '#FFB4B4' },

  submitBtn: {
    backgroundColor: WHITE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnDisabled: { opacity: 0.35 },
  submitText: {
    fontSize: 14,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 2,
  },

  switchLink: { marginTop: 20, alignItems: 'center', paddingVertical: 8 },
  switchText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  switchLinkText: { color: BLUE_ACCENT, fontWeight: '800' },
});
