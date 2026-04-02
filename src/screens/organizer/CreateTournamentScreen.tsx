import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { tournamentsApi } from '../../api/tournaments.api';
import { useTournamentStore } from '../../store/tournamentStore';
import {
  CategoryFormat,
  CategoryGender,
  PaymentMode,
  CreateCategoryInput,
} from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';

const NAVY = '#001E40';
const BLUE_ACCENT = '#2196F3';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryDraft extends CreateCategoryInput {
  _id: string;
  paymentMode: PaymentMode;
  advancingPerGroup: number;
}

interface FormData {
  // Step 1 — BASICS
  name: string;
  description: string;
  city: string;
  state: string;
  // Step 2 — VENUE & DATES
  venueName: string;
  venueAddress: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  contactPhone: string;
  contactEmail: string;
  // Step 3 — CATEGORIES
  categories: CategoryDraft[];
}

const INITIAL_FORM: FormData = {
  name: '',
  description: '',
  city: '',
  state: '',
  venueName: '',
  venueAddress: '',
  startDate: '',
  endDate: '',
  registrationDeadline: '',
  contactPhone: '',
  contactEmail: '',
  categories: [],
};

const INITIAL_CATEGORY: Omit<CategoryDraft, '_id'> = {
  name: '',
  format: 'doubles',
  gender: 'open',
  entryFee: 0,
  maxTeams: 16,
  groupSize: 4,
  advancingPerGroup: 2,
  knockoutFormat: 'single_elimination',
  paymentMode: 'both',
};

const TOTAL_STEPS = 3;
const STEP_LABELS = ['BASICS', 'VENUE & DATES', 'CATEGORIES'];

// ─── Sub-components ───────────────────────────────────────────────────────────

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
        placeholderTextColor={colors.textTertiary}
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
    color: colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    color: colors.text,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: BLUE_ACCENT,
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
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
});

function PickerRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { label: string; value: T }[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={pickerStyles.container}>
      <Text style={pickerStyles.label}>{label}</Text>
      <View style={pickerStyles.options}>
        {options.map((opt) => {
          const active = selected === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[pickerStyles.option, active && pickerStyles.optionActive]}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={[pickerStyles.optionText, active && pickerStyles.optionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceContainerHigh,
  },
  optionActive: { backgroundColor: NAVY },
  optionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  optionTextActive: { color: '#FFFFFF' },
});

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={stepStyles.container}>
      <View style={stepStyles.row}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <React.Fragment key={n}>
              <View style={[stepStyles.dot, active && stepStyles.dotActive, done && stepStyles.dotDone]}>
                {done ? (
                  <Text style={[stepStyles.dotText, stepStyles.dotTextActive]}>✓</Text>
                ) : (
                  <Text style={[stepStyles.dotText, (active || done) && stepStyles.dotTextActive]}>
                    {n}
                  </Text>
                )}
              </View>
              {n < total && (
                <View style={[stepStyles.line, n < current && stepStyles.lineDone]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
      <Text style={stepStyles.stepLabel}>
        Step {current} of {total} — {STEP_LABELS[current - 1]}
      </Text>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: NAVY,
  },
  dotDone: {
    backgroundColor: BLUE_ACCENT,
  },
  line: {
    width: 32,
    height: 2,
    backgroundColor: colors.borderLight,
  },
  lineDone: {
    backgroundColor: BLUE_ACCENT,
  },
  dotText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  dotTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CreateTournamentScreen() {
  const navigation = useNavigation();
  const { addTournament } = useTournamentStore();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<Omit<CategoryDraft, '_id'>>(INITIAL_CATEGORY);

  const update = (fields: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...fields }));
    const cleared = { ...errors };
    Object.keys(fields).forEach((k) => delete cleared[k]);
    setErrors(cleared);
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateStep1(): boolean {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Tournament name is required';
    if (!form.city.trim()) e.city = 'City is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: typeof errors = {};
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!form.venueName.trim()) e.venueName = 'Venue name is required';
    if (!form.venueAddress.trim()) e.venueAddress = 'Venue address is required';
    if (!form.startDate || !dateRegex.test(form.startDate)) e.startDate = 'Enter a valid date (YYYY-MM-DD)';
    if (!form.endDate || !dateRegex.test(form.endDate)) e.endDate = 'Enter a valid date (YYYY-MM-DD)';
    if (!form.registrationDeadline || !dateRegex.test(form.registrationDeadline))
      e.registrationDeadline = 'Enter a valid date (YYYY-MM-DD)';
    if (!e.startDate && !e.registrationDeadline && form.registrationDeadline >= form.startDate)
      e.registrationDeadline = 'Deadline must be before start date';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep3(): boolean {
    if (form.categories.length === 0) {
      Alert.alert('Required', 'Add at least one category before creating the tournament.');
      return false;
    }
    return true;
  }

  const goNext = () => {
    let valid = false;
    if (step === 1) valid = validateStep1();
    else if (step === 2) valid = validateStep2();
    else if (step === 3) valid = validateStep3();
    if (valid && step < TOTAL_STEPS) setStep((s) => s + 1);
    else if (valid && step === TOTAL_STEPS) handleSave();
  };

  const goBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else navigation.goBack();
  };

  // ── Category actions ─────────────────────────────────────────────────────────

  const addCategory = () => {
    if (!categoryDraft.name.trim()) {
      Alert.alert('Required', 'Category name is required.');
      return;
    }
    const newCat: CategoryDraft = { ...categoryDraft, _id: Date.now().toString() };
    update({ categories: [...form.categories, newCat] });
    setCategoryDraft(INITIAL_CATEGORY);
    setShowCategoryForm(false);
  };

  const removeCategory = (id: string) => {
    update({ categories: form.categories.filter((c) => c._id !== id) });
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const createRes = await tournamentsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        venueName: form.venueName.trim(),
        venueAddress: form.venueAddress.trim(),
        city: form.city.trim(),
        state: form.state.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        registrationDeadline: form.registrationDeadline,
      });

      const tournament = createRes.data?.data;
      if (!tournament?.id) throw new Error('Failed to create tournament');
      const tId = tournament.id;

      for (const cat of form.categories) {
        const { _id, paymentMode, advancingPerGroup, ...catInput } = cat;
        await tournamentsApi.addCategory(tId, catInput);
      }

      addTournament(tournament);

      Alert.alert('Tournament Created!', `"${form.name}" has been created as a draft.`, [
        {
          text: 'Go to Dashboard',
          onPress: () => (navigation as any).navigate('TournamentManage', { tournamentId: tId }),
        },
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to save tournament');
    } finally {
      setSaving(false);
    }
  };

  // ── Step renderers ────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View>
      <FormField
        label="Tournament Name *"
        placeholder="e.g. City Open 2026"
        value={form.name}
        onChangeText={(v) => update({ name: v })}
        error={errors.name}
      />
      <FormField
        label="Description"
        placeholder="Optional — describe the tournament"
        value={form.description}
        onChangeText={(v) => update({ description: v })}
        multiline
      />
      <FormField
        label="City *"
        placeholder="e.g. Bangalore"
        value={form.city}
        onChangeText={(v) => update({ city: v })}
        error={errors.city}
      />
      <FormField
        label="State"
        placeholder="e.g. Karnataka"
        value={form.state}
        onChangeText={(v) => update({ state: v })}
      />
    </View>
  );

  const renderStep2 = () => (
    <View>
      <FormField
        label="Venue Name *"
        placeholder="e.g. DLF Sports Complex"
        value={form.venueName}
        onChangeText={(v) => update({ venueName: v })}
        error={errors.venueName}
      />
      <FormField
        label="Venue Address *"
        placeholder="Full street address"
        value={form.venueAddress}
        onChangeText={(v) => update({ venueAddress: v })}
        error={errors.venueAddress}
        multiline
      />
      <FormField
        label="Start Date *"
        placeholder="YYYY-MM-DD"
        value={form.startDate}
        onChangeText={(v) => update({ startDate: v })}
        error={errors.startDate}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <FormField
        label="End Date *"
        placeholder="YYYY-MM-DD"
        value={form.endDate}
        onChangeText={(v) => update({ endDate: v })}
        error={errors.endDate}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <FormField
        label="Registration Deadline *"
        placeholder="YYYY-MM-DD"
        value={form.registrationDeadline}
        onChangeText={(v) => update({ registrationDeadline: v })}
        error={errors.registrationDeadline}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        hint="Must be before start date"
      />
      <FormField
        label="Contact Phone"
        placeholder="+91 98765 43210"
        value={form.contactPhone}
        onChangeText={(v) => update({ contactPhone: v })}
        keyboardType="phone-pad"
      />
      <FormField
        label="Contact Email"
        placeholder="organizer@example.com"
        value={form.contactEmail}
        onChangeText={(v) => update({ contactEmail: v })}
        keyboardType="email-address"
      />
    </View>
  );

  const renderStep3 = () => (
    <View>
      {form.categories.map((cat) => (
        <View key={cat._id} style={styles.catCard}>
          <View style={styles.catCardRow}>
            <View style={styles.catCardInfo}>
              <Text style={styles.catCardName}>{cat.name}</Text>
              <Text style={styles.catCardMeta}>
                {cat.format.toUpperCase()} · {cat.gender.toUpperCase()} · ₹{cat.entryFee} · {cat.maxTeams} teams
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeCategory(cat._id)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {showCategoryForm ? (
        <View style={styles.catForm}>
          <Text style={styles.catFormTitle}>ADD CATEGORY</Text>
          <FormField
            label="Category Name *"
            placeholder="e.g. Open Doubles"
            value={categoryDraft.name}
            onChangeText={(v) => setCategoryDraft((p) => ({ ...p, name: v }))}
          />
          <PickerRow<CategoryFormat>
            label="Format"
            options={[
              { label: 'Singles', value: 'singles' },
              { label: 'Doubles', value: 'doubles' },
            ]}
            selected={categoryDraft.format}
            onSelect={(v) => setCategoryDraft((p) => ({ ...p, format: v }))}
          />
          <PickerRow<CategoryGender>
            label="Gender"
            options={[
              { label: 'Open', value: 'open' },
              { label: 'Male', value: 'male' },
              { label: 'Female', value: 'female' },
              { label: 'Mixed', value: 'mixed' },
            ]}
            selected={categoryDraft.gender}
            onSelect={(v) => setCategoryDraft((p) => ({ ...p, gender: v }))}
          />
          <View style={styles.twoCol}>
            <View style={styles.twoColItem}>
              <FormField
                label="Max Teams"
                placeholder="16"
                value={categoryDraft.maxTeams === 0 ? '' : String(categoryDraft.maxTeams)}
                onChangeText={(v) => setCategoryDraft((p) => ({ ...p, maxTeams: Number(v) || 0 }))}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.twoColItem}>
              <FormField
                label="Entry Fee (₹)"
                placeholder="0"
                value={categoryDraft.entryFee === 0 ? '' : String(categoryDraft.entryFee)}
                onChangeText={(v) => setCategoryDraft((p) => ({ ...p, entryFee: Number(v) || 0 }))}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.twoColItem}>
              <FormField
                label="Group Size"
                placeholder="4"
                value={String(categoryDraft.groupSize)}
                onChangeText={(v) => setCategoryDraft((p) => ({ ...p, groupSize: Number(v) || 4 }))}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.twoColItem}>
              <FormField
                label="Advancing / Group"
                placeholder="2"
                value={String(categoryDraft.advancingPerGroup)}
                onChangeText={(v) => setCategoryDraft((p) => ({ ...p, advancingPerGroup: Number(v) || 2 }))}
                keyboardType="numeric"
              />
            </View>
          </View>
          <PickerRow<PaymentMode>
            label="Payment Mode"
            options={[
              { label: 'Online', value: 'online' },
              { label: 'At Venue', value: 'venue' },
              { label: 'Both', value: 'both' },
            ]}
            selected={categoryDraft.paymentMode}
            onSelect={(v) => setCategoryDraft((p) => ({ ...p, paymentMode: v }))}
          />
          <View style={styles.catFormActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowCategoryForm(false); setCategoryDraft(INITIAL_CATEGORY); }}
            >
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={addCategory}>
              <Text style={styles.addBtnText}>ADD</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addCategoryBtn}
          onPress={() => setShowCategoryForm(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addCategoryBtnText}>+ ADD CATEGORY</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CREATE TOURNAMENT</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step indicator */}
      <StepIndicator current={step} total={TOTAL_STEPS} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </View>

          {/* Nav buttons */}
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backNavBtn} onPress={goBack}>
              <Text style={styles.backNavBtnText}>{step === 1 ? 'CANCEL' : 'BACK'}</Text>
            </TouchableOpacity>
            {saving ? (
              <View style={styles.savingBtn}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.savingBtnText}>SAVING…</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
                <Text style={styles.nextBtnText}>
                  {step < TOTAL_STEPS ? 'NEXT' : 'CREATE TOURNAMENT'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: NAVY,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  backBtnText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  formCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.base,
    ...shadows.sm,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  backNavBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: NAVY,
    alignItems: 'center',
  },
  backNavBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: 1.5,
  },
  nextBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: NAVY,
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  savingBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  savingBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  catCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  catCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catCardInfo: {
    flex: 1,
  },
  catCardName: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
  },
  catCardMeta: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: colors.textTertiary,
    marginTop: 2,
  },
  removeBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  removeBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.error,
  },
  catForm: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: BLUE_ACCENT,
  },
  catFormTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  twoColItem: {
    flex: 1,
  },
  catFormActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  addBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: NAVY,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  addCategoryBtn: {
    borderWidth: 1.5,
    borderColor: NAVY,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addCategoryBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: 1.5,
  },
});
