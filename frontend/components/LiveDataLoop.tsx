'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { api, apiUrl } from '@/lib/apiClient'
import type { MacroSnapshot, BubbleFlag, ValuationRecord } from '@/lib/apiClient'
import { CITIES, CITY_BY_KEY, priceInrFor, resolveCityKey, ASSET_COORDS } from '@/lib/cityData'

export { ASSET_COORDS }

const POLL_INTERVAL = 30_000 // 30 seconds

// Map every tracked city's live bubble flag into the shared valuationMap.
const applyFlags = (
  flags: BubbleFlag[],
  setValuation: (id: string, data: Record<string, number>) => void,
) => {
  flags.forEach((flag) => {
    const key = resolveCityKey(flag.region)
    const city = key ? CITY_BY_KEY[key] : null
    if (city) {
      setValuation(city.assetId, {
        // Keep risk_score on a 0-10 scale for marker threshold logic (>7=red, >4=yellow)
        risk_score: flag.overall_score / 10,
        pi_ratio: flag.price_income_ratio ?? 0,
      })
    }
  })
}

// Push RESIDEX-derived price estimates into each city marker (real, not random).
const applyPrices = (
  snapshot: MacroSnapshot | null,
  setValuation: (id: string, data: Record<string, number>) => void,
) => {
  CITIES.forEach((city) => {
    setValuation(city.assetId, { price_index: priceInrFor(snapshot, city) })
  })
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

        // 2. Macro snapshot → drives real per-city cost estimates
        try {
          const macro = await api<MacroSnapshot>('/api/market/snapshot')
          if (!cancelled) {
            setMacroSnapshot(macro)
            applyPrices(macro, setValuation)
          }
        } catch (e) {
          console.warn('[LiveData] macro snapshot failed:', e)
        }

        // 3. Bubble flags → populate valuationMap with real risk data for all 8 cities
        try {
          const flags = await api<BubbleFlag[]>('/api/risk/bubble-flags')
          if (!cancelled) {
            setBubbleFlags(flags)
            applyFlags(flags, setValuation)
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

    // Seed all 8 markers immediately with RESIDEX-fallback prices (real calibration,
    // not random) + a neutral risk score, so the map is populated before the API replies.
    CITIES.forEach((city) => {
      setValuation(city.assetId, {
        price_index: priceInrFor(null, city),
        risk_score: 5.0, // neutral 50/100 until the engine reports
        volatility: 0,
        pi_ratio: 0,
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
              api<ValuationRecord[]>('/api/valuations'),
            ]).then(([flags, vals]) => {
              setBubbleFlags(flags)
              setValuations(vals)
              applyFlags(flags, setValuation)
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
  }, [setBubbleFlags, setValuation, setValuations])



  return null
}

export default LiveDataLoop
