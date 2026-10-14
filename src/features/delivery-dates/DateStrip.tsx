import { formatDayMonth, parseCalendarDate } from "@/shared/format/formatters";
import {
  EmptyState,
  RadioCardGroup,
  Spinner,
  StatusMessage,
} from "@/shared/ui";
import type { CatalogDeliveryDates } from "@/api/types/catalog";

export function DateStrip({
  dates,
  selectedDate,
  isLoading,
  error,
  onSelect,
  onRetry,
  onChangeAddress,
}: {
  readonly dates?: CatalogDeliveryDates;
  readonly selectedDate: string | null;
  readonly isLoading: boolean;
  readonly error: unknown;
  readonly onSelect: (date: string) => void;
  readonly onRetry: () => void;
  readonly onChangeAddress: () => void;
}) {
  if (isLoading) return <Spinner label="Cargando fechas…" />;
  if (error)
    return (
      <StatusMessage tone="error">
        No fue posible cargar las fechas.{" "}
        <button onClick={onRetry}>Reintentar</button>
      </StatusMessage>
    );
  if (!dates || !dates.dates.some((date) => date.status === "AVAILABLE"))
    return (
      <EmptyState title="No hay fechas con despacho para esta dirección.">
        <button onClick={onChangeAddress}>Cambiar dirección</button>
      </EmptyState>
    );
  return (
    <div className="delivery-date-strip" data-testid="delivery-date-strip">
      <RadioCardGroup
        label="Fecha de despacho"
        orientation="horizontal"
        value={selectedDate}
        onChange={onSelect}
        options={dates.dates.map((date) => ({
          value: date.date,
          disabled: date.status !== "AVAILABLE",
          accessibleLabel: `${date.label} ${formatDayMonth(parseCalendarDate(date.date))}, ${date.status === "SOLD_OUT" ? "agotado" : date.status === "NO_SERVICE" ? "sin despacho" : "disponible"}`,
        }))}
        renderOption={(option) => {
          const date = dates.dates.find((item) => item.date === option.value);
          if (!date) return null;
          return (
            <span>
              <strong>{date.label}</strong>{" "}
              {formatDayMonth(parseCalendarDate(date.date))}{" "}
              {date.status === "SOLD_OUT"
                ? "Agotado"
                : date.status === "NO_SERVICE"
                  ? "Sin despacho"
                  : null}
            </span>
          );
        }}
      />
    </div>
  );
}
