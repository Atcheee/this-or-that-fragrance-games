import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Favorites — This or That",
  description:
    "Fragrances you saved for later. Hearts stay on this device until you clear them.",
  alternates: { canonical: "/favorites" },
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
