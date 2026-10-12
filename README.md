# Clasp

**Pay strangers like you trust them.** PayPal holds the money. AI checks the item at the handoff. Money moves only when the thing does.

Clasp secures any handoff between strangers, whether the item changes owners (a sale) or comes back (a rental).

## The problem

- Peer-to-peer marketplaces have no safe way to pay. A UK bank (TSB) contacted 100 Facebook Marketplace sellers and found 34% of the listings were fraudulent.
- Online shopping was the second most-reported fraud category in the FTC's 2024 data, a year with $12.5B in reported fraud losses.
- Cash and instant transfers protect nobody. Sellers fear "empty box" claims, buyers fear swapped or locked devices, and rental owners and renters argue over deposits from memory.

Escrow apps already exist, but in each one a person clicks "received" to release the money. Clasp releases it when the item is **proven**.

## How it works

### Sale
1. **Possession proof.** The seller writes a one-time code on paper and photographs it next to the item, with the serial or IMEI visible. The AI reads the code and the identifier. Code rejects misreads (IMEIs are Luhn-checked) and verifies the listing.
2. **PayPal hold.** The buyer approves in PayPal. The order uses `intent: AUTHORIZE` with the seller as `payee`. The funds are held, not charged.
3. **Handoff scan.** The buyer photographs the item in hand. The model reads identifiers and the Find My screen, **without being told what it should match**. Plain code compares:
   - Match → `capture` → the seller is paid.
   - Mismatch or locked → no capture. The hold stays or is voided.

### Rental
One authorization covers the fee plus the deposit.
1. **Pickup.** The renter records condition and accessories. The fee is captured with `final_capture: false`, and the deposit stays held.
2. **Return.** The owner scans the item back. The AI compares it with the pickup photos.
3. **Settle.** Code charges only confident findings that match the owner's **pre-agreed** price table, capped at the deposit, with `final_capture: true`. A clean return voids the hold.

### The rule
The model reports. Code decides. The model never sees prices it could change, never calls PayPal, and can't add a charge. Everything is in [`src/lib/policy.ts`](src/lib/policy.ts), with unit tests in [`src/lib/policy.test.ts`](src/lib/policy.test.ts).

## PayPal integration

| Capability | Where |
|---|---|
| JS SDK v6 PayPal button, one-time payment session | `src/components/PayButton.tsx` |
| Orders v2 `intent: AUTHORIZE`, `payee` | `createAuthorizeOrder` in `src/lib/paypal.ts` |
| Authorize order | `authorizeOrder` |
| Partial and final captures (`final_capture`) | `captureAuthorization` |
| Void | `voidAuthorization` |
| Reauthorize after the 3-day honor period (to day 29) | `reauthorize`, `ensureFreshHold` in `src/lib/store.ts` |
| Payouts (optional platform settlement mode) | `payout` |
| Webhooks with signature verification | `src/app/api/webhooks/paypal/route.ts` |
| `PayPal-Request-Id` idempotency on every money movement | `call()` in `src/lib/paypal.ts` |

## AI

- **OpenAI Responses API** with image input and strict structured outputs (Zod schemas). See `src/lib/vision.ts`.
- **Model:** set with `OPENAI_MODEL`.
- **Uses:**
  - Reading the possession code, IMEI or serial numbers, and battery and lock screens
  - Condition notes
  - Accessory inventory
  - Pickup-vs-return damage comparison against a fixed list of damage categories

## Run it locally

Requirements: Node 20+, a PayPal sandbox app, an OpenAI API key.

```bash
npm install
cp .env.example .env.local   # fill in PayPal + OpenAI values
npm run dev
```

Open http://localhost:3000. No database setup is needed: without `DATABASE_URL`, Clasp uses an embedded Postgres (PGlite) stored in `./.data`.

Run the policy tests:

```bash
npm test
```

### Test the full flow with PayPal sandbox accounts
1. Create a sale listing. Use a US sandbox **Business** account email as the PayPal email.
2. Verify it with photos: the code on paper next to the phone, plus the IMEI screen.
3. Open the listing link in another browser and pay with a US sandbox **Personal** account.
4. In the deal room, scan the item. A different phone is refused. The listed phone releases the payment.

## Deploy

`render.yaml` is a Render Blueprint for the web service plus Postgres. Fill in the secrets when Render prompts, then add the webhook (see [SETUP.md](SETUP.md)).

## Honest limits

- Runs on the PayPal **sandbox**.
- Production would use PayPal's partner platform features (platform fees, delayed disbursement), which need PayPal approval.
- The vision model reads; it is not a certified inspector. Anything below the confidence threshold is flagged, never charged.
- Activation-lock status comes from the device's own screen. A blacklist or IMEI database check is not included.

## License

MIT
