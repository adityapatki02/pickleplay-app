import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import {
  YColors,
  YDisplay,
  YEyebrow,
  YMono,
  YUiText,
  YTopBar,
  YAvatar,
  YBadge,
  YButton,
  YSectionHead,
  YTournamentRow,
} from '../../components/yoiden';
import { useAuthStore } from '../../store/authStore';
import { tournamentsApi } from '../../api/tournaments.api';
import { registrationsApi } from '../../api/registrations.api';
import type { Tournament } from '../../types/tournament.types';
import type { YoidenTabParamList } from '../../navigation/YoidenTabNavigator';

type Nav = BottomTabNavigationProp<YoidenTabParamList, 'MeTab'>;

const unwrap = <T,>(res: any): T => (res?.data?.data ?? res?.data ?? res) as T;
const initials = (name: string) =>
  name.split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const SKILL_LABEL: Record<string, string> = {
  beginner: 'BEGINNER',
  intermediate: 'INTERMEDIATE',
  advanced: 'ADVANCED',
  pro: 'PRO',
};

type Registration = { id: string; tournamentId: string; tournament?: Tournament; status?: string };

export default function MeScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const fullName = user?.displayName || user?.fullName || 'YOIDEN PLAYER';
  const skill = (user as any)?.selfReportedSkill as string | undefined;

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myRegs, setMyRegs] = useState<Registration[]>([]);
  const [myHosted, setMyHosted] = useState<Tournament[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const [regsRes, hostedRes] = await Promise.allSettled([
        registrationsApi.getMyRegistrations(),
        tournamentsApi.getMyTournaments(),
      ]);
      if (regsRes.status === 'fulfilled') {
        const data = unwrap<Registration[]>(regsRes.value);
        setMyRegs(Array.isArray(data) ? data : []);
      }
      if (hostedRes.status === 'fulfilled') {
        const data = unwrap<Tournament[]>(hostedRes.value);
        setMyHosted(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const openTournament = (id: string) =>
    nav.navigate('MeTab', { screen: 'TournamentDetail', params: { tournamentId: id } });

  const upcomingRegs = myRegs.map((r) => r.tournament).filter((t): t is Tournament => !!t);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YColors.ink2} />}
      >
        <YTopBar
          eyebrow={user?.city ? user.city.toUpperCase() : 'PROFILE'}
          title="ME"
          action={
            <Pressable style={styles.iconBtn} hitSlop={8}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={YColors.ink} strokeWidth={1.5} fill="none" />
              </Svg>
            </Pressable>
          }
        />

        {/* Identity card */}
        <View style={styles.idCard}>
          <View style={styles.idHeader}>
            <YAvatar initials={initials(fullName)} size={72} color={YColors.lime} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <YDisplay size={28}>{fullName.split(' ')[0]?.toUpperCase()}</YDisplay>
              {fullName.split(' ').slice(1).join(' ') ? (
                <YDisplay size={28} color={YColors.accent}>
                  {fullName.split(' ').slice(1).join(' ').toUpperCase()}
                </YDisplay>
              ) : null}
              <YMono size={11} color={YColors.ink2} style={{ marginTop: 4 }}>
                {user?.phone || '—'}
              </YMono>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <Stat label="EVENTS" value={String(upcomingRegs.length + myHosted.length)} />
            <View style={styles.statDivider} />
            <Stat label="HOSTING" value={String(myHosted.length)} />
            <View style={styles.statDivider} />
            <Stat label="PLAYED" value={String((user as any)?.tournamentsPlayed ?? 0)} />
          </View>

          {/* Tags row */}
          <View style={styles.tagRow}>
            {skill ? (
              <YBadge color="#000" bg={YColors.lime}>
                {SKILL_LABEL[skill] || skill.toUpperCase()}
              </YBadge>
            ) : null}
            {user?.city ? (
              <YBadge color="#fff" bg={YColors.ink}>
                {user.city.toUpperCase()}
              </YBadge>
            ) : null}
          </View>
        </View>

        {/* DUPR Rating — coming soon */}
        <YSectionHead eyebrow="RATING" title="MY GAME" />
        <View style={styles.duprCard}>
          <View style={styles.duprLogo}>
            <YDisplay size={18} color={YColors.accent} style={{ letterSpacing: 1 }}>DUPR</YDisplay>
          </View>
          <YDisplay size={13} color={YColors.ink} style={{ marginTop: 14, letterSpacing: 0.5 }}>
            DUPR RATING
          </YDisplay>
          <YUiText size={12} color={YColors.ink3} style={{ marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
            Your official DUPR rating will appear here once integration is live.
          </YUiText>
          <View style={styles.duprPill}>
            <YEyebrow color={YColors.accent} size={10}>COMING SOON</YEyebrow>
          </View>
        </View>

        {/* Next match preview */}
        <View style={styles.nextMatchCard}>
          <View style={{ flex: 1 }}>
            <YEyebrow color={YColors.ink3}>NEXT MATCH</YEyebrow>
            <YUiText size={14} weight={900} color={YColors.ink} style={{ marginTop: 4, letterSpacing: 0.3 }}>
              MUMBAI OPEN '26
            </YUiText>
            <YMono size={11} color={YColors.ink2} style={{ marginTop: 4 }}>
              SUN · 6:30 PM · COURT 3
            </YMono>
          </View>
          <View style={styles.nextMatchClock}>
            <YDisplay size={22} color={YColors.accent}>2d</YDisplay>
            <YEyebrow color={YColors.ink3} size={9}>TO GO</YEyebrow>
          </View>
        </View>

        {/* My Bookings card */}
        <YSectionHead eyebrow="COURT TIME" title="MY BOOKINGS" />
        <Pressable
          style={styles.bookingsCard}
          onPress={() => nav.navigate('BookTab', { screen: 'MyBookings' })}
        >
          <View style={styles.bookingsIcon}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke={YColors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" stroke={YColors.accent} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <YUiText size={13} weight={800} color={YColors.ink} style={{ letterSpacing: 0.5 }}>
              MY BOOKINGS
            </YUiText>
            <YUiText size={12} color={YColors.ink3} style={{ marginTop: 2 }}>
              View and manage your court reservations
            </YUiText>
          </View>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M9 6l6 6-6 6" stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>

        {/* Hosting section */}
        {myHosted.length > 0 ? (
          <>
            <YSectionHead eyebrow={`${myHosted.length} ACTIVE`} title="HOSTING" />
            <View style={styles.listWrap}>
              {myHosted.map((t) => (
                <YTournamentRow
                  key={t.id}
                  tournament={t as any}
                  hosting
                  onPress={() => openTournament(t.id)}
                  style={{ marginBottom: 8 }}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Registrations section */}
        {upcomingRegs.length > 0 ? (
          <>
            <YSectionHead eyebrow={`${upcomingRegs.length} EVENTS`} title="REGISTERED" />
            <View style={styles.listWrap}>
              {upcomingRegs.map((t) => (
                <YTournamentRow
                  key={t.id}
                  tournament={t as any}
                  onPress={() => openTournament(t.id)}
                  style={{ marginBottom: 8 }}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Empty state */}
        {!loading && upcomingRegs.length === 0 && myHosted.length === 0 ? (
          <View style={styles.empty}>
            <YEyebrow color={YColors.ink3}>NOTHING YET</YEyebrow>
            <YDisplay size={24} style={{ marginTop: 6 }}>NO EVENTS</YDisplay>
            <YUiText size={12} color={YColors.ink2} style={{ marginTop: 8 }}>
              Register for a tournament or host one to see it here.
            </YUiText>
          </View>
        ) : null}

        {/* Actions */}
        <YSectionHead eyebrow="ACCOUNT" title="SETTINGS" />
        <View style={styles.actionsWrap}>
          <Row label="EDIT PROFILE" />
          <Row label="PASSWORD & SECURITY" />
          <Row label="NOTIFICATIONS" />
          <Row label="HELP & FEEDBACK" />
          <Row label="ABOUT YOIDEN" />
        </View>

        <View style={{ marginTop: 24, paddingHorizontal: 20, alignItems: 'flex-start' }}>
          <YButton variant="ghost" size="md" onPress={logout}>
            SIGN OUT
          </YButton>
        </View>

        <View style={styles.footer}>
          <YEyebrow color={YColors.ink3}>YOIDEN · v1.0.0</YEyebrow>
          <YMono size={10} color={YColors.ink4} style={{ marginTop: 4 }}>
            EQUIP · ENGAGE
          </YMono>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ flex: 1, alignItems: 'center' }}>
    <YDisplay size={28}>{value}</YDisplay>
    <YEyebrow color={YColors.ink3} style={{ marginTop: 2 }}>{label}</YEyebrow>
  </View>
);

const Row: React.FC<{ label: string; onPress?: () => void }> = ({ label, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: YColors.bg3 }]}>
    <YUiText size={12} weight={800} color={YColors.ink} style={{ letterSpacing: 1.2 }}>{label}</YUiText>
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  iconBtn: {
    width: 38, height: 38, borderRadius: 999,
    backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2,
    alignItems: 'center', justifyContent: 'center',
  },
  idCard: {
    marginHorizontal: 16,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 14,
    padding: 18,
    overflow: 'hidden',
  },
  idHeader: { flexDirection: 'row', alignItems: 'center' },
  statsRow: {
    marginTop: 18,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: YColors.line,
  },
  statDivider: { width: 1, height: 32, backgroundColor: YColors.line },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  listWrap: { paddingHorizontal: 16 },
  empty: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 18,
    borderRadius: 12,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
  },
  actionsWrap: {
    marginHorizontal: 16,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
  },
  footer: {
    marginTop: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: YColors.line,
  },

  // ── My Bookings card ────────────────────────────────────────────
  bookingsCard: {
    marginHorizontal: 16,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bookingsIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(24,88,214,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── DUPR coming soon card ────────────────────────────────────────
  duprCard: {
    marginHorizontal: 16,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  duprLogo: {
    borderWidth: 1.5,
    borderColor: YColors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  duprPill: {
    marginTop: 16,
    backgroundColor: 'rgba(24,88,214,0.08)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  // ── Next match card ─────────────────────────────────────────────
  nextMatchCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextMatchClock: {
    alignItems: 'center',
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: YColors.line,
    marginLeft: 12,
    paddingVertical: 4,
  },
});
