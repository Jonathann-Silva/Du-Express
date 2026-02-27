'use server';

export type Coords = { lat: number; lng: number };

const GEOCODING_CACHE = new Map<string, Coords | null>();

/**
 * Geocodes an address string to latitude and longitude using the LocationIQ API.
 * Optimized for Arapongas, PR with geographic bias and address cleaning.
 */
export async function geocodeAddress(address: string): Promise<Coords | null> {
  // 1. Clean the address string for the geocoder
  // Remove apartment numbers, blocks, etc. that confuse OSM/GPS
  let cleanAddress = address
    .replace(/(apto|apartamento|bloco|bl|casa|fundos|sobrado|sala|loja|vaga).*/gi, '') // Remove details after number
    .replace(/\s+/g, ' ')
    .trim();

  if (GEOCODING_CACHE.has(cleanAddress)) {
    return GEOCODING_CACHE.get(cleanAddress) || null;
  }

  const apiKey = process.env.LOCATIONIQ_API_KEY;

  if (!apiKey || apiKey === "") {
    console.error("LocationIQ API key is missing. Please set LOCATIONIQ_API_KEY in your .env file.");
    return null;
  }

  /**
   * LocationIQ Search Optimization:
   * - countrycodes=br: Limits search to Brazil
   * - viewbox: Focuses search around Arapongas, PR (-23.4128, -51.4236)
   * - bounded=1: Strictly prioritize results within the viewbox
   */
  const arapongasViewbox = "-51.5236,-23.5128,-51.3236,-23.3128"; // lon1,lat1,lon2,lat2
  const fullAddressQuery = `${cleanAddress}, Arapongas, PR, Brazil`;
  
  const url = `https://us1.locationiq.com/v1/search?key=${apiKey}&q=${encodeURIComponent(
    fullAddressQuery
  )}&format=json&limit=1&countrycodes=br&viewbox=${arapongasViewbox}&bounded=1&addressdetails=1`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`LocationIQ API error! Status: ${response.status}`);
      GEOCODING_CACHE.set(cleanAddress, null);
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const { lat, lon } = data[0];
      const coords = {
        lat: parseFloat(lat),
        lng: parseFloat(lon),
      };
      GEOCODING_CACHE.set(cleanAddress, coords);
      return coords;
    } else {
      console.warn(`No geocoding results for address: ${cleanAddress}`);
      GEOCODING_CACHE.set(cleanAddress, null);
      return null;
    }
  } catch (error) {
    console.error('Geocoding fetch error:', error);
    GEOCODING_CACHE.set(cleanAddress, null);
    return null;
  }
}
