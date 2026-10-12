import { env } from "./env";
import { toPayPalValue } from "./money";

export class PayPalError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    readonly debugId: string | null,
  ) {
    const name = (body as { name?: string })?.name ?? "PAYPAL_ERROR";
    const issue = (body as { details?: { issue?: string }[] })?.details?.[0]?.issue;
    super(`PayPal ${status} ${name}${issue ? ` (${issue})` : ""}`);
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const basic = Buffer.from(`${env.paypalClientId()}:${env.paypalClientSecret()}`).toString("base64");
  const res = await fetch(`${env.paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) throw new PayPalError(res.status, body, res.headers.get("paypal-debug-id"));
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  opts: { body?: unknown; requestId?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  // PayPal-Request-Id makes retries of the same money movement idempotent.
  if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId;
  const res = await fetch(`${env.paypalApiBase()}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new PayPalError(res.status, body, res.headers.get("paypal-debug-id"));
  return body as T;
}

type Money = { currency_code: string; value: string };
type Link = { href: string; rel: string; method?: string };

export type Order = {
  id: string;
  status: string;
  purchase_units: {
    payee?: { email_address?: string; merchant_id?: string };
    payments?: { authorizations?: Authorization[]; captures?: Capture[] };
  }[];
  links?: Link[];
};

export type Authorization = {
  id: string;
  status: string;
  amount: Money;
  expiration_time?: string;
  create_time?: string;
};

export type Capture = { id: string; status: string; amount: Money; final_capture?: boolean };

export async function createAuthorizeOrder(input: {
  dealId: string;
  amountCents: number;
  currency: string;
  description: string;
  payeeEmail: string | null;
}): Promise<Order> {
  return call<Order>("POST", "/v2/checkout/orders", {
    requestId: `order-${input.dealId}`,
    body: {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: input.dealId,
          custom_id: input.dealId,
          description: input.description.slice(0, 127),
          amount: { currency_code: input.currency, value: toPayPalValue(input.amountCents) },
          ...(input.payeeEmail ? { payee: { email_address: input.payeeEmail } } : {}),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Clasp",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
          },
        },
      },
    },
  });
}

export async function getOrder(orderId: string): Promise<Order> {
  return call<Order>("GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

/** Turns the buyer's approval into a hold. Nothing moves until a capture. */
export async function authorizeOrder(orderId: string): Promise<Authorization> {
  const order = await call<Order>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
    requestId: `authorize-${orderId}`,
    body: {},
  });
  const auth = order.purchase_units[0]?.payments?.authorizations?.[0];
  if (!auth) throw new Error(`Order ${orderId} authorized but returned no authorization`);
  return auth;
}

export async function getAuthorization(authorizationId: string): Promise<Authorization> {
  return call<Authorization>("GET", `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}`);
}

/**
 * Captures part or all of a hold. finalCapture=false keeps the rest of the hold open
 * for a later capture (rental fee now, damages at return).
 */
export async function captureAuthorization(input: {
  authorizationId: string;
  amountCents: number;
  currency: string;
  finalCapture: boolean;
  requestId: string;
  noteToPayer: string;
}): Promise<Capture> {
  return call<Capture>("POST", `/v2/payments/authorizations/${encodeURIComponent(input.authorizationId)}/capture`, {
    requestId: input.requestId,
    body: {
      amount: { currency_code: input.currency, value: toPayPalValue(input.amountCents) },
      final_capture: input.finalCapture,
      note_to_payer: input.noteToPayer.slice(0, 255),
    },
  });
}

/** Releases whatever is still held. */
export async function voidAuthorization(authorizationId: string, requestId: string): Promise<void> {
  await call("POST", `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, {
    requestId,
  });
}

/** Restarts the 3-day honor period; allowed from day 4 to day 29 of the original authorization. */
export async function reauthorize(authorizationId: string, requestId: string): Promise<Authorization> {
  return call<Authorization>(
    "POST",
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/reauthorize`,
    { requestId, body: {} },
  );
}

/** Used only when PAYPAL_SETTLEMENT=platform_payout. */
export async function payout(input: {
  batchId: string;
  receiverEmail: string;
  amountCents: number;
  currency: string;
  note: string;
}): Promise<{ batch_header: { payout_batch_id: string; batch_status: string } }> {
  return call("POST", "/v1/payments/payouts", {
    requestId: input.batchId,
    body: {
      sender_batch_header: {
        sender_batch_id: input.batchId,
        email_subject: "You've been paid through Clasp",
        email_message: input.note,
      },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: input.receiverEmail,
          amount: { currency: input.currency, value: toPayPalValue(input.amountCents) },
          note: input.note,
          sender_item_id: input.batchId,
        },
      ],
    },
  });
}

export async function verifyWebhookSignature(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = env.paypalWebhookId();
  if (!webhookId) return false;
  const result = await call<{ verification_status: string }>(
    "POST",
    "/v1/notifications/verify-webhook-signature",
    {
      body: {
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      },
    },
  );
  return result.verification_status === "SUCCESS";
}
