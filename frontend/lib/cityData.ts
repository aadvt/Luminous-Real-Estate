import type { MacroSnapshot } from '@/lib/apiClient'

/**
 * Single source of truth for the cities tracked by the engine.
 *
 * The backend scrapes NHB RESIDEX house-price indices per city and derives a
 * median price using the calibration median_price_lakh = RESIDEX * 0.48
 * (see backend ingest_coordinator: 136 index ≈ 65 lakh). We mirror that exact
 * calibration here so the frontend can show a genuine per-city cost estimate —
 * from the live snapshot when the API is up, and from the same fallback indices
 * the backend uses when it is down (never random filler).
 */

// Calibration: lakh of INR per RESIDEX index point (matches backend 0.48).
export const RESIDEX_TO_LAKH = 0.48

export interface City {
  /** lowercase canonical key */
  key: string
  /** display label */
  label: string
  /** canonical asset id used across map markers + store */
  assetId: string
  lng: number
  lat: number
  /** field name on MacroSnapshot */
  residexField: keyof MacroSnapshot
  /** fallback RESIDEX index (mirrors backend NHBClient.FALLBACK_VALUES) */
  fallbackResidex: number
}

export const CITIES: City[] = [
  { key: 'mumbai',    label: 'Mumbai',    assetId: 'MUM-BKC',  lng: 72.8656, lat: 19.0658, residexField: 'nhb_residex_mumbai',    fallbackResidex: 154.2 },
  { key: 'delhi',     label: 'Delhi',     assetId: 'DEL-CP',   lng: 77.2090, lat: 28.6139, residexField: 'nhb_residex_delhi',     fallbackResidex: 145.8 },
  { key: 'bangalore', label: 'Bangalore', assetId: 'BLR-WF',   lng: 77.5946, lat: 12.9716, residexField: 'nhb_residex_bangalore', fallbackResidex: 171.3 },
  { key: 'chennai',   label: 'Chennai',   assetId: 'MAA-OMR',  lng: 80.2707, lat: 13.0827, residexField: 'nhb_residex_chennai',   fallbackResidex: 139.4 },
  { key: 'hyderabad', label: 'Hyderabad', assetId: 'HYD-HIT',  lng: 78.3725, lat: 17.4478, residexField: 'nhb_residex_hyderabad', fallbackResidex: 148.5 },
  { key: 'kolkata',   label: 'Kolkata',   assetId: 'KOL-NEW',  lng: 88.4651, lat: 22.5892, residexField: 'nhb_residex_kolkata',   fallbackResidex: 128.2 },
  { key: 'pune',      label: 'Pune',      assetId: 'PUN-HIN',  lng: 73.7334, lat: 18.5913, residexField: 'nhb_residex_pune',      fallbackResidex: 141.7 },
  { key: 'ahmedabad', label: 'Ahmedabad', assetId: 'AHM-GIFT', lng: 72.6841, lat: 23.1610, residexField: 'nhb_residex_ahmedabad', fallbackResidex: 134.1 },
]

export const CITY_BY_KEY: Record<string, City> = Object.fromEntries(
  CITIES.map((c) => [c.key, c]),
)

export const CITY_BY_ASSET: Record<string, City> = Object.fromEntries(
  CITIES.map((c) => [c.assetId, c]),
)

export const ASSET_COORDS: Record<string, [number, number]> = Object.fromEntries(
  CITIES.map((c) => [c.assetId, [c.lng, c.lat] as [number, number]]),
)

/** Normalise a region string ("New Delhi", "Bengaluru", "MUM-BKC") to a city key. */
export function resolveCityKey(region?: string | null): string | null {
  if (!region) return null
  const raw = region.toLowerCase().trim()
  if (CITY_BY_KEY[raw]) return raw
  const asset = CITY_BY_ASSET[region.toUpperCase()]
  if (asset) return asset.key
  // common aliases
  if (raw.includes('bengaluru')) return 'bangalore'
  if (raw.includes('delhi')) return 'delhi'
  const collapsed = raw.replace(/[ _-]/g, '')
  const match = CITIES.find((c) => collapsed.includes(c.key))
  return match ? match.key : null
}

/** RESIDEX index for a city — live value if present, else the backend fallback. */
export function residexFor(snapshot: MacroSnapshot | null, city: City): number {
  const live = snapshot ? (snapshot[city.residexField] as number | null) : null
  return live != null && !Number.isNaN(live) ? live : city.fallbackResidex
}

/** Whether the RESIDEX value came from the live snapshot (vs. offline fallback). */
export function isLiveResidex(snapshot: MacroSnapshot | null, city: City): boolean {
  const live = snapshot ? (snapshot[city.residexField] as number | null) : null
  return live != null && !Number.isNaN(live)
}

/** Estimated median home price for a city, in lakh INR. */
export function priceLakhFor(snapshot: MacroSnapshot | null, city: City): number {
  return residexFor(snapshot, city) * RESIDEX_TO_LAKH
}

/** Estimated median home price for a city, in absolute rupees. */
export function priceInrFor(snapshot: MacroSnapshot | null, city: City): number {
  return priceLakhFor(snapshot, city) * 100_000
}

// ---- formatting ----

/** Format a lakh value as ₹X.XX Cr / ₹X.X L. */
export function fmtLakh(lakh: number | null | undefined): string {
  if (lakh == null || Number.isNaN(lakh)) return '—'
  if (lakh >= 100) return `₹${(lakh / 100).toFixed(2)} Cr`
  return `₹${lakh.toFixed(1)} L`
}

/** Format absolute rupees as ₹X.XX Cr / ₹X.X L / ₹n. */
export function fmtInr(rupees: number | null | undefined): string {
  if (rupees == null || Number.isNaN(rupees)) return '—'
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)} Cr`
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)} L`
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`
}
