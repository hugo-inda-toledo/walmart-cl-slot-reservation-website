/**
 * Copia temporal de las extensiones de Problem de geo-coverage, delivery-slot-catalog
 * y slot-reservation. Eliminar al publicar los schemas tipados upstream.
 */
const uuid = { type: "string", format: "uuid" };
const date = { type: "string", format: "date" };
const dateTime = { type: "string", format: "date-time" };

function required(
  properties: Record<string, object>,
  optional: readonly string[] = [],
): object {
  return {
    type: "object",
    required: Object.keys(properties).filter((key) => !optional.includes(key)),
    properties,
  };
}

export const problemExtensions: Readonly<Record<string, object>> = {
  ACTIVE_HOLD_EXISTS: required({ holdId: uuid }),
  ORDER_ALREADY_RESERVED: required({ reservationId: uuid }),
  HOLD_EXPIRED: required({ holdId: uuid, expiresAt: dateTime }),
  HOLD_NOT_ACTIVE: required(
    {
      holdId: uuid,
      holdStatus: { enum: ["ACTIVE", "CONFIRMED", "RELEASED", "EXPIRED"] },
      reservationId: uuid,
    },
    ["reservationId"],
  ),
  HOLD_NOT_FOUND: required({ holdId: uuid }),
  SLOT_NOT_FOUND: required({ slotId: uuid }),
  SLOT_NO_SERVICE: required({ slotId: uuid, deliveryDate: date }),
  SLOT_CUTOFF_PASSED: required({ slotId: uuid, cutoffAt: dateTime }),
  RESERVATION_NOT_FOUND: required({ reservationId: uuid }),
  IDEMPOTENCY_REQUEST_IN_PROGRESS: required({
    retryAfterSeconds: { type: "integer", minimum: 1 },
  }),
  DELIVERY_DATE_OUT_OF_RANGE: required({ date, minDate: date, maxDate: date }),
  UNKNOWN_COMUNA: required({ comunaCode: { type: "string" } }),
  REGION_NOT_FOUND: required({ regionCode: { type: "string" } }),
};
