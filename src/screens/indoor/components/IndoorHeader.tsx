import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '../indoorTheme';

export function IndoorHeader({ onBack, title, right }: {
  onBack?: () => void; title?: string; right?: React.ReactNode;
}) {
  return (
    <View style={s.bar}>
      <View style={s.left}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={s.back}><Text style={s.backTxt}>‹</Text></Pressable>
        ) : (
          <Image source={require('../../../../assets/name_logo.png')} style={s.logo} resizeMode="contain" />
        )}
        {title ? <Text style={s.title} numberOfLines={1}>{title}</Text> : null}
      </View>
      {right ? <View>{right}</View> : null}
      <LinearGradient colors={[ '#001E40', '#2196F3', '#06D6A0' ]} start={{x:0,y:0}} end={{x:1,y:0}}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 }} />
    </View>
  );
}
const s = StyleSheet.create({
  bar: { height: 56, backgroundColor: T.bg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  logo: { width: 104, height: 28 },
  back: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  backTxt: { color: T.navy, fontSize: 30, lineHeight: 30, fontWeight: '700', marginTop: -4 },
  title: { color: T.navy, fontFamily: T.head, fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, flex: 1 },
});
