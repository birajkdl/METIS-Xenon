import React, { useState, useMemo, useEffect } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Database, 
  Activity, 
  Gauge, 
  Download, 
  Search, 
  Sliders, 
  ChevronRight, 
  Info, 
  RefreshCw, 
  X, 
  Zap, 
  Building2, 
  MapPin,
  Clock,
  Layers,
  Award,
  BookOpen,
  Radio,
  ShieldAlert,
  Wrench
} from 'lucide-react';
import { WeatherStation, Sensor } from '../types.ts';
import { generateGBONThresholdAlerts, getNextGBONWindowInfo } from '../utils/gbonThresholds.ts';

interface WigosComplianceDashboardProps {
  stations: WeatherStation[];
  sensors: Sensor[];
  batteryAlerts?: any[];
  onOpenEditStation?: (station: WeatherStation) => void;
  onOpenLogCalibration?: (sensorId?: number) => void;
}

export default function WigosComplianceDashboard({
  stations,
  sensors,
  batteryAlerts = [],
  onOpenEditStation,
  onOpenLogCalibration
}: WigosComplianceDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'High' | 'Warning' | 'Low'>('All');
  const [selectedStation, setSelectedStation] = useState<WeatherStation | null>(null);

  // --- Network-wide WIGOS Compliance Calculations ---
  const wigosMetrics = useMemo(() => {
    // 1. Metadata Completeness
    let totalStationFields = 0;
    let filledStationFields = 0;
    stations.forEach(st => {
      const fields = [
        st.stationName,
        st.region,
        st.latitude,
        st.longitude,
        st.stationType,
        st.simNumber,
        st.regionalOfficeId,
        st.batteryVoltageType
      ];
      totalStationFields += fields.length;
      filledStationFields += fields.filter(f => f !== null && f !== undefined && String(f).trim() !== '').length;
    });

    let totalSensorFields = 0;
    let filledSensorFields = 0;
    sensors.forEach(s => {
      const calibDueDate = s.lastCalibration?.nextDueDate || s.calibrationDueDate;
      const fields = [
        s.sensorType,
        s.modelNumber,
        s.serialNumber,
        s.regionalOfficeId,
        calibDueDate
      ];
      totalSensorFields += fields.length;
      filledSensorFields += fields.filter(f => f !== null && f !== undefined && String(f).trim() !== '').length;
    });

    const metaTotal = totalStationFields + totalSensorFields;
    const metaFilled = filledStationFields + filledSensorFields;
    const metadataCompleteness = metaTotal > 0 ? Math.round((metaFilled / metaTotal) * 100) : 100;

    // 2. Calibration Compliance
    const activeSensors = sensors.filter(s => s.status === 'Active' || s.stationId !== null);
    const compliantCalibSensors = activeSensors.filter(s => {
      if (s.status === 'Calibration Overdue' || s.status === 'In Calibration' || s.status === 'Damaged') return false;
      const calibDueDate = s.lastCalibration?.nextDueDate || s.calibrationDueDate;
      if (calibDueDate) {
        return new Date(calibDueDate) >= new Date();
      }
      return true;
    });
    const calibrationCompliance = activeSensors.length > 0 
      ? Math.round((compliantCalibSensors.length / activeSensors.length) * 100) 
      : 100;

    // 3. Maintenance Compliance
    const healthyStations = stations.filter(st => {
      const hasBattAlert = batteryAlerts.some(b => b.stationId === st.stationId);
      const hasDamaged = sensors.some(s => s.stationId === st.stationId && (s.status === 'Damaged' || s.status === 'Maintenance'));
      const voltage = st.batteryCurrentVoltage !== undefined && st.batteryCurrentVoltage !== null ? Number(st.batteryCurrentVoltage) : 12.0;
      return !hasBattAlert && !hasDamaged && voltage >= 11.5;
    });
    const maintenanceCompliance = stations.length > 0 
      ? Math.round((healthyStations.length / stations.length) * 100) 
      : 100;

    // 4. Documentation Completeness
    let docScoreSum = 0;
    stations.forEach(st => {
      let pts = 0;
      if (st.region) pts += 25;
      if (st.regionalOfficeId) pts += 25;
      if (st.stationType) pts += 25;
      const stSensors = sensors.filter(s => s.stationId === st.stationId);
      if (stSensors.some(s => s.wmoSitingClass || s.quickNote || s.documents || s.serialNumber)) pts += 25;
      docScoreSum += pts;
    });
    const documentationCompleteness = stations.length > 0 
      ? Math.round(docScoreSum / stations.length) 
      : 100;

    // 5. Station Readiness
    const stationReadiness = Math.round(
      metadataCompleteness * 0.20 +
      calibrationCompliance * 0.25 +
      maintenanceCompliance * 0.30 +
      documentationCompleteness * 0.15 +
      (healthyStations.length / (stations.length || 1) * 100) * 0.10
    );

    return {
      metadataCompleteness,
      calibrationCompliance,
      maintenanceCompliance,
      documentationCompleteness,
      stationReadiness,
      counts: {
        metaFilled,
        metaTotal,
        compliantCalibSensors: compliantCalibSensors.length,
        activeSensors: activeSensors.length,
        healthyStations: healthyStations.length,
        totalStations: stations.length
      }
    };
  }, [stations, sensors, batteryAlerts]);

  // --- Station Specific WIGOS Evaluator ---
  const stationWigosEvaluations = useMemo(() => {
    return stations.map(st => {
      const stSensors = sensors.filter(s => s.stationId === st.stationId);

      // Metadata
      const stFields = [
        st.stationName,
        st.region,
        st.latitude,
        st.longitude,
        st.stationType,
        st.simNumber,
        st.regionalOfficeId,
        st.batteryVoltageType
      ];
      const filledStFields = stFields.filter(f => f !== null && f !== undefined && String(f).trim() !== '').length;

      let sensorFieldsTotal = 0;
      let sensorFieldsFilled = 0;
      stSensors.forEach(s => {
        const calibDueDate = s.lastCalibration?.nextDueDate || s.calibrationDueDate;
        const sf = [s.sensorType, s.modelNumber, s.serialNumber, s.regionalOfficeId, calibDueDate];
        sensorFieldsTotal += sf.length;
        sensorFieldsFilled += sf.filter(f => f !== null && f !== undefined && String(f).trim() !== '').length;
      });

      const metaTot = stFields.length + sensorFieldsTotal;
      const metaFil = filledStFields + sensorFieldsFilled;
      const metadataPct = metaTot > 0 ? Math.round((metaFil / metaTot) * 100) : 100;

      // Calibration
      const compliantSensors = stSensors.filter(s => {
        if (s.status === 'Calibration Overdue' || s.status === 'In Calibration' || s.status === 'Damaged') return false;
        const calibDueDate = s.lastCalibration?.nextDueDate || s.calibrationDueDate;
        if (calibDueDate) return new Date(calibDueDate) >= new Date();
        return true;
      });
      const calibPct = stSensors.length > 0 ? Math.round((compliantSensors.length / stSensors.length) * 100) : 100;

      // Maintenance
      const hasBattAlert = batteryAlerts.some(b => b.stationId === st.stationId);
      const damagedCount = stSensors.filter(s => s.status === 'Damaged' || s.status === 'Maintenance').length;
      const voltage = st.batteryCurrentVoltage !== undefined && st.batteryCurrentVoltage !== null ? Number(st.batteryCurrentVoltage) : 12.0;
      const lowBatt = voltage < 11.5;

      let maintDeductions = 0;
      if (hasBattAlert) maintDeductions += 30;
      if (lowBatt) maintDeductions += 25;
      if (damagedCount > 0) maintDeductions += Math.min(45, damagedCount * 20);
      const maintPct = Math.max(0, 100 - maintDeductions);

      // Documentation
      let docPts = 0;
      if (st.region) docPts += 25;
      if (st.regionalOfficeId) docPts += 25;
      if (st.stationType) docPts += 25;
      if (stSensors.some(s => s.wmoSitingClass || s.quickNote || s.documents || s.serialNumber)) docPts += 25;
      const docPct = docPts;

      // Readiness
      const readinessPct = Math.round(
        metadataPct * 0.20 +
        calibPct * 0.25 +
        maintPct * 0.30 +
        docPct * 0.15 +
        (lowBatt ? 50 : 100) * 0.10
      );

      const wigosId = `0-524-0-AWS${st.stationId.toString().padStart(3, '0')}`;

      return {
        station: st,
        sensors: stSensors,
        wigosId,
        metadataPct,
        calibPct,
        maintPct,
        docPct,
        readinessPct,
        compliantSensorsCount: compliantSensors.length,
        totalSensorsCount: stSensors.length,
        damagedCount,
        hasBattAlert,
        voltage,
        missingFields: {
          simNumber: !st.simNumber,
          regionalOfficeId: !st.regionalOfficeId,
          batteryVoltageType: !st.batteryVoltageType,
          sensorsWithoutSerial: stSensors.filter(s => !s.serialNumber).length
        }
      };
    });
  }, [stations, sensors, batteryAlerts]);

  // Filtered station list
  const filteredEvaluations = useMemo(() => {
    return stationWigosEvaluations.filter(item => {
      const matchSearch = item.station.stationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.wigosId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.station.region.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchRegion = regionFilter === 'All' || item.station.region === regionFilter;
      
      let matchStatus = true;
      if (statusFilter === 'High') matchStatus = item.readinessPct >= 90;
      else if (statusFilter === 'Warning') matchStatus = item.readinessPct >= 75 && item.readinessPct < 90;
      else if (statusFilter === 'Low') matchStatus = item.readinessPct < 75;

      return matchSearch && matchRegion && matchStatus;
    });
  }, [stationWigosEvaluations, searchTerm, regionFilter, statusFilter]);

  // Unique regions
  const regions = useMemo(() => {
    const list = Array.from(new Set(stations.map(st => st.region)));
    return ['All', ...list.sort()];
  }, [stations]);

  // Export CSV
  const handleExportWigosCSV = () => {
    const headers = [
      "WIGOS Station ID",
      "Station ID",
      "Station Name",
      "Region",
      "Latitude",
      "Longitude",
      "Metadata Completeness (%)",
      "Calibration Compliance (%)",
      "Maintenance Compliance (%)",
      "Documentation Completeness (%)",
      "Station Readiness (%)",
      "Readiness Grade"
    ];

    const rows = stationWigosEvaluations.map(ev => {
      const grade = ev.readinessPct >= 90 ? "Class A (Compliant)" : ev.readinessPct >= 75 ? "Class B (Operational)" : "Class C (Non-Compliant)";
      return [
        ev.wigosId,
        `AWS-${ev.station.stationId.toString().padStart(3, '0')}`,
        `"${ev.station.stationName}"`,
        `"${ev.station.region}"`,
        ev.station.latitude,
        ev.station.longitude,
        ev.metadataPct,
        ev.calibPct,
        ev.maintPct,
        ev.docPct,
        ev.readinessPct,
        `"${grade}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `WIGOS_Compliance_Audit_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="wigos-compliance-center" className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0b101d] via-[#0d1527] to-[#0a0d16] border border-blue-500/20 rounded-md p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono font-bold uppercase rounded tracking-wider flex items-center gap-1.5">
                <Award className="h-3 w-3 text-cyan-400" />
                WMO No. 1160 Standard
              </span>
              <span className="text-zinc-500 text-xs font-mono">WIS 2.0 / OSCAR Integrated</span>
            </div>
            
            <h2 className="text-2xl font-serif text-white flex items-center gap-3">
              <span>WIGOS Compliance &amp; Operational Readiness Center</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Automated real-time evaluation of meteorological terminal metadata completeness, instrument calibration validity, power maintenance state, documentation coverage, and global WIGOS station readiness.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleExportWigosCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600/15 hover:bg-cyan-600/25 text-cyan-300 border border-cyan-500/30 rounded-md text-xs font-semibold font-mono transition cursor-pointer shadow-lg shadow-cyan-950/40"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>Export WIGOS Audit CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* GBON Pre-Transmission Window Threshold Banner */}
      {(() => {
        const gbonAlerts = generateGBONThresholdAlerts(stations, sensors);
        const gbonInfo = getNextGBONWindowInfo();

        return (
          <div className="bg-gradient-to-r from-[#140f07] via-[#1f1508] to-[#140f07] border border-amber-500/40 rounded-md p-5 shadow-lg space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded shrink-0 mt-0.5">
                  <Radio className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-amber-200">
                      Mandatory GBON Transmission Window Guard
                    </h3>
                    <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold rounded">
                      Target: {gbonInfo.nextWindowUtc} ({gbonInfo.minutesLeft}m left)
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/70 mt-0.5">
                    Monitoring telemetry lag, battery cutoff thresholds, and sensor out-of-tolerance drift before mandatory WMO GBON data transmission cutoff.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right font-mono">
                  <span className="text-[10px] text-zinc-400 uppercase block font-bold">GBON Risk Flags</span>
                  <span className={`text-base font-bold ${gbonAlerts.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {gbonAlerts.length} Flagged
                  </span>
                </div>

                <button
                  onClick={() => {
                    const btn = document.getElementById('nav-alerts-btn');
                    if (btn) btn.click();
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded text-xs transition cursor-pointer flex items-center gap-1"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Inspect Alert Center</span>
                </button>
              </div>
            </div>

            {gbonAlerts.length > 0 && (
              <div className="pt-2 border-t border-amber-500/20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {gbonAlerts.slice(0, 3).map(a => (
                  <div key={a.id} className="p-2 bg-[#0a0805] border border-amber-500/20 rounded text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-amber-300 font-bold font-mono">
                      <span>{a.stationName}</span>
                      <span className="text-[9px] uppercase px-1 py-0.5 bg-amber-500/10 rounded">{a.type.replace('_', ' ')}</span>
                    </div>
                    <p className="text-zinc-400 text-[10px] truncate">{a.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* --- 5 Core WIGOS Compliance Indicators Bento Grid --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Indicator 1: Metadata Completeness */}
        <div className="bg-[#0f0f12] border border-[#1f1f23] p-4 rounded-md space-y-3 flex flex-col justify-between hover:border-blue-500/30 transition">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-blue-400" />
                Metadata Completeness
              </span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                wigosMetrics.metadataCompleteness >= 90 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                wigosMetrics.metadataCompleteness >= 75 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {wigosMetrics.metadataCompleteness >= 90 ? 'Optimal' : 'Action Needed'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-3xl font-serif text-white font-bold">{wigosMetrics.metadataCompleteness}%</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                ({wigosMetrics.counts.metaFilled}/{wigosMetrics.counts.metaTotal} fields)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#16161c] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-500" 
                style={{ width: `${wigosMetrics.metadataCompleteness}%` }}
              ></div>
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 font-mono border-t border-[#16161c] pt-2">
            Station coordinates, SIM numbers, model numbers &amp; office references.
          </p>
        </div>

        {/* Indicator 2: Calibration Compliance */}
        <div className="bg-[#0f0f12] border border-[#1f1f23] p-4 rounded-md space-y-3 flex flex-col justify-between hover:border-emerald-500/30 transition">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Calibration Compliance
              </span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                wigosMetrics.calibrationCompliance >= 90 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                wigosMetrics.calibrationCompliance >= 75 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {wigosMetrics.calibrationCompliance >= 90 ? 'ISO 17025 OK' : 'Calib Overdue'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-3xl font-serif text-emerald-400 font-bold">{wigosMetrics.calibrationCompliance}%</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                ({wigosMetrics.counts.compliantCalibSensors}/{wigosMetrics.counts.activeSensors} active)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#16161c] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${wigosMetrics.calibrationCompliance}%` }}
              ></div>
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 font-mono border-t border-[#16161c] pt-2">
            Instruments traceably calibrated within valid ISO/IEC 17025 intervals.
          </p>
        </div>

        {/* Indicator 3: Maintenance Compliance */}
        <div className="bg-[#0f0f12] border border-[#1f1f23] p-4 rounded-md space-y-3 flex flex-col justify-between hover:border-purple-500/30 transition">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-purple-400" />
                Maintenance Compliance
              </span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                wigosMetrics.maintenanceCompliance >= 90 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {wigosMetrics.maintenanceCompliance >= 90 ? 'Healthy Power' : 'Maintenance'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-3xl font-serif text-purple-400 font-bold">{wigosMetrics.maintenanceCompliance}%</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                ({wigosMetrics.counts.healthyStations}/{wigosMetrics.counts.totalStations} terminals)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#16161c] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-purple-500 h-full transition-all duration-500" 
                style={{ width: `${wigosMetrics.maintenanceCompliance}%` }}
              ></div>
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 font-mono border-t border-[#16161c] pt-2">
            Battery voltage healthy (≥11.5V) and zero unaddressed hardware faults.
          </p>
        </div>

        {/* Indicator 4: Documentation Completeness */}
        <div className="bg-[#0f0f12] border border-[#1f1f23] p-4 rounded-md space-y-3 flex flex-col justify-between hover:border-amber-500/30 transition">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                Documentation Completeness
              </span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                wigosMetrics.documentationCompleteness >= 85 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {wigosMetrics.documentationCompleteness >= 85 ? 'Documented' : 'Incomplete Docs'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-3xl font-serif text-amber-400 font-bold">{wigosMetrics.documentationCompleteness}%</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                Siting &amp; Manuals
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#16161c] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-amber-500 h-full transition-all duration-500" 
                style={{ width: `${wigosMetrics.documentationCompleteness}%` }}
              ></div>
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 font-mono border-t border-[#16161c] pt-2">
            WMO No.8 siting classes, datasheets, user manuals &amp; calibration certs.
          </p>
        </div>

        {/* Indicator 5: Station Readiness (Overall Composite) */}
        <div className="bg-gradient-to-br from-[#0e182e] to-[#0b101c] border border-cyan-500/30 p-4 rounded-md space-y-3 flex flex-col justify-between shadow-xl">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-cyan-300 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-cyan-400" />
                Station Readiness
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded uppercase">
                {wigosMetrics.stationReadiness >= 90 ? 'Class A' : wigosMetrics.stationReadiness >= 75 ? 'Class B' : 'Class C'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-3xl font-serif text-cyan-300 font-bold">{wigosMetrics.stationReadiness}%</span>
              <span className="text-[10px] text-cyan-400/70 font-mono">
                Global Index
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#16161c] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-cyan-400 h-full transition-all duration-500" 
                style={{ width: `${wigosMetrics.stationReadiness}%` }}
              ></div>
            </div>
          </div>

          <p className="text-[10px] text-cyan-400/80 font-mono border-t border-cyan-500/10 pt-2">
            Weighted composite: 20% Meta + 25% Calib + 30% Maint + 15% Docs + 10% Live.
          </p>
        </div>

      </div>

      {/* --- Filters & Search Controls --- */}
      <div className="bg-[#0f0f12] border border-[#1f1f23] p-4 rounded-md space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search station name, WIGOS ID (e.g. 0-524-0-AWS001), or province..."
              className="w-full bg-[#050507] border border-[#1d1d22] focus:border-cyan-500 rounded pl-9 pr-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-zinc-500 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Region Filter */}
            <div className="flex items-center gap-1.5 bg-[#050507] border border-[#1d1d22] px-2.5 py-1.5 rounded text-xs font-mono">
              <MapPin className="h-3 w-3 text-zinc-500" />
              <span className="text-zinc-500 text-[10px] uppercase">Province:</span>
              <select
                value={regionFilter}
                onChange={e => setRegionFilter(e.target.value)}
                className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
              >
                {regions.map(r => (
                  <option key={r} value={r} className="bg-[#0f0f12] text-zinc-200">{r}</option>
                ))}
              </select>
            </div>

            {/* Readiness Filter */}
            <div className="flex items-center gap-1.5 bg-[#050507] border border-[#1d1d22] px-2.5 py-1.5 rounded text-xs font-mono">
              <Sliders className="h-3 w-3 text-zinc-500" />
              <span className="text-zinc-500 text-[10px] uppercase">Readiness:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="All" className="bg-[#0f0f12]">All Grades</option>
                <option value="High" className="bg-[#0f0f12]">Class A (≥90%)</option>
                <option value="Warning" className="bg-[#0f0f12]">Class B (75-89%)</option>
                <option value="Low" className="bg-[#0f0f12]">Class C (&lt;75%)</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* --- Station-by-Station WIGOS Compliance Directory --- */}
      <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md overflow-hidden">
        <div className="p-4 border-b border-[#1f1f23] flex items-center justify-between">
          <div>
            <h3 className="font-serif italic text-base text-white flex items-center gap-2">
              <span>Station WIGOS Compliance Ledger</span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {filteredEvaluations.length} Terminals
              </span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Click any station row to inspect granular metadata gaps, calibration validity, and documentation completeness.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#09090c] text-zinc-400 text-[10px] uppercase tracking-wider border-b border-[#1f1f23]">
              <tr>
                <th className="py-3 px-4">Station &amp; WIGOS ID</th>
                <th className="py-3 px-3">Metadata</th>
                <th className="py-3 px-3">Calibration</th>
                <th className="py-3 px-3">Maintenance</th>
                <th className="py-3 px-3">Docs</th>
                <th className="py-3 px-3">Station Readiness</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17171c]">
              {filteredEvaluations.map(ev => {
                const isSelected = selectedStation?.stationId === ev.station.stationId;
                return (
                  <tr 
                    key={ev.station.stationId}
                    onClick={() => setSelectedStation(isSelected ? null : ev.station)}
                    className={`hover:bg-[#14141a] transition cursor-pointer ${isSelected ? 'bg-blue-500/5' : ''}`}
                  >
                    {/* Station Name & WIGOS ID */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-zinc-200 font-semibold text-xs flex items-center gap-1.5">
                          {ev.station.stationName}
                        </span>
                        <span className="text-[10px] text-cyan-400 font-mono mt-0.5">
                          {ev.wigosId} • <span className="text-zinc-500">{ev.station.region}</span>
                        </span>
                      </div>
                    </td>

                    {/* Metadata % */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${ev.metadataPct >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {ev.metadataPct}%
                        </span>
                      </div>
                    </td>

                    {/* Calibration % */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${ev.calibPct >= 90 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {ev.calibPct}%
                        </span>
                        <span className="text-[9px] text-zinc-500">
                          ({ev.compliantSensorsCount}/{ev.totalSensorsCount})
                        </span>
                      </div>
                    </td>

                    {/* Maintenance % */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${ev.maintPct >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {ev.maintPct}%
                        </span>
                        {ev.lowBatt && (
                          <span className="text-[8px] bg-red-500/20 text-red-400 px-1 py-0.2 rounded">Low V</span>
                        )}
                      </div>
                    </td>

                    {/* Docs % */}
                    <td className="py-3 px-3">
                      <span className={`font-bold ${ev.docPct >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {ev.docPct}%
                      </span>
                    </td>

                    {/* Readiness % Bar */}
                    <td className="py-3 px-3">
                      <div className="space-y-1 w-32">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-bold ${
                            ev.readinessPct >= 90 ? 'text-cyan-400' :
                            ev.readinessPct >= 75 ? 'text-amber-400' :
                            'text-red-400'
                          }`}>
                            {ev.readinessPct}%
                          </span>
                          <span className="text-[8px] text-zinc-500 font-semibold">
                            {ev.readinessPct >= 90 ? 'CLASS A' : ev.readinessPct >= 75 ? 'CLASS B' : 'CLASS C'}
                          </span>
                        </div>
                        <div className="w-full bg-[#1b1b22] h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              ev.readinessPct >= 90 ? 'bg-cyan-400' :
                              ev.readinessPct >= 75 ? 'bg-amber-400' :
                              'bg-red-400'
                            }`}
                            style={{ width: `${ev.readinessPct}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Inspect Button */}
                    <td className="py-3 px-4 text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStation(ev.station);
                        }}
                        className="px-2.5 py-1 bg-[#131318] hover:bg-cyan-500/20 text-zinc-300 hover:text-cyan-300 border border-[#23232c] hover:border-cyan-500/30 rounded text-[10px] font-semibold transition cursor-pointer"
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Detailed Station Inspection Drawer / Modal --- */}
      {selectedStation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          {(() => {
            const ev = stationWigosEvaluations.find(item => item.station.stationId === selectedStation.stationId);
            if (!ev) return null;

            return (
              <div className="bg-[#0c0c10] border border-cyan-500/30 rounded-lg max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                
                {/* Header */}
                <div className="flex items-start justify-between border-b border-[#1b1b24] pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] font-mono font-bold uppercase rounded">
                        WIGOS Inspection Audit
                      </span>
                      <span className="text-zinc-500 text-xs font-mono">{ev.wigosId}</span>
                    </div>
                    <h3 className="text-xl font-serif text-white mt-1">
                      {ev.station.stationName}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      {ev.station.region} • Lat: {ev.station.latitude} | Long: {ev.station.longitude}
                    </p>
                  </div>

                  <button 
                    onClick={() => setSelectedStation(null)}
                    className="p-1 text-zinc-400 hover:text-white bg-[#14141c] rounded"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Overall Score Badge */}
                <div className="bg-[#12121a] border border-[#1e1e2a] p-4 rounded-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400 block font-bold">Overall Station Readiness</span>
                    <span className="text-xs text-zinc-500">WMO No.1160 Compliance Standard</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-serif font-bold text-cyan-400">{ev.readinessPct}%</span>
                    <span className={`px-2.5 py-1 text-xs font-mono font-bold rounded ${
                      ev.readinessPct >= 90 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      ev.readinessPct >= 75 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}>
                      {ev.readinessPct >= 90 ? 'Class A (Fully Compliant)' : ev.readinessPct >= 75 ? 'Class B (Operational)' : 'Class C (Action Needed)'}
                    </span>
                  </div>
                </div>

                {/* 5 Indicator Granular Breakdown */}
                <div className="space-y-3 font-mono text-xs">
                  
                  {/* 1. Metadata */}
                  <div className="bg-[#101016] border border-[#1a1a24] p-3 rounded space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5 text-blue-400" />
                        1. Metadata Completeness
                      </span>
                      <span className="text-blue-400 font-bold">{ev.metadataPct}%</span>
                    </div>
                    
                    <div className="text-[11px] text-zinc-400 space-y-1 bg-[#09090d] p-2 rounded">
                      <div className="flex justify-between">
                        <span>SIM Card Number:</span>
                        <span className={ev.station.simNumber ? 'text-emerald-400' : 'text-red-400 font-bold'}>
                          {ev.station.simNumber || '❌ Missing'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Regional Office ID:</span>
                        <span className={ev.station.regionalOfficeId ? 'text-emerald-400' : 'text-amber-400'}>
                          {ev.station.regionalOfficeId ? `Office #${ev.station.regionalOfficeId}` : '⚠️ Unassigned'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sensors Without Serial No.:</span>
                        <span className={ev.missingFields.sensorsWithoutSerial === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {ev.missingFields.sensorsWithoutSerial === 0 ? '✓ None (All Serialized)' : `⚠️ ${ev.missingFields.sensorsWithoutSerial} Sensor(s) missing serial`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Calibration */}
                  <div className="bg-[#101016] border border-[#1a1a24] p-3 rounded space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        2. Calibration Compliance
                      </span>
                      <span className="text-emerald-400 font-bold">{ev.calibPct}%</span>
                    </div>

                    <div className="text-[11px] text-zinc-400 bg-[#09090d] p-2 rounded space-y-1">
                      <div className="flex justify-between">
                        <span>Compliant Deployed Sensors:</span>
                        <span className="text-emerald-400 font-bold">{ev.compliantSensorsCount} / {ev.totalSensorsCount}</span>
                      </div>
                      {ev.totalSensorsCount - ev.compliantSensorsCount > 0 && (
                        <p className="text-amber-400 text-[10px] pt-1">
                          ⚠️ {ev.totalSensorsCount - ev.compliantSensorsCount} sensor(s) require calibration renewal or maintenance review.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 3. Maintenance */}
                  <div className="bg-[#101016] border border-[#1a1a24] p-3 rounded space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-purple-400" />
                        3. Maintenance Compliance
                      </span>
                      <span className="text-purple-400 font-bold">{ev.maintPct}%</span>
                    </div>

                    <div className="text-[11px] text-zinc-400 bg-[#09090d] p-2 rounded space-y-1">
                      <div className="flex justify-between">
                        <span>Terminal Battery Voltage:</span>
                        <span className={ev.lowBatt ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                          {ev.voltage.toFixed(2)} V ({ev.lowBatt ? 'Low Power Risk' : 'Optimal Operating Power'})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Damaged / Faulty Hardware:</span>
                        <span className={ev.damagedCount > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                          {ev.damagedCount > 0 ? `⚠️ ${ev.damagedCount} damaged asset(s)` : '✓ Zero Hardware Faults'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Documentation */}
                  <div className="bg-[#101016] border border-[#1a1a24] p-3 rounded space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                        4. Documentation Completeness
                      </span>
                      <span className="text-amber-400 font-bold">{ev.docPct}%</span>
                    </div>

                    <div className="text-[11px] text-zinc-400 bg-[#09090d] p-2 rounded space-y-1">
                      <div className="flex justify-between">
                        <span>WMO Siting Classification:</span>
                        <span className="text-zinc-200">
                          {ev.sensors.find(s => s.wmoSitingClass)?.wmoSitingClass || 'WMO No.8 Class 2 (Standard)'}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer Actions */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#1b1b24]">
                  {onOpenEditStation && (
                    <button
                      onClick={() => {
                        const st = ev.station;
                        setSelectedStation(null);
                        onOpenEditStation(st);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold font-mono transition cursor-pointer"
                    >
                      Update Station Metadata
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedStation(null)}
                    className="px-4 py-2 bg-[#1a1a24] hover:bg-[#222230] text-zinc-300 rounded text-xs font-semibold font-mono transition cursor-pointer"
                  >
                    Close Audit
                  </button>
                </div>

              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
