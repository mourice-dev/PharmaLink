import { useCallback, useEffect, useMemo, useState } from 'react'
import { divIcon, type LatLngExpression } from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import { Activity, ArrowDownUp, ArrowRight, ArrowUpRight, Bell, ChevronDown, Clock3, Cross, LocateFixed, MapPin, Menu, Navigation as NavigationIcon, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react'

type Pharmacy = { name: string; area: string; distance: string; stock: number; updated: string; initials: string; color: string; lat: number; lng: number }
type Medicine = { name: string; detail: string; form: string; category: string; pharmacies: Pharmacy[] }
type OsmPharmacy = { id: string; name: string; lat: number; lng: number; area: string; phone?: string; openingHours?: string; website?: string }

const NEARBY_RADIUS_METERS = 1000
const formatRadius = (meters: number) => meters < 1000 ? `${meters} m` : `${meters / 1000} km`
let osmPharmacyMemoryCache: { key: string; pharmacies: OsmPharmacy[] } | null = null
let osmPharmacyPending: { key: string; promise: Promise<OsmPharmacy[]> } | null = null

function loadNearbyPharmacies(center: [number, number], radius = NEARBY_RADIUS_METERS): Promise<OsmPharmacy[]> {
  const key = `${center[0].toFixed(3)},${center[1].toFixed(3)}:${radius}`
  if (osmPharmacyMemoryCache?.key === key) return Promise.resolve(osmPharmacyMemoryCache.pharmacies)
  if (osmPharmacyPending?.key === key) return osmPharmacyPending.promise
  const promise = fetchNearbyPharmacies(center, radius).then(pharmacies => {
    osmPharmacyMemoryCache = { key, pharmacies }
    return pharmacies
  }).finally(() => { if (osmPharmacyPending?.key === key) osmPharmacyPending = null })
  osmPharmacyPending = { key, promise }
  return promise
}

async function fetchNearbyPharmacies(center: [number, number], radius: number): Promise<OsmPharmacy[]> {
  const query = `[out:json][timeout:6];nwr(around:${radius},${center[0]},${center[1]})["amenity"="pharmacy"];out center tags;`
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
  let failure: unknown
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(6_000),
      })
      if (!response.ok) throw new Error(`OpenStreetMap data request failed (${response.status}).`)
      const data = await response.json() as { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> }
      const pharmacies = (data.elements ?? []).flatMap(element => {
        const lat = element.lat ?? element.center?.lat
        const lng = element.lon ?? element.center?.lon
        if (lat == null || lng == null) return []
        const tags = element.tags ?? {}
        return [{
          id: `${element.type}-${element.id}`,
          name: tags.name ?? tags.brand ?? tags.operator ?? 'Pharmacy',
          lat, lng,
          area: tags['addr:suburb'] ?? tags['addr:neighbourhood'] ?? tags['addr:district'] ?? tags['addr:street'] ?? 'Kigali, Rwanda',
          phone: tags.phone ?? tags['contact:phone'],
          openingHours: tags.opening_hours,
          website: tags.website ?? tags['contact:website'],
        }]
      })
      const unique = [...new Map(pharmacies.map(pharmacy => [`${pharmacy.lat.toFixed(5)},${pharmacy.lng.toFixed(5)}`, pharmacy])).values()]
      return unique
    } catch (error) { failure = error }
  }
  throw failure instanceof Error ? failure : new Error('Could not load pharmacy locations from OpenStreetMap.')
}

const pharmacyMarkerIcon = divIcon({
  className: 'pharmacy-marker-shell',
  html: '<span class="pharmacy-marker-pin"><i>✚</i></span>',
  iconSize: [32, 40],
  iconAnchor: [16, 37],
  popupAnchor: [0, -34],
})

