"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getMode } from "@/lib/modes";
import { GameController } from "@/components/game/GameController";
import { ScentleGame } from "@/components/game/ScentleGame";

export default function PlayPage() {
  const params = useParams<{ mode: string }>();
  const meta = getMode(params.mode);

  if (!meta) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">Unknown game mode</h1>
        <Link href="/" className="text-accent underline">
          Back to all games
        </Link>
      </div>
    );
  }

  if (meta.kind === "scentle") {
    return <ScentleGame meta={meta} />;
  }

  return <GameController meta={meta} />;
}
