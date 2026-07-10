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
  } = useStore()

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex flex-col font-body">
      {/* TOP NAVIGATION PILL - Matcha Light Style (responsive) */}
      <nav className="fixed top-0 left-0 right-0 flex justify-center py-3 sm:py-8 px-3">
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="nav-pill flex items-center gap-3 sm:gap-8 pointer-events-auto max-w-[calc(100vw-24px)]"
        >
          <div className="text-base sm:text-xl font-bold tracking-tighter text-[#0f4d23] font-headline shrink-0">
            LUMINOUS <span className="hidden sm:inline font-light opacity-60 text-[10px] text-[#1A1D1A]">REAL ESTATE</span>
          </div>

          {/* City selector — horizontally scrollable on small screens */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar min-w-0">
            {CITIES.map((city) => (
              <button
                key={city.label}
                onClick={() => flyToLocation(city.lng, city.lat, 16.5, city.label)}
                className={`font-headline text-[10px] font-bold tracking-[0.15em] uppercase transition-all px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 ${
                  activeRegion === city.label
                    ? 'bg-[#0f4d23] text-white'
                    : 'text-slate-400 hover:text-[#0f4d23] hover:bg-[#0f4d2310]'
                }`}
              >
                {city.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 sm:pl-6 sm:border-l border-black/5 shrink-0">
            {/* Live backend status indicator */}
            <div className={`w-2 h-2 rounded-full ${
              backendStatus === 'connected' ? 'bg-emerald-500 animate-pulse'
              : backendStatus === 'loading' ? 'bg-amber-400 animate-pulse'
              : 'bg-red-400'
            }`} />
            <div className="hidden md:block bg-[#0f4d2315] text-[#0f4d23] px-4 py-1 rounded-full text-[9px] font-bold font-headline tracking-tighter border border-[#0f4d2330]">
              {backendStatus === 'connected' ? 'ENGINE LIVE' : backendStatus === 'loading' ? 'CONNECTING...' : 'OFFLINE'}
            </div>

            {/* Locations & Estimates toggle */}
            <button
              onClick={() => setIsLocationsOpen(!isLocationsOpen)}
              title="Locations & cost estimates"
              className={`p-1.5 rounded-full transition-all ${
                isLocationsOpen
                ? 'bg-[#0f4d23] text-yellow-400'
                : 'bg-slate-100 text-[#0f4d23] hover:bg-[#0f4d2310]'
              }`}
            >
              <MapPin size={14} fill={isLocationsOpen ? 'currentColor' : 'none'} />
            </button>

            {/* Scenario Lab toggle */}
            <button
              onClick={() => setIsScenarioLabOpen(!isScenarioLabOpen)}
              title="Scenario Lab"
              className={`p-1.5 rounded-full transition-all ${
                isScenarioLabOpen
                ? 'bg-[#0f4d23] text-yellow-400'
                : 'bg-slate-100 text-[#0f4d23] hover:bg-[#0f4d2310]'
              }`}
            >
              <Zap size={14} fill={isScenarioLabOpen ? 'currentColor' : 'none'} />
            </button>
          </div>
        </motion.div>
      </nav>

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
