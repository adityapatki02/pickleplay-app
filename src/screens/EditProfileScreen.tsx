import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth.api';
import { SkillLevel, Gender } from '../types/user.types';
// Light theme — no dark background needed

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY  = '#001E40';
const BLUE  = '#1858D6';
const BG    = '#F3F4F5';
const WHITE = '#FFFFFF';
const GREEN = '#06D6A0';
const RED   = '#BA1A1A';
const GRAY  = '#737780';
const BORDER = '#E1E3E4';

// ─── Icons ────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={NAVY} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SaveIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke={WHITE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Polyline points="17 21 17 13 7 13 7 21" stroke={WHITE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Polyline points="7 3 7 8 15 8" stroke={WHITE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

function Polyline({ points, stroke, strokeWidth, strokeLinecap, strokeLinejoin }: any) {
  return (
    <Path
      d={`M ${points.split(' ').map((p: string) => p).join(' L ')}`}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap={strokeLinecap}
      strokeLinejoin={strokeLinejoin}
      fill="none"
    />
  );
}

// ─── Field Components ─────────────────────────────────────────────────────────

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  required = false,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={f.group}>
      <Text style={f.label}>
        {label}
        {required && <Text style={{ color: RED }}> *</Text>}
      </Text>
      <TextInput
        style={[f.input, multiline && f.inputMulti, focused && f.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

function PickerField<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T | undefined;
  options: { label: string; value: T }[];
  onSelect: (v: T) => void;
}) {
  return (
    <View style={f.group}>
      <Text style={f.label}>{label}</Text>
      <View style={f.pickerRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[f.chip, value === opt.value && f.chipActive]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.75}
          >
            {value === opt.value && (
              <View style={f.checkDot} />
            )}
            <Text style={[f.chipText, value === opt.value && f.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const f = StyleSheet.create({
  group: { marginBottom: 18 },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1D21',
  },
  inputMulti: {
    minHeight: 90,
    paddingTop: 13,
  },
  inputFocused: {
    borderColor: BLUE,
    backgroundColor: '#FFFFFF',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F5F7FA',
    gap: 6,
  },
  chipActive: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: WHITE,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  chipTextActive: {
    color: WHITE,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { user, updateUser } = useAuthStore();

  const [fullName, setFullName]         = useState(user?.fullName ?? '');
  const [displayName, setDisplayName]   = useState(user?.displayName ?? '');
  const [city, setCity]                 = useState(user?.city ?? '');
  const [state, setState]               = useState(user?.state ?? '');
  const [bio, setBio]                   = useState(user?.bio ?? '');
  const [skill, setSkill]               = useState<SkillLevel | undefined>(user?.selfReportedSkill);
  const [gender, setGender]             = useState<Gender | undefined>(user?.gender);
  const [saving, setSaving]             = useState(false);

  const hasChanges =
    fullName !== (user?.fullName ?? '') ||
    displayName !== (user?.displayName ?? '') ||
    city !== (user?.city ?? '') ||
    state !== (user?.state ?? '') ||
    bio !== (user?.bio ?? '') ||
    skill !== user?.selfReportedSkill ||
    gender !== user?.gender;

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Full name is required.');
      return;
    }
    setSaving(true);
    try {
      const updates = {
        fullName: fullName.trim(),
        displayName: displayName.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        bio: bio.trim() || undefined,
        selfReportedSkill: skill,
        gender,
      };
      await authApi.updateProfile(updates);
      updateUser(updates);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (hasChanges) {
      Alert.alert('Discard changes?', 'You have unsaved changes.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={handleDiscard}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={s.headerTitle}>EDIT PROFILE</Text>
        <TouchableOpacity
          style={[s.saveBtn, (!hasChanges || saving) && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={WHITE} />
            : <Text style={s.saveBtnText}>SAVE</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Section: Identity */}
          <Text style={s.sectionLabel}>IDENTITY</Text>
          <View style={s.section}>
            <InputField
              label="FULL NAME"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              required
            />
            <InputField
              label="DISPLAY NAME"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Short name shown in the app"
            />
          </View>

          {/* Section: Location */}
          <Text style={s.sectionLabel}>LOCATION</Text>
          <View style={s.section}>
            <InputField
              label="CITY"
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Pune"
            />
            <InputField
              label="STATE"
              value={state}
              onChangeText={setState}
              placeholder="e.g. Maharashtra"
            />
          </View>

          {/* Section: Pickleball */}
          <Text style={s.sectionLabel}>PICKLEBALL</Text>
          <View style={s.section}>
            <PickerField<SkillLevel>
              label="SKILL LEVEL"
              value={skill}
              options={[
                { label: 'Beginner',     value: 'beginner'     },
                { label: 'Intermediate', value: 'intermediate' },
                { label: 'Advanced',     value: 'advanced'     },
                { label: 'Pro',          value: 'pro'          },
              ]}
              onSelect={setSkill}
            />
          </View>

          {/* Section: Personal */}
          <Text style={s.sectionLabel}>PERSONAL</Text>
          <View style={s.section}>
            <PickerField<Gender>
              label="GENDER"
              value={gender}
              options={[
                { label: 'Male',   value: 'male'   },
                { label: 'Female', value: 'female' },
                { label: 'Other',  value: 'other'  },
              ]}
              onSelect={setGender}
            />
            <InputField
              label="BIO"
              value={bio}
              onChangeText={setBio}
              placeholder="Tell other players a bit about yourself…"
              multiline
            />
          </View>

          {/* Locked fields note */}
          <View style={s.lockedNote}>
            <Text style={s.lockedNoteText}>
              📱 Phone number and email cannot be changed here.{'\n'}
              Contact support if you need to update them.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 12 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 2.5,
  },
  saveBtn: {
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  saveBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 1.5,
  },
  scroll: {
    padding: 16,
    backgroundColor: '#F5F7FA',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 2.5,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 8,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockedNote: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 4,
  },
  lockedNoteText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 18,
  },
});
