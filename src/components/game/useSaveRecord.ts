"use client";

import { useCallback } from "react";
import { useAppStore } from "@/lib/store";
import type { GameRecord } from "@/lib/types";

/**
 * Persists a finished game and reports whether it set a new personal best.
 */
export function useSaveRecord() {
  const addRecord = useAppStore((s) => s.addRecord);

  return useCallback(
    (record: Omit<GameRecord, "playedAt">): boolean => {
      const { best } = useAppStore.getState();
      const isNaming =
        record.mode === "name-by-house" || record.mode === "name-by-note";
      const value = isNaming
        ? record.score
        : record.total > 0
          ? Math.round((record.score / record.total) * 100)
          : 0;
      const isNewBest = value > (best[record.mode] ?? -1);
      addRecord({ ...record, playedAt: new Date().toISOString() });
      return isNewBest;
    },
    [addRecord],
  );
}
