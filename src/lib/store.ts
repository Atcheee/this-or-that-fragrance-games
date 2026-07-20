import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameModeId, GameRecord } from "./types";

export interface DailyConnectionsProgress {
  dateKey: string;
  puzzleId: string;
  tileOrder: string[];
  selectedIds: string[];
  solvedGroupIds: string[];
  mistakes: number;
  outcome: "won" | "lost" | null;
}

interface AppState {
  apiKey: string;
  history: GameRecord[];
  /** Best score percentage (0–100) per quiz mode, or raw count for naming modes */
  best: Partial<Record<GameModeId, number>>;
  dailyConnections?: DailyConnectionsProgress;
  setApiKey: (key: string) => void;
  addRecord: (record: GameRecord) => void;
  setDailyConnections: (progress: DailyConnectionsProgress) => void;
  clearHistory: () => void;
}

const NAMING_MODES: GameModeId[] = ["name-by-house", "name-by-note"];

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      apiKey: "",
      history: [],
      best: {},
      setApiKey: (key) => set({ apiKey: key.trim() }),
      setDailyConnections: (dailyConnections) => set({ dailyConnections }),
      addRecord: (record) =>
        set((state) => {
          const isNaming = NAMING_MODES.includes(record.mode);
          const value = isNaming
            ? record.score
            : record.total > 0
              ? Math.round((record.score / record.total) * 100)
              : 0;
          const prev = state.best[record.mode] ?? -1;
          return {
            history: [record, ...state.history].slice(0, 100),
            best:
              value > prev
                ? { ...state.best, [record.mode]: value }
                : state.best,
          };
        }),
      clearHistory: () => set({ history: [], best: {} }),
    }),
    { name: "this-or-that-storage" },
  ),
);
