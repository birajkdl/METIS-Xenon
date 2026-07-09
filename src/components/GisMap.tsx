import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  MapPin, 
  Search, 
  Layers, 
  Grid, 
  Filter, 
  Building2, 
  Cpu, 
  Maximize2, 
  Locate,
  Navigation,
  Info,
  ExternalLink,
  Wrench,
  AlertCircle
} from 'lucide-react';
import { WeatherStation, Sensor } from '../types.ts';

interface GisMapProps {
  stations: WeatherStation[];
  sensors: Sensor[];
  onSelectStation?: (stationId: number) => void;
  theme?: 'dark' | 'light';
  focusStationId?: number | null;
}

type MapLayerType = 'osm' | 'dark' | 'topo';

export default function GisMap({ stations, sensors, onSelectStation, theme, focusStationId }: GisMapProps) {
  // Map and Container References
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // States
  const [selectedLayer, setSelectedLayer] = useState<MapLayerType>(
    localStorage.getItem('theme') === 'light' ? 'osm' : 'dark'
  );
  const [clusteringEnabled, setClusteringEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [hoveredStationId, setHoveredStationId] = useState<number | null>(null);

  // Sync map layer with theme changes for optimal daylight readability
  useEffect(() => {
    if (theme === 'light') {
      setSelectedLayer('osm');
    } else if (theme === 'dark') {
      setSelectedLayer('dark');
    }
  }, [theme]);

  // Computed Regions List
  const regions = ['All', ...Array.from(new Set(stations.map(s => s.region)))];

  // Helper: compute operational status of a station
  const getStationStatus = (stationId: number) => {
    const stationSensors = sensors.filter(s => s.stationId === stationId);
    if (stationSensors.length === 0) {
      return 'Inactive / No Sensors';
    }

    const hasCritical = stationSensors.some(s => s.status === 'Retired' || s.dismissedAlert === 'true');
    const hasMaintenance = stationSensors.some(s => s.status === 'In Calibration' || s.status === 'Maintenance');
    
    if (hasCritical) return 'Critical Alert';
    if (hasMaintenance) return 'Partial Maintenance';
    return 'Fully Operational';
  };

  // Filter stations based on search and selected filters
  const filteredStations = stations.filter(station => {
    const matchesSearch = station.stationName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          station.region.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = selectedRegion === 'All' || station.region === selectedRegion;
    
    const status = getStationStatus(station.stationId);
    const matchesStatus = selectedStatus === 'All' || status === selectedStatus;

    return matchesSearch && matchesRegion && matchesStatus;
  });

  // Handle flying/focusing on a station on the map
  const handleFocusStation = (station: WeatherStation) => {
    if (!mapInstanceRef.current) return;
    const clampedLat = Math.max(25.8, Math.min(30.7, station.latitude));
    const clampedLng = Math.max(80.0, Math.min(88.5, station.longitude));
    mapInstanceRef.current.flyTo([clampedLat, clampedLng], 10, {
      duration: 1.5
    });

    // Find and open popup for this station
    mapInstanceRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.Marker && layer.options.title === station.stationName) {
        layer.openPopup();
      }
    });
  };

  // Sync to center on selected station from global search
  useEffect(() => {
    if (focusStationId && mapInstanceRef.current) {
      const station = stations.find(s => s.stationId === focusStationId);
      if (station) {
        // Wait a brief moment to ensure map container has sized/mounted fully if we just switched views
        const timer = setTimeout(() => {
          handleFocusStation(station);
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [focusStationId, stations]);

  // Base map layer tiles definitions
  const tileLayers: Record<MapLayerType, { url: string; attribution: string }> = {
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors'
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '© OpenStreetMap © CartoDB'
    },
    topo: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '© OpenTopoMap contributors'
    }
  };

  // Track map zoom and dynamically draw markers/clusters
  const [currentZoom, setCurrentZoom] = useState(6);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const nepalBounds = L.latLngBounds([25.8, 80.0], [30.7, 88.5]);

    // Standard bounding boxes for weather stations or default to center coordinates of Nepal
    let initialLat = stations.length > 0 ? stations.reduce((acc, s) => acc + s.latitude, 0) / stations.length : 28.3;
    let initialLng = stations.length > 0 ? stations.reduce((acc, s) => acc + s.longitude, 0) / stations.length : 84.1;

    // Clamp inside Nepal boundaries
    initialLat = Math.max(25.8, Math.min(30.7, initialLat));
    initialLng = Math.max(80.0, Math.min(88.5, initialLng));

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 7,
      minZoom: 7,
      zoomControl: false, // Custom position
      maxBounds: nepalBounds,
      maxBoundsViscosity: 1.0,
    });

    mapInstanceRef.current = map;

    // Add zoom controls at the bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Create marker layers group
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    // Track Zoom Changes
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer when selected layer changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove any existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    // Add new Tile Layer
    const layerDef = tileLayers[selectedLayer];
    const nepalBounds = L.latLngBounds([25.8, 80.0], [30.7, 88.5]);
    L.tileLayer(layerDef.url, {
      maxZoom: 19,
      bounds: nepalBounds,
      attribution: layerDef.attribution
    }).addTo(map);

  }, [selectedLayer]);

  // Update Markers based on Filters, Clustering, and Zoom
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    // Clear old markers
    markersGroup.clearLayers();

    // Decide if we cluster
    // Cluster if clustering is enabled and current zoom is low
    const shouldCluster = clusteringEnabled && currentZoom < 6;

    if (shouldCluster) {
      // Group stations by Region
      const regionGroups: Record<string, { stations: WeatherStation[]; latSum: number; lngSum: number }> = {};
      
      filteredStations.forEach(station => {
        if (!regionGroups[station.region]) {
          regionGroups[station.region] = { stations: [], latSum: 0, lngSum: 0 };
        }
        regionGroups[station.region].stations.push(station);
        regionGroups[station.region].latSum += station.latitude;
        regionGroups[station.region].lngSum += station.longitude;
      });

      // Draw cluster markers for each region
      Object.entries(regionGroups).forEach(([regionName, data]) => {
        const count = data.stations.length;
        const avgLat = data.latSum / count;
        const avgLng = data.lngSum / count;

        // Custom HTML for cluster counts
        const clusterIcon = L.divIcon({
          className: 'custom-cluster-icon',
          html: `
            <div class="relative flex items-center justify-center w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/40 text-blue-400 font-mono font-bold text-xs shadow-lg backdrop-blur-xs hover:scale-110 transition">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500/15 opacity-40"></span>
              <span>${count}</span>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const clusterMarker = L.marker([avgLat, avgLng], { icon: clusterIcon })
          .addTo(markersGroup)
          .bindPopup(`
            <div class="p-3 text-zinc-100 font-sans min-w-[200px]">
              <span class="text-[9px] font-mono tracking-wider text-blue-400 uppercase block font-bold">REGIONAL CLUSTER</span>
              <h4 class="text-sm font-bold text-white mt-1">${regionName}</h4>
              <p class="text-xs text-zinc-400 mt-1">${count} Weather Stations grouped in this region.</p>
              <button 
                class="mt-3.5 w-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold py-1.5 px-3 rounded-md transition cursor-pointer"
                onclick="window.dispatchEvent(new CustomEvent('map-zoom-cluster', { detail: { lat: ${avgLat}, lng: ${avgLng} } }))"
              >
                Expand Cluster Group
              </button>
            </div>
          `);
      });

    } else {
      // Draw individual markers
      filteredStations.forEach(station => {
        const status = getStationStatus(station.stationId);
        
        // Define color scheme based on station telemetry status
        let colorClass = 'bg-emerald-500';
        let pingColorClass = 'bg-emerald-400';
        let statusLabel = 'Fully Operational';

        if (status === 'Inactive / No Sensors') {
          colorClass = 'bg-zinc-500';
          pingColorClass = 'bg-zinc-400';
          statusLabel = 'Inactive / No Sensors';
        } else if (status === 'Partial Maintenance') {
          colorClass = 'bg-amber-500';
          pingColorClass = 'bg-amber-400';
          statusLabel = 'Partial Maintenance';
        } else if (status === 'Critical Alert') {
          colorClass = 'bg-red-500';
          pingColorClass = 'bg-red-400';
          statusLabel = 'Critical Alert / Out of Service';
        }

        const isFullyOperational = status === 'Fully Operational';

        // Custom HTML circle marker with status pulses
        const markerIcon = L.divIcon({
          className: 'custom-station-icon',
          html: `
            <div class="relative flex items-center justify-center w-6 h-6 ${!isFullyOperational ? 'animate-map-blink' : ''}">
              ${!isFullyOperational ? `<span class="animate-ping absolute inline-flex h-5 w-5 rounded-full ${pingColorClass} opacity-75"></span>` : ''}
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 ${colorClass} border border-black shadow-md shadow-black/50"></span>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        // Add details block inside the popup matching styling
        const stationSensors = sensors.filter(s => s.stationId === station.stationId);
        const sensorDetailsHtml = stationSensors.map(s => `
          <div class="flex items-center justify-between text-[11px] font-mono border-b border-zinc-800/50 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
            <span class="text-zinc-400 truncate pr-1.5">${s.sensorType}</span>
            <span class="${
              s.status === 'Active' ? 'text-emerald-400' :
              s.status === 'In Calibration' ? 'text-amber-400' : 'text-red-400'
            } font-semibold">${s.status}</span>
          </div>
        `).join('');

        const marker = L.marker([station.latitude, station.longitude], { 
          icon: markerIcon,
          title: station.stationName
        })
          .addTo(markersGroup)
          .bindPopup(`
            <div class="p-4 text-zinc-300 font-sans min-w-[240px] max-w-[280px]">
              <span class="text-[9px] font-mono tracking-widest text-zinc-500 uppercase block font-bold">AWS TELEMETRY PORTAL</span>
              <h4 class="text-sm font-extrabold text-white mt-1 leading-snug">${station.stationName}</h4>
              <span class="inline-block text-[10px] font-mono text-zinc-400 mt-0.5">${station.region} Region</span>
              
              <div class="my-3.5 p-2 bg-zinc-950 border border-zinc-800 rounded-md">
                <span class="text-[9px] font-mono text-zinc-500 block uppercase tracking-wider mb-1.5 font-bold">Sensors Inventory (${stationSensors.length})</span>
                ${sensorDetailsHtml || '<div class="text-[10px] text-zinc-500 italic">No sensors mounted.</div>'}
              </div>

              <div class="flex items-center justify-between text-[11px] border-t border-zinc-800/60 pt-3">
                <span class="text-zinc-500 font-mono">LAT/LNG:</span>
                <span class="font-mono text-zinc-300">${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}</span>
              </div>

              <button 
                class="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold py-2 px-3 rounded-md transition cursor-pointer flex items-center justify-center space-x-1.5 border border-blue-500/30"
                onclick="window.dispatchEvent(new CustomEvent('map-open-report', { detail: { id: ${station.stationId} } }))"
              >
                <span>Open Station Report</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              </button>
            </div>
          `);
      });
    }

  }, [filteredStations, clusteringEnabled, currentZoom, selectedLayer]);

  // Listener to Zoom into Cluster or Open Report from Leaflet Global Scope Window Dispatchers
  useEffect(() => {
    const handleZoomCluster = (e: any) => {
      const map = mapInstanceRef.current;
      if (!map || !e.detail) return;
      const clampedLat = Math.max(25.8, Math.min(30.7, e.detail.lat));
      const clampedLng = Math.max(80.0, Math.min(88.5, e.detail.lng));
      map.flyTo([clampedLat, clampedLng], 9, { duration: 1.5 });
    };

    const handleOpenReport = (e: any) => {
      if (!e.detail || !e.detail.id) return;
      // Open Station details dossier report in a new tab!
      window.open(`${window.location.origin}${window.location.pathname}?stationId=${e.detail.id}`, '_blank');
    };

    window.addEventListener('map-zoom-cluster', handleZoomCluster);
    window.addEventListener('map-open-report', handleOpenReport);

    return () => {
      window.removeEventListener('map-zoom-cluster', handleZoomCluster);
      window.removeEventListener('map-open-report', handleOpenReport);
    };
  }, []);

  // Helper to trigger locate me
  const handleLocateMe = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.locate({ setView: true, maxZoom: 10 });
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] min-h-[500px] border border-[#1f1f23] rounded-lg overflow-hidden bg-[#0c0c0f]">
      
      {/* Sidebar: Geographic Search, Filters, and Station list */}
      <div className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-[#1f1f23] flex flex-col bg-[#09090b]">
        
        {/* Search header panel */}
        <div className="p-4 border-b border-[#1f1f23] space-y-3 bg-black/10">
          <div className="flex items-center space-x-2">
            <Navigation className="h-4 w-4 text-blue-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Geographic Explorer</h3>
          </div>
          
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by station name, region..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-[#1f1f23] pl-9 pr-4 py-2 text-xs rounded-md text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
            />
          </div>
        </div>

        {/* Filters Panel */}
        <div className="p-4 border-b border-[#1f1f23] grid grid-cols-2 gap-2 bg-black/5">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Region</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full bg-black border border-[#1f1f23] py-1.5 px-2 text-xs rounded-md text-zinc-300 focus:outline-none"
            >
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-black border border-[#1f1f23] py-1.5 px-2 text-xs rounded-md text-zinc-300 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Fully Operational">Fully Operational</option>
              <option value="Partial Maintenance">Partial Maintenance</option>
              <option value="Critical Alert">Critical Alert</option>
              <option value="Inactive / No Sensors">Inactive / No Sensors</option>
            </select>
          </div>
        </div>

        {/* Station List Sidebar */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#1f1f23] max-h-[300px] lg:max-h-none">
          <div className="px-4 py-2 bg-black/10 text-[9px] font-mono text-zinc-500 uppercase tracking-widest flex justify-between">
            <span>STATION LIST ({filteredStations.length})</span>
            <span>ZOOM TO FOCUS</span>
          </div>

          {filteredStations.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">
              No matching stations found in specified search boundary.
            </div>
          ) : (
            filteredStations.map(station => {
              const status = getStationStatus(station.stationId);
              const stationSensors = sensors.filter(s => s.stationId === station.stationId);

              return (
                <div
                  key={station.stationId}
                  onClick={() => handleFocusStation(station)}
                  onMouseEnter={() => setHoveredStationId(station.stationId)}
                  onMouseLeave={() => setHoveredStationId(null)}
                  className={`p-3.5 text-left transition cursor-pointer select-none relative group ${
                    hoveredStationId === station.stationId ? 'bg-white/5' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 truncate">
                      <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition truncate">
                        {station.stationName}
                      </h4>
                      <span className="text-[10px] font-mono text-zinc-400 block">{station.region} Region</span>
                    </div>

                    <span className={`inline-flex items-center h-2.5 w-2.5 rounded-full shrink-0 ${
                      status === 'Fully Operational' ? 'bg-emerald-500' :
                      status === 'Partial Maintenance' ? 'bg-amber-500' :
                      status === 'Critical Alert' ? 'bg-red-500' : 'bg-zinc-500'
                    }`} title={status}></span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-2.5">
                    <span>Sensors: {stationSensors.length}</span>
                    <span>Lat: {station.latitude.toFixed(3)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Interactive Map Stage */}
      <div className="flex-1 relative">
        {/* Leaflet container */}
        <div 
          ref={mapContainerRef} 
          className="h-full w-full z-10" 
          id="leaflet-gis-canvas"
        ></div>

        {/* Floating Custom Map Layers Controls */}
        <div className="absolute top-4 left-4 z-20 flex flex-col sm:flex-row gap-2 bg-zinc-950/80 border border-[#1f1f23] p-1.5 rounded-lg shadow-xl backdrop-blur-md">
          
          {/* Layer Selectors */}
          <div className="flex items-center space-x-1 border-r border-[#1f1f23] pr-2 mr-1">
            <Layers className="h-3.5 w-3.5 text-zinc-400 ml-1" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline ml-1.5">Layer:</span>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setSelectedLayer('dark')}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-md border transition cursor-pointer ${
                selectedLayer === 'dark' 
                  ? 'bg-blue-600 border-blue-500 text-white font-bold' 
                  : 'bg-black border-[#1f1f23] text-zinc-400 hover:text-white'
              }`}
            >
              Dark Matter
            </button>
            <button
              onClick={() => setSelectedLayer('osm')}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-md border transition cursor-pointer ${
                selectedLayer === 'osm' 
                  ? 'bg-blue-600 border-blue-500 text-white font-bold' 
                  : 'bg-black border-[#1f1f23] text-zinc-400 hover:text-white'
              }`}
            >
              Standard OSM
            </button>
            <button
              onClick={() => setSelectedLayer('topo')}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-md border transition cursor-pointer ${
                selectedLayer === 'topo' 
                  ? 'bg-blue-600 border-blue-500 text-white font-bold' 
                  : 'bg-black border-[#1f1f23] text-zinc-400 hover:text-white'
              }`}
            >
              Topographical
            </button>
          </div>
        </div>

        {/* Floating Toggle Controls (Clustering, GPS) */}
        <div className="absolute top-4 right-4 z-20 flex items-center space-x-2 bg-zinc-950/80 border border-[#1f1f23] p-1.5 rounded-lg shadow-xl backdrop-blur-md">
          {/* Clustering Toggle Switch */}
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={clusteringEnabled}
              onChange={() => setClusteringEnabled(!clusteringEnabled)}
              className="sr-only peer"
            />
            <div className="relative w-7 h-4 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
            <span className="text-[10px] font-mono text-zinc-300 uppercase tracking-wider pr-1">Clustering</span>
          </label>

          <span className="h-4 w-[1px] bg-[#1f1f23]"></span>

          {/* Locate me */}
          <button
            onClick={handleLocateMe}
            className="p-1 hover:bg-white/5 text-zinc-400 hover:text-white rounded-md transition cursor-pointer"
            title="Locate my position geographically"
          >
            <Locate className="h-4 w-4" />
          </button>
        </div>

        {/* Floating Map Legend Indicator */}
        <div className="absolute bottom-4 left-4 z-20 bg-zinc-950/85 border border-[#1f1f23] p-3 rounded-lg shadow-2xl backdrop-blur-md max-w-[200px] hidden sm:block">
          <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase block font-bold mb-2">TELEMETRY DIAGRAM</span>
          <div className="space-y-1.5 text-[10px] font-mono">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-xs"></span>
              <span className="text-zinc-400">Fully Operational</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 shadow-xs"></span>
              <span className="text-zinc-400">Partial Maintenance</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-red-500 shadow-xs"></span>
              <span className="text-zinc-400">Critical Out of Service</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-zinc-500 shadow-xs"></span>
              <span className="text-zinc-400">Inactive / No Sensors</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
