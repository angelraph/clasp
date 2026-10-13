import { ImageResponse } from "next/og";
import { loadPhotos } from "./store";

export const OG_SIZE = { width: 1200, height: 630 };

async function photoDataUrl(photoId: string | null): Promise<string | null> {
  if (!photoId) return null;
  const [photo] = await loadPhotos([photoId]);
  if (!photo || !/jpeg|png/.test(photo.mime)) return null;
  return `data:${photo.mime};base64,${Buffer.from(photo.data).toString("base64")}`;
}

/** The preview card shown when a Clasp link is pasted into WhatsApp, Facebook, X, iMessage. */
export async function ogCard(input: {
  badge: string;
  title: string;
  line: string;
  footer: string;
  photoId: string | null;
}) {
  const photo = await photoDataUrl(input.photoId);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#11141b", color: "white", fontFamily: "sans-serif" }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={480} height={630} style={{ objectFit: "cover", width: 480, height: 630 }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 12, background: "white", color: "#11141b", fontSize: 30, fontWeight: 700 }}>
              C
            </div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>Clasp</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignSelf: "flex-start", background: "#067647", borderRadius: 999, padding: "8px 20px", fontSize: 26, fontWeight: 600 }}>
              {input.badge}
            </div>
            <div style={{ fontSize: photo ? 52 : 64, fontWeight: 700, lineHeight: 1.1 }}>{input.title.slice(0, 70)}</div>
            <div style={{ fontSize: 30, color: "#b6bdcb", lineHeight: 1.3 }}>{input.line}</div>
          </div>
          <div style={{ fontSize: 24, color: "#b6bdcb" }}>{input.footer}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
