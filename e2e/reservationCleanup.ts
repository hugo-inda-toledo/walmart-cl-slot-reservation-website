import type { Page } from "@playwright/test";

interface CleanupResponse {
  ok(): boolean;
  status(): number;
  statusText(): string;
}

interface CheckoutSession {
  readonly customerId?: string;
  readonly holdId?: string;
  readonly reservationId?: string;
}

const checkoutStorageKey = "wcsr:checkout";

async function readCheckoutSession(page: Page): Promise<CheckoutSession> {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as CheckoutSession;
    } catch {
      return {};
    }
  }, checkoutStorageKey);
}

export async function cleanupReservation(page: Page): Promise<void> {
  const session = await readCheckoutSession(page);
  const customerId = session.customerId;
  if (!customerId) return;

  const reservationLabel = page.getByText(/Identificador de reserva:/);
  const reservationId =
    session.reservationId ??
    ((await reservationLabel.count()) > 0
      ? (await reservationLabel.first().textContent())
          ?.replace("Identificador de reserva:", "")
          .trim()
      : undefined);

  if (reservationId) {
    const response = await page.request.post(
      `/api/v1/reservations/${reservationId}/cancel`,
      {
        headers: { "X-Customer-Id": customerId },
      },
    );
    assertSuccessfulCleanup("cancelar la reserva", response);
    return;
  }

  if (session.holdId) {
    const response = await page.request.delete(
      `/api/v1/slot-holds/${session.holdId}`,
      {
        headers: { "X-Customer-Id": customerId },
      },
    );
    assertSuccessfulCleanup("liberar la retención", response);
  }
}

export function assertSuccessfulCleanup(
  action: string,
  response: CleanupResponse,
): void {
  if (!response.ok())
    throw new Error(
      `No fue posible ${action}: ${String(response.status())} ${response.statusText()}`,
    );
}
