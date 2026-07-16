import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  YColors,
  YDisplay,
  YEyebrow,
  YMono,
  YUiText,
  YTopBar,
  YBadge,
  YButton,
  YSectionHead,
  YCoverImage,
} from '../../components/yoiden';
import { tournamentsApi } from '../../api/tournaments.api';
import type { Tournament, TournamentCategory } from '../../types/tournament.types';
import type { PlayStackParamList } from '../../navigation/YoidenTabNavigator';
import { useAuthStore } from '../../store/authStore';
import * as ImagePicker from 'expo-image-picker';
import { xAlert, xConfirm } from '../../utils/alert';

type Route = RouteProp<PlayStackParamList, 'TournamentDetail'>;
type Nav = NativeStackNavigationProp<PlayStackParamList, 'TournamentDetail'>;

// AIPA West Zone 2026 — shadow-scoring only. Hide RUN TOURNAMENT tools.
const AIPA_TOURNAMENT_ID = '043c6b38-da45-41e9-968f-34f4d4d0bb05';

const STATUS_LABEL: Record<string, string> = {
  draft: 'DRAFT',
  published: 'UPCOMING',
  registration_open: 'OPEN',
  registration_closed: 'CLOSED',
  in_progress: 'LIVE',
  completed: 'FINISHED',
  cancelled: 'CANCELLED',
};

const STATUS_COLOR: Record<string, string> = {
  draft: YColors.ink3,
  published: YColors.accent,
  registration_open: YColors.lime,
  registration_closed: YColors.ink3,
  in_progress: YColors.live,
  completed: YColors.ink3,
  cancelled: YColors.ink3,
};

