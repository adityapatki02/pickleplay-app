import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';

import { YColors, YUiText, YMono } from '../yoiden';
import { venuesApi } from '../../api/venues.api';
import { walletApi } from '../../api/wallet.api';
import type { Venue } from '../../types/booking.types';
import { notify } from '../../utils/notify';

/**
 * Wallet credit settings for a venue owner: the per-booking redemption cap, and
 * what Yoiden currently owes them for credit players have already spent here.
 *
 * The cap is the owner's dial. Yoiden reimburses every rupee redeemed, so the
 * cap is about how much discounting the venue wants on its courts, not about
 * protecting its takings.
 */
export default function VenueWalletSettings({ venue }: { venue: Venue }) {
  const initial = String(Number((venue as any).walletMaxRedeemPerBooking ?? 0) || 0);
  const [cap, setCap] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [owed, setOwed] = useState<{ outstanding: number; count: number } | null>(null);

  useEffect(() => {
    let live = true;
    walletApi
      .venueSettlements(venue.id)
      .then((res: any) => {
        const d = res?.data?.data;
        if (live && d) setOwed({ outstanding: Number(d.outstanding), count: d.outstandingBookings });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [venue.id]);

  const parsed = Number(cap);
  const valid = cap.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;
  const dirty = valid && String(parsed) !== initial;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await venuesApi.update(venue.id, { walletMaxRedeemPerBooking: parsed } as any);
      notify.success(
        parsed > 0 ? `Players can now redeem up to ₹${parsed} per booking` : 'Wallet credit turned off',
      );
    } catch (e: any) {
      notify.error(e?.response?.data?.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <YUiText size={13} weight={900} color={YColors.ink} style={styles.heading}>
        Wallet Credit
      </YUiText>
      <YUiText size={11} color={YColors.ink3} style={{ marginTop: 3 }}>
        Yoiden reimburses you in full for any credit players redeem here.
      </YUiText>

      <YUiText size={11} weight={800} color={YColors.ink3} style={styles.label}>
        MAX REDEEMABLE PER BOOKING
      </YUiText>
      <View style={styles.inputRow}>
        <YUiText size={16} weight={800} color={YColors.ink2}>₹</YUiText>
        <TextInput
          value={cap}
          onChangeText={(t) => setCap(t.replace(/[^0-9.]/g, ''))}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={YColors.ink3}
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
            <YUiText size={12} weight={900} color="#fff" style={{ letterSpacing: 0.4 }}>
              SAVE
            </YUiText>
          )}
        </Pressable>
      </View>
      <YUiText size={11} color={YColors.ink3} style={{ marginTop: 8 }}>
        {parsed > 0
          ? `A player booking a ₹500 slot would pay ₹${Math.max(0, 500 - parsed)} and redeem ₹${parsed}.`
          : 'Set to 0 — this court does not accept wallet credit.'}
      </YUiText>

      <View style={styles.owedBox}>
        <View style={{ flex: 1 }}>
          <YUiText size={11} weight={800} color={YColors.ink3} style={{ letterSpacing: 0.8 }}>
            YOIDEN OWES YOU
          </YUiText>
          <YUiText size={11} color={YColors.ink3} style={{ marginTop: 2 }}>
            {owed && owed.count > 0
              ? `${owed.count} booking${owed.count === 1 ? '' : 's'} · paid out weekly`
              : 'Nothing outstanding'}
          </YUiText>
        </View>
        <YMono size={20} bold color={owed && owed.outstanding > 0 ? YColors.accent : YColors.ink3}>
          ₹{owed ? owed.outstanding : 0}
        </YMono>
      </View>
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
  label: { marginTop: 16, marginBottom: 8, letterSpacing: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: YColors.line2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: YColors.ink,
    backgroundColor: YColors.bg,
  },
  saveBtn: {
    backgroundColor: YColors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnOff: { opacity: 0.4 },
  owedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: YColors.line,
  },
});
