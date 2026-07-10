'use client'

import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Database, 
  Activity, 
  Clock, 
  Server, 
  ChevronLeft, 
  ChevronRight,
  Terminal,
  RefreshCw,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react'
import { useStore } from '@/store/useStore'

const DataPipelineSidebar = () => {
  const { 
    isPipelineOpen, 
    setIsPipelineOpen, 
    macroSnapshot, 
    backendStatus 
  } = useStore()
  
  const [logs, setLogs] = useState<string[]>([])
  const terminalEndRef = useRef<HTMLDivElement>(null)

  // On small screens the sidebar would cover the map, so start collapsed there.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setIsPipelineOpen(false)
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calculate last and next scheduled runs
  const snapshotDate = macroSnapshot?.snapshot_at 
    ? new Date(macroSnapshot.snapshot_at) 
    : new Date()
  
  // Scraper runs every 3 days (72 hours)
  const nextScheduledDate = new Date(snapshotDate.getTime() + 3 * 24 * 60 * 60 * 1000)

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  // Pre-generate standard scraper pipeline logs
  const staticLogs = [
    `[INFO] Initializing Ingestion Coordinator...`,
    `[INFO] Target Frequency: Every 3 Days (4320 mins).`,
    `[DB] Connecting to TimescaleDB instance... Connected.`,
    `[SCRAPER] Querying World Bank API for macro indexes...`,
    ` - GDP Growth Rate: ${macroSnapshot?.gdp_growth ?? 7.2}% (OK)`,
    ` - Unemployment Rate: ${macroSnapshot?.unemployment_rate ?? 4.1}% (OK)`,
    ` - CPI Inflation (YoY): ${macroSnapshot?.cpi_yoy ?? 4.8}% (OK)`,
    `[SCRAPER] Querying RBI DBIE for monetary rates...`,
    ` - Repo Rate: ${macroSnapshot?.repo_rate ?? 6.5}% (OK)`,
    ` - G-Sec 10Y Yield: ${macroSnapshot?.gsec_10y_yield ?? 7.1}% (OK)`,
    ` - G-Sec 2Y Yield: ${macroSnapshot?.gsec_2y_yield ?? 6.8}% (OK)`,
    `[SCRAPER] Scraping NHB RESIDEX portal...`,
    ` - Composite HPI (50 cities): ${macroSnapshot?.nhb_residex_composite ?? 124.5} (OK)`,
    `[CALCULATION] Starting intrinsic valuation models...`,
    ` - Valuating Discounted Cash Flows (DCF)... Complete.`,
    ` - Computing PIR, PRR, and Affordability index... Complete.`,
    `[AGENT] LangGraph Orchestrator running city models...`,
    ` - Mumbai, Delhi, Bangalore, Chennai, Pune, Ahmedabad (Updates Written)`,
    `[CACHE] Invalidation successful. Redis geo:bubble_map refreshed.`,
    `[INFO] Ingestion complete. Scraper sleeping. Next run in 72 hours.`
  ]

  // Simulate live terminal output
  useEffect(() => {
    if (isPipelineOpen) {
      setLogs([])
      let idx = 0
      const timer = setInterval(() => {
        if (idx < staticLogs.length) {
          const timestamp = new Date().toLocaleTimeString('en-IN', { hour12: false })
          setLogs(prev => [...prev, `[${timestamp}] ${staticLogs[idx]}`])
          idx++
        } else {
          clearInterval(timer)
        }
      }, 500)
      return () => clearInterval(timer)
    }
  }, [isPipelineOpen, macroSnapshot])

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  return (
    <>
      {/* COLLAPSED TAB */}
      <AnimatePresence>
        {!isPipelineOpen && (
          <motion.button
            initial={{ x: -100 }}
            animate={{ x: 0 }}
            exit={{ x: -100 }}
            onClick={() => setIsPipelineOpen(true)}
            className="fixed left-0 top-1/2 -translate-y-1/2 bg-[#0f4d23] text-white p-3 rounded-r-2xl shadow-xl pointer-events-auto z-[60] flex flex-col items-center gap-2"
          >
            <Database size={20} className="animate-pulse" />
            <span className="text-[10px] font-bold uppercase vertical-text tracking-widest py-2">Pipeline</span>
            <ChevronRight size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* FULL SIDEBAR */}
      <motion.div
        initial={false}
        animate={{ x: isPipelineOpen ? 0 : -460 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed z-[60] bg-white/95 backdrop-blur-xl border border-[#0f4d2320] rounded-3xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto
                   top-20 left-3 bottom-28 w-[min(380px,92vw)]
                   sm:top-24 sm:left-6 sm:bottom-40 sm:w-[380px]"
      >
        {/* HEADER */}
        <div className="p-5 border-b border-[#0f4d2310] flex items-center justify-between bg-[#0f4d2305]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#0f4d23] text-yellow-400">
              <Server size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0f4d23] font-headline uppercase tracking-tight">Ingestion Pipeline</h2>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">
                  {backendStatus === 'connected' ? 'Scraper Active' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsPipelineOpen(false)}
            className="p-2 hover:bg-[#0f4d2310] rounded-full transition-colors text-slate-400 hover:text-[#0f4d23]"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* PIPELINE STATS & SCHEDULE */}
        <div className="p-5 space-y-4 border-b border-[#0f4d2305] bg-[#0f4d2302]">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-black/5 flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock size={10} /> Last Sync
              </span>
              <span className="text-[10px] font-black text-slate-800 mt-1">
                {formatDateTime(snapshotDate)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-black/5 flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin text-slate-400" /> Next Sync
              </span>
              <span className="text-[10px] font-black text-[#0f4d23] mt-1">
                {formatDateTime(nextScheduledDate)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-[#0f4d230a] rounded-2xl border border-[#0f4d2315] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-[#0f4d23]" />
              <span className="text-[9px] font-extrabold text-[#0f4d23] uppercase tracking-wider">Frequency Configuration</span>
            </div>
            <span className="text-[10px] font-black text-[#0f4d23]">Every 3 Days</span>
          </div>
        </div>

        {/* SCRAPED METRICS STRIP */}
        <div className="p-5 space-y-3">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1.5">
            <FileSpreadsheet size={12} /> Active Scrape Targets
          </h3>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center p-2.5 bg-slate-50/55 rounded-xl border border-black/5">
              <span className="text-[10px] font-semibold text-slate-600">RBI Repo Rate</span>
              <span className="text-[11px] font-extrabold text-[#0f4d23]">{macroSnapshot?.repo_rate ?? 6.5}%</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-slate-50/55 rounded-xl border border-black/5">
              <span className="text-[10px] font-semibold text-slate-600">World Bank GDP Growth</span>
              <span className="text-[11px] font-extrabold text-[#0f4d23]">{macroSnapshot?.gdp_growth ?? 7.2}%</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-slate-50/55 rounded-xl border border-black/5">
              <span className="text-[10px] font-semibold text-slate-600">NHB Composite RESIDEX</span>
              <span className="text-[11px] font-extrabold text-[#0f4d23]">{macroSnapshot?.nhb_residex_composite ?? 124.5}</span>
            </div>
          </div>
        </div>

        {/* LIVE TERMINAL SCRAPER LOGS */}
        <div className="flex-1 p-5 flex flex-col min-h-0 bg-slate-900 border-t border-[#0f4d2320]">
          <h3 className="text-[9px] font-black text-[#0f4d23] uppercase tracking-[0.15em] flex items-center gap-1.5 mb-3 font-mono">
            <Terminal size={12} /> Scraper Console Output
          </h3>
          <div className="flex-1 bg-slate-950/80 rounded-2xl p-4 font-mono text-[9px] text-[#0f4d23] overflow-y-auto space-y-2 scrollbar-hide border border-[#0f4d2330]">
            {logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed break-all">
                {log}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </motion.div>
    </>
  )
}

export default DataPipelineSidebar
