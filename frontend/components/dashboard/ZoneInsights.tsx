'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, ZoneData } from '@/store/useStore'
import { X, TrendingUp, Home, AlertTriangle, Target, Briefcase, Zap } from 'lucide-react'

const ZoneInsights = () => {
  const { selectedZone, setSelectedZone } = useStore()

  if (!selectedZone) return null

  const getRecColor = (rec: ZoneData['recommendation']) => {
    switch (rec) {
      case 'BUY': return 'text-emerald-500'
      case 'HOLD': return 'text-amber-500'
      case 'SELL': return 'text-rose-500'
      default: return 'text-slate-500'
    }
  }

  const getRiskLabel = (score: number) => {
    if (score < 30) return { label: 'Excellent', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
    if (score < 60) return { label: 'Moderate', color: 'text-amber-500', bg: 'bg-amber-500/10' }
    return { label: 'At Risk', color: 'text-rose-500', bg: 'bg-rose-500/10' }
  }

  const risk = getRiskLabel(selectedZone.risk_score)

  return (
    <AnimatePresence>
      <motion.div
        key={selectedZone.id}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        className="fixed z-50 pointer-events-auto flex flex-col
                   inset-x-3 bottom-3 top-auto max-h-[80vh]
                   sm:inset-x-auto sm:top-28 sm:right-8 sm:bottom-48 sm:w-[400px] sm:max-h-none"
      >
        <div className="bg-white/95 backdrop-blur-3xl rounded-[32px] shadow-[0_40px_100px_rgba(0,0,0,0.3)] border border-white/40 overflow-hidden flex flex-col h-full ring-1 ring-black/5">
          {/* Header - Fixed */}
          <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-5 sm:pb-6 flex justify-between items-start shrink-0 bg-white/50 border-b border-slate-100/50">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${risk.bg} ${risk.color}`}>
                  {risk.label} Stability
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">
                {selectedZone.name}
              </h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                <span className="w-1 h-1 bg-slate-400 rounded-full" />
                {selectedZone.region} Investment Node
              </p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setSelectedZone(null);
              }}
              className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group border border-slate-100 shadow-sm pointer-events-auto"
              aria-label="Close panel"
            >
              <X className="w-5 h-5 text-slate-500 group-hover:text-slate-800" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-4 space-y-8 scroll-smooth select-text custom-scrollbar">
            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <MetricBox 
                icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
                label="Annual Yield"
                value={`${selectedZone.yield_pct}%`}
              />
              <MetricBox 
                icon={<Target className="w-4 h-4 text-blue-500" />}
                label="Appreciation"
                value={`${selectedZone.appreciation_pct}%`}
              />
              <MetricBox 
                icon={<Home className="w-4 h-4 text-purple-500" />}
                label="Occupancy"
                value={`${selectedZone.occupancy_pct}%`}
              />
              <MetricBox 
                icon={<Briefcase className="w-4 h-4 text-orange-500" />}
                label="Risk Score"
                value={`${selectedZone.risk_score}/100`}
              />
            </div>

            {/* Strategy Recommendation */}
            <div className="space-y-6">
              <div className="p-6 bg-[#0f4d23]/5 rounded-3xl border border-[#0f4d23]/10 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-[#0f4d23]/60 uppercase tracking-widest">
                    Recommendation
                  </span>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-100 shadow-sm`}>
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${getRecColor(selectedZone.recommendation).replace('text-', 'bg-')}`} />
                    <span className={`text-[11px] font-black tracking-tighter ${getRecColor(selectedZone.recommendation)}`}>
                      STRICT {selectedZone.recommendation}
                    </span>
                  </div>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed font-semibold tracking-tight">
                  {selectedZone.narrative}
                </p>
              </div>

              <div className="pt-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <div className="w-10 h-[1px] bg-slate-200" />
                  Zone Intelligence
                </span>
                <p className="text-slate-500 text-xs leading-relaxed font-medium pl-2 border-l-2 border-slate-100 pb-8">
                  {selectedZone.details}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(15, 77, 35, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(15, 77, 35, 0.2);
        }
      `}</style>
    </AnimatePresence>
  )
}

const MetricBox = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
    <div className="mb-2 p-2 bg-white rounded-xl shadow-sm border border-slate-50">{icon}</div>
    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{label}</span>
    <div className="text-lg font-black text-slate-800 tracking-tighter">{value}</div>
  </div>
)

export default ZoneInsights
