'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, Zap, Info, TrendingUp, AlertTriangle, FileText, Loader2, Send, Sparkles } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { api } from '@/lib/apiClient'
import type { QueryResult } from '@/lib/apiClient'

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

  // Natural-language "what if" query state
  const [nlQuery, setNlQuery] = useState('')
  const [nlLoading, setNlLoading] = useState(false)
  const [nlAnswer, setNlAnswer] = useState<string | null>(null)
  const [nlError, setNlError] = useState<string | null>(null)

  const handleAsk = async () => {
    const question = nlQuery.trim()
    if (!question || nlLoading) return
    setNlLoading(true)
    setNlAnswer(null)
    setNlError(null)
    try {
      const data = await api<QueryResult>('/api/query', {
        method: 'POST',
        body: JSON.stringify({ question, region: activeRegion }),
      })
      setNlAnswer(data.answer || 'No answer returned by the engine.')

      // If the engine interpreted this as a simulation, surface the distribution
      if (data.mc_results) {
        const mc = data.mc_results
        setResult({ ...mc, narrative: data.answer })
        if (mc.propagation_trace?.length) {
          setPropagationSteps(mc.propagation_trace)
          setIsTracing(true)
        }
      }
    } catch (err: any) {
      console.error('NL query failed:', err)
      setNlError('Engine unreachable — natural-language scenarios need the live backend.')
    } finally {
      setNlLoading(false)
    }
  }

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
      doc.setFillColor(30, 27, 46) // #1e1b2e
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
        headStyles: { fillColor: [47, 191, 113] }
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
        headStyles: { fillColor: [30, 27, 46] }
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
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed z-[60] bg-white/95 backdrop-blur-xl border-2 border-[#1e1b2e1f] shadow-[0_6px_0_rgba(30,27,46,0.08),0_24px_60px_rgba(30,27,46,0.18)] flex flex-col overflow-hidden pointer-events-auto
                     inset-x-3 bottom-3 top-auto max-h-[85vh] rounded-3xl
                     sm:inset-x-auto sm:top-24 sm:right-6 sm:bottom-40 sm:w-[420px] sm:max-h-none"
        >
          {/* HEADER */}
          <div className="p-6 border-b border-[#1e1b2e10] flex items-center justify-between bg-[#1e1b2e05]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#1e1b2e] rounded-xl text-[#ffc845]">
                <Zap size={18} fill="currentColor" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1e1b2e] font-headline">SCENARIO LAB</h2>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">MONTE CARLO STRESS TEST</p>
              </div>
            </div>
            <button 
              onClick={() => setIsScenarioLabOpen(false)}
              className="p-2 hover:bg-[#1e1b2e10] rounded-full transition-colors"
            >
              <X size={20} className="text-[#1e1b2e]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            {/* INSTRUCTIONS */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-3 italic">
              <Info size={16} className="text-[#1e1b2e] mt-1 shrink-0" />
              <p className="text-xs text-slate-600 leading-relaxed font-body">
                Ask a &ldquo;what if&rdquo; in plain English, or fine-tune the macro sliders below.
                Each run executes 10k Monte Carlo simulations on {activeRegion}.
              </p>
            </div>

            {/* NATURAL-LANGUAGE SCENARIO BOX */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-[#1e1b2e] uppercase tracking-[0.15em] flex items-center gap-1.5">
                <Sparkles size={12} /> Ask a Scenario
              </label>
              <div className="relative">
                <textarea
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAsk()
                    }
                  }}
                  rows={2}
                  placeholder="e.g. What if the RBI hikes the repo rate by 200 bps and inflation jumps 4%?"
                  className="w-full resize-none rounded-2xl border border-[#1e1b2e20] bg-white px-4 py-3 pr-12 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e1b2e30] leading-relaxed"
                />
                <button
                  onClick={handleAsk}
                  disabled={nlLoading || !nlQuery.trim()}
                  className="absolute bottom-3 right-3 p-2 rounded-xl bg-[#1e1b2e] text-white disabled:opacity-40 hover:bg-[#2a2740] transition-colors"
                  aria-label="Run natural-language scenario"
                >
                  {nlLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>

              {/* Quick-prompt chips */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'What if repo rate rises 250 bps?',
                  'Impact of 5% inflation spike?',
                  'IT sector slowdown, GDP -3%?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setNlQuery(q)}
                    className="text-[9px] font-semibold text-[#1e1b2e] bg-[#1e1b2e0a] hover:bg-[#1e1b2e15] border border-[#1e1b2e15] px-2.5 py-1 rounded-full transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {nlError && (
                <p className="text-[10px] text-rose-500 font-medium px-1">{nlError}</p>
              )}
              {nlAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-[#1e1b2e08] border border-[#1e1b2e15] rounded-2xl"
                >
                  <div className="flex items-center gap-1.5 mb-2 text-[#1e1b2e]">
                    <Sparkles size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Engine Response</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{nlAnswer}</p>
                </motion.div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#1e1b2e10]" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">or tune manually</span>
              <div className="h-px flex-1 bg-[#1e1b2e10]" />
            </div>

            {/* CONTROLS */}
            <div className="space-y-6">
              {/* Interest Rate */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-bold text-[#1e1b2e] uppercase tracking-tighter">Repo Rate Move</label>
                  <span className={`text-xs font-mono font-bold ${params.rate_change_bps >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {params.rate_change_bps > 0 ? '+' : ''}{params.rate_change_bps} BPS
                  </span>
                </div>
                <input 
                  type="range" min="-500" max="1000" step="25"
                  value={params.rate_change_bps}
                  onChange={(e) => setParams(p => ({ ...p, rate_change_bps: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1e1b2e]"
                />
              </div>

              {/* Inflation */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-bold text-[#1e1b2e] uppercase tracking-tighter">Inflation Pulse</label>
                  <span className={`text-xs font-mono font-bold ${params.inflation_change_pct >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {params.inflation_change_pct > 0 ? '+' : ''}{params.inflation_change_pct}%
                  </span>
                </div>
                <input 
                  type="range" min="-5" max="20" step="1"
                  value={params.inflation_change_pct}
                  onChange={(e) => setParams(p => ({ ...p, inflation_change_pct: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1e1b2e]"
                />
              </div>

              {/* GDP */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-bold text-[#1e1b2e] uppercase tracking-tighter">GDP Shock (Demand)</label>
                  <span className={`text-xs font-mono font-bold ${params.gdp_shock_pct < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {params.gdp_shock_pct > 0 ? '+' : ''}{params.gdp_shock_pct}%
                  </span>
                </div>
                <input 
                  type="range" min="-10" max="10" step="1"
                  value={params.gdp_shock_pct}
                  onChange={(e) => setParams(p => ({ ...p, gdp_shock_pct: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1e1b2e]"
                />
              </div>
            </div>

            {/* RESULTS SECTION */}
            <AnimatePresence>
              {result && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-4 border-t border-[#1e1b2e10]"
                >
                  <div className="flex items-center gap-2 text-[#1e1b2e]">
                    <TrendingUp size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Simulation Output</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Base Case Scenario</p>
                      <p className="text-sm font-bold text-[#1e1b2e]">{fmtInr(result.p50)}</p>
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
                    className="w-full mt-2 py-3 bg-white border border-[#1e1b2e20] text-[#1e1b2e] rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                    {downloading ? 'GENERATING REPORT...' : 'DOWNLOAD FULL PDF REPORT'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* FOOTER ACTION */}
          <div className="p-6 bg-slate-50 border-t border-[#1e1b2e10]">
            <button
              onClick={handleRun}
              disabled={loading}
              className="w-full py-4 bg-[#1e1b2e] hover:bg-[#2a2740] disabled:bg-slate-300 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all transform active:scale-[0.98]"
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
