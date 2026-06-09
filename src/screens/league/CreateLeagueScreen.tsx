import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createLeague, createSeason } from '../../api/leagues.api';
import { useLeagueStore } from '../../store/leagueStore';
import { colors, spacing, typography, borderRadius } from '../../config/theme';
import DatePickerModal, { DateField } from '../../components/ui/DatePickerModal';
import type { CreateLeagueInput, CreateSeasonInput } from '../../types/league.types';

import { YColors, YTopBar } from '../../components/yoiden';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY: string = YColors.ink;
const BLUE: string = YColors.accent;
const GREEN = '#06D6A0';
const SURFACE: string = YColors.bg;
const BORDER: string = YColors.line2;
const TEXT_COLOR: string = YColors.ink;
const TEXT_SUB: string = YColors.ink2;

const TOTAL_STEPS = 3;
const STEP_LABELS = ['BASICS', 'SEASON', 'REVIEW'];

// ─── Form Data ──────────────────────────────────────────────────────────────
interface LeagueFormData {
  // Step 1 — Basics
  name: string;
  description: string;
  city: string;
  // Step 2 — Season Config
  seasonName: string;
  startDate: string;
  endDate: string;
  matchPointsTo: string;
  goldenPointAt: string;
}

const INITIAL_FORM: LeagueFormData = {
  name: '',
  description: '',
  city: '',
  seasonName: '',
  startDate: '',
  endDate: '',
  matchPointsTo: '15',
  goldenPointAt: '14',
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function FormField({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  keyboardType,
  multiline,
  maxLength,
  hint,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  keyboardType?: any;
  multiline?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[
          fieldStyles.input,
          focused && fieldStyles.inputFocused,
          error ? fieldStyles.inputError : null,
          multiline && fieldStyles.inputMultiline,
        ]}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {error ? (
        <Text style={fieldStyles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={fieldStyles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    color: TEXT_COLOR,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: BLUE,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputMultiline: {
    height: 80,
    paddingTop: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colors.error,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  hintText: {
    fontSize: typography.fontSize.xs,
    color: TEXT_SUB,
    marginTop: spacing.xs,
  },
});

// ─── Step Indicator ─────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={stepStyles.row}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <View style={[stepStyles.line, done && stepStyles.lineDone]} />
            )}
            <View
              style={[
                stepStyles.dot,
                done && stepStyles.dotDone,
                active && stepStyles.dotActive,
              ]}
            >
              {done ? (
                <Text style={stepStyles.dotCheckText}>{'✓'}</Text>
              ) : (
                <Text
                  style={[
                    stepStyles.dotText,
                    active && stepStyles.dotTextActive,
                  ]}
                >
                  {i + 1}
                </Text>
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  dotActive: {
    borderColor: BLUE,
    backgroundColor: '#EBF5FF',
  },
  dotText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SUB,
  },
  dotTextActive: {
    color: BLUE,
  },
  dotCheckText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: BORDER,
    marginHorizontal: spacing.xs,
  },
  lineDone: {
    backgroundColor: GREEN,
  },
});

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function CreateLeagueScreen() {
  const navigation = useNavigation<any>();
  const addLeague = useLeagueStore((s) => s.addLeague);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<LeagueFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof LeagueFormData, string>>>({});

  // Date picker state
  type DateFieldType = 'startDate' | 'endDate';
  const [activeDateField, setActiveDateField] = useState<DateFieldType | null>(null);
  const openDatePicker = (field: DateFieldType) => setActiveDateField(field);
  const closeDatePicker = () => setActiveDateField(null);
  const confirmDate = (iso: string) => {
    if (activeDateField) update(activeDateField, iso);
    closeDatePicker();
  };
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof LeagueFormData, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // ── Validation ──

  const validateStep = (): boolean => {
    const errs: Partial<Record<keyof LeagueFormData, string>> = {};

    if (step === 0) {
      if (!form.name.trim()) errs.name = 'League name is required';
      if (!form.city.trim()) errs.city = 'City is required';
    }

    if (step === 1) {
      if (!form.seasonName.trim()) errs.seasonName = 'Season name is required';
      if (!form.startDate.trim()) errs.startDate = 'Start date is required (YYYY-MM-DD)';
      if (!form.endDate.trim()) errs.endDate = 'End date is required (YYYY-MM-DD)';
      const pts = parseInt(form.matchPointsTo, 10);
      if (isNaN(pts) || pts < 1) errs.matchPointsTo = 'Must be a positive number';
      const gp = parseInt(form.goldenPointAt, 10);
      if (isNaN(gp) || gp < 1) errs.goldenPointAt = 'Must be a positive number';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const handleBack = () => {
    if (step === 0) {
      navigation.goBack();
    } else {
      setStep((s) => s - 1);
    }
  };

  // ── Submit ──

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const leagueInput: CreateLeagueInput = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        city: form.city.trim(),
      };
      const league = await createLeague(leagueInput);
      addLeague(league);

      const seasonInput: CreateSeasonInput = {
        name: form.seasonName.trim(),
        startDate: form.startDate.trim(),
        endDate: form.endDate.trim(),
        matchPointsTo: parseInt(form.matchPointsTo, 10),
        goldenPointAt: parseInt(form.goldenPointAt, 10),
      };
      await createSeason(league.id, seasonInput);

      navigation.goBack();
    } catch (err: any) {
      setErrors({ name: err?.message || 'Failed to create league' });
      setStep(0);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Steps ──

  const renderStep0 = () => (
    <View>
      <Text style={styles.stepTitle}>LEAGUE BASICS</Text>
      <Text style={styles.stepSubtitle}>Set up your league identity</Text>

      <FormField
        label="LEAGUE NAME"
        placeholder="e.g. Sambhaji Premier Pickleball League"
        value={form.name}
        onChangeText={(v) => update('name', v)}
        error={errors.name}
        maxLength={100}
      />
      <FormField
        label="DESCRIPTION"
        placeholder="Brief description of your league..."
        value={form.description}
        onChangeText={(v) => update('description', v)}
        multiline
        maxLength={500}
      />
      <FormField
        label="CITY"
        placeholder="e.g. Pune"
        value={form.city}
        onChangeText={(v) => update('city', v)}
        error={errors.city}
      />
    </View>
  );

  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>SEASON CONFIG</Text>
      <Text style={styles.stepSubtitle}>Configure the first season</Text>

      <FormField
        label="SEASON NAME"
        placeholder="e.g. Season 1 - 2026"
        value={form.seasonName}
        onChangeText={(v) => update('seasonName', v)}
        error={errors.seasonName}
      />
      <DateField
        label="START DATE"
        value={form.startDate}
        onPress={() => openDatePicker('startDate')}
        error={errors.startDate}
        required
      />
      <DateField
        label="END DATE"
        value={form.endDate}
        onPress={() => openDatePicker('endDate')}
        error={errors.endDate}
        required
      />
      <FormField
        label="MATCH POINTS TO"
        placeholder="15"
        value={form.matchPointsTo}
        onChangeText={(v) => update('matchPointsTo', v)}
        error={errors.matchPointsTo}
        keyboardType="numeric"
        hint="Points to win a match"
      />
      <FormField
        label="GOLDEN POINT AT"
        placeholder="14"
        value={form.goldenPointAt}
        onChangeText={(v) => update('goldenPointAt', v)}
        error={errors.goldenPointAt}
        keyboardType="numeric"
        hint="Score at which golden point activates"
      />
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text style={styles.stepTitle}>REVIEW & CREATE</Text>
      <Text style={styles.stepSubtitle}>Confirm your league details</Text>

      <View style={styles.reviewCard}>
        <Text style={styles.reviewSectionTitle}>LEAGUE</Text>
        <ReviewRow label="Name" value={form.name} />
        <ReviewRow label="City" value={form.city} />
        {form.description ? (
          <ReviewRow label="Description" value={form.description} />
        ) : null}
      </View>

      <View style={styles.reviewCard}>
        <Text style={styles.reviewSectionTitle}>SEASON</Text>
        <ReviewRow label="Name" value={form.seasonName} />
        <ReviewRow label="Start" value={form.startDate} />
        <ReviewRow label="End" value={form.endDate} />
        <ReviewRow label="Points to Win" value={form.matchPointsTo} />
        <ReviewRow label="Golden Point" value={`At ${form.goldenPointAt}-${form.goldenPointAt}`} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>
            {step === 0 ? 'CANCEL' : 'BACK'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CREATE LEAGUE</Text>
        <View style={styles.headerBtn}>
          <Text style={styles.headerStepText}>
            {step + 1}/{TOTAL_STEPS}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step labels */}
          <View style={styles.stepLabelsRow}>
            {STEP_LABELS.map((label, i) => (
              <Text
                key={label}
                style={[
                  styles.stepLabel,
                  i === step && styles.stepLabelActive,
                ]}
              >
                {label}
              </Text>
            ))}
          </View>

          {/* Step indicator */}
          <StepIndicator current={step} total={TOTAL_STEPS} />

          {/* Content */}
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </ScrollView>

        {/* Bottom button */}
        <View style={styles.bottomBar}>
          {step < TOTAL_STEPS - 1 ? (
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>CONTINUE</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, styles.submitBtn]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.nextBtnText}>CREATE LEAGUE</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
      {/* Date picker modals */}
      <DatePickerModal
        visible={activeDateField === 'startDate'}
        label="SELECT START DATE"
        value={form.startDate}
        onConfirm={confirmDate}
        onCancel={closeDatePicker}
      />
      <DatePickerModal
        visible={activeDateField === 'endDate'}
        label="SELECT END DATE"
        value={form.endDate}
        minDate={form.startDate || undefined}
        onConfirm={confirmDate}
        onCancel={closeDatePicker}
      />
    </SafeAreaView>
  );
}

// ─── Review Row ─────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value || '---'}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: NAVY,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 8,
    paddingBottom: spacing.md,
    backgroundColor: NAVY,
  },
  headerBtn: {
    width: 70,
  },
  headerBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerStepText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 120,
  },
  stepLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stepLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: TEXT_SUB,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  stepLabelActive: {
    color: BLUE,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '900',
    fontStyle: 'italic',
    color: NAVY,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: typography.fontSize.md,
    color: TEXT_SUB,
    marginBottom: spacing.xl,
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
    paddingBottom: 100,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  nextBtn: {
    backgroundColor: BLUE,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitBtn: {
    backgroundColor: GREEN,
  },
  nextBtnText: {
    fontSize: typography.fontSize.md,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  // Review
  reviewCard: {
    backgroundColor: SURFACE,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  reviewSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: BLUE,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  reviewLabel: {
    fontSize: typography.fontSize.sm,
    color: TEXT_SUB,
    fontWeight: '500',
  },
  reviewValue: {
    fontSize: typography.fontSize.sm,
    color: TEXT_COLOR,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '60%',
  },
});
