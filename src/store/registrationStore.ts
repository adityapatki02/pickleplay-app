import { create } from 'zustand';

interface Registration {
  id: string;
  tournamentId: string;
  categoryId: string;
  userId: string;
  status: string;
  waitlistPosition: number | null;
  tournament?: any;
  category?: any;
}

interface RegistrationState {
  myRegistrations: Registration[];
  isLoading: boolean;
  setMyRegistrations: (registrations: Registration[]) => void;
  addRegistration: (registration: Registration) => void;
  removeRegistration: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useRegistrationStore = create<RegistrationState>((set) => ({
  myRegistrations: [],
  isLoading: false,
  setMyRegistrations: (registrations) => set({ myRegistrations: registrations }),
  addRegistration: (registration) =>
    set((state) => ({
      myRegistrations: [registration, ...state.myRegistrations],
    })),
  removeRegistration: (id) =>
    set((state) => ({
      myRegistrations: state.myRegistrations.filter((r) => r.id !== id),
    })),
  setLoading: (isLoading) => set({ isLoading }),
}));
