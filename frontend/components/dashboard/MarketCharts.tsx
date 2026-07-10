'use client'

import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface ConfidenceGaugeProps {
  value: string // e.g. "95.97%" or "Offline"
  status: 'connected' | 'loading' | 'disconnected' | 'error'
}

export const ConfidenceGauge = ({ value, status }: ConfidenceGaugeProps) => {
  const svgRef = useRef<SVGSVGElement>(null)
  
  const numericValue = parseFloat(value) || 0
  const isSyncing = status === 'loading'
  const isOffline = status === 'disconnected' || status === 'error'

  useEffect(() => {
    if (!svgRef.current) return

    const width = 160
    const height = 100
    const centerX = width / 2
    const centerY = 80
    const radius = 60

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const arcGenerator = d3.arc()
      .innerRadius(radius - 8)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)

    // Background Arc
    svg.append('path')
      .attr('d', arcGenerator({ 
        innerRadius: radius - 8, 
        outerRadius: radius, 
        startAngle: -Math.PI / 2, 
        endAngle: Math.PI / 2 
      }) as any)
      .attr('transform', `translate(${centerX}, ${centerY})`)
      .attr('fill', '#f1f5f9')

    // Data Arc
    const color = isOffline ? '#94a3b8' : isSyncing ? '#f59e0b' : '#10b981'
    const endAngle = (-Math.PI / 2) + (Math.PI * (numericValue / 100))

    const foreground = svg.append('path')
      .attr('transform', `translate(${centerX}, ${centerY})`)
      .attr('fill', color)
      .datum({ 
        innerRadius: radius - 8, 
        outerRadius: radius, 
        startAngle: -Math.PI / 2, 
        endAngle: -Math.PI / 2 
      })
      .attr('d', arcGenerator as any)

    foreground.transition()
      .duration(1000)
      .attrTween('d', function(d: any) {
        const interpolate = d3.interpolate(d.endAngle, endAngle)
        return function(t) {
          d.endAngle = interpolate(t)
          return arcGenerator(d) as any
        }
      })

    // Dot at the end of the arc for glow
    const dotX = centerX + radius * Math.cos(endAngle - Math.PI / 2)
    const dotY = centerY + radius * Math.sin(endAngle - Math.PI / 2)

    if (!isOffline) {
      svg.append('circle')
        .attr('cx', dotX)
        .attr('cy', dotY)
        .attr('r', 4)
        .attr('fill', color)
        .attr('class', isSyncing ? 'animate-pulse' : '')
        .style('filter', `drop-shadow(0 0 4px ${color})`)
    }

  }, [numericValue, status, isSyncing, isOffline])

  return (
    <div className="flex flex-col items-center">
      <svg ref={svgRef} width="160" height="100" />
      <div className="mt-[-25px] flex flex-col items-center">
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Reliability</span>
        <span className={`text-lg font-black tracking-tighter ${
          isOffline ? 'text-slate-400' : isSyncing ? 'text-amber-500' : 'text-slate-800'
        }`}>
          {value}
        </span>
      </div>
    </div>
  )
}

interface MarketQuadrantProps {
  activeCity: string
  activeRisk: number | null
  activeYield: number | null
}

export const MarketQuadrant = ({ activeCity, activeRisk, activeYield }: MarketQuadrantProps) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const width = 350
    const height = 260
    const margin = { top: 20, right: 20, bottom: 40, left: 40 }

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Scales
    const xScale = d3.scaleLinear().domain([0, 100]).range([margin.left, width - margin.right]) // Risk
    const yScale = d3.scaleLinear().domain([0, 10]).range([height - margin.bottom, margin.top]) // Yield

    // Grid / Boxes
    const midX = xScale(50)
    const midY = yScale(5)

    // Quadrant Labels - Repositioned to outer corners
    const labels = [
      { x: 18, y: 8.5, text: 'Growth', color: '#2fbf71' },
      { x: 82, y: 8.5, text: 'Hot Market', color: '#ffab2e' },
      { x: 18, y: 1.5, text: 'Safe Harbor', color: '#7b61ff' },
      { x: 82, y: 1.5, text: 'Overpriced', color: '#ff5050' }
    ]

    labels.forEach(l => {
      svg.append('text')
        .attr('x', xScale(l.x))
        .attr('y', yScale(l.y))
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '900')
        .attr('fill', l.color)
        .attr('opacity', 0.6)
        .attr('class', 'uppercase tracking-[0.2em]')
        .text(l.text)
    })

    // Axes
    svg.append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', midY)
      .attr('y2', midY)
      .attr('stroke', 'rgba(0,0,0,0.1)')
      .attr('stroke-width', 2)

    svg.append('line')
      .attr('x1', midX)
      .attr('x2', midX)
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'rgba(0,0,0,0.1)')
      .attr('stroke-width', 2)

    // Current City Point
    if (activeRisk !== null && activeYield !== null) {
      const g = svg.append('g')
      
      const px = xScale(activeRisk)
      const py = yScale(activeYield)

      // Outer Pulse
      g.append('circle')
        .attr('cx', px)
        .attr('cy', py)
        .attr('r', 12)
        .attr('fill', '#7b61ff')
        .attr('opacity', 0.15)
        .attr('class', 'animate-pulse')

      // Main Dot
      g.append('circle')
        .attr('cx', px)
        .attr('cy', py)
        .attr('r', 6)
        .attr('fill', '#7b61ff')
        .attr('stroke', 'white')
        .attr('stroke-width', 2.5)
        .attr('class', 'shadow-xl')
    }

    // Axis Labels
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('font-weight', '900')
      .attr('fill', '#94a3b8')
      .attr('class', 'uppercase tracking-[0.2em]')
      .text('Risk Profile →')

    svg.append('text')
      .attr('transform', `rotate(-90)`)
      .attr('x', -height / 2 + 10)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('font-weight', '900')
      .attr('fill', '#94a3b8')
      .attr('class', 'uppercase tracking-[0.2em]')
      .text('Yield Potential ↑')

  }, [activeRisk, activeYield])

  return (
    <div className="relative group/quad w-full h-full flex items-center justify-center">
      <svg ref={svgRef} viewBox="0 0 350 260" className="w-full h-full max-h-[220px] overflow-visible" />
      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover/quad:opacity-100 transition-opacity">
        <span className="text-[7px] font-black text-[#1e1b2e] bg-[#1e1b2e10] px-1.5 py-0.5 rounded-full uppercase">
          {activeCity}
        </span>
      </div>
    </div>
  )
}
