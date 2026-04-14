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
  rank?: number;
  isQualified: boolean;
}

// ── Knockout ──

export interface KnockoutBracketData {
  quarterfinals: Tie[];
  hRanking: { franchiseId: string; franchise: Franchise; score: number; rank: number }[];
  qualifier1?: Tie;
  eliminator?: Tie;
  qualifier2?: Tie;
  final?: Tie;
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
  label: string;
  pointValue: number;
}[] = [
  { slotNumber: 1, categorySlug: 'kids', label: 'Kids & Kids', pointValue: 4 },
  { slotNumber: 2, categorySlug: 'kids', label: 'Kid & Teen (M)', pointValue: 3 },
  { slotNumber: 3, categorySlug: 'teen', label: 'Teen (F) & Teen (M)', pointValue: 4 },
  { slotNumber: 4, categorySlug: 'women1', label: 'Women1 & Women1', pointValue: 4 },
  { slotNumber: 5, categorySlug: 'women1', label: 'Women1 & Men1', pointValue: 3 },
  { slotNumber: 6, categorySlug: 'women2', label: 'Women2 & Women2', pointValue: 4 },
  { slotNumber: 7, categorySlug: 'women2', label: 'Women2 & Women2', pointValue: 3 },
  { slotNumber: 8, categorySlug: 'women2', label: 'Women2 & Men2', pointValue: 3 },
  { slotNumber: 9, categorySlug: 'men1', label: 'Men1 & Men1', pointValue: 4 },
  { slotNumber: 10, categorySlug: 'men2', label: 'Men2 & Men2', pointValue: 4 },
  { slotNumber: 11, categorySlug: 'men3', label: 'Men3 & Men3', pointValue: 4 },
  { slotNumber: 12, categorySlug: 'men3', label: 'Men3 & Men3', pointValue: 4 },
  { slotNumber: 13, categorySlug: 'men3', label: 'Men3 & Men3', pointValue: 3 },
];
