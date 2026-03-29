import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../config/theme';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterChipsProps {
  options: FilterOption[];
  selected: string | null;
  onSelect: (value: string | null) => void;
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  options,
  selected,
  onSelect,
}) => {
  const handlePress = (value: string) => {
    if (selected === value) {
      onSelect(null);
    } else {
      onSelect(value);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((option) => {
        const isActive = selected === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
            onPress={() => handlePress(option.value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipInactive: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  labelActive: {
    color: colors.textInverse,
  },
  labelInactive: {
    color: colors.textSecondary,
  },
});
