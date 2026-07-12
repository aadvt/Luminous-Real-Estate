'use client'

import React, { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useStore } from '@/store/useStore'
import { findZoneByCoordinates, DEMO_ZONES } from '@/lib/zoneData'
import { CITIES, CITY_BY_ASSET, priceLakhFor, fmtLakh, fmtInr } from '@/lib/cityData'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

// BKC Mumbai coordinates
const BKC_CENTER: [number, number] = [72.8656, 19.0658]
// Where the cinematic intro starts (all of India in frame)
const INDIA_CENTER: [number, number] = [79.8, 22.2]

// ---- Atlas palette ----------------------------------------------------
const GROUND = {
  day: { paper: '#f2ede1', water: '#a5d8f0', park: '#c8e6a3', landuse: '#e6eecb' },
  // Golden-hour twilight: warm sand ground, deep water, muted greens
  dusk: { paper: '#d8b48c', water: '#5f87b0', park: '#95ab72', landuse: '#c9a97e' },
}

// Road hierarchy: asphalt tones with warm casings, darker at dusk
const ROADS = {
  day: { casing: '#f8f2e4', motorway: '#6f6a7b', major: '#8d8798', street: '#b3adbb', path: '#d6cebc' },
  dusk: { casing: '#ecd3ab', motorway: '#4e4a60', major: '#6b6579', street: '#8f8798', path: '#b5a488' },
}

// Candy height ramps: every city stays colorful, but the mid/high stops
// shift hotter as bubble risk rises (the data still drives the picture).
const rampExpr = (mid: string, high: string): any => [
  'interpolate', ['linear'], ['get', 'height'],
  0, '#ffd97a',
  15, '#ffb35c',
  45, mid,
  110, high,
]
// [mid, high] hex WITHOUT '#' so the names double as facade image keys
const RAMP_SAFE: [string, string] = ['f2699c', '8f6bf5'] // pink → violet
const RAMP_WATCH: [string, string] = ['ff8a5c', 'f2699c'] // coral → pink
const RAMP_HIGH: [string, string] = ['ff5c5c', 'e6395c'] // coral → red

// Every distinct facade tint used by the ramps (low/mid stops + all ramp stops)
const FACADE_COLORS = ['ffd97a', 'ffb35c', 'f2699c', '8f6bf5', 'ff8a5c', 'ff5c5c', 'e6395c']

// Solid risk colors for the x-ray mode
const XRAY = { safe: '#2fbf71', watch: '#ffab2e', high: '#ff5050', other: '#ddd7e4' }

const riskColor = (risk: number) =>
  risk > 7 ? '#ff5050' : risk > 4 ? '#ffab2e' : '#2fbf71'

// ---- Texture generation (canvas → map images) ---------------------------

/** Tiny deterministic PRNG so facade windows are stable across rebuilds. */
const seededRand = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

/**
 * Window-facade texture tiled across extrusion walls.
 * `lit` variant scatters warm glowing windows for dusk.
 */
const makeFacadeImage = (hex: string, lit: boolean): ImageData | null => {
  const S = 128
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const ctx = cv.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = `#${hex}`
  ctx.fillRect(0, 0, S, S)

  const rand = seededRand(parseInt(hex.slice(0, 6), 16) + (lit ? 7 : 0))
  const cols = 6
  const rows = 8
  const cw = S / cols
  const rh = S / rows

  for (let r = 0; r < rows; r++) {
    // floor separation line
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    ctx.fillRect(0, r * rh, S, 2)
    for (let c = 0; c < cols; c++) {
      const x = c * cw + 4
      const y = r * rh + 5
      const w = cw - 8
      const h = rh - 9
      const roll = rand()
      if (lit && roll < 0.42) {
        // warm lit window with a soft halo
        ctx.fillStyle = 'rgba(255,206,120,0.95)'
        ctx.fillRect(x, y, w, h)
        ctx.fillStyle = 'rgba(255,230,170,0.35)'
        ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3)
        ctx.fillStyle = 'rgba(255,206,120,0.95)'
        ctx.fillRect(x, y, w, h)
      } else {
        ctx.fillStyle = `rgba(30,27,46,${0.16 + roll * 0.14})`
        ctx.fillRect(x, y, w, h)
      }
    }
  }
  return ctx.getImageData(0, 0, S, S)
}

