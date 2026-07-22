// Client-side mirror of the backend league bonus rules
// (pickleplay-api/src/modules/leagues/bonus-points.util.ts). Used ONLY for the
// live overlay while a tie is in progress — completed ties/matches use the
// server's persisted bonus. The 15-point bands come from the season's
// bonusRules when provided, else the SPPL defaults, so passing nothing (or a
// season without bonusRules) reproduces the original SPPL behaviour exactly.

export interface SeasonBonusRules {
  blowout?: { maxLoserScore?: number; winnerBonus?: number };
  closeLoss?: { minLoserScore?: number; maxLoserScore?: number; loserBonus?: number };
  goldenPointLoss?: { loserBonus?: number };
}

export interface MatchBonus {
  winnerBonus: number;
  loserBonus: number;
}

export function computeMatchBonus(
  winnerScore: number,
  loserScore: number,
  scoringMode?: string | null,
  bonusRules?: SeasonBonusRules | null,
): MatchBonus {
  if (scoringMode === 'rally_point_game') {
    return { winnerBonus: 0, loserBonus: 0 };
  }

  if (scoringMode === 'rally_21') {
    // 21-pt knockout rules (SBPL knockouts are 15-pt, so not parameterised)
    if (loserScore <= 7) return { winnerBonus: 2, loserBonus: 0 };
    if (loserScore >= 14 && loserScore <= 19 && winnerScore === 21) {
      return { winnerBonus: 0, loserBonus: 1 };
    }
    if (loserScore === 20 && winnerScore === 21) return { winnerBonus: 0, loserBonus: 2 };
    return { winnerBonus: 0, loserBonus: 0 };
  }

  // 15-pt league rules — bands from season.bonusRules, else SPPL defaults.
  const blowoutMax = bonusRules?.blowout?.maxLoserScore ?? 4;
  const blowoutWinnerBonus = bonusRules?.blowout?.winnerBonus ?? 2;
  const closeMin = bonusRules?.closeLoss?.minLoserScore ?? 11;
  const closeMax = bonusRules?.closeLoss?.maxLoserScore ?? 13;
  const closeLoserBonus = bonusRules?.closeLoss?.loserBonus ?? 1;
  const goldenLoserBonus = bonusRules?.goldenPointLoss?.loserBonus ?? 2;

  if (loserScore <= blowoutMax) return { winnerBonus: blowoutWinnerBonus, loserBonus: 0 };
  if (loserScore >= closeMin && loserScore <= closeMax && winnerScore === 15) {
    return { winnerBonus: 0, loserBonus: closeLoserBonus };
  }
  if (winnerScore >= 16 || (loserScore === 14 && winnerScore === 15)) {
    return { winnerBonus: 0, loserBonus: goldenLoserBonus };
  }
  return { winnerBonus: 0, loserBonus: 0 };
}

/** Split a MatchBonus onto home/away totals given which side won. */
export function bonusToSides(
  b: MatchBonus,
  homeWon: boolean,
): { home: number; away: number } {
  return homeWon
    ? { home: b.winnerBonus, away: b.loserBonus }
    : { home: b.loserBonus, away: b.winnerBonus };
}
