export interface GeoRegion {
  readonly code: string;
  readonly name: string;
}
export interface GeoComuna {
  readonly code: string;
  readonly name: string;
  readonly provinceCode: string;
  readonly provinceName: string;
  readonly hasBoundary: boolean;
}
export interface GeoComunaRef {
  readonly code: string;
  readonly name: string;
}
export interface GeoZoneRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}
export type GeoResolutionMethod =
  "ZONE_AREA" | "COMUNA_BOUNDARY" | "NEAREST_COMUNA" | "COMUNA_CODE";
export type GeoNotCoveredReason =
  | "EXCLUDED_AREA"
  | "OUTSIDE_SERVICE_AREA"
  | "COMUNA_NOT_SERVED"
  | "ZONE_INACTIVE";
export interface GeoCoverageRequest {
  readonly street: string;
  readonly number: string;
  readonly comunaCode: string;
  readonly latitude?: number;
  readonly longitude?: number;
}
export interface GeoCoverageResolution {
  readonly comuna: GeoComunaRef;
  readonly zone: GeoZoneRef;
  readonly method: GeoResolutionMethod;
  readonly comunaDiffersFromDeclared: boolean;
}
export interface GeoExpectedCoverage {
  readonly covered: boolean;
  readonly zoneCode?: string;
  readonly method?: GeoResolutionMethod;
  readonly reason?: GeoNotCoveredReason;
}
export interface GeoDemoAddress {
  readonly id: string;
  readonly label: string;
  readonly street: string;
  readonly number: string;
  readonly comuna: GeoComunaRef;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly expected: GeoExpectedCoverage;
}
