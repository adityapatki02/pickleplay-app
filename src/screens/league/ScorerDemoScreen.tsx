/**
 * ScorerDemoScreen — mock scorer interface for SPPL demos.
 *
 * Reachable via the "OPEN SCORER (DEMO)" button on the tie detail screen.
 * No backend wiring. Everything lives in component state.
 *
 * UX:
 *   - Big team-A / team-B score with explicit +/- buttons under each.
 *   - Undo walks back the most recent point.
 *   - Win at 15 (rally-point), win by 2 — first team to reach 15 with a
 *     2-point lead triggers the win overlay.
 *   - Reset starts a fresh game.
 *
 * Team names are passed in via route params (`homeName`, `awayName`,
 * `slotLabel`) so the demo can pick "any tie" from the tie detail and
 * the scorer opens with the right context.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { YColors, YFonts } from '../../config/yoiden';

type ScorerParams = {
  homeName?: string;
  awayName?: string;
  slotLabel?: string;        // e.g. "K & K", "W1 & M1"
  matchNo?: string;          // e.g. "MATCH 12"
  court?: string;            // e.g. "COURT 1"
};

const WIN_TARGET = 15;
const WIN_MARGIN = 2;

export default function ScorerDemoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params || {}) as ScorerParams;

  const homeName = params.homeName ?? 'TEAM A';
  const awayName = params.awayName ?? 'TEAM B';
  const slotLabel = params.slotLabel ?? 'GAME';
  const matchNo = params.matchNo ?? 'MATCH';
  const court = params.court ?? 'COURT 1';

  // Score state — history stores every point so undo works
  const [history, setHistory] = useState<Array<'home' | 'away'>>([]);

  const homeScore = useMemo(() => history.filter((p) => p === 'home').length, [history]);
  const awayScore = useMemo(() => history.filter((p) => p === 'away').length, [history]);

  const winner: 'home' | 'away' | null = useMemo(() => {
    if (homeScore >= WIN_TARGET && homeScore - awayScore >= WIN_MARGIN) return 'home';
    if (awayScore >= WIN_TARGET && awayScore - homeScore >= WIN_MARGIN) return 'away';
    return null;
  }, [homeScore, awayScore]);

  const addPoint = (team: 'home' | 'away') => {
    if (winner) return;
    setHistory((h) => [...h, team]);
  };

  /**
   * Remove the most-recent point that belongs to `team`.
   * If that team has no points, this is a no-op. Done this way so the
   * minus button always reduces the visible score by 1 without leaving
   * the history out of sync — important so the global UNDO still works
   * predictably afterwards.
   */
  const removePoint = (team: 'home' | 'away') => {
    if (winner) return;
    setHistory((h) => {
      for (let i = h.length - 1; i >= 0; i--) {
        if (h[i] === team) {
          return [...h.slice(0, i), ...h.slice(i + 1)];
        }
      }
      return h;
    });
  };

  const undo = () => {
    setHistory((h) => h.slice(0, -1));
  };

  const reset = () => {
    setHistory([]);
  };

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={YColors.bg} />

      {/* ── Top chrome ── */}
      <View style={s.topBar}>
        <View style={s.sideStripe} />
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={s.back}>← BACK</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      {/* ── Match meta ── */}
      <View style={s.meta}>
        <Text style={s.eyebrow}>{matchNo} · {court}</Text>
        <Text style={s.slotLabel}>{slotLabel}</Text>
      </View>

      {/* ── Score zone — explicit +/- buttons beneath each score ── */}
      <View style={s.scoreZone}>
        {/* Home panel */}
        <View style={[
          s.sidePanel,
          s.sidePanelLeft,
          winner === 'home' && s.winSideHome,
        ]}>
          <Text style={s.teamName} numberOfLines={2}>{homeName.toUpperCase()}</Text>
          <Text style={[
            s.score,
            winner === 'home' && s.scoreWin,
          ]}>{homeScore}</Text>

          {/* +/- row */}
          <View style={s.pmRow}>
            <TouchableOpacity
              style={[
                s.pmBtn,
                s.pmBtnMinus,
                (homeScore === 0 || !!winner) && s.pmBtnDisabled,
                winner === 'home' && s.pmBtnOnWinHome,
              ]}
              onPress={() => removePoint('home')}
              disabled={homeScore === 0 || !!winner}
              activeOpacity={0.7}
            >
              <Text style={[
                s.pmGlyph,
                (homeScore === 0 || !!winner) && s.pmGlyphDisabled,
                winner === 'home' && s.pmGlyphOnWin,
              ]}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.pmBtn,
                s.pmBtnPlus,
                !!winner && s.pmBtnDisabled,
                winner === 'home' && s.pmBtnOnWinHome,
              ]}
              onPress={() => addPoint('home')}
              disabled={!!winner}
              activeOpacity={0.85}
            >
              <Text style={[s.pmGlyph, s.pmGlyphOnInk]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.middleDivider}>
          <Text style={s.middleDash}>—</Text>
        </View>

        {/* Away panel */}
        <View style={[
          s.sidePanel,
          s.sidePanelRight,
          winner === 'away' && s.winSideAway,
        ]}>
          <Text style={s.teamName} numberOfLines={2}>{awayName.toUpperCase()}</Text>
          <Text style={[
            s.score,
            winner === 'away' && s.scoreWin,
          ]}>{awayScore}</Text>

          <View style={s.pmRow}>
            <TouchableOpacity
              style={[
                s.pmBtn,
                s.pmBtnMinus,
                (awayScore === 0 || !!winner) && s.pmBtnDisabled,
                winner === 'away' && s.pmBtnOnWinAway,
              ]}
              onPress={() => removePoint('away')}
              disabled={awayScore === 0 || !!winner}
              activeOpacity={0.7}
            >
              <Text style={[
                s.pmGlyph,
                (awayScore === 0 || !!winner) && s.pmGlyphDisabled,
                winner === 'away' && s.pmGlyphOnWin,
              ]}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.pmBtn,
                s.pmBtnPlus,
                !!winner && s.pmBtnDisabled,
                winner === 'away' && s.pmBtnOnWinAway,
              ]}
              onPress={() => addPoint('away')}
              disabled={!!winner}
              activeOpacity={0.85}
            >
              <Text style={[s.pmGlyph, s.pmGlyphOnInk]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Win banner ── */}
      {winner && (
        <View style={s.winBanner}>
          <Text style={s.winLabel}>GAME OVER</Text>
          <Text style={s.winName}>
            {(winner === 'home' ? homeName : awayName).toUpperCase()} WINS
          </Text>
          <Text style={s.winScore}>
            {winner === 'home' ? homeScore : awayScore} – {winner === 'home' ? awayScore : homeScore}
          </Text>
        </View>
      )}

      {/* ── Footer actions ── */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.footerBtn, s.footerBtnGhost]}
          onPress={undo}
          disabled={history.length === 0 || !!winner}
          activeOpacity={0.7}
        >
          <Text style={[
            s.footerBtnText,
            (history.length === 0 || !!winner) && s.footerBtnTextDisabled,
          ]}>
            UNDO
          </Text>
        </TouchableOpacity>

        {winner ? (
          <TouchableOpacity
            style={[s.footerBtn, s.footerBtnPrimary]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={[s.footerBtnText, s.footerBtnTextOnInk]}>LOCK & EXIT</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.footerBtn, s.footerBtnGhost]}
            onPress={reset}
            activeOpacity={0.7}
          >
            <Text style={s.footerBtnText}>RESET</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Demo badge — leaves no doubt this is a mock */}
      <View style={s.demoFooter}>
        <Text style={s.demoFooterText}>SCORER · DEMO MODE — taps are not saved to the league</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: YColors.bg,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 28,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
    gap: 12,
    position: 'relative',
  },
  sideStripe: {
    position: 'absolute',
    left: 20,
    top: 8,
    bottom: 10,
    width: 4,
    backgroundColor: YColors.lime,
  },
  back: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 11,
    color: YColors.ink2,
    letterSpacing: 2,
    marginLeft: 16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: YColors.live,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    fontFamily: YFonts.uiBlack,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },

  meta: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 8,
  },
  eyebrow: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 11,
    color: YColors.accent,
    letterSpacing: 3,
  },
  slotLabel: {
    fontFamily: YFonts.display,
    transform: [{ skewX: '-10deg' }],
    fontSize: 36,
    color: YColors.ink,
    letterSpacing: 0.5,
    marginTop: 4,
  },

  // ─── Big score zone ────────────────────────────────────────────
  scoreZone: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  sidePanel: {
    flex: 1,
    borderRadius: 18,
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: YColors.bg2,
    borderWidth: 1.5,
    borderColor: YColors.line2,
  },
  sidePanelLeft: {
    borderTopColor: YColors.accent,
    borderTopWidth: 4,
  },
  sidePanelRight: {
    borderTopColor: YColors.live,
    borderTopWidth: 4,
  },
  winSideHome: {
    backgroundColor: YColors.accent,
    borderColor: YColors.accent,
  },
  winSideAway: {
    backgroundColor: YColors.live,
    borderColor: YColors.live,
  },
  teamName: {
    fontFamily: YFonts.uiBlack,
    fontSize: 13,
    color: YColors.ink2,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  serverChip: {
    backgroundColor: YColors.lime,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 8,
  },
  serverText: {
    fontFamily: YFonts.uiBlack,
    fontSize: 9,
    color: YColors.ink,
    letterSpacing: 1.5,
  },
  score: {
    fontFamily: YFonts.display,
    transform: [{ skewX: '-10deg' }],
    fontSize: 120,
    lineHeight: 128,
    color: YColors.ink,
    letterSpacing: -2,
  },
  scoreWin: {
    color: '#FFFFFF',
  },

  // ─── +/- buttons under each score ──────────────────────────────
  pmRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  pmBtn: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pmBtnPlus: {
    backgroundColor: YColors.ink,
  },
  pmBtnMinus: {
    backgroundColor: YColors.bg3,
    borderWidth: 1.5,
    borderColor: YColors.line2,
  },
  pmBtnDisabled: {
    opacity: 0.4,
  },
  pmBtnOnWinHome: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.32)',
  },
  pmBtnOnWinAway: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.32)',
  },
  pmGlyph: {
    fontFamily: YFonts.uiBlack,
    fontSize: 32,
    color: YColors.ink,
    lineHeight: 36,
  },
  pmGlyphOnInk: {
    color: YColors.bg,
  },
  pmGlyphDisabled: {
    color: YColors.ink3,
  },
  pmGlyphOnWin: {
    color: '#FFFFFF',
  },

  middleDivider: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  middleDash: {
    fontFamily: YFonts.display,
    transform: [{ skewX: '-10deg' }],
    fontSize: 40,
    color: YColors.ink3,
  },

  // ─── Win banner ────────────────────────────────────────────────
  winBanner: {
    marginHorizontal: 14,
    marginBottom: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: YColors.ink,
    borderRadius: 14,
    alignItems: 'center',
  },
  winLabel: {
    fontFamily: YFonts.uiExtrabold,
    fontSize: 11,
    color: YColors.lime,
    letterSpacing: 3,
  },
  winName: {
    fontFamily: YFonts.display,
    transform: [{ skewX: '-10deg' }],
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  winScore: {
    fontFamily: YFonts.monoBold,
    fontSize: 18,
    color: YColors.lime,
    marginTop: 4,
    letterSpacing: 2,
  },

  // ─── Footer action row ─────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnGhost: {
    backgroundColor: YColors.bg2,
    borderWidth: 1.5,
    borderColor: YColors.line2,
  },
  footerBtnPrimary: {
    backgroundColor: YColors.ink,
  },
  footerBtnText: {
    fontFamily: YFonts.uiBlack,
    fontSize: 12,
    color: YColors.ink,
    letterSpacing: 1.5,
  },
  footerBtnTextOnInk: {
    color: YColors.bg,
  },
  footerBtnTextDisabled: {
    color: YColors.ink3,
  },

  // ─── Demo disclaimer ────────────────────────────────────────────
  demoFooter: {
    paddingVertical: 10,
    backgroundColor: YColors.bg3,
    alignItems: 'center',
  },
  demoFooterText: {
    fontFamily: YFonts.uiSemibold,
    fontSize: 10,
    color: YColors.ink2,
    letterSpacing: 1.2,
  },
});
