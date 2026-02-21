/**
 * Optional expo-location. Returns null if the module is not installed or fails to resolve
 * (e.g. in some Expo Go or web builds). Use this so the app doesn't crash when expo-location
 * is missing; geo features (Near you, Add location) are simply disabled in that case.
 */
let _location: typeof import("expo-location") | null = null;

function getLocation(): typeof import("expo-location") | null {
  if (_location != null) return _location;
  try {
    _location = require("expo-location");
    return _location;
  } catch {
    return null;
  }
}

export async function requestForegroundPermissionsAsync(): Promise<
  { status: "granted" | "denied" } | null
> {
  const Location = getLocation();
  if (!Location) return null;
  return Location.requestForegroundPermissionsAsync();
}

export async function getCurrentPositionAsync(
  options?: { accuracy?: number }
): Promise<{ coords: { latitude: number; longitude: number } } | null> {
  const Location = getLocation();
  if (!Location) return null;
  return Location.getCurrentPositionAsync({
    accuracy: options?.accuracy ?? Location.Accuracy.Balanced,
  });
}

export const Accuracy = (() => {
  const Location = getLocation();
  return Location?.Accuracy ?? { Balanced: 2 };
})();

/** Distance in miles between two lat/lng points (Haversine). */
export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
