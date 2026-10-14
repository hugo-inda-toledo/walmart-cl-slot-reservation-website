export interface ReservationCreateHoldRequest {
  readonly slotId: string;
  readonly orderId: string;
}
export interface ReservationSlotSnapshot {
  readonly slotId: string;
  readonly zoneId: string;
  readonly deliveryDate: string;
  readonly start: string;
  readonly end: string;
  readonly price: number;
  readonly timeZone: "America/Santiago";
}
export type ReservationHoldStatus =
  "ACTIVE" | "CONFIRMED" | "RELEASED" | "EXPIRED";
export interface ReservationSlotHold {
  readonly holdId: string;
  readonly orderId: string;
  readonly status: ReservationHoldStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly slot: ReservationSlotSnapshot;
  readonly reservationId?: string;
}
export type ReservationBookingStatus = "CONFIRMED" | "CANCELLED";
export interface ReservationBooking {
  readonly reservationId: string;
  readonly holdId: string;
  readonly orderId: string;
  readonly status: ReservationBookingStatus;
  readonly confirmedAt: string;
  readonly cancelledAt?: string;
  readonly slot: ReservationSlotSnapshot;
}
export interface ReservationAlternativeSlot {
  readonly slotId: string;
  readonly deliveryDate: string;
  readonly start: string;
  readonly end: string;
  readonly price: number;
  readonly remainingCapacity: number;
}
export type SlotHold = ReservationSlotHold;
export type Booking = ReservationBooking;
export type AlternativeSlot = ReservationAlternativeSlot;
export type HoldStatus = ReservationHoldStatus;
