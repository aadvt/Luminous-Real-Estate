'use client'

import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { motion } from 'framer-motion'

interface RiskRadarProps {
  data: {
    piRatio: number | null
    prRatio: number | null
    affordability: number | null
    capSpread: number | null
  }
  score: number | null
}

const RiskRadar = ({ data, score }: RiskRadarProps) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const width = 400
    const height = 320
    const margin = 60
    const radius = Math.min(width, height) / 2 - 40
    const centerX = width / 2
    const centerY = height / 2

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Configuration
    const axes = [
      { name: 'P/I Ratio', key: 'piRatio', min: 10, max: 35, invert: false },
      { name: 'P/R Ratio', key: 'prRatio', min: 15, max: 50, invert: false },
      { name: 'Affordability', key: 'affordability', min: 0.2, max: 1.5, invert: true },
      { name: 'Cap Spread', key: 'capSpread', min: 1, max: 8, invert: true }
    ]

    const angleStep = (Math.PI * 2) / axes.length

    // Scales
    const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius])

    // Normalize data (0 = safe/center, 1 = risky/outer)
    const normalizedData = axes.map((axis, i) => {
      const val = (data as any)[axis.key] || 0
      let normalized = (val - axis.min) / (axis.max - axis.min)
      if (axis.invert) normalized = 1 - normalized
      normalized = Math.max(0, Math.min(1, normalized))
      
      const angle = i * angleStep - Math.PI / 2
      return {
        x: centerX + rScale(normalized) * Math.cos(angle),
        y: centerY + rScale(normalized) * Math.sin(angle),
        label: axis.name,
        value: val,
        normalized
      }
    })

    // Draw Background Circles (Concentric Rings)
    const levels = 3
    const container = svg.append('g')

    for (let j = 0; j < levels; j++) {
      const r = (radius / levels) * (j + 1)
      container.append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(0,0,0,0.04)')
        .attr('stroke-dasharray', '3,3')
    }

    // Draw Axis Lines
    axes.forEach((axis, i) => {
      const angle = i * angleStep - Math.PI / 2
      container.append('line')
        .attr('x1', centerX)
        .attr('y1', centerY)
        .attr('x2', centerX + radius * Math.cos(angle))
        .attr('y2', centerY + radius * Math.sin(angle))
        .attr('stroke', 'rgba(0,0,0,0.08)')
        .attr('stroke-width', 1.5)

      // Axis Labels
      container.append('text')
        .attr('x', centerX + (radius + 32) * Math.cos(angle))
        .attr('y', centerY + (radius + 32) * Math.sin(angle))
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '900')
        .attr('fill', '#5b5772')
        .attr('class', 'uppercase tracking-[0.2em]')
        .text(axis.name)
    })

    // Polygon Color based on score
    const getColor = () => {
      if (score === null) return '#2fbf71'
      if (score < 30) return '#2fbf71' // Mint
      if (score < 60) return '#ffab2e' // Amber
      return '#ff5050' // Coral
    }

    const mainColor = getColor()

    // Draw Radar Area
    const lineGenerator = d3.lineRadial<any>()
      .radius(d => rScale(d.normalized))
      .angle((d, i) => i * angleStep)
      .curve(d3.curveLinearClosed)

    const areaPath = container.append('path')
      .datum(normalizedData)
      .attr('d', d => {
        // Transform Cartesian back to Radial for generator (relative to center)
        const radialData = normalizedData.map(p => ({ normalized: p.normalized }))
        return lineGenerator(radialData)
      })
      .attr('transform', `translate(${centerX}, ${centerY})`)
      .attr('fill', `${mainColor}25`)
      .attr('stroke', mainColor)
      .attr('stroke-width', 2.5)
      .attr('class', 'transition-all duration-700 ease-in-out')
      .style('filter', `drop-shadow(0 0 12px ${mainColor}40)`)

    // Draw Points
    normalizedData.forEach((point) => {
      container.append('circle')
        .attr('cx', point.x)
        .attr('cy', point.y)
        .attr('r', 4)
        .attr('fill', 'white')
        .attr('stroke', mainColor)
        .attr('stroke-width', 2)
        .attr('class', 'shadow-sm')
      
      // Outer glow for points
      container.append('circle')
        .attr('cx', point.x)
        .attr('cy', point.y)
        .attr('r', 8)
        .attr('fill', mainColor)
        .attr('opacity', 0.15)
        .attr('class', 'animate-pulse')
    })

  }, [data, score])

  return (
    <div className="relative w-full h-full flex items-center justify-center group/radar">
      <svg 
        ref={svgRef} 
        viewBox="0 0 400 320"
        className="w-full h-full max-h-[300px] overflow-visible"
      />
    </div>
  )
}

export default RiskRadar
