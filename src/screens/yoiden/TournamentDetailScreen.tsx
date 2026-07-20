import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Share,
  Modal,
  TextInput,
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
import * as Clipboard from 'expo-clipboard';
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

  // ── Discovery visibility (organizer control) ──────────────────────────────
  const [visBusy, setVisBusy] = useState(false);
  // Public link that opens the viewer-facing tournament page (works for unlisted).
  const shareUrl = t ? `https://console.yoiden.com/t/${t.slug}` : '';
  const isDraft = t?.status === 'draft';
  const changeVisibility = async (isPublic: boolean) => {
    if (!t || visBusy) return;
    setVisBusy(true);
    try {
      await tournamentsApi.update(t.id, { isPublic });
      await fetchDetail();
    } catch (e: any) {
      // Non-fatal — surface briefly via the error banner path.
      setError(e?.response?.data?.message || e?.message || 'Could not update visibility');
    } finally {
      setVisBusy(false);
    }
  };
  const shareLink = () => {
    if (!t) return;
    Share.share({ message: `${t.name} — register here: ${shareUrl}`, url: shareUrl }).catch(() => {});
  };

  // Copy-to-clipboard with inline "COPIED!" feedback — colleagues usually want
  // to paste the link into WhatsApp/email themselves rather than go through the
  // OS share sheet.
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await Clipboard.setStringAsync(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      xAlert('Could not copy', shareUrl);
    }
  };

  // ── Category editor (organiser) ───────────────────────────────────────────
  // Entry fee, capacity and match settings were previously fixed at creation —
  // a typo meant an SQL fix. PUT /categories/:id already existed; nothing used it.
  const [editCat, setEditCat] = useState<TournamentCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catFee, setCatFee] = useState('');
  const [catMaxTeams, setCatMaxTeams] = useState('');
  const [catBusy, setCatBusy] = useState(false);
  const [catErr, setCatErr] = useState<string | null>(null);

  const openCategoryEditor = (c: TournamentCategory) => {
    setEditCat(c);
    setCatName(c.name);
    setCatFee(String(Number(c.entryFee ?? 0)));
    setCatMaxTeams(String(c.maxTeams ?? 0));
    setCatErr(null);
  };

  const registeredInCat = editCat?.registeredTeams ?? 0;
  const catFeeNum = Number(catFee);
  const catMaxNum = Number(catMaxTeams);
  const catValid =
    catName.trim().length >= 2 &&
    Number.isFinite(catFeeNum) && catFeeNum >= 0 &&
    Number.isFinite(catMaxNum) && catMaxNum >= 1;

  const saveCategory = async () => {
    if (!editCat || !catValid || catBusy) return;
    setCatBusy(true);
    setCatErr(null);
    try {
      await tournamentsApi.updateCategory(editCat.id, {
        name: catName.trim(),
        entryFee: catFeeNum,
        maxTeams: catMaxNum,
      });
      setEditCat(null);
      await fetchDetail();
    } catch (e: any) {
      setCatErr(e?.response?.data?.message || e?.message || 'Could not save changes.');
    } finally {
      setCatBusy(false);
    }
  };

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

        {/* Organizer — discovery visibility control + share link */}
        {isOrganizer && !isDraft ? (
          <View style={styles.visCard}>
            <YEyebrow color={YColors.ink3}>VISIBILITY</YEyebrow>
            <View style={styles.visToggleRow}>
              {([
                { key: true, label: 'PUBLIC', hint: 'Anyone can find & register' },
                { key: false, label: 'PRIVATE', hint: 'Only via your link' },
              ] as const).map((opt) => {
                const active = !!t?.isPublic === opt.key;
                return (
                  <Pressable
                    key={String(opt.key)}
                    onPress={() => changeVisibility(opt.key)}
                    disabled={visBusy}
                    style={[styles.visToggle, active && styles.visToggleActive]}
                  >
                    <YUiText size={12} weight={900} color={active ? '#000' : YColors.ink2} style={{ letterSpacing: 0.6 }}>
                      {opt.label}
                    </YUiText>
                    <YUiText size={10} weight={600} color={active ? 'rgba(0,0,0,0.6)' : YColors.ink3} style={{ marginTop: 1 }}>
                      {opt.hint}
                    </YUiText>
                  </Pressable>
                );
              })}
            </View>
            <YUiText size={11.5} color={YColors.ink2} style={{ marginTop: 10, lineHeight: 17 }}>
              {t?.isPublic
                ? 'Listed in discovery — anyone can find this event and register from the app.'
                : 'Hidden from discovery — only people you send the link to can open it.'}
            </YUiText>

            {/* The share link itself, so it is visible and copyable either way */}
            <YEyebrow color={YColors.ink3} style={{ marginTop: 14 }}>SHARE LINK</YEyebrow>
            <View style={styles.linkRow}>
              <YUiText
                size={12}
                color={YColors.ink2}
                numberOfLines={1}
                ellipsizeMode="middle"
                style={{ flex: 1 }}
              >
                {shareUrl}
              </YUiText>
            </View>
            <View style={styles.linkActions}>
              <Pressable onPress={copyLink} style={[styles.shareBtn, styles.linkAction, copied && styles.copiedBtn]}>
                <YUiText size={12} weight={900} color={copied ? '#fff' : '#000'} style={{ letterSpacing: 0.6 }}>
                  {copied ? 'COPIED!' : 'COPY LINK'}
                </YUiText>
              </Pressable>
              <Pressable onPress={shareLink} style={[styles.shareBtn, styles.linkAction, styles.shareAlt]}>
                <YUiText size={12} weight={900} color={YColors.ink} style={{ letterSpacing: 0.6 }}>SHARE</YUiText>
              </Pressable>
            </View>
          </View>
        ) : null}

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
                onEdit={() => openCategoryEditor(c)}
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

      {/* Category editor — organiser only */}
      <Modal
        visible={!!editCat}
        transparent
        animationType="fade"
        onRequestClose={() => setEditCat(null)}
      >
        <View style={styles.catModalBackdrop}>
          <View style={styles.catSheet}>
            <YEyebrow color={YColors.ink3}>EDIT CATEGORY</YEyebrow>
            <YUiText size={16} weight={900} color={YColors.ink} style={{ marginTop: 2, marginBottom: 14 }}>
              {editCat?.name}
            </YUiText>

            <YUiText size={10} weight={900} color={YColors.ink3} style={styles.catFieldLabel}>NAME</YUiText>
            <TextInput
              style={styles.catInput}
              value={catName}
              onChangeText={setCatName}
              placeholder="e.g. Men's Doubles"
              placeholderTextColor={YColors.ink3}
            />

            <YUiText size={10} weight={900} color={YColors.ink3} style={styles.catFieldLabel}>ENTRY FEE (₹)</YUiText>
            <TextInput
              style={styles.catInput}
              value={catFee}
              onChangeText={(v) => setCatFee(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="0 for free entry"
              placeholderTextColor={YColors.ink3}
            />

            <YUiText size={10} weight={900} color={YColors.ink3} style={styles.catFieldLabel}>MAX TEAMS</YUiText>
            <TextInput
              style={styles.catInput}
              value={catMaxTeams}
              onChangeText={(v) => setCatMaxTeams(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="e.g. 16"
              placeholderTextColor={YColors.ink3}
            />

            {/* Changing the fee does not retro-bill or refund anyone already in. */}
            {registeredInCat > 0 ? (
              <YUiText size={11} color={YColors.ink2} style={{ marginTop: 10, lineHeight: 16 }}>
                {registeredInCat} {registeredInCat === 1 ? 'entry is' : 'entries are'} already registered. Changing
                the fee only affects new registrations — existing entries are not charged or refunded.
              </YUiText>
            ) : null}
            {catMaxNum > 0 && catMaxNum < registeredInCat ? (
              <YUiText size={11} color={YColors.live} style={{ marginTop: 8, lineHeight: 16 }}>
                Max teams is below the {registeredInCat} already registered — they stay in, but the category will
                show as over capacity.
              </YUiText>
            ) : null}
            {catErr ? (
              <YUiText size={11} color={YColors.live} style={{ marginTop: 10 }}>{catErr}</YUiText>
            ) : null}

            <View style={styles.catSheetActions}>
              <Pressable
                onPress={saveCategory}
                disabled={!catValid || catBusy}
                style={[styles.catSaveBtn, (!catValid || catBusy) && { opacity: 0.5 }]}
              >
                <YUiText size={12} weight={900} color="#000" style={{ letterSpacing: 0.6 }}>
                  {catBusy ? 'SAVING…' : 'SAVE'}
                </YUiText>
              </Pressable>
              <Pressable onPress={() => setEditCat(null)} style={[styles.catSaveBtn, styles.catCancelBtn]}>
                <YUiText size={12} weight={900} color={YColors.ink2} style={{ letterSpacing: 0.6 }}>CANCEL</YUiText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  onEdit: () => void;
}> = ({ category: c, isOrganizer, canRegister, onRegister, onEdit }) => (
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
    {isOrganizer ? (
      <Pressable onPress={onEdit} style={styles.catEditBtn}>
        <YUiText size={11} weight={900} color={YColors.ink} style={{ letterSpacing: 0.8 }}>
          EDIT CATEGORY
        </YUiText>
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },

  catEditBtn: {
    marginTop: 8,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
    backgroundColor: YColors.bg3,
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  catModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  catSheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  catFieldLabel: { letterSpacing: 1, marginTop: 12, marginBottom: 5 },
  catInput: {
    backgroundColor: YColors.bg3,
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: YColors.ink,
  },
  catSheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  catSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: YColors.lime,
  },
  catCancelBtn: {
    backgroundColor: YColors.bg3,
    borderWidth: 1,
    borderColor: YColors.line2,
  },
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
  visCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
  },
  visToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  visToggle: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: YColors.bg3,
    borderWidth: 1,
    borderColor: YColors.line2,
    alignItems: 'center',
  },
  visToggleActive: {
    backgroundColor: YColors.lime,
    borderColor: YColors.ink,
  },
  shareBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: YColors.lime,
    alignItems: 'center',
  },
  linkRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: YColors.bg3,
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  linkActions: {
    flexDirection: 'row',
    gap: 10,
  },
  linkAction: {
    flex: 1,
  },
  copiedBtn: {
    backgroundColor: YColors.accent,
  },
  shareAlt: {
    backgroundColor: YColors.bg3,
    borderWidth: 1,
    borderColor: YColors.line2,
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
