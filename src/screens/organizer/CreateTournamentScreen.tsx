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
import { useNavigation, CommonActions } from '@react-navigation/native';
import { xAlert, xConfirm } from '../../utils/alert';
import { tournamentsApi } from '../../api/tournaments.api';
import { useTournamentStore } from '../../store/tournamentStore';
import {
  CategoryFormat,
  CategoryGender,
  PaymentMode,
  CreateCategoryInput,
} from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import DatePickerModal, { DateField } from '../../components/ui/DatePickerModal';
import PlacesAutocomplete, { PlaceResult } from '../../components/ui/PlacesAutocomplete';

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
  venueLat?: number;
  venueLng?: number;
  mapsLink?: string;
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
  matchFormat: 'best_of_1',
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
    backgroundColor: '#F5F7FA',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    color: '#1A1D21',
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
    color: '#64748B',
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
    color: '#64748B',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: '#F5F7FA',
  },
  optionActive: { backgroundColor: NAVY },
  optionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: '#64748B',
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
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: NAVY,
  },
  dotDone: {
    backgroundColor: '#06D6A0',
  },
  line: {
    width: 32,
    height: 2,
    backgroundColor: '#E2E8F0',
  },
  lineDone: {
    backgroundColor: NAVY,
  },
  dotText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#94A3B8',
  },
  dotTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#64748B',
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
  const [tournamentFormatType, setTournamentFormatType] = useState<'pool_knockout' | 'knockout_only'>('pool_knockout');

  const [manualVenue, setManualVenue] = useState(false);

  // Extract lat/lng from a Google Maps URL
  const parseMapsLink = (url: string): { lat: number; lng: number } | null => {
    // Format: /@18.5204,73.8567,17z or ?q=18.5204,73.8567
    const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
    const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
    return null;
  };

  // Date picker state
  type DateField = 'startDate' | 'endDate' | 'registrationDeadline';
  const [activeDateField, setActiveDateField] = useState<DateField | null>(null);

  const openDatePicker = (field: DateField) => setActiveDateField(field);
  const closeDatePicker = () => setActiveDateField(null);
  const confirmDate = (iso: string) => {
    if (activeDateField) update({ [activeDateField]: iso } as any);
    closeDatePicker();
  };

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
    if (!e.startDate && !e.registrationDeadline && form.registrationDeadline > form.startDate)
      e.registrationDeadline = 'Deadline must be on or before start date';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep3(): boolean {
    if (form.categories.length === 0) {
      xAlert('Required', 'Add at least one category before creating the tournament.');
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
      xAlert('Required', 'Category name is required.');
      return;
    }
    const newCat: CategoryDraft = { ...categoryDraft, _id: Date.now().toString() };
    update({ categories: [...form.categories, newCat] });
    setCategoryDraft(INITIAL_CATEGORY); setTournamentFormatType('pool_knockout');
    setShowCategoryForm(false);
  };

  const removeCategory = (id: string) => {
    update({ categories: form.categories.filter((c) => c._id !== id) });
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async (asDraft = false) => {
    setSaving(true);
    try {
      const createRes = await tournamentsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        venueName: form.venueName.trim(),
        venueAddress: form.venueAddress.trim(),
        venueLat: form.venueLat,
        venueLng: form.venueLng,
        city: form.city.trim(),
        state: form.state.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        registrationDeadline: form.registrationDeadline,
        initialStatus: asDraft ? 'draft' : 'registration_open',
      });

      const tournament = createRes.data?.data;
      if (!tournament?.id) throw new Error('Failed to create tournament');
      const tId = tournament.id;

      for (const cat of form.categories) {
        const { _id, paymentMode, ...catInput } = cat;
        await tournamentsApi.addCategory(tId, catInput);
      }

      addTournament(tournament);

      const statusMsg = asDraft
        ? `"${form.name}" has been saved as a draft.`
        : `"${form.name}" is now live and open for registrations!`;

      xConfirm(
        'Tournament Created!',
        `${statusMsg} Go to dashboard?`,
        () => {
          // Replace the Create screen with Dashboard so Back goes to My Events
          navigation.dispatch(
            CommonActions.reset({
              index: 1,
              routes: [
                { name: 'MyEvents' },
                { name: 'TournamentManage', params: { tournamentId: tId } },
              ],
            })
          );
        },
        'Dashboard',
        'Back to Events',
        () => navigation.goBack(),
      );
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to save tournament');
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
      <View style={{ marginBottom: spacing.md, zIndex: 9999 }}>
        <Text style={fieldStyles.label}>VENUE *</Text>

        {!manualVenue ? (
          <>
            <PlacesAutocomplete
              initialValue={form.venueName}
              placeholder="Search for a venue..."
              error={errors.venueName || errors.venueAddress}
              onSelect={(place: PlaceResult) => {
                update({
                  venueName: place.name,
                  venueAddress: place.address,
                  venueLat: place.lat || undefined,
                  venueLng: place.lng || undefined,
                  city: place.city || form.city,
                  state: place.state || form.state,
                });
              }}
            />
            {form.venueAddress ? (
              <View style={{ backgroundColor: '#F5F7FA', borderRadius: 8, padding: 10, marginTop: 4, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A1D21', marginBottom: 2 }}>{form.venueName}</Text>
                <Text style={{ fontSize: 11, fontWeight: '500', color: '#64748B' }}>{form.venueAddress}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => setManualVenue(true)}
              style={{ marginTop: 8 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#2196F3' }}>
                Can't find your venue? Enter manually →
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
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
              label="Google Maps Link"
              placeholder="Paste Google Maps URL for exact location"
              value={form.mapsLink ?? ''}
              onChangeText={(v) => {
                update({ mapsLink: v });
                const coords = parseMapsLink(v);
                if (coords) {
                  update({ venueLat: coords.lat, venueLng: coords.lng });
                }
              }}
              hint={form.venueLat && form.venueLng
                ? `📍 Location: ${form.venueLat.toFixed(4)}, ${form.venueLng.toFixed(4)}`
                : 'Paste a Google Maps link to set exact pin location'}
              keyboardType="url"
            />
            <TouchableOpacity
              onPress={() => setManualVenue(false)}
              style={{ marginTop: -4, marginBottom: 8 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#2196F3' }}>
                ← Search with Google instead
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
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
      <DateField
        label="REGISTRATION DEADLINE"
        value={form.registrationDeadline}
        onPress={() => openDatePicker('registrationDeadline')}
        error={errors.registrationDeadline}
        hint="Must be before start date"
        required
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
          <PickerRow<string>
            label="Tournament Format"
            options={[
              { label: 'Pool + Knockout', value: 'pool_knockout' },
              { label: 'Knockout Only', value: 'knockout_only' },
            ]}
            selected={tournamentFormatType}
            onSelect={(v) => {
              const fmt = v as 'pool_knockout' | 'knockout_only';
              setTournamentFormatType(fmt);
              if (fmt === 'knockout_only') {
                setCategoryDraft((p) => ({ ...p, groupSize: 0, advancingPerGroup: 0 }));
              } else {
                setCategoryDraft((p) => ({ ...p, groupSize: p.groupSize || 4, advancingPerGroup: p.advancingPerGroup || 2 }));
              }
            }}
          />
          {tournamentFormatType === 'pool_knockout' && (
            <View style={styles.twoCol}>
              <View style={styles.twoColItem}>
                <FormField
                  label="Group Size"
                  placeholder="4"
                  value={categoryDraft.groupSize ? String(categoryDraft.groupSize) : ''}
                  onChangeText={(v) => setCategoryDraft((p) => ({ ...p, groupSize: v === '' ? 0 : parseInt(v, 10) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.twoColItem}>
                <FormField
                  label="Advancing / Group"
                  placeholder="2"
                  value={categoryDraft.advancingPerGroup ? String(categoryDraft.advancingPerGroup) : ''}
                  onChangeText={(v) => setCategoryDraft((p) => ({ ...p, advancingPerGroup: v === '' ? 0 : parseInt(v, 10) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}
          <PickerRow<string>
            label="Match Format"
            options={[
              { label: 'Single Game', value: 'best_of_1' },
              { label: 'Best of 3', value: 'best_of_3' },
              { label: 'Best of 5', value: 'best_of_5' },
            ]}
            selected={categoryDraft.matchFormat ?? 'best_of_1'}
            onSelect={(v) => setCategoryDraft((p) => ({ ...p, matchFormat: v as any }))}
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
          <View style={styles.catFormActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowCategoryForm(false); setCategoryDraft(INITIAL_CATEGORY); setTournamentFormatType('pool_knockout'); }}
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#FFFFFF' }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
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
                  {step < TOTAL_STEPS ? 'NEXT' : 'CREATE & OPEN REGISTRATION'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Secondary "Save as Draft" link — only on final step */}
          {step === TOTAL_STEPS && !saving && (
            <TouchableOpacity
              style={{ alignSelf: 'center', paddingVertical: 12, marginTop: 4 }}
              onPress={() => {
                if (validateStep3()) handleSave(true);
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#64748B',
                  letterSpacing: 0.5,
                  textDecorationLine: 'underline',
                }}
              >
                Save as Draft instead
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
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
      <DatePickerModal
        visible={activeDateField === 'registrationDeadline'}
        label="SELECT REGISTRATION DEADLINE"
        value={form.registrationDeadline}
        maxDate={form.startDate || undefined}
        onConfirm={confirmDate}
        onCancel={closeDatePicker}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + spacing.md : spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  backBtnText: {
    fontSize: 22,
    color: '#1A1D21',
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: NAVY,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 140,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'visible' as any,
    zIndex: 10,
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
    borderColor: '#E2E8F0',
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
  },
  backNavBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: '#1A1D21',
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
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#1A1D21',
  },
  catCardMeta: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: '#64748B',
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
    backgroundColor: '#F5F7FA',
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: NAVY,
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
    borderColor: '#E2E8F0',
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#1A1D21',
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
    borderColor: '#E2E8F0',
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