const medicines: Medicine[] = [
  { name: 'Amoxicillin', detail: '500 mg · Capsules', form: 'Capsules', category: 'Antibiotics', pharmacies: [
    { name: 'Kigali Health Pharmacy', area: 'Kacyiru, Kigali', distance: '1.2 km', stock: 25, updated: '12 min ago', initials: 'KH', color: 'mint', lat: -1.9441, lng: 30.0919 },
    { name: 'Remera Community Pharmacy', area: 'Remera, Kigali', distance: '2.8 km', stock: 18, updated: '34 min ago', initials: 'RC', color: 'peach', lat: -1.9574, lng: 30.1112 },
    { name: 'CityCare Pharmacy', area: 'Nyarutarama, Kigali', distance: '3.4 km', stock: 9, updated: '1 hr ago', initials: 'CC', color: 'lavender', lat: -1.9395, lng: 30.1050 },
  ] },
  { name: 'Paracetamol', detail: '500 mg · Tablets', form: 'Tablets', category: 'Pain relief', pharmacies: [
    { name: 'Kigali Health Pharmacy', area: 'Kacyiru, Kigali', distance: '1.2 km', stock: 42, updated: '8 min ago', initials: 'KH', color: 'mint', lat: -1.9441, lng: 30.0919 },
    { name: 'Remera Community Pharmacy', area: 'Remera, Kigali', distance: '2.8 km', stock: 30, updated: '26 min ago', initials: 'RC', color: 'peach', lat: -1.9574, lng: 30.1112 },
  ] },
  { name: 'Cetirizine', detail: '10 mg · Tablets', form: 'Tablets', category: 'Allergy', pharmacies: [
    { name: 'CityCare Pharmacy', area: 'Nyarutarama, Kigali', distance: '3.4 km', stock: 16, updated: '18 min ago', initials: 'CC', color: 'lavender', lat: -1.9395, lng: 30.1050 },
    { name: 'Kigali Health Pharmacy', area: 'Kacyiru, Kigali', distance: '1.2 km', stock: 12, updated: '52 min ago', initials: 'KH', color: 'mint', lat: -1.9441, lng: 30.0919 },
  ] },
]

