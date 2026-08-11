import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { FantasyTrends } from '../api/fantasy.api';

/**
 * Share-optimised compact summary of fantasy trends. Rendered off-screen
 * and captured by html2canvas to produce a WhatsApp-shareable image.
 * Intentionally fixed-width (360px) so the output renders consistently
 * regardless of the viewport that hosts it.
 */

const NAVY = '#001E40';
const ORANGE = '#F59E0B';
const GOLD = '#FFB300';
const WHITE = '#FFFFFF';
const PURPLE = '#8B5CF6';
const BLUE = '#3B82F6';
const PINK = '#EC4899';
const TEAL = '#14B8A6';
const TEXT_SUB = '#64748B';
const TEXT_MUTED = '#94A3B8';
const BORDER = '#E2E8F0';

interface Props {
  trends: FantasyTrends;
  seasonLabel?: string;
  /** Footer line (league + dates). Defaults to SPPL branding; the SBPL screen
   *  passes its own so the shared component isn't hardcoded to one league. */
  footerLabel?: string;
}

/** Which colour each Dream Team category gets in the summary list.
 *  Covers BOTH formats' bucket keys — SPPL (teenBoys/m1/w1/…) and SBPL
 *  sbpl_15game (women13/women45/menA/menB/menC). The rows actually shown are
 *  driven by whichever buckets the /trends payload returns (see topByCategory),
 *  so this stays format-agnostic. */
const CATEGORY_META: Array<{ key: string; label: string; icon: string; color: string }> = [
  { key: 'kids',      label: 'Kids',       icon: '🧒', color: PURPLE },
  // SPPL buckets
  { key: 'teenBoys',  label: 'Teen Boys',  icon: '👦', color: ORANGE },
  { key: 'teenGirls', label: 'Teen Girls', icon: '👧', color: ORANGE },
  { key: 'm1',        label: 'Men 1',      icon: '🏅', color: BLUE },
  { key: 'w1',        label: 'Women 1',    icon: '🏅', color: PINK },
  { key: 'm2',        label: 'Men 2',      icon: '🏅', color: BLUE },
  { key: 'w2',        label: 'Women 2',    icon: '🏅', color: PINK },
  { key: 'm3',        label: 'Men 3',      icon: '🏅', color: BLUE },
  // SBPL (sbpl_15game) buckets
  { key: 'women13',   label: 'Women 1-3',  icon: '🏅', color: PINK },
  { key: 'women45',   label: 'Women 4-5',  icon: '🏅', color: PINK },
  { key: 'menA',      label: 'Men A',      icon: '🏅', color: BLUE },
  { key: 'menB',      label: 'Men B',      icon: '🏅', color: BLUE },
  { key: 'menC',      label: 'Men C',      icon: '🏅', color: BLUE },
];

