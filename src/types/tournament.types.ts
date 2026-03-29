export type TournamentStatus =
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type CategoryFormat = 'singles' | 'doubles';
export type CategoryGender = 'male' | 'female' | 'mixed' | 'open';
export type KnockoutFormat = 'single_elimination' | 'double_elimination' | 'round_robin';
export type MatchFormat = 'best_of_1' | 'best_of_3' | 'best_of_5';
export type CategoryStatus = 'draft' | 'open' | 'closed' | 'in_progress' | 'completed';
export type PaymentMode = 'online' | 'venue' | 'both';

export interface Tournament {
  id: string;
  organizerId: string;
  name: string;
  slug: string;
  description?: string;
  venueName: string;
  venueAddress: string;
  venueLat?: number;
  venueLng?: number;
  city: string;
  state?: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  status: TournamentStatus;
  bannerUrl?: string;
  rulesUrl?: string;
  refundPolicy?: string;
  contactPhone?: string;
  contactEmail?: string;
  clonedFromId?: string;
  isFeatured: boolean;
  geofenceRadiusM: number;
  categories?: TournamentCategory[];
  courts?: Court[];
  sponsors?: Sponsor[];
  createdAt: string;
  updatedAt: string;
}

export interface TournamentCategory {
  id: string;
  tournamentId: string;
  name: string;
  format: CategoryFormat;
  gender: CategoryGender;
  minRating?: number;
  maxRating?: number;
  minAge?: number;
  maxAge?: number;
  entryFee: number;
  maxTeams: number;
  groupSize: number;
  advancingPerGroup: number;
  knockoutFormat: KnockoutFormat;
  matchFormat: MatchFormat;
  pointsPerGame: number;
  winBy: number;
  estimatedMatchDurationMin: number;
  status: CategoryStatus;
  paymentMode: PaymentMode;
  registeredTeams?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Court {
  id: string;
  tournamentId: string;
  name: string;
  surfaceType?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface Sponsor {
  id: string;
  tournamentId: string;
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  tier: 'title' | 'gold' | 'silver' | 'bronze' | 'associate';
  displayOrder: number;
  impressions: number;
  clicks: number;
}

export interface TournamentExpense {
  id: string;
  tournamentId: string;
  description: string;
  amount: number;
  category?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface CreateTournamentInput {
  name: string;
  description?: string;
  venueName: string;
  venueAddress: string;
  venueLat?: number;
  venueLng?: number;
  city: string;
  state?: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  contactPhone?: string;
  contactEmail?: string;
  geofenceRadiusM?: number;
}

export interface CreateCategoryInput {
  name: string;
  format: CategoryFormat;
  gender: CategoryGender;
  minRating?: number;
  maxRating?: number;
  minAge?: number;
  maxAge?: number;
  entryFee: number;
  maxTeams: number;
  groupSize?: number;
  knockoutFormat?: KnockoutFormat;
  matchFormat?: MatchFormat;
  pointsPerGame?: number;
  winBy?: number;
  estimatedMatchDurationMin?: number;
}

export interface Team {
  id: string;
  categoryId: string;
  registrationId: string;
  name: string;
  seedNumber: number | null;
  groupNumber: number | null;
  groupRank: number | null;
  groupWins: number;
  groupLosses: number;
  groupPointsFor: number;
  groupPointsAgainst: number;
  isEliminated: boolean;
}

export interface MatchData {
  id: string;
  round: string;
  matchNumber: number;
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
  status: string;
  courtId: string | null;
  scheduledStart: string | null;
  dependsOnMatchA: string | null;
  dependsOnMatchB: string | null;
  scores: { gameNumber: number; teamAScore: number; teamBScore: number }[];
}

export interface PoolData {
  groupNumber: number;
  teams: {
    id: string;
    name: string;
    groupRank: number | null;
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
    pointsDiff: number;
  }[];
  matches: MatchData[];
}

export interface BracketData {
  category: {
    id: string;
    name: string;
    format: string;
    knockoutFormat: string;
    groupSize: number;
    advancingPerGroup: number;
    matchFormat: string;
    pointsPerGame: number;
  };
  pools: PoolData[];
  knockout: MatchData[];
  teams: { id: string; name: string; seedNumber: number | null; isEliminated: boolean }[];
}
