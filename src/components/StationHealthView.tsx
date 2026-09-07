import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Battery, 
  BatteryCharging, 
  BatteryWarning, 
  Radio, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Search, 
  Filter, 
  Plus, 
  Download, 
  ChevronDown, 
  ArrowUpDown, 
  Clock, 
  Compass, 
  ShieldAlert,
  Wrench,
  Edit2,
  Trash2,
  Sliders,
  Check,
  X,
  Cpu
} from 'lucide-react';
import { WeatherStation, StationHealth } from '../types.ts';

interface StationHealthViewProps {
  stations: WeatherStation[];
  isAuthenticated: boolean;
  token: string | null;
  userRole: string | null;
  onRefreshStations?: () => void;
  onNavigateToMaintenance?: (target: { tab: 'tickets' | 'work-orders'; ticketNumber?: string; workOrderId?: string }) => void;
}

export default function StationHealthView({
  stations,
  isAuthenticated,
  token,
  userRole,
  onRefreshStations,
  onNavigateToMaintenance
}: StationHealthViewProps) {
  const [healthRecords, setHealthRecords] = useState<StationHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OK' | 'Warning' | 'Critical'>('ALL');
  const [batteryFilter, setBatteryFilter] = useState<'ALL' | 'HIGH' | 'NOMINAL' | 'LOW'>('ALL');
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'GOOD' | 'FAIR' | 'POOR'>('ALL');
  const [sortBy, setSortBy] = useState<'lastReportedTime' | 'batteryLevel' | 'stationName' | 'alertStatus'>('alertStatus');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StationHealth | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<number>(stations[0]?.stationId || 0);
  const [formBatteryLevel, setFormBatteryLevel] = useState<number>(90);
  const [formSignalStrength, setFormSignalStrength] = useState<string>('-75 dBm (Good)');
  const [formAlertStatus, setFormAlertStatus] = useState<string>('OK');
  const [savingRecord, setSavingRecord] = useState(false);

  // Fetch Station Health records
  const fetchHealthRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/station-health');
      if (!res.ok) {
        throw new Error('Failed to retrieve station health records');
      }
      const data: StationHealth[] = await res.json();
      setHealthRecords(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading station health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthRecords();
  }, []);

  // Update selectedStationId default if stations load later
  useEffect(() => {
    if (stations.length > 0 && selectedStationId === 0) {
      setSelectedStationId(stations[0].stationId);
    }
  }, [stations]);

  // Synchronize network telemetry polling
  const handleSyncTelemetry = async () => {
    if (!token) {
      alert('Authentication required to poll network telemetry.');
      return;
    }
    try {
      setSyncing(true);
      const res = await fetch('/api/station-health/ping-sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to trigger telemetry poll');
      }
      const data = await res.json();
      setSuccessMsg(`Network telemetry synced successfully (${data.count || healthRecords.length} stations refreshed).`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchHealthRecords();
      if (onRefreshStations) onRefreshStations();
    } catch (err: any) {
      alert(err.message || 'Error syncing network telemetry');
    } finally {
      setSyncing(false);
    }
  };

  // Submit Add or Edit Health Record
  const handleSaveHealthRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      alert('Authentication required.');
      return;
    }
    setSavingRecord(true);

    try {
      if (editingRecord) {
        // Edit existing
        const res = await fetch(`/api/station-health/${editingRecord.healthId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            batteryLevel: formBatteryLevel,
            signalStrength: formSignalStrength,
            alertStatus: formAlertStatus,
            lastReportedTime: new Date().toISOString()
          })
        });
        if (!res.ok) throw new Error('Failed to update station health record');
        setSuccessMsg(`Health metrics for #${editingRecord.healthId} updated.`);
      } else {
        // Create new
        const res = await fetch('/api/station-health', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            stationId: selectedStationId,
            batteryLevel: formBatteryLevel,
            signalStrength: formSignalStrength,
            alertStatus: formAlertStatus,
            lastReportedTime: new Date().toISOString()
          })
        });
        if (!res.ok) throw new Error('Failed to create station health record');
        setSuccessMsg('New station health telemetry log created.');
      }

      setTimeout(() => setSuccessMsg(null), 4000);
      setIsAddModalOpen(false);
      setEditingRecord(null);
      await fetchHealthRecords();
      if (onRefreshStations) onRefreshStations();
    } catch (err: any) {
      alert(err.message || 'Error saving health record');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleDeleteRecord = async (healthId: number) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to remove health record #${healthId}?`)) return;

    try {
      const res = await fetch(`/api/station-health/${healthId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to delete station health record');
      setHealthRecords(prev => prev.filter(r => r.healthId !== healthId));
      setSuccessMsg('Station health record deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete record');
    }
  };

  // Open Edit Modal prefilled
  const openEditModal = (rec: StationHealth) => {
    setEditingRecord(rec);
    setSelectedStationId(rec.stationId);
    setFormBatteryLevel(rec.batteryLevel);
    setFormSignalStrength(rec.signalStrength);
    setFormAlertStatus(rec.alertStatus);
    setIsAddModalOpen(true);
  };

  // Open Create Modal reset
  const openAddModal = () => {
    setEditingRecord(null);
    if (stations.length > 0) setSelectedStationId(stations[0].stationId);
    setFormBatteryLevel(92);
    setFormSignalStrength('-76 dBm (Good)');
    setFormAlertStatus('OK');
    setIsAddModalOpen(true);
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (healthRecords.length === 0) return;
    const headers = ['Health ID', 'Station ID', 'Station Name', 'Region', 'WIGOS ID', 'Battery Level (%)', 'Signal Strength', 'Alert Status', 'Last Reported Time'];
    const rows = filteredRecords.map(r => [
      r.healthId,
      r.stationId,
      `"${(r.stationName || '').replace(/"/g, '""')}"`,
      `"${(r.region || '').replace(/"/g, '""')}"`,
      `"${(r.wigosId || '').replace(/"/g, '""')}"`,
      r.batteryLevel,
      `"${(r.signalStrength || '').replace(/"/g, '""')}"`,
      r.alertStatus,
      `"${r.lastReportedTime}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `station_health_export_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick Dispatch to Maintenance
  const handleDispatchTicket = (record: StationHealth) => {
    if (onNavigateToMaintenance) {
      onNavigateToMaintenance({
        tab: 'tickets',
        ticketNumber: `STN-${record.stationId}`
      });
    }
  };

  // Helper format relative time
  const formatRelativeTime = (timestamp: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Compute Metrics
  const metrics = useMemo(() => {
    const total = healthRecords.length;
    const okCount = healthRecords.filter(r => r.alertStatus === 'OK').length;
    const warningCount = healthRecords.filter(r => r.alertStatus === 'Warning').length;
    const criticalCount = healthRecords.filter(r => r.alertStatus === 'Critical').length;
    
    const avgBattery = total > 0 
      ? Math.round(healthRecords.reduce((acc, r) => acc + (r.batteryLevel || 0), 0) / total) 
      : 0;

    return { total, okCount, warningCount, criticalCount, avgBattery };
  }, [healthRecords]);

  // Filter & Sort records
  const filteredRecords = useMemo(() => {
    return healthRecords.filter(rec => {
      // Search
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const nameMatch = (rec.stationName || '').toLowerCase().includes(query);
        const regionMatch = (rec.region || '').toLowerCase().includes(query);
        const idMatch = rec.stationId.toString().includes(query);
        const healthIdMatch = rec.healthId.toString().includes(query);
        const wigosMatch = (rec.wigosId || '').toLowerCase().includes(query);
        if (!nameMatch && !regionMatch && !idMatch && !healthIdMatch && !wigosMatch) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'ALL' && rec.alertStatus !== statusFilter) {
        return false;
      }

      // Battery
      if (batteryFilter === 'HIGH' && rec.batteryLevel < 70) return false;
      if (batteryFilter === 'NOMINAL' && (rec.batteryLevel < 30 || rec.batteryLevel >= 70)) return false;
      if (batteryFilter === 'LOW' && rec.batteryLevel >= 30) return false;

      // Signal
      if (signalFilter !== 'ALL') {
        const sigLower = (rec.signalStrength || '').toLowerCase();
        if (signalFilter === 'GOOD' && !sigLower.includes('good')) return false;
        if (signalFilter === 'FAIR' && !sigLower.includes('fair')) return false;
        if (signalFilter === 'POOR' && !sigLower.includes('poor')) return false;
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'batteryLevel') {
        comparison = a.batteryLevel - b.batteryLevel;
      } else if (sortBy === 'stationName') {
        comparison = (a.stationName || '').localeCompare(b.stationName || '');
      } else if (sortBy === 'lastReportedTime') {
        comparison = new Date(a.lastReportedTime).getTime() - new Date(b.lastReportedTime).getTime();
      } else if (sortBy === 'alertStatus') {
        const orderMap: Record<string, number> = { Critical: 3, Warning: 2, OK: 1 };
        comparison = (orderMap[a.alertStatus] || 0) - (orderMap[b.alertStatus] || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [healthRecords, searchQuery, statusFilter, batteryFilter, signalFilter, sortBy, sortOrder]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#070709] text-zinc-200 p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1f1f23]">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Station Health Monitoring</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time telemetry, power management, transmission signal metrics, and automated alert statuses
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            id="sync-station-health-btn"
            onClick={handleSyncTelemetry}
            disabled={syncing}
            className="px-3.5 py-2 bg-[#141418] hover:bg-[#1f1f26] border border-[#272730] hover:border-zinc-600 rounded-lg text-xs font-medium text-zinc-200 transition-all cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
            title="Poll and synchronize live station telemetry"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-blue-400 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Polling Network...' : 'Sync Telemetry'}</span>
          </button>

          <button
            id="export-station-health-btn"
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-[#141418] hover:bg-[#1f1f26] border border-[#272730] hover:border-zinc-600 rounded-lg text-xs font-medium text-zinc-300 transition-all cursor-pointer flex items-center gap-2"
            title="Download CSV report of station health telemetry"
          >
            <Download className="h-3.5 w-3.5 text-zinc-400" />
            <span>Export CSV</span>
          </button>

          {isAuthenticated && (
            <button
              id="add-station-health-btn"
              onClick={openAddModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-emerald-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>Record Check-in</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast alert */}
      {successMsg && (
        <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Health Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
        {/* Total Monitored */}
        <div 
          onClick={() => setStatusFilter('ALL')}
          className="p-4 bg-[#0f0f13] border border-[#1f1f26] rounded-xl hover:border-zinc-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Monitored</span>
            <Cpu className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white tracking-tight">{metrics.total}</span>
            <span className="text-[11px] text-zinc-500">stations</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">Live active transmission nodes</div>
        </div>

        {/* Operational OK */}
        <div 
          onClick={() => setStatusFilter('OK')}
          className={`p-4 bg-[#0f0f13] border rounded-xl hover:border-emerald-500/50 transition cursor-pointer ${
            statusFilter === 'OK' ? 'border-emerald-500 bg-emerald-950/10' : 'border-[#1f1f26]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">Healthy (OK)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-emerald-400 tracking-tight">{metrics.okCount}</span>
            <span className="text-[11px] text-emerald-500/80">
              {metrics.total > 0 ? `${Math.round((metrics.okCount / metrics.total) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">Nominal battery & strong signal</div>
        </div>

        {/* Warning */}
        <div 
          onClick={() => setStatusFilter('Warning')}
          className={`p-4 bg-[#0f0f13] border rounded-xl hover:border-amber-500/50 transition cursor-pointer ${
            statusFilter === 'Warning' ? 'border-amber-500 bg-amber-950/10' : 'border-[#1f1f26]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400">Warning Required</span>
            <BatteryWarning className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-amber-400 tracking-tight">{metrics.warningCount}</span>
            <span className="text-[11px] text-amber-500/80">
              {metrics.total > 0 ? `${Math.round((metrics.warningCount / metrics.total) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">Moderate drain / fair transmit</div>
        </div>

        {/* Critical */}
        <div 
          onClick={() => setStatusFilter('Critical')}
          className={`p-4 bg-[#0f0f13] border rounded-xl hover:border-rose-500/50 transition cursor-pointer ${
            statusFilter === 'Critical' ? 'border-rose-500 bg-rose-950/10' : 'border-[#1f1f26]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-400">Critical Alerts</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-rose-400 tracking-tight">{metrics.criticalCount}</span>
            <span className="text-[11px] text-rose-500/80">
              {metrics.total > 0 ? `${Math.round((metrics.criticalCount / metrics.total) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">Action & inspection required</div>
        </div>

        {/* Battery Average */}
        <div className="p-4 bg-[#0f0f13] border border-[#1f1f26] rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Network Avg Battery</span>
            <BatteryCharging className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white tracking-tight">{metrics.avgBattery}%</span>
            <span className="text-[11px] text-zinc-500">grid/solar</span>
          </div>
          <div className="mt-2 w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                metrics.avgBattery > 70 ? 'bg-emerald-500' : metrics.avgBattery > 40 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, metrics.avgBattery))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 p-4 bg-[#0f0f13] border border-[#1f1f26] rounded-xl flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            id="station-health-search-input"
            type="text"
            placeholder="Search station, region, ID, or WIGOS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#16161b] border border-[#272730] focus:border-blue-500 rounded-lg py-2 pl-9 pr-8 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end text-xs">
          {/* Status Filter */}
          <div className="flex items-center bg-[#16161b] border border-[#272730] rounded-lg p-0.5">
            <span className="px-2 text-[10px] uppercase font-bold text-zinc-500">Status:</span>
            {(['ALL', 'OK', 'Warning', 'Critical'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  statusFilter === st 
                    ? 'bg-zinc-800 text-white font-medium shadow-xs' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Battery Filter */}
          <div className="flex items-center bg-[#16161b] border border-[#272730] rounded-lg p-0.5">
            <span className="px-2 text-[10px] uppercase font-bold text-zinc-500">Battery:</span>
            {(['ALL', 'HIGH', 'NOMINAL', 'LOW'] as const).map(bf => (
              <button
                key={bf}
                onClick={() => setBatteryFilter(bf)}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  batteryFilter === bf 
                    ? 'bg-zinc-800 text-white font-medium shadow-xs' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {bf === 'ALL' ? 'All' : bf === 'HIGH' ? '>70%' : bf === 'NOMINAL' ? '30-70%' : '<30%'}
              </button>
            ))}
          </div>

          {/* Signal Filter */}
          <div className="flex items-center bg-[#16161b] border border-[#272730] rounded-lg p-0.5">
            <span className="px-2 text-[10px] uppercase font-bold text-zinc-500">Signal:</span>
            {(['ALL', 'GOOD', 'FAIR', 'POOR'] as const).map(sf => (
              <button
                key={sf}
                onClick={() => setSignalFilter(sf)}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  signalFilter === sf 
                    ? 'bg-zinc-800 text-white font-medium shadow-xs' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {sf === 'ALL' ? 'All' : sf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Station Health Table */}
      <div className="mt-6 bg-[#0c0c0f] border border-[#1f1f26] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table id="station-health-table" className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1f1f26] bg-[#111116] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <th className="py-3.5 px-4">
                  <span className="flex items-center gap-1.5">Health ID</span>
                </th>
                <th className="py-3.5 px-4 cursor-pointer select-none" onClick={() => toggleSort('stationName')}>
                  <div className="flex items-center gap-1.5 hover:text-white transition">
                    <span>Station & WIGOS Info</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer select-none" onClick={() => toggleSort('batteryLevel')}>
                  <div className="flex items-center gap-1.5 hover:text-white transition">
                    <Battery className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Battery Level</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Signal Strength</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer select-none" onClick={() => toggleSort('alertStatus')}>
                  <div className="flex items-center gap-1.5 hover:text-white transition">
                    <AlertTriangle className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Alert Status</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer select-none" onClick={() => toggleSort('lastReportedTime')}>
                  <div className="flex items-center gap-1.5 hover:text-white transition">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Last Reported Time</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181820] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
                      <span>Loading station health records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Activity className="h-6 w-6 text-zinc-600" />
                      <p className="text-zinc-300 font-medium">No matching health records found</p>
                      <p className="text-xs text-zinc-500">Try adjusting your filters or syncing telemetry</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isOk = record.alertStatus === 'OK';
                  const isWarning = record.alertStatus === 'Warning';
                  const isCritical = record.alertStatus === 'Critical';

                  const batteryLevel = record.batteryLevel || 0;
                  const isBatteryHigh = batteryLevel >= 70;
                  const isBatteryMedium = batteryLevel >= 35 && batteryLevel < 70;
                  const isBatteryLow = batteryLevel < 35;

                  return (
                    <tr 
                      key={record.healthId}
                      className="hover:bg-[#121217] transition-colors duration-150 group"
                    >
                      {/* Health ID */}
                      <td className="py-3.5 px-4 font-mono text-zinc-400">
                        <span className="px-2 py-0.5 bg-[#17171e] border border-[#262630] rounded text-[11px] font-bold text-zinc-300">
                          #{record.healthId}
                        </span>
                      </td>

                      {/* Station ID & Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white group-hover:text-blue-400 transition">
                              {record.stationName || `Station #${record.stationId}`}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                              ID: {record.stationId}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                            <span>{record.region || 'Unknown Region'}</span>
                            <span>•</span>
                            <span className="font-mono text-blue-400/90 text-[10px]">
                              {record.wigosId || `WSI: 1-0-20001-0-${record.stationId}`}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Battery Level */}
                      <td className="py-3.5 px-4">
                        <div className="w-36">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className={`font-semibold ${
                              isBatteryHigh ? 'text-emerald-400' : isBatteryMedium ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                              {batteryLevel}%
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {record.batteryCurrentVoltage ? `${record.batteryCurrentVoltage}V` : `${(10.8 + (batteryLevel / 100) * 2.0).toFixed(2)}V`}
                            </span>
                          </div>
                          <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isBatteryHigh 
                                  ? 'bg-emerald-500' 
                                  : isBatteryMedium 
                                  ? 'bg-amber-500' 
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, batteryLevel))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Signal Strength */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${
                            (record.signalStrength || '').toLowerCase().includes('good')
                              ? 'bg-emerald-500'
                              : (record.signalStrength || '').toLowerCase().includes('fair')
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`} />
                          <span className="font-mono text-zinc-300 text-[11px]">
                            {record.signalStrength}
                          </span>
                        </div>
                      </td>

                      {/* Alert Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          isOk
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : isWarning
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            isOk ? 'bg-emerald-400' : isWarning ? 'bg-amber-400' : 'bg-rose-400 animate-ping'
                          }`} />
                          {record.alertStatus}
                        </span>
                      </td>

                      {/* Last Reported Time */}
                      <td className="py-3.5 px-4 text-zinc-400 text-[11px]">
                        <div className="flex flex-col">
                          <span className="text-zinc-200 font-medium">{formatRelativeTime(record.lastReportedTime)}</span>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(record.lastReportedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(isWarning || isCritical) && onNavigateToMaintenance && (
                            <button
                              onClick={() => handleDispatchTicket(record)}
                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[10px] font-medium transition flex items-center gap-1"
                              title="Create or open maintenance dispatch ticket"
                            >
                              <Wrench className="h-3 w-3" />
                              <span>Dispatch</span>
                            </button>
                          )}

                          {isAuthenticated && (
                            <>
                              <button
                                onClick={() => openEditModal(record)}
                                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition"
                                title="Edit health telemetry log"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteRecord(record.healthId)}
                                className="p-1.5 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 rounded transition"
                                title="Delete health record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-[#0d0d10] border-t border-[#1f1f26] flex items-center justify-between text-xs text-zinc-500">
          <div>
            Showing <span className="font-semibold text-zinc-300">{filteredRecords.length}</span> of{' '}
            <span className="font-semibold text-zinc-300">{healthRecords.length}</span> telemetry health records
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>OK (&gt;70% Battery)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Warning (30–70%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Critical (&lt;30%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Add / Edit Health Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#121217] border border-[#272730] rounded-xl max-w-md w-full p-6 text-zinc-200 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#212129]">
              <div className="flex items-center gap-2.5">
                <Activity className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">
                  {editingRecord ? `Edit Station Health (#${editingRecord.healthId})` : 'Record Health Check-in'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHealthRecord} className="mt-4 space-y-4">
              {/* Station Selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Weather Station (Foreign Key: station_id)
                </label>
                {editingRecord ? (
                  <div className="px-3 py-2 bg-[#181820] border border-[#272730] rounded-lg text-xs text-white">
                    {editingRecord.stationName || `Station #${editingRecord.stationId}`} (ID: {editingRecord.stationId})
                  </div>
                ) : (
                  <select
                    value={selectedStationId}
                    onChange={(e) => setSelectedStationId(parseInt(e.target.value))}
                    className="w-full bg-[#181820] border border-[#272730] focus:border-emerald-500 rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                    required
                  >
                    {stations.map(st => (
                      <option key={st.stationId} value={st.stationId}>
                        {st.stationName} (ID: {st.stationId}) - {st.region}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Battery Level */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Battery Level (Percentage: {formBatteryLevel}%)
                  </label>
                  <span className="text-xs font-mono text-zinc-400">
                    Est: {(10.8 + (formBatteryLevel / 100) * 2.0).toFixed(2)}V
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="1"
                  value={formBatteryLevel}
                  onChange={(e) => setFormBatteryLevel(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                  <span>Critical (5%)</span>
                  <span>Low (30%)</span>
                  <span>Nominal (70%)</span>
                  <span>Full (100%)</span>
                </div>
              </div>

              {/* Signal Strength */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Signal Strength (e.g., dBm or 'Good', 'Fair', 'Poor')
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { label: 'Good (-72 dBm)', val: '-72 dBm (Good)' },
                    { label: 'Fair (-86 dBm)', val: '-86 dBm (Fair)' },
                    { label: 'Poor (-102 dBm)', val: '-102 dBm (Poor)' },
                  ].map(opt => (
                    <button
                      type="button"
                      key={opt.val}
                      onClick={() => setFormSignalStrength(opt.val)}
                      className={`py-1.5 px-2 text-[11px] rounded border transition ${
                        formSignalStrength === opt.val
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                          : 'bg-[#181820] border-[#272730] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formSignalStrength}
                  onChange={(e) => setFormSignalStrength(e.target.value)}
                  placeholder="e.g. -78 dBm (Good)"
                  className="w-full bg-[#181820] border border-[#272730] focus:border-emerald-500 rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                  required
                />
              </div>

              {/* Alert Status */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Alert Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'OK', color: 'border-emerald-500 bg-emerald-950/30 text-emerald-400' },
                    { val: 'Warning', color: 'border-amber-500 bg-amber-950/30 text-amber-400' },
                    { val: 'Critical', color: 'border-rose-500 bg-rose-950/30 text-rose-400' },
                  ].map(statusOpt => (
                    <button
                      type="button"
                      key={statusOpt.val}
                      onClick={() => setFormAlertStatus(statusOpt.val)}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                        formAlertStatus === statusOpt.val
                          ? statusOpt.color
                          : 'border-[#272730] bg-[#181820] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {statusOpt.val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#212129] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-[#181820] hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRecord}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingRecord ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>{editingRecord ? 'Save Changes' : 'Save Check-in'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
