import { create } from 'zustand';

export type GameStatus =
  | 'INIT'
  | 'BETTING'
  | 'LOCKED'
  | 'RELAYING'
  | 'FINALIZING'
  | 'SETTLED'
  | 'CLAIMED'
  | 'EXPIRED';

export interface Game {
  gameId: string;
  question: string;
  options: string[];
  deadline: number;
  totalPool: string;
  status: GameStatus;
  creator: string;
  winningOption?: number;
  userBet?: {
    choice: number;
    amount: string;
  };
  claimAmount?: string;
}

interface GameState {
  games: Record<string, Game>;
  currentGameId: string | null;
  setGames: (games: Record<string, Game>) => void;
  addGame: (gameId: string, game: Game) => void;
  updateGameStatus: (gameId: string, status: GameStatus) => void;
  addBet: (gameId: string, choice: number, amount: string) => void;
  setResult: (gameId: string, winningOption: number) => void;
  setClaimed: (gameId: string, amount: string) => void;
  setExpired: (gameId: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
  games: {},
  currentGameId: null,
  setGames: (games) => set({ games }),
  addGame: (gameId, game) =>
    set((state) => ({
      games: { ...state.games, [gameId]: game },
    })),
  updateGameStatus: (gameId, status) =>
    set((state) => ({
      games: {
        ...state.games,
        [gameId]: { ...state.games[gameId], status },
      },
    })),
  addBet: (gameId, choice, amount) =>
    set((state) => ({
      games: {
        ...state.games,
        [gameId]: {
          ...state.games[gameId],
          userBet: { choice, amount },
          status: 'LOCKED',
        },
      },
    })),
  setResult: (gameId, winningOption) =>
    set((state) => ({
      games: {
        ...state.games,
        [gameId]: {
          ...state.games[gameId],
          winningOption,
          status: 'SETTLED',
        },
      },
    })),
  setClaimed: (gameId, amount) =>
    set((state) => ({
      games: {
        ...state.games,
        [gameId]: {
          ...state.games[gameId],
          claimAmount: amount,
          status: 'CLAIMED',
        },
      },
    })),
  setExpired: (gameId) =>
    set((state) => ({
      games: {
        ...state.games,
        [gameId]: { ...state.games[gameId], status: 'EXPIRED' },
      },
    })),
}));