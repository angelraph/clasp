import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** App icon (browser tab, notifications, Home Screen). */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#11141b", color: "white", fontSize: 320, fontWeight: 700, borderRadius: 112 }}>
        C
      </div>
    ),
    size,
  );
}
