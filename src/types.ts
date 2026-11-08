export type CustomerStatus = "online" | "offline" | "los" | "dyinggasp";

export interface OdpCustomer {
  id: string;
  port: number;
  name: string;
  status: CustomerStatus;
  onuSn?: string;
  onuModel?: string;
  signal?: string;
  ipAddress?: string;
  package?: string;
  address?: string;
  pluggedAt?: string;
}

export interface ODP {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalPorts: number;
  availablePorts: number;
  smartOltId?: string;
  customers?: OdpCustomer[];
}

export interface CoverageResult {
  status: "TERCOVER" | "PORT PENUH / WAITING LIST" | "BELUM TERCOVER";
  userCoords: { lat: number; lng: number };
  nearestOdp: ODP | null;
  distance: number | null;
  directDistance?: number;
  isRoadRoute?: boolean;
  isDetourAvoided?: boolean;
  isTargetLocked?: boolean;
  routeGeometry?: { lat: number; lng: number }[];
  message?: string;
}

export interface TechStackItem {
  layer: string;
  technology: string;
  reason: string;
  alternatives?: string;
}
