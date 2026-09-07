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
  Building,
  Smartphone,
  RefreshCw,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Check,
  Copy,
  Download,
  Wifi,
  DollarSign,
  Database,
  Filter,
  Ticket,
  ExternalLink,
  X,
  Send
} from 'lucide-react';
import { WeatherStation, Sensor } from '../types.ts';
import { useMaintenanceData, saveTicket } from '../utils/maintenance.ts';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface StationsModuleProps {
  stations: WeatherStation[];
  sensors: Sensor[];
  token: string | null;
  role: string | null;
  onRefreshData: () => void;
  onOpenAddStation: () => void;
  onOpenEditStation: (station: WeatherStation) => void;
  onNavigateToMaintenance?: (target: { tab?: 'tickets' | 'work-orders'; ticketNumber?: string; workOrderId?: string; stationId?: number }) => void;
}

export default function StationsModule({
  stations,
  sensors,
  token,
  role,
  onRefreshData,
  onOpenAddStation,
  onOpenEditStation,
  onNavigateToMaintenance
}: StationsModuleProps) {
  const { tickets, workOrders } = useMaintenanceData();

  // Create Ticket Modal States
  const [isCreateTicketModalOpen, setIsCreateTicketModalOpen] = useState(false);
  const [ticketModalStationId, setTicketModalStationId] = useState<number | null>(null);
  const [ticketSummary, setTicketSummary] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketStatus, setTicketStatus] = useState<string>('No communication');
  const [ticketPriority, setTicketPriority] = useState<'Low' | 'Medium' | 'High' | 'Emergency'>('Medium');
  const [ticketAssignedTo, setTicketAssignedTo] = useState('birajkdl');
  const [ticketAssignedEmail, setTicketAssignedEmail] = useState('birajkdl@gmail.com');
  const [ticketSuccessToast, setTicketSuccessToast] = useState<{ ticketNumber: string; linkUrl: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  const [selectedStationId, setSelectedStationId] = useState<number | null>(
    stations.length > 0 ? stations[0].stationId : null
  );
  const [updatingStationId, setUpdatingStationId] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccessId, setUpdateSuccessId] = useState<number | null>(null);

  // Active Tab Local State
  const [activeTab, setActiveTab] = useState<'stations' | 'sim'>('stations');

  // SIM Details Local States
  const [selectedSimStationIds, setSelectedSimStationIds] = useState<number[]>([]);
  const [simSearchQuery, setSimSearchQuery] = useState('');
  const [simStatusFilter, setSimStatusFilter] = useState<'All' | 'Active' | 'Low Balance' | 'Expiring Soon'>('All');
  const [isBulkChecking, setIsBulkChecking] = useState(false);
  const [bulkCheckProgress, setBulkCheckProgress] = useState(0);
  const [checkingSingleId, setCheckingSingleId] = useState<number | null>(null);
  const [copiedSimNumber, setCopiedSimNumber] = useState<string | null>(null);
  const [simBalances, setSimBalances] = useState<Record<number, { remainingVolume: string; remainingBalance: string; expiryDate: string; lastChecked: string; status: 'Active' | 'Low Balance' | 'Expiring Soon' }>>({});

  // Helper to compute/retrieve SIM telemetry info for a station
  const getStationSimInfo = (station: WeatherStation) => {
    const simNum = station.simNumber || ('984' + String(1000000 + ((station.stationId * 48291) % 9000000)));
    
    if (simBalances[station.stationId]) {
      return {
        simNumber: simNum,
        ...simBalances[station.stationId]
      };
    }

    const volGb = parseFloat(((station.stationId * 3.7 + 1.2) % 18).toFixed(2));
    const balNpr = Math.round((station.stationId * 187 + 120) % 1800);
    const monthsAhead = ((station.stationId * 3) % 8) + 1;
    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + monthsAhead);
    const expDateStr = expDate.toISOString().split('T')[0];

    let status: 'Active' | 'Low Balance' | 'Expiring Soon' = 'Active';
    if (balNpr < 200 || volGb < 1.0) {
      status = 'Low Balance';
    } else if (monthsAhead <= 1) {
      status = 'Expiring Soon';
    }

    return {
      simNumber: simNum,
      remainingVolume: `${volGb < 1 ? (volGb * 1024).toFixed(0) + ' MB' : volGb.toFixed(2) + ' GB'}`,
      remainingBalance: `NPR ${balNpr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      expiryDate: expDateStr,
      lastChecked: '2026-07-21 10:00 UTC',
      status
    };
  };

  const handleCopySimNumber = (simNum: string) => {
    navigator.clipboard.writeText(simNum);
    setCopiedSimNumber(simNum);
    setTimeout(() => setCopiedSimNumber(null), 2000);
  };

  const handleToggleSelectSimStation = (stationId: number) => {
    setSelectedSimStationIds(prev => 
      prev.includes(stationId) ? prev.filter(id => id !== stationId) : [...prev, stationId]
    );
  };

  const handleSelectAllSims = (allIds: number[]) => {
    if (selectedSimStationIds.length === allIds.length) {
      setSelectedSimStationIds([]);
    } else {
      setSelectedSimStationIds(allIds);
    }
  };

  const handleCheckSingleBalance = (station: WeatherStation) => {
    setCheckingSingleId(station.stationId);
    setTimeout(() => {
      const current = getStationSimInfo(station);
      const newVol = (parseFloat(current.remainingVolume) * 0.98 + 0.5).toFixed(2) + ' GB';
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
      
      setSimBalances(prev => ({
        ...prev,
        [station.stationId]: {
          ...current,
          remainingVolume: newVol,
          lastChecked: nowStr
        }
      }));
      setCheckingSingleId(null);
    }, 700);
  };

  const handleBulkCheckBalances = (targetStations: WeatherStation[]) => {
    if (targetStations.length === 0) return;
    setIsBulkChecking(true);
    setBulkCheckProgress(10);

    setTimeout(() => setBulkCheckProgress(45), 300);
    setTimeout(() => setBulkCheckProgress(80), 700);
    setTimeout(() => {
      setBulkCheckProgress(100);
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
      
      const newMap = { ...simBalances };
      targetStations.forEach(st => {
        const cur = getStationSimInfo(st);
        newMap[st.stationId] = {
          ...cur,
          lastChecked: nowStr
        };
      });

      setSimBalances(newMap);
      setTimeout(() => {
        setIsBulkChecking(false);
        setBulkCheckProgress(0);
      }, 400);
    }, 1100);
  };

  const handleExportExcel = (filteredList: WeatherStation[]) => {
    const exportStations = selectedSimStationIds.length > 0 
      ? stations.filter(s => selectedSimStationIds.includes(s.stationId))
      : filteredList;

    if (exportStations.length === 0) return;

    const headers = [
      'Station ID',
      'Station Name',
      'SIM Number',
      'Region Sector',
      'Remaining Data Volume',
      'Remaining Balance (NPR)',
      'Expiry Date',
      'SIM Status',
      'Last Checked Timestamp'
    ];

    const rows = exportStations.map(st => {
      const info = getStationSimInfo(st);
      return [
        st.stationId,
        `"${st.stationName.replace(/"/g, '""')}"`,
        `"${info.simNumber}"`,
        `"${st.region.replace(/"/g, '""')}"`,
        `"${info.remainingVolume}"`,
        `"${info.remainingBalance}"`,
        `"${info.expiryDate}"`,
        `"${info.status}"`,
        `"${info.lastChecked}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Station_SIM_Balance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSimStations = useMemo(() => {
    return stations.filter(station => {
      const info = getStationSimInfo(station);
      const q = simSearchQuery.trim().toLowerCase();
      const matchesSearch = q === '' || 
        station.stationName.toLowerCase().includes(q) ||
        station.region.toLowerCase().includes(q) ||
        info.simNumber.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (simStatusFilter === 'All') return true;
      return info.status === simStatusFilter;
    });
  }, [stations, simSearchQuery, simStatusFilter, simBalances]);

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
    const q = searchQuery.toLowerCase();
    const wigos = station.wigosId || `${station.wigosSeries || '1'}-${station.wigosIssuer || '0'}-${station.wigosIssueNum || '20001'}-${station.wigosLocalId || ''}`;
    const matchesSearch = station.stationName.toLowerCase().includes(q) ||
                          station.region.toLowerCase().includes(q) ||
                          wigos.toLowerCase().includes(q);
    
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

    // 5. Maintenance Tickets
    const stationTickets = tickets.filter(t => t.stationId === activeStation.stationId);
    stationTickets.forEach(t => {
      timeline.push({
        id: `ticket-${t.ticketNumber}`,
        date: t.createdAt ? t.createdAt.split(' ')[0] : 'N/A',
        timestamp: t.createdAt ? new Date(t.createdAt).getTime() : 0,
        title: `Maintenance Ticket #${t.ticketNumber}`,
        type: 'ticket',
        badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        iconType: 'calibration',
        description: `[${t.status.toUpperCase()}] ${t.summary} - Priority: ${t.priority || 'Medium'}. Assigned to: ${t.assignedTo}.`,
        notes: t.description,
        meta: `Created by: ${t.createdBy || 'System'}`
      });
    });

    // 6. Work Orders
    const stationTicketNums = stationTickets.map(t => t.ticketNumber);
    const stationWOs = workOrders.filter(w => w.ticketNumbers.some(num => stationTicketNums.includes(num)));
    stationWOs.forEach(w => {
      timeline.push({
        id: `wo-${w.workOrderId}`,
        date: w.createdAt ? w.createdAt.split(' ')[0] : 'N/A',
        timestamp: w.createdAt ? new Date(w.createdAt).getTime() : 0,
        title: `Work Order ${w.workOrderId}`,
        type: 'work-order',
        badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        iconType: 'replacement',
        description: `${w.workOrderTitle} (${w.status}) - Scheduled: ${w.scheduledDate}. Team: ${w.assignedTeam}.`,
        notes: w.scopeOfWork,
        meta: `Created by: ${w.createdBy}`
      });
    });

    // Sort by timestamp (or date) descending
    return timeline.sort((a, b) => {
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return b.date.localeCompare(a.date);
    });
  }, [activeStation, allCalibrations, allDeployments, allReplacements, allDocuments, sensors, tickets, workOrders]);

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
          onClick={() => { setActiveTab('stations'); }}
          className={`pb-3 text-xs font-mono tracking-wider uppercase font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'stations' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Stations Directory
        </button>
        <button
          id="sim-details-tab-btn"
          onClick={() => setActiveTab('sim')}
          className={`pb-3 text-xs font-mono tracking-wider uppercase font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'sim' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5 text-blue-400" />
          SIM Details
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
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {station.region}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-semibold" title="WIGOS Station Identifier (WSI)">
                              WSI: {station.wigosId || `${station.wigosSeries || '1'}-${station.wigosIssuer || '0'}-${station.wigosIssueNum || '20001'}-${station.wigosLocalId || ('0-' + (station.stationName ? station.stationName.split(' ')[0].toUpperCase() : station.stationId))}`}
                            </span>
                          </div>
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
                      <div className="flex items-center justify-between gap-2 mt-3 text-[10px] font-mono text-zinc-400 border-t border-[#131316] pt-2">
                        <div className="flex items-center gap-3">
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

                        {/* Maintenance Ticket Indicator Badge */}
                        {(() => {
                          const stTickets = tickets.filter(t => t.stationId === station.stationId);
                          if (stTickets.length === 0) return null;
                          const hasEmergency = stTickets.some(t => t.priority === 'Emergency' || t.status === 'critical');
                          return (
                            <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                              hasEmergency ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            }`}>
                              <Ticket className="h-2.5 w-2.5" />
                              {stTickets.length} {stTickets.length === 1 ? 'Ticket' : 'Tickets'}
                            </span>
                          );
                        })()}
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

                {/* Header Action Buttons (Create Ticket + Configure Station) */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTicketModalStationId(activeStation.stationId);
                      setIsCreateTicketModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-amber-950/40"
                  >
                    <Ticket className="h-3.5 w-3.5 text-amber-200" />
                    <span>+ Create Ticket</span>
                  </button>

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
              </div>

              {/* WIGOS Station Identifier (WSI) 4-Part Structure Panel */}
              <div className="bg-[#131316] border border-teal-900/30 rounded-md p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wider">
                        WIGOS Station Identifier (WSI) Structure
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30">
                        WMO-No. 1160 Compliant
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      Standardized 4-part international meteorological identifier used for OSCAR/Surface & WIS 2.0 data exchange.
                    </p>
                  </div>
                  {(role === 'Super Administrator' || role === 'Head Office Admin/User' || role === 'Regional Office Admin/User') && (
                    <button
                      id="edit-wsi-btn"
                      onClick={() => onOpenEditStation(activeStation)}
                      className="px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded text-[11px] font-mono font-semibold transition cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Settings className="h-3 w-3" />
                      Configure 4-Part WSI
                    </button>
                  )}
                </div>

                {/* 4-Part Identifier Grid Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-[#09090b] border border-zinc-800/80 p-2.5 rounded text-center">
                    <span className="text-[9px] font-mono text-zinc-500 block uppercase">Part 1: Series</span>
                    <span className="text-sm font-mono font-bold text-teal-400 mt-0.5 block">
                      {activeStation.wigosSeries || '1'}
                    </span>
                    <span className="text-[8px] text-zinc-500 block mt-0.5">Primary WIGOS</span>
                  </div>

                  <div className="bg-[#09090b] border border-zinc-800/80 p-2.5 rounded text-center">
                    <span className="text-[9px] font-mono text-zinc-500 block uppercase">Part 2: Issuer</span>
                    <span className="text-sm font-mono font-bold text-teal-400 mt-0.5 block">
                      {activeStation.wigosIssuer || '0'}
                    </span>
                    <span className="text-[8px] text-zinc-500 block mt-0.5">National/NMHSS</span>
                  </div>

                  <div className="bg-[#09090b] border border-zinc-800/80 p-2.5 rounded text-center">
                    <span className="text-[9px] font-mono text-zinc-500 block uppercase">Part 3: Issue Num</span>
                    <span className="text-sm font-mono font-bold text-teal-400 mt-0.5 block">
                      {activeStation.wigosIssueNum || '20001'}
                    </span>
                    <span className="text-[8px] text-zinc-500 block mt-0.5">Network Allocation</span>
                  </div>

                  <div className="bg-[#09090b] border border-zinc-800/80 p-2.5 rounded text-center">
                    <span className="text-[9px] font-mono text-zinc-500 block uppercase">Part 4: Local ID</span>
                    <span className="text-sm font-mono font-bold text-teal-300 mt-0.5 block truncate">
                      {activeStation.wigosLocalId || ('0-' + (activeStation.stationName ? activeStation.stationName.split(' ')[0].toUpperCase() : activeStation.stationId))}
                    </span>
                    <span className="text-[8px] text-zinc-500 block mt-0.5">Local Station Code</span>
                  </div>
                </div>

                <div className="bg-[#09090b] p-2.5 rounded border border-teal-900/40 flex items-center justify-between font-mono">
                  <span className="text-[10px] text-zinc-400">Full Formatted Identifier:</span>
                  <span className="text-xs font-bold text-teal-300 tracking-wider">
                    {activeStation.wigosId || `${activeStation.wigosSeries || '1'}-${activeStation.wigosIssuer || '0'}-${activeStation.wigosIssueNum || '20001'}-${activeStation.wigosLocalId || ('0-' + (activeStation.stationName ? activeStation.stationName.split(' ')[0].toUpperCase() : activeStation.stationId))}`}
                  </span>
                </div>
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

              {/* Station Parameters (Battery / Telemetry / SIM) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                <div className="bg-[#08080a] border border-[#131316] rounded-md p-4 space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-wider flex items-center justify-between">
                    <span>SIM Telemetry</span>
                    <Smartphone className="h-3 w-3 text-blue-400" />
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">SIM Number:</span>
                    <span className="text-xs font-mono font-bold text-blue-400 flex items-center gap-1">
                      {activeStation.simNumber || ('984' + String(1000000 + ((activeStation.stationId * 48291) % 9000000)))}
                      <button 
                        onClick={() => handleCopySimNumber(activeStation.simNumber || ('984' + String(1000000 + ((activeStation.stationId * 48291) % 9000000))))}
                        title="Copy SIM Number"
                        className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition cursor-pointer"
                      >
                        {copiedSimNumber === (activeStation.simNumber || ('984' + String(1000000 + ((activeStation.stationId * 48291) % 9000000)))) ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Carrier Balance:</span>
                    <button 
                      onClick={() => setActiveTab('sim')}
                      className="text-[10px] font-mono text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Check in SIM Tab &rarr;
                    </button>
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

              {/* Station Maintenance & Work Orders Section */}
              {(() => {
                const stationTickets = tickets.filter(t => t.stationId === activeStation.stationId);
                const stationTicketNums = stationTickets.map(t => t.ticketNumber);
                const stationWOs = workOrders.filter(w => w.ticketNumbers.some(num => stationTicketNums.includes(num)));

                return (
                  <div className="space-y-4 pt-6 border-t border-[#1f1f23]">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-amber-400" />
                          Station Maintenance & Work Orders ({stationTickets.length + stationWOs.length})
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Active tickets, work order dispatches, and maintenance status for {activeStation.stationName}.</p>
                      </div>

                      <button
                        onClick={() => {
                          setTicketModalStationId(activeStation.stationId);
                          setIsCreateTicketModalOpen(true);
                        }}
                        className="px-3 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Report Issue / Create Ticket</span>
                      </button>
                    </div>

                    {stationTickets.length === 0 && stationWOs.length === 0 ? (
                      <div className="p-4 bg-[#08080a] border border-dashed border-[#1f1f23] rounded-md text-center">
                        <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                        <p className="text-xs text-zinc-400 font-medium">No open maintenance tickets or work orders logged for this station.</p>
                        <button
                          onClick={() => {
                            setTicketModalStationId(activeStation.stationId);
                            setIsCreateTicketModalOpen(true);
                          }}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 hover:underline cursor-pointer"
                        >
                          + Create Maintenance Ticket now
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                        {/* Linked Tickets */}
                        {stationTickets.map(t => (
                          <div 
                            key={t.ticketNumber}
                            className="bg-[#08080a] border border-[#1f1f23] hover:border-amber-500/30 p-3.5 rounded-md space-y-2 transition"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-xs text-amber-400">#{t.ticketNumber}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-mono font-bold ${
                                  t.priority === 'Emergency' ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' :
                                  t.priority === 'High' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
                                  'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                }`}>
                                  {t.priority || 'Medium'}
                                </span>
                                <span className="text-[9px] px-2 py-0.5 rounded border bg-zinc-800 text-zinc-300 border-zinc-700 uppercase font-mono">
                                  {t.status}
                                </span>
                              </div>

                              {onNavigateToMaintenance && (
                                <button
                                  onClick={() => onNavigateToMaintenance({ tab: 'tickets', ticketNumber: t.ticketNumber, stationId: activeStation.stationId })}
                                  className="text-[10px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                                >
                                  Manage in Maintenance Module &rarr;
                                </button>
                              )}
                            </div>

                            <p className="text-xs text-white font-medium">{t.summary}</p>
                            <p className="text-[11px] text-zinc-400 line-clamp-2">{t.description}</p>

                            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-[#131316] pt-2">
                              <span>Assignee: <strong className="text-zinc-300 font-sans">{t.assignedTo}</strong></span>
                              <span>Created: {t.createdAt}</span>
                              {t.workOrderId && (
                                <span className="text-purple-400 font-bold">WO: {t.workOrderId}</span>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Linked Work Orders */}
                        {stationWOs.map(w => (
                          <div 
                            key={w.workOrderId}
                            className="bg-[#0c0a14] border border-purple-500/30 hover:border-purple-500/50 p-3.5 rounded-md space-y-2 transition"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-xs text-purple-400">{w.workOrderId}</span>
                                <span className="text-[9px] px-2 py-0.5 rounded border bg-purple-500/20 text-purple-300 border-purple-500/40 uppercase font-mono font-bold">
                                  Work Order
                                </span>
                                <span className="text-[9px] px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 uppercase font-mono">
                                  {w.status}
                                </span>
                              </div>

                              {onNavigateToMaintenance && (
                                <button
                                  onClick={() => onNavigateToMaintenance({ tab: 'work-orders', workOrderId: w.workOrderId, stationId: activeStation.stationId })}
                                  className="text-[10px] font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                                >
                                  Inspect Work Order &rarr;
                                </button>
                              )}
                            </div>

                            <p className="text-xs text-white font-medium">{w.workOrderTitle}</p>
                            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 border-t border-purple-500/10 pt-2">
                              <span>Team: {w.assignedTeam}</span>
                              <span>Scheduled: {w.scheduledDate}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

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

      {/* VIEW 2: SIM DETAILS & BULK BALANCE CHECK */}
      {activeTab === 'sim' && (
        <div className="space-y-6">
          {/* Top Bulk Balance & Export Action Bar */}
          <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1f1f23] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-blue-400" />
                  <h3 className="text-base font-serif italic text-white font-medium">SIM Telemetry & Balance Directory</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    {stations.length} Station SIMs Configured
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Monitor SIM numbers, check carrier data volumes, verify main balance, and export bulk reports to Excel.
                </p>
              </div>

              {/* Bulk Action Controls */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  id="bulk-balance-check-btn"
                  disabled={isBulkChecking}
                  onClick={() => {
                    const targetStations = selectedSimStationIds.length > 0 
                      ? stations.filter(s => selectedSimStationIds.includes(s.stationId))
                      : filteredSimStations;
                    handleBulkCheckBalances(targetStations);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md text-xs font-semibold transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  {isBulkChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span>
                    Bulk Check Balance ({selectedSimStationIds.length > 0 ? selectedSimStationIds.length : filteredSimStations.length})
                  </span>
                </button>

                <button
                  id="sim-export-excel-btn"
                  onClick={() => handleExportExcel(filteredSimStations)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#131316] hover:bg-zinc-800 text-zinc-200 border border-[#1f1f23] rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  <span>Export to Excel (.csv)</span>
                </button>
              </div>
            </div>

            {/* Bulk Check Progress Indicator */}
            {isBulkChecking && (
              <div className="space-y-1.5 bg-[#131316] p-3 rounded-md border border-emerald-500/30">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-emerald-400 font-semibold flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                    Querying Telemetry Carriers via USSD Gateway...
                  </span>
                  <span className="text-zinc-400">{bulkCheckProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#0a0a0c] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${bulkCheckProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Filter & Selection Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              {/* Search & Filter */}
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search by Station Name, SIM Number, or Region..."
                    value={simSearchQuery}
                    onChange={(e) => setSimSearchQuery(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white placeholder-zinc-600 focus:border-blue-500/50 rounded-md pl-9 pr-3 py-1.5 text-xs focus:outline-none transition font-sans"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  <select
                    value={simStatusFilter}
                    onChange={(e) => setSimStatusFilter(e.target.value as any)}
                    className="bg-[#131316] border border-[#1f1f23] text-zinc-300 focus:border-blue-500/50 rounded-md py-1.5 px-3 text-xs focus:outline-none transition font-mono cursor-pointer"
                  >
                    <option value="All">All SIM Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Low Balance">Low Balance</option>
                    <option value="Expiring Soon">Expiring Soon</option>
                  </select>
                </div>
              </div>

              {/* Selection Summary */}
              <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                <button
                  onClick={() => handleSelectAllSims(filteredSimStations.map(s => s.stationId))}
                  className="px-2.5 py-1 bg-[#131316] hover:bg-zinc-800 text-zinc-300 border border-[#1f1f23] rounded text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {selectedSimStationIds.length === filteredSimStations.length && filteredSimStations.length > 0 ? (
                    <CheckSquare className="h-3.5 w-3.5 text-blue-400" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-zinc-500" />
                  )}
                  Select All ({filteredSimStations.length})
                </button>
                {selectedSimStationIds.length > 0 && (
                  <span className="text-blue-400 font-semibold bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded">
                    {selectedSimStationIds.length} Selected
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SIM Details Table */}
          <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#131316] border-b border-[#1f1f23] text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                    <th className="py-3 px-4 w-10 text-center">
                      <input 
                        type="checkbox"
                        checked={selectedSimStationIds.length === filteredSimStations.length && filteredSimStations.length > 0}
                        onChange={() => handleSelectAllSims(filteredSimStations.map(s => s.stationId))}
                        className="rounded bg-[#0a0a0c] border-[#1f1f23] text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Station Name</th>
                    <th className="py-3 px-4">SIM Number</th>
                    <th className="py-3 px-4 text-center">Check Balance</th>
                    <th className="py-3 px-4">Remaining Volume</th>
                    <th className="py-3 px-4">Remaining Balance</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#131316] text-xs font-mono">
                  {filteredSimStations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-500 font-mono">
                        No SIM telemetry entries match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSimStations.map((station) => {
                      const simInfo = getStationSimInfo(station);
                      const isSelected = selectedSimStationIds.includes(station.stationId);
                      const isChecking = checkingSingleId === station.stationId;

                      return (
                        <tr 
                          key={station.stationId} 
                          className={`hover:bg-[#131316]/50 transition ${isSelected ? 'bg-blue-500/5' : ''}`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectSimStation(station.stationId)}
                              className="rounded bg-[#0a0a0c] border-[#1f1f23] text-blue-600 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 font-sans font-medium text-white">
                            <div>
                              <span>{station.stationName}</span>
                              <span className="block text-[10px] text-zinc-500 font-mono">{station.region}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-blue-400 font-bold">
                            <div className="flex items-center gap-1.5">
                              <span>{simInfo.simNumber}</span>
                              <button
                                onClick={() => handleCopySimNumber(simInfo.simNumber)}
                                title="Copy SIM Number"
                                className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-white transition cursor-pointer"
                              >
                                {copiedSimNumber === simInfo.simNumber ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              disabled={isChecking}
                              onClick={() => handleCheckSingleBalance(station)}
                              className="px-2.5 py-1 bg-[#131316] hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded text-[11px] font-mono transition cursor-pointer flex items-center justify-center gap-1 mx-auto disabled:opacity-50"
                            >
                              {isChecking ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                                  Checking...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-3 w-3" />
                                  Check Balance
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-zinc-200">
                            <div className="flex items-center gap-1.5">
                              <Wifi className="h-3 w-3 text-emerald-400" />
                              <span>{simInfo.remainingVolume}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            <span>{simInfo.remainingBalance}</span>
                          </td>
                          <td className="py-3 px-4 text-zinc-400">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-zinc-500" />
                              <span>{simInfo.expiryDate}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
                              simInfo.status === 'Active' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                              simInfo.status === 'Low Balance' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                              'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            }`}>
                              {simInfo.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {isCreateTicketModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e0e12] border border-[#1f1f23] rounded-lg max-w-lg w-full p-6 space-y-5 relative shadow-2xl">
            <button 
              onClick={() => setIsCreateTicketModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-3 border-b border-[#1f1f23] pb-4">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Create Maintenance Ticket</h3>
                <p className="text-xs text-zinc-400">Log an issue or maintenance dispatch for a weather station.</p>
              </div>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const targetStId = ticketModalStationId || selectedStationId || (stations[0]?.stationId);
              const targetSt = stations.find(s => s.stationId === targetStId);
              if (!targetSt || !ticketSummary.trim() || !ticketDescription.trim()) {
                alert('Please fill out the ticket summary and description.');
                return;
              }

              const created = saveTicket({
                stationId: targetSt.stationId,
                stationName: targetSt.stationName,
                region: targetSt.region,
                status: ticketStatus,
                summary: ticketSummary.trim(),
                description: ticketDescription.trim(),
                priority: ticketPriority,
                assignedTo: ticketAssignedTo,
                createdBy: role || 'birajkdl'
              }, ticketAssignedEmail);

              const linkUrl = `${window.location.origin}${window.location.pathname}?ticket=${created.ticketNumber}`;
              setTicketSuccessToast({ ticketNumber: created.ticketNumber, linkUrl });
              setIsCreateTicketModalOpen(false);
              setTicketSummary('');
              setTicketDescription('');
            }} className="space-y-4">
              <div>
                <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Target Weather Station</label>
                <select
                  value={ticketModalStationId || selectedStationId || (stations[0]?.stationId) || ''}
                  onChange={(e) => setTicketModalStationId(Number(e.target.value))}
                  className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded-md p-2.5 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {stations.map(st => (
                    <option key={st.stationId} value={st.stationId}>
                      {st.stationName} ({st.region})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Issue Category / Status</label>
                  <select
                    value={ticketStatus}
                    onChange={(e) => setTicketStatus(e.target.value)}
                    className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded-md p-2.5 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="No communication">No communication</option>
                    <option value="Warning">Warning</option>
                    <option value="critical">Critical</option>
                    <option value="sensor issue">Sensor Issue</option>
                    <option value="firmware issue">Firmware Issue</option>
                    <option value="others">Others</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Priority Level</label>
                  <select
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value as any)}
                    className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded-md p-2.5 text-xs focus:outline-none focus:border-amber-500 cursor-pointer font-bold text-amber-400"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Issue Summary (Title)</label>
                <input
                  type="text"
                  placeholder="e.g. Telemetry modem non-responsive following storm"
                  value={ticketSummary}
                  onChange={(e) => setTicketSummary(e.target.value)}
                  className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded-md p-2.5 text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Detailed Description & Symptoms</label>
                <textarea
                  rows={3}
                  placeholder="Provide technical details, voltage levels, or error codes observed..."
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded-md p-2.5 text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1f1f23]">
                <div>
                  <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Assigned Technician</label>
                  <input
                    type="text"
                    value={ticketAssignedTo}
                    onChange={(e) => setTicketAssignedTo(e.target.value)}
                    className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded-md p-2 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Assignee Email (Notification)</label>
                  <input
                    type="email"
                    value={ticketAssignedEmail}
                    onChange={(e) => setTicketAssignedEmail(e.target.value)}
                    className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded-md p-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateTicketModalOpen(false)}
                  className="px-4 py-2 bg-[#1f1f23] hover:bg-zinc-800 text-zinc-300 rounded-md text-xs font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-md text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-md shadow-amber-950/40"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Create & Dispatch Link</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Success Toast Banner */}
      {ticketSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-[#0f1710] border border-emerald-500/40 text-white rounded-xl p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-emerald-400">Maintenance Ticket #{ticketSuccessToast.ticketNumber} Created!</h4>
                <p className="text-[11px] text-zinc-300">Assignment notification & direct access link sent.</p>
              </div>
            </div>
            <button 
              onClick={() => setTicketSuccessToast(null)}
              className="text-zinc-500 hover:text-white p-1 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-[#050b06] border border-emerald-500/20 p-2 rounded text-[10px] font-mono text-emerald-300 break-all flex items-center justify-between gap-2">
            <span className="truncate">{ticketSuccessToast.linkUrl}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(ticketSuccessToast.linkUrl);
                alert('Ticket direct link copied to clipboard!');
              }}
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded shrink-0 font-sans text-[10px] font-bold cursor-pointer flex items-center gap-1"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
          </div>

          {onNavigateToMaintenance && (
            <button
              onClick={() => {
                const num = ticketSuccessToast.ticketNumber;
                setTicketSuccessToast(null);
                onNavigateToMaintenance({ tab: 'tickets', ticketNumber: num });
              }}
              className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Ticket Details in Maintenance &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
