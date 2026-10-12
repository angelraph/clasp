/**
 * The vision model reads photos and reports what it sees, with confidences.
 * It never sees prices it could change, never sees the identifier it is supposed
 * to match, and never calls PayPal. policy.ts makes every decision.
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "./env";

export type Photo = { mime: string; data: Uint8Array };

let client: OpenAI | null = null;
function openai(): OpenAI {
  client ??= new OpenAI({ apiKey: env.openaiApiKey() });
  return client;
}

function photoContent(photos: Photo[], label = "Photo") {
  return photos.flatMap((p, i) => [
    { type: "input_text" as const, text: `${label} ${i}:` },
    {
      type: "input_image" as const,
      detail: "high" as const,
      image_url: `data:${p.mime};base64,${Buffer.from(p.data).toString("base64")}`,
    },
  ]);
}

async function read<T extends z.ZodType>(
  schema: T,
  name: string,
  instructions: string,
  content: ReturnType<typeof photoContent>,
): Promise<z.infer<T>> {
  const response = await openai().responses.parse({
    model: env.openaiModel(),
    instructions,
    input: [{ role: "user", content }],
    text: { format: zodTextFormat(schema, name) },
  });
  if (!response.output_parsed) throw new Error("Vision model returned no structured output");
  return response.output_parsed as z.infer<T>;
}

const identifierRead = z.object({
  kind: z.string().describe('"IMEI", "SERIAL", or another identifier type printed on the item or shown on its settings screen'),
  value: z.string().describe("Exactly the characters visible. Do not guess hidden or blurred characters."),
  confidence: z.number().describe("0 to 1: how sure you are every character is read correctly"),
  photoIndex: z.number().int(),
});

const RULES = `Report only what is visible. If something is blurred, cropped, or ambiguous, lower your confidence instead of guessing. Never invent characters.`;

// ---------------------------------------------------------------- listing

const listingSchema = z.object({
  codeSeen: z.string().nullable().describe("The handwritten or displayed 4-character code next to the item, or null"),
  codeConfidence: z.number(),
  codePhotoIndex: z.number().int().nullable(),
  itemVisibleWithCode: z.boolean().describe("True if the item itself is in the same photo as the code"),
  category: z.string().describe("Short lowercase description of what the item is, in your own words"),
  make: z.string().nullable(),
  model: z.string().nullable(),
  identifiers: z.array(identifierRead).describe("Serial numbers, IMEIs, frame numbers, SKU tags or similar unique codes, if any are visible"),
  distinctiveFeatures: z
    .array(z.object({ feature: z.string(), confidence: z.number() }))
    .describe(
      'Marks that would tell THIS exact item apart from an identical new one: specific scratches, dents, stains, stickers, engravings, repairs, wear patterns, with location (e.g. "scuff on left heel", "sticker on lid near hinge"). Not generic features every unit has.',
    ),
  hasAntiTheftLock: z
    .boolean()
    .describe("True only if this kind of item has an owner-account anti-theft lock (e.g. smartphones, tablets, some laptops and watches)"),
  batteryHealthPercent: z.number().nullable().describe("Only if a battery health screen is visible"),
  conditionNotes: z.array(z.string()).describe("Specific visible wear: scratches, dents, cracks, with location"),
});
export type ListingReading = z.infer<typeof listingSchema>;

export function inspectListing(photos: Photo[], title: string): Promise<ListingReading> {
  return read(
    listingSchema,
    "listing_inspection",
    `You inspect photos a seller took to list an item (they called it "${title}"; trust the photos over the title). One photo should show a short code written on paper next to the item. Read that code, identify the item, read any serial number or other unique code (on a label, engraving, or a settings/About screen; a dual-SIM phone shows two IMEIs, report both), list marks unique to this exact item, and note visible condition. ${RULES}`,
    photoContent(photos),
  );
}

// ---------------------------------------------------------------- sale handoff

function handoffSchema(features: string[]) {
  return z.object({
  identifiers: z.array(identifierRead),
  featureChecks: z
    .array(
      z.object({
        feature: features.length ? z.enum(features as [string, ...string[]]) : z.string(),
        status: z
          .enum(["seen", "absent", "not_in_view"])
          .describe('"seen" if this exact mark is on the item, "absent" if that part of the item is clearly visible and the mark is NOT there, "not_in_view" if that part isn\'t shown'),
        confidence: z.number(),
      }),
    )
    .describe("One entry per listed mark"),
  lockStatus: z
    .enum(["off", "on", "not_shown"])
    .describe(
      'The main owner-location/anti-theft switch as shown on screen: iPhone "Find My iPhone", Android/Google "Find Hub" (formerly "Find My Device"; switch often labelled "Allow device to be located" or "Use Find Hub"), or a brand equivalent (e.g. OPPO/ColorOS "Find My Phone", Samsung "Find My Mobile"). "off" if that main switch is clearly off, "on" if it is clearly on, "not_shown" if that main switch is not visible (a sub-setting like offline finding does not count).',
    ),
  notes: z.array(z.string()),
  });
}
export type HandoffReading = z.infer<ReturnType<typeof handoffSchema>>;

/**
 * Expected identifier VALUES are deliberately withheld so the model can't be led into a
 * match; it only transcribes. Marks are named so it can look for each one, and must say
 * when one is clearly absent.
 */
