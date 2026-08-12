import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeIcon, ExploreIcon, CalendarIcon, ProfileIcon } from './TabIcons';

const NAVY = '#001E40';
const BLUE_ACCENT = '#1858D6';

type TabItem = {
  key: string;
  label: string;
  center: boolean;
  Icon: React.FC<{ size?: number; color?: string; strokeWidth?: number }>;
};

// Tournament mode: only Home + Profile shown. MyEvents/Discover tabs are
// still registered in the Tab.Navigator (so deep-links like League Management
// → MyEventsTab → LeagueDashboard keep working), but hidden from the bar.
const TABS: TabItem[] = [
  { key: 'HomeTab',     label: 'Home',    center: false, Icon: HomeIcon    },
  { key: 'ProfileTab',  label: 'Profile', center: false, Icon: ProfileIcon },
];

export const FloatingTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const currentRouteName = state.routes[state.index]?.name;
  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom, backgroundColor: '#FFFFFF' }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {TABS.map((tab) => {
          // Match focus by route name (not array index) — TABS array is a subset
          // of registered Tab.Screens, so positional matching would be wrong.
          const isFocused = currentRouteName === tab.key;
          // Look up the actual route key from the navigator state for the tabPress event.
          const routeKey = state.routes.find((r) => r.name === tab.key)?.key;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: routeKey,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.key);
            }
          };

          // ─── CENTER BUTTON ───
          if (tab.center) {
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.centerWrapper}
                onPress={onPress}
                activeOpacity={0.85}
              >
                <View style={[styles.centerBtn, isFocused && styles.centerBtnActive]}>
                  <tab.Icon size={26} color="#FFFFFF" strokeWidth={2} />
                </View>
                <Text style={[styles.centerLabel, isFocused && styles.centerLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          }

          // ─── REGULAR TAB ───
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                <tab.Icon
                  size={22}
                  color={isFocused ? NAVY : '#94A3B8'}
                  strokeWidth={isFocused ? 2.2 : 1.6}
                />
              </View>
              <Text style={[styles.label, isFocused && styles.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    height: 72,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },

  // ─── REGULAR TAB ───
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingTop: 4,
    gap: 4,
  },
  iconWrap: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  labelActive: {
    color: NAVY,
    fontWeight: '800',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: NAVY,
    position: 'absolute',
    bottom: 10,
  },

  // ─── CENTER ───
  centerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  centerBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  centerBtnActive: {
    backgroundColor: NAVY,
  },
  centerLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  centerLabelActive: {
    color: NAVY,
    fontWeight: '800',
  },
});
