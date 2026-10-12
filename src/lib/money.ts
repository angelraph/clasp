/** All amounts are integer cents internally; PayPal wants a decimal string. */
export function toPayPalValue(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`Invalid amount in cents: ${cents}`);
  return (cents / 100).toFixed(2);
}

export function parseDollarsToCents(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error(`Not a valid amount: ${input}`);
  return Math.round(Number(cleaned) * 100);
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
