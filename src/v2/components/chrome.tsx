// App chrome: the navy top bar (logo + search, or back + title), the bottom
// tab bar and the page wrapper that keeps content readable on wide screens.
import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { C, MAX_W, body, head, label } from '../theme';
import { Mark, Wordmark } from './wordmark';
import { useHasUnread } from '../store/notifications';
import { useNow } from '../hooks';
import { BellIcon, BookmarkIcon, ChevronLeft, HomeIcon, SearchIcon, TrophyIcon, UserIcon } from './icons';

/** The Yoiden icon mark and wordmark, white on the navy bar (as on yoiden.com). */
export function Logo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Mark height={26} />
      <Wordmark height={24} />
    </View>
  );
}

/** The bell on Home's top bar, with a lime dot when something is new. */
function Bell() {
  const nav = useNavigation<any>();
  const unread = useHasUnread(useNow());
  return (
    <Pressable onPress={() => nav.navigate('Notifications')} hitSlop={10} accessibilityLabel="Notifications" style={s.bell}>
      <BellIcon size={21} />
      {unread && <View style={s.bellDot} />}
    </Pressable>
  );
}

/**
 * Navy top bar. Home shows the logo and a search field; inner screens show a
 * back arrow and a title. `right` adds actions (follow, share).
 */
export function AppHeader({
  title,
  back,
  right,
  search,
}: {
  title?: string;
  back?: boolean;
  right?: React.ReactNode;
  search?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  return (
    <View style={[s.header, { paddingTop: insets.top + 10, overflow: 'hidden' }]}>
      {search && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ position: 'absolute', top: -40, bottom: -40, right: 78, width: 14, backgroundColor: C.accent, transform: [{ skewX: '-20deg' }] }} />
        <View style={{ position: 'absolute', top: -40, bottom: -40, right: 32, width: 34, backgroundColor: C.hl, transform: [{ skewX: '-20deg' }] }} />
      </View>}
      <View style={s.inner}>
        <View style={s.row}>
          {back ? (
            <Pressable onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs'))} hitSlop={10} style={s.back}>
              <ChevronLeft size={22} />
            </Pressable>
          ) : !title ? (
            <Logo />
          ) : null}
          {title ? (
            <Text style={[head(back ? 19 : 26, C.white), { flex: 1 }]} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {right}
          {search && <Bell />}
        </View>
        {search && (
          <Pressable onPress={() => nav.navigate('Search')} style={s.search}>
            <SearchIcon size={16} color={C.mute} />
            <Text style={body(14, C.mute)}>Search events, teams, players</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Scrolling page body on the light grey page colour, centred on wide screens. */
export function Page({
  children,
  onRefresh,
  refreshing = false,
  padded = true,
}: {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  padded?: boolean;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: C.page }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {/* padded: a 16pt side margin for plain pages; unpadded pages (Home, event pages) run banners edge to edge and set their own margins. */}
      <View style={[s.column, padded && { paddingHorizontal: 16, paddingTop: 4 }]}>{children}</View>
    </ScrollView>
  );
}

const TABS: { name: string; label: string; Icon: typeof HomeIcon }[] = [
  { name: 'HomeTab', label: 'Home', Icon: HomeIcon },
  { name: 'EventsTab', label: 'Events', Icon: TrophyIcon },
  { name: 'MyEventsTab', label: 'My events', Icon: BookmarkIcon },
  { name: 'MeTab', label: 'Me', Icon: UserIcon },
];

/** White bottom bar: navy icon + label for the active tab, with a lime bar on top. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const t = TABS.find((x) => x.name === route.name)!;
        const on = state.index === i;
        return (
          <Pressable
            key={route.key}
            onPress={() => {
              if (!on) navigation.navigate(route.name);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            style={s.tab}
          >
            <View style={[s.tabTop, on && { backgroundColor: C.hl }]} />
            <t.Icon size={22} color={on ? C.bar : C.mute} />
            <Text style={body(11, on ? C.bar : C.mute, on ? 'bold' : 'medium')}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: C.bar, paddingBottom: 12 },
  inner: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16 },
  column: { width: '100%', maxWidth: MAX_W, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34 },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.barSoft },
  bellDot: { position: 'absolute', top: 7, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: C.hl, borderWidth: 1.5, borderColor: C.bar },
  back: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  search: { marginTop: 12, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabbar: { flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line },
  tab: { flex: 1, alignItems: 'center', paddingTop: 12, paddingBottom: 4, minHeight: 60, gap: 5 },
  tabTop: { position: 'absolute', top: 0, height: 3, width: 36, borderRadius: 2, backgroundColor: 'transparent' },
});
