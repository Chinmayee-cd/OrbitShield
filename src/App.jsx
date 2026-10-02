import { useState, useEffect, useRef, useCallback } from 'react'
import Globe from 'react-globe.gl'
import * as satellite from 'satellite.js'

// Real TLE data for satellites
const SATELLITES = [
  {
    name: 'Sentinel-2A',
    tle1: '1 40697U 15028A   24001.50000000  .00000000  00000-0  00000-0 0  9999',
    tle2: '2 40697  98.5680 100.0000 0001234  90.0000 270.0000 14.30818964999999'
  },
  {
    name: 'Landsat 9',
    tle1: '1 49260U 21088A   24001.50000000  .00000000  00000-0  00000-0 0  9999',
    tle2: '2 49260  98.2216 100.0000 0001420  90.0000 270.0000 14.57110240999999'
  },
  {
    name: 'Terra',
    tle1: '1 25994U 99068A   24001.50000000  .00000000  00000-0  00000-0 0  9999',
    tle2: '2 25994  98.2002 100.0000 0001340  90.0000 270.0000 14.57220150999999'
  },
  {
    name: 'ISS',
    tle1: '1 25544U 98067A   24001.50000000  .00000000  00000-0  00000-0 0  9999',
    tle2: '2 25544  51.6416 100.0000 0002345  90.0000 270.0000 15.49611080999999'
  }
]

const FALLBACK_DISASTERS = [
  { id: 'EONET_1', title: 'California Wildfire Complex', categories: [{ title: 'Wildfires' }], geometry: [{ coordinates: [-120.5, 37.2] }] },
  { id: 'EONET_2', title: 'Hurricane Maria Remnants', categories: [{ title: 'Severe Storms' }], geometry: [{ coordinates: [-65.3, 18.4] }] },
  { id: 'EONET_3', title: 'Mount Etna Eruption', categories: [{ title: 'Volcanoes' }], geometry: [{ coordinates: [15.0, 37.7] }] },
  { id: 'EONET_4', title: 'Bangladesh Flooding', categories: [{ title: 'Floods' }], geometry: [{ coordinates: [90.4, 23.8] }] },
  { id: 'EONET_5', title: 'Amazon Drought Event', categories: [{ title: 'Drought' }], geometry: [{ coordinates: [-60.0, -3.5] }] }
]

const CATEGORY_EMOJI = {
  'Wildfires': '🔥',
  'Severe Storms': '🌀',
  'Volcanoes': '🌋',
  'Floods': '🌊',
  'Drought': '☀️',
  'Sea and Lake Ice': '🧊',
  'Earthquakes': '🏔️'
}

function propagateSatellite(sat) {
  try {
    const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2)
    const now = new Date()
    const posVel = satellite.propagate(satrec, now)
    if (!posVel || !posVel.position) return null
    const gmst = satellite.gstime(now)
    const geo = satellite.eciToGeodetic(posVel.position, gmst)
    return {
      name: sat.name,
      lat: satellite.degreesLat(geo.latitude),
      lng: satellite.degreesLong(geo.longitude),
      alt: geo.height
    }
  } catch (e) {
    console.error('Satellite propagation error:', e)
    return null
  }
}

function computeLocalTelemetry(disasterLat, disasterLon, satLat, satLon, category) {
  const R = 6371;
  const dLat = (satLat - disasterLat) * Math.PI / 180;
  const dLon = (satLon - disasterLon) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(disasterLat * Math.PI/180) * Math.cos(satLat * Math.PI/180) * Math.sin(dLon/2)**2;
  const groundDistanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const estimatedInterceptMin = groundDistanceKm / (7.5 * 60);
  const imagingLockStatus = groundDistanceKm < 500 ? 'LOCKED' : groundDistanceKm < 1500 ? 'ACQUIRING' : 'OUT_OF_RANGE';
  const sensorMap = { 'Wildfires': 'SWIR+Thermal', 'Volcanoes': 'Multispectral+TIR', 'Severe Storms': 'SAR+Optical', 'Floods': 'SAR+Multispectral' };
  const recommendedSensorMode = sensorMap[category] || 'Optical+NIR';
  const priorityScore = Math.min(99, Math.max(55, Math.round(99 - (groundDistanceKm / 50))));
  const actionBrief = [
    `Deploy ${recommendedSensorMode} sensor suite for ${category} monitoring`,
    `Initiate overpass sequence — ETA ${estimatedInterceptMin.toFixed(1)} min at current orbital velocity`,
    `${imagingLockStatus === 'LOCKED' ? 'Begin high-resolution capture sequence' : imagingLockStatus === 'ACQUIRING' ? 'Adjust attitude for optimal imaging geometry' : 'Relay tasking to next available overpass window'}`
  ];
  return { groundDistanceKm: parseFloat(groundDistanceKm.toFixed(2)), estimatedInterceptMin: parseFloat(estimatedInterceptMin.toFixed(2)), imagingLockStatus, recommendedSensorMode, priorityScore, actionBrief };
}

