import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Linking,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DiscoverStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius, shadows } from '../../config/theme';
import { tournamentsApi } from '../../api/tournaments.api';
import { useTournamentStore } from '../../store/tournamentStore';
import { CategoryCard } from '../../components/tournament/CategoryCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tournament } from '../../types/tournament.types';

type Props = NativeStackScreenProps<DiscoverStackParamList, 'TournamentDetail'>;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function TournamentDetailScreen({ navigation, route }: Props) {
  const { tournamentId } = route.params;
  const { setCurrentTournament } = useTournamentStore();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchTournament = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await tournamentsApi.getById(tournamentId);
        const data = response.data.data;
        if (!cancelled) {
          setTournament(data);
          setCurrentTournament(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError('Failed to load tournament details.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchTournament();
    return () => { cancelled = true; };
  }, [tournamentId, setCurrentTournament]);

  const openInMaps = () => {
    if (!tournament) return;
    const query = encodeURIComponent(
      `${tournament.venueName}, ${tournament.venueAddress}, ${tournament.city}`
    );
    const url = `https://maps.google.com/?q=${query}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps application.');
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !tournament) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>{error ?? 'Tournament not found.'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>GO BACK</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const categories = tournament.categories ?? [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Back nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBackTouchable}>
          <Text style={styles.navBackIcon}>{'←'}</Text>
          <Text style={styles.navBackLabel}>DISCOVER</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <View style={styles.heroSection}>
          <View style={styles.heroTop}>
            <Text style={styles.tournamentName}>{tournament.name}</Text>
            <StatusBadge status={tournament.status} size="md" />
          </View>
          {tournament.isFeatured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredLabel}>FEATURED</Text>
            </View>
          )}
        </View>

        {/* Venue section */}
        <TouchableOpacity style={styles.card} onPress={openInMaps} activeOpacity={0.85}>
          <Text style={styles.sectionLabel}>VENUE</Text>
          <Text style={styles.venueName}>{tournament.venueName}</Text>
          <Text style={styles.venueAddress}>{tournament.venueAddress}</Text>
          <Text style={styles.venueCity}>{tournament.city}{tournament.state ? `, ${tournament.state}` : ''}</Text>
          <Text style={styles.mapsLink}>Open in Maps →</Text>
        </TouchableOpacity>

        {/* Dates section */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>DATES</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>START</Text>
              <Text style={styles.dateValue}>{formatDate(tournament.startDate)}</Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>END</Text>
              <Text style={styles.dateValue}>{formatDate(tournament.endDate)}</Text>
            </View>
          </View>
          <View style={styles.deadlineRow}>
            <Text style={styles.deadlineLabel}>Registration Deadline</Text>
            <Text style={styles.deadlineValue}>{formatDate(tournament.registrationDeadline)}</Text>
          </View>
        </View>

        {/* Description */}
        {!!tournament.description && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <Text style={styles.description}>{tournament.description}</Text>
          </View>
        )}

        {/* Categories section */}
        {categories.length > 0 && (
          <View style={styles.categoriesSection}>
            <Text style={styles.categoriesSectionTitle}>CATEGORIES</Text>
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                showRegister
                onRegister={() =>
                  navigation.navigate('Registration', {
                    tournamentId: tournament.id,
                    categoryId: category.id,
                  })
                }
              />
            ))}
          </View>
        )}

        {/* Contact info */}
        {(tournament.contactPhone || tournament.contactEmail) && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CONTACT</Text>
            {!!tournament.contactPhone && (
              <Text style={styles.contactItem}>
                <Text style={styles.contactKey}>Phone  </Text>
                {tournament.contactPhone}
              </Text>
            )}
            {!!tournament.contactEmail && (
              <Text style={styles.contactItem}>
                <Text style={styles.contactKey}>Email  </Text>
                {tournament.contactEmail}
              </Text>
            )}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  backButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 1.5,
  },
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
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  heroSection: {
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    ...shadows.md,
    marginBottom: spacing.sm,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  tournamentName: {
    flex: 1,
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.5,
    lineHeight: typography.fontSize['2xl'] * 1.2,
  },
  featuredBadge: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  featuredLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    ...shadows.sm,
  },
  sectionLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  venueName: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  venueAddress: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  venueCity: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  mapsLink: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: 0.3,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateItem: {
    flex: 1,
  },
  dateDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.base,
  },
  dateLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  deadlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  deadlineLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  deadlineValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  description: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: typography.fontSize.md * 1.6,
  },
  categoriesSection: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  categoriesSectionTitle: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  contactItem: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  contactKey: {
    fontWeight: '700',
    color: colors.text,
  },
  bottomSpacer: {
    height: spacing['2xl'],
  },
});
