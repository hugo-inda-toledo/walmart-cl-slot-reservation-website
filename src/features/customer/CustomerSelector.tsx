/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";

import { sessionStore } from "@/shared/storage/sessionStore";

export interface DemoCustomer {
  readonly id: string;
  readonly name: string;
}

export const DEMO_CUSTOMERS: readonly DemoCustomer[] = [
  { id: "pedro-perez", name: "Pedro Perez" },
  { id: "maria-gonzalez", name: "María González" },
  { id: "juan-soto", name: "Juan Soto" },
];

const isCustomerId = (value: unknown): value is string =>
  typeof value === "string" &&
  DEMO_CUSTOMERS.some((customer) => customer.id === value);

function selectedCustomer(): DemoCustomer {
  const saved = sessionStore.read("customer", isCustomerId);
  const fallback = DEMO_CUSTOMERS[0];
  if (!fallback)
    throw new Error("La lista de clientes demo no puede estar vacía.");
  return DEMO_CUSTOMERS.find((customer) => customer.id === saved) ?? fallback;
}

export function useCustomerSelection() {
  const [customer, setCustomer] = useState<DemoCustomer>(selectedCustomer);
  return {
    customer,
    select(id: string) {
      const next = DEMO_CUSTOMERS.find((candidate) => candidate.id === id);
      if (!next) return;
      sessionStore.write("customer", next.id);
      setCustomer(next);
    },
  };
}

export function CustomerSelector({
  customer,
  onSelect,
  disabled = false,
}: {
  readonly customer: DemoCustomer;
  readonly onSelect: (id: string) => void;
  readonly disabled?: boolean;
}) {
  return (
    <label>
      Cliente demo
      <select
        value={customer.id}
        disabled={disabled}
        onChange={(event) => {
          onSelect(event.target.value);
        }}
      >
        {DEMO_CUSTOMERS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