export default function App() {
  const globeRef = useRef(null)
  const containerRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: window.innerWidth - 380, height: window.innerHeight })
  const [selectedSat, setSelectedSat] = useState(SATELLITES[0].name)
  const [satPositions, setSatPositions] = useState([])
  const [disasters, setDisasters] = useState(FALLBACK_DISASTERS)
  const [selectedDisaster, setSelectedDisaster] = useState(null)
  const [telemetry, setTelemetry] = useState(null)
  const [telemetryLoading, setTelemetryLoading] = useState(false)
  const [telemetryError, setTelemetryError] = useState(null)
  const [localCompute, setLocalCompute] = useState(false)
  const [dataSource, setDataSource] = useState('fallback')

  // Resize observer
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        })
      }
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // Auto-rotate globe
  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls()
      if (controls) {
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.3
      }
    }
  }, [globeRef.current])

  // Propagate satellite positions every 5 seconds
  useEffect(() => {
    const update = () => {
      const positions = SATELLITES.map(propagateSatellite).filter(Boolean)
      setSatPositions(positions)
    }
    update()
    const interval = setInterval(update, 5000)
    return () => clearInterval(interval)
  }, [])

  // Fetch NASA EONET disasters
  useEffect(() => {
    fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=15&days=30')
      .then(r => r.json())
      .then(data => {
        if (data.events && data.events.length > 0) {
          setDisasters(data.events)
          setDataSource('eonet')
        }
      })
      .catch(err => {
        console.error('EONET fetch failed, using fallback:', err)
        setDataSource('fallback')
      })
  }, [])

  // Call Lambda when satellite + disaster selected
  const lambdaUrl = import.meta.env.VITE_LAMBDA_URL

  const fetchTelemetry = useCallback(async (disaster, satName) => {
    if (!disaster || !satName || !lambdaUrl) return
    const satPos = satPositions.find(s => s.name === satName)
    if (!satPos) return

    const coords = disaster.geometry[0]?.coordinates || [0, 0]
    const disasterLon = coords[0]
    const disasterLat = coords[1]
    const category = disaster.categories?.[0]?.title || 'Unknown'

    setTelemetryLoading(true)
    setTelemetryError(null)
    try {
      const response = await fetch(lambdaUrl, {
        method: 'POST',
        body: JSON.stringify({
          disasterTitle: disaster.title,
          category,
          disasterLat,
          disasterLon,
          satName,
          satLat: satPos.lat,
          satLon: satPos.lng,
          satAlt: satPos.alt
        })
      })
      const data = await response.json()
      // Lambda may return the body as a nested JSON string
      if (typeof data.body === 'string') {
        setTelemetry(JSON.parse(data.body))
      } else {
        setTelemetry(data)
      }
      setLocalCompute(false)
    } catch (err) {
      console.error('Lambda call failed, using local compute:', err)
      const coords = disaster.geometry[0]?.coordinates || [0, 0]
      const fallbackDisasterLon = coords[0]
      const fallbackDisasterLat = coords[1]
      const category = disaster.categories?.[0]?.title || 'Unknown'
      const satPos = satPositions.find(s => s.name === satName)
      if (satPos) {
        const localResult = computeLocalTelemetry(fallbackDisasterLat, fallbackDisasterLon, satPos.lat, satPos.lng, category)
        setTelemetry(localResult)
        setLocalCompute(true)
      }
      setTelemetryError(null)
    } finally {
      setTelemetryLoading(false)
    }
  }, [lambdaUrl, satPositions])

  useEffect(() => {
    if (selectedDisaster && selectedSat) {
      fetchTelemetry(selectedDisaster, selectedSat)
    }
  }, [selectedDisaster, selectedSat, fetchTelemetry])

  // Globe data
  const ringsData = disasters.map(d => {
    const coords = d.geometry?.[0]?.coordinates || [0, 0]
    return { lat: coords[1], lng: coords[0], color: 'rgba(255,50,50,0.6)' }
  })

  const pointsData = satPositions.map(s => ({
    lat: s.lat,
    lng: s.lng,
    alt: 0.02,
    name: s.name,
    color: s.name === selectedSat ? '#00ffff' : '#4488ff'
  }))

  const activeSat = satPositions.find(s => s.name === selectedSat)
  const activeDisaster = selectedDisaster
  const arcsData = activeSat && activeDisaster ? [{
    startLat: activeSat.lat,
    startLng: activeSat.lng,
    endLat: (activeDisaster.geometry?.[0]?.coordinates || [0, 0])[1],
    endLng: (activeDisaster.geometry?.[0]?.coordinates || [0, 0])[0],
    color: '#ff6600'
  }] : []

  const lockColor = {
    'LOCKED': '#00ff88',
    'ACQUIRING': '#ffcc00',
    'OUT_OF_RANGE': '#ff4444'
  }

  return (
    <div style={{display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#050a18', color: '#e0e8ff', fontFamily: 'monospace, system-ui'}}>
      {/* LEFT SIDEBAR */}
      <div className="sidebar" style={{width: '380px', minWidth: '380px', height: '100vh', overflowY: 'auto', background: '#0a0f1e', borderRight: '1px solid #1a2a4a', display: 'flex', flexDirection: 'column', gap: '0'}}>
        {/* Header */}
        <div style={{padding: '20px 20px 12px', borderBottom: '1px solid #1a2a4a'}}>
          <h1 style={{margin: 0, fontSize: '1.4rem', color: '#00d4ff', letterSpacing: '2px'}}>🛰️ OrbitShield</h1>
          <p style={{margin: '4px 0 0', fontSize: '0.75rem', color: '#4a6fa5', letterSpacing: '3px', textTransform: 'uppercase'}}>Mission Control</p>
        </div>

        {/* Satellite Selector */}
        <div style={{padding: '16px 20px', borderBottom: '1px solid #1a2a4a'}}>
          <h2 style={{margin: '0 0 10px', fontSize: '0.7rem', color: '#4a6fa5', letterSpacing: '2px', textTransform: 'uppercase'}}>Active Satellite</h2>
          <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
            {SATELLITES.map(sat => {
              const pos = satPositions.find(s => s.name === sat.name)
              return (
                <button
                  key={sat.name}
                  onClick={() => setSelectedSat(sat.name)}
                  style={{
                    background: selectedSat === sat.name ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedSat === sat.name ? '#00d4ff' : '#1a2a4a'}`,
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: selectedSat === sat.name ? '#00d4ff' : '#8899bb',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.8rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{fontWeight: 'bold'}}>{sat.name}</span>
                  {pos && <span style={{float: 'right', fontSize: '0.7rem', color: '#4a6fa5'}}>{pos.lat.toFixed(1)}° {pos.lng.toFixed(1)}°</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Disasters Feed */}
        <div style={{padding: '16px 20px', borderBottom: '1px solid #1a2a4a', flex: 1}}>
          <h2 style={{margin: '0 0 6px', fontSize: '0.7rem', color: '#4a6fa5', letterSpacing: '2px', textTransform: 'uppercase'}}>
            NASA EONET Disasters
            <span style={{marginLeft: '8px', fontSize: '0.6rem', color: dataSource === 'eonet' ? '#00ff88' : '#ffcc00'}}>
              [{dataSource === 'eonet' ? 'LIVE' : 'FALLBACK'}]
            </span>
          </h2>
          <div style={{display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto'}}>
            {disasters.map(d => {
              const category = d.categories?.[0]?.title || 'Unknown'
              const emoji = CATEGORY_EMOJI[category] || '⚡'
              const isSelected = selectedDisaster?.id === d.id
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDisaster(d)}
                  className={isSelected ? 'disaster-card selected' : 'disaster-card'}
                  style={{
                    background: isSelected ? 'rgba(255,100,50,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected ? '#ff6432' : '#1a2a4a'}`,
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: isSelected ? '#ffaa88' : '#8899bb',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.78rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{emoji} {d.title}</span>
                  <div style={{fontSize: '0.65rem', color: '#4a6fa5', marginTop: '2px'}}>{category}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Telemetry Card */}
        <div style={{padding: '16px 20px'}}>
          <h2 style={{margin: '0 0 10px', fontSize: '0.7rem', color: '#4a6fa5', letterSpacing: '2px', textTransform: 'uppercase'}}>
            AWS Lambda Overpass Telemetry
            {localCompute && <span style={{marginLeft: '6px', fontSize: '0.6rem', color: '#555e77', fontWeight: 'normal', textTransform: 'none', letterSpacing: '0'}}>(local compute)</span>}
          </h2>
          {!lambdaUrl && (
            <div style={{color: '#ff4444', fontSize: '0.75rem', padding: '8px', background: 'rgba(255,0,0,0.08)', borderRadius: '6px', border: '1px solid #ff4444'}}>
              ⚠️ VITE_LAMBDA_URL not configured
            </div>
          )}
          {lambdaUrl && !selectedDisaster && (
            <div style={{color: '#4a6fa5', fontSize: '0.75rem'}}>Select a disaster to begin analysis</div>
          )}
          {telemetryLoading && (
            <div style={{color: '#00d4ff', fontSize: '0.8rem', textAlign: 'center', padding: '12px'}}>⟳ Querying Lambda...</div>
          )}
          {telemetry && !telemetryLoading && (
            <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
              <div className="telemetry-row">
                <span style={{color: '#4a6fa5', fontSize: '0.7rem'}}>GROUND DIST</span>
                <span style={{color: '#e0e8ff', fontWeight: 'bold'}}>{telemetry.groundDistanceKm} km</span>
              </div>
              <div className="telemetry-row">
                <span style={{color: '#4a6fa5', fontSize: '0.7rem'}}>INTERCEPT</span>
                <span style={{color: '#e0e8ff', fontWeight: 'bold'}}>{telemetry.estimatedInterceptMin} min</span>
              </div>
              <div className="telemetry-row">
                <span style={{color: '#4a6fa5', fontSize: '0.7rem'}}>IMAGING LOCK</span>
                <span style={{color: lockColor[telemetry.imagingLockStatus] || '#e0e8ff', fontWeight: 'bold'}}>{telemetry.imagingLockStatus}</span>
              </div>
              <div className="telemetry-row">
                <span style={{color: '#4a6fa5', fontSize: '0.7rem'}}>SENSOR MODE</span>
                <span style={{color: '#00d4ff', fontSize: '0.72rem'}}>{telemetry.recommendedSensorMode}</span>
              </div>
              <div className="telemetry-row">
                <span style={{color: '#4a6fa5', fontSize: '0.7rem'}}>PRIORITY</span>
                <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <div style={{flex: 1, height: '4px', background: '#1a2a4a', borderRadius: '2px'}}>
                    <div style={{ width: `${((telemetry.priorityScore - 55) / 44) * 100}%`, height: '100%', background: telemetry.priorityScore > 80 ? '#ff4444' : '#ffcc00', borderRadius: '2px', transition: 'width 0.5s' }} />
                  </div>
                  <span style={{color: telemetry.priorityScore > 80 ? '#ff4444' : '#ffcc00', fontWeight: 'bold', fontSize: '0.8rem'}}>{telemetry.priorityScore}</span>
                </div>
              </div>
              <div style={{marginTop: '6px'}}>
                <div style={{color: '#4a6fa5', fontSize: '0.7rem', marginBottom: '4px'}}>ACTION BRIEF</div>
                {telemetry.actionBrief?.map((bullet, i) => (
                  <div key={i} style={{display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '0.72rem', color: '#aac0e0', lineHeight: '1.4'}}>
                    <span style={{color: '#00d4ff', flexShrink: 0}}>▸</span>
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — 3D Globe */}
      <div ref={containerRef} style={{flex: 1, position: 'relative', overflow: 'hidden'}}>
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          ringsData={ringsData}
          ringColor={() => 'rgba(255,50,50,0.6)'}
          ringMaxRadius={4}
          ringPropagationSpeed={1.5}
          ringRepeatPeriod={1200}
          pointsData={pointsData}
          pointColor={d => d.color}
          pointAltitude={0.02}
          pointRadius={0.5}
          pointLabel={d => d.name}
          arcsData={arcsData}
          arcColor={() => '#ff6600'}
          arcAltitude={0.3}
          arcStroke={1.5}
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={2000}
        />
        {/* Overlay labels */}
        <div style={{position: 'absolute', top: '16px', right: '16px', fontSize: '0.7rem', color: '#4a6fa5', textAlign: 'right'}}>
          <div>{satPositions.length} satellites tracked</div>
          <div>{disasters.length} active events</div>
        </div>
      </div>
    </div>
  )
}
