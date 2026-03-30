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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { tournamentsApi } from '../../api/tournaments.api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useTournamentStore } from '../../store/tournamentStore';
import {
  CategoryFormat,
  CategoryGender,
  KnockoutFormat,
  PaymentMode,
  CreateCategoryInput,
} from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryDraft extends CreateCategoryInput {
  _id: string; // local key
  paymentMode: PaymentMode;
  advancingPerGroup: number;
}

interface CourtDraft {
  _id: string;
  name: string;
}

interface FormData {
  // Step 1
  name: string;
  description: string;
  // Step 2
  venueName: string;
  venueAddress: string;
  city: string;
  state: string;
  // Step 3
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  // Step 4
  categories: CategoryDraft[];
  // Step 5
  courts: CourtDraft[];
}

const INITIAL_FORM: FormData = {
  name: '',
  description: '',
  venueName: '',
  venueAddress: '',
  city: '',
  state: '',
  startDate: '',
  endDate: '',
  registrationDeadline: '',
  categories: [],
  courts: [],
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

// ─── Picker helpers ───────────────────────────────────────────────────────────

interface PickerRowProps<T extends string> {
  label: string;
  options: { label: string; value: T }[];
  selected: T;
  onSelect: (v: T) => void;
}

function PickerRow<T extends string>({ label, options, selected, onSelect }: PickerRowProps<T>) {
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
  container: { marginBottom: spacing.base },
  label: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceContainerHigh,
  },
  optionActive: { backgroundColor: colors.primary },
  optionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  optionTextActive: { color: colors.onPrimary },
});

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={stepStyles.row}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <View
            key={n}
            style={[
              stepStyles.dot,
              active && stepStyles.dotActive,
              done && stepStyles.dotDone,
            ]}
          >
            <Text
              style={[
                stepStyles.dotText,
                (active || done) && stepStyles.dotTextActive,
              ]}
            >
              {n}
            </Text>
          </View>
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
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  dotDone: {
    backgroundColor: colors.primaryLight,
  },
  dotText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  dotTextActive: {
    color: colors.onPrimary,
  },
});

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return <Text style={sectionStyle.title}>{title}</Text>;
}
const sectionStyle = StyleSheet.create({
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CreateTournamentScreen() {
  const navigation = useNavigation();
  const { addTournament } = useTournamentStore();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  // Category form state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<Omit<CategoryDraft, '_id'>>(INITIAL_CATEGORY);

  // Court form state
  const [showCourtInput, setShowCourtInput] = useState(false);
  const [courtName, setCourtName] = useState('');

  // Field errors
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | string, string>>>({});

  const update = (fields: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...fields }));
    const cleared: typeof errors = { ...errors };
    Object.keys(fields).forEach((k) => delete cleared[k]);
    setErrors(cleared);
  };

  // ── Validation ───────────────────────────────────────────────────────────

  function validateStep1(): boolean {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Tournament name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: typeof errors = {};
    if (!form.venueName.trim()) e.venueName = 'Venue name is required';
    if (!form.venueAddress.trim()) e.venueAddress = 'Venue address is required';
    if (!form.city.trim()) e.city = 'City is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep3(): boolean {
    const e: typeof errors = {};
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!form.startDate || !dateRegex.test(form.startDate)) e.startDate = 'Enter a valid date (YYYY-MM-DD)';
    if (!form.endDate || !dateRegex.test(form.endDate)) e.endDate = 'Enter a valid date (YYYY-MM-DD)';
    if (!form.registrationDeadline || !dateRegex.test(form.registrationDeadline))
      e.registrationDeadline = 'Enter a valid date (YYYY-MM-DD)';
    if (!e.startDate && !e.registrationDeadline) {
      if (form.registrationDeadline >= form.startDate)
        e.registrationDeadline = 'Deadline must be before start date';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep4(): boolean {
    if (form.categories.length === 0) {
      Alert.alert('Required', 'Add at least one category to continue.');
      return false;
    }
    return true;
  }

  function validateStep5(): boolean {
    if (form.courts.length === 0) {
      Alert.alert('Required', 'Add at least one court to continue.');
      return false;
    }
    return true;
  }

  const goNext = () => {
    let valid = false;
    if (step === 1) valid = validateStep1();
    else if (step === 2) valid = validateStep2();
    else if (step === 3) valid = validateStep3();
    else if (step === 4) valid = validateStep4();
    else if (step === 5) valid = validateStep5();
    if (valid) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else navigation.goBack();
  };

  // ── Category actions ─────────────────────────────────────────────────────

  const addCategory = () => {
    if (!categoryDraft.name.trim()) {
      Alert.alert('Required', 'Category name is required.');
      return;
    }
    const newCat: CategoryDraft = {
      ...categoryDraft,
      _id: Date.now().toString(),
    };
    update({ categories: [...form.categories, newCat] });
    setCategoryDraft(INITIAL_CATEGORY);
    setShowCategoryForm(false);
  };

  const removeCategory = (id: string) => {
    update({ categories: form.categories.filter((c) => c._id !== id) });
  };

  // ── Court actions ────────────────────────────────────────────────────────

  const addCourt = () => {
    if (!courtName.trim()) {
      Alert.alert('Required', 'Court name is required.');
      return;
    }
    const newCourt: CourtDraft = { _id: Date.now().toString(), name: courtName.trim() };
    update({ courts: [...form.courts, newCourt] });
    setCourtName('');
    setShowCourtInput(false);
  };

  const removeCourt = (id: string) => {
    update({ courts: form.courts.filter((c) => c._id !== id) });
  };

  // ── Save ─────────────────────────────────────────────────────────────────

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

      for (const court of form.courts) {
        await tournamentsApi.addCourt(tId, { name: court.name });
      }

      addTournament(tournament);

      Alert.alert('Success', 'Tournament created!', [
        {
          text: 'Go to Dashboard',
          onPress: () => (navigation as any).navigate('TournamentManage', { tournamentId: tId }),
        },
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to save tournament');
    } finally {
      setSaving(false);
    }
  };

  // ─── Step renderers ──────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View>
      <SectionTitle title="Basic Info" />
      <Input
        label="Tournament Name *"
        placeholder="e.g. City Open 2026"
        value={form.name}
        onChangeText={(v) => update({ name: v })}
        error={errors.name}
        autoCapitalize="words"
      />
      <Input
        label="Description"
        placeholder="Optional — describe the tournament"
        value={form.description}
        onChangeText={(v) => update({ description: v })}
        multiline
        numberOfLines={3}
        style={{ height: 80, textAlignVertical: 'top' }}
      />
    </View>
  );

  const renderStep2 = () => (
    <View>
      <SectionTitle title="Venue" />
      <Input
        label="Venue Name *"
        placeholder="e.g. DLF Sports Complex"
        value={form.venueName}
        onChangeText={(v) => update({ venueName: v })}
        error={errors.venueName}
        autoCapitalize="words"
      />
      <Input
        label="Venue Address *"
        placeholder="Full street address"
        value={form.venueAddress}
        onChangeText={(v) => update({ venueAddress: v })}
        error={errors.venueAddress}
        autoCapitalize="sentences"
      />
      <Input
        label="City *"
        placeholder="e.g. Bangalore"
        value={form.city}
        onChangeText={(v) => update({ city: v })}
        error={errors.city}
        autoCapitalize="words"
      />
      <Input
        label="State"
        placeholder="e.g. Karnataka"
        value={form.state}
        onChangeText={(v) => update({ state: v })}
        autoCapitalize="words"
      />
    </View>
  );

  const renderStep3 = () => (
    <View>
      <SectionTitle title="Dates" />
      <Input
        label="Start Date *"
        placeholder="YYYY-MM-DD"
        value={form.startDate}
        onChangeText={(v) => update({ startDate: v })}
        error={errors.startDate}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Input
        label="End Date *"
        placeholder="YYYY-MM-DD"
        value={form.endDate}
        onChangeText={(v) => update({ endDate: v })}
        error={errors.endDate}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Input
        label="Registration Deadline *"
        placeholder="YYYY-MM-DD"
        value={form.registrationDeadline}
        onChangeText={(v) => update({ registrationDeadline: v })}
        error={errors.registrationDeadline}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        hint="Must be before start date"
      />
    </View>
  );

  const renderStep4 = () => (
    <View>
      <SectionTitle title="Categories" />

      {form.categories.map((cat) => (
        <Card key={cat._id} variant="outlined" style={styles.categoryCard}>
          <View style={styles.categoryCardRow}>
            <View style={styles.categoryCardInfo}>
              <Text style={styles.categoryName}>{cat.name}</Text>
              <Text style={styles.categoryMeta}>
                {cat.format.toUpperCase()} · {cat.gender.toUpperCase()} · ₹{cat.entryFee}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => removeCategory(cat._id)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ))}

      {showCategoryForm ? (
        <Card variant="filled" style={styles.inlineForm}>
          <Text style={styles.inlineFormTitle}>ADD CATEGORY</Text>
          <Input
            label="Category Name *"
            placeholder="e.g. Open Doubles"
            value={categoryDraft.name}
            onChangeText={(v) => setCategoryDraft((p) => ({ ...p, name: v }))}
            autoCapitalize="words"
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
              { label: 'Male', value: 'male' },
              { label: 'Female', value: 'female' },
              { label: 'Mixed', value: 'mixed' },
              { label: 'Open', value: 'open' },
            ]}
            selected={categoryDraft.gender}
            onSelect={(v) => setCategoryDraft((p) => ({ ...p, gender: v }))}
          />
          <View style={styles.row2}>
            <Input
              label="Entry Fee (₹)"
              placeholder="0"
              value={categoryDraft.entryFee === 0 ? '' : String(categoryDraft.entryFee)}
              onChangeText={(v) => setCategoryDraft((p) => ({ ...p, entryFee: Number(v) || 0 }))}
              keyboardType="numeric"
              containerStyle={{ flex: 1, marginRight: spacing.sm }}
            />
            <Input
              label="Max Teams"
              placeholder="16"
              value={categoryDraft.maxTeams === 0 ? '' : String(categoryDraft.maxTeams)}
              onChangeText={(v) => setCategoryDraft((p) => ({ ...p, maxTeams: Number(v) || 0 }))}
              keyboardType="numeric"
              containerStyle={{ flex: 1 }}
            />
          </View>
          <View style={styles.row2}>
            <Input
              label="Group Size"
              placeholder="4"
              value={String(categoryDraft.groupSize)}
              onChangeText={(v) => setCategoryDraft((p) => ({ ...p, groupSize: Number(v) || 4 }))}
              keyboardType="numeric"
              containerStyle={{ flex: 1, marginRight: spacing.sm }}
            />
            <Input
              label="Advancing / Group"
              placeholder="2"
              value={String(categoryDraft.advancingPerGroup)}
              onChangeText={(v) =>
                setCategoryDraft((p) => ({ ...p, advancingPerGroup: Number(v) || 2 }))
              }
              keyboardType="numeric"
              containerStyle={{ flex: 1 }}
            />
          </View>
          <PickerRow<KnockoutFormat>
            label="Knockout Format"
            options={[
              { label: 'Single Elim', value: 'single_elimination' },
              { label: 'Double Elim', value: 'double_elimination' },
              { label: 'Round Robin', value: 'round_robin' },
            ]}
            selected={categoryDraft.knockoutFormat ?? 'single_elimination'}
            onSelect={(v) => setCategoryDraft((p) => ({ ...p, knockoutFormat: v }))}
          />
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
          <View style={styles.inlineFormActions}>
            <Button
              title="Cancel"
              variant="outline"
              size="sm"
              onPress={() => {
                setShowCategoryForm(false);
                setCategoryDraft(INITIAL_CATEGORY);
              }}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <Button
              title="Add"
              variant="primary"
              size="sm"
              onPress={addCategory}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : (
        <Button
          title="+ Add Category"
          variant="tonal"
          onPress={() => setShowCategoryForm(true)}
          fullWidth
        />
      )}
    </View>
  );

  const renderStep5 = () => (
    <View>
      <SectionTitle title="Courts" />

      <View style={styles.courtChips}>
        {form.courts.map((court) => (
          <View key={court._id} style={styles.courtChip}>
            <Text style={styles.courtChipText}>{court.name}</Text>
            <TouchableOpacity onPress={() => removeCourt(court._id)} style={styles.courtChipRemove}>
              <Text style={styles.courtChipRemoveText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {showCourtInput ? (
        <Card variant="filled" style={styles.inlineForm}>
          <Input
            label="Court Name *"
            placeholder="e.g. Court 1"
            value={courtName}
            onChangeText={setCourtName}
            autoCapitalize="words"
            autoFocus
          />
          <View style={styles.inlineFormActions}>
            <Button
              title="Cancel"
              variant="outline"
              size="sm"
              onPress={() => {
                setShowCourtInput(false);
                setCourtName('');
              }}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <Button
              title="Add"
              variant="primary"
              size="sm"
              onPress={addCourt}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : (
        <Button
          title="+ Add Court"
          variant="tonal"
          onPress={() => setShowCourtInput(true)}
          fullWidth
        />
      )}
    </View>
  );

  const renderStep6 = () => (
    <View>
      <SectionTitle title="Review" />

      <Card variant="outlined" style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>BASIC INFO</Text>
        <ReviewRow label="Name" value={form.name} />
        {form.description ? <ReviewRow label="Description" value={form.description} /> : null}
      </Card>

      <Card variant="outlined" style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>VENUE</Text>
        <ReviewRow label="Venue" value={form.venueName} />
        <ReviewRow label="Address" value={form.venueAddress} />
        <ReviewRow label="City" value={form.city + (form.state ? `, ${form.state}` : '')} />
      </Card>

      <Card variant="outlined" style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>DATES</Text>
        <ReviewRow label="Start" value={form.startDate} />
        <ReviewRow label="End" value={form.endDate} />
        <ReviewRow label="Reg. Deadline" value={form.registrationDeadline} />
      </Card>

      <Card variant="outlined" style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>CATEGORIES ({form.categories.length})</Text>
        {form.categories.map((cat) => (
          <ReviewRow
            key={cat._id}
            label={cat.name}
            value={`${cat.format} · ${cat.gender} · ₹${cat.entryFee}`}
          />
        ))}
      </Card>

      <Card variant="outlined" style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>COURTS ({form.courts.length})</Text>
        {form.courts.map((c) => (
          <ReviewRow key={c._id} label={c.name} value="" />
        ))}
      </Card>

      {saving ? (
        <View style={styles.savingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.savingText}>Saving tournament…</Text>
        </View>
      ) : (
        <Button
          title="Create Tournament"
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleSave}
          style={{ marginTop: spacing.lg }}
        />
      )}
    </View>
  );

  // ─── Nav buttons ─────────────────────────────────────────────────────────

  const renderNavButtons = () => {
    if (step === 6) return null;
    return (
      <View style={styles.navRow}>
        <Button
          title={step === 1 ? 'Cancel' : 'Back'}
          variant="outline"
          size="md"
          onPress={goBack}
          style={{ flex: 1, marginRight: spacing.sm }}
        />
        <Button
          title="Next"
          variant="primary"
          size="md"
          onPress={goNext}
          style={{ flex: 1 }}
        />
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surfaceContainerLowest} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>CREATE TOURNAMENT</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Step indicator */}
      <StepIndicator current={step} total={6} />

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
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
            {step === 6 && renderStep6()}
          </View>

          {renderNavButtons()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Review row helper ────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={reviewRowStyles.row}>
      <Text style={reviewRowStyles.label}>{label}</Text>
      {value ? <Text style={reviewRowStyles.value}>{value}</Text> : null}
    </View>
  );
}

const reviewRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: typography.fontSize.md,
    color: colors.text,
    flex: 2,
    textAlign: 'right',
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 28,
    color: colors.primary,
    fontWeight: '300',
    lineHeight: 32,
  },
  topBarTitle: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: typography.letterSpacing.wider,
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
    marginTop: spacing.sm,
  },
  categoryCard: {
    marginBottom: spacing.sm,
  },
  categoryCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryCardInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  categoryName: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
  },
  categoryMeta: {
    fontSize: typography.fontSize.sm,
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
  inlineForm: {
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  inlineFormTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.base,
  },
  inlineFormActions: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  row2: {
    flexDirection: 'row',
  },
  courtChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  courtChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    gap: spacing.xs,
  },
  courtChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  courtChipRemove: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtChipRemoveText: {
    fontSize: 14,
    color: colors.onPrimary,
    lineHeight: 18,
    fontWeight: '600',
  },
  reviewSection: {
    marginBottom: spacing.md,
    padding: spacing.base,
  },
  reviewSectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.sm,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  savingText: {
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
