'use client'

import React, { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import * as THREE from 'three'
import { useStore, ZoneData } from '@/store/useStore'
import { findZoneByCoordinates } from '@/lib/zoneData'
import { ASSET_COORDS } from '@/components/LiveDataLoop'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

// BKC Mumbai coordinates
const BKC_CENTER: [number, number] = [72.8656, 19.0658]

const NATIONAL_CITIES = [
  { id: 'Mumbai', lng: 72.8656, lat: 19.0658 },
  { id: 'Delhi', lng: 77.2090, lat: 28.6139 },
  { id: 'Bangalore', lng: 77.5946, lat: 12.9716 },
  { id: 'Chennai', lng: 80.2707, lat: 13.0827 },
  { id: 'Hyderabad', lng: 78.3725, lat: 17.4478 },
  { id: 'Kolkata', lng: 88.4651, lat: 22.5892 },
  { id: 'Pune', lng: 73.7334, lat: 18.5913 },
  { id: 'Ahmedabad', lng: 72.6841, lat: 23.1610 },
]

const MapboxReality = () => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const { valuationMap, mapTarget, activeRegion, bubbleFlags, setSelectedZone, selectedZone } = useStore()

  const sceneStateRef = useRef({
    lngLat: BKC_CENTER as [number, number],
    score: 50,
    needsUpdate: true
  })

  useEffect(() => {
    const CITIES: Record<string, [number, number]> = {
      'Mumbai': [72.8656, 19.0658],
      'Delhi': [77.2090, 28.6139],
      'Bangalore': [77.5946, 12.9716],
      'Chennai': [80.2707, 13.0827],
      'Hyderabad': [78.3725, 17.4478],
      'Kolkata': [88.4651, 22.5892],
      'Pune': [73.7334, 18.5913],
      'Ahmedabad': [72.6841, 23.1610],
    }
    
    let targetLngLat = BKC_CENTER;
    if (mapTarget) {
      targetLngLat = [mapTarget.lng, mapTarget.lat]
    } else if (activeRegion && CITIES[activeRegion]) {
      targetLngLat = CITIES[activeRegion]
    }

    const flag = bubbleFlags?.find(f => f.region.toLowerCase() === activeRegion?.toLowerCase())
    const score = flag ? flag.overall_score : 50

    if (sceneStateRef.current) {
      sceneStateRef.current.lngLat = targetLngLat
      sceneStateRef.current.score = score
      sceneStateRef.current.needsUpdate = true
    }
  }, [mapTarget, activeRegion, bubbleFlags])

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: BKC_CENTER,
      zoom: 15.5,
      pitch: 60,
      bearing: -17.6,
      antialias: true,
    })

    map.current.on('style.load', () => {
      const m = map.current!

      // Tint the map terrain/land to dark matcha (#10381a)
      if (m.getLayer('background')) {
        m.setPaintProperty('background', 'background-color', '#10381a')
      }
      if (m.getLayer('water')) {
        m.setPaintProperty('water', 'fill-color', '#07180b')
      }

      // 3D Terrain
      m.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      })
      m.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })

      // 3D Buildings Layer — Matcha Style
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
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'height'],
              0, '#ffffff',
              20, '#b6e6c8',
              50, '#75d195',
              100, '#4dbf73',
              200, '#2d7a48',
            ],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.85,
          },
        },
        labelLayerId
      )

      // Atmosphere for clean light look
      m.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 0.0],
          'sky-atmosphere-sun-intensity': 20,
        },
      })

      // NATIONAL MACRO NODES SOURCE
      m.addSource('national-nodes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: NATIONAL_CITIES.map(city => ({
            type: 'Feature',
            properties: { id: city.id, score: 50 },
            geometry: { type: 'Point', coordinates: [city.lng, city.lat] }
          }))
        }
      })

      // Pulse Layer (Outer Rings)
      m.addLayer({
        id: 'macro-nodes-pulse',
        type: 'circle',
        source: 'national-nodes',
        maxzoom: 12,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 40],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'score'],
            0, '#4dbf73',
            50, '#f6d353',
            100, '#d7383b'
          ],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 12, 0],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      })

      // Inner Solid Nodes
      m.addLayer({
        id: 'macro-nodes-inner',
        type: 'circle',
        source: 'national-nodes',
        maxzoom: 14,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 8],
          'circle-color': '#fff',
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 14, 0]
        }
      })

      // City Labels
      m.addLayer({
        id: 'macro-nodes-label',
        type: 'symbol',
        source: 'national-nodes',
        maxzoom: 13,
        layout: {
          'text-field': ['get', 'id'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-offset': [0, 1.5],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#fff',
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 11, 1, 13, 0]
        }
      })

      // THREE.JS Integration
      // THREE.JS Integration - Initial coordinates will be overridden in render
      const mercator = mapboxgl.MercatorCoordinate.fromLngLat(BKC_CENTER, 0)
      const scale = mercator.meterInMercatorCoordinateUnits()

      const bubbleFireLayer: any = {
        id: 'bubble-fire-effect',
        type: 'custom',
        renderingMode: '3d',
        onAdd: function (map: mapboxgl.Map, gl: WebGLRenderingContext) {
          this.camera = new THREE.Camera()
          this.scene = new THREE.Scene()
          
          // 1. Red solid bounding box replacing the building visually
          const boxGeo = new THREE.BoxGeometry(60, 160, 60)
          boxGeo.translate(0, 80, 0) // Shift origin to bottom
          
          // Apply vertex colors for a gradient (dark red at base, bright orange/red at top)
          const boxPos = boxGeo.attributes.position
          const colors = []
          const c = new THREE.Color()
          for (let i = 0; i < boxPos.count; i++) {
            const y = boxPos.getY(i)
            // Interpolate from deep red to bright orange-red based on height (0 to 160)
            c.setHex(0xd7383b).lerp(new THREE.Color(0xff8a00), y / 160)
            colors.push(c.r, c.g, c.b)
          }
          boxGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

          const boxMat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            depthWrite: true
          })
          this.boxMesh = new THREE.Mesh(boxGeo, boxMat)
          this.scene.add(this.boxMesh)

          // 2. Fire/Bubble Particles rising from it softly
          const particleCount = 40
          const geom = new THREE.BufferGeometry()
          const pos = new Float32Array(particleCount * 3)
          this.velocities = []

          for (let i = 0; i < particleCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 80
            pos[i * 3 + 1] = Math.random() * 200
            pos[i * 3 + 2] = (Math.random() - 0.5) * 80
            this.velocities.push({
              x: (Math.random() - 0.5) * 0.5,
              y: Math.random() * 0.8 + 0.2, // much slower rise
              z: (Math.random() - 0.5) * 0.5
            })
          }
          geom.setAttribute('position', new THREE.BufferAttribute(pos, 3))
          const ptMat = new THREE.PointsMaterial({
            color: 0xffaa00,
            size: 2, // smaller dots
            transparent: true,
            opacity: 0.35, // much fainter
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
          this.particles = new THREE.Points(geom, ptMat)
          this.scene.add(this.particles)

          // 3. Capital Flow Arcs (Transaction mapping)
          this.arcs = []
          this.photons = []
          
          // Strike right at the rooftop of the highlighted vertical building (height = 160)
          const endPt = new THREE.Vector3(0, 160, 0)

          // 5 sources looping around dynamically, originating slightly off the ground 
          // to simulate Capital flowing in from adjacent surrounding rooftops
          const sources = [
            new THREE.Vector3(300, 50, -250), // Distant NE flow
            new THREE.Vector3(120, 80, 80),   // Close East mid-rise
            new THREE.Vector3(-50, 20, 350),  // Far South ground swell
            new THREE.Vector3(-250, 60, 50),  // Mid West flow
            new THREE.Vector3(-100, 100, -150) // Close NW high-rise jump
          ]

          sources.forEach(startPt => {
            const dist = startPt.distanceTo(endPt)
            
            // Calculate a beautiful high parabolic arc
            const midPt = new THREE.Vector3().addVectors(startPt, endPt).multiplyScalar(0.5)
            // Ensure the arc apex is significantly higher than both the start and end points
            midPt.y = Math.max(startPt.y, endPt.y) + dist * 0.4 
            
            const curve = new THREE.QuadraticBezierCurve3(startPt, midPt, endPt)

            // Faint track line
            const points = curve.getPoints(50) // 51 points
            const trackGeo = new THREE.BufferGeometry().setFromPoints(points)
            // Make the beam brighter since it's going to be a moving shot of light
            const trackMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
            const trackLine = new THREE.Line(trackGeo, trackMat)
            
            // Start fully hidden
            trackGeo.setDrawRange(0, 0)
            
            this.scene.add(trackLine)

            // Random start time and speed for organic flow
            this.arcs.push({ 
              curve, 
              t: Math.random(), 
              speed: 0.004 + Math.random() * 0.004,
              trackGeo, // Store geometry to animate it
              numPts: 51
            })

            // The moving photon (glowing orb mimicking capital)
            const photonGeo = new THREE.SphereGeometry(6, 16, 16)
            const photonMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
            const photon = new THREE.Mesh(photonGeo, photonMat)
            
            // Outer lush green glow for the photon
            const glowGeo = new THREE.SphereGeometry(16, 16, 16)
            const glowMat = new THREE.MeshBasicMaterial({ color: 0x4dbf73, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
            const glow = new THREE.Mesh(glowGeo, glowMat)
            photon.add(glow)
            
            this.scene.add(photon)
            this.photons.push(photon)
          })

          this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true
          })
          this.renderer.autoClear = false
        },
        render: function (gl: WebGLRenderingContext, matrix: number[]) {
          const state = sceneStateRef.current
          
          // Recompute coordinates dynamically based on state
          const currentMercator = mapboxgl.MercatorCoordinate.fromLngLat(state.lngLat, 0)
          const currentScale = currentMercator.meterInMercatorCoordinateUnits()
          
          const m = new THREE.Matrix4().fromArray(matrix)
          const l = new THREE.Matrix4()
            .makeTranslation(currentMercator.x, currentMercator.y, currentMercator.z)
            .scale(new THREE.Vector3(currentScale, -currentScale, currentScale))
            .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))

          this.camera.projectionMatrix = m.multiply(l)
          this.renderer.resetState()

          // Data-Driven Colors — COMPRESSED & PUNCHY
          if (state.needsUpdate && this.boxMesh && this.particles) {
             state.needsUpdate = false
             
             // Extract metrics from flag for deeper weighting
             const flag = bubbleFlags?.find(f => f.region.toLowerCase() === activeRegion?.toLowerCase())
             const piRatio = flag?.price_income_ratio || 10
             const capSpread = flag?.cap_rate_spread || 2.5
             
             let hexColor = 0x0f4d23 // Match Safe (Green)
             let topColor = 0x4dbf73
             
             // Make the thresholds VERY aggressive based on metrics
             // If PI Ratio > 15 or Cap Spread < 1.0, the risk is automatically critical
             const isStressed = state.score > 65 || piRatio > 16 || capSpread < 0.8
             const isWarning = state.score > 35 || piRatio > 12 || capSpread < 1.5

             if (isStressed) {
               hexColor = 0xd7383b // Red High Risk
               topColor = 0xff8a00
             } else if (isWarning) {
               hexColor = 0xE4B461 // Yellow/Gold Warning
               topColor = 0xffcc00
             }
             
             // Box gradient
             const boxPos = this.boxMesh.geometry.attributes.position
             const colors = []
             const cColor = new THREE.Color()
             for (let i = 0; i < boxPos.count; i++) {
               const y = boxPos.getY(i)
               cColor.setHex(hexColor).lerp(new THREE.Color(topColor), y / 160)
               colors.push(cColor.r, cColor.g, cColor.b)
             }
             this.boxMesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
             
             // Particles & Photons
             this.particles.material.color.setHex(topColor)
             if (this.photons) {
                this.photons.forEach((p: any) => p.children[0].material.color.setHex(topColor))
             }
          }

          // Animate particles slowly
          if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array
            for (let i = 0; i < 40; i++) {
              positions[i * 3] += this.velocities[i].x
              positions[i * 3 + 1] += this.velocities[i].y
              positions[i * 3 + 2] += this.velocities[i].z
              
              if (positions[i * 3 + 1] > 200) {
                positions[i * 3 + 1] = 0
                positions[i * 3] = (Math.random() - 0.5) * 80
                positions[i * 3 + 2] = (Math.random() - 0.5) * 80
              }
            }
            this.particles.geometry.attributes.position.needsUpdate = true
          }

          // Animate Capital Flow Arcs
          if (this.arcs && this.photons) {
            for (let i = 0; i < this.arcs.length; i++) {
              const arc = this.arcs[i]
              arc.t += arc.speed
              if (arc.t > 1) {
                arc.t = 0 // Reset to source
              }
              
              // 1. Move Photon Orb
              const pos = arc.curve.getPointAt(arc.t)
              this.photons[i].position.copy(pos)
              
              // 2. Animate the Line itself (Shooting Beam Effect)
              const currentIndex = Math.floor(arc.t * arc.numPts)
              const tailLength = 15 // Only show the last 15 segments of the curve as a trail
              const startDraw = Math.max(0, currentIndex - tailLength)
              const drawCount = currentIndex - startDraw
              
              // Update geometry draw range so the line physically "moves"
              arc.trackGeo.setDrawRange(startDraw, drawCount)
            }
          }

          this.renderer.render(this.scene, this.camera)
          map.current?.triggerRepaint()
        }
      }

      m.addLayer(bubbleFireLayer, '3d-buildings')

      // --- ZONE HIGHLIGHT LAYER ---
      m.addSource('selected-zone', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })

      m.addLayer({
        id: 'zone-highlight-fill',
        type: 'fill',
        source: 'selected-zone',
        paint: {
          'fill-color': '#0f4d23',
          'fill-opacity': 0.2,
        }
      })

      m.addLayer({
        id: 'zone-highlight-outline',
        type: 'line',
        source: 'selected-zone',
        paint: {
          'line-color': '#4dbf73',
          'line-width': 3,
          'line-dasharray': [2, 1],
        }
      })

      // Handle map clicks for zone selection
      m.on('click', (e) => {
        const zone = findZoneByCoordinates(e.lngLat.lng, e.lngLat.lat, activeRegion)
        setSelectedZone(zone)
        
        if (zone) {
          // Add a subtle fly-to for better focus
          m.flyTo({
            center: e.lngLat,
            zoom: Math.max(m.getZoom(), 16),
            duration: 1500,
            essential: true
          })
        }
      })

      setMapLoaded(true)
    })

    // Navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Persistent marker refs — update colors in-place instead of destroy/recreate
  const markerElemsRef = useRef<Record<string, HTMLDivElement>>({})

  // Add data-driven markers for all 8 tracked cities
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    Object.entries(ASSET_COORDS).forEach(([id, coords]) => {
      const data = valuationMap[id]

      // risk_score is stored 0-10. >7 = red, >4 = yellow, <=4 = green
      const risk = data?.risk_score ?? 5
      const color = risk > 7 ? '#d7383b' : risk > 4 ? '#E4B461' : '#4dbf73'
      const riskLabel = (risk * 10).toFixed(0) // display as 0-100

      // If marker already exists, just update its color
      if (markerElemsRef.current[id]) {
        markerElemsRef.current[id].style.background = color
        return
      }

      // First time: create marker element
      const el = document.createElement('div')
      el.className = 'mapbox-risk-marker'
      el.style.cssText = `
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.9);
        box-shadow: 0 0 12px ${color}88;
        cursor: pointer;
        animation: pulse-marker 2s infinite;
        transition: background 0.5s ease;
      `
      markerElemsRef.current[id] = el

      // Build popup that reads LIVE data from store at click time
      const popup = new mapboxgl.Popup({ offset: 25, className: 'matcha-popup', closeButton: false })
      popup.on('open', () => {
        // Re-read the store at click time so popup always shows current data
        const live = useStore.getState().valuationMap[id]
        const liveRisk = live?.risk_score ?? 5
        const liveColor = liveRisk > 7 ? '#d7383b' : liveRisk > 4 ? '#E4B461' : '#4dbf73'
        const liveScore = (liveRisk * 10).toFixed(0)
        const livePir = live?.pi_ratio?.toFixed(1) ?? 'N/A'
        const livePrice = live?.price_index ? `₹${(live.price_index / 100000).toFixed(1)}L` : 'N/A'
        popup.setHTML(`
          <div style="background: #0d1a12; color: #e8f5e9; padding: 14px 18px; border-radius: 12px; border: 1px solid #2d7a48; font-family: 'Space Grotesk', sans-serif; min-width: 180px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);">
            <div style="font-size: 14px; font-weight: 800; margin-bottom: 2px; color: #fff;">${id}</div>
            <div style="font-size: 9px; color: ${liveColor}; text-transform: uppercase; font-weight: 700; letter-spacing: 0.12em; margin-bottom: 10px;">Bubble Score: ${liveScore}/100</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 1px solid #1a3a24; padding-top: 8px;">
              <div><div style="font-size: 8px; color: #6abf88; text-transform: uppercase; font-weight: 700;">Risk</div><div style="font-size: 13px; color: ${liveColor}; font-weight: 800;">${liveScore}/100</div></div>
              <div><div style="font-size: 8px; color: #6abf88; text-transform: uppercase; font-weight: 700;">PI Ratio</div><div style="font-size: 13px; color: #fff; font-weight: 800;">${livePir}x</div></div>
              <div style="grid-column: 1/-1;"><div style="font-size: 8px; color: #6abf88; text-transform: uppercase; font-weight: 700;">Est. Price</div><div style="font-size: 13px; color: #fff; font-weight: 800;">${livePrice}</div></div>
            </div>
          </div>
        `)
      })

      el.addEventListener('click', () => {
        useStore.getState().setSelectedAssetId(id)
      })

      new mapboxgl.Marker(el)
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map.current!)
    })
  }, [valuationMap, mapLoaded])

  // --- Dynamic Mapbox Environment Coloring (p10 < p50 < p90 Risk Distribution) ---
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const flag = bubbleFlags?.find(f => f.region.toLowerCase() === activeRegion?.toLowerCase())
    const score = flag ? flag.overall_score : 50

    // The user requested: make economic parameters HIT HARDER.
    // Fixed height mapping is now modulated by specific type sensitivities.
    
    const piRatio = flag?.price_income_ratio || 10
    const capSpread = flag?.cap_rate_spread || 2.5
    const affordability = flag?.affordability_pct || 40

    // Multi-factor base colors
    const baseGreen = '#2d7a48'
    const warningYellow = '#f6d353'
    const dangerRed = '#d7383b'

    // We use a Mapbox 'case' expression to differentiate by property 'type'
    // Residential buildings react strongly to PI Ratios & Affordability
    // Commercial buildings react strongly to Cap Spread (Yield performance)
    
    // --- AGGRESSIVE THRESHOLDS: Tightened for dramatic visual ripple ---
    const resRisk = piRatio > 13 || affordability < 30 ? dangerRed : piRatio > 10 ? warningYellow : baseGreen
    const commRisk = capSpread < 1.5 ? dangerRed : capSpread < 2.5 ? warningYellow : baseGreen
    const defaultRisk = score > 65 ? dangerRed : score > 35 ? warningYellow : baseGreen

    if (map.current.getLayer('3d-buildings')) {
      map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
        'case',
        // If the building is 'residential'
        ['any', ['==', ['get', 'type'], 'residential'], ['==', ['get', 'type'], 'apartments']],
        ['interpolate', ['linear'], ['get', 'height'], 0, baseGreen, 50, resRisk, 120, dangerRed],
        
        // If the building is 'commercial' or 'office'
        ['any', ['==', ['get', 'type'], 'commercial'], ['==', ['get', 'type'], 'office'], ['==', ['get', 'type'], 'retail']],
        ['interpolate', ['linear'], ['get', 'height'], 0, baseGreen, 50, commRisk, 120, dangerRed],

        // Default height-based fallthrough that uses the macro score
        ['interpolate', ['linear'], ['get', 'height'], 0, baseGreen, 60, defaultRisk, 150, dangerRed]
      ])
    }
  }, [activeRegion, bubbleFlags, mapLoaded])

  // --- STOCHASTIC JITTER: Real-time 'Flicker' based on Volatility ---
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    let frameId: number
    const flag = bubbleFlags?.find(f => f.region.toLowerCase() === activeRegion?.toLowerCase())
    const score = flag?.overall_score || 50
    const volatility = score / 100 // Scale jitter intensity with risk score

    const flicker = () => {
      if (map.current?.getLayer('3d-buildings')) {
        // Stochastic noise + Sine wave pulse
        const baseOpacity = 0.7 + (volatility * 0.2)
        const noise = (Math.random() - 0.5) * 0.05 * volatility
        const pulse = Math.sin(Date.now() / 150) * 0.03 * volatility
        
        map.current.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', baseOpacity + noise + pulse)
      }
      frameId = requestAnimationFrame(flicker)
    }

    if (score > 40) {
      flicker()
    } else {
      map.current.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 0.7)
    }

    return () => cancelAnimationFrame(frameId)
  }, [activeRegion, bubbleFlags, mapLoaded])

  // Update National Node Data when bubbleFlags change
  useEffect(() => {
    if (!map.current || !mapLoaded || !bubbleFlags) return

    const source = map.current.getSource('national-nodes') as mapboxgl.GeoJSONSource
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: NATIONAL_CITIES.map(city => {
          const flag = bubbleFlags.find(f => f.region.toLowerCase() === city.id.toLowerCase())
          return {
            type: 'Feature',
            properties: { id: city.id, score: flag?.overall_score || 50 },
            geometry: { type: 'Point', coordinates: [city.lng, city.lat] }
          }
        })
      })
    }
  }, [bubbleFlags, mapLoaded])

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
            properties: {}
          }]
        })
      } else {
        source.setData({
          type: 'FeatureCollection',
          features: []
        })
      }
    }
  }, [selectedZone, mapLoaded])

  // --- Fly to target location when mapTarget changes ---
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

      {/* Holographic scan overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(0,255,255,0.04)_0%,transparent_60%)]" />
      
      <style jsx>{`
        @keyframes pulse-marker {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}

export default MapboxReality
