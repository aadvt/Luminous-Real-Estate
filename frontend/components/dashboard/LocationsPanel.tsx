'use client'

import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, X, ArrowUpDown, TrendingUp, Building2, Wifi, WifiOff } from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  CITIES,
  priceLakhFor,
  residexFor,
  isLiveResidex,
  resolveCityKey,
  fmtLakh,
} from '@/lib/cityData'

type SortKey = 'default' | 'price' | 'risk'

const riskMeta = (score: number | null) => {
  if (score == null) return { label: 'Calibrating', color: '#94a3b8', bg: 'bg-slate-100', text: 'text-slate-500' }
  if (score >= 65) return { label: 'At Risk', color: '#d7383b', bg: 'bg-rose-50', text: 'text-rose-600' }
  if (score >= 35) return { label: 'Watch', color: '#E4B461', bg: 'bg-amber-50', text: 'text-amber-600' }
  return { label: 'Stable', color: '#0f4d23', bg: 'bg-emerald-50', text: 'text-emerald-700' }
}

const LocationsPanel = () => {
  const {
    isLocationsOpen,
    setIsLocationsOpen,
    macroSnapshot,
    bubbleFlags,
    activeRegion,
    flyToLocation,
  } = useStore()

  const [sortKey, setSortKey] = useState<SortKey>('default')

  const rows = useMemo(() => {
    const list = CITIES.map((city) => {
      const flag = bubbleFlags.find((f) => resolveCityKey(f.region) === city.key)
      return {
        city,
        priceLakh: priceLakhFor(macroSnapshot, city),
        residex: residexFor(macroSnapshot, city),
        live: isLiveResidex(macroSnapshot, city),
        score: flag?.overall_score ?? null,
        pi: flag?.price_income_ratio ?? null,
      }
    })

    if (sortKey === 'price') list.sort((a, b) => b.priceLakh - a.priceLakh)
    else if (sortKey === 'risk') list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    return list
  }, [macroSnapshot, bubbleFlags, sortKey])

  const anyLive = rows.some((r) => r.live)

  const cycleSort = () =>
    setSortKey((k) => (k === 'default' ? 'price' : k === 'price' ? 'risk' : 'default'))

  const sortLabel = sortKey === 'price' ? 'By price' : sortKey === 'risk' ? 'By risk' : 'Default'

  return (
    <AnimatePresence>
      {isLocationsOpen && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="fixed z-[60] pointer-events-auto flex flex-col overflow-hidden
                     bg-white/95 backdrop-blur-xl border border-[#0f4d2320] shadow-2xl
                     inset-x-3 bottom-3 top-auto max-h-[72vh] rounded-3xl
                     sm:inset-x-auto sm:top-24 sm:right-6 sm:bottom-40 sm:w-[min(400px,92vw)]"
        >
          {/* HEADER */}
          <div className="p-5 border-b border-[#0f4d2310] flex items-center justify-between bg-[#0f4d2305] shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#0f4d23] text-yellow-400">
                <MapPin size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0f4d23] font-headline uppercase tracking-tight">
                  Locations &amp; Estimates
                </h2>
                <div className="flex items-center gap-1.5">
                  {anyLive ? (
                    <Wifi size={11} className="text-emerald-500" />
                  ) : (
                    <WifiOff size={11} className="text-amber-500" />
                  )}
                  <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">
                    {anyLive ? 'Live NHB RESIDEX feed' : 'Estimated · awaiting live feed'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsLocationsOpen(false)}
              className="p-2 hover:bg-[#0f4d2310] rounded-full transition-colors text-slate-400 hover:text-[#0f4d23]"
              aria-label="Close locations panel"
            >
              <X size={20} />
            </button>
          </div>

          {/* SORT BAR */}
          <div className="px-5 py-3 flex items-center justify-between border-b border-[#0f4d2308] bg-white/60 shrink-0">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">
              {rows.length} tracked cities · median home value
            </span>
            <button
              onClick={cycleSort}
              className="flex items-center gap-1.5 text-[9px] font-bold text-[#0f4d23] uppercase tracking-wider bg-[#0f4d230a] hover:bg-[#0f4d2315] px-2.5 py-1 rounded-full transition-colors"
            >
              <ArrowUpDown size={11} />
              {sortLabel}
            </button>
          </div>

          {/* LIST */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar min-h-0">
            {rows.map(({ city, priceLakh, residex, live, score, pi }) => {
              const meta = riskMeta(score)
              const isActive = activeRegion.toLowerCase() === city.key
              return (
                <button
                  key={city.key}
                  onClick={() => {
                    flyToLocation(city.lng, city.lat, 16.5, city.label)
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all group ${
                    isActive
                      ? 'bg-[#0f4d2308] border-[#0f4d2330] ring-1 ring-[#0f4d2320]'
                      : 'bg-slate-50/60 border-black/5 hover:bg-[#0f4d2305] hover:border-[#0f4d2320]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-800 tracking-tight truncate">
                          {city.label}
                        </span>
                        {live && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {city.assetId}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-[#0f4d23] tracking-tighter leading-none">
                        {fmtLakh(priceLakh)}
                      </div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                        est. median
                      </span>
                    </div>
                  </div>

                  {/* metric row */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Stat icon={<Building2 size={10} />} label="RESIDEX" value={residex.toFixed(1)} />
                    <Stat icon={<TrendingUp size={10} />} label="P/I" value={pi != null ? `${pi.toFixed(1)}x` : '—'} />
                    <div className="flex flex-col items-start">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Risk</span>
                      <span
                        className={`mt-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.text}`}
                      >
                        {score != null ? `${score}` : '—'} · {meta.label}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* FOOTER NOTE */}
          <div className="px-5 py-3 border-t border-[#0f4d2308] bg-white/60 shrink-0">
            <p className="text-[8px] leading-relaxed text-slate-400 font-medium">
              Estimates derive median home value from NHB RESIDEX indices
              (index&nbsp;×&nbsp;0.48&nbsp;lakh). Live values stream from the engine; fallbacks
              are shown until the backend connects.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex flex-col items-start">
    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-0.5">
      {icon}
      {label}
    </span>
    <span className="mt-0.5 text-[11px] font-black text-slate-700">{value}</span>
  </div>
)

export default LocationsPanel
