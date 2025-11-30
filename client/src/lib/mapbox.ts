import type { DirectionsRoute, Location } from "@shared/schema";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export function getMapboxToken(): string {
  return MAPBOX_TOKEN || "";
}

export async function getDirections(
  origin: Location,
  destination: Location
): Promise<DirectionsRoute | null> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Directions API error:", response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        duration: route.duration,
        distance: route.distance,
        geometry: route.geometry,
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching directions:", error);
    return null;
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return "< 1 min";
  }
  
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  
  return `${hours} hr ${remainingMinutes} min`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  
  const km = meters / 1000;
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  
  return `${Math.round(km)} km`;
}

export function calculateBearing(start: Location, end: Location): number {
  const startLat = (start.lat * Math.PI) / 180;
  const startLng = (start.lng * Math.PI) / 180;
  const endLat = (end.lat * Math.PI) / 180;
  const endLng = (end.lng * Math.PI) / 180;
  
  const dLng = endLng - startLng;
  
  const x = Math.sin(dLng) * Math.cos(endLat);
  const y = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
  
  let bearing = Math.atan2(x, y) * (180 / Math.PI);
  bearing = (bearing + 360) % 360;
  
  return bearing;
}
