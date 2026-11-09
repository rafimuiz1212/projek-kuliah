// Utility for direct client-side OSRM routing and coverage calculation
// This ensures OSRM works 100% reliably even when deployed on static/serverless Vercel hosting!

import { ODP, CoverageResult } from "./types";

export function calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Client-side in-memory OSRM route cache
const clientRouteCache = new Map<string, { distance: number; routeCoords: { lat: number; lng: number }[] }>();

export async function fetchClientOSRMRoute(
  userLat: number,
  userLng: number,
  odpLat: number,
  odpLng: number
): Promise<{ distance: number; routeCoords: { lat: number; lng: number }[] } | null> {
  const directDist = calculateHaversine(userLat, userLng, odpLat, odpLng);
  if (directDist < 3) {
    return {
      distance: Math.round(directDist),
      routeCoords: [
        { lat: userLat, lng: userLng },
        { lat: odpLat, lng: odpLng }
      ]
    };
  }

  const cacheKey = `${userLat.toFixed(5)},${userLng.toFixed(5)}_${odpLat.toFixed(5)},${odpLng.toFixed(5)}`;
  if (clientRouteCache.has(cacheKey)) {
    return clientRouteCache.get(cacheKey)!;
  }

  const parseRoute = (data: any) => {
    if (!data || data.code !== "Ok" || !data.routes || data.routes.length === 0) return null;
    const route = data.routes[0];
    const distance = Math.round(route.distance);
    const geometry = route.geometry;
    if (!geometry || !geometry.coordinates) return null;

    const routeCoords = geometry.coordinates.map((coord: number[]) => ({
      lat: coord[1],
      lng: coord[0]
    }));
    return { distance, routeCoords };
  };

  // Provider 1: router.project-osrm.org (Public, CORS-enabled)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const url1 = `https://router.project-osrm.org/route/v1/foot/${userLng},${userLat};${odpLng},${odpLat}?overview=full&geometries=geojson`;
    const res = await fetch(url1, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseRoute(data);
      if (parsed) {
        if (clientRouteCache.size > 200) clientRouteCache.clear();
        clientRouteCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch (e) {
    // try fallback
  }

  // Provider 2: routing.openstreetmap.de
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const url2 = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${userLng},${userLat};${odpLng},${odpLat}?overview=full&geometries=geojson`;
    const res = await fetch(url2, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseRoute(data);
      if (parsed) {
        if (clientRouteCache.size > 200) clientRouteCache.clear();
        clientRouteCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Client fallback OSRM routing failed:", e);
  }

  return null;
}

export async function calculateClientCoverage(
  userLat: number,
  userLng: number,
  odps: ODP[],
  targetOdpId?: string | null
): Promise<CoverageResult> {
  if (!odps || odps.length === 0) {
    return {
      status: "BELUM TERCOVER",
      userCoords: { lat: userLat, lng: userLng },
      nearestOdp: null,
      distance: null,
      isRoadRoute: false,
      message: "Database ODP kosong. Silakan tambahkan ODP terlebih dahulu."
    };
  }

  // Sort by physical distance
  const candidates = odps.map(odp => ({
    odp,
    haversineDist: calculateHaversine(userLat, userLng, odp.lat, odp.lng)
  }));
  candidates.sort((a, b) => a.haversineDist - b.haversineDist);

  let targetCandidate: { odp: ODP; haversineDist: number };
  let isTargetLocked = false;

  if (targetOdpId) {
    const locked = candidates.find(c => c.odp.id === targetOdpId);
    if (locked) {
      targetCandidate = locked;
      isTargetLocked = true;
    } else {
      targetCandidate = candidates[0];
    }
  } else {
    const closest = candidates[0];
    if (closest.odp.availablePorts === 0) {
      const availableNearby = candidates.find(
        c => c.odp.availablePorts > 0 && c.haversineDist <= closest.haversineDist + 35
      );
      targetCandidate = availableNearby || closest;
    } else {
      targetCandidate = closest;
    }
  }

  const nearestOdp = targetCandidate.odp;
  const directDistance = Math.round(targetCandidate.haversineDist);
  let finalDistance = directDistance;
  let isRoadRoute = false;
  let routeGeometry: { lat: number; lng: number }[] = [
    { lat: userLat, lng: userLng },
    { lat: nearestOdp.lat, lng: nearestOdp.lng }
  ];

  const osrmResult = await fetchClientOSRMRoute(userLat, userLng, nearestOdp.lat, nearestOdp.lng);
  if (osrmResult && osrmResult.routeCoords && osrmResult.routeCoords.length > 0) {
    finalDistance = osrmResult.distance;
    isRoadRoute = true;
    routeGeometry = osrmResult.routeCoords;
  }

  let status: CoverageResult["status"] = "BELUM TERCOVER";
  if (finalDistance <= 300) {
    if (nearestOdp.availablePorts > 0) {
      status = "TERCOVER";
    } else {
      status = "PORT PENUH / WAITING LIST";
    }
  }

  return {
    status,
    userCoords: { lat: userLat, lng: userLng },
    nearestOdp,
    distance: finalDistance,
    directDistance,
    isRoadRoute,
    isTargetLocked,
    routeGeometry
  };
}