export function readHandoff(photos: Photo[], input: { kinds: string[]; features: string[] }): Promise<HandoffReading> {
  const marks = input.features.length
    ? `Then check each of these marks recorded when the item was listed: ${input.features.map((f) => `"${f}"`).join(", ")}.`
    : "";
  return read(
    handoffSchema(input.features),
    "handoff_reading",
    `A buyer is photographing an item at a handoff. Transcribe every ${input.kinds.length ? input.kinds.join(" / ") + ", " : ""}serial number or unique code visible (a dual-SIM phone shows two IMEIs; report both). ${marks} Also report whether a device anti-theft/location screen (iPhone Find My, Android Find Hub / Find My Device, or a brand equivalent) is shown, and whether its main switch is on or off. Photos may show only part of the evidence (e.g. just the lock screen); that's expected. ${RULES}`,
    photoContent(photos),
  );
}

// ---------------------------------------------------------------- rental

function accessorySchema(names: string[]) {
  return z.array(
    z.object({
      name: names.length ? z.enum(names as [string, ...string[]]) : z.string(),
      present: z.boolean(),
      confidence: z.number(),
    }),
  );
}

export async function inspectPickup(photos: Photo[], accessoryNames: string[]) {
  const schema = z.object({
    accessories: accessorySchema(accessoryNames),
    conditionNotes: z.array(z.string()).describe("Every visible mark, scratch, dent or defect, with location"),
  });
  return read(
    schema,
    "pickup_inspection",
    `This is the condition record at the start of a rental. For each listed accessory (${accessoryNames.join(", ") || "none"}), say whether it is visible. Then record every existing mark on the item so it isn't blamed on the renter later. ${RULES}`,
    photoContent(photos),
  );
}

export async function inspectReturn(input: {
  pickupPhotos: Photo[];
  returnPhotos: Photo[];
  pickupNotes: string[];
  accessoryNames: string[];
  damageRules: { id: string; label: string }[];
}) {
  const ruleIds = input.damageRules.map((r) => r.id);
  const schema = z.object({
    accessories: accessorySchema(input.accessoryNames),
    newDamage: z.array(
      z.object({
        description: z.string(),
        ruleId: (ruleIds.length ? z.enum(ruleIds as [string, ...string[]]) : z.string()).nullable()
          .describe("The damage category this matches, or null if none fits"),
        confidence: z.number().describe("How sure you are this is NEW since pickup, not pre-existing"),
        photoIndex: z.number().int().nullable().describe("Index of the RETURN photo that shows it"),
      }),
    ),
  });
  const rules = input.damageRules.map((r) => `- ${r.id}: ${r.label}`).join("\n") || "(none)";
  return read(
    schema,
    "return_inspection",
    `Compare an item at the end of a rental against its condition at pickup. Report accessories present at return, and only damage that is NEW since pickup. Damage already recorded at pickup is not new: ${JSON.stringify(input.pickupNotes)}. Damage categories:\n${rules}\n${RULES}`,
    [
      ...photoContent(input.pickupPhotos, "PICKUP photo"),
      ...photoContent(input.returnPhotos, "RETURN photo"),
    ],
  );
}
