// Use the Render backend URL in production; fall back to local proxy in dev.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://luminous-real-estate-1-2.onrender.com').replace(/\/$/, '')

export async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status} ${path}: ${text}`)
  }

  return res.json()
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

// --- Type definitions matching backend response shapes ---

export interface MacroSnapshot {
  gdp_growth: number | null
  cpi_yoy: number | null
  unemployment_rate: number | null
  home_loan_rate: number | null
  gnpa_ratio: number | null
  m3_money_supply: number | null
  wpi_inflation: number | null
  repo_rate: number | null
  gsec_10y_yield: number | null
  gsec_2y_yield: number | null
  housing_credit: number | null
  consumer_confidence: number | null
  nhb_residex_composite: number | null
  nhb_residex_mumbai: number | null
  nhb_residex_delhi: number | null
  nhb_residex_bangalore: number | null
  nhb_residex_chennai: number | null
  nhb_residex_hyderabad: number | null
  nhb_residex_kolkata: number | null
  nhb_residex_pune: number | null
  nhb_residex_ahmedabad: number | null
  median_home_price_inr: number | null
  median_household_income_inr: number | null
  snapshot_at: string
}

export interface BubbleFlag {
  id: string
  region: string
  overall_score: number
  price_income_ratio: number | null
  price_rent_ratio: number | null
  cap_rate_spread: number | null
  affordability_pct: number | null
  narrative: string | null
  is_active: boolean
  created_at: string | null
}

export interface ValuationRecord {
  id: string
  region: string
  property_value: number | null
  dcf_value: number | null
  cap_rate: number | null
  risk_score: number | null
  narrative: string | null
  created_at: string | null
}

export interface ScenarioRunResult {
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  prob_loss: number
  mean_value: number
  std_dev: number
}

export interface HealthDetail {
  status: string
  env: string
  db: string
  redis: string
  qdrant?: string
  checks: Record<string, string>
}

export interface MonteCarloResult {
  p5: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  p95: number
  prob_below_current: number
  var_95: number
  n_simulations: number
  propagation_trace: string[]
}

export interface QueryResult {
  answer: string | null
  run_id: string | null
  mc_results?: MonteCarloResult | null
  errors: string[]
}
