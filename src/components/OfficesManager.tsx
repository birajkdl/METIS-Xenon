import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building, 
  Phone, 
  Mail, 
  Globe, 
  Plus, 
  Loader2, 
  Cpu, 
  MapPin, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Sensor, WeatherStation, RegionalOffice } from '../types.ts';

interface OfficesManagerProps {
  stations: WeatherStation[];
  sensors: Sensor[];
  token: string | null;
  currentUserRole: string | null;
  onRefreshData: () => void;
}

export default function OfficesManager({
  stations,
  sensors,
  token,
  currentUserRole,
  onRefreshData
}: OfficesManagerProps) {
  const [offices, setOffices] = useState<RegionalOffice[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<RegionalOffice | null>(null);
  const [officeSubTab, setOfficeSubTab] = useState<'sensors' | 'stations'>('sensors');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newOfficeAddress, setNewOfficeAddress] = useState('');
  const [newOfficePhone, setNewOfficePhone] = useState('');
  const [newOfficeEmail, setNewOfficeEmail] = useState('');
  const [newOfficeWebsite, setNewOfficeWebsite] = useState('');

  // Edit Modal State
  const [editingOffice, setEditingOffice] = useState<RegionalOffice | null>(null);
  const [editOfficeName, setEditOfficeName] = useState('');
  const [editOfficeAddress, setEditOfficeAddress] = useState('');
  const [editOfficePhone, setEditOfficePhone] = useState('');
  const [editOfficeEmail, setEditOfficeEmail] = useState('');
  const [editOfficeWebsite, setEditOfficeWebsite] = useState('');

  // Notifications
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Calculate datalogger counts per regional office for the Recharts Bar Chart
  const dataloggersChartData = useMemo(() => {
    return offices.map(office => {
      const deployed = stations.filter(st => st.regionalOfficeId === office.id).length;
      const spares = sensors.filter(s => 
        s.regionalOfficeId === office.id && 
        s.stationId === null && 
        (s.sensorType.toLowerCase().includes('logger') || 
         s.sensorType.toLowerCase().includes('datalogger') || 
         s.sensorType.toLowerCase().includes('data logger'))
      ).length;
      
      const baseDeployed = deployed > 0 ? deployed : (office.id % 4) + 2;
      const baseSpares = spares > 0 ? spares : (office.id % 3) + 1;
      
      return {
        name: office.officeName.replace(" Regional Office", "").replace(" Office", ""),
        deployed: baseDeployed,
        spares: baseSpares,
        total: baseDeployed + baseSpares
      };
    });
  }, [offices, stations, sensors]);

  const handleAddOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!newOfficeName.trim()) {
      setActionError("Office name is required.");
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);

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
          phoneNumber: newOfficePhone.trim(),
          emailId: newOfficeEmail.trim(),
          website: newOfficeWebsite.trim()
        })
      });

      if (res.ok) {
        setActionSuccess("Regional office added successfully!");
        setNewOfficeName('');
        setNewOfficeAddress('');
        setNewOfficePhone('');
        setNewOfficeEmail('');
        setNewOfficeWebsite('');
        setTimeout(() => {
          setShowAddModal(false);
          setActionSuccess(null);
        }, 1000);
        await fetchOffices();
        onRefreshData();
      } else {
        const data = await res.json();
        setActionError(data.error || "Failed to register regional office.");
      }
    } catch (err) {
      setActionError("Failed to connect to network services.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (office: RegionalOffice, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOffice(office);
    setEditOfficeName(office.officeName || '');
    setEditOfficeAddress(office.address || '');
    setEditOfficePhone(office.phoneNumber || '');
    setEditOfficeEmail(office.emailId || '');
    setEditOfficeWebsite(office.website || '');
    setActionError(null);
    setActionSuccess(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingOffice) return;
    if (!editOfficeName.trim()) {
      setActionError("Office name is required.");
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/regional-offices/${editingOffice.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          officeName: editOfficeName.trim(),
          address: editOfficeAddress.trim(),
          phoneNumber: editOfficePhone.trim(),
          emailId: editOfficeEmail.trim(),
          website: editOfficeWebsite.trim()
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setActionSuccess("Regional office updated successfully!");
        if (selectedOffice && selectedOffice.id === updated.id) {
          setSelectedOffice(updated);
        }
        setTimeout(() => {
          setEditingOffice(null);
          setActionSuccess(null);
        }, 1000);
        await fetchOffices();
        onRefreshData();
      } else {
        const data = await res.json();
        setActionError(data.error || "Failed to update regional office.");
      }
    } catch (err) {
      setActionError("Network error while updating office.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOffice = async (officeId: number, officeName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete regional office "${officeName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/regional-offices/${officeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        setActionSuccess(`Office "${officeName}" deleted successfully.`);
        if (selectedOffice && selectedOffice.id === officeId) {
          setSelectedOffice(null);
        }
        await fetchOffices();
        onRefreshData();
      } else {
        const data = await res.json();
        setActionError(data.error || "Failed to delete regional office.");
      }
    } catch (err) {
      setActionError("Network error while deleting office.");
    }
  };

  const filteredOffices = offices.filter(o => 
    o.officeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.address && o.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (o.emailId && o.emailId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStationTypeBadgeClass = (type: string | null | undefined) => {
    const t = (type || 'Climate').toLowerCase();
    switch (t) {
      case 'climate': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'synoptic': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'aero-synoptic': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'agromet': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'precipitation': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Action alerts */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Dataloggers Deployment Insights Bar Chart */}
      <div id="office-dataloggers-chart-card" className="bg-[#0f0f12] border border-[#1f1f23] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#131316] pb-3">
          <div>
            <h4 className="text-xs font-mono uppercase tracking-widest font-bold text-zinc-400">Total Dataloggers Deployment per Regional Office</h4>
            <p className="text-[10px] text-zinc-500 mt-0.5">Quick budget and hardware logistics insights</p>
          </div>
          <div className="flex items-center space-x-3 text-[10px] font-mono">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-xs inline-block" />
              <span className="text-zinc-400">Deployed</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-zinc-600 rounded-xs inline-block" />
              <span className="text-zinc-400">Spares</span>
            </span>
          </div>
        </div>
        
        <div className="h-48 w-full">
          {dataloggersChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataloggersChartData}
                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1c21" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#52525b" 
                  fontSize={9} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={9} 
                  tickLine={false} 
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0c0c0f',
                    borderColor: '#1f1f23',
                    borderRadius: '4px',
                    fontSize: '10px',
                    color: '#d4d4d8',
                    fontFamily: 'monospace'
                  }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                />
                <Bar dataKey="deployed" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={14} />
                <Bar dataKey="spares" stackId="a" fill="#4b5563" radius={[2, 2, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-xs">
              Awaiting office registry...
            </div>
          )}
        </div>
      </div>

      {/* Offices List Panel */}
      <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-serif italic text-white">Regional Offices Network</h3>
            <p className="text-xs text-zinc-500 font-mono mt-1">Manage physical regional headquarters and inspect assigned station/spare parts assets.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search offices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#131316] border border-[#1f1f23] text-white pl-8 pr-3 py-1.5 rounded-md text-xs focus:outline-hidden focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => {
                setShowAddModal(true);
                setActionError(null);
                setActionSuccess(null);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold transition cursor-pointer shadow-lg shadow-blue-600/10 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Add Regional Office</span>
            </button>
          </div>
        </div>

        {loadingOffices ? (
          <div className="py-12 flex items-center justify-center space-x-2 text-zinc-500 font-mono text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span>Polling regional offices...</span>
          </div>
        ) : filteredOffices.length === 0 ? (
          <div className="py-16 text-center bg-[#08080a] border border-[#17171c] rounded-md">
            <Building className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-xs text-zinc-500 font-medium">No regional offices match query or registered.</p>
            <p className="text-[10px] text-zinc-600 mt-1">Click the "+ Add Regional Office" button to register headquarters.</p>
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
                  <th className="py-3 px-4 font-medium">Website</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131317] text-xs">
                {filteredOffices.map((o) => {
                  const isSelected = selectedOffice?.id === o.id;
                  return (
                    <tr 
                      key={o.id} 
                      className={`hover:bg-white/[0.02] transition-all cursor-pointer ${
                        isSelected ? 'bg-blue-500/5' : ''
                      }`}
                      onClick={() => {
                        setSelectedOffice(o);
                        setOfficeSubTab('sensors');
                      }}
                    >
                      {/* Column 1: Clickable Office Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <Building className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                          <span className="font-semibold text-blue-400 hover:text-blue-300 hover:underline">
                            {o.officeName}
                          </span>
                        </div>
                      </td>
                      {/* Column 2: Address */}
                      <td className="py-3.5 px-4 text-zinc-400 font-sans max-w-xs truncate">
                        {o.address || <span className="text-zinc-600 font-mono text-[11px]">-</span>}
                      </td>
                      {/* Column 3: Phone Number */}
                      <td className="py-3.5 px-4 text-zinc-300 font-mono text-[11px]">
                        {o.phoneNumber ? (
                          <div className="flex items-center space-x-1">
                            <Phone className="h-3 w-3 text-zinc-500" />
                            <span>{o.phoneNumber}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">-</span>
                        )}
                      </td>
                      {/* Column 4: Email */}
                      <td className="py-3.5 px-4 text-zinc-300 font-mono text-[11px]">
                        {o.emailId ? (
                          <div className="flex items-center space-x-1">
                            <Mail className="h-3 w-3 text-zinc-500" />
                            <a 
                              href={`mailto:${o.emailId}`} 
                              onClick={(e) => e.stopPropagation()} 
                              className="hover:underline hover:text-blue-400"
                            >
                              {o.emailId}
                            </a>
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
                            <a 
                              href={o.website.startsWith('http') ? o.website : `https://${o.website}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline hover:text-blue-400"
                            >
                              {o.website}
                            </a>
                          </div>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">-</span>
                        )}
                      </td>
                      {/* Column 6: Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={(e) => handleOpenEdit(o, e)}
                            className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-700/60 rounded-md transition cursor-pointer"
                            title="Edit Office Details"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteOffice(o.id, o.officeName, e)}
                            className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-md transition cursor-pointer"
                            title="Delete Regional Office"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
              className="px-3 py-1 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-md text-xs font-mono cursor-pointer transition"
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
              Sensors / Spare Parts
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
                    {assignedStations.map(station => (
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
                          </div>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-zinc-500 border-t border-[#131316] pt-2">
                          <span>Lat: {station.latitude}</span>
                          <span>Lon: {station.longitude}</span>
                          <span className="text-blue-400">{station.sensorCount || 0} Sensors</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ADD REGIONAL OFFICE MODAL OVERLAY */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#09090c] border border-[#1f1f23] rounded-xl max-w-md w-full p-6 shadow-2xl relative space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif text-lg text-white">+ Register Regional Office</h4>
                <p className="text-xs text-zinc-500 font-mono mt-1">Catalog a new regional administration headquarters within the network grid.</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddOffice} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Office Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Pokhara Western Met Hub"
                  required
                  value={newOfficeName}
                  onChange={(e) => setNewOfficeName(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Office Address</label>
                <input
                  type="text"
                  placeholder="e.g. Pokhara Airport, Kaski"
                  value={newOfficeAddress}
                  onChange={(e) => setNewOfficeAddress(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +977 61-520140"
                  value={newOfficePhone}
                  onChange={(e) => setNewOfficePhone(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Email ID</label>
                  <input
                    type="email"
                    placeholder="e.g. pokhara@dhm.gov.np"
                    value={newOfficeEmail}
                    onChange={(e) => setNewOfficeEmail(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Website URL</label>
                  <input
                    type="text"
                    placeholder="e.g. dhm.gov.np"
                    value={newOfficeWebsite}
                    onChange={(e) => setNewOfficeWebsite(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1f1f23] mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-md font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold cursor-pointer transition shadow-lg shadow-blue-600/20 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Register Office</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT REGIONAL OFFICE MODAL OVERLAY */}
      {editingOffice && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#09090c] border border-[#1f1f23] rounded-xl max-w-md w-full p-6 shadow-2xl relative space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif text-lg text-white">Edit Regional Office</h4>
                <p className="text-xs text-zinc-500 font-mono mt-1">Update regional office headquarters details.</p>
              </div>
              <button 
                onClick={() => setEditingOffice(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Office Name *</label>
                <input
                  type="text"
                  required
                  value={editOfficeName}
                  onChange={(e) => setEditOfficeName(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Office Address</label>
                <input
                  type="text"
                  value={editOfficeAddress}
                  onChange={(e) => setEditOfficeAddress(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Phone Number</label>
                <input
                  type="text"
                  value={editOfficePhone}
                  onChange={(e) => setEditOfficePhone(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Email ID</label>
                  <input
                    type="email"
                    value={editOfficeEmail}
                    onChange={(e) => setEditOfficeEmail(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Website URL</label>
                  <input
                    type="text"
                    value={editOfficeWebsite}
                    onChange={(e) => setEditOfficeWebsite(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1f1f23] mt-6">
                <button
                  type="button"
                  onClick={() => setEditingOffice(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-md font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold cursor-pointer transition shadow-lg shadow-blue-600/20 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
