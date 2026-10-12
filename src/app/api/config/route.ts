import { env } from "@/lib/env";
import { handler } from "@/lib/http";

// The client ID is browser-safe by design; the secret never leaves the server.
export const GET = handler(async () => ({
  clientId: env.paypalClientId(),
  sdkUrl: env.paypalApiBase().includes("sandbox")
    ? "https://www.sandbox.paypal.com/web-sdk/v6/core"
    : "https://www.paypal.com/web-sdk/v6/core",
}));
