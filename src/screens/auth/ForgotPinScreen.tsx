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
import { openMsg91Widget } from '../../config/msg91';
import { YColors, YFonts } from '../../config/yoiden';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPin'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Self-serve PIN reset using the MSG91 OTP widget.
 *
 * Flow:
 *   1. User taps "Verify your phone" → we open MSG91's modal via
 *      `openMsg91Widget()`. MSG91 collects the phone, sends the OTP, and
 *      asks the user to type it back — all in their own UI.
 *   2. On success MSG91 returns an access token. We hold it in component
 *      state and reveal the new-PIN inputs.
 *   3. User picks a new 6-digit PIN, taps the reset button. We post
 *      `{ accessToken, newPin }` to the backend, which verifies the token
 *      with MSG91, looks up the user by the verified phone, rotates the
 *      PIN, and returns a Yoiden JWT. We log the user in immediately.
 *
 * Native fallback: openMsg91Widget rejects on iOS/Android because the
 * widget is web-only. The screen surfaces the rejection as an error; users
 * on the PWA path don't hit this since the PWA runs in a browser context.
 */
export const ForgotPinScreen: React.FC<Props> = ({ navigation, route }) => {
  const { login } = useAuthStore();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeIn]);

  const pinOk = newPin.length === 6 && /^[0-9]+$/.test(newPin);
  const confirmOk = confirmPin === newPin && confirmPin.length === 6;
  const canReset = !!accessToken && pinOk && confirmOk && !resetting;

  const handleVerifyPhone = async () => {
    if (verifying) return;
    setError('');
    setVerifying(true);
    try {
      const prefill = route.params?.phone
        ? `+91${route.params.phone}`
        : undefined;
      const token = await openMsg91Widget(prefill);
      setAccessToken(token);
    } catch (err: any) {
      const msg =
        err?.message ?? 'Could not verify your phone. Please try again.';
      if (typeof err === 'object' && err && 'type' in err) {
        setError('Verification cancelled. Tap to try again.');
      } else {
        setError(msg);
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleReset = async () => {
    if (!canReset || !accessToken) return;
    setError('');
    setResetting(true);
    try {
      const res = await authApi.resetPin({ accessToken, newPin });
      login(res.data.data.user, res.data.data.accessToken);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        'Could not reset PIN. Please try verifying again.';
      setError(Array.isArray(msg) ? msg[0] : msg);
      if (err?.response?.status === 401) setAccessToken(null);
    } finally {
      setResetting(false);
    }
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
          {/* Logo header (cream w/ lime stripe) */}
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

          {/* Editorial body */}
          <Animated.View style={[s.body, { opacity: fadeIn }]}>
            <Text style={s.eyebrow}>{accessToken ? 'STEP 2' : 'STEP 1'}</Text>
            <Text style={s.title}>
              {accessToken ? 'SET A' : 'FORGOT'}
            </Text>
            <Text style={s.titleAccent}>
              {accessToken ? 'NEW PIN.' : 'YOUR PIN?'}
            </Text>
            <Text style={s.subtitle}>
              {accessToken
                ? 'Choose a new 6-digit PIN. You\'ll use this to log in next time.'
                : 'Verify your phone with a one-time SMS code, then choose a new PIN.'}
            </Text>

            {!accessToken ? (
              <>
                <TouchableOpacity
                  style={[s.primaryBtn, verifying && s.btnDisabled]}
                  onPress={handleVerifyPhone}
                  disabled={verifying}
                  activeOpacity={0.85}
                >
                  {verifying ? (
                    <ActivityIndicator color={YColors.bg} size="small" />
                  ) : (
                    <Text style={s.primaryBtnText}>VERIFY YOUR PHONE</Text>
                  )}
                </TouchableOpacity>
                <Text style={s.helperText}>
                  Tapping this opens a verification window powered by MSG91.
                  Enter your phone, then the 6-digit code we'll text you.
                </Text>
              </>
            ) : (
              <>
                <View style={s.verifiedRow}>
                  <Text style={s.verifiedDot}>●</Text>
                  <Text style={s.verifiedText}>Phone verified</Text>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>NEW 6-DIGIT PIN</Text>
                  <TextInput
                    style={s.input}
                    value={newPin}
                    onChangeText={(t) => {
                      setNewPin(t.replace(/[^0-9]/g, '').slice(0, 6));
                      setError('');
                    }}
                    placeholder="• • • • • •"
                    placeholderTextColor={YColors.ink3}
                    keyboardType="number-pad"
                    maxLength={6}
                    secureTextEntry
                    returnKeyType="next"
                    editable={!resetting}
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>CONFIRM PIN</Text>
                  <TextInput
                    style={s.input}
                    value={confirmPin}
                    onChangeText={(t) => {
                      setConfirmPin(t.replace(/[^0-9]/g, '').slice(0, 6));
                      setError('');
                    }}
                    placeholder="• • • • • •"
                    placeholderTextColor={YColors.ink3}
                    keyboardType="number-pad"
                    maxLength={6}
                    secureTextEntry
                    returnKeyType="done"
                    editable={!resetting}
                    onSubmitEditing={canReset ? handleReset : undefined}
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                  {!!confirmPin && !confirmOk && (
                    <Text style={s.warnHint}>PINs don't match</Text>
                  )}
                </View>
              </>
            )}

            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>⚠ {error}</Text>
              </View>
            )}

            {accessToken && (
              <TouchableOpacity
                style={[s.primaryBtn, !canReset && s.btnDisabled]}
                onPress={handleReset}
                disabled={!canReset}
                activeOpacity={0.85}
              >
                {resetting ? (
                  <ActivityIndicator color={YColors.bg} size="small" />
                ) : (
                  <Text style={s.primaryBtnText}>RESET PIN & LOG IN</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={resetting}
              style={s.linkRow}
            >
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
  helperText: {
    fontFamily: YFonts.ui,
    fontSize: 12,
    color: YColors.ink3,
    marginTop: 12,
    lineHeight: 17,
  },

  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(200,242,50,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(10,10,11,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  verifiedDot: { fontSize: 10, color: YColors.ink },
  verifiedText: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 12,
    color: YColors.ink,
    letterSpacing: 1,
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

  linkRow: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  linkText: {
    fontFamily: YFonts.ui,
    fontSize: 13,
    color: YColors.ink2,
  },
  linkAction: {
    fontFamily: YFonts.uiExtrabold,
    color: YColors.accent,
  },
});
