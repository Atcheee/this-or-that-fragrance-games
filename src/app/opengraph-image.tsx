import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/BrandMark";

export const alt = "This or That — Fragrance Games";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(145deg, #1c1917 0%, #292524 55%, #33230a 100%)",
          color: "#ece8e1",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#1c1917",
              borderRadius: 18,
              border: "2px solid #f59e0b",
            }}
          >
            <BrandMark color="#f59e0b" cutoutColor="#1c1917" size={54} />
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#f59e0b",
            }}
          >
            This or That
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              maxWidth: 900,
            }}
          >
            Fragrance Games
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#a8a29e",
              maxWidth: 820,
              lineHeight: 1.35,
            }}
          >
            Test your nose-knowledge: ratings, prices, notes, accords, houses
            and more.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
