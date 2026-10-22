// Small auction pieces: the team mark (logo tile or coloured initials), the
// player initials avatar (auction pages show no photos) and the price tag.
// Same as the shared bits in the website's components/auction/auction-view.tsx.
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { C, F, head } from '../../theme';
import { formatMoney, initials, teamLogo, type AuctionTeam } from '../../data/auction-feed';

export function TeamMark({ team, size = 32 }: { team: AuctionTeam; size?: number }) {
  const logo = teamLogo(team);
  if (logo)
    return (
      <View style={[s.mark, s.logoTile, { width: size, height: size }]}>
        <Image source={{ uri: logo }} style={{ width: size * 0.86, height: size * 0.86 }} resizeMode="contain" />
      </View>
    );
  return (
    <View style={[s.mark, { width: size, height: size, backgroundColor: team.color ?? C.bar }]}>
      <Text style={{ fontFamily: F.bold, fontSize: Math.max(9, size * 0.32), color: C.white }}>{initials(team.name)}</Text>
    </View>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <View style={s.avatar}>
      <Text style={head(13, C.bar)}>{initials(name)}</Text>
    </View>
  );
}

export function Price({ value, top }: { value: number | null; top?: boolean }) {
  return (
    <View style={[s.price, top && { backgroundColor: C.bar }]}>
      <Text style={head(17, top ? C.hl : C.ink)} numberOfLines={1}>
        {formatMoney(value)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  mark: { borderRadius: 6, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoTile: { borderWidth: 1, borderColor: C.line, backgroundColor: C.white },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.page, alignItems: 'center', justifyContent: 'center' },
  price: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
});
