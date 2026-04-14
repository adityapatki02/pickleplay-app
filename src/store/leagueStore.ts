import { create } from 'zustand';
import type {
  League,
  LeagueSeason,
  Franchise,
  LeagueGroup,
  LeagueStanding,
  Tie,
  KnockoutBracketData,
} from '../types/league.types';

interface LeagueState {
  // Data
  leagues: League[];
  currentLeague: League | null;
  currentSeason: LeagueSeason | null;
  franchises: Franchise[];
  currentFranchise: Franchise | null;
  groups: LeagueGroup[];
  standings: LeagueStanding[];
  ties: Tie[];
  currentTie: Tie | null;
  knockoutBracket: KnockoutBracketData | null;
  isLoading: boolean;

  // Actions
  setLeagues: (leagues: League[]) => void;
  addLeague: (league: League) => void;
  updateLeague: (league: League) => void;
  setCurrentLeague: (league: League | null) => void;
  setCurrentSeason: (season: LeagueSeason | null) => void;
  setFranchises: (franchises: Franchise[]) => void;
  addFranchise: (franchise: Franchise) => void;
  updateFranchise: (franchise: Franchise) => void;
  setCurrentFranchise: (franchise: Franchise | null) => void;
  setGroups: (groups: LeagueGroup[]) => void;
  setStandings: (standings: LeagueStanding[]) => void;
  setTies: (ties: Tie[]) => void;
  setCurrentTie: (tie: Tie | null) => void;
  updateTie: (tie: Tie) => void;
  setKnockoutBracket: (bracket: KnockoutBracketData | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  leagues: [],
  currentLeague: null,
  currentSeason: null,
  franchises: [],
  currentFranchise: null,
  groups: [],
  standings: [],
  ties: [],
  currentTie: null,
  knockoutBracket: null,
  isLoading: false,
};

export const useLeagueStore = create<LeagueState>((set) => ({
  ...initialState,

  setLeagues: (leagues) => set({ leagues }),
  addLeague: (league) => set((s) => ({ leagues: [league, ...s.leagues] })),
  updateLeague: (league) =>
    set((s) => ({
      leagues: s.leagues.map((l) => (l.id === league.id ? league : l)),
      currentLeague: s.currentLeague?.id === league.id ? league : s.currentLeague,
    })),
  setCurrentLeague: (currentLeague) => set({ currentLeague }),
  setCurrentSeason: (currentSeason) => set({ currentSeason }),

  setFranchises: (franchises) => set({ franchises }),
  addFranchise: (franchise) => set((s) => ({ franchises: [...s.franchises, franchise] })),
  updateFranchise: (franchise) =>
    set((s) => ({
      franchises: s.franchises.map((f) => (f.id === franchise.id ? franchise : f)),
      currentFranchise: s.currentFranchise?.id === franchise.id ? franchise : s.currentFranchise,
    })),
  setCurrentFranchise: (currentFranchise) => set({ currentFranchise }),

  setGroups: (groups) => set({ groups }),
  setStandings: (standings) => set({ standings }),

  setTies: (ties) => set({ ties }),
  setCurrentTie: (currentTie) => set({ currentTie }),
  updateTie: (tie) =>
    set((s) => ({
      ties: s.ties.map((t) => (t.id === tie.id ? tie : t)),
      currentTie: s.currentTie?.id === tie.id ? tie : s.currentTie,
    })),

  setKnockoutBracket: (knockoutBracket) => set({ knockoutBracket }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set(initialState),
}));
