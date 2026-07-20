"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "@phosphor-icons/react";
import { useHydrated } from "@/lib/useHydrated";

const OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useHydrated();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-border bg-card p-1"
      role="radiogroup"
      aria-label="Theme"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && (theme ?? "system") === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setTheme(value)}
            className={`rounded-full p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Icon aria-hidden size={16} weight="regular" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
