import type {
  GeoComuna,
  GeoCoverageRequest,
  GeoCoverageResolution,
  GeoDemoAddress,
  GeoRegion,
} from "./types/geo";
import type { HttpClient } from "./http/httpClient";

function coordinatePair<
  T extends { readonly latitude?: number; readonly longitude?: number },
>(value: T): Omit<T, "latitude" | "longitude"> | T {
  if (value.latitude === undefined || value.longitude === undefined) {
    return Object.fromEntries(
      Object.entries(value).filter(
        ([key]) => key !== "latitude" && key !== "longitude",
      ),
    ) as Omit<T, "latitude" | "longitude">;
  }
  return value;
}

export interface GeoApi {
  listRegions(): Promise<readonly GeoRegion[]>;
  listComunas(regionCode: string): Promise<readonly GeoComuna[]>;
  listDemoAddresses(): Promise<readonly GeoDemoAddress[]>;
  resolveCoverage(request: GeoCoverageRequest): Promise<GeoCoverageResolution>;
}

export function createGeoApi(http: HttpClient): GeoApi {
  return {
    async listRegions() {
      return (
        await http.request<readonly GeoRegion[]>({
          method: "GET",
          path: "/api/v1/regions",
        })
      ).data;
    },
    async listComunas(regionCode) {
      return (
        await http.request<readonly GeoComuna[]>({
          method: "GET",
          path: `/api/v1/regions/${encodeURIComponent(regionCode)}/comunas`,
        })
      ).data;
    },
    async listDemoAddresses() {
      return (
        await http.request<readonly GeoDemoAddress[]>({
          method: "GET",
          path: "/api/v1/demo-addresses",
        })
      ).data;
    },
    async resolveCoverage(request) {
      return (
        await http.request<GeoCoverageResolution>({
          method: "POST",
          path: "/api/v1/coverage/resolve",
          body: coordinatePair(request),
        })
      ).data;
    },
  };
}
