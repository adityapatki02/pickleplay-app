import React from 'react';
import { Platform, View, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YColors } from '../../config/yoiden';
import { IS_LEAGUE_KIOSK } from '../../config/appMode';
import { YMono } from './YText';

type TabId = 'home' | 'play' | 'book' | 'me';

const TabIcon: React.FC<{ id: TabId; color: string; active: boolean; size?: number }> = ({
  id,
  color,
  active,
  size = 22,
}) => {
  const sw = active ? 2.2 : 1.8;
  const stroke = {
    stroke: color,
    strokeWidth: sw,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (id === 'home') {
    // Minimal house: clean roof + base, no door notch
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5z" {...stroke} />
      </Svg>
    );
  }
  if (id === 'play') {
    // Events — trophy (Lucide)
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978" {...stroke} />
        <Path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978" {...stroke} />
        <Path d="M18 9h1.5a1 1 0 0 0 0-5H18" {...stroke} />
        <Path d="M4 22h16" {...stroke} />
        <Path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" {...stroke} />
        <Path d="M6 9H4.5a1 1 0 0 1 0-5H6" {...stroke} />
      </Svg>
    );
  }
  if (id === 'book') {
    // Calendar — court booking
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z" {...stroke} />
        <Path d="M4 10h16M8 4v3M16 4v3" {...stroke} />
      </Svg>
    );
  }
  // Me — clean head + shoulders
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={3.5} {...stroke} />
      <Path d="M5 20c1.2-3.5 3.8-5 7-5s5.8 1.5 7 5" {...stroke} />
    </Svg>
  );
};

// Full app surfaces all five tabs. The league-kiosk build shows only HOME —
// the other stacks stay registered so any existing navigate() calls still
// resolve, they're just not shown as tabs on that single-tournament site.
// The app ships a 4-tab bar: HOME · EVENTS · BOOK · ME.
const ALL_TABS: { id: TabId; label: string }[] = [
  { id: 'home', label: 'HOME' },
  { id: 'play', label: 'EVENTS' },
  { id: 'book', label: 'BOOK' },
  { id: 'me',   label: 'ME' },
];
const TAB_META = IS_LEAGUE_KIOSK ? ALL_TABS.filter((t) => t.id === 'home') : ALL_TABS;

const routeToTab = (route: string): TabId => {
  const lower = route.toLowerCase();
  if (lower.includes('home'))    return 'home';
  if (lower.includes('play'))    return 'play';
  if (lower.includes('book'))    return 'book';
  return 'me';
};

// Root screen of each tab's stack — pressing an already-active tab resets its
// stack back to this screen (so HOME from a pushed detail like the league page
// returns to the Home screen instead of doing nothing).
const TAB_ROOT: Record<TabId, string> = {
  home:    'Home',
  play:    'Play',
  book:    'Book',
  me:      'Me',
};

export const YTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index].name;
  const active = routeToTab(activeRoute);

  const onTabPress = (id: TabId) => {
    const target = state.routes.find((r) => routeToTab(r.name) === id);
    if (!target) return;
    // A tab tap always lands on that tab's ROOT screen. Without this, a deep
    // screen left on a tab's stack (e.g. a league opened from Home) stays on
    // top, so switching away and tapping Home would reopen the league instead
    // of showing Home.
    const go = navigation.navigate as (name: string, params?: object) => void;
    go(target.name, { screen: TAB_ROOT[id] });
  };

  // Single-tournament kiosk shows one tab, so the bar is slimmed down.
  const compact = IS_LEAGUE_KIOSK;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, compact ? 4 : 12) }]}>
      <View style={[styles.row, compact && { height: 46 }]}>
        {TAB_META.map((t) => {
          const isActive = t.id === active;
          return (
            <Pressable
              key={t.id}
              onPress={() => onTabPress(t.id)}
              style={styles.tab}
              hitSlop={4}
            >
              {/* Top accent bar in accent color when active */}
              <View
                style={[
                  styles.indicator,
                  { backgroundColor: isActive ? YColors.accent : 'transparent' },
                ]}
              />
              <View style={[styles.tabInner, compact && { paddingTop: 1 }]}>
                <View
                  style={[
                    styles.iconWrap,
                    compact && { width: 34, height: 22 },
                    isActive && {
                      backgroundColor: 'rgba(24,88,214,0.10)',
                    },
                  ]}
                >
                  <TabIcon
                    id={t.id}
                    color={isActive ? YColors.accent : YColors.ink2}
                    active={isActive}
                    size={compact ? 18 : 28}
                  />
                </View>
                <YMono
                  size={compact ? 8 : 9}
                  bold={isActive}
                  color={isActive ? YColors.accent : YColors.ink2}
                  style={{ letterSpacing: 1.2, marginTop: compact ? 1 : 1 }}
                >
                  {t.label}
                </YMono>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: YColors.line2,
    elevation: 8,
    ...Platform.select({
      web: { boxShadow: '0 -2px 12px rgba(10,10,11,0.04)' } as object,
      default: {
        shadowColor: '#0A0A0B',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
    }),
  },
  row: {
    flexDirection: 'row',
    height: 72,
  },
  tab: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  indicator: {
    height: 3,
    width: '100%',
  },
  tabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  iconWrap: {
    width: 50,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
