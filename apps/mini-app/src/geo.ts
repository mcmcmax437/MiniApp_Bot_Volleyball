/**
 * Reverse-geocode lat/lng to a human-readable city name via OpenStreetMap
 * Nominatim. Used by the "Use my location" buttons on Home and Profile so the
 * city field updates automatically instead of staying as the default.
 *
 * Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
 * requires a meaningful User-Agent or `email` parameter, max 1 req/s, and
 * forbids heavy use. For a Telegram Mini App the volume is tiny, so we just
 * add a contact email and a 1s cooldown inside the helper.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
let lastCall = 0;

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  const wait = 1000 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "10"); // city-level
  url.searchParams.set("addressdetails", "1");
  // Required by Nominatim's usage policy so they can contact us about abuse.
  url.searchParams.set("email", "noreply@volleyball.tereshkovych.com.ua");

  let json: {
    address?: {
      city?: string;
      town?: string;
      village?: string;
      hamlet?: string;
      suburb?: string;
      municipality?: string;
      county?: string;
      state?: string;
      country?: string;
    };
    display_name?: string;
  };
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }
  const a = json.address;
  if (!a) return null;
  // Prefer the most specific populated-place name Nominatim can give us.
  return (
    a.city ||
    a.town ||
    a.village ||
    a.hamlet ||
    a.municipality ||
    a.county ||
    a.state ||
    null
  );
}
