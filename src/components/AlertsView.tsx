import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  History, 
  MapPin, 
  Building2, 
  BellRing,
  Eye,
  EyeOff,
  Check,
  Radio,
  Sliders,
  ShieldAlert,
  Wrench,
  Zap,
  RefreshCw,
  SlidersHorizontal,
  Activity,
  Send,
  X,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Sensor, WeatherStation } from '../types.ts';
import { 
  generateGBONThresholdAlerts, 
  getNextGBONWindowInfo, 
  getStoredThresholds, 
  saveStoredThresholds, 
  GBONThresholdConfig, 
  GBONAlertItem 
} from '../utils/gbonThresholds.ts';
import { saveTicket } from '../utils/maintenance.ts';

interface AlertsViewProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  isAuthenticated: boolean;
  onDismissAlert: (sensorId: number) => Promise<void>;
  onRefresh: () => void;
  onNavigateToMaintenance?: (target: { tab?: 'tickets' | 'work-orders'; ticketNumber?: string; workOrderId?: string; stationId?: number }) => void;
}

export default function AlertsView({
  sensors,
  stations,
  isAuthenticated,
  onDismissAlert,
  onRefresh,
  onNavigateToMaintenance
}: AlertsViewProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'gbon_risk' | 'out_of_calibration' | 'faulty' | 'due_soon'>('all');
  const [showDismissed, setShowDismissed] = useState<boolean>(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const [dismissingIds, setDismissingIds] = useState<Record<number, boolean>>({});

  // GBON Threshold Config Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [thresholds, setThresholds] = useState<GBONThresholdConfig>(getStoredThresholds());
  const [tempThresholds, setTempThresholds] = useState<GBONThresholdConfig>(thresholds);

  // Quick Dispatch Modal State
  const [dispatchAlertItem, setDispatchAlertItem] = useState<GBONAlertItem | null>(null);
  const [dispatchSummary, setDispatchSummary] = useState('');
  const [dispatchDescription, setDispatchDescription] = useState('');
  const [dispatchPriority, setDispatchPriority] = useState<'Low' | 'Medium' | 'High' | 'Emergency'>('High');
  const [dispatchAssignedTo, setDispatchAssignedTo] = useState('alex_field_tech');
  const [dispatchSuccessToast, setDispatchSuccessToast] = useState<{ ticketNumber: string; linkUrl: string } | null>(null);

  // Real-time GBON Window Countdown State
  const [gbonInfo, setGbonInfo] = useState(getNextGBONWindowInfo());

  useEffect(() => {
    const timer = setInterval(() => {
      setGbonInfo(getNextGBONWindowInfo());
    }, 10000); // refresh countdown every 10s
    return () => clearInterval(timer);
  }, []);

  // Listen to threshold updates
  useEffect(() => {
    const handleThresholdUpdate = () => {
      setThresholds(getStoredThresholds());
    };
    window.addEventListener('metis_thresholds_updated', handleThresholdUpdate);
    return () => window.removeEventListener('metis_thresholds_updated', handleThresholdUpdate);
  }, []);

  // Dates
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(today.getDate() + 30);
  const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];

  // 1. Standard Sensor Calibration/Fault Alerts
  const standardAlerts = useMemo(() => {
    return sensors.filter(sensor => sensor.status !== 'Retired').flatMap(sensor => {
      const alertsList = [];
      const lastCal = sensor.lastCalibration;
      const isDismissed = sensor.dismissedAlert === 'true';

      // Faulty
      const isFaulty = sensor.status === 'Maintenance' || (lastCal && lastCal.result === 'Failed');
      if (isFaulty) {
        alertsList.push({
          id: `faulty-${sensor.sensorId}`,
          sensor,
          type: 'faulty' as const,
          severity: 'high' as const,
          title: 'Hardware Fault / Maintenance required',
          message: lastCal?.result === 'Failed' 
            ? `Last calibration on ${lastCal.calibrationDate} failed. Sensor registered out-of-spec readings.`
            : 'Sensor flagged in maintenance mode. Field technician inspection required.',
          dateStr: lastCal?.calibrationDate || 'N/A',
          dismissed: isDismissed
        });
      }

      // Out of calibration (overdue)
      const isOverdue = lastCal && lastCal.nextDueDate < todayStr;
      if (isOverdue) {
        alertsList.push({
          id: `overdue-${sensor.sensorId}`,
          sensor,
          type: 'out_of_calibration' as const,
          severity: 'high' as const,
          title: 'Calibration Overdue',
          message: `Mandatory diagnostic verification was due on ${lastCal.nextDueDate}. Currently operating past accuracy window.`,
          dateStr: lastCal.nextDueDate,
          dismissed: isDismissed
        });
      }

      // Due soon
      const isDueSoon = lastCal && lastCal.nextDueDate >= todayStr && lastCal.nextDueDate <= thirtyDaysLaterStr;
      if (isDueSoon) {
        alertsList.push({
          id: `due-soon-${sensor.sensorId}`,
          sensor,
          type: 'due_soon' as const,
          severity: 'medium' as const,
          title: 'Recalibration Due Soon',
          message: `Accuracy validation schedule approaching. Calibration due on ${lastCal.nextDueDate}.`,
          dateStr: lastCal.nextDueDate,
          dismissed: isDismissed
        });
      }

      return alertsList;
    });
  }, [sensors, todayStr, thirtyDaysLaterStr]);

  // 2. Mandatory GBON Threshold Alerts
  const gbonThresholdAlerts = useMemo(() => {
    return generateGBONThresholdAlerts(stations, sensors, thresholds);
  }, [stations, sensors, thresholds]);

  // Combined Alert Feed
  const allAlertsCount = standardAlerts.filter(a => showDismissed || !a.dismissed).length + gbonThresholdAlerts.filter(a => showDismissed || !a.dismissed).length;
  const gbonRiskCount = gbonThresholdAlerts.filter(a => showDismissed || !a.dismissed).length;
  const overdueCount = standardAlerts.filter(a => a.type === 'out_of_calibration' && (showDismissed || !a.dismissed)).length;
  const faultyCount = standardAlerts.filter(a => a.type === 'faulty' && (showDismissed || !a.dismissed)).length;
  const dueSoonCount = standardAlerts.filter(a => a.type === 'due_soon' && (showDismissed || !a.dismissed)).length;

  const handleDismiss = async (sensorId: number) => {
    if (!isAuthenticated) return;
    setDismissingIds(prev => ({ ...prev, [sensorId]: true }));
    try {
      await onDismissAlert(sensorId);
    } catch (err) {
      console.error(err);
    } finally {
      setDismissingIds(prev => ({ ...prev, [sensorId]: false }));
    }
  };

  const toggleLogs = (sensorId: number) => {
    setExpandedLogs(prev => ({ ...prev, [sensorId]: !prev[sensorId] }));
  };

  const handleSaveThresholds = () => {
    saveStoredThresholds(tempThresholds);
    setThresholds(tempThresholds);
    setIsConfigModalOpen(false);
  };

  const handleOpenDispatchModal = (item: GBONAlertItem) => {
    setDispatchAlertItem(item);
    setDispatchSummary(`[GBON THRESHOLD RISK] ${item.title}`);
    setDispatchDescription(`Emergency dispatch generated from GBON Threshold Monitor.\nStation: ${item.stationName} (${item.region})\nSymptom: ${item.symptomValue}\nThreshold Rule: ${item.thresholdLimit}\nUpcoming Mandatory Window: ${item.nextGbonWindowUtc} (${item.minutesToGbonWindow} mins remaining).\nDetails: ${item.message}`);
    setDispatchPriority(item.severity === 'critical' ? 'Emergency' : 'High');
    setDispatchAssignedTo('alex_field_tech');
  };

  const handleExecuteDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchAlertItem) return;

    const ticket = saveTicket({
      stationId: dispatchAlertItem.stationId,
      stationName: dispatchAlertItem.stationName,
      region: dispatchAlertItem.region,
      status: dispatchAlertItem.type === 'off_line' ? 'No communication' : 'critical',
      summary: dispatchSummary.trim(),
      description: dispatchDescription.trim(),
      priority: dispatchPriority,
      assignedTo: dispatchAssignedTo,
      createdBy: 'GBON Threshold Engine'
    }, 'birajkdl@gmail.com');

    const linkUrl = `${window.location.origin}${window.location.pathname}?ticket=${ticket.ticketNumber}`;
    setDispatchSuccessToast({ ticketNumber: ticket.ticketNumber, linkUrl });
    setDispatchAlertItem(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-7xl mx-auto w-full bg-[#050505]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-[#1f1f23]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif italic text-2xl md:text-3xl tracking-wide text-white">
              Active Alert & Threshold Center
            </h2>
            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold rounded uppercase">
              WMO GBON Guard
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Real-time diagnostic sensor grid alerts, off-line thresholds, out-of-tolerance detection, and GBON window protection.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setTempThresholds(thresholds);
              setIsConfigModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 text-amber-300 border border-amber-500/40 rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
            <span>Configure Threshold Rules</span>
          </button>

          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
          >
            {showDismissed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>{showDismissed ? 'Hide Dismissed' : 'Show Dismissed'}</span>
          </button>
        </div>
      </div>

      {/* GBON Transmission Window Banner */}
      <div className="mb-8 bg-gradient-to-r from-[#120e06] via-[#1c1208] to-[#120e06] border border-amber-500/30 rounded-lg p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-400 shrink-0 mt-0.5">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-200 tracking-wide">
                  Upcoming Mandatory GBON Transmission Window: <span className="font-mono text-white underline">{gbonInfo.nextWindowUtc}</span>
                </h3>
                <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold rounded">
                  {gbonInfo.minutesLeft} mins remaining
                </span>
              </div>
              <p className="text-xs text-amber-200/80 mt-1 max-w-3xl">
                WMO Global Basic Observing Network mandate requires observational data frame transmission without interruption. Thresholds monitor for telemetry lag, off-line sensors, battery drops, and out-of-tolerance drift before transmission windows close.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
            <div className="text-right">
              <span className="text-[10px] font-mono font-bold text-amber-400/80 uppercase block">At-Risk GBON Assets</span>
              <span className={`font-mono text-xl font-bold ${gbonRiskCount > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                {gbonRiskCount} {gbonRiskCount === 1 ? 'Station' : 'Stations'}
              </span>
            </div>

            <button
              onClick={() => setActiveFilter('gbon_risk')}
              className="px-3 py-2 bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400 rounded-md text-xs transition cursor-pointer flex items-center gap-1 shadow-md"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Inspect Risks</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alert Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div 
          onClick={() => setActiveFilter('all')}
          className={`bg-[#0f0f12] border rounded-md p-4 cursor-pointer transition ${
            activeFilter === 'all' ? 'border-blue-500/60 bg-blue-500/5' : 'border-[#1f1f23] hover:border-zinc-700'
          }`}
        >
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Total Pending</p>
          <p className="text-2xl font-serif italic text-white mt-1">{allAlertsCount}</p>
        </div>

        <div 
          onClick={() => setActiveFilter('gbon_risk')}
          className={`bg-[#0f0f12] border rounded-md p-4 cursor-pointer transition ${
            activeFilter === 'gbon_risk' ? 'border-amber-500/60 bg-amber-500/5' : 'border-[#1f1f23] hover:border-zinc-700'
          }`}
        >
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            GBON Window Risks
          </p>
          <p className="text-2xl font-serif italic text-white mt-1">{gbonRiskCount}</p>
        </div>

        <div 
          onClick={() => setActiveFilter('out_of_calibration')}
          className={`bg-[#0f0f12] border rounded-md p-4 cursor-pointer transition ${
            activeFilter === 'out_of_calibration' ? 'border-red-500/60 bg-red-500/5' : 'border-[#1f1f23] hover:border-zinc-700'
          }`}
        >
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            Out of Calibration
          </p>
          <p className="text-2xl font-serif italic text-white mt-1">{overdueCount}</p>
        </div>

        <div 
          onClick={() => setActiveFilter('faulty')}
          className={`bg-[#0f0f12] border rounded-md p-4 cursor-pointer transition ${
            activeFilter === 'faulty' ? 'border-orange-500/60 bg-orange-500/5' : 'border-[#1f1f23] hover:border-zinc-700'
          }`}
        >
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            Faulty / Maintenance
          </p>
          <p className="text-2xl font-serif italic text-white mt-1">{faultyCount}</p>
        </div>

        <div 
          onClick={() => setActiveFilter('due_soon')}
          className={`bg-[#0f0f12] border rounded-md p-4 cursor-pointer transition ${
            activeFilter === 'due_soon' ? 'border-amber-500/60 bg-amber-500/5' : 'border-[#1f1f23] hover:border-zinc-700'
          }`}
        >
          <p className="text-[10px] font-bold text-amber-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Due Soon
          </p>
          <p className="text-2xl font-serif italic text-white mt-1">{dueSoonCount}</p>
        </div>
      </div>

      {/* Filtering Tabs */}
      <div className="flex border-b border-[#1f1f23] mb-6 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveFilter('all')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeFilter === 'all'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          All Alerts ({allAlertsCount})
        </button>

        <button
          onClick={() => setActiveFilter('gbon_risk')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeFilter === 'gbon_risk'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-500 hover:text-amber-400'
          }`}
        >
          <Radio className="h-3.5 w-3.5 text-amber-400" />
          GBON Window & Thresholds ({gbonRiskCount})
        </button>

        <button
          onClick={() => setActiveFilter('out_of_calibration')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeFilter === 'out_of_calibration'
              ? 'border-red-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Out of Calibration ({overdueCount})
        </button>

        <button
          onClick={() => setActiveFilter('faulty')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeFilter === 'faulty'
              ? 'border-orange-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Faulty / Maintenance ({faultyCount})
        </button>

        <button
          onClick={() => setActiveFilter('due_soon')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeFilter === 'due_soon'
              ? 'border-amber-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Due Soon ({dueSoonCount})
        </button>
      </div>

      {/* Main Alerts Feed */}
      <div className="space-y-4">
        {/* Section 1: GBON Threshold Alerts (Shown when filter is 'all' or 'gbon_risk') */}
        {(activeFilter === 'all' || activeFilter === 'gbon_risk') && gbonThresholdAlerts.length > 0 && (
          <div className="space-y-3 mb-6">
            <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              GBON Pre-Transmission Window Threshold Alerts ({gbonThresholdAlerts.length})
            </h3>

            {gbonThresholdAlerts.map(item => (
              <div
                key={item.id}
                className="bg-[#0e0c08] border border-amber-500/40 hover:border-amber-500/70 rounded-md p-5 transition space-y-3 shadow-md"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-2.5 rounded shrink-0 border ${
                      item.severity === 'critical' 
                        ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse' 
                        : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    }`}>
                      <Zap className="h-5 w-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/40 uppercase">
                          GBON THRESHOLD ALERT
                        </span>
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                          item.severity === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                        }`}>
                          {item.severity}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          Next Window: <strong className="text-amber-200">{item.nextGbonWindowUtc}</strong> ({item.minutesToGbonWindow} mins)
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white tracking-wide mt-1">
                        {item.title}
                      </h4>
                      <p className="text-xs text-zinc-300 mt-1 max-w-2xl">
                        {item.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] font-mono text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Station: <strong className="text-zinc-200">{item.stationName}</strong> ({item.region})</span>
                        </div>
                        <div className="bg-[#18120a] border border-amber-500/20 px-2 py-0.5 rounded text-[10px] text-amber-300">
                          Symptom: <strong>{item.symptomValue}</strong>
                        </div>
                        <div className="bg-[#14121a] border border-purple-500/20 px-2 py-0.5 rounded text-[10px] text-purple-300">
                          Threshold: <strong>{item.thresholdLimit}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-start">
                    <button
                      onClick={() => handleOpenDispatchModal(item)}
                      className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-md shadow-amber-950/40"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      <span>Dispatch Maintenance</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section 2: Standard Sensor Alerts */}
        {activeFilter !== 'gbon_risk' && (
          <div className="space-y-4">
            {standardAlerts.filter(a => showDismissed || !a.dismissed).length === 0 && activeFilter !== 'all' ? (
              <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-12 text-center text-zinc-500">
                <BellRing className="h-10 w-10 text-zinc-700 mx-auto mb-2" />
                <p className="font-serif italic text-sm text-white">No active alerts matched current criteria.</p>
              </div>
            ) : (
              standardAlerts.filter(a => showDismissed || !a.dismissed).map(alert => {
                const sensor = alert.sensor;
                const isDismissed = alert.dismissed;
                
                return (
                  <div 
                    key={alert.id} 
                    className={`bg-[#0f0f12] border rounded-md overflow-hidden transition-all duration-200 ${
                      isDismissed 
                        ? 'border-zinc-800 opacity-60' 
                        : alert.severity === 'high' 
                          ? 'border-red-900/30 hover:border-red-900/50' 
                          : 'border-amber-900/30 hover:border-amber-900/50'
                    }`}
                  >
                    <div className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex items-start space-x-4">
                        <div className={`p-2.5 rounded-sm shrink-0 mt-0.5 border ${
                          isDismissed
                            ? 'bg-[#131316] border-zinc-800 text-zinc-500'
                            : alert.type === 'faulty'
                              ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                              : alert.type === 'out_of_calibration'
                                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                          {alert.type === 'faulty' && <XCircle className="h-5 w-5" />}
                          {alert.type === 'out_of_calibration' && <AlertTriangle className="h-5 w-5" />}
                          {alert.type === 'due_soon' && <Clock className="h-5 w-5" />}
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-zinc-500 font-semibold uppercase">
                              SEN-{sensor.sensorId.toString().padStart(4, '0')}
                            </span>
                            <span className="text-zinc-600">|</span>
                            <span className="text-xs text-zinc-300 font-medium">{sensor.sensorType}</span>
                            <span className="text-zinc-700 font-mono text-[10px]">({sensor.manufacturer})</span>
                            
                            {isDismissed && (
                              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-sm text-[9px] font-mono font-semibold uppercase tracking-widest">
                                Dismissed
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-semibold text-white tracking-wide mt-1">
                            {alert.title}
                          </h4>
                          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                            {alert.message}
                          </p>

                          <div className="flex flex-wrap gap-4 items-center pt-2.5 text-[11px] text-zinc-500 font-mono">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-zinc-600" />
                              <span>Station: <strong className="text-zinc-300">{sensor.stationName}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-zinc-600" />
                              <span>Region: <strong className="text-zinc-300">{sensor.region}</strong></span>
                            </div>
                            {sensor.lastCalibration && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-zinc-600" />
                                <span>Due Date: <strong className="text-zinc-300">{sensor.lastCalibration.nextDueDate}</strong></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 self-end md:self-start">
                        <button
                          onClick={() => toggleLogs(sensor.sensorId)}
                          className="flex items-center space-x-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
                          title="View status log history"
                        >
                          <History className="h-3.5 w-3.5" />
                          <span>Status Log</span>
                        </button>

                        {!isDismissed && (
                          <button
                            onClick={() => handleDismiss(sensor.sensorId)}
                            disabled={dismissingIds[sensor.sensorId] || !isAuthenticated}
                            className={`flex items-center space-x-1 px-3 py-2 border rounded-md text-xs font-semibold tracking-wide transition cursor-pointer ${
                              !isAuthenticated
                                ? 'bg-zinc-800/20 border-zinc-800/40 text-zinc-600 cursor-not-allowed'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-white/5 hover:text-white hover:border-zinc-700'
                            }`}
                          >
                            {dismissingIds[sensor.sensorId] ? (
                              <div className="w-3.5 h-3.5 border border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            <span>{isAuthenticated ? 'Dismiss' : 'Locked'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {expandedLogs[sensor.sensorId] && (
                      <div className="border-t border-[#1f1f23] bg-[#0c0c0e] p-5 font-mono text-xs">
                        <div className="flex items-center justify-between mb-3 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                          <span className="flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5 text-zinc-600" />
                            Telemetry Log State History
                          </span>
                          <span>Sensor SEN-{sensor.sensorId}</span>
                        </div>
                        {sensor.statusLog ? (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                            {sensor.statusLog.split('\n').map((line, idx) => (
                              <div key={idx} className="text-zinc-400 border-l border-zinc-800 pl-3 py-0.5 hover:bg-white/[0.01]">
                                {line}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-zinc-600 italic">
                            No telemetry logs registered for this sensor asset.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Threshold Rules Configuration Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e0e12] border border-[#1f1f23] rounded-lg max-w-xl w-full p-6 space-y-5 relative shadow-2xl">
            <button
              onClick={() => setIsConfigModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-3 border-b border-[#1f1f23] pb-4">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">GBON Threshold Alert Rules</h3>
                <p className="text-xs text-zinc-400">Set telemetry lag cutoffs and parameter tolerance bounds for WMO compliance.</p>
              </div>
            </div>

            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin">
              <div>
                <label className="text-xs font-mono font-bold text-amber-300 block mb-1">
                  Telemetry Max Silent Age (Minutes)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={tempThresholds.telemetryMaxAgeMins}
                    onChange={(e) => setTempThresholds(p => ({ ...p, telemetryMaxAgeMins: Number(e.target.value) }))}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="font-mono text-xs text-white font-bold w-16 text-right">
                    {tempThresholds.telemetryMaxAgeMins} mins
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">If telemetry frame age exceeds this window before GBON transmission, trigger Off-line Alert.</p>
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-amber-300 block mb-1">
                  Battery Min Cutoff Voltage (Volts)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="10.0"
                    max="12.5"
                    step="0.1"
                    value={tempThresholds.batteryMinVoltage}
                    onChange={(e) => setTempThresholds(p => ({ ...p, batteryMinVoltage: Number(e.target.value) }))}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="font-mono text-xs text-white font-bold w-16 text-right">
                    {tempThresholds.batteryMinVoltage.toFixed(1)} V
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Batteries below this voltage risk transmitter shutdown during night transmission windows.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1f1f23]">
                <div>
                  <label className="text-xs font-mono font-medium text-zinc-300 block mb-1">
                    Temp Min (°C)
                  </label>
                  <input
                    type="number"
                    value={tempThresholds.tempMin}
                    onChange={(e) => setTempThresholds(p => ({ ...p, tempMin: Number(e.target.value) }))}
                    className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded p-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono font-medium text-zinc-300 block mb-1">
                    Temp Max (°C)
                  </label>
                  <input
                    type="number"
                    value={tempThresholds.tempMax}
                    onChange={(e) => setTempThresholds(p => ({ ...p, tempMax: Number(e.target.value) }))}
                    className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono font-medium text-zinc-300 block mb-1">
                    Barometer Max Drift (hPa)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tempThresholds.baroDriftMaxHpa}
                    onChange={(e) => setTempThresholds(p => ({ ...p, baroDriftMaxHpa: Number(e.target.value) }))}
                    className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded p-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono font-medium text-zinc-300 block mb-1">
                    Wind Speed Max Limit (m/s)
                  </label>
                  <input
                    type="number"
                    value={tempThresholds.windSpeedMaxMs}
                    onChange={(e) => setTempThresholds(p => ({ ...p, windSpeedMaxMs: Number(e.target.value) }))}
                    className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded p-2 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1f1f23] flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 bg-[#1f1f23] hover:bg-zinc-800 text-zinc-300 rounded text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveThresholds}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded text-xs font-semibold cursor-pointer shadow-md"
              >
                Save Threshold Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Dispatch Maintenance Modal */}
      {dispatchAlertItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e0e12] border border-[#1f1f23] rounded-lg max-w-lg w-full p-6 space-y-5 relative shadow-2xl">
            <button
              onClick={() => setDispatchAlertItem(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-3 border-b border-[#1f1f23] pb-4">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Emergency GBON Dispatch</h3>
                <p className="text-xs text-zinc-400">Generate field maintenance ticket before GBON window closes.</p>
              </div>
            </div>

            <form onSubmit={handleExecuteDispatch} className="space-y-4">
              <div>
                <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Target Station</label>
                <div className="p-2.5 bg-[#08080a] border border-[#1f1f23] rounded text-xs font-mono text-amber-300">
                  {dispatchAlertItem.stationName} ({dispatchAlertItem.region})
                </div>
              </div>

              <div>
                <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Ticket Title</label>
                <input
                  type="text"
                  value={dispatchSummary}
                  onChange={(e) => setDispatchSummary(e.target.value)}
                  className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded p-2 text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Dispatch Scope & Symptoms</label>
                <textarea
                  rows={4}
                  value={dispatchDescription}
                  onChange={(e) => setDispatchDescription(e.target.value)}
                  className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded p-2 text-xs font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Priority</label>
                  <select
                    value={dispatchPriority}
                    onChange={(e) => setDispatchPriority(e.target.value as any)}
                    className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded p-2 text-xs font-bold text-amber-400 cursor-pointer"
                  >
                    <option value="High">High</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono font-medium text-zinc-400 block mb-1">Technician</label>
                  <input
                    type="text"
                    value={dispatchAssignedTo}
                    onChange={(e) => setDispatchAssignedTo(e.target.value)}
                    className="w-full bg-[#08080a] border border-[#1f1f23] text-white rounded p-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setDispatchAlertItem(null)}
                  className="px-4 py-2 bg-[#1f1f23] hover:bg-zinc-800 text-zinc-300 rounded text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded text-xs font-semibold cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Dispatch Ticket & Send Link</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Success Toast */}
      {dispatchSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-[#0f1710] border border-emerald-500/40 text-white rounded-xl p-4 shadow-2xl space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-emerald-400">GBON Ticket #{dispatchSuccessToast.ticketNumber} Dispatched!</h4>
                <p className="text-[11px] text-zinc-300">Assignment link emailed to technician.</p>
              </div>
            </div>
            <button
              onClick={() => setDispatchSuccessToast(null)}
              className="text-zinc-500 hover:text-white p-1 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {onNavigateToMaintenance && (
            <button
              onClick={() => {
                const num = dispatchSuccessToast.ticketNumber;
                setDispatchSuccessToast(null);
                onNavigateToMaintenance({ tab: 'tickets', ticketNumber: num });
              }}
              className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Ticket in Maintenance Module &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
