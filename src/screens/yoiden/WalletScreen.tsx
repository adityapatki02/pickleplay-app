import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

import { YColors, YDisplay, YUiText, YMono, YEyebrow } from '../../components/yoiden';
import { walletApi, type WalletTxn } from '../../api/wallet.api';

const TYPE_LABEL: Record<string, string> = {
  promo_credit: 'Credit added',
  redemption: 'Used on a booking',
  reversal: 'Credit returned',
  expiry: 'Credit expired',
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function WalletScreen() {
  const nav = useNavigation<any>();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await walletApi.mine();
      const d = res?.data?.data;
      if (d) {
        setBalance(Number(d.balance ?? 0));
        setHistory(Array.isArray(d.history) ? d.history : []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch on focus: opening the wallet also releases credit held by a
  // checkout the player abandoned, so a stale balance would look wrong.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={YColors.ink2}
          />
        }
      >
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>

        <View style={styles.balanceCard}>
          <YEyebrow color="rgba(255,255,255,0.75)">YOUR BALANCE</YEyebrow>
          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 14, alignSelf: 'flex-start' }} />
          ) : (
            <YDisplay size={44} color="#fff" style={{ marginTop: 6 }}>
              ₹{balance}
            </YDisplay>
          )}
          <YUiText size={12} color="rgba(255,255,255,0.8)" style={{ marginTop: 6 }}>
            {balance > 0
              ? 'Applied at checkout on courts that accept credit.'
              : 'Credit from Yoiden shows up here.'}
          </YUiText>
        </View>

        <YUiText size={13} weight={900} color={YColors.ink} style={styles.sectionTitle}>
          Activity
        </YUiText>

        {loading ? null : history.length === 0 ? (
          <View style={styles.empty}>
            <YUiText size={13} color={YColors.ink3}>
              Nothing yet. Credit you receive will be listed here.
            </YUiText>
          </View>
        ) : (
          <View style={styles.list}>
            {history.map((t) => {
              const amt = Number(t.amount);
              const positive = amt > 0;
              return (
                <View key={t.id} style={styles.row}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <YUiText size={13} weight={700} color={YColors.ink}>
                      {TYPE_LABEL[t.type] ?? t.type}
                    </YUiText>
                    {t.reason ? (
                      <YUiText size={11} color={YColors.ink3} style={{ marginTop: 2 }}>
                        {t.reason}
                      </YUiText>
                    ) : null}
                    <YMono size={10} color={YColors.ink3} style={{ marginTop: 3 }}>
                      {fmtDate(t.createdAt)}
                    </YMono>
                  </View>
                  <YMono size={14} bold color={positive ? YColors.accent : YColors.ink2}>
                    {positive ? '+' : '−'}₹{Math.abs(amt)}
                  </YMono>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: { paddingHorizontal: 16, paddingTop: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2,
    alignItems: 'center', justifyContent: 'center',
  },
  balanceCard: {
    marginHorizontal: 16, marginTop: 14, padding: 20,
    borderRadius: 18, backgroundColor: YColors.accent,
  },
  sectionTitle: {
    marginHorizontal: 16, marginTop: 26,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  list: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: YColors.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: YColors.line2, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: YColors.line,
  },
  empty: {
    marginHorizontal: 16, marginTop: 12, padding: 20,
    backgroundColor: YColors.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: YColors.line2,
  },
});
