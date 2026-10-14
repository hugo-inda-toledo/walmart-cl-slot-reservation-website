import { useState, type ReactNode } from "react";

import {
  CustomerSelector,
  useCustomerSelection,
} from "@/features/customer/CustomerSelector";

import { ErrorBoundary } from "./ErrorBoundary";
import { AppProviders } from "./AppProviders";
import { ReservationPage } from "./ReservationPage";

export function App({ content }: { readonly content?: ReactNode }) {
  const customerSelection = useCustomerSelection();
  const { customer } = customerSelection;
  const [customerSelectionBlocked, setCustomerSelectionBlocked] =
    useState(false);
  return (
    <AppProviders>
      <a className="skip-link" href="#main-content">
        Ir al contenido principal
      </a>
      <header className="site-header" aria-label="Delivery Slot Reservation">
        <div className="site-header__content">
          <span className="site-header__brand" aria-label="Walmart">
            <span>Walmart</span>
            <svg aria-hidden="true" viewBox="0 0 40 40" focusable="false">
              <g fill="currentColor">
                <rect x="17" y="1" width="6" height="13" rx="3" />
                <rect x="17" y="26" width="6" height="13" rx="3" />
                <rect
                  x="26"
                  y="5"
                  width="6"
                  height="13"
                  rx="3"
                  transform="rotate(60 29 11.5)"
                />
                <rect
                  x="8"
                  y="22"
                  width="6"
                  height="13"
                  rx="3"
                  transform="rotate(60 11 28.5)"
                />
                <rect
                  x="26"
                  y="22"
                  width="6"
                  height="13"
                  rx="3"
                  transform="rotate(120 29 28.5)"
                />
                <rect
                  x="8"
                  y="5"
                  width="6"
                  height="13"
                  rx="3"
                  transform="rotate(120 11 11.5)"
                />
              </g>
            </svg>
          </span>
          <strong className="site-header__title">
            Delivery Slot Reservation
          </strong>
          <div className="site-header__customer">
            <CustomerSelector
              customer={customer}
              disabled={customerSelectionBlocked}
              onSelect={(id) => {
                customerSelection.select(id);
              }}
            />
          </div>
        </div>
      </header>
      <ErrorBoundary>
        {content ?? (
          <ReservationPage
            customer={customer}
            onCustomerSelectionBlockedChange={setCustomerSelectionBlocked}
          />
        )}
      </ErrorBoundary>
      <footer className="site-footer">
        <span>Demo técnico · Hugo Inda Toledo · 2026</span>
      </footer>
    </AppProviders>
  );
}
