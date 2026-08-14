import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { YColors, YUiText } from './yoiden';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
type RangeKey = '7d' | '30d' | '60d' | '90d' | 'month';
type Daypart = 'all' | 'morning' | 'afternoon' | 'evening';

/**
 * Shared range (rolling days / calendar month) + daypart filter with a month-picker popup.
 * `params` → pass straight to the analytics API; `depKey` → use as a useEffect/useCallback dep;
 * `node` → render once inside the screen.
 */
export function useRangeFilter(init?: { month?: string; days?: number; daypart?: string }) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const initialKey: RangeKey = init?.month ? 'month' : init?.days ? (`${init.days}d` as RangeKey) : '30d';

  const [rangeKey, setRangeKey] = useState<RangeKey>(initialKey);
  const [selMonth, setSelMonth] = useState(init?.month || thisMonth);
  const [daypart, setDaypart] = useState<Daypart>((init?.daypart as Daypart) || 'all');
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(Number((init?.month || thisMonth).split('-')[0]));

  const params: any = {};
  if (rangeKey === 'month') params.month = selMonth; else params.days = Number(rangeKey.replace('d', ''));
  if (daypart !== 'all') params.daypart = daypart;
  const depKey = `${rangeKey}:${selMonth}:${daypart}`;

  const node = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center', paddingRight: 16 }}>
        {(['7d', '30d', '60d', '90d', 'month'] as const).map(k => {
          const active = rangeKey === k;
          const isMonth = k === 'month';
          const label = isMonth
            ? (active ? `${MONTHS[Number(selMonth.split('-')[1]) - 1]} ${selMonth.split('-')[0]}` : 'Month')
            : k.toUpperCase();
          return (
            <Pressable
              key={k}
              onPress={() => { setRangeKey(k); if (isMonth) { setPickerYear(Number(selMonth.split('-')[0])); setOpen(true); } }}
              style={[styles.rChip, active && styles.rChipOn, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}
            >
              <YUiText size={12} weight={active ? 800 : 600} color={active ? '#fff' : YColors.ink2}>{label}</YUiText>
              {isMonth && active && <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"><Path d="M6 9l6 6 6-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" /></Svg>}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.dpRow}>
        {(['all', 'morning', 'afternoon', 'evening'] as const).map(d => (
          <Pressable key={d} onPress={() => setDaypart(d)} style={[styles.dpChip, daypart === d && styles.dpChipOn]}>
            <YUiText size={11.5} weight={daypart === d ? 800 : 600} color={daypart === d ? YColors.accent : YColors.ink3}>{d === 'all' ? 'All day' : d.charAt(0).toUpperCase() + d.slice(1)}</YUiText>
          </Pressable>
        ))}
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.mpOverlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.mpPanel} onPress={() => {}}>
            <View style={styles.mpYearRow}>
              <Pressable onPress={() => setPickerYear(y => y - 1)} hitSlop={10} style={styles.monthArrow}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M15 6l-6 6 6 6" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" /></Svg>
              </Pressable>
              <YUiText size={17} weight={900} color={YColors.ink}>{pickerYear}</YUiText>
              <Pressable onPress={() => setPickerYear(y => Math.min(y + 1, now.getFullYear()))} hitSlop={10} disabled={pickerYear >= now.getFullYear()} style={[styles.monthArrow, pickerYear >= now.getFullYear() && { opacity: 0.3 }]}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M9 6l6 6 6-6" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" /></Svg>
              </Pressable>
            </View>
            <View style={styles.mpGrid}>
              {MONTHS.map((mn, i) => {
                const mm = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
                const disabled = mm > thisMonth;
                const active = mm === selMonth;
                return (
                  <Pressable key={mn} disabled={disabled} onPress={() => { setSelMonth(mm); setRangeKey('month'); setOpen(false); }} style={[styles.mpCell, active && styles.mpCellActive, disabled && { opacity: 0.3 }]}>
                    <YUiText size={13} weight={active ? 800 : 600} color={active ? '#fff' : YColors.ink}>{mn}</YUiText>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  return { params, depKey, node };
}

const styles = StyleSheet.create({
  rChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: YColors.line2, backgroundColor: YColors.bg },
  rChipOn: { backgroundColor: YColors.accent, borderColor: YColors.accent },
  dpRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  dpChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: YColors.bg3 },
  dpChipOn: { backgroundColor: 'rgba(24,88,214,0.13)' },
  monthArrow: { padding: 2 },
  mpOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 30 },
  mpPanel: { backgroundColor: YColors.bg2, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: YColors.line2 },
  mpYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 10 },
  mpGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  mpCell: { width: '31%', paddingVertical: 13, borderRadius: 10, backgroundColor: YColors.bg3, alignItems: 'center' },
  mpCellActive: { backgroundColor: YColors.accent },
});
