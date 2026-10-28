// The lime bar on top of every role mode (admin, scorer, captain). It names the mode and
// the event, and "View as public" leaves the mode for the public event page.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ClipboardIcon, GearIcon, UserIcon } from './icons';
import type { Role } from '../store/roles';
import { C, MAX_W, label } from '../theme';

export const MODE_NAME: Record<Role, string> = { admin: 'Admin mode', scorer: 'Scorer mode', captain: 'Captain mode' };

const ICON: Record<Role, (p: { size?: number; color?: string }) => React.ReactElement> = {
  admin: GearIcon,
  scorer: ClipboardIcon,
  captain: UserIcon,
};

export function ModeBar({ role, title, onPublic }: { role: Role; title: string; onPublic?: () => void }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const Icon = ICON[role];
  return (
    <View style={[s.bar, { paddingTop: insets.top + 8 }]}>
      <View style={s.inner}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={s.back} accessibilityLabel="Back">
          <ChevronLeft size={20} color={C.bar} />
        </Pressable>
        <Icon size={16} color={C.bar} />
        <Text style={[label(15, C.bar), { flex: 1 }]} numberOfLines={1}>
          {MODE_NAME[role]} · {title}
        </Text>
        <Pressable onPress={onPublic ?? (() => nav.goBack())} style={s.publicBtn} accessibilityRole="button">
          <Text style={label(13, C.hl)}>View as public</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: C.hl, paddingBottom: 10 },
  inner: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,30,64,0.08)' },
  publicBtn: { backgroundColor: C.bar, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7 },
});
