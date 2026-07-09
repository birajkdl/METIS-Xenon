import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  History, 
  User, 
  MapPin, 
  Building2, 
  BellRing,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';
import { Sensor, WeatherStation } from '../types.ts';

interface AlertsViewProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  isAuthenticated: boolean;
  onDismissAlert: (sensorId: number) => Promise<void>;
  onRefresh: () => void;
}

export default function AlertsView({
  sensors,
  stations,
  isAuthenticated,
  onDismissAlert,
  onRefresh
}: AlertsViewProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'out_of_calibration' | 'faulty' | 'due_soon'>('all');
  const [showDismissed, setShowDismissed] = useState<boolean>(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const [dismissingIds, setDismissingIds] = useState<Record<number, boolean>>({});

  // Calculate dates
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(today.getDate() + 30);
  const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];

  // Map sensors to alerts
  const allAlerts = sensors.filter(sensor => sensor.status !== 'Retired').flatMap(sensor => {
    const alertsList = [];
    const lastCal = sensor.lastCalibration;
    const isDismissed = sensor.dismissedAlert === 'true';

    // 1. Faulty alert
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

    // 2. Out of calibration alert (overdue)
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

    // 3. Maintenance due soon alert (within 30 days and not passed)
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

  // Filter alerts based on selection and dismissal state
  const filteredAlerts = allAlerts.filter(alert => {
    // Dismissed filter
    if (!showDismissed && alert.dismissed) {
      return false;
    }
    // Category filter
    if (activeFilter !== 'all' && alert.type !== activeFilter) {
      return false;
    }
    return true;
  });

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

  // Counting for badges
  const totalCount = allAlerts.filter(a => !a.dismissed).length;
  const overdueCount = allAlerts.filter(a => a.type === 'out_of_calibration' && !a.dismissed).length;
  const faultyCount = allAlerts.filter(a => a.type === 'faulty' && !a.dismissed).length;
  const dueSoonCount = allAlerts.filter(a => a.type === 'due_soon' && !a.dismissed).length;

  return (
    <div className="flex-1 overflow-y-auto p-10 max-w-7xl mx-auto w-full bg-[#050505]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-6 border-b border-[#1f1f23]">
        <div>
          <h2 className="font-serif italic text-2xl md:text-3xl tracking-wide text-white">
            Active Alert Center
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Real-time diagnostic sensor grid alerts, calibration checks, and active maintenance warnings.
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
          >
            {showDismissed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>{showDismissed ? 'Hide Dismissed Alerts' : 'Show Dismissed Alerts'}</span>
          </button>
        </div>
      </div>

      {/* Alert Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-4">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Total Pending Alerts</p>
          <p className="text-2xl font-serif italic text-white mt-1">{totalCount}</p>
        </div>
        <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-4">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            Out of Calibration
          </p>
          <p className="text-2xl font-serif italic text-white mt-1">{overdueCount}</p>
        </div>
        <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-4">
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            Faulty / Maintenance
          </p>
          <p className="text-2xl font-serif italic text-white mt-1">{faultyCount}</p>
        </div>
        <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-4">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
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
          All Alerts ({allAlerts.filter(a => showDismissed || !a.dismissed).length})
        </button>
        <button
          onClick={() => setActiveFilter('out_of_calibration')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeFilter === 'out_of_calibration'
              ? 'border-red-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Out of Calibration ({allAlerts.filter(a => a.type === 'out_of_calibration' && (showDismissed || !a.dismissed)).length})
        </button>
        <button
          onClick={() => setActiveFilter('faulty')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeFilter === 'faulty'
              ? 'border-orange-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Faulty / Maintenance ({allAlerts.filter(a => a.type === 'faulty' && (showDismissed || !a.dismissed)).length})
        </button>
        <button
          onClick={() => setActiveFilter('due_soon')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeFilter === 'due_soon'
              ? 'border-amber-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Due Soon ({allAlerts.filter(a => a.type === 'due_soon' && (showDismissed || !a.dismissed)).length})
        </button>
      </div>

      {/* Main Alerts Feed */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-16 text-center text-zinc-500">
            <BellRing className="h-10 w-10 text-zinc-700 mx-auto mb-2" />
            <p className="font-serif italic text-sm text-white">No active alerts matched current criteria.</p>
            <p className="text-xs text-zinc-500 mt-2">All sensor grids operating within standard nominal tolerances.</p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
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
                {/* Main Row */}
                <div className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
                  
                  {/* Left content: Icon + Title + Info */}
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

                      {/* Station Info */}
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

                  {/* Right actions: Dismiss Alert, History logs toggle */}
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
                        title={isAuthenticated ? "Dismiss this alert" : "Authenticate to dismiss alerts"}
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

                {/* Expanded Logs Section */}
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
    </div>
  );
}
