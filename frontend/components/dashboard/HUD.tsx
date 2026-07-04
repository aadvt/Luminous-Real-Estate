'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { useStore } from '@/store/useStore'
import MetricStrip from '@/components/dashboard/MetricStrip'
import BottomDrawer from '@/components/dashboard/BottomDrawer'
import PropertyPanel from '@/components/dashboard/PropertyPanel'
import ScenarioLab from '@/components/dashboard/ScenarioLab'
import PropagationHUD from '@/components/dashboard/PropagationHUD'
import DataPipelineSidebar from '@/components/dashboard/DataPipelineSidebar'
import ZoneInsights from '@/components/dashboard/ZoneInsights'

const HUD = () => {
  const { 
    selectedAssetId, 
    setSelectedAssetId, 
    backendStatus, 
    flyToLocation, 
    activeRegion,
    isScenarioLabOpen,
    setIsScenarioLabOpen
  } = useStore()

  const CITIES = [
    { label: 'Mumbai', lng: 72.8656, lat: 19.0658, zoom: 16.5 },
    { label: 'Delhi', lng: 77.2090, lat: 28.6139, zoom: 16.5 },
    { label: 'Bangalore', lng: 77.5946, lat: 12.9716, zoom: 16.5 },
    { label: 'Chennai', lng: 80.2707, lat: 13.0827, zoom: 16.5 },
    { label: 'Hyderabad', lng: 78.3725, lat: 17.4478, zoom: 16.5 },
    { label: 'Kolkata', lng: 88.4651, lat: 22.5892, zoom: 16.5 },
    { label: 'Pune', lng: 73.7334, lat: 18.5913, zoom: 16.5 },
    { label: 'Ahmedabad', lng: 72.6841, lat: 23.1610, zoom: 16.5 },
  ]

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex flex-col font-body">
      {/* TOP NAVIGATION PILL - Matcha Light Style */}
      <nav className="fixed top-0 left-0 right-0 flex justify-center py-8">
        <motion.div 
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="nav-pill flex items-center gap-10 pointer-events-auto"
        >
          <div className="text-xl font-bold tracking-tighter text-[#0f4d23] font-headline">
            LUMINOUS <span className="font-light opacity-60 text-[10px] text-[#1A1D1A]">REAL ESTATE</span>
          </div>
          
          <div className="flex gap-2">
            {CITIES.map((city) => (
              <button
                key={city.label}
                onClick={() => flyToLocation(city.lng, city.lat, city.zoom, city.label)}
                className={`font-headline text-[10px] font-bold tracking-[0.15em] uppercase transition-all px-3 py-1.5 rounded-full ${
                  activeRegion === city.label
                    ? 'bg-[#0f4d23] text-white'
                    : 'text-slate-400 hover:text-[#0f4d23] hover:bg-[#0f4d2310]'
                }`}
              >
                {city.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 pl-6 border-l border-black/5">
            {/* Live backend status indicator */}
            <div className={`w-2 h-2 rounded-full ${
              backendStatus === 'connected' ? 'bg-emerald-500 animate-pulse'
              : backendStatus === 'loading' ? 'bg-amber-400 animate-pulse'
              : 'bg-red-400'
            }`} />
            <div className="bg-[#0f4d2315] text-[#0f4d23] px-4 py-1 rounded-full text-[9px] font-bold font-headline tracking-tighter border border-[#0f4d2330]">
              {backendStatus === 'connected' ? 'ENGINE LIVE' : backendStatus === 'loading' ? 'CONNECTING...' : 'OFFLINE'}
            </div>

            <button
              onClick={() => setIsScenarioLabOpen(!isScenarioLabOpen)}
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

      {/* PROPAGATION TRACE (TERMINAL HUD) */}
      <PropagationHUD />

      {/* NEW AI CHAT SIDEBAR (LEFT) */}
      <DataPipelineSidebar />

      {/* NEW ZONE INSIGHTS SIDEBAR (RIGHT) */}
      <ZoneInsights />

      {/* BOTTOM DRAWER (116px) */}
      <BottomDrawer />
    </div>
  )
}


export default HUD
