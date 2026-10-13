import type { MetadataRoute } from "next";

/** Installable app: required on iPhone for web push, and nicer on Android. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clasp",
    short_name: "Clasp",
    description: "Pay strangers like you trust them. PayPal holds the money; AI checks the item at the handoff.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#11141b",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