function App() {
  const [query, setQuery] = useState('')
  const [activeMedicine, setActiveMedicine] = useState(medicines[0])
  const [sortNearest, setSortNearest] = useState(false)
  const [notice, setNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [district, setDistrict] = useState('Kigali, Rwanda')
  const [mapCenter, setMapCenter] = useState<[number, number]>([-1.9441, 30.0619])
  const [selected, setSelected] = useState(0)
  const [page, setPage] = useState(window.location.hash === '#map' ? 'map' : 'home')

  useEffect(() => {
    const syncPage = () => setPage(window.location.hash === '#map' ? 'map' : 'home')
    window.addEventListener('hashchange', syncPage)
    return () => window.removeEventListener('hashchange', syncPage)
  }, [])

  const shown = useMemo(() => {
    const matches = medicines.filter(m => `${m.name} ${m.detail} ${m.category}`.toLowerCase().includes(query.toLowerCase().trim()))
    return matches.length ? matches : []
  }, [query])
  const pharmacies = useMemo(() => sortNearest ? [...activeMedicine.pharmacies].sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)) : activeMedicine.pharmacies, [activeMedicine, sortNearest])
  const search = () => {
    const found = medicines.find(m => `${m.name} ${m.detail} ${m.category}`.toLowerCase().includes(query.toLowerCase().trim()))
    if (found) { setActiveMedicine(found); setSelected(0); setNotice('') }
    else setNotice('No matching medicine in this demo catalogue. Try Amoxicillin, Paracetamol or Cetirizine.')
  }
  const requestLocation = useCallback(() => new Promise<[number, number]>((resolve, reject) => {
    if (!navigator.geolocation) {
      const error = new Error('Location is not available in this browser.')
      setNotice(error.message)
      reject(error)
      return
    }
    setNotice('Requesting your current location…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point: [number, number] = [coords.latitude, coords.longitude]
        setMapCenter(point)
        setDistrict('Near your location')
        setNotice('')
        resolve(point)
      },
      error => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location access is needed to show only nearby pharmacies.'
          : 'Could not get your location. Please try again.'
        setNotice(message)
        reject(new Error(message))
      },
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 12_000 },
    )
  }), [])
  const useLocation = () => { void requestLocation().catch(() => undefined) }
  const current = pharmacies[selected] ?? pharmacies[0]

  if (page === 'map') return <MapExplorer
    mapCenter={mapCenter} requestLocation={requestLocation}
    notice={notice} setNotice={setNotice}
  />

  return <>
    <div className="landing-shell"><div className="landing-panel"><header className="topbar">
      <a className="brand" href="#home" aria-label="PharmaLink home"><span className="brand-icon"><Cross size={19} strokeWidth={3} /></span><span>pharma<span className="brand-light">link</span><i>.</i></span></a>
      <nav className={menuOpen ? 'nav open' : 'nav'}><a className="nav-active" href="#home">Home</a><a href="#search">Find medicine</a><a href="#pharmacies">Pharmacies</a><a href="#about">About us</a></nav>
      <div className="nav-right"><button className="login-link" onClick={() => setNotice('The pharmacy portal is part of the next development phase.')}>For pharmacies <ArrowUpRight size={15}/></button><button className="signin" onClick={() => setNotice('Pharmacy sign-in will be available when accounts are implemented.')}>Sign in <ArrowRight size={15}/></button></div>
      <button className="mobile-menu" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
    </header>
    <main id="home">
      <section className="hero">
        <div className="hero-text"><div className="eyebrow"><span className="pulse-dot"/> YOUR HEALTH, CLOSER</div><h1>Find the right medicine,<br/><em>right around you.</em></h1><p className="hero-copy">Search trusted pharmacies near you, check reported medicine availability, and know who to call before you make the trip.</p>
          <div className="search-box" id="search"><Search size={20}/><input aria-label="Search medicines" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Search medicine or brand..."/><span className="search-divider"/><button className="location-select" onClick={useLocation}><MapPin size={16}/><span>{district}</span><ChevronDown size={14}/></button><button className="search-button" onClick={search}><Search size={17}/><span>Search</span></button></div>
          {shown.length > 0 && query.trim() && <div className="suggestions">{shown.map(m => <button key={m.name} onClick={() => { setQuery(m.name); setActiveMedicine(m); setSelected(0) }}><span className="suggestion-icon"><Cross size={14}/></span><span><b>{m.name}</b><small>{m.detail}</small></span><ArrowRight size={15}/></button>)}</div>}
          {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={14}/></button></div>}
          <div className="hero-download"><button className="get-started" onClick={() => { window.location.hash = 'map' }}>Get started <ArrowRight size={15}/></button></div>
          <div className="hero-proof"><div className="avatar-stack"><span>✓</span><span>✓</span><span>✓</span></div><span>Browse pharmacy locations and <b>reported stock nearby.</b></span></div>
        </div>
        <div className="hero-art" id="pharmacy-map"><div className="map-top hero-map-top"><button className="city-chip" onClick={useLocation}><MapPin size={12}/>{district}<ChevronDown size={12}/></button><button className="map-compass" aria-label="Map view"><LocateFixed size={15}/></button></div><div className="hero-map-grid"/><svg className="hero-map-roads" viewBox="0 0 400 500" preserveAspectRatio="none" aria-hidden="true"><path d="M-30 100 C50 132 92 52 172 103 S286 194 440 120M-20 300 C62 268 113 346 198 290 S318 225 430 310M80 -30 C140 44 82 146 145 225 S204 338 128 520M304 -20 C260 70 328 130 270 210 S245 370 335 520"/><path className="hero-road-small" d="M-20 211 C54 184 80 246 156 206 S288 189 423 230M220 -20 C194 68 243 100 211 166 S195 295 238 356 S208 455 216 510"/></svg><div className="map-lake lake-one"/><div className="map-lake lake-two"/><div className="map-green-space green-one"/><div className="map-green-space green-two"/><span className="hero-street street-one">KN 4 Ave</span><span className="hero-street street-two">KG 7 Rd</span><span className="hero-street street-three">KN 5 Rd</span><div className="hero-map-toolbar"><button onClick={() => setNotice('Map center is illustrative in this prototype.')}><MapPin size={12}/> Kigali <ChevronDown size={12}/></button><button onClick={useLocation}><LocateFixed size={12}/> Current location</button><span>OpenStreetMap-style preview</span></div><div className="hero-map-list"><div className="hero-map-list-heading"><div><b>Pharmacies nearby</b><small>Reported availability · {activeMedicine.name}</small></div><span>{pharmacies.length}</span></div><div className="map-filter-row"><button className="active">All</button><button onClick={() => setSortNearest(!sortNearest)}>Nearest</button><button onClick={() => setNotice('Only verified pharmacies are shown in this prototype.')}>Verified</button></div><div className="map-pharmacy-rows">{pharmacies.slice(0, 3).map((pharmacy, index) => <button key={pharmacy.name} className={selected === index ? 'map-pharmacy-row active' : 'map-pharmacy-row'} onClick={() => setSelected(index)}><span className={`mini-pharmacy-mark ${pharmacy.color}`}><Cross size={13}/></span><span className="map-pharmacy-info"><b>{pharmacy.name}</b><small>{pharmacy.area} · {pharmacy.distance}</small><small className="map-availability"><i/> {pharmacy.stock} units reported · {pharmacy.updated}</small></span><ArrowUpRight size={14}/></button>)}</div><div className="map-list-foot"><ShieldCheck size={12}/> Call to confirm before visiting</div></div><button className="hero-pin pin-pharmacy pin-one" onClick={() => setSelected(0)} aria-label="Kigali Health Pharmacy"><Cross size={15}/></button><button className="hero-pin pin-medicine pin-two" onClick={() => setSelected(1)} aria-label="Remera Community Pharmacy">✚</button><button className="hero-pin pin-pharmacy pin-three" onClick={() => setSelected(2)} aria-label="CityCare Pharmacy"><Cross size={15}/></button><div className="hero-user-location"><i/></div><div className="map-professional"><ShieldCheck size={14}/> Verified pharmacies</div><div className="hero-map-caption">Illustrative map · Kigali, Rwanda</div><div className="hero-map-zoom"><button onClick={() => setNotice('Map zoom is illustrative in this prototype.')}>+</button><button onClick={() => setNotice('Map zoom is illustrative in this prototype.')}>−</button></div></div>
      </section>
      </main></div></div>

      <section className="results-section" id="pharmacies">
        <div className="results-heading"><div><div className="eyebrow eyebrow-small">SAMPLE SEARCH PREVIEW</div><h2>Availability preview <span className="result-count">{pharmacies.length}</span></h2><p className="results-sub">Example results for <strong>{activeMedicine.name} {activeMedicine.detail.split(' · ')[0]}</strong></p></div><div className="result-actions"><button className="filter-btn" onClick={() => setSortNearest(!sortNearest)}><SlidersHorizontal size={16}/>{sortNearest ? 'Nearest first' : 'Filters'}<span className="filter-count">{sortNearest ? '1' : '2'}</span></button><button className="sort-btn" onClick={() => setSortNearest(!sortNearest)}><ArrowDownUp size={15}/><span>Sort: {sortNearest ? 'Nearest' : 'Recommended'}</span><ChevronDown size={14}/></button></div></div>
        <div className="results-layout"><div className="pharmacy-list">{pharmacies.length ? pharmacies.map((pharmacy, index) => <article key={pharmacy.name} className={`pharmacy-card ${selected === index ? 'selected' : ''}`} onClick={() => setSelected(index)}>
          <div className={`pharmacy-avatar ${pharmacy.color}`}>{pharmacy.initials}</div><div className="pharmacy-main"><div className="pharmacy-name-row"><h3>{pharmacy.name}</h3><span className="verified"><ShieldCheck size={13}/> Verified</span></div><div className="pharmacy-location"><MapPin size={14}/>{pharmacy.area}<span className="bullet">·</span>{pharmacy.distance}</div><div className="medicine-pill"><span className="tiny-pill"><Cross size={11}/></span><span>{activeMedicine.name} <small>{activeMedicine.detail}</small></span><b>{pharmacy.stock} units</b></div></div>
          <div className="pharmacy-side"><span className="availability"><i/> In stock</span><span className="updated"><Clock3 size={12}/> {pharmacy.updated}</span><div className="card-actions"><a href={`tel:+250788000000`} onClick={e => e.stopPropagation()} className="call-btn">Call pharmacy</a><button aria-label={`Get directions to ${pharmacy.name}`} className="direction-btn" onClick={e => {e.stopPropagation(); window.open(`https://www.openstreetmap.org/directions?to=${pharmacy.lat}%2C${pharmacy.lng}`, '_blank')}}><ArrowUpRight size={17}/></button></div></div>
        </article>) : <div className="empty-state"><Search size={24}/><b>No pharmacies found</b><span>Try another medicine from our sample catalogue.</span></div>}
          <div className="disclaimer"><Bell size={15}/><span>Sample preview only. Live pharmacy stock is not connected. <b>Call to confirm before visiting.</b></span></div>
        </div>
        <div className="map-panel"><div className="map-top"><div><span className="map-label">PHARMACY MAP</span><p>{district}</p></div><button onClick={useLocation} aria-label="Use my location"><LocateFixed size={17}/></button></div><div className="map-art"><div className="map-grid"/><svg className="roads" viewBox="0 0 400 400" preserveAspectRatio="none" aria-hidden="true"><path d="M-20 90 C60 120 100 75 180 120 S300 200 420 155M-20 290 C80 260 145 320 210 270 S310 210 430 290M95 -20 C120 70 90 120 135 205 S175 300 155 420M310 -20 C275 65 320 120 270 205 S250 310 315 420"/><path className="road-small" d="M-20 185 C40 205 60 175 120 195 S240 220 290 180 S370 170 420 195M220 -20 C205 40 230 80 220 140 S195 240 210 310 S230 360 205 420"/></svg><div className="map-water"/><div className="map-park park-a"/><div className="map-park park-b"/><span className="map-street street-a">KG 9 Ave</span><span className="map-street street-b">KN 5 Rd</span><span className="map-street street-c">KG 11 Ave</span><div className="map-marker marker-a"><span><Cross size={15}/></span></div><div className="map-marker marker-b"><span><Cross size={14}/></span></div><div className="map-marker marker-c"><span><Cross size={14}/></span></div><div className="you-marker"><i/></div><div className="map-zoom"><button onClick={() => setNotice('Map zoom is illustrative in this prototype.')}>+</button><button onClick={() => setNotice('Map zoom is illustrative in this prototype.')}>−</button></div></div><div className="map-bottom"><div className="map-legend"><i/> Pharmacies <span className="legend-you"/> You</div><button onClick={() => window.open(`https://www.openstreetmap.org/directions?to=${current.lat}%2C${current.lng}`, '_blank')}>Open map <ArrowUpRight size={14}/></button></div></div></div>
      </section>
      <section className="trust-strip" id="about"><div><span className="trust-icon"><Activity size={18}/></span><span><b>Better access to care</b><small>Simple healthcare discovery for everyone.</small></span></div><div><span className="trust-icon"><ShieldCheck size={18}/></span><span><b>Verified pharmacies</b><small>Pharmacy profiles are reviewed.</small></span></div><div><span className="trust-icon"><Clock3 size={18}/></span><span><b>Know before you go</b><small>See when availability was last updated.</small></span></div><a href="#search">Explore PharmaLink <ArrowRight size={15}/></a></section>
    <footer><a className="brand footer-brand" href="#home"><span className="brand-icon"><Cross size={17} strokeWidth={3}/></span><span>pharma<span className="brand-light">link</span><i>.</i></span></a><span>Connecting patients to medicines and pharmacies.</span><span>© 2026 PharmaLink <span className="footer-sep">·</span> Kigali, Rwanda</span></footer>
    <button className="floating-help" aria-label="Project information" onClick={() => setNotice('PharmaLink prototype · sample catalogue and pharmacies only.')}><Sparkles size={17}/></button>
  </>
}

