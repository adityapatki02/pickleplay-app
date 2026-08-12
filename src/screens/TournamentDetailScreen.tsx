import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StyleSheet,
  Dimensions,
  Animated,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

import { tournamentsApi } from '../api/tournaments.api';
import { xAlert } from '../utils/alert';
import { registrationsApi } from '../api/registrations.api';
import { Tournament, TournamentCategory } from '../types/tournament.types';
import { DiscoverStackParamList } from '../navigation/types';



// ─── Constants ───────────────────────────────────────────────────────────────

const NAVY = '#001E40';
const BLUE = '#1858D6';
const BG = '#F3F4F5';
const WHITE = '#FFFFFF';
const GREEN = '#06D6A0';
const ORANGE = '#FFB703';
const RED = '#BA1A1A';
const GRAY = '#737780';

const { width: SW } = Dimensions.get('window');

type Tab = 'INFO' | 'CATEGORIES' | 'PLAYERS' | 'SCORES';
const TABS: Tab[] = ['INFO', 'CATEGORIES', 'PLAYERS', 'SCORES'];

// ─── Route Param Type ─────────────────────────────────────────────────────────

type TournamentDetailRouteProp = RouteProp<
  { TournamentDetail: { tournamentId: string } },
  'TournamentDetail'
>;

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const BackIcon = ({ color = '#1A1D21' }: { color?: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const MapPinIcon = ({ color = BLUE }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={color} />
    <Circle cx="12" cy="9" r="2.5" fill={WHITE} />
  </Svg>
);

const CalendarIcon = ({ color = BLUE }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth={2} />
    <Line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth={2} />
  </Svg>
);

const UsersIcon = ({ color = BLUE }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={2} />
    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const PhoneIcon = ({ color = GRAY }: { color?: string }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.37 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.55a16 16 0 0 0 6.09 6.09l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const MailIcon = ({ color = GRAY }: { color?: string }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={color} strokeWidth={2} />
    <Polyline points="22,6 12,13 2,6" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const ShareIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx="18" cy="5" r="3" stroke={'#1A1D21'} strokeWidth={2} />
    <Circle cx="6" cy="12" r="3" stroke={'#1A1D21'} strokeWidth={2} />
    <Circle cx="18" cy="19" r="3" stroke={'#1A1D21'} strokeWidth={2} />
    <Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke={'#1A1D21'} strokeWidth={2} strokeLinecap="round" />
    <Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke={'#1A1D21'} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, compact = false): string {
  const d = new Date(dateStr);
  if (compact) {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function statusColor(status: string): string {
  switch (status) {
    case 'registration_open': return GREEN;
    case 'in_progress':       return BLUE;
    case 'completed':         return GRAY;
    case 'cancelled':         return RED;
    case 'registration_closed': return ORANGE;
    default:                  return GRAY;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'draft':               return 'DRAFT';
    case 'published':           return 'PUBLISHED';
    case 'registration_open':   return 'REG OPEN';
    case 'registration_closed': return 'REG CLOSED';
    case 'in_progress':         return 'LIVE';
    case 'completed':           return 'COMPLETED';
    case 'cancelled':           return 'CANCELLED';
    default:                    return status.toUpperCase();
  }
}

function formatLabel(format: string): string {
  return format === 'singles' ? 'SGL' : 'DBL';
}

function genderLabel(gender: string): string {
  switch (gender) {
    case 'male':   return 'MEN';
    case 'female': return 'WOMEN';
    case 'mixed':  return 'MIXED';
    default:       return 'OPEN';
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={s.infoPill}>
      {icon}
      <View style={{ marginLeft: 6 }}>
        <Text style={s.infoPillLabel}>{label}</Text>
        <Text style={s.infoPillValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Tab Content: INFO ────────────────────────────────────────────────────────

function CheckInButton({ tournamentId, status }: { tournamentId: string; status: string }) {
  const [isCheckedIn, setIsCheckedIn] = React.useState(false);
  const [checkedInAt, setCheckedInAt] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const showCheckIn = ['in_progress', 'registration_closed'].includes(status);

  React.useEffect(() => {
    if (!showCheckIn) return;
    (async () => {
      try {
        const { registrationsApi } = await import('../api/registrations.api');
        const res = await registrationsApi.getCheckInStatus(tournamentId);
        const data = res.data?.data ?? res.data;
        setIsCheckedIn(!!data?.isCheckedIn);
        setCheckedInAt(data?.checkedInAt ?? null);
      } catch {}
    })();
  }, [tournamentId, showCheckIn]);

  if (!showCheckIn) return null;

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const { registrationsApi } = await import('../api/registrations.api');
      await registrationsApi.checkIn(tournamentId);
      setIsCheckedIn(true);
      setCheckedInAt(new Date().toISOString());
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return ''; }
  };

  if (isCheckedIn) {
    return (
      <View style={{ backgroundColor: 'rgba(6,214,160,0.1)', borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Text style={{ color: '#06D6A0', fontSize: 18 }}>✓</Text>
        <Text style={{ color: '#06D6A0', fontSize: 14, fontWeight: '700' }}>
          CHECKED IN {checkedInAt ? `at ${formatTime(checkedInAt)}` : ''}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={{ backgroundColor: '#06D6A0', borderRadius: 12, padding: 16, marginBottom: 16, alignItems: 'center', opacity: loading ? 0.6 : 1 }}
      onPress={handleCheckIn}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={{ color: '#1A1D21', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>CHECK IN</Text>
      )}
    </TouchableOpacity>
  );
}

function InfoTab({ tournament }: { tournament: Tournament }) {
  const days = daysUntil(tournament.registrationDeadline);
  const isDeadlineSoon = days > 0 && days <= 7;
  const isDeadlinePassed = days <= 0;

  const openMaps = () => {
    const q = encodeURIComponent(`${tournament.venueName}, ${tournament.venueAddress}, ${tournament.city}`);
    Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() =>
      xAlert('Error', 'Could not open maps.')
    );
  };

  const callPhone = () => {
    if (tournament.contactPhone) {
      Linking.openURL(`tel:${tournament.contactPhone}`);
    }
  };

  const sendEmail = () => {
    if (tournament.contactEmail) {
      Linking.openURL(`mailto:${tournament.contactEmail}`);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={s.tabScroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Check-in button */}
      <CheckInButton tournamentId={tournament.id} status={tournament.status} />

      {/* Key stat pills */}
      <View style={s.pillRow}>
        <InfoPill
          icon={<CalendarIcon />}
          label="START"
          value={formatDate(tournament.startDate, true)}
        />
        <InfoPill
          icon={<CalendarIcon color={'#94A3B8'} />}
          label="END"
          value={formatDate(tournament.endDate, true)}
        />
        <InfoPill
          icon={<UsersIcon />}
          label="CATEGORIES"
          value={String(tournament.categories?.length ?? 0)}
        />
      </View>

      {/* Registration deadline */}
      <View style={[s.card, isDeadlineSoon && s.cardWarning, isDeadlinePassed && s.cardMuted]}>
        <View style={s.deadlineRow}>
          <View>
            <Text style={s.cardLabel}>REGISTRATION DEADLINE</Text>
            <Text style={s.deadlineDate}>{formatDate(tournament.registrationDeadline)}</Text>
          </View>
          <View style={[
            s.deadlineBadge,
            isDeadlineSoon ? s.deadlineBadgeWarn : isDeadlinePassed ? s.deadlineBadgeDead : s.deadlineBadgeOk
          ]}>
            <Text style={[
              s.deadlineBadgeText,
              isDeadlineSoon ? { color: '#FFB703' } : isDeadlinePassed ? { color: '#fff' } : { color: GREEN }
            ]}>
              {isDeadlinePassed
                ? 'CLOSED'
                : days === 1
                  ? 'LAST DAY'
                  : `${days}D LEFT`}
            </Text>
          </View>
        </View>
      </View>

      {/* Venue */}
      <TouchableOpacity style={s.card} onPress={openMaps} activeOpacity={0.82}>
        <Text style={s.cardLabel}>VENUE</Text>
        <View style={s.venueRow}>
          <View style={s.venuePinBox}>
            <MapPinIcon />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.venueName}>{tournament.venueName}</Text>
            <Text style={s.venueAddr}>{tournament.venueAddress}</Text>
            <Text style={s.venueCity}>
              {tournament.city}{tournament.state ? `, ${tournament.state}` : ''}
            </Text>
          </View>
        </View>
        <Text style={s.mapsLink}>Open in Google Maps {'\u2192'}</Text>
      </TouchableOpacity>

      {/* Tournament Dates detail */}
      <View style={s.card}>
        <Text style={s.cardLabel}>TOURNAMENT DATES</Text>
        <View style={s.datesGrid}>
          <View style={s.dateBlock}>
            <Text style={s.dateBlockLabel}>STARTS</Text>
            <Text style={s.dateBlockDay}>
              {new Date(tournament.startDate).toLocaleDateString('en-IN', { day: 'numeric' })}
            </Text>
            <Text style={s.dateBlockMonth}>
              {new Date(tournament.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </Text>
          </View>
          <View style={s.datesArrow}>
            <Text style={s.datesArrowText}>{'\u2192'}</Text>
          </View>
          <View style={s.dateBlock}>
            <Text style={s.dateBlockLabel}>ENDS</Text>
            <Text style={s.dateBlockDay}>
              {new Date(tournament.endDate).toLocaleDateString('en-IN', { day: 'numeric' })}
            </Text>
            <Text style={s.dateBlockMonth}>
              {new Date(tournament.endDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>
      </View>

      {/* About */}
      {!!tournament.description && (
        <View style={s.card}>
          <Text style={s.cardLabel}>ABOUT</Text>
          <Text style={s.aboutText}>{tournament.description}</Text>
        </View>
      )}

      {/* Refund Policy */}
      {!!tournament.refundPolicy && (
        <View style={s.card}>
          <Text style={s.cardLabel}>REFUND POLICY</Text>
          <Text style={s.aboutText}>{tournament.refundPolicy}</Text>
        </View>
      )}

      {/* Contact */}
      {(tournament.contactPhone || tournament.contactEmail) && (
        <View style={s.card}>
          <Text style={s.cardLabel}>CONTACT ORGANIZER</Text>
          {!!tournament.contactPhone && (
            <TouchableOpacity style={s.contactRow} onPress={callPhone}>
              <View style={s.contactIcon}><PhoneIcon color={'#64748B'} /></View>
              <Text style={s.contactText}>{tournament.contactPhone}</Text>
              <Text style={s.contactAction}>Call</Text>
            </TouchableOpacity>
          )}
          {!!tournament.contactEmail && (
            <TouchableOpacity
              style={[s.contactRow, tournament.contactPhone ? s.contactRowBorder : undefined]}
              onPress={sendEmail}
            >
              <View style={s.contactIcon}><MailIcon color={'#64748B'} /></View>
              <Text style={s.contactText}>{tournament.contactEmail}</Text>
              <Text style={s.contactAction}>Email</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Tab Content: CATEGORIES ──────────────────────────────────────────────────

function CategoriesTab({
  tournament,
  onRegister,
}: {
  tournament: Tournament;
  onRegister: (categoryId: string) => void;
}) {
  const categories = tournament.categories ?? [];
  const isOpen = tournament.status === 'registration_open';

  if (categories.length === 0) {
    return (
      <View style={s.emptyCenter}>
        <Text style={s.emptyIcon}>{'\uD83C\uDFC6'}</Text>
        <Text style={s.emptyTitle}>NO CATEGORIES YET</Text>
        <Text style={s.emptySubtitle}>Categories will appear here once the organizer adds them.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      {!isOpen && (
        <View style={s.registrationBanner}>
          <Text style={s.registrationBannerText}>
            {tournament.status === 'registration_closed' || tournament.status === 'in_progress' || tournament.status === 'completed'
              ? '\uD83D\uDD12  Registration is closed'
              : '\uD83D\uDD1C  Registration not open yet'}
          </Text>
        </View>
      )}

      {categories.map((cat, idx) => (
        <CategoryDetailCard
          key={cat.id}
          category={cat}
          index={idx}
          isOpen={isOpen}
          onRegister={() => onRegister(cat.id)}
        />
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function CategoryDetailCard({
  category,
  index,
  isOpen,
  onRegister,
}: {
  category: TournamentCategory;
  index: number;
  isOpen: boolean;
  onRegister: () => void;
}) {
  const spotsLeft = category.registeredTeams !== undefined
    ? category.maxTeams - category.registeredTeams
    : undefined;
  const isFull = spotsLeft !== undefined && spotsLeft <= 0;
  const isCatOpen = category.status === 'open' && isOpen && !isFull;
  const accentColors = [BLUE, '#7B2FBE', '#00A86B', '#E85D04', '#1858D6'];
  const accent = accentColors[index % accentColors.length];

  return (
    <View style={[s.catCard, { borderLeftColor: accent }]}>
      {/* Header row */}
      <View style={s.catCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.catName}>{category.name}</Text>
          <View style={s.catTagRow}>
            <View style={[s.catTag, { backgroundColor: accent + '22' }]}>
              <Text style={[s.catTagText, { color: accent }]}>{formatLabel(category.format)}</Text>
            </View>
            <View style={[s.catTag, { backgroundColor: '#F5F7FA' }]}>
              <Text style={[s.catTagText, { color: '#64748B' }]}>{genderLabel(category.gender)}</Text>
            </View>
            {category.knockoutFormat && (
              <View style={[s.catTag, { backgroundColor: '#F5F7FA' }]}>
                <Text style={[s.catTagText, { color: '#64748B' }]}>
                  {category.knockoutFormat === 'round_robin' ? 'RR' :
                   category.knockoutFormat === 'double_elimination' ? 'DE' : 'SE'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={s.catFeeBox}>
          <Text style={s.catFeeLabel}>ENTRY</Text>
          <Text style={s.catFee}>
            {category.entryFee === 0 ? 'FREE' : `\u20B9${category.entryFee}`}
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.catStats}>
        <View style={s.catStat}>
          <Text style={s.catStatValue}>{category.maxTeams}</Text>
          <Text style={s.catStatLabel}>MAX TEAMS</Text>
        </View>
        <View style={s.catStatDivider} />
        {spotsLeft !== undefined ? (
          <View style={s.catStat}>
            <Text style={[s.catStatValue, spotsLeft <= 5 && { color: '#EF4444' }]}>
              {spotsLeft}
            </Text>
            <Text style={s.catStatLabel}>SPOTS LEFT</Text>
          </View>
        ) : (
          <View style={s.catStat}>
            <Text style={s.catStatValue}>{category.groupSize}</Text>
            <Text style={s.catStatLabel}>GROUP SIZE</Text>
          </View>
        )}
        <View style={s.catStatDivider} />
        <View style={s.catStat}>
          <Text style={s.catStatValue}>{category.pointsPerGame}</Text>
          <Text style={s.catStatLabel}>PTS/GAME</Text>
        </View>
        {(category.minRating || category.maxRating) && (
          <>
            <View style={s.catStatDivider} />
            <View style={s.catStat}>
              <Text style={s.catStatValue}>
                {category.minRating ?? '\u2014'}{category.maxRating ? `\u2013${category.maxRating}` : '+'}
              </Text>
              <Text style={s.catStatLabel}>RATING</Text>
            </View>
          </>
        )}
      </View>

      {/* Payment mode + register */}
      <View style={s.catFooter}>
        <View style={s.paymentModeRow}>
          <Text style={s.paymentModeLabel}>Payment:</Text>
          <Text style={s.paymentModeValue}>
            {category.paymentMode === 'online' ? 'Online only'
             : category.paymentMode === 'venue' ? 'At venue'
             : 'Online / At venue'}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            s.registerBtn,
            !isCatOpen && s.registerBtnDisabled,
          ]}
          onPress={isCatOpen ? onRegister : undefined}
          disabled={!isCatOpen}
          activeOpacity={0.82}
        >
          <Text style={[s.registerBtnText, !isCatOpen && s.registerBtnTextDisabled]}>
            {isFull ? 'FULL' : !isOpen ? 'CLOSED' : category.status !== 'open' ? 'CLOSED' : 'REGISTER \u2192'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Tab Content: PLAYERS ─────────────────────────────────────────────────────

type Registration = {
  id: string;
  userId: string;
  categoryId: string;
  status: string;
  user?: { fullName?: string; displayName?: string; selfReportedSkill?: string; city?: string };
  category?: { name: string };
  registeredAt?: string;
};

function PlayersTab({ tournament }: { tournament: Tournament }) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string>('ALL');

  const categories = tournament.categories ?? [];

  useEffect(() => {
    registrationsApi.getByTournament(tournament.id)
      .then((res: any) => {
        const data = res.data?.data ?? res.data ?? [];
        setRegistrations(Array.isArray(data) ? data : []);
      })
      .catch(() => setRegistrations([]))
      .finally(() => setLoading(false));
  }, [tournament.id]);

  const filtered = selectedCat === 'ALL'
    ? registrations
    : registrations.filter(r => r.categoryId === selectedCat);

  const confirmed = filtered.filter(r => r.status === 'confirmed');
  const pending   = filtered.filter(r => r.status === 'pending_payment' || r.status === 'waitlisted');

  if (loading) {
    return (
      <View style={s.emptyCenter}>
        <ActivityIndicator size="large" color={'#1858D6'} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Category filter chips */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catFilterRow}
        >
          <TouchableOpacity
            style={[s.catChip, selectedCat === 'ALL' && s.catChipActive]}
            onPress={() => setSelectedCat('ALL')}
          >
            <Text style={[s.catChipText, selectedCat === 'ALL' && s.catChipTextActive]}>
              ALL ({registrations.length})
            </Text>
          </TouchableOpacity>
          {categories.map(c => {
            const count = registrations.filter(r => r.categoryId === c.id).length;
            return (
              <TouchableOpacity
                key={c.id}
                style={[s.catChip, selectedCat === c.id && s.catChipActive]}
                onPress={() => setSelectedCat(c.id)}
              >
                <Text style={[s.catChipText, selectedCat === c.id && s.catChipTextActive]}>
                  {c.name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
        {registrations.length === 0 ? (
          <View style={s.emptyInline}>
            <Text style={s.emptyIcon}>{'\uD83C\uDFBE'}</Text>
            <Text style={s.emptyTitle}>NO PLAYERS YET</Text>
            <Text style={s.emptySubtitle}>Be the first to register!</Text>
          </View>
        ) : (
          <>
            {confirmed.length > 0 && (
              <View>
                <View style={s.playerSectionHeader}>
                  <View style={[s.sectionDot, { backgroundColor: GREEN }]} />
                  <Text style={s.playerSectionTitle}>CONFIRMED ({confirmed.length})</Text>
                </View>
                {confirmed.map((reg, i) => (
                  <PlayerRow key={reg.id} reg={reg} index={i} />
                ))}
              </View>
            )}
            {pending.length > 0 && (
              <View style={{ marginTop: confirmed.length > 0 ? 16 : 0 }}>
                <View style={s.playerSectionHeader}>
                  <View style={[s.sectionDot, { backgroundColor: ORANGE }]} />
                  <Text style={s.playerSectionTitle}>PENDING / WAITLISTED ({pending.length})</Text>
                </View>
                {pending.map((reg, i) => (
                  <PlayerRow key={reg.id} reg={reg} index={i} />
                ))}
              </View>
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function PlayerRow({ reg, index }: { reg: Registration; index: number }) {
  const name = reg.user?.displayName ?? reg.user?.fullName ?? `Player #${index + 1}`;
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const skill = reg.user?.selfReportedSkill;
  const city = reg.user?.city;
  const avatarColors = ['#001E40', '#1858D6', '#7B2FBE', '#00A86B', '#E85D04'];
  const bg = avatarColors[index % avatarColors.length];

  return (
    <View style={s.playerRow}>
      <View style={[s.playerAvatar, { backgroundColor: bg }]}>
        <Text style={s.playerInitials}>{initials}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.playerName}>{name}</Text>
        {(skill || city) && (
          <Text style={s.playerMeta}>
            {[skill, city].filter(Boolean).join('  \u2022  ')}
          </Text>
        )}
      </View>
      <View style={[s.playerStatusBadge,
        reg.status === 'confirmed' ? s.playerStatusConfirmed : s.playerStatusPending
      ]}>
        <Text style={[s.playerStatusText,
          reg.status === 'confirmed' ? s.playerStatusTextConfirmed : s.playerStatusTextPending
        ]}>
          {reg.status === 'confirmed' ? '\u2713' : reg.status === 'waitlisted' ? 'WL' : '\u2026'}
        </Text>
      </View>
    </View>
  );
}

// ─── Tab Content: SCORES ──────────────────────────────────────────────────────

function ScoresTab({ tournament }: { tournament: Tournament }) {
  const isActive = tournament.status === 'in_progress' || tournament.status === 'completed';

  return (
    <View style={s.emptyCenter}>
      {isActive ? (
        <>
          <Text style={s.emptyIcon}>{'\uD83C\uDFD3'}</Text>
          <Text style={s.emptyTitle}>SCORES COMING SOON</Text>
          <Text style={s.emptySubtitle}>Live scores and results will appear here.</Text>
        </>
      ) : (
        <>
          <Text style={s.emptyIcon}>{'\uD83D\uDCCB'}</Text>
          <Text style={s.emptyTitle}>TOURNAMENT HASN'T STARTED</Text>
          <Text style={s.emptySubtitle}>
            Scores and brackets will be available once the tournament begins on{' '}
            {formatDate(tournament.startDate)}.
          </Text>
        </>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TournamentDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<TournamentDetailRouteProp>();
  const { tournamentId } = route.params;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('INFO');

  const tabIndicatorX = useRef(new Animated.Value(0)).current;
  const tabWidth = SW / TABS.length;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    tournamentsApi.getById(tournamentId)
      .then((res: any) => {
        if (!cancelled) {
          setTournament(res.data?.data ?? res.data);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load tournament.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tournamentId]);

  const switchTab = useCallback((tab: Tab) => {
    const idx = TABS.indexOf(tab);
    setActiveTab(tab);
    Animated.spring(tabIndicatorX, {
      toValue: idx * tabWidth,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start();
  }, [tabIndicatorX, tabWidth]);

  const handleRegister = useCallback((categoryId: string) => {
    navigation.navigate('Registration', { tournamentId, categoryId });
  }, [navigation, tournamentId]);

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={s.loadingHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <BackIcon />
          </TouchableOpacity>
        </View>
        <View style={s.loadingCenter}>
          <ActivityIndicator size="large" color={'#1858D6'} />
          <Text style={s.loadingText}>Loading tournament...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──
  if (error || !tournament) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={s.loadingHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <BackIcon />
          </TouchableOpacity>
        </View>
        <View style={s.loadingCenter}>
          <Text style={s.errorIcon}>{'\u26A0\uFE0F'}</Text>
          <Text style={s.errorTitle}>TOURNAMENT NOT FOUND</Text>
          <Text style={s.errorSub}>{error ?? 'Something went wrong.'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => navigation.goBack()}>
            <Text style={s.retryBtnText}>GO BACK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sColor = statusColor(tournament.status);
  const sLabel = statusLabel(tournament.status);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* ── HEADER ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <BackIcon />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle} numberOfLines={1}>{tournament.name}</Text>
            <Text style={s.headerSub}>
              {tournament.city}{tournament.state ? `, ${tournament.state}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={s.shareBtn}>
            <ShareIcon />
          </TouchableOpacity>
        </View>

        {/* Status + featured row */}
        <View style={s.headerMeta}>
          <View style={[s.statusChip, { backgroundColor: sColor + '22', borderColor: sColor + '55' }]}>
            {tournament.status === 'in_progress' && (
              <View style={[s.liveDot, { backgroundColor: sColor }]} />
            )}
            <Text style={[s.statusChipText, { color: sColor }]}>{sLabel}</Text>
          </View>
          {tournament.isFeatured && (
            <View style={s.featuredChip}>
              <Text style={s.featuredChipText}>{'\u2B50'} FEATURED</Text>
            </View>
          )}
          <Text style={s.headerDates}>
            {formatDate(tournament.startDate, true)} {'\u2013'} {formatDate(tournament.endDate, true)}
          </Text>
        </View>
      </View>

      {/* ── TAB BAR ── */}
      <View style={s.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={s.tabBtn}
            onPress={() => switchTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
        {/* Sliding indicator */}
        <Animated.View
          style={[
            s.tabIndicator,
            { width: tabWidth - 32, transform: [{ translateX: tabIndicatorX }] },
          ]}
        />
      </View>

      {/* ── TAB CONTENT ── */}
      <View style={{ flex: 1 }}>
        {activeTab === 'INFO'       && <InfoTab tournament={tournament} />}
        {activeTab === 'CATEGORIES' && <CategoriesTab tournament={tournament} onRegister={handleRegister} />}
        {activeTab === 'PLAYERS'    && <PlayersTab tournament={tournament} />}
        {activeTab === 'SCORES'     && <ScoresTab tournament={tournament} />}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Loading / error
  loadingHeader: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 8,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1D21',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: '#1858D6',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 2,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1D21',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  featuredChip: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  featuredChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFB703',
    letterSpacing: 0.8,
  },
  headerDates: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.3,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F5F7FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    position: 'relative',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1.2,
  },
  tabTextActive: {
    color: '#001E40',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    height: 2.5,
    backgroundColor: '#001E40',
    borderRadius: 2,
  },

  // Tab scroll
  tabScroll: {
    padding: 16,
  },

  // Info pills
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  infoPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoPillLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  infoPillValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1D21',
  },

  // Cards
  card: {
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardWarning: {
    borderWidth: 1,
    borderColor: ORANGE + '55',
    backgroundColor: 'rgba(255,183,3,0.1)',
  },
  cardMuted: {
    backgroundColor: '#F9FAFB',
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 2,
    marginBottom: 10,
  },

  // Deadline
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deadlineDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1D21',
    marginTop: 2,
  },
  deadlineBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  deadlineBadgeOk: { backgroundColor: GREEN + '22' },
  deadlineBadgeWarn: { backgroundColor: ORANGE + '33' },
  deadlineBadgeDead: { backgroundColor: RED },
  deadlineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Venue
  venueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  venuePinBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: BLUE + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  venueName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1D21',
    marginBottom: 2,
  },
  venueAddr: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 2,
  },
  venueCity: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  mapsLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1858D6',
    letterSpacing: 0.3,
  },

  // Dates grid
  datesGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateBlock: {
    flex: 1,
    alignItems: 'center',
  },
  dateBlockLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 2,
    marginBottom: 4,
  },
  dateBlockDay: {
    fontSize: 36,
    fontWeight: '900',
    color: '#001E40',
    lineHeight: 40,
  },
  dateBlockMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  datesArrow: {
    width: 32,
    alignItems: 'center',
  },
  datesArrowText: {
    fontSize: 20,
    color: '#94A3B8',
  },

  // About
  aboutText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 22,
  },

  // Contact
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  contactRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  contactIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  contactText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1D21',
  },
  contactAction: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1858D6',
    letterSpacing: 0.5,
  },

  // Registration banner
  registrationBanner: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  registrationBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },

  // Category cards
  catCard: {
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  catCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  catName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1D21',
    marginBottom: 8,
  },
  catTagRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  catTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  catFeeBox: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  catFeeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  catFee: {
    fontSize: 20,
    fontWeight: '900',
    color: '#001E40',
    letterSpacing: -0.5,
  },

  // Category stats
  catStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  catStat: {
    flex: 1,
    alignItems: 'center',
  },
  catStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1D21',
    marginBottom: 2,
  },
  catStatLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
  catStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },

  // Category footer
  catFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  paymentModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentModeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  paymentModeValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1D21',
  },
  registerBtn: {
    backgroundColor: '#1858D6',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 22,
  },
  registerBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  registerBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 1.2,
  },
  registerBtnTextDisabled: {
    color: '#94A3B8',
  },

  // Players
  catFilterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: '#1858D6',
    borderColor: '#1858D6',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  catChipTextActive: {
    color: WHITE,
  },
  playerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginHorizontal: 4,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  playerSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerInitials: {
    fontSize: 14,
    fontWeight: '800',
    color: WHITE,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1D21',
    marginBottom: 2,
  },
  playerMeta: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    textTransform: 'capitalize',
  },
  playerStatusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerStatusConfirmed: { backgroundColor: GREEN + '22' },
  playerStatusPending:   { backgroundColor: ORANGE + '22' },
  playerStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  playerStatusTextConfirmed: { color: GREEN },
  playerStatusTextPending:   { color: ORANGE },

  // Empty state
  emptyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyInline: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
