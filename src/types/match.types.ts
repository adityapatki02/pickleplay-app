export type MatchStatus =
  | 'scheduled'
  | 'check_in_open'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'walkover'
  | 'cancelled'
  | 'postponed';

export type MatchRound = 'group' | 'R32' | 'R16' | 'QF' | 'SF' | 'F' | '3rd_place';

export type RegistrationStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'waitlisted'
  | 'cancelled'
  | 'refunded';

export type TeamStatus = 'pending_partner' | 'confirmed' | 'withdrawn' | 'disqualified';

export type CheckInMethod = 'app_button' | 'geofence' | 'manual';

export interface MatchTeam {
  id: string;
  categoryId: string;
  name?: string;
  seed?: number;
  groupId?: string;
  status: TeamStatus;
  avgRating?: number;
  members: TeamMember[];
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'captain' | 'member';
  user?: {
    id: string;
    fullName: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export interface Registration {
  id: string;
  tournamentId: string;
  categoryId: string;
  userId: string;
  teamId?: string;
  partnerId?: string;
  lookingForPartner: boolean;
  status: RegistrationStatus;
  waitlistPosition?: number;
  paymentId?: string;
  registeredAt: string;
  confirmedAt?: string;
  /** Name/phone captured when someone registers from a shared event link. */
  guestName?: string | null;
  guestPhone?: string | null;
}

export interface Group {
  id: string;
  categoryId: string;
  name: string;
  displayOrder: number;
  teams?: MatchTeam[];
  standings?: GroupStanding[];
}

export interface GroupStanding {
  id: string;
  groupId: string;
  teamId: string;
  team?: MatchTeam;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  gamesWon: number;
  gamesLost: number;
  pointsWon: number;
  pointsLost: number;
  pointDifferential: number;
  rank?: number;
}

export interface Match {
  id: string;
  categoryId: string;
  groupId?: string;
  courtId?: string;
  round: MatchRound;
  matchNumber: number;
  teamAId?: string;
  teamBId?: string;
  teamA?: MatchTeam;
  teamB?: MatchTeam;
  winnerId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  estimatedStart?: string;
  status: MatchStatus;
  scoreEnteredBy?: string;
  scoreConfirmed: boolean;
  refereeId?: string;
  courtName?: string;
  scores?: MatchScore[];
  checkIns?: CheckIn[];
  notes?: string;
}

export interface MatchScore {
  id: string;
  matchId: string;
  gameNumber: number;
  teamAScore: number;
  teamBScore: number;
  isCompleted: boolean;
}

export interface CheckIn {
  id: string;
  matchId: string;
  userId: string;
  teamId: string;
  method: CheckInMethod;
  latitude?: number;
  longitude?: number;
  checkedInAt: string;
}

export interface PartnerRequest {
  id: string;
  categoryId: string;
  requestingUserId: string;
  targetUserId?: string;
  status: 'open' | 'sent' | 'accepted' | 'declined' | 'expired';
  message?: string;
  requestingUser?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
    singlesRating?: number;
    doublesRating?: number;
  };
}