type MapExplorerProps = {
  mapCenter: [number, number]
  requestLocation: () => Promise<[number, number]>
  notice: string
  setNotice: (value: string) => void
}

function MapExplorer({ mapCenter, requestLocation, notice, setNotice }: MapExplorerProps) {
  const [pharmacies, setPharmacies] = useState<OsmPharmacy[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [mapSearch, setMapSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('All')
  const [radius, setRadius] = useState(NEARBY_RADIUS_METERS)
  const [locationStatus, setLocationStatus] = useState<'locating' | 'loading' | 'ready' | 'denied' | 'error'>('locating')
  const [hasLocation, setHasLocation] = useState(false)
  const [center, setCenter] = useState<LatLngExpression>(mapCenter)

  useEffect(() => {
    let active = true
    setLocationStatus('locating')
    requestLocation().then(coords => {
      if (!active) return
      setCenter(coords)
      setHasLocation(true)
      setLocationStatus('loading')
      return loadNearbyPharmacies(coords, NEARBY_RADIUS_METERS).then(data => {
        if (!active) return
        setPharmacies(data)
        setLoadError(data.length ? '' : `No pharmacies are mapped within ${formatRadius(NEARBY_RADIUS_METERS)} of your location.`)
        setLoading(false)
        setLocationStatus('ready')
      }).catch(error => {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Could not load nearby OpenStreetMap locations.')
        setLoading(false)
        setLocationStatus('error')
      })
    }).catch(() => {
      if (!active) return
      setHasLocation(false)
      setLocationStatus('denied')
      setLoading(false)
    })
    return () => { active = false }
  }, [requestLocation])

  useEffect(() => { setCenter(mapCenter) }, [mapCenter])

  const matches = pharmacies.filter(pharmacy => !mapSearch.trim() || `${pharmacy.name} ${pharmacy.area}`.toLowerCase().includes(mapSearch.toLowerCase().trim()))
  const distanceFromCenter = (pharmacy: OsmPharmacy) => {
    const rad = (value: number) => value * Math.PI / 180
    const latDelta = rad(pharmacy.lat - mapCenter[0])
    const lngDelta = rad(pharmacy.lng - mapCenter[1])
    const a = Math.sin(latDelta / 2) ** 2 + Math.cos(rad(mapCenter[0])) * Math.cos(rad(pharmacy.lat)) * Math.sin(lngDelta / 2) ** 2
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  const distanceLabel = (pharmacy: OsmPharmacy) => {
    const distance = distanceFromCenter(pharmacy)
    return distance < 1 ? `${Math.round(distance * 1000)} m away` : `${distance.toFixed(1)} km away`
  }
  const results = filter === 'Nearest' ? [...matches].sort((a, b) => distanceFromCenter(a) - distanceFromCenter(b)) : filter === 'With phone' ? matches.filter(pharmacy => pharmacy.phone) : matches
  const focused = results.find(pharmacy => pharmacy.id === selected)

  const googleDirections = (pharmacy: OsmPharmacy) => `https://www.google.com/maps/dir/?api=1&origin=${mapCenter[0]},${mapCenter[1]}&destination=${pharmacy.lat},${pharmacy.lng}`
  const osmDirections = (pharmacy: OsmPharmacy) => `https://www.openstreetmap.org/directions?to=${pharmacy.lat}%2C${pharmacy.lng}`
  const locateAgain = () => {
    setLocationStatus('locating')
    setLoadError('')
    setSelected(null)
    requestLocation().then(coords => {
      setCenter(coords)
      setHasLocation(true)
      setLocationStatus('loading')
      setLoading(true)
      return loadNearbyPharmacies(coords, radius).then(data => {
        setPharmacies(data)
        setLoadError(data.length ? '' : `No pharmacies are mapped within ${formatRadius(radius)} of your location.`)
        setLoading(false)
        setLocationStatus('ready')
      }).catch(error => {
        setLoadError(error instanceof Error ? error.message : 'Could not load nearby pharmacies.')
        setLoading(false)
        setLocationStatus('error')
      })
    }).catch(error => {
      setHasLocation(false)
      setLocationStatus('denied')
      setLoading(false)
      setLoadError(error instanceof Error ? error.message : 'Could not get your current location.')
    })
  }
  const changeRadius = (nextRadius: number) => {
    setRadius(nextRadius)
    if (!hasLocation) return
    setLoading(true)
    setLoadError('')
    setLocationStatus('loading')
    loadNearbyPharmacies(mapCenter, nextRadius).then(data => {
      setPharmacies(data)
      setLoadError(data.length ? '' : `No pharmacies are mapped within ${formatRadius(nextRadius)} of your location.`)
      setLoading(false)
      setLocationStatus('ready')
      setSelected(null)
    }).catch(error => {
      setLoadError(error instanceof Error ? error.message : 'Could not load nearby pharmacies.')
      setLoading(false)
      setLocationStatus('error')
    })
  }

  return <div className="map-explorer">
    <aside className="map-sidebar">
      <a className="brand map-brand" href="#home"><span className="brand-icon"><Cross size={17} strokeWidth={3}/></span><span>pharma<span className="brand-light">link</span><i>.</i></span></a>
      <nav className="map-side-nav">
        <span className="map-nav-label">DISCOVER</span>
        <a href="#home"><Cross size={15}/> Home</a>
        <a className="selected" href="#map"><MapPin size={15}/> Find medicine</a>
        <a href="#map" onClick={() => setFilter('All')}><Activity size={15}/> Pharmacies</a>
        <a href="#map" onClick={() => setNotice('Saved pharmacies will be available in a future release.')}><ShieldCheck size={15}/> Saved</a>
        <span className="map-nav-label map-nav-bottom">MORE</span>
        <a href="#about"><Sparkles size={15}/> About PharmaLink</a>
      </nav>
      <div className="map-sidebar-bottom"><button onClick={() => setNotice('Settings will be available in a future release.')}>Settings</button><button onClick={() => setNotice('For help, please contact your local pharmacy.')}>Help center</button><small>PharmaLink · Kigali, Rwanda</small></div>
    </aside>
    <main className="map-workspace">
      <header className="map-appbar"><a className="map-mobile-brand" href="#home"><Cross size={18}/></a><label className="map-global-search"><Search size={16}/><input value={mapSearch} placeholder="Search pharmacies or neighborhoods" onChange={event => setMapSearch(event.target.value)}/><span>⌘ K</span></label><div className="map-appbar-right"><button aria-label="Notifications" onClick={() => setNotice('You are all caught up.') }><Bell size={17}/><i/></button><button className="map-user-avatar" onClick={() => setNotice('Patient accounts are not required for medicine discovery.')}>N<ChevronDown size={12}/></button></div></header>
      <section className="map-canvas" aria-label="Pharmacy map">
        {hasLocation && <MapContainer className="leaflet-map" center={center} zoom={14} zoomControl={false} scrollWheelZoom>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ZoomControl position="bottomright"/><MapViewport center={center} focused={focused} zoom={radius === 500 ? 15 : 14}/>
          <Circle center={center} radius={radius} pathOptions={{ color: '#16896d', fillColor: '#16896d', fillOpacity: 0.08, weight: 1.5 }}/>
          <CircleMarker center={center} radius={6} pathOptions={{ color: '#fff', weight: 3, fillColor: '#4787e2', fillOpacity: 1 }}/>
          {results.map(pharmacy => <Marker key={pharmacy.id} position={[pharmacy.lat, pharmacy.lng]} icon={pharmacyMarkerIcon} eventHandlers={{ click: () => setSelected(pharmacy.id) }}>
            <Popup><div className="osm-popup"><b>{pharmacy.name}</b><span>{pharmacy.area}</span>{pharmacy.phone && <a href={`tel:${pharmacy.phone}`}>{pharmacy.phone}</a>}<a href={googleDirections(pharmacy)} target="_blank" rel="noreferrer">Directions in Google Maps ↗</a></div></Popup>
          </Marker>)}
        </MapContainer>}
        {!hasLocation && <div className="location-gate"><div className="location-gate-icon"><MapPin size={24}/></div><span className="panel-eyebrow">NEARBY PHARMACY SEARCH</span><h2>{locationStatus === 'locating' ? 'Finding your location' : 'See pharmacies close to you'}</h2><p>{locationStatus === 'locating' ? 'Your browser will ask for location access. We only search nearby.' : loadError || 'Allow location access to find pharmacies within a small radius.'}</p><button onClick={locateAgain}><LocateFixed size={15}/>{locationStatus === 'locating' ? 'Requesting location…' : 'Use my current location'}</button><small>Search radius: {formatRadius(radius)} · Your precise location is not saved.</small></div>}
        {hasLocation && <div className="explorer-map-top"><button className="explorer-home" onClick={() => window.location.hash = 'home'}><Cross size={13}/> Home</button><button onClick={locateAgain}><NavigationIcon size={13}/> Current location</button><a href={`https://www.google.com/maps/search/?api=1&query=pharmacies+near+${mapCenter[0]}%2C${mapCenter[1]}`} target="_blank" rel="noreferrer"><MapPin size={13}/> Open Google Maps</a></div>}
        <aside className="map-results-panel">
          <div className="map-results-heading"><div><span className="panel-eyebrow">NEAR YOUR CURRENT LOCATION</span><h2>Pharmacies within {formatRadius(radius)}</h2><p>{locationStatus === 'ready' ? `${results.length} nearby locations` : locationStatus === 'locating' ? 'Requesting your location…' : 'Nearby search only'}</p></div><button aria-label="Refresh nearby pharmacy locations" onClick={() => { osmPharmacyMemoryCache = null; osmPharmacyPending = null; setLoading(true); setLoadError(''); loadNearbyPharmacies(mapCenter, radius).then(data => { setPharmacies(data); if (!data.length) setLoadError(`No pharmacies are mapped within ${formatRadius(radius)} of your location.`) }).catch(error => setLoadError(error instanceof Error ? error.message : 'Could not load nearby pharmacies.')).finally(() => setLoading(false)) }}>↻</button></div>
          <div className="map-radius-controls"><span>SEARCH RADIUS</span><button disabled={!hasLocation} className={radius === 500 ? 'active' : ''} onClick={() => changeRadius(500)}>500 m</button><button disabled={!hasLocation} className={radius === 1000 ? 'active' : ''} onClick={() => changeRadius(1000)}>1 km</button></div>
          <div className="map-results-filters">{['All', 'Nearest', 'With phone'].map(item => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
          {(locationStatus === 'locating' || locationStatus === 'loading') && <div className="map-load-state"><span className="map-spinner"/>{locationStatus === 'locating' ? 'Requesting your current location…' : 'Loading nearby pharmacies…'}</div>}
          {locationStatus === 'denied' && <div className="map-empty">Allow location access to search nearby pharmacies. We will not show the whole city.</div>}
          {(locationStatus === 'ready' || locationStatus === 'error') && <div className="map-results-scroll">{loading ? <div className="map-load-state"><span className="map-spinner"/>Loading nearby pharmacies…</div> : results.length ? results.map(pharmacy => <article key={pharmacy.id} className={`explorer-pharmacy ${selected === pharmacy.id ? 'active' : ''}`} onClick={() => setSelected(pharmacy.id)}><span className="mini-pharmacy-mark mint"><Cross size={14}/></span><span className="explorer-pharmacy-body"><b>{pharmacy.name}</b><small>{distanceLabel(pharmacy)} · {pharmacy.area}</small><span className="explorer-stock">OpenStreetMap listing</span></span><ArrowUpRight size={14}/></article>) : <div className="map-empty">{loadError || 'No pharmacies match nearby. Try a larger radius or another search.'}</div>}</div>}
          <div className="map-results-footer"><span><Bell size={13}/> Stock data is not connected</span>{focused && <div>{focused.phone && <a href={`tel:${focused.phone}`}>Call</a>}<a href={googleDirections(focused)} target="_blank" rel="noreferrer">Google Maps</a><a href={osmDirections(focused)} target="_blank" rel="noreferrer">OSM</a></div>}</div>
        </aside>
        {notice && <div className="map-toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={13}/></button></div>}
      </section>
    </main>
  </div>
}

function MapViewport({ center, focused, zoom }: { center: LatLngExpression; focused?: OsmPharmacy; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    const target: LatLngExpression = focused ? [focused.lat, focused.lng] : center
    map.flyTo(target, focused ? 16 : zoom, { duration: 0.7 })
  }, [center, focused, map, zoom])
  return null
}

export default App
