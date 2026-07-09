import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Cpu, 
  Building2, 
  Plus, 
  Trash2, 
  Edit, 
  Calendar, 
  MapPin, 
  Compass, 
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  QrCode
} from 'lucide-react';
import { Sensor, WeatherStation } from '../types.ts';
import SensorLabelModal from './SensorLabelModal.tsx';

interface InventoryListProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  onOpenAddStation: () => void;
  onOpenAddSensor: () => void;
  onOpenEditSensor: (sensor: Sensor) => void;
  onOpenLogCalibration: (sensorId: number) => void;
  onDeleteStation: (stationId: number) => void;
  onDeleteSensor: (sensorId: number) => void;
  isAuthenticated: boolean;
  onOpenQRScanner: () => void;
  globalSearchQuery?: string;
  setGlobalSearchQuery?: (q: string) => void;
  activeTabProp?: 'sensors' | 'stations';
  setActiveTabProp?: (tab: 'sensors' | 'stations') => void;
}

export default function InventoryList({
  sensors,
  stations,
  onOpenAddStation,
  onOpenAddSensor,
  onOpenEditSensor,
  onOpenLogCalibration,
  onDeleteStation,
  onDeleteSensor,
  isAuthenticated,
  onOpenQRScanner,
  globalSearchQuery,
  setGlobalSearchQuery,
  activeTabProp,
  setActiveTabProp
}: InventoryListProps) {
  const [localActiveTab, setLocalActiveTab] = useState<'sensors' | 'stations'>('sensors');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localActiveTab;
  const setActiveTab = setActiveTabProp !== undefined ? setActiveTabProp : setLocalActiveTab;
  const [selectedQrSensor, setSelectedQrSensor] = useState<Sensor | null>(null);
  
  // Filter States
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = globalSearchQuery !== undefined ? globalSearchQuery : localSearchQuery;
  const setSearchQuery = setGlobalSearchQuery !== undefined ? setGlobalSearchQuery : setLocalSearchQuery;
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');

  // Extract unique sensor types & offices for filter
  const uniqueTypes = Array.from(new Set(sensors.map(s => s.sensorType)));
  const uniqueOffices = Array.from(new Set(sensors.map(s => s.assignedOffice).filter(Boolean)));

  // Filter Sensors
  const filteredSensors = sensors.filter(sensor => {
    const matchesSearch = 
      sensor.sensorType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sensor.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sensor.serialNumber && sensor.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (sensor.assignedOffice && sensor.assignedOffice.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (sensor.stationName && sensor.stationName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === '' || sensor.status === statusFilter;
    const matchesType = typeFilter === '' || sensor.sensorType === typeFilter;
    const matchesStation = stationFilter === '' || sensor.stationId?.toString() === stationFilter;
    const matchesOffice = officeFilter === '' || sensor.assignedOffice === officeFilter;

    return matchesSearch && matchesStatus && matchesType && matchesStation && matchesOffice;
  });

  // Filter Stations
  const filteredStations = stations.filter(station => {
    const matchesSearch = 
      station.stationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      station.region.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'deployed':
        return { text: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-500' };
      case 'store':
      case 'spare':
        return { text: 'text-blue-400 bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500' };
      case 'in calibration':
      case 'under calibration':
        return { text: 'text-purple-400 bg-purple-500/10 border-purple-500/20', dot: 'bg-purple-500' };
      case 'under repair':
      case 'maintenance':
        return { text: 'text-amber-400 bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-500' };
      case 'retired':
      case 'damaged':
      case 'disposed':
      case 'obsolete':
        return { text: 'text-rose-400 bg-rose-500/10 border-rose-500/20', dot: 'bg-rose-500' };
      default:
        return { text: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20', dot: 'bg-zinc-400' };
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-10 max-w-7xl mx-auto w-full bg-[#050505]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-6 border-b border-[#1f1f23]">
        <div>
          <h2 className="font-serif italic text-2xl md:text-3xl tracking-wide text-white">
            Inventory Master List
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Browse and manage weather stations, catalog physical telemetry components, and schedule diagnostic alignments.
          </p>
          
          {/* Status-wise Sensor Legend / Summary Key */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {Object.entries(
              sensors.reduce((acc, sensor) => {
                const sName = sensor.status || 'Store';
                acc[sName] = (acc[sName] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([statusName, count]) => {
              const styles = getStatusBadgeStyle(statusName);
              return (
                <div 
                  key={statusName} 
                  className={`flex items-center space-x-1.5 px-2.5 py-1 border rounded-md text-[11px] font-medium tracking-wide transition font-mono ${styles.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} animate-pulse`}></span>
                  <span className="text-zinc-400">{statusName}:</span>
                  <span className="font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* QR Code Scanner Trigger Button */}
          <button
            id="inventory-scan-qr-btn"
            onClick={onOpenQRScanner}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
            title="Scan sensor barcode or QR tag"
          >
            <QrCode className="h-3.5 w-3.5 animate-pulse" />
            <span>Scan QR Code</span>
          </button>

          {isAuthenticated && (
            <>
              <button
                id="add-station-catalog-btn"
                onClick={onOpenAddStation}
                className="flex items-center space-x-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Weather Station</span>
              </button>
              <button
                id="add-sensor-catalog-btn"
                onClick={onOpenAddSensor}
                className="flex items-center space-x-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold tracking-wide transition shadow-lg shadow-blue-600/20 border border-blue-500/20 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Catalog New Sensor</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1f1f23] mb-6 gap-6">
        <button
          id="tab-sensors-btn"
          onClick={() => {
            setActiveTab('sensors');
            setSearchQuery('');
          }}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'sensors'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>Sensors Inventory ({sensors.length})</span>
        </button>

        <button
          id="tab-stations-btn"
          onClick={() => {
            setActiveTab('stations');
            setSearchQuery('');
          }}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'stations'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>Weather Stations Depot ({stations.length})</span>
        </button>
      </div>

      {/* Search and Filters panel */}
      <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-5 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Search bar */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              id="inventory-search-input"
              type="text"
              placeholder={activeTab === 'sensors' ? "Search sensors by type, manufacturer, station..." : "Search weather stations by name, region..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131316] border border-[#1f1f23] text-white placeholder-zinc-500 focus:ring-blue-500/10 focus:border-blue-500/40 rounded-md py-2.5 pl-10 pr-4 text-sm focus:outline-none transition"
            />
          </div>

          {/* Quick Stats Summary */}
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono shrink-0 bg-[#131316] border border-[#1f1f23] p-2.5 rounded-md">
            <span>Filtered count:</span>
            <span className="font-bold text-white bg-[#0f0f12] border border-[#1f1f23] rounded px-1.5 py-0.5">
              {activeTab === 'sensors' ? filteredSensors.length : filteredStations.length}
            </span>
          </div>
        </div>

        {/* Advanced Filters (only for Sensors tab) */}
        {activeTab === 'sensors' && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-[#1f1f23]">
            {/* Filter by Type */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Sensor Type</label>
              <select
                id="filter-type-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-[#131316] border border-[#1f1f23] rounded-md py-1.5 px-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="">All Types</option>
                {uniqueTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Filter by Status */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Operational Status</label>
              <select
                id="filter-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-[#131316] border border-[#1f1f23] rounded-md py-1.5 px-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="In Calibration">In Calibration</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Retired">Retired</option>
              </select>
            </div>

            {/* Filter by Weather Station */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Station Assignment</label>
              <select
                id="filter-station-select"
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="w-full bg-[#131316] border border-[#1f1f23] rounded-md py-1.5 px-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="">All Stations</option>
                {stations.map(st => (
                  <option key={st.stationId} value={st.stationId}>{st.stationName}</option>
                ))}
              </select>
            </div>

            {/* Filter by Assigned Office */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Assigned Office</label>
              <select
                id="filter-office-select"
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="w-full bg-[#131316] border border-[#1f1f23] rounded-md py-1.5 px-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="">All Offices</option>
                {uniqueOffices.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Pane */}
      <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md shadow-xs overflow-hidden">
        {activeTab === 'sensors' ? (
          /* SENSORS TABLE CATALOG */
          <div className="overflow-x-auto">
            {filteredSensors.length === 0 ? (
              <div className="p-16 text-center text-zinc-500 font-sans">
                <Cpu className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                <p className="font-serif italic text-sm text-white">No sensors matched your filters.</p>
                <p className="text-xs text-zinc-500 mt-2">Try relaxing search parameters or registering a new sensor asset.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#131316] border-b border-[#1f1f23] text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
                    <th className="py-4 px-6 font-semibold">Sensor ID</th>
                    <th className="py-4 px-6 font-semibold">Sensor Type / Brand</th>
                    <th className="py-4 px-6 font-semibold">Assigned Station</th>
                    <th className="py-4 px-6 font-semibold">Status</th>
                    <th className="py-4 px-6 font-semibold font-mono uppercase tracking-widest text-zinc-500 text-[10px]">Calibration Cycles</th>
                    <th className="py-4 px-6 font-semibold text-right font-mono uppercase tracking-widest text-zinc-500 text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f23]">
                  {filteredSensors.map(sensor => (
                    <tr key={sensor.sensorId} className="hover:bg-white/[0.01] transition text-sm text-zinc-300">
                      {/* ID */}
                      <td className="py-4.5 px-6 font-mono text-xs font-semibold text-zinc-500">
                        SEN-{sensor.sensorId.toString().padStart(4, '0')}
                      </td>
                      
                      {/* Type & Brand */}
                      <td className="py-4.5 px-6">
                        <span className="font-sans font-semibold text-white block">{sensor.sensorType}</span>
                        <span className="text-xs text-zinc-500 block font-mono">{sensor.manufacturer}</span>
                      </td>

                      {/* Station */}
                      <td className="py-4.5 px-6">
                        {sensor.stationId ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-zinc-300">{sensor.stationName}</span>
                            <span className="text-[11px] text-zinc-500 font-mono">Region: {sensor.region}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-600 italic text-xs font-mono">Unassigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4.5 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border inline-block ${
                          sensor.status === "Active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          sensor.status === "In Calibration" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          sensor.status === "Maintenance" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          "bg-[#131316] text-zinc-400 border border-[#1f1f23]"
                        }`}>
                          {sensor.status}
                        </span>
                      </td>

                      {/* Calibration Cycle */}
                      <td className="py-4.5 px-6">
                        {sensor.lastCalibration ? (
                          <div className="flex flex-col text-xs font-mono">
                            <span className="text-zinc-400">Last: {sensor.lastCalibration.calibrationDate}</span>
                            <span className={`font-semibold mt-0.5 ${
                              new Date(sensor.lastCalibration.nextDueDate) < new Date() 
                                ? 'text-red-400' 
                                : 'text-zinc-500'
                            }`}>
                              Next: {sensor.lastCalibration.nextDueDate}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-500 italic text-xs font-mono flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                            Never Calibrated
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4.5 px-6 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            id={`sensor-qr-${sensor.sensorId}`}
                            onClick={() => setSelectedQrSensor(sensor)}
                            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-md transition cursor-pointer"
                            title="Generate Printable Asset Label"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                          {isAuthenticated && (
                            <>
                              <button
                                id={`sensor-calibrate-${sensor.sensorId}`}
                                onClick={() => onOpenLogCalibration(sensor.sensorId)}
                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition cursor-pointer"
                                title="Record Calibration Log"
                              >
                                <Calendar className="h-4 w-4" />
                              </button>
                              <button
                                id={`sensor-edit-${sensor.sensorId}`}
                                onClick={() => onOpenEditSensor(sensor)}
                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition cursor-pointer"
                                title="Edit Sensor"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                id={`sensor-delete-${sensor.sensorId}`}
                                onClick={() => {
                                  if (confirm(`Are you sure you want to retire and catalog out sensor SEN-${sensor.sensorId.toString().padStart(4, '0')}?`)) {
                                    onDeleteSensor(sensor.sensorId);
                                  }
                                }}
                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition cursor-pointer"
                                title="Retire Asset"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* WEATHER STATIONS TABLE CATALOG */
          <div className="overflow-x-auto">
            {filteredStations.length === 0 ? (
              <div className="p-16 text-center text-zinc-500 font-sans">
                <Building2 className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                <p className="font-serif italic text-sm text-white">No weather stations found.</p>
                <p className="text-xs text-zinc-500 mt-2">Catalog a weather depot station to link operational sensor grids.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#131316] border-b border-[#1f1f23] text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
                    <th className="py-4 px-6 font-semibold">Station ID</th>
                    <th className="py-4 px-6 font-semibold">Station Name</th>
                    <th className="py-4 px-6 font-semibold">Region</th>
                    <th className="py-4 px-6 font-semibold">Coordinates (Lat / Lon)</th>
                    <th className="py-4 px-6 font-semibold">Asset Inventory count</th>
                    {isAuthenticated && <th className="py-4 px-6 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f23]">
                  {filteredStations.map(station => (
                    <tr key={station.stationId} className="hover:bg-white/[0.01] transition text-sm text-zinc-300">
                      {/* ID */}
                      <td className="py-4.5 px-6 font-mono text-xs font-semibold text-zinc-500">
                        DEP-{station.stationId.toString().padStart(3, '0')}
                      </td>
                      
                      {/* Name */}
                      <td className="py-4.5 px-6">
                        <span className="font-sans font-semibold text-white flex items-center gap-1.5">
                          {station.stationName}
                        </span>
                      </td>

                      {/* Region */}
                      <td className="py-4.5 px-6 font-medium text-zinc-400">
                        {station.region}
                      </td>

                      {/* Coordinates */}
                      <td className="py-4.5 px-6 font-mono text-xs text-zinc-500">
                        <span>Lat: {station.latitude.toFixed(4)}°</span>
                        <span className="mx-2 text-zinc-700">|</span>
                        <span>Lon: {station.longitude.toFixed(4)}°</span>
                      </td>

                      {/* Sensor count */}
                      <td className="py-4.5 px-6">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 bg-[#131316] border border-[#1f1f23] rounded-md font-mono text-xs font-semibold text-zinc-300">
                            {station.sensorCount ?? 0} Sensors
                          </span>
                          <span className="text-xs text-emerald-400 font-mono">({station.activeCount ?? 0} Active)</span>
                        </div>
                      </td>

                      {/* Actions */}
                      {isAuthenticated && (
                        <td className="py-4.5 px-6 text-right">
                          <button
                            id={`station-delete-${station.stationId}`}
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete station "${station.stationName}"? Relational sensor coordinates will be unlinked.`)) {
                                onDeleteStation(station.stationId);
                              }
                            }}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition cursor-pointer inline-flex items-center"
                            title="Delete Station"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      {selectedQrSensor && (
        <SensorLabelModal
          sensor={selectedQrSensor}
          onClose={() => setSelectedQrSensor(null)}
        />
      )}
    </div>
  );
}
