'use client'

import RealityEngine from '@/components/dashboard/RealityEngine'
import HUD from '@/components/dashboard/HUD'
import LiveDataLoop from '@/components/LiveDataLoop'

export default function Home() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-paper">
      {/* 3D Visualization Layer */}
      <RealityEngine />

      {/* Interface Layer (HUD, Panels, Stats) */}
      <HUD />

      {/* Live Backend Data Loop */}
      <LiveDataLoop />
    </div>
  )
}
