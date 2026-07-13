import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  Cpu, 
  Battery, 
  Layers, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  Sliders,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Settings,
  Plus,
  Clock,
  Wrench,
  FileText,
  Calendar,
  Activity,
  Mail,
  Phone,
  Globe,
  Building
} from 'lucide-react';
import { WeatherStation, Sensor } from '../types.ts';

interface StationsModuleProps {
  stations: WeatherStation[];
  sensors: Sensor[];
  token: string | null;
  role: string | null;
  onRefreshData: () => void;
  onOpenAddStation: () => void;
  onOpenEditStation: (station: WeatherStation) => void;
}

export default function StationsModule({
  stations,
  sensors,
  token,
  role,
  onRefreshData,
  onOpenAddStation,
  onOpenEditStation
}: StationsModuleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  const [selectedStationId, setSelectedStationId] = useState<number | null>(
    stations.length > 0 ? stations[0].stationId : null
  );
  const [updatingStationId, setUpdatingStationId] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccessId, setUpdateSuccessId] = useState<number | null>(null);

  // Regional Offices Local States
  const [activeTab, setActiveTab] = useState<'stations' | 'offices'>('stations');
  const [offices, setOffices] = useState<any[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<any | null>(null);
  const [officeSubTab, setOfficeSubTab] = useState<'sensors' | 'stations'>('sensors');

  // Form states - Add Regional Office
  const [showAddOfficeModal, setShowAddOfficeModal] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newOfficeAddress, setNewOfficeAddress] = useState('');
  const [newOfficePhone, setNewOfficePhone] = useState('');
  const [newOfficeEmail, setNewOfficeEmail] = useState('');
  const [newOfficeWebsite, setNewOfficeWebsite] = useState('');
  const [officeError, setOfficeError] = useState<string | null>(null);
  const [officeSuccess, setOfficeSuccess] = useState<string | null>(null);

  const fetchOffices = async () => {
    setLoadingOffices(true);
    try {
      const res = await fetch('/api/regional-offices', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setOffices(data);
      }
    } catch (err) {
      console.error("Failed to load regional offices:", err);
    } finally {
      setLoadingOffices(false);
    }
  };

  useEffect(() => {
    fetchOffices();
  }, [token]);

  const handleAddOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!newOfficeName.trim()) {
      setOfficeError("Office name is required.");
      return;
    }

    setOfficeError(null);
    setOfficeSuccess(null);

    try {
      const res = await fetch('/api/regional-offices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          officeName: newOfficeName.trim(),
          address: newOfficeAddress.trim(),
          phone: newOfficePhone.trim(),
          email: newOfficeEmail.trim(),
          website: newOfficeWebsite.trim()
        })
      });

      if (res.ok) {
        setOfficeSuccess("Regional office added successfully!");
        setNewOfficeName('');
        setNewOfficeAddress('');
        setNewOfficePhone('');
        setNewOfficeEmail('');
        setNewOfficeWebsite('');
        setTimeout(() => {
          setShowAddOfficeModal(false);
          setOfficeSuccess(null);
        }, 1200);
        await fetchOffices();
        onRefreshData(); // Propagate to trigger station metadata dropdown refresh
      } else {
        const data = await res.json();
        setOfficeError(data.error || "Failed to register regional office.");
      }
    } catch (err) {
      setOfficeError("Failed to connect to network services.");
    }
  };

  // Activity Timeline Supplementary States
  const [allCalibrations, setAllCalibrations] = useState<any[]>([]);
  const [allDeployments, setAllDeployments] = useState<any[]>([]);
  const [allReplacements, setAllReplacements] = useState<any[]>([]);
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Fetch timeline components from the backend API
  useEffect(() => {
    const fetchTimelineData = async () => {
      setLoadingTimeline(true);
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const fetchDocs = token 
          ? fetch('/api/documents', { headers }).then(r => r.ok ? r.json() : [])
          : Promise.resolve([]);

        const [calRes, depRes, repRes, docData] = await Promise.all([
          fetch('/api/calibrations').then(r => r.ok ? r.json() : []),
          fetch('/api/deployments').then(r => r.ok ? r.json() : []),
          fetch('/api/replacements').then(r => r.ok ? r.json() : []),
          fetchDocs
        ]);

        setAllCalibrations(Array.isArray(calRes) ? calRes : []);
        setAllDeployments(Array.isArray(depRes) ? depRes : []);
        setAllReplacements(Array.isArray(repRes) ? repRes : []);
        setAllDocuments(Array.isArray(docData) ? docData : []);
      } catch (err) {
        console.error("Failed to load station timeline components:", err);
      } finally {
        setLoadingTimeline(false);
      }
    };

    fetchTimelineData();
  }, [token, selectedStationId]);

  // Filter stations
  const filteredStations = stations.filter(station => {
    const matchesSearch = station.stationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          station.region.toLowerCase().includes(searchQuery.toLowerCase());
    
    const type = station.stationType || 'Climate';
    const matchesType = selectedTypeFilter === 'All' || type.toLowerCase() === selectedTypeFilter.toLowerCase();
    
    return matchesSearch && matchesType;
  });

  // Ensure a valid station is selected if current is filtered out or missing
  const activeStation = stations.find(s => s.stationId === selectedStationId) || filteredStations[0] || null;

  // Get sensors linked to active station
  const activeStationSensors = activeStation 
    ? sensors.filter(s => s.stationId === activeStation.stationId)
    : [];

  // Handle station type change
  const handleTypeChange = async (station: WeatherStation, newType: string) => {
    if (!token) {
      setUpdateError("You must sign in to manage station settings.");
      return;
    }
    
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User' && role !== 'Regional Office Admin/User') {
      setUpdateError("Forbidden: You do not have permission to manage weather stations.");
      return;
    }

    setUpdatingStationId(station.stationId);
    setUpdateError(null);
    setUpdateSuccessId(null);

    try {
      const res = await fetch(`/api/stations/${station.stationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          stationName: station.stationName,
          region: station.region,
          latitude: station.latitude,
          longitude: station.longitude,
          batteryVoltageType: station.batteryVoltageType,
          batteryCurrentVoltage: station.batteryCurrentVoltage,
          stationType: newType
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update station type.");
      }

      setUpdateSuccessId(station.stationId);
      setTimeout(() => setUpdateSuccessId(null), 3000);
      onRefreshData(); // refresh parent state to update lists and charts
    } catch (err: any) {
      console.error(err);
      setUpdateError(err.message || "Failed to update station type.");
    } finally {
      setUpdatingStationId(null);
    }
  };

  // Build active station's timeline
  const activeStationTimeline = useMemo(() => {
    if (!activeStation) return [];

    const timeline: any[] = [];

    // 1. Calibrations
    const stationCalibs = allCalibrations.filter(c => {
      const sensor = sensors.find(s => s.sensorId === c.sensorId);
      return sensor && sensor.stationId === activeStation.stationId;
    });
    stationCalibs.forEach(c => {
      const sensor = sensors.find(s => s.sensorId === c.sensorId);
      timeline.push({
        id: `cal-${c.calibrationId}`,
        date: c.calibrationDate || new Date(c.createdAt || '').toISOString().split('T')[0],
        timestamp: c.createdAt ? new Date(c.createdAt).getTime() : new Date(c.calibrationDate).getTime(),
        title: 'Sensor Calibration Logged',
        type: 'calibration',
        badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        iconType: 'calibration',
        description: `Technician ${c.technicianName} performed calibration on sensor: ${sensor?.sensorName || 'Unknown'} (${sensor?.sensorType || 'N/A'}). Result: ${c.result}.`,
        notes: c.notes,
        meta: `Next due: ${c.nextDueDate}`
      });
    });

    // 2. Deployments
    const stationDeps = allDeployments.filter(d => d.stationId === activeStation.stationId);
    stationDeps.forEach(d => {
      const sensor = sensors.find(s => s.sensorId === d.sensorId);
      timeline.push({
        id: `dep-${d.deploymentId}`,
        date: d.deploymentDate || new Date(d.createdAt || '').toISOString().split('T')[0],
        timestamp: d.createdAt ? new Date(d.createdAt).getTime() : new Date(d.deploymentDate).getTime(),
        title: d.status === 'Active' ? 'Telemetry Sensor Deployed' : 'Sensor Retrieved',
        type: 'deployment',
        badgeColor: d.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
        iconType: 'deployment',
        description: `Sensor ${sensor?.sensorName || 'Unknown'} (${sensor?.sensorType || 'N/A'}) was ${d.status === 'Active' ? 'installed' : 'retrieved'} at this station by ${d.personnelInvolved}.`,
        notes: d.installationNotes,
        meta: `Status: ${d.status}`
      });
    });

    // 3. Replacements
    const stationReps = allReplacements.filter(r => r.stationId === activeStation.stationId);
    stationReps.forEach(r => {
      const oldSensor = sensors.find(s => s.sensorId === r.oldSensorId);
      const newSensor = sensors.find(s => s.sensorId === r.newSensorId);
      timeline.push({
        id: `rep-${r.replacementId}`,
        date: r.replacementDate || new Date(r.createdAt || '').toISOString().split('T')[0],
        timestamp: r.createdAt ? new Date(r.createdAt).getTime() : new Date(r.replacementDate).getTime(),
        title: 'Sensor Replaced (Maintenance)',
        type: 'replacement',
        badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        iconType: 'replacement',
        description: `Replaced sensor ${oldSensor?.sensorName || 'Unknown'} (S/N: ${oldSensor?.serialNumber || 'N/A'}) with new sensor ${newSensor?.sensorName || 'Unknown'} (S/N: ${newSensor?.serialNumber || 'N/A'}). Reason: ${r.reason}.`,
        notes: r.notes,
        meta: `Technician: ${r.personnelInvolved}`
      });
    });

    // 4. Documents
    const stationDocs = allDocuments.filter(doc => {
      if (doc.stationId === activeStation.stationId) return true;
      if (doc.sensorModel) {
        return sensors.some(s => {
          if (s.stationId !== activeStation.stationId) return false;
          const modelMatches = (s.modelNumber || 'N/A') === doc.sensorModel;
          if (!modelMatches) return false;
          if (doc.serialNumber) {
            return s.serialNumber === doc.serialNumber;
          }
          return true;
        });
      }
      if (doc.sensorId) {
        const sensor = sensors.find(s => s.sensorId === doc.sensorId);
        return sensor && sensor.stationId === activeStation.stationId;
      }
      return false;
    });
    stationDocs.forEach(doc => {
      let linkedName = '';
      if (doc.sensorModel) {
        linkedName = `for model ${doc.sensorModel}`;
        if (doc.serialNumber) {
          linkedName += ` (S/N: ${doc.serialNumber})`;
        }
      } else if (doc.sensorId) {
        const sensor = sensors.find(s => s.sensorId === doc.sensorId);
        if (sensor) {
          linkedName = `for sensor ${sensor.sensorName || sensor.sensorType}`;
        }
      }
      timeline.push({
        id: `doc-${doc.id}`,
        date: doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : 'N/A',
        timestamp: doc.createdAt ? new Date(doc.createdAt).getTime() : 0,
        title: 'Technical Document Registered',
        type: 'document',
        badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        iconType: 'document',
        description: `Uploaded technical document "${doc.title}" (Category: ${doc.category}) ${linkedName ? `${linkedName}` : 'for this station'}.`,
        notes: `File: ${doc.fileName} (${doc.fileSize || 'Unknown size'})`,
        meta: `Uploaded by: ${doc.uploadedBy ? doc.uploadedBy.split('@')[0] : 'System'}`
      });
    });

    // Sort by timestamp (or date) descending
    return timeline.sort((a, b) => {
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return b.date.localeCompare(a.date);
    });
  }, [activeStation, allCalibrations, allDeployments, allReplacements, allDocuments, sensors]);

  const getStationTypeBadgeClass = (type: string | null | undefined) => {
    const t = (type || 'Climate').toLowerCase();
    switch (t) {
      case 'climate':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'synoptic':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'aero-synoptic':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'agromet':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'precipitation':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const getSensorStatusClass = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'In Calibration':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Maintenance':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Retired':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const getStationStatus = (station: WeatherStation) => {
    const stationSensors = sensors.filter(s => s.stationId === station.stationId);
    
    if (station.batteryCurrentVoltage !== undefined && station.batteryCurrentVoltage !== null) {
      if (station.batteryCurrentVoltage < 11.2) {
        return 'Offline';
      }
      if (station.batteryCurrentVoltage < 11.6) {
        return 'Maintenance';
      }
    }
    
    const hasMaintenance = stationSensors.some(s => s.status === 'Maintenance');
    if (hasMaintenance) {
      return 'Maintenance';
    }

    if (stationSensors.length === 0 || stationSensors.every(s => s.status === 'Retired')) {
      return 'Offline';
    }

    const seed = station.stationId;
    if (seed % 17 === 0) {
      return 'Maintenance';
    }
    if (seed % 23 === 0) {
      return 'Offline';
    }

    return 'Online';
  };

  const getStationStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Online':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Offline':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'Maintenance':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div id="stations-module-container" className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0d0d11] p-6 border border-[#1f1f23] rounded-lg shadow-xl">
        <div className="space-y-1">
          <h2 className="text-xl font-serif italic text-white tracking-wide">Meteorological Stations Network</h2>
          <p className="text-xs text-zinc-500 font-mono">
            Browse global station coordinates, monitor physical telemetric sensor clusters, and configure station profiles.
          </p>
        </div>
        
        {/* Quick Add Button */}
        {(role === 'Super Administrator' || role === 'Head Office Admin/User' || role === 'Regional Office Admin/User') && (
          <button
            id="stations-add-btn"
            onClick={onOpenAddStation}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold transition shadow-lg shadow-blue-600/20 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add New Station
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-[#1f1f23] space-x-6">
        <button
          onClick={() => { setActiveTab('stations'); setSelectedOffice(null); }}
          className={`pb-3 text-xs font-mono tracking-wider uppercase font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'stations' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Stations Directory
        </button>
        <button
          onClick={() => setActiveTab('offices')}
          className={`pb-3 text-xs font-mono tracking-wider uppercase font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'offices' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Regional Offices
        </button>
      </div>

      {/* VIEW 1: STATIONS DIRECTORY */}
      {activeTab === 'stations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Stations Directory (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Stations Directory</h3>
            
            {/* Search and Filters */}
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
                <input
                  id="stations-search-input"
                  type="text"
                  placeholder="Filter stations by name, region..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white placeholder-zinc-600 focus:border-blue-500/50 rounded-md py-2 pl-9 pr-3 text-xs focus:outline-none transition"
                />
              </div>

              {/* Station Type Segment Filter */}
              <div className="flex flex-wrap gap-1 bg-[#131316] p-1 border border-[#1f1f23] rounded-md">
                {['All', 'Climate', 'Synoptic', 'Aero-synoptic', 'Agromet', 'precipitation'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTypeFilter(t)}
                    className={`px-2.5 py-1 text-[10px] rounded font-medium transition cursor-pointer ${
                      selectedTypeFilter === t
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {updateError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-xs text-red-400 flex items-start gap-2 animate-pulse">
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
                <span>{updateError}</span>
              </div>
            )}

            {/* List of Stations */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredStations.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#1f1f23] rounded-md">
                  <Layers className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">No stations match the selected filters.</p>
                </div>
              ) : (
                filteredStations.map((station) => {
                  const isSelected = activeStation?.stationId === station.stationId;
                  const sensorsCount = sensors.filter(s => s.stationId === station.stationId).length;
                  const activeSensorsCount = sensors.filter(s => s.stationId === station.stationId && s.status === 'Active').length;
                  const type = station.stationType || 'Climate';

                  const stationStatus = getStationStatus(station);

                  return (
                    <div
                      key={station.stationId}
                      onClick={() => setSelectedStationId(station.stationId)}
                      className={`p-4 border rounded-md transition duration-200 cursor-pointer ${
                        isSelected 
                          ? 'bg-[#131316] border-zinc-700 shadow-md shadow-zinc-950/40' 
                          : 'bg-[#08080a] border-[#131316] hover:bg-[#0c0c0f] hover:border-[#1f1f23]'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-sans font-medium text-sm text-white hover:text-blue-400 transition">
                            {station.stationName}
                          </h4>
                          <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                            {station.region}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${getStationTypeBadgeClass(type)}`}>
                            {type}
                          </span>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase ${getStationStatusBadgeClass(stationStatus)}`}>
                            {stationStatus}
                          </span>
                        </div>
                      </div>

                      {/* Info bar */}
                      <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-zinc-400 border-t border-[#131316] pt-2">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="h-3 w-3 text-zinc-500" />
                          <span>{sensorsCount} linked ({activeSensorsCount} active)</span>
                        </div>
                        {station.batteryCurrentVoltage !== undefined && station.batteryCurrentVoltage !== null && (
                          <div className="flex items-center gap-1">
                            <Battery className={`h-3 w-3 ${station.batteryCurrentVoltage < 11.5 ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`} />
                            <span>{station.batteryCurrentVoltage.toFixed(1)}V</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Detailed Dossier & Linked Sensors (7 cols) */}
        <div className="lg:col-span-7">
          {activeStation ? (
            <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-6 space-y-6">
              {/* Detailed Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f1f23] pb-6">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-serif italic text-white">{activeStation.stationName}</h3>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getStationTypeBadgeClass(activeStation.stationType)}`}>
                      {activeStation.stationType || 'Climate'}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getStationStatusBadgeClass(getStationStatus(activeStation))}`}>
                      {getStationStatus(activeStation)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-400 font-mono">
                    <MapPin className="h-3.5 w-3.5 text-blue-400" />
                    <span>{activeStation.region}</span>
                    <span className="text-zinc-600">•</span>
                    <span>Lat: {activeStation.latitude.toFixed(4)}</span>
                    <span className="text-zinc-600">•</span>
                    <span>Lon: {activeStation.longitude.toFixed(4)}</span>
                  </div>
                </div>

                {/* Edit Station Button */}
                {(role === 'Super Administrator' || role === 'Head Office Admin/User' || role === 'Regional Office Admin/User') && (
                  <button
                    onClick={() => onOpenEditStation(activeStation)}
                    className="px-3 py-1.5 bg-[#131316] hover:bg-zinc-800 text-zinc-300 hover:text-white border border-[#1f1f23] rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Settings className="h-3.5 w-3.5 text-zinc-500" />
                    Configure Station
                  </button>
                )}
              </div>

              {/* Station Type Configuration Panel */}
              <div className="bg-[#131316] border border-[#1f1f23] rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">Station Type Selection</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Select the physical classification of this meteorological telemetry unit.</p>
                  </div>
                  {updatingStationId === activeStation.stationId && (
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                  )}
                  {updateSuccessId === activeStation.stationId && (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Saved
                    </div>
                  )}
                </div>

                <div className="max-w-xs">
                  <select
                    id="station-type-dropdown"
                    disabled={updatingStationId !== null}
                    value={activeStation.stationType || 'Climate'}
                    onChange={(e) => handleTypeChange(activeStation, e.target.value)}
                    className="w-full bg-[#0a0a0c] border border-[#1f1f23] text-white focus:border-blue-500/50 rounded-md py-2 px-3 text-xs focus:outline-none transition disabled:opacity-50 cursor-pointer font-sans"
                  >
                    <option value="Climate">Climate</option>
                    <option value="Synoptic">Synoptic</option>
                    <option value="Aero-synoptic">Aero-synoptic</option>
                    <option value="Agromet">Agromet</option>
                    <option value="precipitation">precipitation</option>
                  </select>
                </div>
              </div>

              {/* Station Parameters (Battery / Telemetry) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#08080a] border border-[#131316] rounded-md p-4 space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-wider">Power Grid Metrics</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Nominal battery:</span>
                    <span className="text-xs font-mono font-bold text-white">{activeStation.batteryVoltageType || "12V"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Current voltage:</span>
                    <span className={`text-xs font-mono font-bold ${activeStation.batteryCurrentVoltage !== undefined && activeStation.batteryCurrentVoltage !== null && activeStation.batteryCurrentVoltage < 11.5 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {activeStation.batteryCurrentVoltage !== undefined && activeStation.batteryCurrentVoltage !== null ? `${activeStation.batteryCurrentVoltage.toFixed(2)} V` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-[#08080a] border border-[#131316] rounded-md p-4 space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-wider">Coordinates Depot</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Regional sector:</span>
                    <span className="text-xs font-semibold text-white">{activeStation.region}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Registered date:</span>
                    <span className="text-xs font-mono text-zinc-400">{new Date(activeStation.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Related Sensors Section (Linking related sensors) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#1f1f23] pb-3">
                  <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-blue-400" />
                    Linked Telemetry Sensors ({activeStationSensors.length})
                  </h4>
                </div>

                {activeStationSensors.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-[#1f1f23] rounded-md">
                    <Info className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">No sensors currently registered or active at this station.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Deploy sensors via the Sensor Registration or Deployments module.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                    {activeStationSensors.map((sensor) => (
                      <div 
                        key={sensor.sensorId} 
                        className="bg-[#08080a] border border-[#131316] p-4 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-800 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-white">
                              {sensor.sensorName || sensor.sensorType}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              ({sensor.sensorType})
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 flex-wrap">
                            <span>S/N: {sensor.serialNumber || 'N/A'}</span>
                            <span>•</span>
                            <span>Mfg: {sensor.manufacturer}</span>
                            {sensor.procurementDate && (
                              <>
                                <span>•</span>
                                <span>Procured: {sensor.procurementDate}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase ${getSensorStatusClass(sensor.status)}`}>
                            {sensor.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity Timeline Section */}
              <div className="space-y-4 pt-6 border-t border-[#1f1f23]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-400" />
                    Station Activity Timeline ({activeStationTimeline.length})
                  </h4>
                  {loadingTimeline && (
                    <Loader2 className="h-3.5 w-3.5 text-zinc-500 animate-spin" />
                  )}
                </div>

                {activeStationTimeline.length === 0 ? (
                  <div className="p-6 bg-[#08080a] border border-[#131316] rounded-md text-center">
                    <Calendar className="h-6 w-6 text-zinc-700 mx-auto mb-1.5" />
                    <p className="text-xs text-zinc-500 font-medium">No logs, updates, or documents recorded for this weather station.</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5 leading-relaxed">Activities appear automatically as calibrations, deployments, replacements, and documents are registered.</p>
                  </div>
                ) : (
                  <div className="relative pl-6 border-l border-[#1f1f23] space-y-6 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                    {activeStationTimeline.map((item) => {
                      const getTimelineIcon = (iconType: string) => {
                        switch (iconType) {
                          case 'calibration':
                            return <Wrench className="h-3 w-3 text-blue-400" />;
                          case 'deployment':
                            return <Cpu className="h-3 w-3 text-emerald-400" />;
                          case 'replacement':
                            return <Activity className="h-3 w-3 text-amber-400" />;
                          case 'document':
                            return <FileText className="h-3 w-3 text-teal-400" />;
                          default:
                            return <Info className="h-3 w-3 text-zinc-400" />;
                        }
                      };

                      const getTimelineIconBg = (iconType: string) => {
                        switch (iconType) {
                          case 'calibration':
                            return 'bg-blue-950/40 border border-blue-500/20';
                          case 'deployment':
                            return 'bg-emerald-950/40 border border-emerald-500/20';
                          case 'replacement':
                            return 'bg-amber-950/40 border border-amber-500/20';
                          case 'document':
                            return 'bg-teal-950/40 border border-teal-500/20';
                          default:
                            return 'bg-zinc-950/40 border border-zinc-500/20';
                        }
                      };

                      return (
                        <div key={item.id} className="relative group">
                          {/* Left Timeline Dot */}
                          <div className={`absolute -left-[33px] top-0.5 h-5 w-5 rounded-full flex items-center justify-center ${getTimelineIconBg(item.iconType)} shadow-sm`}>
                            {getTimelineIcon(item.iconType)}
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                                {item.title}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-mono ${item.badgeColor}`}>
                                  {item.type}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {item.date}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                              {item.description}
                            </p>

                            {item.notes && (
                              <div className="text-[11px] text-zinc-500 font-mono bg-black/40 border border-[#131316] p-2 rounded-sm mt-1">
                                {item.notes}
                              </div>
                            )}

                            <div className="text-[10px] text-zinc-600 font-mono flex items-center gap-1.5 pt-1">
                              <span>•</span>
                              <span>{item.meta}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-12 text-center">
              <Layers className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-sm text-zinc-400 font-medium">No Station Selected</p>
              <p className="text-xs text-zinc-600 mt-1">Select a weather station from the directory to inspect linked hardware clusters and configuration logs.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* VIEW 2: REGIONAL OFFICES */}
      {activeTab === 'offices' && (
        <div className="space-y-6 animate-fade-in">
          {/* Offices List Panel */}
          <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-serif italic text-white">Regional Offices Network</h3>
                <p className="text-xs text-zinc-500 font-mono mt-1">Manage physical regional headquarters and inspect assigned station/spare parts assets.</p>
              </div>
              <button
                onClick={() => setShowAddOfficeModal(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold transition cursor-pointer shadow-lg shadow-blue-600/10"
              >
                <Plus className="h-4 w-4" />
                <span>Add regional Offices</span>
              </button>
            </div>

            {loadingOffices ? (
              <div className="py-12 flex items-center justify-center space-x-2 text-zinc-500 font-mono text-xs">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span>Polling directories...</span>
              </div>
            ) : offices.length === 0 ? (
              <div className="py-16 text-center bg-[#08080a] border border-[#17171c] rounded-md">
                <Building className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-xs text-zinc-500 font-medium">No regional offices registered in network registry.</p>
                <p className="text-[10px] text-zinc-600 mt-1">Click the "+ Add regional Offices" button to register headquarters.</p>
              </div>
            ) : (
              <div className="border border-[#17171c] rounded-lg overflow-hidden bg-[#09090c]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0c0c0f] border-b border-[#1f1f23] text-[10px] text-zinc-400 font-mono tracking-wider uppercase">
                      <th className="py-3 px-4 font-medium">Office Name</th>
                      <th className="py-3 px-4 font-medium">Address</th>
                      <th className="py-3 px-4 font-medium">Phone number</th>
                      <th className="py-3 px-4 font-medium">Email ID</th>
                      <th className="py-3 px-4 font-medium">website</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#131317] text-xs">
                    {offices.map((o) => (
                      <tr key={o.id} className="hover:bg-white/[0.01] transition-all">
                        {/* Column 1: Clickable Office Name */}
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => {
                              setSelectedOffice(o);
                              setOfficeSubTab('sensors');
                            }}
                            className="font-semibold text-blue-400 hover:text-blue-300 text-left cursor-pointer hover:underline transition-all"
                          >
                            {o.officeName}
                          </button>
                        </td>
                        {/* Column 2: Address */}
                        <td className="py-3.5 px-4 text-zinc-400 font-sans max-w-xs truncate">
                          {o.address || <span className="text-zinc-600 font-mono text-[11px]">-</span>}
                        </td>
                        {/* Column 3: Phone Number */}
                        <td className="py-3.5 px-4 text-zinc-300 font-mono text-[11px]">
                          {o.phone ? (
                            <div className="flex items-center space-x-1">
                              <Phone className="h-3 w-3 text-zinc-500" />
                              <span>{o.phone}</span>
                            </div>
                          ) : (
                            <span className="text-zinc-600 font-mono text-[11px]">-</span>
                          )}
                        </td>
                        {/* Column 4: Email */}
                        <td className="py-3.5 px-4 text-zinc-300 font-mono text-[11px]">
                          {o.email ? (
                            <div className="flex items-center space-x-1">
                              <Mail className="h-3 w-3 text-zinc-500" />
                              <a href={`mailto:${o.email}`} className="hover:underline hover:text-blue-400">{o.email}</a>
                            </div>
                          ) : (
                            <span className="text-zinc-600 font-mono text-[11px]">-</span>
                          )}
                        </td>
                        {/* Column 5: Website */}
                        <td className="py-3.5 px-4 text-zinc-300 font-mono text-[11px]">
                          {o.website ? (
                            <div className="flex items-center space-x-1">
                              <Globe className="h-3 w-3 text-zinc-500" />
                              <a href={o.website.startsWith('http') ? o.website : `https://${o.website}`} target="_blank" rel="noreferrer" className="hover:underline hover:text-blue-400">
                                {o.website}
                              </a>
                            </div>
                          ) : (
                            <span className="text-zinc-600 font-mono text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Drilldown Sub-view for Selected Office */}
          {selectedOffice && (
            <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-6 space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1f1f23] pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] font-mono rounded uppercase font-bold">Office Core</span>
                    <h4 className="text-lg font-serif italic text-white">{selectedOffice.officeName}</h4>
                  </div>
                  <p className="text-xs text-zinc-500 font-sans mt-0.5">{selectedOffice.address || 'No location address recorded.'}</p>
                </div>
                <button
                  onClick={() => setSelectedOffice(null)}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-md text-xs font-mono cursor-pointer transition animate-pulse"
                >
                  Close Office View ×
                </button>
              </div>

              {/* Nested Sub-tabs */}
              <div className="flex space-x-4 border-b border-[#17171c] pb-2">
                <button
                  onClick={() => setOfficeSubTab('sensors')}
                  className={`pb-2 text-[11px] font-mono tracking-wider uppercase font-bold border-b-2 transition-all cursor-pointer ${
                    officeSubTab === 'sensors' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Sensors/Spare Parts
                </button>
                <button
                  onClick={() => setOfficeSubTab('stations')}
                  className={`pb-2 text-[11px] font-mono tracking-wider uppercase font-bold border-b-2 transition-all cursor-pointer ${
                    officeSubTab === 'stations' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Stations
                </button>
              </div>

              {/* Sub-tab 1: Sensors / Spare Parts list */}
              {officeSubTab === 'sensors' && (() => {
                const assignedSensors = sensors.filter(s => s.regionalOfficeId === selectedOffice.id);
                return (
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Assigned Inventory & Spare Parts ({assignedSensors.length})</h5>
                      <p className="text-zinc-500 text-[11px] mt-0.5">Physical telemetry assets assigned to or logged under this regional hub's jurisdiction.</p>
                    </div>

                    {assignedSensors.length === 0 ? (
                      <div className="p-8 bg-[#08080a] border border-[#17171c] rounded-md text-center">
                        <Cpu className="h-8 w-8 text-zinc-800 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500 font-medium">No hardware sensors assigned to this regional office.</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">Sensors with matching user-office attributes are routed here automatically during inventory cataloging.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assignedSensors.map(sensor => (
                          <div key={sensor.sensorId} className="bg-[#08080a] border border-[#131316] p-4 rounded-md flex justify-between items-start hover:border-zinc-800 transition">
                            <div className="space-y-1">
                              <span className="text-xs font-semibold text-white block">
                                {sensor.sensorName || sensor.sensorType}
                              </span>
                              <div className="flex flex-col space-y-1 text-[10px] font-mono text-zinc-500">
                                <span>Type: {sensor.sensorType}</span>
                                <span>S/N: {sensor.serialNumber || 'N/A'}</span>
                                <span>Manufacturer: {sensor.manufacturer}</span>
                                <span>Station: {sensor.stationName ? <span className="text-blue-400">{sensor.stationName}</span> : <span className="text-amber-500/80 font-semibold">[Spare Part / In Storage]</span>}</span>
                              </div>
                            </div>
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded border uppercase shrink-0 bg-zinc-900 text-zinc-300">
                              {sensor.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Sub-tab 2: Stations list */}
              {officeSubTab === 'stations' && (() => {
                const assignedStations = stations.filter(st => st.regionalOfficeId === selectedOffice.id);
                return (
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Assigned Network Stations ({assignedStations.length})</h5>
                      <p className="text-zinc-500 text-[11px] mt-0.5">Active meteorological telemetry nodes directly reporting to this regional office.</p>
                    </div>

                    {assignedStations.length === 0 ? (
                      <div className="p-8 bg-[#08080a] border border-[#17171c] rounded-md text-center">
                        <MapPin className="h-8 w-8 text-zinc-800 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500 font-medium">No weather stations currently assigned to this office.</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">Assign stations directly by editing station profiles or during registration.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assignedStations.map(station => {
                          const stationStatus = getStationStatus(station);
                          return (
                            <div key={station.stationId} className="bg-[#08080a] border border-[#131316] p-4 rounded-md space-y-3 hover:border-zinc-800 transition">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-xs font-semibold text-white block">{station.stationName}</span>
                                  <span className="text-[10px] text-zinc-500 font-mono">{station.region}</span>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase border ${getStationTypeBadgeClass(station.stationType)}`}>
                                    {station.stationType || 'Climate'}
                                  </span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase border ${getStationStatusBadgeClass(stationStatus)}`}>
                                    {stationStatus}
                                  </span>
                                </div>
                              </div>
                              <div className="flex justify-between text-[10px] font-mono text-zinc-500 border-t border-[#131316] pt-2">
                                <span>Lat: {station.latitude}</span>
                                <span>Lon: {station.longitude}</span>
                                <span className="text-blue-400">{station.sensorCount || 0} Sensors</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ADD REGIONAL OFFICE MODAL OVERLAY */}
          {showAddOfficeModal && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-[#09090c] border border-[#1f1f23] rounded-xl max-w-md w-full p-6 shadow-2xl relative space-y-6">
                <div>
                  <h4 className="font-serif text-lg text-white">+ Register Regional Office</h4>
                  <p className="text-xs text-zinc-500 font-mono mt-1">Catalog a new regional administration headquarters within the network grid.</p>
                </div>

                {officeError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg font-sans">
                    {officeError}
                  </div>
                )}
                {officeSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg font-sans">
                    {officeSuccess}
                  </div>
                )}

                <form onSubmit={handleAddOffice} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Office Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Kathmandu AWS Hub"
                      required
                      value={newOfficeName}
                      onChange={(e) => setNewOfficeName(e.target.value)}
                      className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Office Address</label>
                    <input
                      type="text"
                      placeholder="e.g. Babarmahal, Kathmandu"
                      value={newOfficeAddress}
                      onChange={(e) => setNewOfficeAddress(e.target.value)}
                      className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +977 1-421570"
                      value={newOfficePhone}
                      onChange={(e) => setNewOfficePhone(e.target.value)}
                      className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-zinc-400 font-medium">Email ID</label>
                      <input
                        type="email"
                        placeholder="e.g. contact@dhm.gov.np"
                        value={newOfficeEmail}
                        onChange={(e) => setNewOfficeEmail(e.target.value)}
                        className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-none focus:border-blue-500 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-zinc-400 font-medium">Website URL</label>
                      <input
                        type="text"
                        placeholder="e.g. dhm.gov.np"
                        value={newOfficeWebsite}
                        onChange={(e) => setNewOfficeWebsite(e.target.value)}
                        className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-none focus:border-blue-500 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-[#1f1f23] mt-6">
                    <button
                      type="button"
                      onClick={() => setShowAddOfficeModal(false)}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-md font-semibold cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold cursor-pointer transition shadow-lg shadow-blue-600/20"
                    >
                      Register Office
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
