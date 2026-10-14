import type { CatalogDeliverySlots } from "@/api/types/catalog";
import { formatClp, formatTimeRange } from "@/shared/format/formatters";
import {
  EmptyState,
  RadioCardGroup,
  Spinner,
  StatusMessage,
} from "@/shared/ui";

export function SlotList({
  slots,
  selectedSlotId,
  isLoading,
  error,
  onSelect,
  onRetry,
}: {
  readonly slots?: CatalogDeliverySlots;
  readonly selectedSlotId: string | null;
  readonly isLoading: boolean;
  readonly error: unknown;
  readonly onSelect: (slotId: string) => void;
  readonly onRetry: () => void;
}) {
  if (isLoading) return <Spinner label="Cargando horarios…" />;
  if (error)
    return (
      <StatusMessage tone="error">
        No fue posible cargar los horarios.{" "}
        <button onClick={onRetry}>Reintentar</button>
      </StatusMessage>
    );
  if (!slots || !slots.slots.some((slot) => slot.status === "AVAILABLE"))
    return (
      <EmptyState title="No hay horarios disponibles.">
        Elige otra fecha.
      </EmptyState>
    );
  return (
    <RadioCardGroup
      label="Horario de despacho"
      orientation="vertical"
      value={selectedSlotId}
      onChange={onSelect}
      options={slots.slots.map((slot) => ({
        value: slot.slotId,
        disabled: slot.status !== "AVAILABLE",
        accessibleLabel: `${formatTimeRange(slot.start, slot.end, slots.timeZone)}, ${formatClp(slot.price)}, ${slot.status === "SOLD_OUT" ? "agotado" : slot.status === "CUTOFF_PASSED" ? "fuera de plazo" : "disponible"}`,
      }))}
      renderOption={(option) => {
        const slot = slots.slots.find((item) => item.slotId === option.value);
        if (!slot) return null;
        return (
          <span>
            {formatTimeRange(slot.start, slot.end, slots.timeZone)}{" "}
            {formatClp(slot.price)}{" "}
            {slot.status === "SOLD_OUT"
              ? "Agotado"
              : slot.status === "CUTOFF_PASSED"
                ? "Fuera de plazo"
                : slot.remainingCapacity <= 3
                  ? `Quedan ${String(slot.remainingCapacity)} cupos`
                  : null}
          </span>
        );
      }}
    />
  );
}
