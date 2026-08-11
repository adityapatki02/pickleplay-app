import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DiscoverStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius, shadows } from '../../config/theme';
import { tournamentsApi } from '../../api/tournaments.api';
import { registrationsApi } from '../../api/registrations.api';
import { paymentsApi } from '../../api/payments.api';
import { openRazorpay } from '../../utils/razorpay';
import { useAuthStore } from '../../store/authStore';
import { getDuprMe } from '../../api/dupr.api';
import { DUPR_ENABLED } from '../../config/constants';
import { TournamentCategory } from '../../types/tournament.types';
import { YColors, YTopBar } from '../../components/yoiden';
import { notify, confirmAction } from '../../utils/notify';

type Props = NativeStackScreenProps<DiscoverStackParamList, 'Registration'>;

type SubmitState = 'idle' | 'submitting' | 'success' | 'waitlisted';

export default function RegisterScreen({ navigation, route }: Props) {
  const { tournamentId, categoryId } = route.params;
  const user = useAuthStore((s) => s.user);

  const [category, setCategory] = useState<TournamentCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [partnerInput, setPartnerInput] = useState('');
  const [lookingForPartner, setLookingForPartner] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'online' | 'venue' | null>(null);

  // Submit state
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);

  // DUPR gating. `duprLinked` is checked up-front for DUPR-rated categories so we
  // can warn the user BEFORE they tap Register (null = not yet known / not a DUPR
  // event). `duprBlockMsg` holds the exact server reason if a register attempt is
  // rejected for a DUPR reason — shown inline because Alert.alert doesn't render on web.
  const duprRated: boolean = Boolean((category as any)?.duprRated) && DUPR_ENABLED;
  const [duprLinked, setDuprLinked] = useState<boolean | null>(null);
  const [duprBlockMsg, setDuprBlockMsg] = useState<string | null>(null);

  const goToConnectDupr = () => {
    // RegisterScreen lives in the Discover stack; the Connect DUPR card is on the Me tab.
    const parent = navigation.getParent();
    if (parent) {
      (parent as any).navigate('MeTab', { screen: 'Me' });
    } else {
      (navigation as any).navigate('MeTab', { screen: 'Me' });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchCategory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await tournamentsApi.listCategories(tournamentId);
        const cats: TournamentCategory[] = response.data.data;
        // The generic REGISTER button navigates without a categoryId. When the
        // event has a single category, fall back to it rather than erroring;
        // only a genuinely unknown id is "not found".
        const found = categoryId
          ? cats.find((c) => c.id === categoryId) ?? null
          : cats.length === 1
            ? cats[0]
            : null;
        if (!cancelled) {
          if (found) {
            setCategory(found);
          } else {
            setError(
              categoryId ? 'Category not found.' : 'Please choose a category to register.',
            );
          }
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load category details.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCategory();
    return () => { cancelled = true; };
  }, [tournamentId, categoryId]);

  // For DUPR-rated categories, check link status up-front so we can show the
  // "connect DUPR first" banner before the user tries (and fails) to register.
  useEffect(() => {
    if (!duprRated) {
      setDuprLinked(null);
      return;
    }
    let cancelled = false;
    getDuprMe()
      .then((res) => { if (!cancelled) setDuprLinked(Boolean(res.data?.linked)); })
      .catch(() => { if (!cancelled) setDuprLinked(null); });
    return () => { cancelled = true; };
  }, [duprRated]);

  // Auto-navigate back on success
  useEffect(() => {
    if (submitState === 'success' || submitState === 'waitlisted') {
      const timer = setTimeout(() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [submitState, navigation]);

  const handleSubmit = async (paymentMethod: 'online' | 'venue') => {
    if (!category) return;

    setSubmitLoading(true);
    try {
      const payload: {
        categoryId: string;
        paymentMethod: 'online' | 'venue';
        lookingForPartner?: boolean;
      } = {
        // Use the RESOLVED category id, not the raw route param — the generic REGISTER
        // button navigates without a categoryId (single-category fallback above), so the
        // param can be undefined and would POST to /categories/undefined/register (500).
        categoryId: category.id,
        paymentMethod,
      };

      if (category.format === 'doubles') {
        payload.lookingForPartner = lookingForPartner;
      }

      const regResponse = await registrationsApi.register(tournamentId, payload);
      const regData = regResponse.data as any;
      const registrationId: string | undefined =
        regData?.data?.id ?? regData?.registration?.id;
      const status: string = regData?.data?.status ?? regData?.registration?.status ?? '';

      // Waitlisted players don't pay now — they pay if/when a spot opens up.
      if (status === 'waitlisted') {
        const position: number | undefined =
          regData?.data?.waitlistPosition ?? regData?.registration?.waitlistPosition;
        setWaitlistPosition(position ?? null);
        setSubmitState('waitlisted');
        return;
      }

      // Online payment → real Razorpay checkout. The backend confirms the
      // registration via the Razorpay webhook once payment is captured.
      if (paymentMethod === 'online' && Number(category.entryFee) > 0) {
        if (!registrationId) {
          notify.info('You are registered — payment is pending. Complete it anytime from your registrations.', 'Payment pending');
          setSubmitState('success');
          return;
        }
        let order: { orderId: string; amount: number; currency?: string; key: string };
        try {
          const orderRes = await paymentsApi.createOrder(registrationId);
          order = (orderRes.data as any)?.data ?? (orderRes.data as any);
        } catch {
          notify.info('Couldn\'t start payment right now. You are registered with payment pending — complete it later from your registrations.', 'Payment pending');
          setSubmitState('success');
          return;
        }
        try {
          await openRazorpay({
            key: order.key,
            amount: order.amount,
            currency: order.currency ?? 'INR',
            order_id: order.orderId,
            name: 'Yoiden',
            description: `${category.name} · entry fee`,
            prefill: {
              name: user?.displayName || user?.fullName || '',
              contact: user?.phone || '',
            },
            theme: { color: YColors.accent },
          });
          // Payment captured — webhook marks the registration confirmed shortly.
          setSubmitState('success');
        } catch (rzpErr: any) {
          console.warn('[Razorpay]', rzpErr?.description ?? rzpErr);
          notify.info('Payment wasn\'t completed. Your registration is saved with payment pending — complete it later.', 'Payment pending');
          setSubmitState('idle');
        }
        return;
      }

      // Free entry, or pay-at-venue → registered.
      setSubmitState('success');
    } catch (err: any) {
      const serverMessage: string =
        err?.response?.data?.message ?? err?.message ?? 'Registration failed.';

      if (
        serverMessage.toLowerCase().includes('already registered') ||
        serverMessage.toLowerCase().includes('duplicate')
      ) {
        notify.error('You are already registered in this category.', 'Already registered');
      } else if (
        serverMessage.toLowerCase().includes('full') ||
        serverMessage.toLowerCase().includes('no spots')
      ) {
        notify.error('This category is currently full. Try joining the waitlist.', 'Category full');
      } else if (
        serverMessage.toLowerCase().includes('closed') ||
        serverMessage.toLowerCase().includes('deadline')
      ) {
        notify.error('The registration deadline has passed for this tournament.', 'Registration closed');
      } else if (serverMessage.toLowerCase().includes('dupr')) {
        // DUPR gating (not linked / not eligible / premium / rating band). Show it as a
        // persistent on-screen banner with a Connect-DUPR button — Alert.alert doesn't
        // render on web, so a popup here would be silently swallowed on the console.
        setDuprBlockMsg(serverMessage);
        setDuprLinked(false);
        notify.error(serverMessage, 'DUPR account required');
      } else {
        notify.error(serverMessage, 'Registration failed');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleRegisterPress = (paymentMethod: 'online' | 'venue') => {
    if (!category) return;

    // Known-not-linked DUPR-rated category: don't fire a doomed request — surface the
    // connect banner immediately instead.
    if (duprRated && duprLinked === false) {
      setDuprBlockMsg(
        'This is a DUPR-rated event. Connect your DUPR account first, then register.',
      );
      return;
    }

    const paymentLabel =
      paymentMethod === 'online' ? `Pay Online (₹${category.entryFee})` : 'Pay at Venue';

    void confirmAction({
      title: 'Confirm registration',
      message: `Register for "${category.name}"?\nPayment: ${paymentLabel}`,
      confirmLabel: 'Confirm',
    }).then((ok) => {
      if (ok) handleSubmit(paymentMethod);
    });
  };

  // — Loading state —
  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // — Error state —
  if (error || !category) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>{error ?? 'Category not found.'}</Text>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.goBack()}>
          <Text style={styles.navButtonText}>GO BACK</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // — Success / Waitlisted state —
  if (submitState === 'success' || submitState === 'waitlisted') {
    const isWaitlisted = submitState === 'waitlisted';
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.successIcon}>{isWaitlisted ? '⏳' : '✅'}</Text>
        <Text style={styles.successTitle}>
          {isWaitlisted
            ? waitlistPosition != null
              ? `Waitlisted (position #${waitlistPosition})`
              : 'Waitlisted!'
            : "You're registered!"}
        </Text>
        <Text style={styles.successSubtitle}>
          {isWaitlisted
            ? 'You will be notified if a spot opens up.'
            : 'Good luck in the tournament!'}
        </Text>
        <Text style={styles.redirectNote}>Returning to tournament…</Text>
      </SafeAreaView>
    );
  }

  // — Main registration form —
  const isDoubles = category.format === 'doubles';
  const isFull = (category.maxTeams - (category.registeredTeams ?? 0)) <= 0;
  const feeLabel = category.entryFee === 0 ? 'FREE' : `₹${category.entryFee}`;

  return (
    <SafeAreaView style={styles.container}>
      <YTopBar
        eyebrow={category.name?.toUpperCase() || 'TOURNAMENT'}
        title="REGISTER"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>REGISTERING FOR</Text>
          <Text style={styles.categoryName}>{category.name}</Text>
          <View style={styles.summaryMeta}>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryChipText}>{category.format.toUpperCase()}</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryChipText}>{category.gender.toUpperCase()}</Text>
            </View>
            <View style={[styles.summaryChip, styles.feeChip]}>
              <Text style={[styles.summaryChipText, styles.feeChipText]}>{feeLabel}</Text>
            </View>
          </View>
          {isFull && (
            <View style={styles.fullWarning}>
              <Text style={styles.fullWarningText}>
                This category is full. You can register to the waitlist.
              </Text>
            </View>
          )}
        </View>

        {/* DUPR gating banner — shown before registering when this is a DUPR-rated
            category and the account isn't connected (or a register attempt was blocked). */}
        {duprRated && (duprLinked === false || duprBlockMsg) && (
          <View style={styles.duprBlock}>
            <Text style={styles.duprBlockTitle}>🎾 Connect DUPR to register</Text>
            <Text style={styles.duprBlockBody}>
              {duprBlockMsg
                ? duprBlockMsg
                : 'This is a DUPR-rated event. You need to connect your DUPR account before you can register.'}
            </Text>
            <TouchableOpacity
              style={styles.duprBlockButton}
              onPress={goToConnectDupr}
              activeOpacity={0.85}
            >
              <Text style={styles.duprBlockButtonText}>CONNECT DUPR</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Doubles partner section */}
        {isDoubles && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>PARTNER DETAILS</Text>

            {/* Looking for partner toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Looking for a partner</Text>
                <Text style={styles.toggleSub}>
                  We'll match you with other solo players
                </Text>
              </View>
              <Switch
                value={lookingForPartner}
                onValueChange={setLookingForPartner}
                trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryFixed }}
                thumbColor={lookingForPartner ? colors.primary : colors.textTertiary}
              />
            </View>

            {!lookingForPartner && (
              <View style={styles.partnerInputWrapper}>
                <Text style={styles.inputLabel}>Partner name or phone number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Rahul Sharma or +91 98765 43210"
                  placeholderTextColor={colors.textTertiary}
                  value={partnerInput}
                  onChangeText={setPartnerInput}
                  keyboardType="default"
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              </View>
            )}
          </View>
        )}

        {/* Payment section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>PAYMENT</Text>

          {category.paymentMode === 'both' && (
            <View style={styles.paymentOptions}>
              {/* Online payment card */}
              <TouchableOpacity
                style={[
                  styles.paymentCard,
                  selectedPaymentMethod === 'online' && styles.paymentCardSelected,
                ]}
                onPress={() => setSelectedPaymentMethod('online')}
                activeOpacity={0.85}
              >
                <Text style={styles.paymentCardIcon}>💳</Text>
                <View style={styles.paymentCardInfo}>
                  <Text style={styles.paymentCardTitle}>Pay Online</Text>
                  <Text style={styles.paymentCardFee}>{feeLabel}</Text>
                </View>
                <View
                  style={[
                    styles.paymentRadio,
                    selectedPaymentMethod === 'online' && styles.paymentRadioSelected,
                  ]}
                />
              </TouchableOpacity>

              {/* Venue payment card */}
              <TouchableOpacity
                style={[
                  styles.paymentCard,
                  selectedPaymentMethod === 'venue' && styles.paymentCardSelected,
                ]}
                onPress={() => setSelectedPaymentMethod('venue')}
                activeOpacity={0.85}
              >
                <Text style={styles.paymentCardIcon}>🏢</Text>
                <View style={styles.paymentCardInfo}>
                  <Text style={styles.paymentCardTitle}>Pay at Venue</Text>
                  <Text style={styles.paymentCardSub}>Pay on the day of tournament</Text>
                </View>
                <View
                  style={[
                    styles.paymentRadio,
                    selectedPaymentMethod === 'venue' && styles.paymentRadioSelected,
                  ]}
                />
              </TouchableOpacity>

              {/* Confirm with selected method */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!selectedPaymentMethod || submitLoading) && styles.primaryButtonDisabled,
                ]}
                onPress={() => {
                  if (selectedPaymentMethod) handleRegisterPress(selectedPaymentMethod);
                }}
                disabled={!selectedPaymentMethod || submitLoading}
                activeOpacity={0.85}
              >
                {submitLoading ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {selectedPaymentMethod === 'online'
                      ? `PAY & REGISTER (${feeLabel})`
                      : selectedPaymentMethod === 'venue'
                      ? 'REGISTER (PAY AT VENUE)'
                      : 'SELECT PAYMENT METHOD'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {category.paymentMode === 'venue' && (
            <TouchableOpacity
              style={[styles.primaryButton, submitLoading && styles.primaryButtonDisabled]}
              onPress={() => handleRegisterPress('venue')}
              disabled={submitLoading}
              activeOpacity={0.85}
            >
              {submitLoading ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>REGISTER (PAY AT VENUE)</Text>
              )}
            </TouchableOpacity>
          )}

          {category.paymentMode === 'online' && (
            <TouchableOpacity
              style={[styles.primaryButton, submitLoading && styles.primaryButtonDisabled]}
              onPress={() => handleRegisterPress('online')}
              disabled={submitLoading}
              activeOpacity={0.85}
            >
              {submitLoading ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>{`PAY & REGISTER (${feeLabel})`}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Spots remaining info */}
        {!isFull && (
          <Text style={styles.spotsInfo}>
            {category.maxTeams - (category.registeredTeams ?? 0)} spots remaining out of {category.maxTeams}
          </Text>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: YColors.bg,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: YColors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  duprBlock: {
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: '#F0B27A',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  duprBlockTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '800',
    color: '#B9770E',
    marginBottom: spacing.xs,
  },
  duprBlockBody: {
    fontSize: typography.fontSize.sm,
    color: '#7E5109',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  duprBlockButton: {
    backgroundColor: '#B9770E',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  duprBlockButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: typography.fontSize.sm,
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  navButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  navButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 1.5,
  },

  // Nav bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
  },
  navBackTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  navBackIcon: {
    fontSize: typography.fontSize.lg,
    color: colors.primary,
    fontWeight: '700',
  },
  navBackLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  navTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 2,
  },
  navSpacer: {
    flex: 1,
  },

  // Scroll
  scrollContent: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
  },

  // Summary card
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  summaryLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  categoryName: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  summaryMeta: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  summaryChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  summaryChipText: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
  },
  feeChip: {
    backgroundColor: colors.secondaryContainer,
  },
  feeChipText: {
    color: colors.primary,
  },
  fullWarning: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  fullWarningText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },

  // Generic card
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },

  // Doubles partner
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  toggleInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  partnerInputWrapper: {
    marginTop: spacing.sm,
  },
  inputLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    color: colors.text,
  },

  // Payment options
  paymentOptions: {
    gap: spacing.sm,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  paymentCardSelected: {
    backgroundColor: colors.primaryFixed,
  },
  paymentCardIcon: {
    fontSize: 22,
  },
  paymentCardInfo: {
    flex: 1,
  },
  paymentCardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  paymentCardFee: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: colors.primary,
  },
  paymentCardSub: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  paymentRadio: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: 'transparent',
  },
  paymentRadioSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },

  // Primary action button
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: spacing.xs,
    ...shadows.md,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Spots info
  spotsInfo: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Success state
  successIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  successTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  redirectNote: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textTertiary,
    textAlign: 'center',
  },

  bottomSpacer: {
    // Clear the bottom tab bar so the last content (button + spots note) fully scrolls
    // into view instead of being tucked under the nav.
    height: 120,
  },
});
