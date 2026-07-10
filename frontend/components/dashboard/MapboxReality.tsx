'use client'

import React, { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useStore } from '@/store/useStore'
import { findZoneByCoordinates } from '@/lib/zoneData'
import { CITIES, CITY_BY_ASSET, priceLakhFor, fmtLakh, fmtInr } from '@/lib/cityData'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

// BKC Mumbai coordinates
const BKC_CENTER: [number, number] = [72.8656, 19.0658]

// ---- Atlas palette ----------------------------------------------------
const PAPER = '#f2ede1'
const WATER = '#a5d8f0'
const PARK = '#c8e6a3'
const LANDUSE = '#e6eecb'

// Candy height ramps: every city stays colorful, but the mid/high stops
// shift hotter as bubble risk rises (the data still drives the picture).
const rampExpr = (mid: string, high: string): any => [
  'interpolate', ['linear'], ['get', 'height'],
  0, '#ffd97a',
  15, '#ffb35c',
  45, mid,
  110, high,
]
const RAMP_SAFE: [string, string] = ['#f2699c', '#8f6bf5'] // pink → violet
const RAMP_WATCH: [string, string] = ['#ff8a5c', '#f2699c'] // coral → pink
const RAMP_HIGH: [string, string] = ['#ff5c5c', '#e6395c'] // coral → red

const riskColor = (risk: number) =>
  risk > 7 ? '#ff5050' : risk > 4 ? '#ffab2e' : '#2fbf71'

const MapboxReality = () => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const { valuationMap, macroSnapshot, mapTarget, activeRegion, bubbleFlags, setSelectedZone, selectedZone } = useStore()

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: BKC_CENTER,
      zoom: 15.5,
      pitch: 60,
      bearing: -17.6,
      antialias: true,
    })

    map.current.on('style.load', () => {
      const m = map.current!

      // ---- Recolor the base style to warm paper + candy accents ----
      // Walk every layer and recolor by type + id pattern; a wrong property
      // name makes GL JS throw, so each set is guarded.
      for (const layer of m.getStyle().layers ?? []) {
        try {
          if (layer.type === 'background') {
            m.setPaintProperty(layer.id, 'background-color', PAPER)
          } else if (layer.type === 'fill') {
            if (/water/.test(layer.id)) {
              m.setPaintProperty(layer.id, 'fill-color', WATER)
            } else if (/park|pitch|golf|grass|cemetery|scrub|wood/.test(layer.id)) {
              m.setPaintProperty(layer.id, 'fill-color', PARK)
            } else if (/landuse|landcover|national-park/.test(layer.id)) {
              m.setPaintProperty(layer.id, 'fill-color', LANDUSE)
            } else if (/^land/.test(layer.id)) {
              m.setPaintProperty(layer.id, 'fill-color', PAPER)
            }
          } else if (layer.type === 'line' && /waterway/.test(layer.id)) {
            m.setPaintProperty(layer.id, 'line-color', WATER)
          }
        } catch {
          // never let one stubborn layer break the rest of the setup
        }
      }

      // Soft paper horizon so the 3D city floats in a dreamy haze
      m.setFog({
        range: [0.8, 8],
        color: '#f5f1e8',
        'high-color': '#cfe8fa',
        'horizon-blend': 0.08,
        'space-color': '#eaf6ff',
        'star-intensity': 0,
      } as any)

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
            'fill-extrusion-color': rampExpr(...RAMP_SAFE),
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.95,
            'fill-extrusion-vertical-gradient': true,
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

      // ---- Zone highlight ----
      m.addSource('selected-zone', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      m.addLayer({
        id: 'zone-highlight-fill',
        type: 'fill',
        source: 'selected-zone',
        paint: {
          'fill-color': '#7b61ff',
          'fill-opacity': 0.14,
        },
      })

      m.addLayer({
        id: 'zone-highlight-outline',
        type: 'line',
        source: 'selected-zone',
        paint: {
          'line-color': '#7b61ff',
          'line-width': 3,
          'line-dasharray': [2, 1],
        },
      })

      // Handle map clicks for zone selection
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

      setMapLoaded(true)
    })

    // Navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'top-right'
    )

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Persistent marker refs — update text/colors in-place instead of destroy/recreate
  const markerElemsRef = useRef<Record<string, { dot: HTMLSpanElement; price: HTMLSpanElement }>>({})

  // Levels-style price pills for all tracked cities
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

      // If marker already exists, just refresh its dot + price
      const existing = markerElemsRef.current[id]
      if (existing) {
        existing.dot.style.background = color
        existing.price.textContent = priceText
        return
      }

      // First time: create the pill
      const el = document.createElement('div')
      el.className = 'atlas-marker'

      const dot = document.createElement('span')
      dot.className = 'atlas-marker-dot'
      dot.style.background = color

      const name = document.createElement('span')
      name.textContent = city.label

      const price = document.createElement('span')
      price.className = 'atlas-marker-price'
      price.textContent = priceText

      el.append(dot, name, price)
      markerElemsRef.current[id] = { dot, price }

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

  // ---- Data-driven building colors (candy ramps, hotter with risk) ----
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const flag = bubbleFlags?.find(f => f.region.toLowerCase() === activeRegion?.toLowerCase())
    const score = flag ? flag.overall_score : 50

    const piRatio = flag?.price_income_ratio || 10
    const capSpread = flag?.cap_rate_spread || 2.5
    const affordability = flag?.affordability_pct || 40

    // Residential buildings react to P/I ratio & affordability,
    // commercial ones to cap-rate spread, the rest to the macro score.
    const resRamp = piRatio > 13 || affordability < 30 ? RAMP_HIGH : piRatio > 10 ? RAMP_WATCH : RAMP_SAFE
    const commRamp = capSpread < 1.5 ? RAMP_HIGH : capSpread < 2.5 ? RAMP_WATCH : RAMP_SAFE
    const defaultRamp = score > 65 ? RAMP_HIGH : score > 35 ? RAMP_WATCH : RAMP_SAFE

    if (map.current.getLayer('3d-buildings')) {
      map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
        'case',
        ['any', ['==', ['get', 'type'], 'residential'], ['==', ['get', 'type'], 'apartments']],
        rampExpr(...resRamp),

        ['any', ['==', ['get', 'type'], 'commercial'], ['==', ['get', 'type'], 'office'], ['==', ['get', 'type'], 'retail']],
        rampExpr(...commRamp),

        rampExpr(...defaultRamp),
      ])
    }
  }, [activeRegion, bubbleFlags, mapLoaded])

  // Update Zone Highlight data when selectedZone changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const source = map.current.getSource('selected-zone') as mapboxgl.GeoJSONSource
    if (source) {
      if (selectedZone?.boundary) {
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: selectedZone.boundary,
            properties: {},
          }],
        })
      } else {
        source.setData({ type: 'FeatureCollection', features: [] })
      }
    }
  }, [selectedZone, mapLoaded])

  // ---- Fly to target location when mapTarget changes ----
  useEffect(() => {
    if (!map.current || !mapTarget) return

    map.current.flyTo({
      center: [mapTarget.lng, mapTarget.lat],
      zoom: mapTarget.zoom ?? 15.5,
      pitch: 60,
      bearing: -17.6,
      duration: 3000,
      essential: true,
    })
  }, [mapTarget])

  return (
    <div className="fixed inset-0 z-0">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  )
}

export default MapboxReality
