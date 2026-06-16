import React from 'react';
import { Platform, View, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YColors } from '../../config/yoiden';
import { YMono } from './YText';

type TabId = 'home' | 'play' | 'book' | 'fantasy' | 'me';

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
    // Pickleball paddle silhouette — racket head + handle
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 3a6 6 0 0 1 6 6c0 3-2 5.5-5 5.9V20a1 1 0 0 1-1 1h0a1 1 0 0 1-1-1v-5.1C8 14.5 6 12 6 9a6 6 0 0 1 6-6z" {...stroke} />
        <Circle cx={10} cy={9} r={0.6} fill={color} />
        <Circle cx={14} cy={9} r={0.6} fill={color} />
        <Circle cx={12} cy={11} r={0.6} fill={color} />
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
  if (id === 'fantasy') {
    // Cleaner trophy
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M8 4h8v5a4 4 0 0 1-8 0V4z" {...stroke} />
        <Path d="M5 5h3M16 5h3M5 5a2 2 0 0 0 3 2M19 5a2 2 0 0 1-3 2" {...stroke} />
        <Path d="M9 19h6M12 14v5" {...stroke} />
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

const TAB_META: { id: TabId; label: string }[] = [
  { id: 'home',    label: 'HOME' },
  { id: 'play',    label: 'PLAY' },
  { id: 'book',    label: 'BOOK' },
  { id: 'fantasy', label: 'FANTASY' },
  { id: 'me',      label: 'ME' },
];

const routeToTab = (route: string): TabId => {
  const lower = route.toLowerCase();
  if (lower.includes('home'))    return 'home';
  if (lower.includes('play'))    return 'play';
  if (lower.includes('book'))    return 'book';
  if (lower.includes('fantasy')) return 'fantasy';
  return 'me';
};

export const YTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index].name;
  const active = routeToTab(activeRoute);

  const onTabPress = (id: TabId) => {
    const target = state.routes.find((r) => routeToTab(r.name) === id);
    if (target) navigation.navigate(target.name);
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.row}>
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
              <View style={styles.tabInner}>
                <View
                  style={[
                    styles.iconWrap,
                    isActive && {
                      backgroundColor: 'rgba(24,88,214,0.10)',
                    },
                  ]}
                >
                  <TabIcon
                    id={t.id}
                    color={isActive ? YColors.accent : YColors.ink2}
                    active={isActive}
                    size={22}
                  />
                </View>
                <YMono
                  size={9}
                  bold={isActive}
                  color={isActive ? YColors.accent : YColors.ink2}
                  style={{ letterSpacing: 1.2, marginTop: 4 }}
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
    width: 40,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
