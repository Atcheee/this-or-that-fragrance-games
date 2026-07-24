"use client";

import { useMemo, useRef, useState } from "react";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import { createBracket, roundName, type BracketSize } from "@/lib/engines/bracket";
import { FragranceCard, type CardState } from "@/components/FragranceCard";
import { ResultsSummary } from "@/components/ResultsSummary";
import { RoundStage } from "./RoundStage";
import { useSaveRecord } from "./useSaveRecord";
import { useAppStore } from "@/lib/store";
import { fragranceToTasteFragrance } from "@/lib/taste-passport";

const PICK_HOLD_MS = 380;

interface BracketGameProps {
  meta: GameModeMeta;
  pool: Fragrance[];
  size: BracketSize;
  onPlayAgain: () => void;
}

export function BracketGame({ meta, pool, size, onPlayAgain }: BracketGameProps) {
  const initial = useMemo(() => createBracket(pool, size), [pool, size]);
  const [currentRound, setCurrentRound] = useState<Fragrance[]>(initial);
  const [winners, setWinners] = useState<Fragrance[]>([]);
  const [pairIndex, setPairIndex] = useState(0);
  const [champion, setChampion] = useState<Fragrance | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const saveRecord = useSaveRecord();
  const recordTasteEvent = useAppStore((state) => state.recordTasteEvent);
  const busyRef = useRef(false);

  const a = currentRound[pairIndex * 2];
  const b = currentRound[pairIndex * 2 + 1];
  const totalPairs = Math.floor(currentRound.length / 2);

  function advance(winner: Fragrance) {
    const nextWinners = [...winners, winner];
    if (pairIndex + 1 < totalPairs) {
      setWinners(nextWinners);
      setPairIndex((i) => i + 1);
      setPickedId(null);
      busyRef.current = false;
      return;
    }
    if (nextWinners.length === 1) {
      setChampion(nextWinners[0]);
      saveRecord({
        mode: meta.id,
        score: 0,
        total: 0,
        label: `${nextWinners[0].name} — ${nextWinners[0].house}`,
      });
      busyRef.current = false;
      return;
    }
    setCurrentRound(nextWinners);
    setWinners([]);
    setPairIndex(0);
    setPickedId(null);
    busyRef.current = false;
  }

  function handlePick(winner: Fragrance) {
    if (busyRef.current || pickedId) return;
    const loser = winner.id === a?.id ? b : a;
    recordTasteEvent({
      type: "fragrance_selected",
      gameMode: meta.id,
      primary: fragranceToTasteFragrance(winner),
      secondary: loser ? fragranceToTasteFragrance(loser) : undefined,
    });
    busyRef.current = true;
    setPickedId(winner.id);
    setTimeout(() => advance(winner), PICK_HOLD_MS);
  }

  if (champion) {
    return (
      <ResultsSummary
        title="Your favorite is"
        scoreText={champion.name}
        subText={`${champion.house} · ${champion.year}`}
        onPlayAgain={onPlayAgain}
      >
        <div className="w-full max-w-sm" data-animate="result">
          <FragranceCard fragrance={champion} showPyramid state="correct" />
        </div>
      </ResultsSummary>
    );
  }

  if (!a || !b) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-muted">
          {roundName(currentRound.length)}
        </p>
        <p className="mt-1 text-sm text-muted">
          Match {pairIndex + 1} of {totalPairs} — pick your favorite
        </p>
      </div>
      <RoundStage
        roundKey={`${currentRound.length}-${pairIndex}`}
        className="grid flex-1 grid-cols-1 content-start gap-4 sm:grid-cols-2"
      >
        {[a, b].map((f) => (
          <FragranceCard
            key={f.id}
            fragrance={f}
            onClick={() => handlePick(f)}
            disabled={pickedId !== null}
            state={bracketCardState(f.id, pickedId)}
            showPyramid
          />
        ))}
      </RoundStage>
    </div>
  );
}

function bracketCardState(id: string, pickedId: string | null): CardState {
  if (!pickedId) return "idle";
  if (id === pickedId) return "correct";
  return "dimmed";
}
