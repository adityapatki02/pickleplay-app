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
import { colors, typography, spacing, borderRadius, shadows } from '../../config/theme';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth.api';
import { SkillLevel } from '../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileSetup'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NAVY = '#001E40';
const LOGO_HEIGHT = 120;
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : 24;

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
    <View style={styles.outerContainer}>
      {/* Dark navy header with logo — full-width edge-to-edge */}
      <View style={styles.logoSection}>
        <Image
          source={require('../../../assets/Logo.png')}
          style={styles.headerIcon}
          resizeMode="contain"
        />
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>STEP 1 OF 1</Text>
        </View>
      </View>

      {/* White scrollable content card with rounded top corners */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Text style={styles.title}>BUILD YOUR{'\n'}PLAYER PROFILE.</Text>
        <Text style={styles.subtitle}>
          This helps us match you with the right tournaments and opponents
        </Text>

        {/* Form */}
        <View style={styles.formSection}>
          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            <TextInput
              style={[styles.textInput, errors.fullName ? styles.textInputError : null]}
              placeholder="Enter your name"
              placeholderTextColor={colors.textTertiary}
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                setErrors((prev) => ({ ...prev, fullName: '' }));
              }}
              autoCapitalize="words"
            />
            {errors.fullName ? (
              <Text style={styles.fieldError}>{errors.fullName}</Text>
            ) : null}
          </View>

          {/* City */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>CITY</Text>
            <TextInput
              style={[styles.textInput, errors.city ? styles.textInputError : null]}
              placeholder="Enter your city"
              placeholderTextColor={colors.textTertiary}
              value={city}
              onChangeText={(text) => {
                setCity(text);
                setErrors((prev) => ({ ...prev, city: '' }));
              }}
              autoCapitalize="words"
            />
            {errors.city ? (
              <Text style={styles.fieldError}>{errors.city}</Text>
            ) : null}
          </View>

          {/* Skill Level */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>SKILL LEVEL</Text>
            <View style={styles.skillGrid}>
              {SKILL_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.skillCard,
                    skill === level.value && styles.skillCardSelected,
                  ]}
                  onPress={() => {
                    setSkill(level.value);
                    setErrors((prev) => ({ ...prev, skill: '' }));
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.skillCardContent}>
                    <Text
                      style={[
                        styles.skillLabel,
                        skill === level.value && styles.skillLabelSelected,
                      ]}
                    >
                      {level.label}
                    </Text>
                    <Text
                      style={[
                        styles.skillRating,
                        skill === level.value && styles.skillRatingSelected,
                      ]}
                    >
                      {level.rating}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {errors.skill ? (
              <Text style={styles.fieldError}>{errors.skill}</Text>
            ) : null}
          </View>
        </View>

        {errors.submit ? (
          <Text style={[styles.fieldError, { textAlign: 'center', marginBottom: spacing.base }]}>
            {errors.submit}
          </Text>
        ) : null}

        {/* CTA */}
        <TouchableOpacity
          style={[
            styles.ctaButton,
            (!fullName.trim() || !city.trim() || !skill) && styles.ctaButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!fullName.trim() || !city.trim() || !skill || loading}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {loading ? 'SAVING...' : "LET'S PLAY"}
          </Text>
          {!loading && <Text style={styles.ctaArrow}>→</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: NAVY,
  },
  // Logo section — full-bleed, no horizontal padding
  logoSection: {
    backgroundColor: NAVY,
    width: '100%',
    height: LOGO_HEIGHT + STATUS_BAR_HEIGHT,
    paddingTop: STATUS_BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
  },
  stepBadge: {
    position: 'absolute',
    bottom: 10,
    right: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: 3,
  },
  stepText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  // White card with rounded top corners
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['4xl'],
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    color: NAVY,
    letterSpacing: -1,
    lineHeight: 34,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing['2xl'],
  },
  formSection: {
    gap: spacing.xl,
    marginBottom: spacing['2xl'],
  },
  fieldGroup: {},
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    letterSpacing: 2,
  },
  textInput: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.surfaceVariant,
    paddingHorizontal: spacing.base,
    height: 52,
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    color: colors.text,
    ...shadows.sm,
  },
  textInputError: {
    borderColor: colors.error,
  },
  fieldError: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  skillCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.surfaceVariant,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    ...shadows.sm,
  },
  skillCardSelected: {
    borderColor: NAVY,
    backgroundColor: colors.primaryFixed,
  },
  skillCardContent: {},
  skillLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  skillLabelSelected: {
    color: NAVY,
  },
  skillRating: {
    fontSize: typography.fontSize.xl,
    fontWeight: '900',
    fontStyle: 'italic',
    color: colors.textTertiary,
  },
  skillRatingSelected: {
    color: colors.primaryLight,
  },
  ctaButton: {
    backgroundColor: NAVY,
    borderRadius: borderRadius.lg,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...shadows.lg,
  },
  ctaButtonDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
    shadowOpacity: 0,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 2,
  },
  ctaArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
