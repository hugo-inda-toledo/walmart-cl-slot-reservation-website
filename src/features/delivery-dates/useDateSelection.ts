import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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

export function useDateSelection(address: CoveredAddressInput | null) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const addressKey = address
    ? `${address.query.comunaCode}:${String(address.query.latitude)}:${String(address.query.longitude)}`
    : "none";
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [notice, setNotice] = useState<"dateUnavailable" | null>(null);
  const [allowedRange, setAllowedRange] = useState<{
    readonly minDate: string;
    readonly maxDate: string;
    readonly addressKey: string;
  } | null>(null);
  const query = useQuery({
    queryKey: address
      ? queryKeys.catalog.dates(address.query)
      : ["catalog", "dates", "none"],
    queryFn: () => {
      if (!address) throw new Error("Se requiere una dirección cubierta.");
      return api.catalog.listDeliveryDates(address.query);
    },
    enabled: address !== null,
  });
  useEffect(() => {
    const dates = query.data?.dates.filter(
      (date) =>
        allowedRange === null ||
        allowedRange.addressKey !== addressKey ||
        (date.date >= allowedRange.minDate &&
          date.date <= allowedRange.maxDate),
    );
    if (!dates) return;
    const stillAvailable = dates.some(
      (date) => date.date === selectedDate && date.status === "AVAILABLE",
    );
    if (!stillAvailable) {
      const timer = window.setTimeout(() => {
        setSelectedDate(
          dates.find((date) => date.status === "AVAILABLE")?.date ?? null,
        );
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [addressKey, allowedRange, query.data, selectedDate]);
  return {
    dates: query.data,
    isLoading: query.isLoading,
    error: (query.error as ApiError | null) ?? null,
    selectedDate,
    notice,
    select(date: string) {
      if (
        query.data?.dates.some(
          (item) => item.date === date && item.status === "AVAILABLE",
        )
      )
        setSelectedDate(date);
    },
    handleOutOfRange(problem: {
      readonly minDate: string;
      readonly maxDate: string;
    }) {
      setNotice("dateUnavailable");
      setAllowedRange({
        minDate: problem.minDate,
        maxDate: problem.maxDate,
        addressKey,
      });
      setSelectedDate(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all });
    },
    retry: query.refetch,
  };
}
