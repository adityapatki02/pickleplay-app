import React, { useState, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { xAlert, xConfirm } from '../../utils/alert';
import { tournamentsApi } from '../../api/tournaments.api';
import {
  getMyDuprAdminClubs,
  enableTournamentDupr,
  type DuprAdminClub,
} from '../../api/dupr.api';
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
import { YColors, YTopBar, YButton } from '../../components/yoiden';
import * as ImagePicker from 'expo-image-picker';

const NAVY = YColors.ink;
const BLUE_ACCENT = YColors.accent;

// DUPR section. Palette rule: lime (brandLine) is used only as a hairline; blue
// owns the actionable/selected states.
const duprStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: YColors.brandLine,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: NAVY,
    marginBottom: 8,
  },
  note: { fontSize: 13, lineHeight: 19, color: '#64748B' },
  sub: { fontSize: 13, fontWeight: '600', color: NAVY, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  chipActive: { backgroundColor: BLUE_ACCENT, borderColor: BLUE_ACCENT },
  chipText: { fontSize: 13, fontWeight: '600', color: NAVY },
  chipTextActive: { color: '#fff' },
  chipRole: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: '#94A3B8' },
  hint: { fontSize: 12, lineHeight: 17, color: '#64748B', marginTop: 10 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: NAVY },
  toggleHint: { fontSize: 12, color: '#64748B', marginTop: 2 },
  toggle: {
    width: 46,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: BLUE_ACCENT },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  badge: {
    backgroundColor: NAVY,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: '#fff' },
});

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
  banner: { uri: string; name: string; type: string } | null;
  /** DUPR club to submit rated results under; null = not a DUPR event. */
  duprClubId: number | null;
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
  banner: null,
  duprClubId: null,
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

