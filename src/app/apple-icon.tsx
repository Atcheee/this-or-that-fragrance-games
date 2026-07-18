import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 40,
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
              width: 36,
              height: 14,
              background: "#f59e0b",
              borderRadius: 4,
            }}
          />
          <div
            style={{
              width: 16,
              height: 18,
              background: "#f59e0b",
            }}
          />
          <div
            style={{
              width: 72,
              height: 78,
              background: "#f59e0b",
              borderRadius: "14px 14px 24px 24px",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
