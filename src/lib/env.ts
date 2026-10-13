function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

export const env = {
  paypalClientId: () => required("PAYPAL_CLIENT_ID"),
  paypalClientSecret: () => required("PAYPAL_CLIENT_SECRET"),
  paypalWebhookId: () => process.env.PAYPAL_WEBHOOK_ID ?? "",
  paypalApiBase: () => process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com",
  /**
   * direct_payee: the order names the seller as payee, so PayPal pays them on capture.
   * platform_payout: the platform is payee and forwards the captured amount with the Payouts API.
   */
  paypalSettlement: () =>
    (process.env.PAYPAL_SETTLEMENT ?? "platform_payout") as "direct_payee" | "platform_payout",
  /** Buyer-paid protection fee in basis points (500 = 5%). Only charged when Clasp is the payee. */
  claspFeeBps: () => Number(process.env.CLASP_FEE_BPS ?? 500),
  openaiApiKey: () => required("OPENAI_API_KEY"),
  openaiModel: () => process.env.OPENAI_MODEL ?? "gpt-6.1-sol",
  /** Public base URL: APP_URL if set to a real host, else Vercel's production domain, else localhost. */
  appUrl: () =>
    process.env.APP_URL && !process.env.APP_URL.includes("localhost")
      ? process.env.APP_URL.replace(/\/$/, "")
      : process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : (process.env.APP_URL ?? "http://localhost:3000"),
};
