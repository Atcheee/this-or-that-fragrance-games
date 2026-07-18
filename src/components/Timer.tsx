"use client";

interface TimerProps {
  secondsLeft: number;
  totalSeconds: number;
}

export function Timer({ secondsLeft, totalSeconds }: TimerProps) {
  const fraction = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const urgent = secondsLeft <= 10;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="flex items-center gap-3">
      <span
        className={`font-mono text-2xl font-bold tabular-nums ${
          urgent ? "text-danger" : "text-foreground"
        }`}
      >
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            urgent ? "bg-danger" : "bg-accent"
          }`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
