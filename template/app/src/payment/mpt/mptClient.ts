import { env } from "wasp/server";

/**
 * Minimal client for the MPT payment intent API.
 *
 * MPT turns a SEPA bank transfer into EURe (Monerium e-money on Gnosis Chain)
 * and forwards it to your Safe. Whether you hit Monerium's sandbox or
 * production is decided by the MPT key: a sandbox key works against
 * `api.monerium.dev`, a production key against `api.monerium.app`.
 */

export interface MptPaymentIntent {
  sid: string;
  checkout_url: string;
  status_url: string;
  amount_eur: string;
  expires_at: string;
}

interface CreateMptPaymentIntentArgs {
  amountEur: string;
  label: string;
  metadata: Record<string, string>;
}

// SEPA transfers that are not instant can take a business day, so the intent
// stays open for the maximum MPT allows.
const INTENT_TTL_SECONDS = 24 * 60 * 60;

export async function createMptPaymentIntent({
  amountEur,
  label,
  metadata,
}: CreateMptPaymentIntentArgs): Promise<MptPaymentIntent> {
  const response = await fetch(new URL("/api/intents", env.MPT_API_URL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.MPT_SECRET_KEY}`,
    },
    body: JSON.stringify({
      target_address: env.MPT_TARGET_ADDRESS,
      amount_eur: amountEur,
      label,
      metadata,
      expires_in_seconds: INTENT_TTL_SECONDS,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `MPT payment intent failed with status ${response.status}: ${body}`,
    );
  }

  return (await response.json()) as MptPaymentIntent;
}
