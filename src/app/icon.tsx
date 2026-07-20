import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/BrandMark";

export const size = {
  width: 64,
  height: 64,
};
export const contentType = "image/png";

/** Amber faceted fragrance-bottle silhouette on dark stone. */
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
        <BrandMark color="#f59e0b" cutoutColor="#1c1917" size={48} />
      </div>
    ),
    { ...size },
  );
}
