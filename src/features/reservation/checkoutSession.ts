import { newOrderId } from "@/shared/ids/randomIds";
import { sessionStore } from "@/shared/storage/sessionStore";

export interface CheckoutSession {
  readonly customerId: string;
  readonly orderId: string;
  readonly holdId?: string;
  readonly reservationId?: string;
}

const KEY = "checkout";

export function readCheckoutSession(): CheckoutSession | undefined {
  return sessionStore.read(KEY, isCheckoutSession);
}

export function writeCheckoutSession(session: CheckoutSession): void {
  sessionStore.write(KEY, session);
}

export function newCheckoutSession(customerId: string): CheckoutSession {
  return { customerId, orderId: newOrderId() };
}

function isCheckoutSession(value: unknown): value is CheckoutSession {
  if (value === null || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.customerId === "string" &&
    typeof session.orderId === "string" &&
    (session.holdId === undefined || typeof session.holdId === "string") &&
    (session.reservationId === undefined ||
      typeof session.reservationId === "string")
  );
}
