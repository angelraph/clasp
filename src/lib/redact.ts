/**
 * Privacy before storage: every uploaded photo is checked for other people's personal
 * information (phone numbers, names, messages, faces...) and those areas are pixelated
 * before anything is saved. The original is never stored. If the check can't run, the
 * upload is refused rather than stored unredacted.
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import sharp, { type OverlayOptions } from "sharp";
import { z } from "zod";
import { env } from "./env";

const regionsSchema = z.object({
  regions: z.array(
    z.object({
      kind: z.enum(["phone_number", "name", "message", "notification", "email", "address", "face", "account_or_card", "other_personal"]),
      description: z.string(),
      x: z.number().describe("Left edge, 0-1 fraction of image width"),
      y: z.number().describe("Top edge, 0-1 fraction of image height"),
      width: z.number().describe("0-1 fraction of image width"),
      height: z.number().describe("0-1 fraction of image height"),
    }),
  ),
});
export type Region = z.infer<typeof regionsSchema>["regions"][number];

const INSTRUCTIONS = `You protect privacy in photos used to verify second-hand items. Find every area showing personal information about anyone: phone numbers, contact or caller names, call logs and contact lists, chat messages, notification banners, email addresses, account names, postal addresses, faces, card or bank numbers, and anything else identifying a person.

Do NOT mark: the item's own serial number, IMEI, model number or battery figures; a short handwritten code on paper; the physical item; on/off switches and their labels.

Return a tight box around each personal area, as fractions of the image (0 = left/top, 1 = right/bottom). Group adjacent lines of the same kind into one box. If there is nothing personal, return an empty list.`;

let client: OpenAI | null = null;

export async function findPersonalRegions(data: Uint8Array, mime: string): Promise<Region[]> {
  client ??= new OpenAI({ apiKey: env.openaiApiKey() });
  const res = await client.responses.parse({
    model: env.openaiModel(),
    instructions: INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [{ type: "input_image", detail: "high", image_url: `data:${mime};base64,${Buffer.from(data).toString("base64")}` }],
      },
    ],
    text: { format: zodTextFormat(regionsSchema, "personal_regions") },
  });
  if (!res.output_parsed) throw new Error("Privacy check returned no result");
  return res.output_parsed.regions;
}

/** Pixelates each region (with a margin, since boxes are approximate). Returns a JPEG. */
export async function pixelate(data: Uint8Array, regions: Region[]): Promise<Uint8Array> {
  const base = sharp(Buffer.from(data)).rotate(); // honor EXIF orientation before measuring
  const { data: oriented, info } = await base.toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const overlays: OverlayOptions[] = [];
  for (const r of regions) {
    const padX = 0.02 * W;
    const padY = 0.015 * H;
    const left = Math.max(0, Math.floor(r.x * W - padX));
    const top = Math.max(0, Math.floor(r.y * H - padY));
    const width = Math.min(W - left, Math.ceil(r.width * W + 2 * padX));
    const height = Math.min(H - top, Math.ceil(r.height * H + 2 * padY));
    if (width < 4 || height < 4) continue;
    const block = Math.max(10, Math.round(Math.min(width, height) / 5));
    // Two separate pipelines: sharp applies only the last resize() of a pipeline, so
    // shrinking and enlarging in one chain would return the region unchanged.
    const small = await sharp(oriented)
      .extract({ left, top, width, height })
      .resize(Math.max(1, Math.round(width / block)), Math.max(1, Math.round(height / block)), { kernel: "nearest" })
      .toBuffer();
    const tile = await sharp(small).resize(width, height, { kernel: "nearest" }).blur(2).toBuffer();
    overlays.push({ input: tile, left, top });
  }
  const out = await sharp(oriented).composite(overlays).jpeg({ quality: 86 }).toBuffer();
  return new Uint8Array(out);
}

/** Checks and cleans one photo. Always returns a re-encoded JPEG without metadata. */
export async function redactPhoto(data: Uint8Array, mime: string): Promise<{ data: Uint8Array; mime: string; regions: Region[] }> {
  const regions = await findPersonalRegions(data, mime);
  // Re-encoding also strips EXIF (GPS location, device serials) from every photo.
  const cleaned = await pixelate(data, regions);
  return { data: cleaned, mime: "image/jpeg", regions };
}
