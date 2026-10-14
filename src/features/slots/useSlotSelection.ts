import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "@/api/ApiClientProvider";
import type { ApiError } from "@/api/http/apiError";
import { queryKeys } from "@/api/queryKeys";
type CoveredAddressInput = {
  readonly query: {
    readonly comunaCode: string;
    readonly latitude?: number;
    readonly longitude?: number;
  };
};

export function useSlotSelection(
  date: string | null,
  address: CoveredAddressInput | null,
) {
  const api = useApiClient();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);
  const query = useQuery({
    queryKey:
      date && address
        ? queryKeys.catalog.slots(date, address.query)
        : ["catalog", "slots", "none"],
    queryFn: () => {
      if (!date || !address)
        throw new Error("Se requieren fecha y dirección cubierta.");
      return api.catalog.listDeliverySlots(date, address.query);
    },
    enabled: date !== null && address !== null,
  });
  useEffect(() => {
    const slots = query.data?.slots;
    if (!slots) return;
    const wanted = pendingSlotId ?? selectedSlotId;
    const next = slots.some(
      (slot) => slot.slotId === wanted && slot.status === "AVAILABLE",
    )
      ? wanted
      : null;
    const timer = window.setTimeout(() => {
      setSelectedSlotId(next);
      setPendingSlotId(null);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query.data, pendingSlotId, selectedSlotId]);
  const selectedSlot =
    query.data?.slots.find((slot) => slot.slotId === selectedSlotId) ?? null;
  return {
    slots: query.data,
    isLoading: query.isLoading,
    error: (query.error as ApiError | null) ?? null,
    selectedSlot,
    select(slotId: string) {
      if (
        query.data?.slots.some(
          (slot) => slot.slotId === slotId && slot.status === "AVAILABLE",
        )
      )
        setSelectedSlotId(slotId);
    },
    clear() {
      setSelectedSlotId(null);
    },
    preselect(slotId: string) {
      setPendingSlotId(slotId);
    },
    retry: query.refetch,
  };
}