/** Facade pattern expression: pick the window texture by height bucket. */
const facadeStep = (mid: string, high: string, sfx: string): any => [
  'step', ['get', 'height'],
  `fac-ffd97a-${sfx}`,
  15, `fac-ffb35c-${sfx}`,
  45, `fac-${mid}-${sfx}`,
  110, `fac-${high}-${sfx}`,
]

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const NO_BUILDING_FILTER: any = ['all', ['==', ['get', 'extrude'], 'true'], ['==', ['id'], -1]]

const MapboxReality = () => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const {
    valuationMap, macroSnapshot, mapTarget, activeRegion, bubbleFlags,
    setSelectedZone, selectedZone, mapMode, lighting,
  } = useStore()

  // Animation bookkeeping shared by the master rAF loop
  const anim = useRef({
    raf: 0,
    lastT: 0,
    startT: 0,
    fpsEma: 60,
    degraded: false,
    reduceMotion: false,
    introDone: false,
    lastInteraction: Date.now(),
  })
  const hoverBldg = useRef<string | number | null>(null)
  const hoverZone = useRef<string | number | null>(null)
  const markerElemsRef = useRef<Record<string, { el: HTMLDivElement; dot: HTMLSpanElement; price: HTMLSpanElement }>>({})

  // ---- Ground + road recolor (both lighting themes) ----------------------
  const applyGround = (m: mapboxgl.Map, mode: 'day' | 'dusk') => {
    const g = GROUND[mode]
    const r = ROADS[mode]
    for (const layer of m.getStyle().layers ?? []) {
      try {
        if (layer.type === 'background') {
          m.setPaintProperty(layer.id, 'background-color', g.paper)
        } else if (layer.type === 'fill') {
          if (/water/.test(layer.id)) {
            m.setPaintProperty(layer.id, 'fill-color', g.water)
          } else if (/park|pitch|golf|grass|cemetery|scrub|wood/.test(layer.id)) {
            m.setPaintProperty(layer.id, 'fill-color', g.park)
          } else if (/landuse|landcover|national-park/.test(layer.id)) {
            m.setPaintProperty(layer.id, 'fill-color', g.landuse)
          } else if (/^land/.test(layer.id)) {
            m.setPaintProperty(layer.id, 'fill-color', g.paper)
          }
        } else if (layer.type === 'line') {
          if (/waterway/.test(layer.id)) {
            m.setPaintProperty(layer.id, 'line-color', g.water)
          } else if (/road|bridge|tunnel/.test(layer.id) && !/label|shield|oneway/.test(layer.id)) {
            // Asphalt road hierarchy — this is what makes streets readable
            if (/case|casing/.test(layer.id)) {
              m.setPaintProperty(layer.id, 'line-color', r.casing)
            } else if (/motorway|trunk/.test(layer.id)) {
              m.setPaintProperty(layer.id, 'line-color', r.motorway)
            } else if (/primary|secondary|tertiary|major/.test(layer.id)) {
              m.setPaintProperty(layer.id, 'line-color', r.major)
            } else if (/pedestrian|path|steps|sidewalk|crossing/.test(layer.id)) {
              m.setPaintProperty(layer.id, 'line-color', r.path)
            } else {
              m.setPaintProperty(layer.id, 'line-color', r.street)
            }
          }
        }
      } catch {
        // never let one stubborn layer break the rest of the setup
      }
    }
  }

  // ---- Atmosphere: fog, sky, sun, building emissive ----------------------
  const applyLighting = (m: mapboxgl.Map, mode: 'day' | 'dusk') => {
    try {
      if (mode === 'day') {
        m.setFog({
          range: [0.8, 8],
          color: '#f5f1e8',
          'high-color': '#cfe8fa',
          'horizon-blend': 0.08,
          'space-color': '#eaf6ff',
          'star-intensity': 0,
        } as any)
        if (m.getLayer('sky')) {
          m.setPaintProperty('sky', 'sky-atmosphere-sun', [0.0, 15.0])
          m.setPaintProperty('sky', 'sky-atmosphere-sun-intensity', 8)
          m.setPaintProperty('sky', 'sky-atmosphere-color', '#8ecdf5')
          m.setPaintProperty('sky', 'sky-atmosphere-halo-color', '#ffffff')
        }
        m.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.32, position: [1.15, 210, 30] })
        if (m.getLayer('3d-buildings')) {
          m.setPaintProperty('3d-buildings', 'fill-extrusion-emissive-strength', 0)
        }
      } else {
        // Golden hour: burning horizon, violet night above, stars out
        m.setFog({
          range: [0.4, 6],
          color: '#f2a468',
          'high-color': '#c2586f',
          'horizon-blend': 0.18,
          'space-color': '#241c3f',
          'star-intensity': 0.6,
        } as any)
        if (m.getLayer('sky')) {
          m.setPaintProperty('sky', 'sky-atmosphere-sun', [0.0, 1.5])
          m.setPaintProperty('sky', 'sky-atmosphere-sun-intensity', 25)
          m.setPaintProperty('sky', 'sky-atmosphere-color', '#a75a80')
          m.setPaintProperty('sky', 'sky-atmosphere-halo-color', '#ffbd7d')
        }
        m.setLight({ anchor: 'map', color: '#ff9a58', intensity: 0.75, position: [1.15, 95, 10] })
        if (m.getLayer('3d-buildings')) {
          // Facade windows carry the glow; a soft emissive keeps candy hues alive
          m.setPaintProperty('3d-buildings', 'fill-extrusion-emissive-strength', 0.35)
        }
      }
      applyGround(m, mode)
    } catch {
      // atmosphere is decoration — never fatal
    }
  }

  // ==========================================================================
  // Map init
  // ==========================================================================
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    anim.current.reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      // Cinematic intro: open on all of India, then dive into Mumbai
      center: INDIA_CENTER,
      zoom: 3.7,
      pitch: 0,
      bearing: 0,
      antialias: true,
    })

    const container = mapContainer.current
    const markInteraction = () => {
      anim.current.lastInteraction = Date.now()
      anim.current.introDone = true
    }
    container.addEventListener('pointerdown', markInteraction)
    container.addEventListener('wheel', markInteraction, { passive: true })
    container.addEventListener('touchstart', markInteraction, { passive: true })

    map.current.on('style.load', () => {
      const m = map.current!

      // ---- Generate car sprites + window-facade textures ----
      const safeAddImage = (name: string, make: () => ImageData | null) => {
        try {
          if (m.hasImage(name)) return
          const img = make()
          if (img) m.addImage(name, img, { pixelRatio: 2 })
        } catch {
          // a failed sprite falls back to flat colors — never fatal
        }
      }
      for (const hex of FACADE_COLORS) {
        safeAddImage(`fac-${hex}-day`, () => makeFacadeImage(hex, false))
        safeAddImage(`fac-${hex}-lit`, () => makeFacadeImage(hex, true))
      }

      applyGround(m, useStore.getState().lighting)

      // ---- Candy 3D buildings ----
      const layers = m.getStyle().layers
      const labelLayerId = layers?.find(
        (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
      )?.id

      m.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 12,
          paint: {
            'fill-extrusion-color': rampExpr(`#${RAMP_SAFE[0]}`, `#${RAMP_SAFE[1]}`),
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.95,
            'fill-extrusion-vertical-gradient': true,
            // Soft contact shadows where buildings meet the ground (GL JS v3)
            'fill-extrusion-ambient-occlusion-intensity': 0.32,
            'fill-extrusion-ambient-occlusion-radius': 3,
          },
        },
        labelLayerId
      )

      // Gold hover shell — filtered to the hovered building id only
      m.addLayer(
        {
          id: 'bldg-hover',
          source: 'composite',
          'source-layer': 'building',
          filter: NO_BUILDING_FILTER,
          type: 'fill-extrusion',
          minzoom: 12,
          paint: {
            'fill-extrusion-color': '#ffc845',
            'fill-extrusion-height': ['+', ['get', 'height'], 1.5],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 1,
            'fill-extrusion-emissive-strength': 0.5,
          },
        },
        labelLayerId
      )

      // Bright blue-sky atmosphere
      m.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 15.0],
          'sky-atmosphere-sun-intensity': 8,
          'sky-atmosphere-color': '#8ecdf5',
        },
      })

      applyLighting(m, useStore.getState().lighting)

      // ---- Investment zones: always visible, glow on hover ----
      const zoneFeatures = DEMO_ZONES
        .filter((z) => z.boundary)
        .map((z) => ({
          type: 'Feature' as const,
          geometry: z.boundary,
          properties: {
            id: z.id,
            color:
              z.risk_score >= 65 ? '#ff5050'
              : z.risk_score >= 35 ? '#ffab2e'
              : '#2fbf71',
          },
        }))

      m.addSource('zones-all', {
        type: 'geojson',
        promoteId: 'id',
        data: { type: 'FeatureCollection', features: zoneFeatures },
      })
      m.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: 'zones-all',
        minzoom: 11.5,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.18,
            0.05,
          ],
        },
      })
      m.addLayer({
        id: 'zones-outline',
        type: 'line',
        source: 'zones-all',
        minzoom: 11.5,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.6,
          'line-dasharray': [2.2, 1.6],
          'line-opacity': 0.55,
        },
      })

      // ---- Selected zone highlight ----
      m.addSource('selected-zone', { type: 'geojson', data: EMPTY_FC })
      m.addLayer({
        id: 'zone-highlight-fill',
        type: 'fill',
        source: 'selected-zone',
        paint: { 'fill-color': '#7b61ff', 'fill-opacity': 0.14 },
      })
      m.addLayer({
        id: 'zone-highlight-outline',
        type: 'line',
        source: 'selected-zone',
        paint: { 'line-color': '#7b61ff', 'line-width': 3, 'line-dasharray': [2, 1] },
      })

      // ---- Zone hover glow ----
      m.on('mousemove', 'zones-fill', (e) => {
        m.getCanvas().style.cursor = 'pointer'
        const id = e.features?.[0]?.id
        if (id == null || id === hoverZone.current) return
        if (hoverZone.current != null) {
          m.setFeatureState({ source: 'zones-all', id: hoverZone.current }, { hover: false })
        }
        hoverZone.current = id
        m.setFeatureState({ source: 'zones-all', id }, { hover: true })
      })
      m.on('mouseleave', 'zones-fill', () => {
        m.getCanvas().style.cursor = ''
        if (hoverZone.current != null) {
          m.setFeatureState({ source: 'zones-all', id: hoverZone.current }, { hover: false })
          hoverZone.current = null
        }
      })

      // ---- Building hover: gold shell + floating chip (mouse only) ----
      if (window.matchMedia('(pointer: fine)').matches) {
        let lastQuery = 0
        const clearBldgHover = () => {
          if (hoverBldg.current != null) {
            try { m.setFilter('bldg-hover', NO_BUILDING_FILTER) } catch { /* ignore */ }
            hoverBldg.current = null
          }
          tipRef.current?.classList.remove('visible')
        }

        m.on('mousemove', (e) => {
          const now = performance.now()
          if (now - lastQuery < 40) return
          lastQuery = now
          if (!m.getLayer('3d-buildings') || m.getZoom() < 13) { clearBldgHover(); return }
          const f = m.queryRenderedFeatures(e.point, { layers: ['3d-buildings'] })[0]
          const tip = tipRef.current
          if (f && f.id != null) {
            if (hoverBldg.current !== f.id) {
              hoverBldg.current = f.id
              try {
                m.setFilter('bldg-hover', [
                  'all',
                  ['==', ['get', 'extrude'], 'true'],
                  ['==', ['id'], f.id],
                ])
              } catch { /* ignore */ }
            }
            if (tip) {
              const h = Number(f.properties?.height ?? 0)
              tip.textContent = `${Math.round(h)} m · ~${Math.max(1, Math.round(h / 3.2))} floors`
              tip.style.transform = `translate(${e.point.x + 14}px, ${e.point.y + 14}px)`
              tip.classList.add('visible')
            }
          } else {
            clearBldgHover()
          }
        })
        m.getCanvas().addEventListener('mouseleave', clearBldgHover)
      }

      // ---- Zone selection on click ----
      m.on('click', (e) => {
        const region = useStore.getState().activeRegion
        const zone = findZoneByCoordinates(e.lngLat.lng, e.lngLat.lat, region)
        setSelectedZone(zone)
        if (zone) {
          m.flyTo({
            center: e.lngLat,
            zoom: Math.max(m.getZoom(), 16),
            duration: 1500,
            essential: true,
          })
        }
      })

      // ---- Markers simplify at country zoom ----
      m.on('zoom', () => {
        const compact = m.getZoom() < 11
        for (const { el } of Object.values(markerElemsRef.current)) {
          el.classList.toggle('atlas-marker--compact', compact)
        }
      })

      setMapLoaded(true)
    })

    // Cinematic intro flight, once tiles are up
    map.current.on('load', () => {
      const m = map.current!
      window.setTimeout(() => {
        if (anim.current.introDone) return // user already grabbed the map
        m.flyTo({
          center: BKC_CENTER,
          zoom: 15.5,
          pitch: 60,
          bearing: -17.6,
          duration: 6500,
          curve: 1.42,
          essential: true,
        })
        m.once('moveend', () => {
          anim.current.introDone = true
          anim.current.lastInteraction = Date.now()
        })
      }, 900)
    })

    // Navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'top-right'
    )

    return () => {
      container.removeEventListener('pointerdown', markInteraction)
      container.removeEventListener('wheel', markInteraction)
      container.removeEventListener('touchstart', markInteraction)
      map.current?.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ==========================================================================
  // Master animation loop: idle orbit + FPS guard
  // ==========================================================================
  useEffect(() => {
    if (!mapLoaded) return
    const a = anim.current
    a.startT = performance.now()
    a.lastT = a.startT

    const frame = (t: number) => {
      a.raf = requestAnimationFrame(frame)
      const dt = Math.min(t - a.lastT, 100)
      a.lastT = t
      if (dt <= 0) return

      // FPS guard: latch into degraded mode on sustained low frame rate
      const fps = 1000 / dt
      a.fpsEma = a.fpsEma * 0.95 + fps * 0.05
      const m = map.current
      if (!m) return
      if (!a.degraded && t - a.startT > 8000 && a.fpsEma < 22) {
        a.degraded = true
        console.info('[map] low FPS — idle orbit disabled')
      }

      if (document.hidden || a.degraded || a.reduceMotion) return

      // Idle cinematic orbit
      const st = useStore.getState()
      if (
        st.orbitEnabled &&
        a.introDone &&
        Date.now() - a.lastInteraction > 20000 &&
        m.getZoom() >= 12.5 &&
        !m.isMoving()
      ) {
        m.setBearing(m.getBearing() + 0.0011 * dt) // ≈ 1 rotation / 5.5 min
      }
    }

    a.raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(a.raf)
  }, [mapLoaded])

  // ==========================================================================
  // Markers — persistent price pills, updated in place
  // ==========================================================================
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    CITIES.forEach((city) => {
      const id = city.assetId
      const data = valuationMap[id]

      // risk_score is stored 0-10. >7 = red, >4 = amber, <=4 = mint
      const risk = data?.risk_score ?? 5
      const color = riskColor(risk)
      const priceText = data?.price_index
        ? fmtInr(data.price_index)
        : fmtLakh(priceLakhFor(macroSnapshot, city))

      // If marker already exists, just refresh its dot + price + beacon
      const existing = markerElemsRef.current[id]
      if (existing) {
        existing.dot.style.background = color
        existing.price.textContent = priceText
        existing.el.classList.toggle('atlas-marker--alert', risk > 7)
        return
      }

      // First time: create the pill
      const el = document.createElement('div')
      el.className = 'atlas-marker'
      if (risk > 7) el.classList.add('atlas-marker--alert')

      const dot = document.createElement('span')
      dot.className = 'atlas-marker-dot'
      dot.style.background = color

      const name = document.createElement('span')
      name.textContent = city.label

      const price = document.createElement('span')
      price.className = 'atlas-marker-price'
      price.textContent = priceText

      el.append(dot, name, price)
      markerElemsRef.current[id] = { el, dot, price }

      // Popup reads LIVE data from the store at open time
      const popup = new mapboxgl.Popup({ offset: 18, className: 'atlas-popup', closeButton: false })
      popup.on('open', () => {
        const live = useStore.getState().valuationMap[id]
        const macro = useStore.getState().macroSnapshot
        const liveRisk = live?.risk_score ?? 5
        const liveColor = riskColor(liveRisk)
        const liveScore = (liveRisk * 10).toFixed(0)
        const livePir = live?.pi_ratio && live.pi_ratio > 0 ? `${live.pi_ratio.toFixed(1)}x` : 'N/A'
        const livePrice = live?.price_index
          ? fmtInr(live.price_index)
          : fmtLakh(priceLakhFor(macro, city))
        const cityLabel = CITY_BY_ASSET[id]?.label ?? id
        popup.setHTML(`
          <div style="background: #ffffff; color: #1e1b2e; padding: 14px 16px; border-radius: 18px; border: 2px solid #1e1b2e; font-family: 'Space Grotesk', sans-serif; min-width: 200px; box-shadow: 0 4px 0 rgba(30,27,46,0.25);">
            <div style="font-size: 15px; font-weight: 700; margin-bottom: 2px;">${cityLabel}</div>
            <div style="display:inline-flex; align-items:center; gap:6px; font-size: 9px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 10px; background:${liveColor}1f; color:${liveColor}; padding: 3px 8px; border-radius: 999px;">
              <span style="width:7px;height:7px;border-radius:50%;background:${liveColor};"></span>
              Bubble score ${liveScore}/100
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 2px solid rgba(30,27,46,0.08); padding-top: 8px;">
              <div><div style="font-size: 8px; color: #8a86a0; text-transform: uppercase; font-weight: 700; letter-spacing: 0.08em;">Risk</div><div style="font-size: 13px; color: ${liveColor}; font-weight: 700;">${liveScore}/100</div></div>
              <div><div style="font-size: 8px; color: #8a86a0; text-transform: uppercase; font-weight: 700; letter-spacing: 0.08em;">P/I Ratio</div><div style="font-size: 13px; font-weight: 700;">${livePir}</div></div>
              <div style="grid-column: 1/-1;"><div style="font-size: 8px; color: #8a86a0; text-transform: uppercase; font-weight: 700; letter-spacing: 0.08em;">Est. Median Price</div><div style="font-size: 15px; font-weight: 700;">${livePrice}</div></div>
            </div>
          </div>
        `)
      })

      el.addEventListener('click', () => {
        useStore.getState().setSelectedAssetId(id)
      })

      new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, -6] })
        .setLngLat([city.lng, city.lat])
        .setPopup(popup)
        .addTo(map.current!)
    })
  }, [valuationMap, macroSnapshot, mapLoaded])

  // ==========================================================================
  // Building look: textured candy facades or the flat risk x-ray
  // ==========================================================================
  useEffect(() => {
    if (!map.current || !mapLoaded || !map.current.getLayer('3d-buildings')) return
    const m = map.current

    const flag = bubbleFlags?.find(f => f.region.toLowerCase() === activeRegion?.toLowerCase())
    const score = flag ? flag.overall_score : 50

    const piRatio = flag?.price_income_ratio || 10
    const capSpread = flag?.cap_rate_spread || 2.5
    const affordability = flag?.affordability_pct || 40

    const resLevel = piRatio > 13 || affordability < 30 ? 'high' : piRatio > 10 ? 'watch' : 'safe'
    const commLevel = capSpread < 1.5 ? 'high' : capSpread < 2.5 ? 'watch' : 'safe'
    const defLevel = score > 65 ? 'high' : score > 35 ? 'watch' : 'safe'

    const RAMPS = { safe: RAMP_SAFE, watch: RAMP_WATCH, high: RAMP_HIGH } as const

    const isRes: any = ['any', ['==', ['get', 'type'], 'residential'], ['==', ['get', 'type'], 'apartments']]
    const isComm: any = ['any', ['==', ['get', 'type'], 'commercial'], ['==', ['get', 'type'], 'office'], ['==', ['get', 'type'], 'retail']]

    try {
      if (mapMode === 'xray') {
        // Flat risk colors read clearest — drop the window textures here
        m.setPaintProperty('3d-buildings', 'fill-extrusion-pattern', undefined as any)
        m.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
          'case',
          isRes, XRAY[resLevel],
          isComm, XRAY[commLevel],
          ['>', ['get', 'height'], 60], XRAY[defLevel],
          XRAY.other,
        ])
      } else {
        // Candy mode: window-facade textures, lit variants after dark
        const sfx = lighting === 'dusk' ? 'lit' : 'day'
        m.setPaintProperty('3d-buildings', 'fill-extrusion-pattern', [
          'case',
          isRes, facadeStep(RAMPS[resLevel][0], RAMPS[resLevel][1], sfx),
          isComm, facadeStep(RAMPS[commLevel][0], RAMPS[commLevel][1], sfx),
          facadeStep(RAMPS[defLevel][0], RAMPS[defLevel][1], sfx),
        ])
        // Fallback color if a pattern image is ever missing
        m.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
          'case',
          isRes, rampExpr(`#${RAMPS[resLevel][0]}`, `#${RAMPS[resLevel][1]}`),
          isComm, rampExpr(`#${RAMPS[commLevel][0]}`, `#${RAMPS[commLevel][1]}`),
          rampExpr(`#${RAMPS[defLevel][0]}`, `#${RAMPS[defLevel][1]}`),
        ])
      }
    } catch {
      // pattern support is progressive enhancement
    }
  }, [activeRegion, bubbleFlags, mapLoaded, mapMode, lighting])

  // ---- Lighting theme ----
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    applyLighting(map.current, lighting)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lighting, mapLoaded])

  // ---- Selected-zone highlight data ----
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const source = map.current.getSource('selected-zone') as mapboxgl.GeoJSONSource
    if (source) {
      if (selectedZone?.boundary) {
        source.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: selectedZone.boundary, properties: {} }],
        })
      } else {
        source.setData(EMPTY_FC)
      }
    }
  }, [selectedZone, mapLoaded])

  // ---- Fly to target location (city dive or country overview) ----
  useEffect(() => {
    if (!map.current || !mapTarget) return
    const overview = (mapTarget.zoom ?? 15.5) <= 6
    anim.current.introDone = true
    anim.current.lastInteraction = Date.now()
    map.current.flyTo({
      center: [mapTarget.lng, mapTarget.lat],
      zoom: mapTarget.zoom ?? 15.5,
      pitch: overview ? 30 : 60,
      bearing: overview ? 0 : -17.6,
      duration: overview ? 3200 : 3000,
      essential: true,
    })
  }, [mapTarget])

  return (
    <div className="fixed inset-0 z-0">
      <div ref={mapContainer} className="w-full h-full" />
      {/* Cursor-following chip for building hover */}
      <div ref={tipRef} className="bldg-tip" />
    </div>
  )
}

export default MapboxReality
