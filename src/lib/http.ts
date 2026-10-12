import { NextResponse } from "next/server";
import { PayPalError } from "./paypal";
import { HttpError } from "./store";

/** Wraps a route handler so failures come back as readable JSON errors. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<unknown>) {
  return async (...args: Args) => {
    try {
      const result = await fn(...args);
      return result instanceof Response ? result : NextResponse.json(result);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof PayPalError) {
        console.error(err.message, err.debugId, JSON.stringify(err.body));
        return NextResponse.json(
          { error: err.message, paypalDebugId: err.debugId, details: err.body },
          { status: 502 },
        );
      }
      console.error(err);
      return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 });
    }
  };
}

export type RouteCtx = { params: Promise<{ id: string }> };
