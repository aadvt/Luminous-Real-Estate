'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Zap, MapPin } from 'lucide-react'
import { useStore } from '@/store/useStore'
import BottomDrawer from '@/components/dashboard/BottomDrawer'
import PropertyPanel from '@/components/dashboard/PropertyPanel'
import ScenarioLab from '@/components/dashboard/ScenarioLab'
import PropagationHUD from '@/components/dashboard/PropagationHUD'
import DataPipelineSidebar from '@/components/dashboard/DataPipelineSidebar'
import ZoneInsights from '@/components/dashboard/ZoneInsights'
import LocationsPanel from '@/components/dashboard/LocationsPanel'
import { CITIES } from '@/lib/cityData'

const HUD = () => {
  const {
    selectedAssetId,
    setSelectedAssetId,
    backendStatus,
    flyToLocation,
    activeRegion,
    isScenarioLabOpen,
    setIsScenarioLabOpen,
    isLocationsOpen,
    setIsLocationsOpen,
    isPipelineOpen,
  } = useStore()

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex flex-col font-body">
      {/* TOP NAVIGATION PILL (responsive) */}
      <nav className="fixed top-0 left-0 right-0 flex justify-center py-3 sm:py-6 px-3">
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="nav-pill flex items-center gap-3 sm:gap-6 pointer-events-auto max-w-[calc(100vw-24px)]"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-coral" />
            <span className="w-2.5 h-2.5 rounded-full bg-gold" />
            <span className="w-2.5 h-2.5 rounded-full bg-violet" />
            <span className="text-base sm:text-lg font-bold tracking-tighter text-ink font-headline ml-1.5">
              LUMINOUS <span className="hidden sm:inline font-light opacity-50 text-[10px]">ATLAS</span>
            </span>
          </div>

          {/* City selector — horizontally scrollable on small screens */}
          <div className="flex gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar min-w-0">
            {CITIES.map((city) => (
              <button
                key={city.label}
                onClick={() => flyToLocation(city.lng, city.lat, 16.5, city.label)}
                className={`font-headline text-[10px] font-bold tracking-[0.1em] uppercase transition-all px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 ${
                  activeRegion === city.label
                    ? 'bg-ink text-gold'
                    : 'text-ink/40 hover:text-ink hover:bg-ink/5'
                }`}
              >
                {city.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 sm:pl-4 sm:border-l border-ink/10 shrink-0">
            {/* Live backend status indicator */}
            <div className={`w-2 h-2 rounded-full ${
              backendStatus === 'connected' ? 'bg-mint animate-pulse'
              : backendStatus === 'loading' ? 'bg-gold animate-pulse'
              : 'bg-coral'
            }`} />
            <div className="hidden md:block bg-ink/5 text-ink px-3.5 py-1 rounded-full text-[9px] font-bold font-headline tracking-tight border border-ink/10">
              {backendStatus === 'connected' ? 'ENGINE LIVE' : backendStatus === 'loading' ? 'CONNECTING...' : 'OFFLINE'}
            </div>

            {/* Locations & Estimates toggle */}
            <button
              onClick={() => setIsLocationsOpen(!isLocationsOpen)}
              title="Locations & cost estimates"
              className={`p-2 rounded-full border-2 transition-all ${
                isLocationsOpen
                ? 'bg-ink border-ink text-gold'
                : 'bg-white border-ink/15 text-ink hover:border-ink/40'
              }`}
            >
              <MapPin size={14} fill={isLocationsOpen ? 'currentColor' : 'none'} />
            </button>

            {/* Scenario Lab toggle */}
            <button
              onClick={() => setIsScenarioLabOpen(!isScenarioLabOpen)}
              title="Scenario Lab"
              className={`p-2 rounded-full border-2 transition-all ${
                isScenarioLabOpen
                ? 'bg-ink border-ink text-gold'
                : 'bg-white border-ink/15 text-ink hover:border-ink/40'
              }`}
            >
              <Zap size={14} fill={isScenarioLabOpen ? 'currentColor' : 'none'} />
            </button>
          </div>
        </motion.div>
      </nav>

      {/* BIG ATLAS HEADLINE — the levels.fyi title block */}
      {!isPipelineOpen && (
        <motion.header
          key={activeRegion}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden md:block fixed left-8 top-28 select-none"
        >
          <p className="font-headline text-[11px] font-bold tracking-[0.35em] uppercase text-ink/50 mb-1">
            Luminous Atlas · Live Bubble Risk
          </p>
          <h1
            className="font-display uppercase leading-[0.95] text-ink text-[clamp(2.6rem,6vw,5.2rem)]"
            style={{ textShadow: '0 3px 0 rgba(255,255,255,0.7)' }}
          >
            {activeRegion}
          </h1>
          <p className="font-headline text-[11px] font-bold tracking-[0.2em] uppercase text-ink/40 mt-2">
            drag to orbit · scroll to zoom · tap a pill for details
          </p>
        </motion.header>
      )}

      {/* MAP LEGEND — building color ramp + risk dots */}
      <div className="hidden md:flex fixed left-8 bottom-36 flex-col gap-2.5 atlas-card px-4 py-3.5 pointer-events-auto">
        <span className="font-headline text-[9px] font-bold tracking-[0.2em] uppercase text-ink/50">
          Building height
        </span>
        <div className="w-44 h-2.5 rounded-full border border-ink/20"
          style={{ background: 'linear-gradient(90deg, #ffd97a, #ffb35c, #f2699c, #8f6bf5)' }}
        />
        <div className="flex justify-between font-headline text-[8px] font-bold uppercase tracking-wider text-ink/40">
          <span>Low-rise</span>
          <span>Tower</span>
        </div>
        <div className="flex items-center gap-3 pt-1 border-t border-ink/10">
          {([['#2fbf71', 'Safe'], ['#ffab2e', 'Watch'], ['#ff5050', 'At risk']] as const).map(([c, label]) => (
            <span key={label} className="flex items-center gap-1.5 font-headline text-[8px] font-bold uppercase tracking-wider text-ink/60">
              <span className="w-2 h-2 rounded-full border border-ink/30" style={{ background: c }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* RIGHT PROPERTY PANEL */}
      <PropertyPanel isOpen={!!selectedAssetId} onClose={() => setSelectedAssetId(null)} />

      {/* SCENARIO LAB PANEL */}
      <ScenarioLab />

      {/* LOCATIONS & ESTIMATES PANEL */}
      <LocationsPanel />

      {/* PROPAGATION TRACE (TERMINAL HUD) */}
      <PropagationHUD />

      {/* DATA INGESTION PIPELINE (LEFT) */}
      <DataPipelineSidebar />

      {/* ZONE INSIGHTS SIDEBAR (RIGHT) */}
      <ZoneInsights />

      {/* BOTTOM DRAWER */}
      <BottomDrawer />
    </div>
  )
}


export default HUD
