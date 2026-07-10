'use client'

import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { Terminal, Activity, ChevronRight, Binary } from 'lucide-react'

const PropagationHUD = () => {
  const { propagationSteps, isTracing, setIsTracing } = useStore()
  const [visibleSteps, setVisibleSteps] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isTracing && propagationSteps.length > 0) {
      // Logic for sequential reveal
      let i = 0
      setVisibleSteps([])
      const interval = setInterval(() => {
        if (i < propagationSteps.length) {
          setVisibleSteps(prev => [...prev, propagationSteps[i]])
          // Play a subtle sound effect here if implemented
          i++
        } else {
          clearInterval(interval)
          // Hide after 8 seconds of completion
          setTimeout(() => setIsTracing(false), 8000)
        }
      }, 800)
      return () => clearInterval(interval)
    }
  }, [isTracing, propagationSteps, setIsTracing])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visibleSteps])

  return (
    <AnimatePresence>
      {isTracing && (
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="fixed z-50 flex flex-col pointer-events-none max-h-[400px]
                     left-3 top-20 w-[min(320px,90vw)]
                     sm:left-8 sm:top-1/4 sm:w-80"
        >
          {/* HUD Header */}
          <div className="bg-black/80 backdrop-blur-xl border-l-4 border-emerald-500 p-4 rounded-tr-2xl shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal size={14} className="text-emerald-400 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Logic Propagation</span>
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">MC-ENGINE TRACE // LIVE</span>
              </div>
            </div>
            <Activity size={14} className="text-emerald-900" />
          </div>

          {/* Terminal Body */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-black/60 backdrop-blur-md border-l-4 border-emerald-500/30 p-4 space-y-3 scrollbar-hide font-mono shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"
          >
            {visibleSteps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-2"
              >
                <div className="mt-1">
                  <ChevronRight size={10} className="text-emerald-500" />
                </div>
                <div className="flex flex-col">
                  <p className="text-[11px] text-emerald-200/90 leading-relaxed font-bold lowercase tracking-wide">
                    {step}
                  </p>
                  <div className="h-px w-full bg-emerald-500/10 mt-1" />
                </div>
              </motion.div>
            ))}

            {visibleSteps.length < propagationSteps.length && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                <Binary size={10} className="text-emerald-500 animate-spin" />
                <span className="text-[9px] text-emerald-500/60 font-black uppercase tracking-widest">Processing Determinants...</span>
              </div>
            )}
          </div>

          {/* HUD Footer - Signal bars */}
          <div className="bg-black/80 backdrop-blur-md p-2 rounded-br-2xl border-l-4 border-emerald-500/50 flex justify-end gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div 
                key={i} 
                className="w-1 bg-emerald-500/20 rounded-full h-2"
                style={{ height: `${i * 2 + 2}px`, opacity: 0.2 + (i * 0.15)}}
              />
            ))}
          </div>
          
          {/* Scanline Effect Overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10 rounded-2xl">
            <div className="w-full h-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default PropagationHUD
