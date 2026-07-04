'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { api, apiUrl } from '@/lib/apiClient'
import type { MacroSnapshot, BubbleFlag, ValuationRecord } from '@/lib/apiClient'

const POLL_INTERVAL = 30_000 // 30 seconds

// All 8 cities tracked by the engine, mapped to their canonical asset IDs
const CITY_TO_ASSET: Record<string, string> = {
  'mumbai':    'MUM-BKC',
  'delhi':     'DEL-CP',
  'bangalore': 'BLR-WF',
  'chennai':   'MAA-OMR',
  'hyderabad': 'HYD-HIT',
  'kolkata':   'KOL-NEW',
  'pune':      'PUN-HIN',
  'ahmedabad': 'AHM-GIFT',
}

// Canonical coordinates for each asset (must match MapboxReality)
export const ASSET_COORDS: Record<string, [number, number]> = {
  'MUM-BKC':  [72.8656, 19.0658],
  'DEL-CP':   [77.2090, 28.6139],
  'BLR-WF':   [77.5946, 12.9716],
  'MAA-OMR':  [80.2707, 13.0827],
  'HYD-HIT':  [78.3725, 17.4478],
  'KOL-NEW':  [88.4651, 22.5892],
  'PUN-HIN':  [73.7334, 18.5913],
  'AHM-GIFT': [72.6841, 23.1610],
}

const LiveDataLoop = () => {
  const {
    setBackendStatus,
    setMacroSnapshot,
    setBubbleFlags,
    setValuations,
    setValuation,
    setScenarioResult,
  } = useStore()

  const sseRef = useRef<EventSource | null>(null)
  const sseBackoffRef = useRef(5000) // start at 5s, max 60s

  // --- Initial Fetch + Polling ---
  useEffect(() => {
    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval>

    const fetchAll = async () => {
      // Skip fetch when tab is hidden to conserve resources
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

      try {
        // 1. Health check
        await api('/health')
        if (!cancelled) setBackendStatus('connected')

        // 2. Macro snapshot
        try {
          const macro = await api<MacroSnapshot>('/api/market/snapshot')
          if (!cancelled) setMacroSnapshot(macro)
        } catch (e) {
          console.warn('[LiveData] macro snapshot failed:', e)
        }

        // 3. Bubble flags → populate valuationMap with real data for all 8 cities
        try {
          const flags = await api<BubbleFlag[]>('/api/risk/bubble-flags')
          if (!cancelled) {
            setBubbleFlags(flags)
            // Map each city's bubble flag into the valuationMap using raw 0-100 scores
            flags.forEach((flag) => {
              const key = flag.region.toLowerCase().replace(/[ -]/g, '_')
              const assetId = CITY_TO_ASSET[key] ?? CITY_TO_ASSET[flag.region.toLowerCase()]
              if (assetId) {
                setValuation(assetId, {
                  // Keep risk_score on a 0-10 scale for marker threshold logic (>7=red, >4=yellow)
                  risk_score: flag.overall_score / 10,
                  pi_ratio: flag.price_income_ratio ?? 0,
                })
              }
            })
          }
        } catch (e) {
          console.warn('[LiveData] bubble flags failed:', e)
        }

        // 4. Valuations
        try {
          const vals = await api<ValuationRecord[]>('/api/valuations')
          if (!cancelled) setValuations(vals)
        } catch (e) {
          console.warn('[LiveData] valuations failed:', e)
        }

        // 5. Scenario history (for initial display)
        try {
          const history = await api<any[]>('/api/scenario/history')
          if (!cancelled && history.length > 0) {
            const latest = history[0]
            setScenarioResult({
              p5: latest.p10 ?? 0,
              p50: latest.p50 ?? 0,
              p95: latest.p90 ?? 0,
            })
          }
        } catch (e) {
          console.warn('[LiveData] scenario history failed:', e)
        }

      } catch (e) {
        console.error('[LiveData] backend unreachable:', e)
        if (!cancelled) setBackendStatus('error')
      }
    }

    // Seed all 8 asset markers with defaults so they appear immediately on map load
    Object.entries(ASSET_COORDS).forEach(([id]) => {
      setValuation(id, {
        price_index: 450000 + Math.random() * 550000,
        risk_score: 5.0 + Math.random() * 2, // neutral 50/100 = 5.0 on 0-10 scale
        volatility: Math.random() * 0.3,
        pi_ratio: 8 + Math.random() * 6,
      })
    })

    fetchAll()
    pollTimer = setInterval(fetchAll, POLL_INTERVAL)

    // Also refetch when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchAll()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(pollTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [setBackendStatus, setMacroSnapshot, setBubbleFlags, setValuations, setValuation, setScenarioResult])

  // --- SSE: Real-time alerts with exponential backoff ---
  useEffect(() => {
    const url = apiUrl('/api/alerts/stream')
    let timeoutHandle: ReturnType<typeof setTimeout>

    const connect = () => {
      const es = new EventSource(url)
      sseRef.current = es

      es.onopen = () => {
        console.log('[SSE] Connected to alert stream')
        sseBackoffRef.current = 5000 // reset backoff on successful connect
      }

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          // On bubble_alert or valuation_complete, immediately refresh all data
          if (data.type === 'bubble_alert' || data.type === 'valuation_complete') {
            Promise.all([
              api<BubbleFlag[]>('/api/risk/bubble-flags'),
              api<any[]>('/api/valuations'),
            ]).then(([flags, vals]) => {
              setBubbleFlags(flags)
              // Re-map flags to valuationMap
              flags.forEach((flag) => {
                const key = flag.region.toLowerCase().replace(/[ -]/g, '_')
                const assetId = CITY_TO_ASSET[key] ?? CITY_TO_ASSET[flag.region.toLowerCase()]
                if (assetId) {
                  setValuation(assetId, {
                    risk_score: flag.overall_score / 10,
                    pi_ratio: flag.price_income_ratio ?? 0,
                  })
                }
              })
            }).catch(() => {})
          }
        } catch {
          // heartbeat or non-JSON, ignore
        }
      }

      es.onerror = () => {
        es.close()
        const backoff = Math.min(sseBackoffRef.current, 60000)
        console.warn(`[SSE] Connection lost, reconnecting in ${backoff / 1000}s...`)
        sseBackoffRef.current = Math.min(backoff * 2, 60000) // exponential backoff, cap 60s
        timeoutHandle = setTimeout(connect, backoff)
      }
    }

    connect()

    return () => {
      clearTimeout(timeoutHandle)
      sseRef.current?.close()
    }
  }, [setBubbleFlags, setValuation])



  return null
}

export default LiveDataLoop
