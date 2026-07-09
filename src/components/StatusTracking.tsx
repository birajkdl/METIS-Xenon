import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Plus, 
  Settings, 
  Tag, 
  Layers, 
  RefreshCw, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Flame, 
  Boxes, 
  CheckSquare, 
  Truck, 
  Wrench, 
  Trash, 
  HeartCrack, 
  User, 
  Calendar, 
  X,
  FileCheck2,
  FolderHeart,
  Palette
} from 'lucide-react';
import { Sensor, CustomStatus, WeatherStation } from '../types.ts';

interface StatusTrackingProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  isAuthenticated: boolean;
  onUpdateSensor: (sensorId: number, sensorData: any) => Promise<void>;
  onRefresh: () => void;
  token: string | null;
}

export default function StatusTracking({
  sensors,
  stations,
  isAuthenticated,
  onUpdateSensor,
  onRefresh,
  token
}: StatusTrackingProps) {
  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [selectedStatusName, setSelectedStatusName] = useState<string | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  
  // Status Creation Form State
  const [statusName, setStatusName] = useState('');
  const [statusColor, setStatusColor] = useState('#3b82f6');
  const [statusDesc, setStatusDesc] = useState('');
  const [isConsumableOnly, setIsConsumableOnly] = useState(false);

  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [statusErrorMsg, setStatusErrorMsg] = useState<string | null>(null);
  const [statusSuccessMsg, setStatusSuccessMsg] = useState<string | null>(null);

  // Quick Sensor Status Edit State
  const [editingSensor, setEditingSensor] = useState<Sensor | null>(null);
  const [newSensorStatus, setNewSensorStatus] = useState('');
  const [newSensorStationId, setNewSensorStationId] = useState<string>('');
  const [newSensorRemarks, setNewSensorRemarks] = useState('');
  const [isUpdatingSensor, setIsUpdatingSensor] = useState(false);

  const [filterConsumable, setFilterConsumable] = useState<'all' | 'consumable' | 'non-consumable'>('all');

  // Load Custom Statuses from DB
  const fetchStatuses = async () => {
    try {
      const res = await fetch('/api/statuses');
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
      }
    } catch (err) {
      console.error("Failed to load statuses", err);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  // Preset Colors for Quick Swatch Selection
  const colorSwatches = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#eab308', // Yellow
    '#f97316', // Orange
    '#ef4444', // Red
    '#a855f7', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#6366f1', // Indigo
    '#6b7280', // Gray
    '#1e293b', // Slate
  ];

  // Map of Icons based on Status Name
  const getStatusIcon = (name: string, color: string) => {
    const n = name.toLowerCase();
    if (n.includes('store')) return <Boxes className="h-4 w-4" style={{ color }} />;
    if (n.includes('ordered')) return <Truck className="h-4 w-4" style={{ color }} />;
    if (n.includes('spare')) return <CheckSquare className="h-4 w-4" style={{ color }} />;
    if (n.includes('deployed')) return <Activity className="h-4 w-4" style={{ color }} />;
    if (n.includes('transfer')) return <RefreshCw className="h-4 w-4" style={{ color }} />;
    if (n.includes('calibration')) return <FileCheck2 className="h-4 w-4" style={{ color }} />;
    if (n.includes('repair')) return <Wrench className="h-4 w-4" style={{ color }} />;
    if (n.includes('damaged')) return <HeartCrack className="h-4 w-4" style={{ color }} />;
    if (n.includes('obsolete')) return <Flame className="h-4 w-4" style={{ color }} />;
    if (n.includes('disposed') || n.includes('retire')) return <Trash className="h-4 w-4" style={{ color }} />;
    if (n.includes('consumed')) return <FolderHeart className="h-4 w-4" style={{ color }} />;
    return <Tag className="h-4 w-4" style={{ color }} />;
  };

  // Create or Update Custom Status
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !token) {
      setStatusErrorMsg("Unlock admin controls to manage statuses.");
      return;
    }
    if (!statusName.trim()) {
      setStatusErrorMsg("Status name is required.");
      return;
    }

    setIsSubmittingStatus(true);
    setStatusErrorMsg(null);
    setStatusSuccessMsg(null);

    const payload = {
      statusName: statusName.trim(),
      color: statusColor,
      description: statusDesc.trim() || null,
      isConsumableOnly: isConsumableOnly ? 'true' : 'false'
    };

    try {
      let res;
      if (editingStatusId) {
        res = await fetch(`/api/statuses/${editingStatusId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/statuses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setStatusSuccessMsg(editingStatusId ? "Status updated successfully!" : "Status registered successfully!");
        setStatusName('');
        setStatusDesc('');
        setIsConsumableOnly(false);
        setEditingStatusId(null);
        await fetchStatuses();
        onRefresh();
        setTimeout(() => setStatusSuccessMsg(null), 1500);
      } else {
        const err = await res.json();
        setStatusErrorMsg(err.error || "Failed to commit status changes.");
      }
    } catch (err: any) {
      setStatusErrorMsg(err.message || "Network error occurred.");
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Edit status load
  const handleEditStatusSetup = (status: CustomStatus) => {
    setEditingStatusId(status.id);
    setStatusName(status.statusName);
    setStatusColor(status.color);
    setStatusDesc(status.description || '');
    setIsConsumableOnly(status.isConsumableOnly === 'true');
    setStatusErrorMsg(null);
    setStatusSuccessMsg(null);
  };

  // Delete custom status
  const handleDeleteStatus = async (status: CustomStatus) => {
    if (!isAuthenticated || !token) return;
    const coreStatuses = ['Store', 'Ordered', 'Spare', 'Deployed', 'Transferred', 'Under Calibration', 'Under Repair', 'Damaged', 'Obsolete', 'Disposed', 'Consumed'];
    if (coreStatuses.includes(status.statusName)) {
      alert("Cannot delete pre-seeded core meteorological statuses.");
      return;
    }

    if (confirm(`Are you sure you want to delete the "${status.statusName}" status option?`)) {
      try {
        const res = await fetch(`/api/statuses/${status.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          await fetchStatuses();
          onRefresh();
        } else {
          const err = await res.json();
          alert(err.error || "Failed to delete status.");
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Setup Sensor Status change
  const handleSensorStatusSetup = (sensor: Sensor) => {
    setEditingSensor(sensor);
    setNewSensorStatus(sensor.status);
    setNewSensorStationId(sensor.stationId ? sensor.stationId.toString() : '');
    setNewSensorRemarks(sensor.remarks || '');
  };

  // Submit Quick Status Update for Sensor
  const handleSensorStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSensor || !isAuthenticated) return;

    setIsUpdatingSensor(true);
    try {
      const payload = {
        ...editingSensor,
        status: newSensorStatus,
        stationId: newSensorStationId ? parseInt(newSensorStationId) : null,
        remarks: newSensorRemarks.trim() || editingSensor.remarks
      };

      await onUpdateSensor(editingSensor.sensorId, payload);
      setEditingSensor(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update sensor status.");
    } finally {
      setIsUpdatingSensor(false);
    }
  };

  // Categorize sensors based on current status list
  const statusCounts = statuses.reduce((acc, status) => {
    const matchingSensors = sensors.filter(s => s.status === status.statusName);
    acc[status.statusName] = matchingSensors.length;
    return acc;
  }, {} as Record<string, number>);

  // Determine if a status is consumable only
  const isConsumableStatus = (statusName: string) => {
    const status = statuses.find(s => s.statusName === statusName);
    return status?.isConsumableOnly === 'true';
  };

  // Filter list of sensors based on status tab and consumable selection
  const filteredSensors = sensors.filter(sensor => {
    if (selectedStatusName && sensor.status !== selectedStatusName) return false;
    
    const consumable = isConsumableStatus(sensor.status);
    if (filterConsumable === 'consumable') return consumable;
    if (filterConsumable === 'non-consumable') return !consumable;
    
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto p-10 max-w-7xl mx-auto w-full bg-[#050505] text-[#e4e4e7]">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-[#1f1f23]">
        <div>
          <div className="flex items-center space-x-2.5">
            <Activity className="h-6 w-6 text-emerald-500" />
            <h2 className="font-serif italic text-2xl md:text-3xl tracking-wide text-white">
              Sensor Status Tracking Module
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Real-time status updates, inventory counts, and configurable state transition matrices.
          </p>
        </div>

        <button
          id="toggle-config-btn"
          onClick={() => {
            setIsConfiguring(!isConfiguring);
            // Clear any forms
            setEditingStatusId(null);
            setStatusName('');
            setStatusDesc('');
          }}
          className="flex items-center space-x-2 px-4 py-2.5 bg-[#0f0f12] hover:bg-white/5 text-zinc-300 border border-[#1f1f23] rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
        >
          <Settings className={`h-4 w-4 ${isConfiguring ? 'rotate-90 text-blue-500' : ''} transition-transform duration-300`} />
          <span>{isConfiguring ? 'Manage Inventory Board' : 'Configure Custom Statuses'}</span>
        </button>
      </div>

      {isConfiguring ? (
        /* Statuses Configuration Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left panel: Registered Statuses (7 columns) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-mono">
                System Status Dictionary ({statuses.length})
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">Core statuses cannot be deleted</span>
            </div>

            <div className="space-y-3">
              {statuses.map(st => {
                const isCore = ['Store', 'Ordered', 'Spare', 'Deployed', 'Transferred', 'Under Calibration', 'Under Repair', 'Damaged', 'Obsolete', 'Disposed', 'Consumed'].includes(st.statusName);
                return (
                  <div 
                    key={st.id} 
                    className="p-4 bg-[#0f0f12] border border-[#1f1f23] hover:border-[#2f2f35] rounded-md flex items-center justify-between transition-colors"
                  >
                    <div className="space-y-1 pr-4 min-w-0 flex-1">
                      <div className="flex items-center space-x-2.5">
                        <span 
                          className="w-3.5 h-3.5 rounded-full border border-white/10 flex-shrink-0" 
                          style={{ backgroundColor: st.color }}
                        />
                        <h4 className="text-sm font-semibold text-white truncate">{st.statusName}</h4>
                        {st.isConsumableOnly === 'true' && (
                          <span className="text-[9px] font-mono text-pink-400 bg-pink-950/30 border border-pink-900/40 px-1.5 py-0.5 rounded-sm">
                            Consumables Only
                          </span>
                        )}
                        {isCore && (
                          <span className="text-[9px] font-mono text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded-sm">
                            System Core
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                        {st.description || 'No description configured.'}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleEditStatusSetup(st)}
                        className="p-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-sm transition cursor-pointer"
                        title="Edit Status Parameters"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {!isCore && isAuthenticated && (
                        <button
                          onClick={() => handleDeleteStatus(st)}
                          className="p-2 bg-red-950/20 hover:bg-red-900/40 text-red-400 rounded-sm transition cursor-pointer"
                          title="Delete Custom Status"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel: Add / Edit form (5 columns) */}
          <div className="lg:col-span-5">
            <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-6 sticky top-10">
              <div className="flex items-center space-x-2 mb-6">
                <Palette className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-mono">
                  {editingStatusId ? 'Modify Status Specs' : 'Register Custom Status'}
                </h3>
              </div>

              <form onSubmit={handleStatusSubmit} className="space-y-5">
                
                {statusErrorMsg && (
                  <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 text-xs rounded-md flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{statusErrorMsg}</span>
                  </div>
                )}
                {statusSuccessMsg && (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-xs rounded-md flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{statusSuccessMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Status Name <span className="text-blue-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Under Calibration, In Storage"
                    value={statusName}
                    onChange={(e) => setStatusName(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Hex Color & Theme Preset
                  </label>
                  <div className="flex items-center space-x-3 bg-[#050505] border border-[#1f1f23] p-3 rounded-md">
                    <input
                      type="color"
                      value={statusColor}
                      onChange={(e) => setStatusColor(e.target.value)}
                      className="w-8 h-8 rounded-sm bg-transparent border-0 cursor-pointer outline-none"
                    />
                    <input
                      type="text"
                      value={statusColor}
                      onChange={(e) => setStatusColor(e.target.value)}
                      className="bg-transparent text-xs font-mono text-white max-w-[80px] focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-1 flex-1 justify-end">
                      {colorSwatches.map(sh => (
                        <button
                          key={sh}
                          type="button"
                          onClick={() => setStatusColor(sh)}
                          className="w-4.5 h-4.5 rounded-full border border-white/5 hover:scale-110 transition shrink-0"
                          style={{ backgroundColor: sh }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Functional Definition
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide operational definitions or logic regarding this state..."
                    value={statusDesc}
                    onChange={(e) => setStatusDesc(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>

                <div className="flex items-center space-x-2.5 p-3.5 bg-[#050505] border border-[#1f1f23] rounded-md">
                  <input
                    type="checkbox"
                    id="consumable-toggle"
                    checked={isConsumableOnly}
                    onChange={(e) => setIsConsumableOnly(e.target.checked)}
                    className="h-4 w-4 bg-[#050505] border-[#1f1f23] rounded text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="consumable-toggle" className="block text-xs font-bold text-white cursor-pointer select-none">
                      Is Consumable Only
                    </label>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Check if this state applies exclusively to consumable assets like batteries or filters.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmittingStatus || !isAuthenticated}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold rounded-md text-xs tracking-wide transition cursor-pointer text-center"
                  >
                    {isSubmittingStatus ? 'Registering...' : editingStatusId ? 'Save Configuration' : 'Register Status option'}
                  </button>

                  {editingStatusId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStatusId(null);
                        setStatusName('');
                        setStatusDesc('');
                      }}
                      className="px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-xs transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!isAuthenticated && (
                  <p className="text-[10px] text-zinc-500 text-center font-mono mt-2">
                    🔓 Unlock admin controls to modify dictionary.
                  </p>
                )}

              </form>
            </div>
          </div>

        </div>
      ) : (
        /* Status Summary Board and Sensor List */
        <div className="space-y-10">
          
          {/* Status Matrix Blocks */}
          <div className="space-y-4">
            <h3 className="text-[10px] uppercase font-mono font-bold tracking-widest text-zinc-500 mb-2">
              INSTRUMENT STATUS DISTRIBUTION METRIC
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              
              {/* "All" state button */}
              <div
                onClick={() => setSelectedStatusName(null)}
                className={`p-4 rounded-md border cursor-pointer transition-all flex flex-col justify-between ${
                  selectedStatusName === null
                    ? 'bg-[#111116] border-zinc-500 shadow-lg'
                    : 'bg-[#0f0f12] border-[#1f1f23] hover:border-[#2f2f35] hover:bg-[#121215]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">All Instruments</span>
                  <Layers className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-bold text-white tracking-tight">{sensors.length}</span>
                  <span className="block text-[9px] font-mono text-zinc-500 mt-1 uppercase">Total Assets</span>
                </div>
              </div>

              {/* Status specific cards */}
              {statuses.map(st => {
                const count = statusCounts[st.statusName] || 0;
                const isSelected = selectedStatusName === st.statusName;
                return (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStatusName(st.statusName)}
                    className={`p-4 rounded-md border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#111116] shadow-lg'
                        : 'bg-[#0f0f12] border-[#1f1f23] hover:border-[#2f2f35] hover:bg-[#121215]'
                    }`}
                    style={{ borderColor: isSelected ? st.color : undefined }}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold text-zinc-300 truncate" title={st.statusName}>
                        {st.statusName}
                      </span>
                      {getStatusIcon(st.statusName, st.color)}
                    </div>
                    <div className="mt-4">
                      <span className="text-2xl font-bold text-white tracking-tight">{count}</span>
                      <span className="block text-[9px] font-mono text-zinc-500 mt-1 uppercase">Instruments</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filtering options for instruments list */}
          <div className="border-t border-[#1f1f23] pt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-mono">
                {selectedStatusName ? `Instruments labeled: ${selectedStatusName}` : 'All Registered Instruments'} ({filteredSensors.length})
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Active sensors inventory and their corresponding logistics pedigree.
              </p>
            </div>

            <div className="flex items-center space-x-2 bg-[#0f0f12] border border-[#1f1f23] p-1 rounded-md">
              <button
                onClick={() => setFilterConsumable('all')}
                className={`px-3 py-1.5 rounded-sm text-xs font-mono transition-all ${
                  filterConsumable === 'all' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                All Assets
              </button>
              <button
                onClick={() => setFilterConsumable('consumable')}
                className={`px-3 py-1.5 rounded-sm text-xs font-mono transition-all ${
                  filterConsumable === 'consumable' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Consumables
              </button>
              <button
                onClick={() => setFilterConsumable('non-consumable')}
                className={`px-3 py-1.5 rounded-sm text-xs font-mono transition-all ${
                  filterConsumable === 'non-consumable' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Hardware Assets
              </button>
            </div>
          </div>

          {/* Sensors Listing */}
          {filteredSensors.length === 0 ? (
            <div className="p-16 bg-[#0f0f12] border border-[#1f1f23] rounded-md text-center text-zinc-500">
              <Activity className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="font-serif italic text-sm text-white">No instrument registers found.</p>
              <p className="text-xs text-zinc-500 mt-1">There are no hardware assets matching this status filter currently.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSensors.map(sensor => {
                const isConsumable = isConsumableStatus(sensor.status);
                const currentStatusColor = statuses.find(s => s.statusName === sensor.status)?.color || '#3b82f6';
                const assignedStation = stations.find(st => st.stationId === sensor.stationId);

                return (
                  <div
                    key={sensor.sensorId}
                    className="bg-[#0f0f12] border border-[#1f1f23] rounded-md overflow-hidden hover:border-[#2f2f35] transition-all flex flex-col justify-between group"
                  >
                    
                    {/* Header */}
                    <div className="p-5 border-b border-[#1f1f23] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold text-zinc-500 bg-[#050505] border border-[#1f1f23] px-2 py-0.5 rounded-sm">
                          SEN-{sensor.sensorId.toString().padStart(4, '0')}
                        </span>

                        <span 
                          className="px-2 py-0.5 rounded-sm text-[9px] font-mono font-semibold uppercase tracking-wide border border-white/5"
                          style={{ color: currentStatusColor, backgroundColor: `${currentStatusColor}15` }}
                        >
                          {sensor.status}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-white tracking-wide truncate group-hover:text-blue-400 transition-colors">
                          {sensor.sensorName || `${sensor.manufacturer} ${sensor.sensorType}`}
                        </h4>
                        <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">{sensor.sensorType}</span>
                      </div>
                    </div>

                    {/* Specifications Body */}
                    <div className="p-5 space-y-4 flex-1">
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[11px] font-mono text-zinc-400">
                        <div>
                          <p className="text-[9px] uppercase text-zinc-500">Manufacturer</p>
                          <p className="text-zinc-200 mt-0.5 truncate">{sensor.manufacturer}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase text-zinc-500">Serial Code</p>
                          <p className="text-zinc-200 mt-0.5 truncate">{sensor.serialNumber || 'N/A'}</p>
                        </div>
                        <div className="col-span-2 border-t border-[#1f1f23] pt-2 mt-1">
                          <p className="text-[9px] uppercase text-zinc-500">Assigned Station</p>
                          <p className="text-white font-sans mt-0.5 flex items-center gap-1 truncate">
                            <Activity className="h-3 w-3 text-zinc-500" />
                            {assignedStation ? assignedStation.stationName : 'Unassigned (In Depot)'}
                          </p>
                        </div>
                        {sensor.assignedOffice && (
                          <div className="col-span-2">
                            <p className="text-[9px] uppercase text-zinc-500">Assigned Office</p>
                            <p className="text-zinc-300 mt-0.5 truncate font-sans">{sensor.assignedOffice}</p>
                          </div>
                        )}
                      </div>

                      {sensor.remarks && (
                        <div className="p-2.5 bg-[#050505] rounded-sm border border-[#1f1f23] text-[10px] text-zinc-500 leading-relaxed font-sans line-clamp-2">
                          {sensor.remarks}
                        </div>
                      )}
                    </div>

                    {/* Quick status edit footer */}
                    <div className="px-5 py-4 bg-[#070708] border-t border-[#1f1f23] flex items-center justify-between">
                      {isConsumable ? (
                        <span className="text-[9px] font-mono text-pink-400 bg-pink-950/20 border border-pink-900/30 px-2 py-0.5 rounded-sm">
                          Consumable Asset
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-blue-400 bg-blue-950/20 border border-blue-900/30 px-2 py-0.5 rounded-sm">
                          Hardware Asset
                        </span>
                      )}

                      <button
                        onClick={() => handleSensorStatusSetup(sensor)}
                        className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Update Status</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Sensor Quick Status Updater Modal */}
      {editingSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#0f0f12] border border-[#1f1f23] rounded-md shadow-2xl overflow-hidden">
            
            <div className="p-5 border-b border-[#1f1f23] flex items-center justify-between bg-gradient-to-r from-emerald-950/20 to-transparent">
              <div>
                <span className="text-[9px] font-mono font-bold tracking-widest text-emerald-500 uppercase">UPDATE INSTRUMENT STATE</span>
                <h3 className="text-sm font-semibold text-white mt-0.5">
                  SEN-{editingSensor.sensorId.toString().padStart(4, '0')}: {editingSensor.sensorName || editingSensor.manufacturer}
                </h3>
              </div>
              <button
                onClick={() => setEditingSensor(null)}
                className="p-1 text-zinc-500 hover:text-white rounded-sm transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSensorStatusUpdate} className="p-6 space-y-4">
              
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Operational State
                </label>
                <select
                  value={newSensorStatus}
                  onChange={(e) => setNewSensorStatus(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  {statuses.map(st => (
                    <option key={st.id} value={st.statusName}>
                      {st.statusName} {st.isConsumableOnly === 'true' ? '(Consumable)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Assigned Weather Terminal
                </label>
                <select
                  value={newSensorStationId}
                  onChange={(e) => setNewSensorStationId(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="">None (Keep in central storage/depot)</option>
                  {stations.map(st => (
                    <option key={st.stationId} value={st.stationId}>
                      {st.stationName} ({st.region})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Remarks / State Transition Logs
                </label>
                <textarea
                  rows={3}
                  placeholder="Record reasons for status changes, transfer details, or repair notes..."
                  value={newSensorRemarks}
                  onChange={(e) => setNewSensorRemarks(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition"
                />
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="submit"
                  disabled={isUpdatingSensor || !isAuthenticated}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold rounded-md text-xs tracking-wide transition cursor-pointer text-center"
                >
                  {isUpdatingSensor ? 'Saving Changes...' : 'Save Status Update'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSensor(null)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {!isAuthenticated && (
                <p className="text-[10px] text-zinc-500 text-center font-mono mt-1">
                  🔓 Unlock admin controls to save updates.
                </p>
              )}

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
