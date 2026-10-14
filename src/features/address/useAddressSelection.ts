/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";

import { useApiClient } from "@/api/ApiClientProvider";
import type { ApiError } from "@/api/http/apiError";
import { sessionStore } from "@/shared/storage/sessionStore";

import {
  type AddressField,
  type AddressStatus,
  type SelectedAddress,
  validateAddressForm,
} from "./addressModel";

const isAddress = (value: unknown): value is SelectedAddress =>
  typeof value === "object" &&
  value !== null &&
  "street" in value &&
  "number" in value &&
  "comuna" in value;

function fieldErrors(error: ApiError): Partial<Record<AddressField, string>> {
  if (error.kind !== "problem") return {};
  const fields: Partial<Record<AddressField, string>> = {};
  for (const entry of error.problem.fieldErrors) {
    if (
      entry.field === "street" ||
      entry.field === "number" ||
      entry.field === "comunaCode"
    )
      fields[entry.field] = entry.message;
  }
  return fields;
}

export function useAddressSelection() {
  const api = useApiClient();
  const [status, setStatus] = useState<AddressStatus>({ kind: "none" });
  const submit = useCallback(
    async (address: SelectedAddress) => {
      const localErrors = validateAddressForm({
        street: address.street,
        number: address.number,
        comunaCode: address.comuna.code,
      });
      if (Object.keys(localErrors).length) {
        setStatus({ kind: "invalid", address, fieldErrors: localErrors });
        return;
      }
      // Persist the submitted address before the request: a rejected coverage
      // check must still be re-verified when the tab is restored.
      sessionStore.write("address", address);
      setStatus({ kind: "checking", address });
      try {
        const resolved = await api.geo.resolveCoverage({
          street: address.street,
          number: address.number,
          comunaCode: address.comuna.code,
          ...(address.latitude !== undefined && address.longitude !== undefined
            ? { latitude: address.latitude, longitude: address.longitude }
            : {}),
        });
        setStatus({
          kind: "covered",
          address: {
            ...address,
            zone: resolved.zone,
            resolvedComuna: resolved.comuna,
            query: {
              comunaCode: address.comuna.code,
              ...(address.latitude !== undefined &&
              address.longitude !== undefined
                ? { latitude: address.latitude, longitude: address.longitude }
                : {}),
            },
          },
        });
      } catch (unknownError) {
        const error = unknownError as ApiError;
        if (
          error.kind === "problem" &&
          error.problem.code === "ADDRESS_NOT_COVERED"
        )
          setStatus({
            kind: "notCovered",
            address,
            reason: error.problem.reason,
          });
        else if (
          error.kind === "problem" &&
          (error.problem.code === "UNKNOWN_COMUNA" ||
            error.problem.code === "INCOMPLETE_COORDINATES" ||
            error.problem.code === "INVALID_COORDINATES" ||
            error.problem.code === "VALIDATION_ERROR")
        )
          setStatus({
            kind: "invalid",
            address,
            fieldErrors: fieldErrors(error),
          });
        else setStatus({ kind: "error", address, error });
      }
    },
    [api],
  );
  const retry = useCallback(() => {
    if (status.kind !== "none") void submit(status.address);
  }, [status, submit]);
  const markNotCovered = useCallback(
    (
      reason:
        | "EXCLUDED_AREA"
        | "OUTSIDE_SERVICE_AREA"
        | "COMUNA_NOT_SERVED"
        | "ZONE_INACTIVE",
    ) => {
      if (status.kind !== "none")
        setStatus({ kind: "notCovered", address: status.address, reason });
    },
    [status],
  );
  useEffect(() => {
    const saved = sessionStore.read("address", isAddress);
    if (saved) void submit(saved);
  }, [submit]);
  return { status, submit, retry, markNotCovered };
}
