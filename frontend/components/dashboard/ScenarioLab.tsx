'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, Zap, Info, TrendingUp, AlertTriangle, FileText, Loader2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { api } from '@/lib/apiClient'

const ScenarioLab = () => {
  const { 
    isScenarioLabOpen, 
    setIsScenarioLabOpen, 
    activeRegion,
    setIsTracing,
    setPropagationSteps
  } = useStore()
  
  const [params, setParams] = useState({
    rate_change_bps: 0,
    inflation_change_pct: 0,
    gdp_shock_pct: 0,
  })

  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleRun = async () => {
    setLoading(true)
    setResult(null)
    setIsTracing(true) // Start the tracing animation HUD
    
    // Determine a more realistic base value based on active region price index
    const cityBaseLakh = activeRegion === 'Mumbai' ? 120 : activeRegion === 'Delhi' ? 95 : 65;

    try {
      // Execute simulations
      const data = await api('/api/scenario/run', {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          region: activeRegion,
          base_value_lakh: cityBaseLakh,
          n_simulations: 10000
        }),
      })
      setResult(data)
      
      // Update propagation steps for the HUD trace
      if (data.propagation_trace) {
        setPropagationSteps(data.propagation_trace)
      }
      
      // Simulation complete, display values in ScenarioLab HUD
      
    } catch (err) {
      console.error('Simulation failed:', err)
      setIsTracing(false)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!result) return
    setDownloading(true)
    try {
      // Dynamic imports to avoid issues with Next.js SSR
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF()
      const safeRegion = activeRegion.replace(/[^a-z0-9]/gi, '_').toLowerCase()

      // Branded Header
      doc.setFillColor(15, 77, 35) // #0f4d23
      doc.rect(0, 0, 210, 40, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.text('LUMINOUS REAL ESTATE', 105, 20, { align: 'center' })
      doc.setFontSize(10)
      doc.text('Advanced Probabilistic Risk Simulation V3.1', 105, 30, { align: 'center' })

      // Meta Info
      doc.setTextColor(50, 50, 50)
      doc.setFontSize(10)
      doc.text(`Region: ${activeRegion}`, 20, 50)

      // Section 1: Parameters
      doc.setFontSize(14)
      doc.setTextColor(15, 77, 35)
      doc.text('1. SCENARIO PARAMETERS', 20, 70)

      autoTable(doc, {
        startY: 75,
        head: [['Variable', 'Input Shock']],
        body: [
          ['Repo Rate Move', `${params.rate_change_bps} BPS`],
          ['Inflation Pulse', `${params.inflation_change_pct}%`],
          ['GDP Shock (Demand)', `${params.gdp_shock_pct}%`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }
      })

      // Section 2: Results
      const finalY = (doc as any).lastAutoTable.finalY + 15
      doc.text('2. SIMULATION OUTPUTS (10k ITERATIONS)', 20, finalY)

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Confidence Level', 'Projected Value']],
        body: [
          ['Base Case (Expected Value)', fmtInr(result.p50)],
          ['Worst Case (Market Correction)', fmtInr(result.p5)],
          ['Best Case (Optimistic Growth)', fmtInr(result.p95)],
          ['Investment Safety Margin', `${((1 - result.prob_below_current) * 100).toFixed(2)}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 77, 35] }
      })

      // Section 3: Narrative
      if (result.narrative) {
        const narrativeY = (doc as any).lastAutoTable.finalY + 15
        doc.text('3. AI EXECUTIVE SUMMARY', 20, narrativeY)
        doc.setFontSize(10)
        doc.setTextColor(80, 80, 80)
        
        const splitText = doc.splitTextToSize(result.narrative, 170)
        doc.text(splitText, 20, narrativeY + 10)
      }

      doc.save(`Luminous_Report_${safeRegion}.pdf`)
    } catch (err) {
      console.error('jsPDF generation failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  const fmtInr = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`
    return `₹${val.toLocaleString()}`
  }

  return (
    <AnimatePresence>
      {isScenarioLabOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-24 right-6 bottom-40 w-[420px] bg-white/95 backdrop-blur-xl border border-[#0f4d2320] rounded-3xl z-[60] shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
        >
          {/* HEADER */}
          <div className="p-6 border-b border-[#0f4d2310] flex items-center justify-between bg-[#0f4d2305]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#0f4d23] rounded-xl text-yellow-400">
                <Zap size={18} fill="currentColor" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0f4d23] font-headline">SCENARIO LAB</h2>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">MONTE CARLO STRESS TEST</p>
              </div>
            </div>
            <button 
              onClick={() => setIsScenarioLabOpen(false)}
              className="p-2 hover:bg-[#0f4d2310] rounded-full transition-colors"
            >
              <X size={20} className="text-[#0f4d23]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            {/* INSTRUCTIONS */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-3 italic">
              <Info size={16} className="text-[#0f4d23] mt-1 shrink-0" />
              <p className="text-xs text-slate-600 leading-relaxed font-body">
                Modify macro-economic variables to observe direct probabilistic impact on urban real estate valuations. 10k simulations per run.
              </p>
            </div>

            {/* CONTROLS */}
            <div className="space-y-6">
              {/* Interest Rate */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-bold text-[#0f4d23] uppercase tracking-tighter">Repo Rate Move</label>
                  <span className={`text-xs font-mono font-bold ${params.rate_change_bps >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {params.rate_change_bps > 0 ? '+' : ''}{params.rate_change_bps} BPS
                  </span>
                </div>
                <input 
                  type="range" min="-500" max="1000" step="25"
                  value={params.rate_change_bps}
                  onChange={(e) => setParams(p => ({ ...p, rate_change_bps: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0f4d23]"
                />
              </div>

              {/* Inflation */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-bold text-[#0f4d23] uppercase tracking-tighter">Inflation Pulse</label>
                  <span className={`text-xs font-mono font-bold ${params.inflation_change_pct >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {params.inflation_change_pct > 0 ? '+' : ''}{params.inflation_change_pct}%
                  </span>
                </div>
                <input 
                  type="range" min="-5" max="20" step="1"
                  value={params.inflation_change_pct}
                  onChange={(e) => setParams(p => ({ ...p, inflation_change_pct: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0f4d23]"
                />
              </div>

              {/* GDP */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-bold text-[#0f4d23] uppercase tracking-tighter">GDP Shock (Demand)</label>
                  <span className={`text-xs font-mono font-bold ${params.gdp_shock_pct < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {params.gdp_shock_pct > 0 ? '+' : ''}{params.gdp_shock_pct}%
                  </span>
                </div>
                <input 
                  type="range" min="-10" max="10" step="1"
                  value={params.gdp_shock_pct}
                  onChange={(e) => setParams(p => ({ ...p, gdp_shock_pct: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0f4d23]"
                />
              </div>
            </div>

            {/* RESULTS SECTION */}
            <AnimatePresence>
              {result && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-4 border-t border-[#0f4d2310]"
                >
                  <div className="flex items-center gap-2 text-[#0f4d23]">
                    <TrendingUp size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Simulation Output</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Base Case Scenario</p>
                      <p className="text-sm font-bold text-[#0f4d23]">{fmtInr(result.p50)}</p>
                    </div>
                    <div className={`p-4 rounded-2xl border ${result.prob_below_current > 0.4 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                      <p className={`text-[8px] font-bold uppercase mb-1 ${result.prob_below_current > 0.4 ? 'text-red-400' : 'text-emerald-400'}`}>Investment Safety</p>
                      <p className={`text-sm font-bold ${result.prob_below_current > 0.4 ? 'text-red-600' : 'text-emerald-600'}`}>{((1 - result.prob_below_current) * 100).toFixed(1)}%</p>
                    </div>
                  </div>

                  {result.prob_below_current > 0.6 && (
                    <div className="bg-red-600 text-white p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                      <AlertTriangle size={20} />
                      <p className="text-[10px] font-bold uppercase tracking-tight leading-tight">CRITICAL: High probability of asset impairment under this scenario.</p>
                    </div>
                  )}

                  <button
                    onClick={handleDownloadReport}
                    disabled={downloading}
                    className="w-full mt-2 py-3 bg-white border border-[#0f4d2320] text-[#0f4d23] rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                    {downloading ? 'GENERATING REPORT...' : 'DOWNLOAD FULL PDF REPORT'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* FOOTER ACTION */}
          <div className="p-6 bg-slate-50 border-t border-[#0f4d2310]">
            <button
              onClick={handleRun}
              disabled={loading}
              className="w-full py-4 bg-[#0f4d23] hover:bg-[#082d14] disabled:bg-slate-300 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all transform active:scale-[0.98]"
            >
              {loading ? (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                >
                  <Zap size={20} />
                </motion.div>
              ) : (
                <Play size={20} fill="currentColor" />
              )}
              {loading ? 'CALCULATING 10,000 SCENARIOS...' : 'RUN STRESS TEST'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ScenarioLab
