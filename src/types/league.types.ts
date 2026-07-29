// ═══════════════════════════════════════════════════════════════════════
// League Mode Types
// ═══════════════════════════════════════════════════════════════════════

export type LeagueStatus = 'draft' | 'active' | 'completed' | 'archived';
export type SeasonStatus = 'setup' | 'registration' | 'league_phase' | 'knockout_phase' | 'completed';
export type RosterStatus = 'active' | 'injured' | 'suspended' | 'released';
export type TieStatus = 'scheduled' | 'lineup_submitted' | 'lineup_locked' | 'in_progress' | 'completed' | 'postponed';
export type TieSheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'locked';
export type CardType = 'yellow' | 'red';

export type CategorySlug =
  | 'kids'
  | 'teen'
  | 'women1'
  | 'women2'
  | 'men1'
  | 'men2'
  | 'men3';

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  kids: 'Kids',
  teen: 'Teen',
  women1: 'Women 1',
  women2: 'Women 2',
  men1: 'Men 1',
  men2: 'Men 2',
  men3: 'Men 3',
};

// ── Core Entities ──

export interface League {
  id: string;
  organizerId: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  city?: string;
  state?: string;
  rulesUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  status: LeagueStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BonusRules {
  blowout: { minMargin: number; maxLoserScore: number; winnerBonus: number };
  closeLoss: { minLoserScore: number; maxLoserScore: number; loserBonus: number };
  goldenPointLoss: { loserBonus: number };
}

export interface LeagueSeason {
  id: string;
  leagueId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SeasonStatus;
  groupCount: number;
  tiesPerTeam: number;
  matchesPerTie: number;
  matchPointsTo: number;
  goldenPointAt: number;
  maxPointsPerTie: number;
  bonusRules: BonusRules;
  tieBreakers: string[];
  rallyPointGameEnabled: boolean;
  rallyPointGamePoints: number;
  maxSubstitutionsPerTie: number;
  maxMatchesPerPlayerPerTie: number;
  tieSheetDeadlineMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Franchise {
  id: string;
  leagueId: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  ownerId?: string;
  captainId?: string;
  owner?: { id: string; fullName: string; phone: string };
  captain?: { id: string; fullName: string; phone: string };
  rosterCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FranchiseRoster {
  id: string;
  franchiseId: string;
  seasonId: string;
  playerId: string;
  categorySlug: CategorySlug;
  jerseyNumber?: number;
  isCaptain: boolean;
  status: RosterStatus;
  player: {
    id: string;
    fullName: string;
    displayName?: string;
    phone?: string;
    gender?: string;
    dateOfBirth?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LeagueGroup {
  id: string;
  seasonId: string;
  name: string;
  displayOrder: number;
  franchises?: Franchise[];
  createdAt: string;
}

// ── Tie & Scoring ──

export interface Tie {
  id: string;
  seasonId: string;
  groupId?: string;
  round: string;
  matchDay: string;
  scheduledStart?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam?: Franchise;
  awayTeam?: Franchise;
  homeScore: number;
  awayScore: number;
  homeBonusPoints: number;
  awayBonusPoints: number;
  homeStandingPoints: number;
  awayStandingPoints: number;
  winnerId?: string;
  status: TieStatus;
  tieSheetDeadline?: string;
  dependsOnTieA?: string;
  dependsOnTieB?: string;
  notes?: string;
  /** Court assignment for live-streaming overlay routing (1, 2, 3, ...) */
  courtNumber?: number | null;
  /** Second court for a two-court (SBPL) tie played across two courts. */
  courtNumber2?: number | null;
  /** Assigned scorer (legacy single-scorer / SPPL lock). */
  scorerId?: string | null;
  /** Two authorized scorers for a two-court (SBPL) tie. */
  scorer1Id?: string | null;
  scorer2Id?: string | null;
  /** Points-to-win target (11/15/21) — drives match scoringMode */
  pointsToWin?: number;
  /** Games per match (best of 1/3/5) — Phase 2 */
  gamesPerMatch?: number;
  tieMatches?: TieMatch[];
  createdAt: string;
  updatedAt: string;
}

export interface TieMatch {
  id: string;
  tieId: string;
  matchId: string;
  slotNumber: number;
  categorySlug: CategorySlug;
  pointValue: number;
  isRallyPointGame: boolean;
  courtNumber?: number | null;
  homePlayer1Id?: string;
  homePlayer2Id?: string;
  awayPlayer1Id?: string;
  awayPlayer2Id?: string;
  bonusPointsHome: number;
  bonusPointsAway: number;
  match?: {
    id: string;
    status: string;
    winnerId?: string;
    teamAId?: string;
    teamBId?: string;
    scores: { gameNumber: number; teamAScore: number; teamBScore: number }[];
  };
  createdAt: string;
}

export interface TieSheet {
  id: string;
  tieId: string;
  franchiseId: string;
  submittedById: string;
  lineupData: TieSheetSlot[];
  status: TieSheetStatus;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TieSheetSlot {
  slotNumber: number;
  categorySlug: CategorySlug;
  player1Id: string;
  player2Id: string;
}

// ── Standings ──

export interface LeagueStanding {
  id: string;
  seasonId: string;
  groupId: string;
  franchiseId: string;
  franchise?: Franchise;
  tiesPlayed: number;
  tiesWon: number;
  tiesLost: number;
  tiesDraw: number;
  matchesWon: number;
  matchesLost: number;
  totalMatchPoints: number;
  totalMatchPointsAgainst: number;
  bonusPoints: number;
  standingPoints: number;
  pointDiff: number;
  /** Cumulative rally points scored across all completed matches */
  ralliesFor?: number;
  /** Cumulative rally points conceded */
  ralliesAgainst?: number;
  /** ralliesFor - ralliesAgainst */
  rallyPointDiff?: number;
  rank?: number;
  isQualified: boolean;
  /** Short user-facing string explaining why this team sits above the team
   *  immediately below. Set by the backend when both rows are tied on TP and
   *  a later tiebreaker rule (head-to-head, matches won, rally point diff,
   *  or rally points scored) decided the order. */
  tiebreakerReason?: string;
  tiebreakerType?: 'h2h' | 'matchesWon' | 'rallyPointDiff' | 'ralliesFor';
}

// ── Knockout ──

export interface QualifiedTeam {
  franchiseId: string;
  franchise: Franchise;
  rank: number;
  standingPoints: number;
  groupLabel: string; // 'AB' or 'CD'
}

export interface PlayerStat {
  playerId: string;
  playerName: string;
  franchiseId: string | null;
  franchiseName: string | null;
  franchiseShortName: string | null;
  franchiseColor: string | null;
  /** Roster category for this player in the season (kids/teen/women1/women2/men1/men2/men3).
   *  Null if the player has no franchise_roster row for the season. */
  categorySlug?: string | null;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  pointsScored: number;
  pointsConceded: number;
  pointDiff: number;
  bonusPointsEarned: number;
  /** SPPL team points (slot pointValue 4 or 3) accumulated across won matches */
  teamPointsEarned: number;
  winRate: number;
  categoryBreakdown: Record<string, {
    played: number;
    won: number;
    lost: number;
    scored: number;
    conceded: number;
    bonus: number;
    teamPoints: number;
  }>;
  /**
   * Per-stage breakdown — same shape as categoryBreakdown but keyed by
   * 'league' | 'knockout'. Lets the Stats screen toggle between league-only
   * and knockout-only views without re-fetching. May be empty for older
   * seasons where the column wasn't yet populated.
   */
  stageBreakdown?: Record<string, {
    played: number;
    won: number;
    lost: number;
    scored: number;
    conceded: number;
    bonus: number;
    teamPoints: number;
  }>;
}

export interface TopPerformer extends PlayerStat {
  rank: number;
  value: number;
}

export interface KnockoutBracketData {
  qf1: Tie | null;
  qf2: Tie | null;
  qf3: Tie | null;
  qf4: Tie | null;
  /** Q1: H1 vs H2 (winner → Final, loser → Q2). Filled after all 4 QFs complete. */
  q1?: Tie | null;
  /** Eliminator: H3 vs H4 (winner → Q2, loser eliminated). */
  eliminator?: Tie | null;
  /** Q2: Loser(Q1) vs Winner(Eliminator). */
  q2?: Tie | null;
  final: Tie | null;
  /** @deprecated Pre-IPL knockout format. Legacy seasons only. */
  sf1?: Tie | null;
  /** @deprecated Pre-IPL knockout format. Legacy seasons only. */
  sf2?: Tie | null;
  qualifiedTeams: {
    ab1: QualifiedTeam | null;
    ab2: QualifiedTeam | null;
    ab3: QualifiedTeam | null;
    ab4: QualifiedTeam | null;
    cd1: QualifiedTeam | null;
    cd2: QualifiedTeam | null;
    cd3: QualifiedTeam | null;
    cd4: QualifiedTeam | null;
  } | null;
  /**
   * Live weighted ranking H1-H8. Populated as soon as any QF exists.
   * Updates in real-time using running tie scores. Status meaning:
   *   'advanced'   — finalized top-4 (only when all 4 QFs are completed)
   *   'eliminated' — finalized bottom-4 (only when all 4 QFs are completed)
   *   'live'       — this team's QF is in progress or complete, others still running
   *   'pending'    — this team's QF hasn't started yet
   */
  qfRanking?: Array<{
    rank: number;
    franchiseId: string;
    franchise: Franchise | null;
    qfTieRound: string;
    qfScore: number;
    groupAvg: number;
    weighted: number;
    status: 'advanced' | 'eliminated' | 'live' | 'pending';
  }> | null;
}

// ── Substitutions & Discipline ──

export interface Substitution {
  id: string;
  tieId: string;
  franchiseId: string;
  outPlayerId: string;
  inPlayerId: string;
  requestedByFranchiseId: string;
  approvedByOrganizer: boolean;
  slotNumber: number;
  reason?: string;
  createdAt: string;
}

export interface DisciplineCard {
  id: string;
  seasonId: string;
  tieId?: string;
  matchId?: string;
  playerId: string;
  franchiseId: string;
  cardType: CardType;
  reason: string;
  issuedById: string;
  issuedAt: string;
}

// ── DTOs ──

export interface CreateLeagueInput {
  name: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  city?: string;
  state?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface CreateSeasonInput {
  name: string;
  startDate: string;
  endDate: string;
  groupCount?: number;
  tiesPerTeam?: number;
  matchesPerTie?: number;
  matchPointsTo?: number;
  goldenPointAt?: number;
  rallyPointGameEnabled?: boolean;
  maxSubstitutionsPerTie?: number;
  maxMatchesPerPlayerPerTie?: number;
  tieSheetDeadlineMinutes?: number;
  bonusRules?: BonusRules;
  /** ISO timestamp. When reached, fantasy entries auto-lock. */
  fantasyDeadline?: string;
}

export interface CreateFranchiseInput {
  name: string;
  shortName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  ownerId?: string;
  captainId?: string;
}

export interface AddRosterPlayerInput {
  seasonId: string;
  playerId?: string;
  playerName?: string;
  playerPhone?: string;
  categorySlug: CategorySlug;
  jerseyNumber?: number;
  isCaptain?: boolean;
}

export interface GroupAssignment {
  groupName: string;
  franchiseIds: string[];
}

// ── Match slot config (13 matches per tie) ──

export const SPPL_MATCH_SLOTS: {
  slotNumber: number;
  categorySlug: CategorySlug;
  /** All roster categories eligible for this slot. Mixed-gender slots (2, 5, 8) allow two. */
  allowedCategories: CategorySlug[];
  label: string;
  pointValue: number;
}[] = [
  { slotNumber: 1, categorySlug: 'kids', allowedCategories: ['kids'], label: 'Kids & Kids', pointValue: 4 },
  { slotNumber: 2, categorySlug: 'kids', allowedCategories: ['kids', 'teen'], label: 'Kid & Teen (M)', pointValue: 3 },
  { slotNumber: 3, categorySlug: 'teen', allowedCategories: ['teen'], label: 'Teen (F) & Teen (M)', pointValue: 4 },
  { slotNumber: 4, categorySlug: 'women1', allowedCategories: ['women1'], label: 'Women1 & Women1', pointValue: 4 },
  { slotNumber: 5, categorySlug: 'women1', allowedCategories: ['women1', 'men1'], label: 'Women1 & Men1', pointValue: 3 },
  { slotNumber: 6, categorySlug: 'women2', allowedCategories: ['women2'], label: 'Women2 & Women2', pointValue: 4 },
  { slotNumber: 7, categorySlug: 'women2', allowedCategories: ['women2'], label: 'Women2 & Women2', pointValue: 3 },
  { slotNumber: 8, categorySlug: 'women2', allowedCategories: ['women2', 'men2'], label: 'Women2 & Men2', pointValue: 3 },
  { slotNumber: 9, categorySlug: 'men1', allowedCategories: ['men1'], label: 'Men1 & Men1', pointValue: 4 },
  { slotNumber: 10, categorySlug: 'men2', allowedCategories: ['men2'], label: 'Men2 & Men2', pointValue: 4 },
  { slotNumber: 11, categorySlug: 'men3', allowedCategories: ['men3'], label: 'Men3 & Men3', pointValue: 4 },
  { slotNumber: 12, categorySlug: 'men3', allowedCategories: ['men3'], label: 'Men3 & Men3', pointValue: 4 },
  { slotNumber: 13, categorySlug: 'men3', allowedCategories: ['men3'], label: 'Men3 & Men3', pointValue: 3 },
];
