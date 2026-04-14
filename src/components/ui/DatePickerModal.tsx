import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';

const NAVY  = '#001E40';
const BLUE  = '#2196F3';
const BG    = '#F8F9FA';
const WHITE = '#FFFFFF';
const GRAY  = '#737780';
const BORDER = '#E1E3E4';
const { width: SW } = Dimensions.get('window');

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function ChevronLeft() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={NAVY} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ChevronRight() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={NAVY} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Format YYYY-MM-DD → "12 May 2026"
export function formatDisplayDate(iso: string): string {
  if (!iso || iso.length < 10) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface Props {
  visible: boolean;
  value: string;           // ISO: YYYY-MM-DD or ''
  label: string;
  minDate?: string;        // ISO: YYYY-MM-DD
  maxDate?: string;
  onConfirm: (iso: string) => void;
  onCancel: () => void;
}

export default function DatePickerModal({
  visible, value, label, minDate, maxDate, onConfirm, onCancel,
}: Props) {
  const today = new Date();

  // Parse initial value
  const initDate = value && value.length === 10 ? new Date(value + 'T00:00:00') : today;
  const [viewYear,  setViewYear]  = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());       // 0–11
  const [selected,  setSelected]  = useState<Date | null>(
    value && value.length === 10 ? new Date(value + 'T00:00:00') : null
  );

  const minD = minDate ? new Date(minDate + 'T00:00:00') : null;
  const maxD = maxDate ? new Date(maxDate + 'T00:00:00') : null;

  const isDisabled = (d: Date) => {
    if (minD && d < minD) return true;
    if (maxD && d > maxD) return true;
    return false;
  };

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const isSelected = (d: Date) =>
    selected !== null &&
    d.getDate() === selected.getDate() &&
    d.getMonth() === selected.getMonth() &&
    d.getFullYear() === selected.getFullYear();

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleConfirm = () => {
    if (!selected) return;
    const iso = `${selected.getFullYear()}-${String(selected.getMonth()+1).padStart(2,'0')}-${String(selected.getDate()).padStart(2,'0')}`;
    onConfirm(iso);
  };

  const handleOpen = () => {
    // When modal opens, sync view to current value
    const d = value && value.length === 10 ? new Date(value + 'T00:00:00') : today;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelected(value && value.length === 10 ? new Date(value + 'T00:00:00') : null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={handleOpen}
      onRequestClose={onCancel}
    >
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onCancel} />

      <View style={s.sheet}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Label */}
        <Text style={s.sheetLabel}>{label}</Text>

        {/* Month navigator */}
        <View style={s.monthNav}>
          <TouchableOpacity style={s.navBtn} onPress={prevMonth}>
            <ChevronLeft />
          </TouchableOpacity>
          <Text style={s.monthTitle}>
            {MONTHS[viewMonth]} {viewYear}
          </Text>
          <TouchableOpacity style={s.navBtn} onPress={nextMonth}>
            <ChevronRight />
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View style={s.dayHeaders}>
          {DAYS.map(d => (
            <Text key={d} style={s.dayHeader}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={s.grid}>
          {cells.map((cell, i) => {
            if (!cell) return <View key={`e-${i}`} style={s.cell} />;
            const dis = isDisabled(cell);
            const sel = isSelected(cell);
            const tod = isToday(cell);
            return (
              <TouchableOpacity
                key={`d-${cell.getDate()}`}
                style={[s.cell, sel && s.cellSelected, !sel && tod && s.cellToday]}
                onPress={() => !dis && setSelected(cell)}
                disabled={dis}
                activeOpacity={0.7}
              >
                <Text style={[
                  s.cellText,
                  sel && s.cellTextSelected,
                  !sel && tod && s.cellTextToday,
                  dis && s.cellTextDisabled,
                ]}>
                  {cell.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected display */}
        <View style={s.selectedRow}>
          <Text style={s.selectedLabel}>Selected: </Text>
          <Text style={s.selectedValue}>
            {selected ? formatDisplayDate(
              `${selected.getFullYear()}-${String(selected.getMonth()+1).padStart(2,'0')}-${String(selected.getDate()).padStart(2,'0')}`
            ) : '—'}
          </Text>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
            <Text style={s.cancelText}>CANCEL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.confirmBtn, !selected && s.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!selected}
          >
            <Text style={s.confirmText}>CONFIRM</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Trigger button (use this in forms) ──────────────────────────────────────

export function DateField({
  label,
  value,
  onPress,
  error,
  hint,
  required,
}: {
  label: string;
  value: string;
  onPress: () => void;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  const hasValue = value && value.length === 10;
  return (
    <View style={df.container}>
      <Text style={df.label}>
        {label}{required && <Text style={{ color: '#BA1A1A' }}> *</Text>}
      </Text>
      <TouchableOpacity
        style={[df.btn, error ? df.btnError : null]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <View style={df.calIconBox}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <View />
            <Path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke={hasValue ? NAVY : GRAY} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={[df.btnText, !hasValue && df.btnPlaceholder]}>
          {hasValue ? formatDisplayDate(value) : 'Tap to select date'}
        </Text>
        <Text style={df.arrow}>›</Text>
      </TouchableOpacity>
      {error ? (
        <Text style={df.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={df.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const df = StyleSheet.create({
  container: { marginBottom: 14 },
  label: {
    fontSize: 10, fontWeight: '800', color: GRAY,
    letterSpacing: 1.8, marginBottom: 7,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WHITE, borderWidth: 1.5, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    minHeight: 50,
  },
  btnError: { borderColor: '#BA1A1A' },
  calIconBox: { marginRight: 10 },
  btnText: { flex: 1, fontSize: 15, fontWeight: '600', color: NAVY },
  btnPlaceholder: { color: '#B0B3BA', fontWeight: '500' },
  arrow: { fontSize: 20, color: GRAY, marginLeft: 4 },
  errorText: { fontSize: 11, color: '#BA1A1A', fontWeight: '600', marginTop: 5 },
  hintText:  { fontSize: 11, color: GRAY, marginTop: 5 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL_SIZE = Math.floor((SW - 48) / 7);

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 36,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: BORDER, alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  sheetLabel: {
    fontSize: 11, fontWeight: '800', color: GRAY,
    letterSpacing: 2, textAlign: 'center',
    marginBottom: 12, marginTop: 4,
  },
  monthNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: BG, alignItems: 'center', justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 17, fontWeight: '800', color: NAVY, letterSpacing: -0.3,
  },
  dayHeaders: {
    flexDirection: 'row', marginBottom: 6,
  },
  dayHeader: {
    width: CELL_SIZE, textAlign: 'center',
    fontSize: 11, fontWeight: '700', color: GRAY, letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  cellSelected: {
    backgroundColor: NAVY, borderRadius: CELL_SIZE / 2,
  },
  cellToday: {
    borderWidth: 1.5, borderColor: BLUE, borderRadius: CELL_SIZE / 2,
  },
  cellText: {
    fontSize: 14, fontWeight: '600', color: NAVY,
  },
  cellTextSelected: {
    color: WHITE, fontWeight: '800',
  },
  cellTextToday: {
    color: BLUE, fontWeight: '800',
  },
  cellTextDisabled: {
    color: BORDER,
  },
  selectedRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 12, marginBottom: 16,
    backgroundColor: BG, borderRadius: 10, paddingVertical: 10,
  },
  selectedLabel: { fontSize: 12, fontWeight: '600', color: GRAY },
  selectedValue: { fontSize: 14, fontWeight: '800', color: NAVY },
  actions: {
    flexDirection: 'row', gap: 10,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: BORDER, alignItems: 'center',
  },
  cancelText: {
    fontSize: 12, fontWeight: '800', color: GRAY, letterSpacing: 1.5,
  },
  confirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: NAVY, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: BORDER },
  confirmText: {
    fontSize: 12, fontWeight: '800', color: WHITE, letterSpacing: 1.5,
  },
});
