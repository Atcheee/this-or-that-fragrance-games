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
      const { best, history } = useAppStore.getState();
      const dailyKey = record.label?.match(/^daily:\d{4}-\d{2}-\d{2}/)?.[0];
      if (
        dailyKey &&
        history.some(
          (entry) =>
            entry.mode === record.mode && entry.label?.startsWith(dailyKey),
        )
      ) {
        return false;
      }
      if (
        record.mode === "connections-daily" &&
        record.label &&
        record.label.length >= 10 &&
        history.some(
          (entry) =>
            entry.mode === record.mode &&
            entry.label?.startsWith(record.label!.slice(0, 10)),
        )
      ) {
        return false;
      }
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