function BannerPicker({
  value,
  onChange,
}: {
  value: FormData['banner'];
  onChange: (b: FormData['banner']) => void;
}) {
  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [5, 2], // matches the API's 1600×640 banner frame
      quality: 0.9,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    onChange({
      uri: a.uri,
      name: a.fileName || 'banner.jpg',
      type: a.mimeType || 'image/jpeg',
    });
  };

  return (
    <View style={{ marginBottom: 16 }}>
      {value ? (
        <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: YColors.ink + '22' }}>
          <Image source={{ uri: value.uri }} style={{ width: '100%', aspectRatio: 5 / 2 }} resizeMode="cover" />
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={pick} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: NAVY }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>CHANGE</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onChange(null)} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#EDEBE4' }}>
              <Text style={{ color: NAVY, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>REMOVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={pick}
          style={{
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: BLUE_ACCENT,
            borderRadius: 12,
            paddingVertical: 26,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: BLUE_ACCENT, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
            + ADD BANNER IMAGE (OPTIONAL)
          </Text>
          <Text style={{ color: '#737780', fontSize: 10, marginTop: 4 }}>
            Wide image, 5:2 — shown on the public tournament page
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

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
  // Discovery visibility for this event. Default 'unlisted' so a new event is
  // live + share-link reachable but NOT broadcast into everyone's discovery.
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'draft'>('unlisted');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<Omit<CategoryDraft, '_id'>>(INITIAL_CATEGORY);
  const [tournamentFormatType, setTournamentFormatType] = useState<'pool_knockout' | 'knockout_only'>('pool_knockout');

  const [manualVenue, setManualVenue] = useState(false);

  // DUPR eligibility — the clubs this organizer can submit rated results under.
  // Fetched live (never cached) so a freshly granted ORGANIZER role appears.
  const [dupr, setDupr] = useState<{ loading: boolean; connected: boolean; clubs: DuprAdminClub[] }>(
    { loading: true, connected: false, clubs: [] },
  );
  useEffect(() => {
    let alive = true;
    getMyDuprAdminClubs()
      .then((res) => {
        if (!alive) return;
        setDupr({
          loading: false,
          connected: !!res.data?.connected,
          clubs: res.data?.clubs ?? [],
        });
      })
      .catch(() => {
        // Endpoint unavailable / not signed in for DUPR — treat as "not connected"
        // rather than blocking tournament creation.
        if (alive) setDupr({ loading: false, connected: false, clubs: [] });
      });
    return () => {
      alive = false;
    };
  }, []);

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

  const handleSave = async () => {
    const asDraft = visibility === 'draft';
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
        visibility,
      });

      const tournament = createRes.data?.data;
      if (!tournament?.id) throw new Error('Failed to create tournament');
      const tId = tournament.id;

      for (const cat of form.categories) {
        const { _id, paymentMode, ...catInput } = cat;
        await tournamentsApi.addCategory(tId, catInput);
      }

      // Attach the DUPR club (server re-verifies the organizer's DIRECTOR/
      // ORGANIZER role live). Best-effort: the tournament already exists, so a
      // failure here shouldn't abort creation — surface it and let them retry.
      if (form.duprClubId != null) {
        try {
          await enableTournamentDupr(tId, form.duprClubId);
        } catch {
          xAlert(
            'DUPR not attached',
            "The tournament was created, but linking it to your DUPR club didn't go through. You can retry from the tournament page.",
          );
        }
      }

      // Banner upload is best-effort — the tournament already exists, and the
      // detail screen has ADD BANNER for retries.
      if (form.banner) {
        try {
          await tournamentsApi.uploadBanner(tId, form.banner);
        } catch {
          xAlert(
            'Banner not uploaded',
            'The tournament was created, but the banner failed to upload. You can add it from the tournament page.',
          );
        }
      }

      addTournament(tournament);

      // Non-draft events get a shareable link straight away. Copy it to the
      // clipboard now so the organizer can paste it to their group without
      // hunting for the event again; the detail screen has a COPY LINK button
      // for later.
      const shareUrl = tournament.slug ? `https://console.yoiden.com/t/${tournament.slug}` : '';
      let linkMsg = '';
      if (!asDraft && shareUrl) {
        try {
          await Clipboard.setStringAsync(shareUrl);
          linkMsg = `\n\nLink copied to your clipboard:\n${shareUrl}`;
        } catch {
          linkMsg = `\n\nShare link:\n${shareUrl}`;
        }
      }

      const statusMsg =
        visibility === 'draft'
          ? `"${form.name}" has been saved as a draft.`
          : visibility === 'unlisted'
            ? `"${form.name}" is live and private — only people you send the link to can open it.`
            : `"${form.name}" is now live and listed in the app for everyone to find.`;

      xConfirm(
        'Tournament Created!',
        `${statusMsg}${linkMsg}\n\nOpen it now?`,
        () => {
          // Replace Create with the detail screen so Back returns to Play
          navigation.dispatch(
            CommonActions.reset({
              index: 1,
              routes: [
                { name: 'Play' },
                { name: 'TournamentDetail', params: { tournamentId: tId } },
              ],
            })
          );
        },
        'Open',
        'Back to Play',
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
      <BannerPicker value={form.banner} onChange={(banner) => update({ banner })} />
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
      {/* ── DUPR rating ─────────────────────────────────────────────── */}
      <View style={duprStyles.card}>
        <Text style={duprStyles.title}>DUPR RATING</Text>
        {dupr.loading ? (
          <ActivityIndicator color={BLUE_ACCENT} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
        ) : !dupr.connected ? (
          <Text style={duprStyles.note}>
            Connect your DUPR account from your profile to submit official ratings for this event.
          </Text>
        ) : dupr.clubs.length === 0 ? (
          <Text style={duprStyles.note}>
            You're not a director or organizer of a DUPR club yet. Apply on DUPR to run rated events —
            your clubs will appear here once approved.
          </Text>
        ) : (
          <>
            <Text style={duprStyles.sub}>Submit this event's results to a DUPR club</Text>
            <View style={duprStyles.chipRow}>
              <TouchableOpacity
                onPress={() => update({ duprClubId: null })}
                activeOpacity={0.8}
                style={[duprStyles.chip, form.duprClubId == null && duprStyles.chipActive]}
              >
                <Text style={[duprStyles.chipText, form.duprClubId == null && duprStyles.chipTextActive]}>
                  Not rated
                </Text>
              </TouchableOpacity>
              {dupr.clubs.map((club) => {
                const active = form.duprClubId === club.clubId;
                return (
                  <TouchableOpacity
                    key={club.clubId}
                    onPress={() => update({ duprClubId: club.clubId })}
                    activeOpacity={0.8}
                    style={[duprStyles.chip, active && duprStyles.chipActive]}
                  >
                    <Text style={[duprStyles.chipText, active && duprStyles.chipTextActive]}>
                      {club.clubName}
                    </Text>
                    <Text style={[duprStyles.chipRole, active && duprStyles.chipTextActive]}>
                      {club.role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {form.duprClubId != null && (
              <Text style={duprStyles.hint}>
                Turn on "DUPR rated" per category below. Only pickleball results with all players DUPR-linked are submitted.
              </Text>
            )}
          </>
        )}
      </View>

      {form.categories.map((cat) => (
        <View key={cat._id} style={styles.catCard}>
          <View style={styles.catCardRow}>
            <View style={styles.catCardInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.catCardName}>{cat.name}</Text>
                {cat.duprRated && form.duprClubId != null && (
                  <View style={duprStyles.badge}>
                    <Text style={duprStyles.badgeText}>DUPR</Text>
                  </View>
                )}
              </View>
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
          {form.duprClubId != null && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setCategoryDraft((p) => ({ ...p, duprRated: !p.duprRated }))}
              style={duprStyles.toggleRow}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={duprStyles.toggleLabel}>DUPR rated category</Text>
                <Text style={duprStyles.toggleHint}>Results count toward players' DUPR ratings</Text>
              </View>
              <View style={[duprStyles.toggle, categoryDraft.duprRated && duprStyles.toggleOn]}>
                <View style={[duprStyles.toggleKnob, categoryDraft.duprRated && duprStyles.toggleKnobOn]} />
              </View>
            </TouchableOpacity>
          )}
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={YColors.bg} />

      {/* The avoider wraps the header too, so its frame starts at the top of the
          safe area and needs no vertical offset. Offsetting by a guessed header
          height (it was 90) over-pads on iOS and leaves a dead strip of
          background between the form and the keyboard. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <YTopBar eyebrow="HOST" title="CREATE TOURNAMENT" onBack={goBack} />

        {/* Step indicator */}
        <StepIndicator current={step} total={TOTAL_STEPS} />
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

          {/* Visibility selector — only on the final step */}
          {step === TOTAL_STEPS && !saving && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 8 }}>
                WHO CAN FIND THIS EVENT?
              </Text>
              {([
                { key: 'unlisted', title: 'Private', hint: 'Live — only people you send the link to can open it' },
                { key: 'public', title: 'Public', hint: 'Listed in the app — anyone can find it and register' },
                { key: 'draft', title: 'Draft', hint: 'Not live yet — finish and publish it later' },
              ] as const).map((opt) => {
                const active = visibility === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setVisibility(opt.key)}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      marginBottom: 8,
                      backgroundColor: active ? '#ECFDF7' : '#F5F7FA',
                      borderColor: active ? '#06D6A0' : '#E2E8F0',
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderColor: active ? '#06D6A0' : '#CBD5E1',
                      }}
                    >
                      {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#06D6A0' }} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: active ? '#0F172A' : '#1A1D21' }}>{opt.title}</Text>
                      <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#64748B', marginTop: 2 }}>{opt.hint}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

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
                  {step < TOTAL_STEPS ? 'NEXT' : visibility === 'draft' ? 'SAVE DRAFT' : 'CREATE EVENT'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
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
    backgroundColor: YColors.bg,
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
