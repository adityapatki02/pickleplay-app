import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  Linking,
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
import { authApi } from '../../api/auth.api';
import { tournamentsApi } from '../../api/tournaments.api';
import { registrationsApi } from '../../api/registrations.api';
import { SUPPORT_EMAIL, PRIVACY_URL, TERMS_URL } from '../../config/constants';
import { xConfirm, xAlert } from '../../utils/alert';
import { venuesApi } from '../../api/venues.api';
import type { Tournament } from '../../types/tournament.types';
import type { Venue } from '../../types/booking.types';
import type { YoidenTabParamList } from '../../navigation/YoidenTabNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MeStackParamList } from '../../navigation/nav-types';

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
  const [myVenues, setMyVenues] = useState<Venue[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const [regsRes, hostedRes, venueRes] = await Promise.allSettled([
        registrationsApi.getMyRegistrations(),
        tournamentsApi.getMyTournaments(),
        venuesApi.getMyVenues(),
      ]);
      if (regsRes.status === 'fulfilled') {
        const data = unwrap<Registration[]>(regsRes.value);
        setMyRegs(Array.isArray(data) ? data : []);
      }
      if (hostedRes.status === 'fulfilled') {
        const data = unwrap<Tournament[]>(hostedRes.value);
        setMyHosted(Array.isArray(data) ? data : []);
      }
      if (venueRes.status === 'fulfilled') {
        const res = venueRes.value as any;
        const data = res?.data?.data ?? res?.data ?? [];
        setMyVenues(Array.isArray(data) ? data : []);
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
  const openEditProfile = () => (nav as any).navigate('MeTab', { screen: 'EditProfile' });
  const openURL = (url: string) => Linking.openURL(url).catch(() => {});
  const contactSupport = () =>
    openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Yoiden support')}`);

  const doDelete = async () => {
    try {
      await authApi.deleteAccount();
      logout();
    } catch (e: any) {
      xAlert('Error', e?.response?.data?.message ?? 'Could not delete your account. Please try again.');
    }
  };
  const handleDeleteAccount = () =>
    xConfirm(
      'Delete account',
      'This permanently deletes your account and all your data. This cannot be undone.',
      doDelete,
    );

  // Collapse to one entry per tournament — a player registered in several
  // categories of the same event would otherwise duplicate the row (and its key).
  const upcomingRegs = (() => {
    const seen = new Set<string>();
    const list: Tournament[] = [];
    for (const r of myRegs) {
      const t = r.tournament;
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      list.push(t);
    }
    return list;
  })();

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
            <Pressable style={styles.iconBtn} hitSlop={8} onPress={openEditProfile}>
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
              <YBadge color="#fff" bg={YColors.accent}>
                {user.city.toUpperCase()}
              </YBadge>
            ) : null}
          </View>
        </View>

        {/* MY GAME — stats overview; full career lives behind VIEW FULL STATS */}
        <View style={styles.accentBar} />
        <YSectionHead eyebrow="STATS · PICKLEBALL" title="MY GAME" />
        {user?.id ? (
          <Pressable
            onPress={() => (nav as any).navigate('PlayerProfile', { playerId: user.id })}
            style={{ marginHorizontal: 20, marginBottom: 12, paddingVertical: 12, borderRadius: 10, backgroundColor: YColors.accent, alignItems: 'center' }}
          >
            <YUiText size={12} weight={800} color="#fff" style={{ letterSpacing: 0.5 }}>
              VIEW FULL STATS →
            </YUiText>
          </Pressable>
        ) : null}
        <View style={styles.gameCard}>
          <YUiText size={13} color={YColors.ink2} style={{ lineHeight: 19 }}>
            Your full pickleball career — matches, win rate, and per-format stats across every league and tournament you've played.
          </YUiText>
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

        {/* Venue admin card — only visible to venue owners */}
        {myVenues.length > 0 ? (
          <>
            <YSectionHead
              eyebrow="VENUE OWNER"
              title={myVenues.length > 1 ? `MY VENUES (${myVenues.length})` : 'MY VENUE'}
            />
            <Pressable
              style={styles.venueCard}
              onPress={() =>
                nav.navigate('MeTab', { screen: 'VenueAdmin', params: { venueId: myVenues[0].id } })
              }
            >
              <View style={styles.venueCardIcon}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                    stroke={YColors.lime}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path d="M9 22V12h6v10" stroke={YColors.lime} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <YUiText size={13} weight={800} color={YColors.ink} style={{ letterSpacing: 0.5 }}>
                  {myVenues.length > 1 ? `${myVenues.length} VENUES` : (myVenues[0].name?.toUpperCase() ?? 'MY VENUE')}
                </YUiText>
                <YUiText size={12} color={YColors.ink3} style={{ marginTop: 2 }}>
                  {myVenues.length > 1
                    ? myVenues.map(v => v.name).join(' · ')
                    : (myVenues[0].city?.toUpperCase() ?? 'MANAGE COURTS & BOOKINGS')}
                </YUiText>
              </View>
              <YBadge color="#000" bg={YColors.lime}>ADMIN</YBadge>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 8 }}>
                <Path d="M9 6l6 6-6 6" stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </Pressable>
          </>
        ) : null}

        {/* Actions */}
        <YSectionHead eyebrow="ACCOUNT" title="SETTINGS" />
        <View style={styles.actionsWrap}>
          <Row label="EDIT PROFILE" onPress={openEditProfile} />
          <Row label="PRIVACY POLICY" onPress={() => openURL(PRIVACY_URL)} />
          <Row label="TERMS OF SERVICE" onPress={() => openURL(TERMS_URL)} />
          <Row label="HELP & SUPPORT" onPress={contactSupport} />
          <Row label="DELETE ACCOUNT" onPress={handleDeleteAccount} destructive />
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

const Row: React.FC<{ label: string; onPress?: () => void; destructive?: boolean }> = ({ label, onPress, destructive }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: YColors.bg3 }]}>
    <YUiText size={12} weight={800} color={destructive ? YColors.live : YColors.ink} style={{ letterSpacing: 1.2 }}>{label}</YUiText>
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={destructive ? YColors.live : YColors.ink3} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  accentBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: YColors.lime,
    marginLeft: 20,
    marginTop: 24,
    marginBottom: -14,
  },

  // ── MY GAME card ────────────────────────────────────────────────
  gameCard: {
    marginHorizontal: 16,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 14,
    padding: 18,
    overflow: 'hidden',
  },
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

  // ── My Venue admin card ─────────────────────────────────────────
  venueCard: {
    marginHorizontal: 16,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.lime,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  venueCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(188,255,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
