import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth.api';
import { SkillLevel } from '../../types';
import { YColors, YFonts } from '../../config/yoiden';

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileSetup'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SKILL_LEVELS: { value: SkillLevel; label: string; rating: string }[] = [
  { value: 'beginner', label: 'BEGINNER', rating: '2.0 - 2.5' },
  { value: 'intermediate', label: 'INTERMEDIATE', rating: '3.0 - 3.5' },
  { value: 'advanced', label: 'ADVANCED', rating: '4.0 - 4.5' },
  { value: 'pro', label: 'PRO', rating: '5.0+' },
];

export const ProfileSetupScreen: React.FC<Props> = () => {
  const { updateUser } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [skill, setSkill] = useState<SkillLevel | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Name is required';
    if (!city.trim()) newErrors.city = 'City is required';
    if (!skill) newErrors.skill = 'Select your skill level';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await authApi.updateProfile({
        fullName: fullName.trim(),
        city: city.trim(),
        selfReportedSkill: skill!,
      });
      updateUser(response.data.data);
    } catch {
      setErrors({ submit: 'Failed to save profile. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.outer}>
      {/* Editorial logo header */}
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
        <View style={s.stepBadge}>
          <Text style={s.stepText}>STEP 1 OF 1</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.eyebrow}>YOUR PROFILE</Text>
        <Text style={s.title}>BUILD YOUR</Text>
        <Text style={s.titleAccent}>PLAYER PROFILE.</Text>
        <Text style={s.subtitle}>
          This helps us match you with the right tournaments and opponents.
        </Text>

        {/* Full Name */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>FULL NAME</Text>
          <TextInput
            style={[s.textInput, errors.fullName ? s.textInputError : null]}
            placeholder="Enter your name"
            placeholderTextColor={YColors.ink3}
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              setErrors((prev) => ({ ...prev, fullName: '' }));
            }}
            autoCapitalize="words"
          />
          {errors.fullName ? (
            <Text style={s.fieldError}>{errors.fullName}</Text>
          ) : null}
        </View>

        {/* City */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>CITY</Text>
          <TextInput
            style={[s.textInput, errors.city ? s.textInputError : null]}
            placeholder="Enter your city"
            placeholderTextColor={YColors.ink3}
            value={city}
            onChangeText={(text) => {
              setCity(text);
              setErrors((prev) => ({ ...prev, city: '' }));
            }}
            autoCapitalize="words"
          />
          {errors.city ? (
            <Text style={s.fieldError}>{errors.city}</Text>
          ) : null}
        </View>

        {/* Skill Level */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>SKILL LEVEL</Text>
          <View style={s.skillGrid}>
            {SKILL_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  s.skillCard,
                  skill === level.value && s.skillCardSelected,
                ]}
                onPress={() => {
                  setSkill(level.value);
                  setErrors((prev) => ({ ...prev, skill: '' }));
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.skillLabel,
                    skill === level.value && s.skillLabelSelected,
                  ]}
                >
                  {level.label}
                </Text>
                <Text
                  style={[
                    s.skillRating,
                    skill === level.value && s.skillRatingSelected,
                  ]}
                >
                  {level.rating}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.skill ? (
            <Text style={s.fieldError}>{errors.skill}</Text>
          ) : null}
        </View>

        {errors.submit ? (
          <Text style={[s.fieldError, { textAlign: 'center', marginBottom: 12 }]}>
            {errors.submit}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[
            s.ctaButton,
            (!fullName.trim() || !city.trim() || !skill) && s.ctaButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!fullName.trim() || !city.trim() || !skill || loading}
          activeOpacity={0.85}
        >
          <Text style={s.ctaText}>
            {loading ? 'SAVING...' : "LET'S PLAY"}
          </Text>
          {!loading && <Text style={s.ctaArrow}>→</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: YColors.bg,
  },
  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: YColors.bg,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
    position: 'relative',
  },
  sideStripe: {
    position: 'absolute',
    left: 20,
    top: Platform.OS === 'ios' ? 50 : 30,
    bottom: 24,
    width: 4,
    backgroundColor: YColors.lime,
  },
  iconMark: {
    width: Math.min(SCREEN_WIDTH * 0.14, 56),
    height: Math.min(SCREEN_WIDTH * 0.14, 56),
  },
  wordMark: {
    width: Math.min(SCREEN_WIDTH * 0.4, 160),
    height: Math.min(SCREEN_WIDTH * 0.14, 56),
  },
  stepBadge: {
    position: 'absolute',
    bottom: 8,
    right: 20,
    backgroundColor: YColors.bg3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  stepText: {
    fontFamily: YFonts.uiExtrabold,
    color: YColors.ink2,
    fontSize: 9,
    letterSpacing: 2,
  },
  scroll: {
    flex: 1,
    backgroundColor: YColors.bg,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
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
    fontSize: 40,
    fontStyle: 'italic',
    color: YColors.ink,
    letterSpacing: 0.5,
    lineHeight: 44,
  },
  titleAccent: {
    fontFamily: YFonts.display,
    fontSize: 40,
    fontStyle: 'italic',
    color: YColors.accent,
    letterSpacing: 0.5,
    lineHeight: 44,
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: YFonts.ui,
    fontSize: 14,
    color: YColors.ink2,
    lineHeight: 20,
    marginBottom: 28,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 10,
    color: YColors.ink2,
    marginBottom: 8,
    letterSpacing: 2,
  },
  textInput: {
    backgroundColor: YColors.bg2,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: YColors.line2,
    paddingHorizontal: 14,
    height: 52,
    fontFamily: YFonts.uiSemibold,
    fontSize: 16,
    color: YColors.ink,
  },
  textInputError: {
    borderColor: YColors.live,
  },
  fieldError: {
    fontFamily: YFonts.uiSemibold,
    fontSize: 12,
    color: YColors.live,
    marginTop: 6,
  },
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: YColors.bg2,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: YColors.line2,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  skillCardSelected: {
    borderColor: YColors.ink,
    backgroundColor: YColors.ink,
  },
  skillLabel: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 12,
    color: YColors.ink2,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  skillLabelSelected: {
    color: YColors.lime,
  },
  skillRating: {
    fontFamily: YFonts.display,
    fontStyle: 'italic',
    fontSize: 20,
    color: YColors.ink3,
  },
  skillRatingSelected: {
    color: YColors.bg,
  },
  ctaButton: {
    backgroundColor: YColors.ink,
    borderRadius: 14,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  ctaButtonDisabled: {
    opacity: 0.35,
  },
  ctaText: {
    fontFamily: YFonts.uiBlack,
    color: YColors.bg,
    fontSize: 14,
    letterSpacing: 2,
  },
  ctaArrow: {
    color: YColors.bg,
    fontSize: 18,
    fontWeight: '700',
  },
});
