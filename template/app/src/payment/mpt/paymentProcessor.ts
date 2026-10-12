import {
  type CreateCheckoutSessionArgs,
  type PaymentProcessor,
} from "../paymentProcessor";
import { prettyPaymentPlanName } from "../plans";
import { updateUserPaymentProcessorUserId } from "../user";
import { getMptPlanAmountEur } from "./checkoutUtils";
import { createMptPaymentIntent } from "./mptClient";
import { mptMiddlewareConfigFn, mptWebhook } from "./webhook";

export const mptPaymentProcessor: PaymentProcessor = {
  id: "mpt",
  createCheckoutSession: async ({
    userId,
    paymentPlan,
    prismaUserDelegate,
  }: CreateCheckoutSessionArgs) => {
    // A SEPA transfer is a one-time push payment, so MPT cannot renew a
    // subscription on its own.
    if (paymentPlan.effect.kind !== "credits") {
      throw new Error(
        `MPT supports one-time payment plans only, "${paymentPlan.id}" is a subscription`,
      );
    }

    // MPT has no customer object, so the Open SaaS user id doubles as the
    // payment processor user id that the webhook looks the user up by.
    await updateUserPaymentProcessorUserId(
      { userId, paymentProcessorUserId: userId },
      prismaUserDelegate,
    );

    const intent = await createMptPaymentIntent({
      amountEur: getMptPlanAmountEur(paymentPlan),
      label: prettyPaymentPlanName(paymentPlan.id),
      metadata: { userId, paymentPlanId: paymentPlan.id },
    });

    return {
      session: {
        id: intent.sid,
        url: intent.checkout_url,
      },
    };
  },
  // MPT has no customer portal: there is no subscription to manage.
  fetchCustomerPortalUrl: async () => null,
  webhook: mptWebhook,
  webhookMiddlewareConfigFn: mptMiddlewareConfigFn,
  // MPT does not expose a revenue listing yet.
  fetchTotalRevenue: async () => 0,
};
