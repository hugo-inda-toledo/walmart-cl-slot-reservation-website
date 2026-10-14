export interface CatalogZoneRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}
export interface CatalogComunaRef {
  readonly code: string;
  readonly name: string;
}
export type CatalogDateStatus = "AVAILABLE" | "SOLD_OUT" | "NO_SERVICE";
export type CatalogSlotStatus = "AVAILABLE" | "SOLD_OUT" | "CUTOFF_PASSED";
export interface CatalogDeliveryDate {
  readonly date: string;
  readonly label: string;
  readonly status: CatalogDateStatus;
}
export interface CatalogDeliveryDates {
  readonly zone: CatalogZoneRef;
  readonly comuna: CatalogComunaRef;
  readonly timeZone: "America/Santiago";
  readonly dates: readonly CatalogDeliveryDate[];
}
export interface CatalogDeliverySlot {
  readonly slotId: string;
  readonly start: string;
  readonly end: string;
  readonly price: number;
  readonly remainingCapacity: number;
  readonly status: CatalogSlotStatus;
}
export interface CatalogDeliverySlots {
  readonly zone: CatalogZoneRef;
  readonly comuna: CatalogComunaRef;
  readonly date: string;
  readonly label: string;
  readonly status: CatalogDateStatus;
  readonly timeZone: "America/Santiago";
  readonly slots: readonly CatalogDeliverySlot[];
}
export type CatalogNotCoveredReason =
  | "EXCLUDED_AREA"
  | "OUTSIDE_SERVICE_AREA"
  | "COMUNA_NOT_SERVED"
  | "ZONE_INACTIVE";