export default function FantasyTrendsShareCard({ trends, seasonLabel = 'SPPL 2026', footerLabel = 'SPPL · MAY 1–3, 2026' }: Props) {
  const topChampion = trends.champions?.[0];
  // Tournament progression — show fan picks at every knockout stage so
  // viewers can spot their team at multiple points.
  const abQuals = (trends.abQualifiers || []).slice(0, 4);
  const cdQuals = (trends.cdQualifiers || []).slice(0, 4);
  const topSemis = (trends.semifinalists || []).slice(0, 4);
  const topFinalists = (trends.finalists || []).slice(0, 2);

  // Find the single most-picked player across all Dream Team buckets
  const mostPopularPlayer = (() => {
    let best: { playerName: string; bucket: string; count: number; pct: number } | null = null;
    for (const [bucket, picks] of Object.entries(trends.topPicks || {})) {
      const bucketMeta = CATEGORY_META.find((c) => c.key === bucket);
      for (const p of (picks || []) as any[]) {
        if (!best || p.count > best.count) {
          best = { playerName: p.playerName, bucket: bucketMeta?.label || bucket, count: p.count, pct: p.pct };
        }
      }
    }
    return best;
  })();

  // Top pick per category (1 per bucket) — driven by the buckets the payload
  // actually contains, so only the current format's categories are listed
  // (SBPL: kids/women13/women45/menA/menB/menC; SPPL: the SPPL set).
  const topByCategory = CATEGORY_META
    .filter((c) => !!(trends.topPicks && trends.topPicks[c.key]))
    .map((c) => ({ ...c, top: (trends.topPicks![c.key] || [])[0] || null }));

  return (
    <View style={s.card} collapsable={false}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.trophy}>🏆</Text>
        <Text style={s.headerTitle}>{seasonLabel.toUpperCase()}</Text>
        <Text style={s.headerSub}>FANTASY LEAGUE TRENDS</Text>
        <View style={s.divider} />
      </View>

      {/* ── Most Picked Champion ── */}
      {topChampion ? (
        <View style={[s.hero, { backgroundColor: '#FEF3C7', borderColor: GOLD }]}>
          <Text style={s.heroLabel}>🥇 MOST PICKED CHAMPION</Text>
          <Text style={s.heroName}>{topChampion.franchiseName}</Text>
          <Text style={[s.heroPct, { color: '#B45309' }]}>{topChampion.pct}% pick rate</Text>
        </View>
      ) : null}

      {/* ── Predicted Quarterfinalists (8 teams in 2 columns) ── */}
      {(abQuals.length > 0 || cdQuals.length > 0) ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>🏁 PREDICTED QUARTERFINALISTS</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Pool AB column */}
            <View style={{ flex: 1 }}>
              <Text style={s.poolHeader}>POOL AB</Text>
              {abQuals.length > 0 ? abQuals.map((f, i) => (
                <View key={f.franchiseId} style={s.poolRow}>
                  <Text style={[s.poolRank, { color: i === 0 ? GOLD : TEXT_MUTED }]}>{i + 1}.</Text>
                  <View style={s.poolNameWrap}>
                    <Text style={s.poolName} numberOfLines={1} ellipsizeMode="tail">{f.franchiseName}</Text>
                    <Text style={[s.poolPct, { color: NAVY }]}>{f.pct}%</Text>
                  </View>
                </View>
              )) : (
                <Text style={s.poolEmpty}>—</Text>
              )}
            </View>
            {/* Vertical separator */}
            <View style={{ width: 1, backgroundColor: BORDER }} />
            {/* Pool CD column */}
            <View style={{ flex: 1 }}>
              <Text style={s.poolHeader}>POOL CD</Text>
              {cdQuals.length > 0 ? cdQuals.map((f, i) => (
                <View key={f.franchiseId} style={s.poolRow}>
                  <Text style={[s.poolRank, { color: i === 0 ? GOLD : TEXT_MUTED }]}>{i + 1}.</Text>
                  <View style={s.poolNameWrap}>
                    <Text style={s.poolName} numberOfLines={1} ellipsizeMode="tail">{f.franchiseName}</Text>
                    <Text style={[s.poolPct, { color: NAVY }]}>{f.pct}%</Text>
                  </View>
                </View>
              )) : (
                <Text style={s.poolEmpty}>—</Text>
              )}
            </View>
          </View>
        </View>
      ) : null}

      {/* ── Top 4 Semifinalists ── */}
      {topSemis.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>🏆 PREDICTED SEMIFINALISTS (TOP 4)</Text>
          {topSemis.map((f, i) => (
            <View key={f.franchiseId} style={s.row}>
              <Text style={[s.rank, { color: i === 0 ? GOLD : '#CBD5E1' }]}>{i + 1}.</Text>
              <Text style={s.rowName} numberOfLines={1}>{f.franchiseName}</Text>
              <Text style={[s.rowPct, { color: NAVY }]}>{f.pct}%</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Top 2 Finalists ── */}
      {topFinalists.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>🥈 PREDICTED FINALISTS (TOP 2)</Text>
          {topFinalists.map((f, i) => (
            <View key={f.franchiseId} style={s.row}>
              <Text style={[s.rank, { color: i === 0 ? GOLD : '#CBD5E1' }]}>{i + 1}.</Text>
              <Text style={s.rowName} numberOfLines={1}>{f.franchiseName}</Text>
              <Text style={[s.rowPct, { color: NAVY }]}>{f.pct}%</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Fan Favorite Player ── */}
      {mostPopularPlayer ? (
        <View style={[s.hero, { backgroundColor: '#EEF2FF', borderColor: PURPLE }]}>
          <Text style={[s.heroLabel, { color: '#5B21B6' }]}>⭐ FAN FAVORITE PLAYER</Text>
          <Text style={s.heroName}>{mostPopularPlayer.playerName}</Text>
          <Text style={[s.heroPct, { color: PURPLE }]}>
            {mostPopularPlayer.bucket} · {mostPopularPlayer.pct}% pick rate
          </Text>
        </View>
      ) : null}

      {/* ── Top Pick Per Category ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>🎯 TOP PICK PER CATEGORY</Text>
        {topByCategory.map(({ key, label, color, top }) => (
          <View key={key} style={s.catRow}>
            <View style={[s.catBadge, { backgroundColor: color }]}>
              <Text style={s.catBadgeText}>{label}</Text>
            </View>
            <Text style={s.catPlayer} numberOfLines={1}>
              {top ? top.playerName : <Text style={s.catEmpty}>—</Text>}
            </Text>
            {top ? <Text style={s.catPct}>{top.pct}%</Text> : null}
          </View>
        ))}
      </View>

      {/* ── Footer ── */}
      <View style={s.footer}>
        <Text style={s.footerTitle}>🎾 {footerLabel}</Text>
        <Text style={s.footerSub}>Powered by Yoiden</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: WHITE,
    paddingBottom: 16,
    borderWidth: 2,
    borderColor: NAVY,
    borderRadius: 14,
    overflow: 'hidden',
  },
  // Header
  header: {
    backgroundColor: NAVY,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  trophy: { fontSize: 32, marginBottom: 2 },
  headerTitle: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  headerSub: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: GOLD,
    marginTop: 8,
    marginBottom: 6,
  },
  headerMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Hero cards
  hero: {
    marginTop: 14,
    marginHorizontal: 14,
    padding: 12,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroName: {
    // Reduced from 20 → 18 + lineHeight 22 + horizontal padding so html2canvas
    // doesn't clip the trailing letter on long names like "Khiladi Kitcheners"
    // or "Mivaan Tutwala". Long names also wrap to two lines if needed.
    fontSize: 18,
    fontWeight: '900',
    color: NAVY,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 6,
    alignSelf: 'stretch',
  },
  heroPct: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.3,
  },

  // Pool columns (Quarterfinalists). Each column is ~155px wide after
  // padding+separator, so name+rank+pct must compactly share that space.
  // Stacking pct under the name avoids truncation of long team names like
  // "Baazigar Baselines" or "Chaalbaaz Crushers".
  poolHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    marginBottom: 6,
  },
  poolRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
  },
  poolRank: {
    width: 14,
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 14,
  },
  poolNameWrap: {
    flex: 1,
    flexShrink: 1,
  },
  poolName: {
    fontSize: 11,
    fontWeight: '700',
    color: NAVY,
    lineHeight: 14,
  },
  poolPct: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  poolEmpty: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 6,
  },

  // Generic section
  section: {
    marginTop: 14,
    marginHorizontal: 14,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    minHeight: 22,
  },
  rank: {
    width: 20,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
  },
  rowName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: NAVY,
    lineHeight: 17,
  },
  rowPct: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },

  // Category rows. Explicit lineHeights prevent html2canvas from clipping
  // descender glyphs (g, p, y, j) at the bottom of player names.
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    minHeight: 22,
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: WHITE,
    letterSpacing: 0.4,
    lineHeight: 12,
  },
  catPlayer: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: NAVY,
    lineHeight: 16,
  },
  catEmpty: { color: TEXT_MUTED, fontStyle: 'italic', fontWeight: '400' },
  catPct: {
    fontSize: 11,
    fontWeight: '800',
    color: TEXT_SUB,
    marginLeft: 6,
    lineHeight: 16,
  },

  // Footer
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 1.2,
  },
  footerSub: {
    fontSize: 9,
    fontWeight: '600',
    color: TEXT_MUTED,
    letterSpacing: 0.8,
    marginTop: 2,
  },
});
