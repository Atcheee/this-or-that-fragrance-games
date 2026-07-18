import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};
export const contentType = "image/png";

/** Amber perfume-bottle mark on dark stone — matches site branding. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1917",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 14,
              height: 5,
              background: "#f59e0b",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              width: 6,
              height: 7,
              background: "#f59e0b",
            }}
          />
          <div
            style={{
              width: 28,
              height: 30,
              background: "#f59e0b",
              borderRadius: "6px 6px 10px 10px",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
