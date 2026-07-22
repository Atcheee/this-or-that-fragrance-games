import { GeistMono } from "geist/font/mono";
import "./play.css";

export default function PlayLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={GeistMono.variable}>{children}</div>;
}
