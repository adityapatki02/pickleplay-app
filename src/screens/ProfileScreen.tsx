import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Circle, Polyline, Line, Rect } from 'react-native-svg';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY   = '#001E40';
const BLUE   = '#1858D6';
const BG     = '#FFFFFF';
const WHITE  = '#FFFFFF';
const GREEN  = '#06D6A0';
const RED    = '#BA1A1A';
const GRAY   = '#737780';
const BORDER = '#E2E8F0';

const TEXT_PRIMARY   = '#1A1D21';
const TEXT_SECONDARY = '#64748B';
const TEXT_TERTIARY  = '#94A3B8';
const INPUT_BG       = '#F5F7FA';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const EditIcon = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={NAVY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={NAVY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PhoneIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.37 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.55a16 16 0 0 0 6.09 6.09l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const MailIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={TEXT_SECONDARY} strokeWidth={1.8} />
    <Polyline points="22,6 12,13 2,6" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const MapPinIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinejoin="round" />
    <Circle cx="12" cy="9" r="2.5" stroke={TEXT_SECONDARY} strokeWidth={1.8} />
  </Svg>
);

const UserIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinecap="round" />
    <Circle cx="12" cy="7" r="4" stroke={TEXT_SECONDARY} strokeWidth={1.8} />
  </Svg>
);

const ChevronIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M9 18l6-6-6-6" stroke={TEXT_TERTIARY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const LogoutIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={RED} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Polyline points="16 17 21 12 16 7" stroke={RED} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Line x1="21" y1="12" x2="9" y2="12" stroke={RED} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const ShieldIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);

const BellIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const StatsIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Line x1="18" y1="20" x2="18" y2="10" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinecap="round" />
    <Line x1="12" y1="20" x2="12" y2="4" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinecap="round" />
    <Line x1="6" y1="20" x2="6" y2="14" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const HelpIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={TEXT_SECONDARY} strokeWidth={1.8} />
    <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinecap="round" />
    <Line x1="12" y1="17" x2="12.01" y2="17" stroke={TEXT_SECONDARY} strokeWidth={2.5} strokeLinecap="round" />
  </Svg>
);

const WhatsAppIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke={TEXT_SECONDARY} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function avatarColor(name: string): string {
  const colors = ['#001E40', '#1858D6', '#7B2FBE', '#00A86B', '#E85D04', '#C77DFF'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'pro'] as const;
const SKILL_LABELS = { beginner: 'BEGINNER', intermediate: 'INTER', advanced: 'ADVANCED', pro: 'PRO' };
const SKILL_COLORS = { beginner: '#9ACBFF', intermediate: '#1858D6', advanced: '#001E40', pro: '#FFB703' };

function SkillBar({ level }: { level: string | undefined }) {
  const idx = SKILL_LEVELS.indexOf(level as any);
  const active = idx >= 0 ? idx : -1;
  return (
    <View style={sk.row}>
      {SKILL_LEVELS.map((lvl, i) => (
        <View key={lvl} style={sk.item}>
          <View style={[sk.dot, i <= active ? { backgroundColor: SKILL_COLORS[lvl] } : sk.dotInactive]}>
            {i <= active && <View style={sk.dotInner} />}
          </View>
          <Text style={[sk.label, i === active && { color: SKILL_COLORS[lvl], fontWeight: '800' }]}>
            {SKILL_LABELS[lvl]}
          </Text>
          {i < SKILL_LEVELS.length - 1 && (
            <View style={[sk.connector, i < active ? { backgroundColor: BLUE } : sk.connectorInactive]} />
          )}
        </View>
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  item: { alignItems: 'center', flex: 1, position: 'relative' },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  dotInactive: { backgroundColor: BORDER },
  dotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: WHITE },
  connector: {
    position: 'absolute', top: 8, left: '50%', right: '-50%',
    height: 2, backgroundColor: BLUE,
  },
  connectorInactive: { backgroundColor: BORDER },
  label: { fontSize: 9, fontWeight: '600', color: TEXT_TERTIARY, letterSpacing: 0.8, textAlign: 'center' },
});

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, last = false }: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  last?: boolean;
}) {
  if (!value) return null;
  return (
    <View style={[s.infoRow, !last && s.infoRowBorder]}>
      <View style={s.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Setting Row ──────────────────────────────────────────────────────────────

function SettingRow({ icon, label, onPress, last = false, danger = false }: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.settingRow, !last && s.settingRowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={s.settingIcon}>{icon}</View>
      <Text style={[s.settingLabel, danger && { color: RED }]}>{label}</Text>
      <ChevronIcon />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user, logout } = useAuthStore();
  const [whatsapp, setWhatsapp] = useState(user?.whatsappOptedIn ?? true);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  if (!user) return null;

  const displayName = user.displayName || user.fullName || 'Player';
  const initials = getInitials(displayName);
  const bgColor = avatarColor(displayName);
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const cityState = [user.city, user.state].filter(Boolean).join(', ');
  const genderLabel = user.gender
    ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1)
    : undefined;

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-restricted-globals
      if (confirm('Are you sure you want to log out?')) logout();
    } else {
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive', onPress: logout },
        ]
      );
    }
  };

  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      setDeleting(false);
      logout();
    } catch (err: any) {
      setDeleting(false);
      const msg = err?.response?.data?.message ?? 'Failed to delete account';
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-restricted-globals
        alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-restricted-globals
      if (confirm('This will permanently delete your account, all your tournament data, and ratings. This action cannot be undone. Are you sure?')) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Account',
        'This will permanently delete your account, all your tournament data, and ratings. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Forever', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const toggleWhatsapp = async (val: boolean) => {
    setWhatsapp(val);
    setSavingWhatsapp(true);
    try {
      await authApi.updateProfile({ whatsappOptedIn: val });
    } catch {
      setWhatsapp(!val); // revert on error
    } finally {
      setSavingWhatsapp(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>

        {/* ── HERO HEADER ── */}
        <View style={s.hero}>
          {/* Avatar */}
          <View style={[s.avatar, { backgroundColor: bgColor }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>

          {/* Badges row */}
          <View style={s.heroBadges}>
            {user.isVerified && (
              <View style={s.verifiedBadge}>
                <Text style={s.verifiedText}>{'\u2713'} VERIFIED</Text>
              </View>
            )}
            <View style={[s.roleBadge, user.role === 'organizer' && s.roleBadgeOrg]}>
              <Text style={s.roleText}>{user.role.toUpperCase()}</Text>
            </View>
          </View>

          {/* Name */}
          <Text style={s.heroName}>{displayName}</Text>
          {user.displayName && user.fullName !== user.displayName && (
            <Text style={s.heroFullName}>{user.fullName}</Text>
          )}

          {/* City */}
          {!!cityState && (
            <Text style={s.heroCity}>{'\uD83D\uDCCD'} {cityState}</Text>
          )}

          {/* Member since */}
          <Text style={s.heroMember}>Member since {memberSince}</Text>

          {/* Edit button */}
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.85}
          >
            <EditIcon />
            <Text style={s.editBtnText}>EDIT PROFILE</Text>
          </TouchableOpacity>
        </View>

        {/* ── SKILL LEVEL ── */}
        {user.selfReportedSkill && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardLabel}>SKILL LEVEL</Text>
              <View style={[s.skillBadge, { backgroundColor: SKILL_COLORS[user.selfReportedSkill] + '22' }]}>
                <Text style={[s.skillBadgeText, { color: SKILL_COLORS[user.selfReportedSkill] }]}>
                  {user.selfReportedSkill.toUpperCase()}
                </Text>
              </View>
            </View>
            <SkillBar level={user.selfReportedSkill} />
            <Text style={s.skillNote}>Self-reported · Based on your assessment</Text>
          </View>
        )}

        {/* ── ACCOUNT INFO ── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>ACCOUNT INFO</Text>
          <InfoRow icon={<PhoneIcon />} label="Phone" value={user.phone} />
          <InfoRow icon={<MailIcon />}  label="Email" value={user.email} />
          <InfoRow icon={<MapPinIcon />} label="Location" value={cityState || undefined} />
          <InfoRow icon={<UserIcon />}  label="Gender"  value={genderLabel} />
          {user.bio ? (
            <View style={[s.infoRow]}>
              <View style={s.infoIcon}><UserIcon /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>Bio</Text>
                <Text style={[s.infoValue, { lineHeight: 20 }]}>{user.bio}</Text>
              </View>
            </View>
          ) : null}
          <InfoRow
            icon={<UserIcon />}
            label="User ID"
            value={user.id.slice(0, 8).toUpperCase() + '\u2026'}
            last
          />
        </View>

        {/* ── PREFERENCES ── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>PREFERENCES</Text>
          <View style={s.prefRow}>
            <View style={s.prefLeft}>
              <View style={s.infoIcon}><WhatsAppIcon /></View>
              <View style={{ marginLeft: 10 }}>
                <Text style={s.prefTitle}>WhatsApp Notifications</Text>
                <Text style={s.prefSub}>Match updates, results & reminders</Text>
              </View>
            </View>
            <Switch
              value={whatsapp}
              onValueChange={toggleWhatsapp}
              disabled={savingWhatsapp}
              trackColor={{ false: '#E2E8F0', true: BLUE + 'AA' }}
              thumbColor={whatsapp ? BLUE : '#94A3B8'}
            />
          </View>
        </View>

        {/* ── SETTINGS ── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>SETTINGS</Text>
          <SettingRow
            icon={<StatsIcon />}
            label="My Stats"
            onPress={() =>
              navigation.navigate('MyEventsTab', {
                screen: 'PlayerProfile',
                params: { playerId: user.id },
              })
            }
          />
          <SettingRow icon={<EditIcon />}   label="Edit Profile"       onPress={() => navigation.navigate('EditProfile')} />
          <SettingRow icon={<BellIcon />}   label="Notifications"      onPress={() => {}} />
          <SettingRow icon={<ShieldIcon />} label="Privacy & Security" onPress={() => {}} />
          <SettingRow icon={<HelpIcon />}   label="Help & Support"     onPress={() => Linking.openURL('mailto:aditya.patki@crescendotranscriptions.com')} last />
        </View>

        {/* ── APP INFO ── */}
        <View style={s.appInfo}>
          <Text style={s.appName}>YOIDEN</Text>
          <Text style={s.appVersion}>Version 1.0.0 · Built for pickleball</Text>
        </View>

        {/* ── LOGOUT ── */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <LogoutIcon />
          <Text style={s.logoutText}>LOG OUT</Text>
        </TouchableOpacity>

        {/* ── DELETE ACCOUNT ── */}
        <TouchableOpacity
          style={s.deleteBtn}
          onPress={handleDeleteAccount}
          activeOpacity={0.8}
          disabled={deleting}
        >
          <Text style={s.deleteText}>
            {deleting ? 'Deleting...' : 'Delete My Account'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#E2E8F0',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '900',
    color: WHITE,
    letterSpacing: -1,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  verifiedBadge: {
    backgroundColor: GREEN + '33',
    borderWidth: 1,
    borderColor: GREEN + '55',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: GREEN,
    letterSpacing: 1,
  },
  roleBadge: {
    backgroundColor: INPUT_BG,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleBadgeOrg: {
    backgroundColor: BLUE + '33',
    borderWidth: 1,
    borderColor: BLUE + '55',
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 1.2,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: -0.5,
    marginBottom: 2,
    textAlign: 'center',
  },
  heroFullName: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    marginBottom: 6,
  },
  heroCity: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  heroMember: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_TERTIARY,
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 1.5,
  },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_TERTIARY,
    letterSpacing: 2,
  },
  skillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  skillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  skillNote: {
    fontSize: 10,
    fontWeight: '500',
    color: TEXT_TERTIARY,
    marginTop: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: INPUT_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },

  // Preferences
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  prefTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  prefSub: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },

  // Settings
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  settingIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: INPUT_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },

  // App info
  appInfo: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 8,
  },
  appName: {
    fontSize: 13,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 4,
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    letterSpacing: 0.3,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: RED + '44',
    backgroundColor: RED + '12',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '800',
    color: RED,
    letterSpacing: 2,
  },
  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 12,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },
});
