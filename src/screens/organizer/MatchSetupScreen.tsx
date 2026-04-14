import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  TextInput,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { tournamentsApi } from '../../api/tournaments.api';
import { matchesApi } from '../../api/matches.api';
import { xAlert, xConfirm } from '../../utils/alert';
import { Tournament, TournamentCategory } from '../../types/tournament.types';
import { spacing, typography, borderRadius } from '../../config/theme';
import { MyEventsStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<MyEventsStackParamList, 'MatchSetup'>;
type RouteType = RouteProp<MyEventsStackParamList, 'MatchSetup'>;

const GREEN = '#06D6A0';
const BLUE = '#2196F3';
const YELLOW = '#FFB703';
const NAVY = '#001E40';

type StepStatus = 'ready' | 'done' | 'locked';

export default function MatchSetupScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { tournamentId } = route.params;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSeeds, setHasSeeds] = useState(false);
  const [hasDraws, setHasDraws] = useState(false);
  const [courtCount, setCourtCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [generatingDraw, setGeneratingDraw] = useState(false);
  const [courtName, setCourtName] = useState('');
  const [addingCourt, setAddingCourt] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tournRes = await tournamentsApi.getById(tournamentId);
      const t = tournRes.data?.data ?? tournRes.data;
      setTournament(t);
      setCourtCount(t.courts?.length ?? 0);

      // Check seeds & draws
      if (t.categories && t.categories.length > 0) {
        const catId = t.categories[0].id;

        // Check if seeds exist (teams with seed numbers)
        try {
          const bracketRes = await matchesApi.getBracket(tournamentId, catId);
          const data = bracketRes.data?.data ?? bracketRes.data;
          const teams = data?.teams ?? [];
          setHasSeeds(teams.length > 0);
          const pools = data?.pools ?? [];
          const knockout = data?.knockout ?? [];
          setHasDraws(pools.length > 0 || knockout.length > 0);

          // Count matches
          let count = 0;
          pools.forEach((p: any) => { count += p.matches?.length ?? 0; });
          knockout.forEach((r: any) => { count += r.matches?.length ?? 0; });
          setMatchCount(count);
        } catch {
          setHasSeeds(false);
          setHasDraws(false);
          setMatchCount(0);
        }
      }
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  // Fetch on mount + refresh when screen regains focus
  const isMounted = React.useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isMounted.current) {
        // Returning to screen — silent refresh
        fetchData();
      } else {
        isMounted.current = true;
        fetchData();
      }
    }, [fetchData]),
  );

  const categories: TournamentCategory[] = tournament?.categories ?? [];
  const firstCatId = categories[0]?.id;

  const handleSeed = () => {
    if (!firstCatId) {
      xAlert('No Categories', 'Add categories first.');
      return;
    }
    (navigation as any).navigate('Seeding', { tournamentId, categoryId: firstCatId });
  };

  const handleGenerateDraw = () => {
    if (!firstCatId) return;
    xConfirm(
      'Generate Draw',
      'This will create pools and matches from seeded players.',
      async () => {
        setGeneratingDraw(true);
        try {
          await matchesApi.generateDraw(tournamentId, firstCatId);
          await fetchData();
          xAlert('Draw Generated', 'Pools and matches have been created.');
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message ?? 'Failed to generate draw');
        } finally {
          setGeneratingDraw(false);
        }
      },
      'Generate',
    );
  };

  const handleViewBrackets = () => {
    if (!firstCatId) return;
    (navigation as any).navigate('BracketManage', { tournamentId, categoryId: firstCatId });
  };

  const handleAddCourt = async () => {
    if (!courtName.trim()) return;
    setAddingCourt(true);
    try {
      await tournamentsApi.addCourt(tournamentId, { name: courtName.trim(), surfaceType: 'standard' });
      setCourtName('');
      await fetchData();
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to add court');
    } finally {
      setAddingCourt(false);
    }
  };

  const handleViewSchedule = () => {
    (navigation as any).navigate('Schedule', { tournamentId });
  };

  // Step statuses
  const seedStatus = 'ready' as StepStatus;
  const drawStatus = (hasDraws ? 'done' : 'ready') as StepStatus;
  const scheduleStatus = (hasDraws ? 'ready' : 'locked') as StepStatus;

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={s.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backIcon}>{'\u2190'}</Text>
            <Text style={s.backLabel}>BACK</Text>
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backIcon}>{'\u2190'}</Text>
          <Text style={s.backLabel}>BACK</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Match Hub</Text>
        <Text style={s.subtitle}>
          {tournament?.name ?? 'Tournament'}
        </Text>

        {/* Step 1: Seed Players */}
        <View style={s.stepCard}>
          <View style={s.stepHeader}>
            <View style={[s.stepNum, seedStatus === 'done' && s.stepNumDone]}>
              <Text style={s.stepNumText}>{hasSeeds ? '✓' : '1'}</Text>
            </View>
            <View style={s.stepInfo}>
              <Text style={s.stepTitle}>Seed Players</Text>
              <Text style={s.stepDesc}>
                {hasSeeds
                  ? `Players seeded for ${categories[0]?.name ?? 'category'}`
                  : 'Arrange player order before generating the draw'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={s.stepAction} onPress={handleSeed} activeOpacity={0.8}>
            <Text style={s.stepActionText}>{hasSeeds ? 'Edit Seeds' : 'Seed Players'}</Text>
          </TouchableOpacity>
        </View>

        {/* Step 2: Generate Draw */}
        <View style={[s.stepCard, drawStatus === 'locked' && s.stepLocked]}>
          <View style={s.stepHeader}>
            <View style={[s.stepNum, hasDraws && s.stepNumDone]}>
              <Text style={s.stepNumText}>{hasDraws ? '✓' : '2'}</Text>
            </View>
            <View style={s.stepInfo}>
              <Text style={s.stepTitle}>Generate Draw</Text>
              <Text style={s.stepDesc}>
                {hasDraws
                  ? `${matchCount} matches created`
                  : 'Create pools and matches from seeds'}
              </Text>
            </View>
          </View>
          {hasDraws ? (
            <TouchableOpacity style={s.stepAction} onPress={handleViewBrackets} activeOpacity={0.8}>
              <Text style={s.stepActionText}>View Brackets</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.stepAction, s.stepActionPrimary, generatingDraw && { opacity: 0.5 }]}
              onPress={handleGenerateDraw}
              disabled={generatingDraw}
              activeOpacity={0.8}
            >
              {generatingDraw ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={[s.stepActionText, s.stepActionTextPrimary]}>Generate Draw</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Step 3: Schedule (includes courts) */}
        <View style={[s.stepCard, scheduleStatus === 'locked' && s.stepLocked]}>
          <View style={s.stepHeader}>
            <View style={[s.stepNum, courtCount > 0 && s.stepNumDone]}>
              <Text style={s.stepNumText}>{courtCount > 0 ? '✓' : '3'}</Text>
            </View>
            <View style={s.stepInfo}>
              <Text style={[s.stepTitle, scheduleStatus === 'locked' && s.stepTitleLocked]}>
                Live Management
              </Text>
              <Text style={s.stepDesc}>
                {scheduleStatus === 'locked'
                  ? 'Generate the draw first'
                  : `Schedule, scores, check-in · ${matchCount} matches`}
              </Text>
            </View>
          </View>

          {scheduleStatus !== 'locked' && (
            <>
              {/* Courts section */}
              <View style={s.courtSection}>
                <Text style={s.courtSectionLabel}>COURTS</Text>
                {courtCount > 0 && (
                  <View style={s.courtChips}>
                    {(tournament?.courts ?? []).map((c: any) => (
                      <View key={c.id} style={s.courtChip}>
                        <Text style={s.courtChipText}>{c.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={s.addCourtRow}>
                  <TextInput
                    style={s.addCourtInput}
                    placeholder="Court name"
                    placeholderTextColor="#94A3B8"
                    value={courtName}
                    onChangeText={setCourtName}
                  />
                  <TouchableOpacity
                    style={[s.addCourtBtn, (!courtName.trim() || addingCourt) && { opacity: 0.4 }]}
                    disabled={!courtName.trim() || addingCourt}
                    onPress={handleAddCourt}
                  >
                    <Text style={s.addCourtBtnText}>{addingCourt ? '...' : 'Add'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={[s.stepAction, s.stepActionPrimary]} onPress={handleViewSchedule} activeOpacity={0.8}>
                <Text style={[s.stepActionText, s.stepActionTextPrimary]}>Open Live Management</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backIcon: {
    fontSize: typography.fontSize.lg,
    color: BLUE,
    fontWeight: '700',
  },
  backLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: BLUE,
    letterSpacing: 1.5,
  },

  scroll: {
    paddingHorizontal: spacing.base,
  },

  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '900',
    color: NAVY,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: spacing.xl,
  },

  // Step card
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  stepLocked: {
    opacity: 0.4,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumDone: {
    backgroundColor: 'rgba(6,214,160,0.12)',
  },
  stepNumText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: NAVY,
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: '#1A1D21',
    marginBottom: 2,
  },
  stepTitleLocked: {
    color: '#94A3B8',
  },
  stepDesc: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 16,
  },

  // Step action button
  stepAction: {
    marginTop: spacing.md,
    backgroundColor: '#F5F7FA',
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepActionPrimary: {
    backgroundColor: 'rgba(6,214,160,0.08)',
    borderColor: 'rgba(6,214,160,0.3)',
  },
  stepActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: '#1A1D21',
    letterSpacing: 0.5,
  },
  stepActionTextPrimary: {
    color: GREEN,
  },

  // Courts inline
  courtSection: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: spacing.md,
  },
  courtSectionLabel: {
    color: NAVY,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  courtChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  courtChip: {
    backgroundColor: NAVY,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  courtChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addCourtRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addCourtInput: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: '#1A1D21',
  },
  addCourtBtn: {
    backgroundColor: '#F5F7FA',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addCourtBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: '#1A1D21',
  },
});
