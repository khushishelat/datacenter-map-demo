import type { DisplayStatus, MonitorCategory } from "./types";

export const STATUS_MAP: Record<string, DisplayStatus> = {
  operational: "operational",
  "under-construction": "construction",
  planned: "planned",
  unknown: "unknown",
  decommissioned: "decommissioned",
};

export const STATUS_COLORS: Record<DisplayStatus, string> = {
  operational: "#FB631B",
  construction: "#F79A6F",
  planned: "#ADADAC",
  unknown: "#D6D6D6",
  decommissioned: "#858483",
};

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  operational: "Operational",
  construction: "Under Construction",
  planned: "Planned",
  unknown: "Unknown",
  decommissioned: "Decommissioned",
};

export const MONITOR_CATEGORY_LABELS: Record<MonitorCategory, string> = {
  POWER_GRID: "Power & Grid",
  ZONING_POLICY: "Zoning & Policy",
  COMMUNITY: "Community",
  WATER: "Water & Cooling",
  LAND_SUPPLY: "Land & Supply",
  TENANT_DEMAND: "Tenant & Demand",
  CAPITAL_OWNERSHIP: "Capital & Ownership",
  CONSTRUCTION: "Construction",
};

export const MONITOR_CATEGORY_COLORS: Record<MonitorCategory, string> = {
  POWER_GRID: "#FB631B",
  ZONING_POLICY: "#F79A6F",
  COMMUNITY: "#5C5B59",
  WATER: "#8FB6CC",
  LAND_SUPPLY: "#D8D0BF",
  TENANT_DEMAND: "#FB631B",
  CAPITAL_OWNERSHIP: "#E14942",
  CONSTRUCTION: "#858483",
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "#E14942",
  notable: "#FB631B",
  informational: "#858483",
};

/** Maps US states to the monitor that covers them */
export const STATE_TO_MONITOR: Record<string, string> = {
  VA: "region-nova",
  GA: "region-atlanta",
  OH: "region-ohio",
  AZ: "region-phoenix",
  UT: "region-utah",
  TX: "region-texas",
  WA: "region-pnw",
  OR: "region-pnw",
  FL: "region-florida",
  IL: "region-chicago",
  NJ: "region-nymetro",
  NY: "region-nymetro",
  MA: "region-newengland",
  CT: "region-newengland",
  NH: "region-newengland",
  ME: "region-newengland",
  RI: "region-newengland",
  VT: "region-newengland",
  MN: "region-minnesota",
  MI: "region-michigan",
  KY: "region-kentucky",
  NV: "region-nevada",
  MD: "region-dcmetro",
  DC: "region-dcmetro",
  DE: "region-dcmetro",
  TN: "region-tennessee",
  MO: "region-midwest",
  KS: "region-midwest",
  NE: "region-midwest",
  IA: "region-midwest",
  NC: "region-carolinas",
  SC: "region-carolinas",
  CO: "region-colorado",
  PA: "region-pennsylvania",
  // CA needs special handling (NorCal vs SoCal by latitude)
  CA: "region-norcal", // default; SoCal for lat < 35.5
};

/** Latitude threshold for NorCal vs SoCal */
export const CA_SPLIT_LAT = 35.5;

export const MAP_CENTER: [number, number] = [39.8283, -98.5795];
export const MAP_ZOOM = 5;
export const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';
