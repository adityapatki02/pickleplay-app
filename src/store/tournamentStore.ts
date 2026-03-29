import { create } from 'zustand';
import { Tournament, TournamentCategory, BracketData } from '../types';

interface TournamentState {
  tournaments: Tournament[];
  currentTournament: Tournament | null;
  isLoading: boolean;
  discoveredTournaments: Tournament[];
  bracket: BracketData | null;
  myMatches: any[];

  setTournaments: (tournaments: Tournament[]) => void;
  addTournament: (tournament: Tournament) => void;
  setCurrentTournament: (tournament: Tournament | null) => void;
  updateTournament: (id: string, updates: Partial<Tournament>) => void;
  removeTournament: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setDiscoveredTournaments: (tournaments: Tournament[]) => void;
  setBracket: (bracket: BracketData | null) => void;
  setMyMatches: (matches: any[]) => void;
}

export const useTournamentStore = create<TournamentState>((set) => ({
  tournaments: [],
  currentTournament: null,
  isLoading: false,
  discoveredTournaments: [],
  bracket: null,
  myMatches: [],

  setTournaments: (tournaments) => set({ tournaments }),

  addTournament: (tournament) =>
    set((state) => ({
      tournaments: [tournament, ...state.tournaments],
    })),

  setCurrentTournament: (currentTournament) => set({ currentTournament }),

  updateTournament: (id, updates) =>
    set((state) => ({
      tournaments: state.tournaments.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
      currentTournament:
        state.currentTournament?.id === id
          ? { ...state.currentTournament, ...updates }
          : state.currentTournament,
    })),

  removeTournament: (id) =>
    set((state) => ({
      tournaments: state.tournaments.filter((t) => t.id !== id),
      currentTournament:
        state.currentTournament?.id === id ? null : state.currentTournament,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setDiscoveredTournaments: (discoveredTournaments) => set({ discoveredTournaments }),

  setBracket: (bracket) => set({ bracket }),

  setMyMatches: (myMatches) => set({ myMatches }),
}));
