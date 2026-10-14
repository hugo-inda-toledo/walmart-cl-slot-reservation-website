/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "@/api/ApiClientProvider";
import type { GeoComuna, GeoDemoAddress } from "@/api/types/geo";
import { queryKeys } from "@/api/queryKeys";
import { Button, EmptyState, Spinner } from "@/shared/ui";

import {
  type AddressField,
  type CoveredAddress,
  type SelectedAddress,
  notCoveredMessages,
  validateAddressForm,
} from "./addressModel";

export function AddressCard({
  customerName,
  address,
  onChange,
}: {
  readonly customerName: string;
  readonly address: CoveredAddress;
  readonly onChange: () => void;
}) {
  return (
    <section className="address-card" aria-label="Dirección de despacho">
      <svg
        className="address-card__icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M12 21s7-5.15 7-12A7 7 0 1 0 5 9c0 6.85 7 12 7 12Z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
      <div>
        <p className="address-card__eyebrow">Enviar a</p>
        <p className="address-card__customer">{customerName}</p>
        <p className="address-card__address">
          {address.street} {address.number}
        </p>
        <p className="address-card__comuna">{address.resolvedComuna.name}</p>
      </div>
      <Button className="address-card__change" onClick={onChange}>
        Cambiar
      </Button>
    </section>
  );
}

function ManualAddressForm({
  onSubmit,
  apiErrors = {},
}: {
  readonly onSubmit: (address: SelectedAddress) => void;
  readonly apiErrors?: Readonly<Partial<Record<AddressField, string>>>;
}) {
  const api = useApiClient();
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState<GeoComuna | null>(null);
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [errors, setErrors] = useState<Partial<Record<AddressField, string>>>(
    {},
  );
  const streetRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const comunaRef = useRef<HTMLSelectElement>(null);
  const combinedErrors = { ...errors, ...apiErrors };
  useEffect(() => {
    if (combinedErrors.comunaCode) comunaRef.current?.focus();
    else if (combinedErrors.street) streetRef.current?.focus();
    else if (combinedErrors.number) numberRef.current?.focus();
  }, [combinedErrors.comunaCode, combinedErrors.number, combinedErrors.street]);
  const regions = useQuery({
    queryKey: queryKeys.geo.regions,
    queryFn: () => api.geo.listRegions(),
  });
  const comunas = useQuery({
    queryKey: queryKeys.geo.comunas(region),
    queryFn: () => api.geo.listComunas(region),
    enabled: Boolean(region),
  });
  const submit = () => {
    const nextErrors = validateAddressForm({
      street,
      number,
      comunaCode: comuna?.code ?? "",
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !comuna) return;
    onSubmit({
      source: "manual",
      street,
      number,
      comuna: { code: comuna.code, name: comuna.name },
    });
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label>
        Región
        <select
          value={region}
          onChange={(event) => {
            setRegion(event.target.value);
            setComuna(null);
          }}
        >
          <option value="">Selecciona una región</option>
          {regions.data?.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Comuna
        <select
          ref={comunaRef}
          disabled={!region}
          value={comuna?.code ?? ""}
          onChange={(event) =>
            setComuna(
              comunas.data?.find((item) => item.code === event.target.value) ??
                null,
            )
          }
        >
          <option value="">Selecciona una comuna</option>
          {comunas.data?.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
        {combinedErrors.comunaCode && (
          <span role="alert">{combinedErrors.comunaCode}</span>
        )}
      </label>
      <label>
        Calle
        <input
          ref={streetRef}
          value={street}
          onChange={(event) => setStreet(event.target.value)}
        />
        {combinedErrors.street && (
          <span role="alert">{combinedErrors.street}</span>
        )}
      </label>
      <label>
        Número
        <input
          ref={numberRef}
          value={number}
          onChange={(event) => setNumber(event.target.value)}
        />
        {combinedErrors.number && (
          <span role="alert">{combinedErrors.number}</span>
        )}
      </label>
      <Button type="submit">Usar dirección</Button>
    </form>
  );
}

export function AddressPicker({
  open,
  onSelect,
  apiErrors,
}: {
  readonly open: boolean;
  readonly onSelect: (address: SelectedAddress) => void;
  readonly apiErrors?: Readonly<Partial<Record<AddressField, string>>>;
}) {
  const api = useApiClient();
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);
  const demo = useQuery({
    queryKey: queryKeys.geo.demoAddresses,
    queryFn: () => api.geo.listDemoAddresses(),
    enabled: open,
  });
  const chooseDemo = (address: GeoDemoAddress) =>
    onSelect({
      source: "demo",
      demoId: address.id,
      street: address.street,
      number: address.number,
      comuna: address.comuna,
      ...(address.latitude != null && address.longitude != null
        ? { latitude: address.latitude, longitude: address.longitude }
        : {}),
    });
  if (!open) return null;

  return (
    <section className="address-picker" aria-labelledby={titleId}>
      <p className="section-eyebrow">Dirección de entrega</p>
      <h2 id={titleId} ref={titleRef} tabIndex={-1}>
        Cambiar dirección
      </h2>
      <p className="address-picker__helper">
        Selecciona una dirección guardada o ingresa una nueva.
      </p>
      {demo.isLoading ? (
        <Spinner />
      ) : (
        <>
          <div
            className="address-picker__saved"
            aria-label="Direcciones guardadas"
          >
            {demo.data?.map((address) => (
              <Button
                className="address-picker__saved-item"
                key={address.id}
                onClick={() => chooseDemo(address)}
              >
                {address.label} —{" "}
                {address.expected.covered ? "Con cobertura" : "Sin cobertura"}
              </Button>
            ))}
          </div>
          <ManualAddressForm onSubmit={onSelect} apiErrors={apiErrors} />
        </>
      )}
    </section>
  );
}

export function NotCoveredState({
  reason,
  onChange,
}: {
  readonly reason: keyof typeof notCoveredMessages;
  readonly onChange: () => void;
}) {
  return (
    <EmptyState title="No tenemos despacho en esta dirección.">
      {notCoveredMessages[reason]}{" "}
      <Button onClick={onChange}>Cambiar dirección</Button>
    </EmptyState>
  );
}