export default function TournamentDetailScreen() {
  const route = useRoute<Route>();
  const nav = useNavigation<Nav>();
  const { tournamentId } = route.params;
  const currentUser = useAuthStore((s) => s.user);

  const [t, setT] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setError(null);
      const res = await tournamentsApi.getById(tournamentId);
      const data = (res.data as any)?.data ?? res.data;
      setT(data);
    } catch (e: any) {
      setError(e?.message || 'Could not load tournament');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDetail();
  }, [fetchDetail]);

  const isOrganizer = !!t && !!currentUser && t.organizerId === currentUser.id;

  const [bannerBusy, setBannerBusy] = useState(false);

  const changeBanner = async () => {
    if (!t) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [5, 2],
      quality: 0.9,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    setBannerBusy(true);
    try {
      await tournamentsApi.uploadBanner(t.id, {
        uri: a.uri,
        name: a.fileName || 'banner.jpg',
        type: a.mimeType || 'image/jpeg',
      });
      await fetchDetail();
    } catch (e: any) {
      xAlert('Upload failed', e?.message || 'Could not upload banner');
    } finally {
      setBannerBusy(false);
    }
  };

  const removeBanner = () => {
    if (!t) return;
    xConfirm(
      'Remove banner?',
      'The page falls back to the default cover.',
      async () => {
        setBannerBusy(true);
        try {
          await tournamentsApi.removeBanner(t.id);
          await fetchDetail();
        } catch (e: any) {
          xAlert('Failed', e?.message || 'Could not remove banner');
        } finally {
          setBannerBusy(false);
        }
      },
      'Remove',
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={YColors.ink2} />
      </SafeAreaView>
    );
  }

  if (error || !t) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <YTopBar title="NOT FOUND" onBack={() => nav.goBack()} />
        <View style={{ padding: 20 }}>
          <YUiText size={14} color={YColors.ink2}>
            {error || 'This tournament could not be loaded.'}
          </YUiText>
        </View>
      </SafeAreaView>
    );
  }

  const statusLabel = STATUS_LABEL[t.status] || t.status.toUpperCase();
  const statusColor = STATUS_COLOR[t.status] || YColors.accent;
  const start = new Date(t.startDate);
  const end = new Date(t.endDate);
  const sameDay = start.toDateString() === end.toDateString();
  const dateRange = sameDay
    ? `${start.toLocaleString('en', { month: 'short' }).toUpperCase()} ${start.getDate()}`
    : `${start.toLocaleString('en', { month: 'short' }).toUpperCase()} ${start.getDate()} — ${end.toLocaleString('en', { month: 'short' }).toUpperCase()} ${end.getDate()}`;

  const firstCategory = t.categories?.[0];
  const canRegister =
    !isOrganizer && (t.status === 'registration_open' || t.status === 'published');

  const openRegister = (categoryId?: string) =>
    nav.navigate('Register', { tournamentId: t.id, categoryId });

  const openManage = (route: keyof PlayStackParamList, params?: any) =>
    nav.navigate(route as any, params);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YColors.ink2} />}
      >
        {/* Edge-to-edge poster cover */}
        <YCoverImage src={t.bannerUrl || undefined} height={210} rounded={false}>
          {/* Floating back button */}
          <Pressable onPress={() => nav.goBack()} style={styles.coverBack} hitSlop={8}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14 6l-6 6 6 6"
                stroke="#fff"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>

          {/* Top-right badges */}
          <View style={styles.coverBadges}>
            <YBadge color={statusColor === YColors.lime ? '#000' : '#fff'} bg={statusColor}>
              {statusLabel}
            </YBadge>
            {t.isFeatured ? <YBadge color="#000" bg={YColors.lime}>FEATURED</YBadge> : null}
            {isOrganizer ? <YBadge color="#fff" bg="#000">YOU HOST</YBadge> : null}
          </View>

          {isOrganizer ? (
            <View style={styles.coverEditRow}>
              <Pressable onPress={changeBanner} disabled={bannerBusy} style={styles.coverEditBtn}>
                <YUiText size={10} weight={900} color="#fff" style={{ letterSpacing: 1 }}>
                  {bannerBusy ? 'UPLOADING…' : t.bannerUrl ? 'CHANGE BANNER' : 'ADD BANNER'}
                </YUiText>
              </Pressable>
              {t.bannerUrl && !bannerBusy ? (
                <Pressable onPress={removeBanner} style={styles.coverEditBtn}>
                  <YUiText size={10} weight={900} color="#fff" style={{ letterSpacing: 1 }}>
                    REMOVE
                  </YUiText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Bottom-left poster title block */}
          <View style={styles.coverTitleBlock}>
            {t.city ? (
              <YEyebrow color="rgba(255,255,255,0.75)">{t.city.toUpperCase()}</YEyebrow>
            ) : null}
            <YDisplay size={36} color="#fff" style={{ marginTop: 6 }}>
              {t.name}
            </YDisplay>
            <YMono size={11} color="rgba(255,255,255,0.75)" style={{ marginTop: 10, letterSpacing: 1.2 }}>
              {dateRange}
            </YMono>
          </View>
        </YCoverImage>

        {/* Venue card */}
        <View style={styles.infoCard}>
          <YEyebrow color={YColors.ink3}>VENUE</YEyebrow>
          <YUiText size={14} weight={800} color={YColors.ink} style={{ marginTop: 6, letterSpacing: 0.3 }}>
            {t.venueName}
          </YUiText>
          {t.venueAddress ? (
            <YUiText size={12} color={YColors.ink2} style={{ marginTop: 4, lineHeight: 18 }}>
              {t.venueAddress}
            </YUiText>
          ) : null}
          {t.description ? (
            <>
              <View style={styles.divider} />
              <YEyebrow color={YColors.ink3}>ABOUT</YEyebrow>
              <YUiText size={12} color={YColors.ink2} style={{ marginTop: 6, lineHeight: 18 }}>
                {t.description}
              </YUiText>
            </>
          ) : null}
        </View>

        {/* Organizer — Shadow Mode (priority path for AIPA event) */}
        {isOrganizer ? (
          <>
            <YSectionHead eyebrow="ORGANIZER · SHADOW MODE" title="LIVE SCORING" />
            <View style={styles.manageGrid}>
              <ManageTile
                label="STANDINGS"
                sub="Pools, knockout, champion"
                onPress={() => openManage('TournamentStandings', { tournamentId: t.id })}
              />
              <ManageTile
                label="RANKINGS"
                sub="Final per-category ranking"
                onPress={() => openManage('TournamentRankings', { tournamentId: t.id })}
              />
            </View>

            {/* Full-flow tiles — hidden for AIPA (shadow-only); shown for tournaments we run ourselves */}
            {t.id !== AIPA_TOURNAMENT_ID ? (
              <>
                <YSectionHead eyebrow="ORGANIZER · FULL FLOW" title="RUN TOURNAMENT" />
                <View style={styles.manageGrid}>
                  <ManageTile
                    label="SCORE LOG"
                    sub="Pick teams, punch score"
                    onPress={() => openManage('ScoreLogger', { tournamentId: t.id })}
                  />
                  <ManageTile
                    label="REGISTRATIONS"
                    sub="Players & teams"
                    onPress={() => openManage('RegistrationManage', { tournamentId: t.id })}
                  />
                  <ManageTile
                    label="SEEDING"
                    sub="Draw generation"
                    onPress={() =>
                      firstCategory &&
                      openManage('Seeding', { tournamentId: t.id, categoryId: firstCategory.id })
                    }
                    disabled={!firstCategory}
                  />
                  <ManageTile
                    label="SCHEDULE"
                    sub="Courts & rest"
                    onPress={() => openManage('Schedule', { tournamentId: t.id })}
                  />
                  <ManageTile
                    label="BRACKET"
                    sub="View / advance"
                    onPress={() =>
                      firstCategory &&
                      openManage('Bracket', { tournamentId: t.id, categoryId: firstCategory.id })
                    }
                    disabled={!firstCategory}
                  />
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {/* Categories */}
        <YSectionHead
          eyebrow={`${t.categories?.length ?? 0} EVENTS`}
          title="CATEGORIES"
        />
        <View style={{ paddingHorizontal: 16 }}>
          {t.categories && t.categories.length > 0 ? (
            t.categories.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                isOrganizer={isOrganizer}
                canRegister={canRegister}
                onRegister={() => openRegister(c.id)}
              />
            ))
          ) : (
            <YUiText size={12} color={YColors.ink3}>
              No categories yet.
            </YUiText>
          )}

          {canRegister && t.categories && t.categories.length === 1 ? (
            <View style={{ marginTop: 8 }}>
              <YButton variant="primary" size="lg" fullWidth onPress={() => openRegister()}>
                REGISTER
              </YButton>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── ManageTile ─────────────────────────────────────────────────
const ManageTile: React.FC<{
  label: string;
  sub: string;
  onPress?: () => void;
  disabled?: boolean;
}> = ({ label, sub, onPress, disabled }) => (
  <Pressable
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.manageTile,
      pressed && { backgroundColor: YColors.bg3 },
      disabled && { opacity: 0.4 },
    ]}
  >
    <View style={{ flex: 1 }}>
      <YUiText size={12} weight={900} color={YColors.ink} style={{ letterSpacing: 1.3 }}>
        {label}
      </YUiText>
      <YUiText size={10} color={YColors.ink3} style={{ marginTop: 4 }}>
        {sub}
      </YUiText>
    </View>
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  </Pressable>
);

// ─── CategoryRow ────────────────────────────────────────────────
const CategoryRow: React.FC<{
  category: TournamentCategory;
  isOrganizer: boolean;
  canRegister: boolean;
  onRegister: () => void;
}> = ({ category: c, isOrganizer, canRegister, onRegister }) => (
  <View style={styles.catRow}>
    <View style={styles.catTop}>
      <View style={{ flex: 1 }}>
        <YUiText size={13} weight={900} color={YColors.ink} style={{ letterSpacing: 0.5 }}>
          {c.name.toUpperCase()}
        </YUiText>
        <YUiText size={11} color={YColors.ink2} style={{ marginTop: 2 }}>
          {c.format.toUpperCase()} · {c.gender.toUpperCase()} · BEST OF {c.matchFormat?.replace('best_of_', '') || '3'}
        </YUiText>
        <YMono size={10} color={YColors.ink3} style={{ marginTop: 6 }}>
          {(c.registeredTeams ?? 0)}/{c.maxTeams} REGISTERED
        </YMono>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <YMono size={14} bold color={YColors.ink}>
          {c.entryFee === 0 ? 'FREE' : `₹${c.entryFee}`}
        </YMono>
        <YUiText size={9} color={YColors.ink3} style={{ marginTop: 2, letterSpacing: 1 }}>
          ENTRY
        </YUiText>
      </View>
    </View>
    {canRegister ? (
      <Pressable onPress={onRegister} style={styles.catCTA}>
        <YUiText size={11} weight={900} color="#fff" style={{ letterSpacing: 1.2 }}>
          REGISTER FOR THIS CATEGORY →
        </YUiText>
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: YColors.bg },

  coverBack: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadges: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  coverEditRow: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    gap: 6,
  },
  coverEditBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  coverTitleBlock: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
  },

  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
  },
  divider: {
    height: 1,
    backgroundColor: YColors.line,
    marginTop: 14,
    marginBottom: 14,
  },

  manageGrid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  manageTile: {
    width: '48.5%',
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  catRow: {
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  catTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  catCTA: {
    paddingVertical: 12,
    backgroundColor: YColors.ink,
    alignItems: 'center',
  },
});
