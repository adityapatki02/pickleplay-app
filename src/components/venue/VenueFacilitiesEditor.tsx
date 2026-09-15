import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';

import { YColors, YUiText } from '../yoiden';
import { venuesApi } from '../../api/venues.api';
import type { Venue } from '../../types/booking.types';
import { AMENITY_CATALOGUE, AmenityIcon } from '../../constants/amenities';
import { notify } from '../../utils/notify';

/**
 * Owner-facing facilities picker. Writes `venues.amenities` (+ description),
 * which is what the public venue page renders under "Facilities".
 *
 * Save is explicit rather than per-tap: toggling is cheap and reversible, and
 * one PATCH per chip would fire a request every time the owner changes their
 * mind mid-edit.
 */
export default function VenueFacilitiesEditor({
  venue,
  onSaved,
}: {
  venue: Venue;
  onSaved?: (v: Venue) => void;
}) {
  const initial: string[] = ((venue as any).amenities as string[]) ?? [];
  const initialDesc: string = ((venue as any).description as string) ?? '';

  const [selected, setSelected] = useState<string[]>(initial);
  const [description, setDescription] = useState(initialDesc);
  const [saving, setSaving] = useState(false);

  // Anything already on the venue that isn't in our catalogue still needs a
  // chip, or saving would silently drop it.
  const rows = useMemo(() => {
    const known = new Set(AMENITY_CATALOGUE.map((a) => a.key));
    const extra = initial
      .filter((k) => !known.has(k))
      .map((k) => ({ key: k, label: k.replace(/[_-]+/g, ' ') }));
    return [...AMENITY_CATALOGUE, ...extra];
  }, [initial]);

  const dirty =
    description !== initialDesc ||
    selected.length !== initial.length ||
    selected.some((k) => !initial.includes(k));

  const toggle = (key: string) =>
    setSelected((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    );

  const save = async () => {
    setSaving(true);
    try {
      const res: any = await venuesApi.update(venue.id, {
        amenities: selected,
        description: description.trim() || undefined,
      } as any);
      notify.success('Facilities updated');
      onSaved?.(res?.data?.data ?? res?.data ?? venue);
    } catch (e: any) {
      notify.error(e?.response?.data?.message ?? 'Could not save facilities');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <YUiText size={13} weight={900} color={YColors.ink} style={styles.heading}>
        Facilities
      </YUiText>
      <YUiText size={11} color={YColors.ink3} style={{ marginTop: 3 }}>
        Shown on your venue page. Tap to add or remove.
      </YUiText>

      <View style={styles.grid}>
        {rows.map(({ key, label }) => {
          const on = selected.includes(key);
          return (
            <Pressable
              key={key}
              onPress={() => toggle(key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={label}
              style={[styles.chip, on && styles.chipOn]}
            >
              <AmenityIcon name={key} size={16} color={on ? '#fff' : YColors.ink3} />
              <YUiText
                size={12}
                weight={700}
                color={on ? '#fff' : YColors.ink2}
                style={{ marginLeft: 7, flexShrink: 1 }}
              >
                {label}
              </YUiText>
            </Pressable>
          );
        })}
      </View>

      <YUiText size={11} weight={800} color={YColors.ink3} style={styles.subLabel}>
        ABOUT THIS VENUE
      </YUiText>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Surface, indoor/outdoor, anything players should know before they arrive."
        placeholderTextColor={YColors.ink3}
        multiline
        style={styles.input}
      />

      <Pressable
        onPress={save}
        disabled={!dirty || saving}
        style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnOff]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <YUiText size={13} weight={900} color="#fff" style={{ letterSpacing: 0.5 }}>
            {dirty ? 'SAVE FACILITIES' : 'SAVED'}
          </YUiText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 16,
    backgroundColor: YColors.bg2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  heading: { letterSpacing: 0.4, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: YColors.line2,
    backgroundColor: YColors.bg,
  },
  chipOn: { backgroundColor: YColors.accent, borderColor: YColors.accent },
  subLabel: { marginTop: 18, letterSpacing: 1 },
  input: {
    marginTop: 8,
    minHeight: 76,
    borderWidth: 1.5,
    borderColor: YColors.line2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: YColors.ink,
    backgroundColor: YColors.bg,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: 14,
    backgroundColor: YColors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnOff: { opacity: 0.45 },
});
