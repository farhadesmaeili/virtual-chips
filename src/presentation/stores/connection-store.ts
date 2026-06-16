import { create } from 'zustand';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface ConnectionUser {
  readonly id: string;
  readonly username: string;
}

interface ConnectionState {
  status: ConnectionStatus;
  user: ConnectionUser | null;
  setStatus: (status: ConnectionStatus) => void;
  setUser: (user: ConnectionUser | null) => void;
  reset: () => void;
}

/** Realtime connection + authenticated user state (foundation for task 4.5). */
export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  user: null,
  setStatus: (status) => set({ status }),
  setUser: (user) => set({ user }),
  reset: () => set({ status: 'disconnected', user: null }),
}));
