export type UserRole = 'player' | 'organizer' | 'admin';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro';
export type Gender = 'male' | 'female' | 'other';
export type RatingFormat = 'singles' | 'doubles';

export interface User {
  id: string;
  firebaseUid: string;
  phone: string;
  email?: string;
  fullName: string;
  displayName?: string;
  avatarUrl?: string;
  city?: string;
  /** Coordinates of the city the user picked, saved by CityPickerScreen. Used to
   *  centre nearby-court search when they're browsing a city they aren't in. */
  cityLat?: number;
  cityLng?: number;
  state?: string;
  dateOfBirth?: string;
  gender?: Gender;
  bio?: string;
  role: UserRole;
  selfReportedSkill?: SkillLevel;
  isVerified: boolean;
  whatsappOptedIn: boolean;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerRating {
  id: string;
  userId: string;
  format: RatingFormat;
  rating: number;
  ratingDeviation: number;
  matchesPlayed: number;
  peakRating: number;
  peakRatingAt?: string;
}

export interface RatingHistoryEntry {
  id: string;
  userId: string;
  format: RatingFormat;
  oldRating: number;
  newRating: number;
  change: number;
  matchId?: string;
  reason: 'match_result' | 'decay' | 'adjustment';
  createdAt: string;
}

export interface UserProfile extends User {
  ratings: PlayerRating[];
  stats: UserStats;
}

export interface UserStats {
  tournamentsPlayed: number;
  matchesPlayed: number;
  matchesWon: number;
  winRate: number;
  singlesRating?: number;
  doublesRating?: number;
}
