"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { Buildings, Heart } from "@phosphor-icons/react";
import { FragranceBottleIcon } from "@/components/FragranceBottleIcon";

const LINKS: {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  isActive: (pathname: string) => boolean;
}[] = [
  {
    href: "/fragrances",
    label: "Fragrances",
    icon: FragranceBottleIcon,
    isActive: (pathname) =>
      pathname.startsWith("/fragrances") || pathname.startsWith("/fragrance/"),
  },
  {
    href: "/houses",
    label: "Houses",
    icon: Buildings,
    isActive: (pathname) =>
      pathname.startsWith("/houses") || pathname.startsWith("/house/"),
  },
  {
    href: "/favorites",
    label: "Favorites",
    icon: Heart,
    isActive: (pathname) => pathname.startsWith("/favorites"),
  },
];

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="col-span-3 row-start-3 md:col-span-1 md:col-start-2 md:row-start-1"
    >
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card p-1 md:flex md:w-auto md:grid-cols-none md:items-center md:gap-0.5 md:rounded-full md:px-1 md:py-1">
        {LINKS.map(({ href, label, icon: Icon, isActive }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-0 md:flex-row md:gap-1.5 md:rounded-full md:px-3 md:py-1.5 ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-card-hover hover:text-foreground"
              }`}
            >
              <Icon
                size={16}
                weight={active ? "fill" : "regular"}
                className="md:size-[15px]"
                aria-hidden
              />
              <span className="text-[0.7rem] font-semibold leading-none tracking-wide md:text-[0.8125rem] md:tracking-normal">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
