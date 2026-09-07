import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Plus, 
  Settings, 
  Wrench, 
  Search, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Printer, 
  ChevronRight, 
  ChevronLeft,
  ArrowRight, 
  Gauge, 
  UserCheck, 
  Award, 
  Clock, 
  Calendar,
  Layers,
  Thermometer,
  FileCheck2,
  RefreshCw,
  Info,
  ShieldCheck,
  FileSignature,
  Fingerprint,
  Lock,
  Scale,
  ListFilter,
  History,
  AlertTriangle,
  ClipboardList,
  ArrowLeftRight,
  Sliders,
  Radio,
  RadioTower,
  MapPin,
  Database,
  Sparkles,
  Calculator,
  Zap
} from 'lucide-react';
import { Sensor, CalibrationDevice, CalibrationJob } from '../types.ts';

// Standard meteorological tolerances based on CIMO (WMO No. 8) guidelines
const MET_TOLERANCES: Record<string, { maxError: number; unit: string; points: number[] }> = {
  'Thermometer': { maxError: 0.2, unit: '°C', points: [-10, 0, 15, 30] },
  'Barometer': { maxError: 0.3, unit: 'hPa', points: [850, 950, 1013, 1050] },
  'Anemometer': { maxError: 0.5, unit: 'm/s', points: [0, 5, 12, 25] },
  'Hygrometer': { maxError: 2.5, unit: '% RH', points: [20, 50, 75, 90] },
  'Rain Gauge': { maxError: 0.2, unit: 'mm', points: [5, 10, 30] },
  'Pyranometer': { maxError: 5.0, unit: 'W/m²', points: [100, 400, 800] },
  'Default': { maxError: 1.0, unit: 'units', points: [10, 50, 100] }
};

interface CalibrationLabProps {
  sensors: Sensor[];
  onRefresh: () => void;
  user: {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    role: string;
    assignedStationId: number | null;
  } | null;
  token?: string | null;
  onTriggerWarrantyClaim?: (claim: any) => void;
}

export default function CalibrationLab({ sensors, onRefresh, user, token, onTriggerWarrantyClaim }: CalibrationLabProps) {
  const [activeTab, setActiveTab] = useState<'workflows' | 'insitu' | 'devices' | 'history'>('workflows');
  const [devices, setDevices] = useState<CalibrationDevice[]>([]);
  const [jobs, setJobs] = useState<CalibrationJob[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [inSituLogs, setInSituLogs] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Active Job for Workspace
  const [selectedJob, setSelectedJob] = useState<CalibrationJob | null>(null);

  // Modals / Form states
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<CalibrationDevice | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<CalibrationJob | null>(null);

  // Additional Modals for Field (In-Situ) & Lab Workflows
  const [showInSituModal, setShowInSituModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showCoefficientsModal, setShowCoefficientsModal] = useState(false);

  // Form states for In-Situ Field Verification
  const [inSituStationId, setInSituStationId] = useState('');
  const [inSituSensorId, setInSituSensorId] = useState('');
  const [inSituRefDevice, setInSituRefDevice] = useState('');
  const [inSituRefSerial, setInSituRefSerial] = useState('');
  const [inSituAwsVal, setInSituAwsVal] = useState('');
  const [inSituRefVal, setInSituRefVal] = useState('');
  const [inSituTolerance, setInSituTolerance] = useState('0.20');
  const [inSituAmbientTemp, setInSituAmbientTemp] = useState('24.5');
  const [inSituAmbientHum, setInSituAmbientHum] = useState('60');
  const [inSituNotes, setInSituNotes] = useState('');

  // Form states for Sensor Swap Wizard
  const [swapStationId, setSwapStationId] = useState('');
  const [swapOldSensorId, setSwapOldSensorId] = useState('');
  const [swapNewSensorId, setSwapNewSensorId] = useState('');
  const [swapReason, setSwapReason] = useState('Scheduled bench recalibration cycle');
  const [swapPersonnel, setSwapPersonnel] = useState('');
  const [swapNotes, setSwapNotes] = useState('');
  const [swapSlope, setSwapSlope] = useState('1.0000');
  const [swapOffset, setSwapOffset] = useState('0.0000');

  // Form states for Coefficients Adjustment
  const [coefSensorId, setCoefSensorId] = useState('');
  const [coefModelType, setCoefModelType] = useState<'Linear' | 'Polynomial'>('Linear');
  const [coefSlope, setCoefSlope] = useState('1.0000');
  const [coefOffset, setCoefOffset] = useState('0.0000');
  const [coefPolyA, setCoefPolyA] = useState('0.0000');
  const [coefPolyB, setCoefPolyB] = useState('1.0000');
  const [coefPolyC, setCoefPolyC] = useState('0.0000');
  const [coefNotes, setCoefNotes] = useState('');

  // Regression Fit calculator points
  const [fitPt1Raw, setFitPt1Raw] = useState('');
  const [fitPt1Ref, setFitPt1Ref] = useState('');
  const [fitPt2Raw, setFitPt2Raw] = useState('');
  const [fitPt2Ref, setFitPt2Ref] = useState('');
  const [fitPt3Raw, setFitPt3Raw] = useState('');
  const [fitPt3Ref, setFitPt3Ref] = useState('');

  // Form states for Reference Devices
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState('Thermometer Calibrator');
  const [serialNumber, setSerialNumber] = useState('');
  const [accuracyClass, setAccuracyClass] = useState('');
  const [lastCalibrated, setLastCalibrated] = useState('');
  const [calibrationDue, setCalibrationDue] = useState('');
  const [deviceStatus, setDeviceStatus] = useState('Active');
  const [assignedLab, setAssignedLab] = useState('Central Meteorological Calibration Lab');

  // Form states for planning new job
  const [planSensorId, setPlanSensorId] = useState('');
  const [planCalibrator, setPlanCalibrator] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [planProcedure, setPlanProcedure] = useState('SOP-CAL-01: Standard Meteorological Temperature Sensor Calibration');

  // Active Stage Workspace Form States
  const [stagePayload, setStagePayload] = useState<any>({});
  const [triggeringClaim, setTriggeringClaim] = useState(false);

  const handleTriggerWarrantyClaimFlow = async () => {
    if (!selectedJob) return;
    setTriggeringClaim(true);
    try {
      const response = await fetch('/api/warranty/trigger-claim-and-flag-supplier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          jobId: selectedJob.jobId,
          sensorId: selectedJob.sensorId,
          failureNotes: stagePayload.conformityNotes || `Failed Stage 6 Conformity Evaluation under ${stagePayload.conformityDecisionRule || 'Simple Acceptance'}.`
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to trigger warranty linkage.');
      }

      const data = await response.json();
      if (data.success && onTriggerWarrantyClaim) {
        onTriggerWarrantyClaim(data.claimTemplate);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error triggering warranty claim flow');
    } finally {
      setTriggeringClaim(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/calibration-devices');
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (err) {
      console.error('Error fetching calibration devices:', err);
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/calibration-jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
        
        // If an active job was selected, refresh its state in the workspace
        if (selectedJob) {
          const updated = data.find((j: CalibrationJob) => j.jobId === selectedJob.jobId);
          if (updated) setSelectedJob(updated);
        }
      }
    } catch (err) {
      console.error('Error fetching calibration jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/calibrations');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Error fetching historical calibrations:', err);
    }
  };

  const fetchInSituLogs = async () => {
    try {
      const res = await fetch('/api/in-situ-verifications');
      if (res.ok) {
        const data = await res.json();
        setInSituLogs(data);
      }
    } catch (err) {
      console.error('Error fetching in-situ verifications:', err);
    }
  };

  const fetchStations = async () => {
    try {
      const res = await fetch('/api/weather-stations');
      if (res.ok) {
        const data = await res.json();
        setStationsList(data);
      }
    } catch (err) {
      console.error('Error fetching weather stations:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchJobs();
    fetchHistory();
    fetchInSituLogs();
    fetchStations();
  }, []);

  const handleSaveInSitu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inSituStationId || !inSituSensorId || inSituAwsVal === '' || inSituRefVal === '') {
      alert('Please fill in target station, sensor, AWS reading, and reference reading.');
      return;
    }

    try {
      const station = stationsList.find(s => s.stationId === parseInt(inSituStationId));
      const sensor = sensors.find(s => s.sensorId === parseInt(inSituSensorId));

      const res = await fetch('/api/in-situ-verifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          stationId: inSituStationId,
          stationName: station?.stationName || 'Weather Station AWS',
          sensorId: inSituSensorId,
          sensorType: sensor?.sensorType || 'Sensor',
          sensorSerialNumber: sensor?.serialNumber || 'N/A',
          portableReferenceName: inSituRefDevice || 'Vaisala HM70 Handheld Standard',
          portableReferenceSerial: inSituRefSerial || 'REF-FIELD-01',
          awsReading: inSituAwsVal,
          referenceReading: inSituRefVal,
          unit: MET_TOLERANCES[sensor?.sensorType || 'Default']?.unit || 'units',
          toleranceLimit: inSituTolerance,
          ambientTemp: inSituAmbientTemp,
          ambientHumidity: inSituAmbientHum,
          technicianName: user?.displayName || user?.email || 'Field Metrologist',
          notes: inSituNotes
        })
      });

      if (res.ok) {
        setShowInSituModal(false);
        fetchInSituLogs();
        onRefresh();
        alert('In-situ field check logged successfully! Station operations remain uninterrupted.');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save in-situ field verification.');
      }
    } catch (err) {
      console.error('Error logging in-situ check:', err);
    }
  };

  const handleExecuteSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapStationId || !swapOldSensorId || !swapNewSensorId) {
      alert('Please select station, currently active sensor, and pre-calibrated spare sensor.');
      return;
    }

    try {
      const res = await fetch('/api/sensors/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          stationId: swapStationId,
          oldSensorId: swapOldSensorId,
          newSpareSensorId: swapNewSensorId,
          swapDate: new Date().toISOString().split('T')[0],
          reason: swapReason,
          personnelInvolved: swapPersonnel || user?.displayName || user?.email || 'Field Metrologist',
          coefficients: {
            modelType: 'Linear',
            slope: parseFloat(swapSlope) || 1.0,
            offset: parseFloat(swapOffset) || 0.0,
            lastAdjustedDate: new Date().toISOString().split('T')[0],
            adjustedBy: user?.email || 'Lab Technician'
          },
          notes: swapNotes
        })
      });

      if (res.ok) {
        const data = await res.json();
        setShowSwapModal(false);
        fetchJobs();
        onRefresh();
        alert(`Sensor Swap Executed Successfully at ${data.stationName}!\nActive sensor SEN-${swapOldSensorId} moved to 'In Calibration' / Bench Check schedule.\nPre-calibrated spare SEN-${swapNewSensorId} deployed and active.`);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to execute sensor swap.');
      }
    } catch (err) {
      console.error('Error executing sensor swap:', err);
    }
  };

  const handleSaveCoefficients = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coefSensorId) {
      alert('Please select a target sensor to update coefficients.');
      return;
    }

    try {
      const res = await fetch(`/api/sensors/${coefSensorId}/coefficients`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          modelType: coefModelType,
          slope: parseFloat(coefSlope) || 1.0,
          offset: parseFloat(coefOffset) || 0.0,
          polyA: parseFloat(coefPolyA) || 0.0,
          polyB: parseFloat(coefPolyB) || 1.0,
          polyC: parseFloat(coefPolyC) || 0.0,
          notes: coefNotes
        })
      });

      if (res.ok) {
        setShowCoefficientsModal(false);
        onRefresh();
        alert('Calibration transfer function coefficients updated successfully!');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update coefficients.');
      }
    } catch (err) {
      console.error('Error updating coefficients:', err);
    }
  };

  const handleCalculateFit = () => {
    const pts = [
      { x: parseFloat(fitPt1Raw), y: parseFloat(fitPt1Ref) },
      { x: parseFloat(fitPt2Raw), y: parseFloat(fitPt2Ref) },
      { x: parseFloat(fitPt3Raw), y: parseFloat(fitPt3Ref) }
    ].filter(p => !isNaN(p.x) && !isNaN(p.y));

    if (pts.length < 2) {
      alert('Please enter at least 2 test point pairs (Raw Sensor Value vs Reference Standard Value).');
      return;
    }

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = pts.length;
    pts.forEach(p => {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumX2 += p.x * p.x;
    });

    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-12) {
      alert('Invalid regression points: points have identical X values.');
      return;
    }

    const m = (n * sumXY - sumX * sumY) / denom;
    const c = (sumY - m * sumX) / n;

    setCoefSlope(m.toFixed(4));
    setCoefOffset(c.toFixed(4));
    alert(`Linear Least-Squares Regression Fitted!\nCalculated Slope (m) = ${m.toFixed(4)}\nCalculated Offset (c) = ${c.toFixed(4)}`);
  };

  const handleOpenDeviceModal = (device: CalibrationDevice | null = null) => {
    if (device) {
      setEditingDevice(device);
      setDeviceName(device.deviceName);
      setDeviceType(device.deviceType);
      setSerialNumber(device.serialNumber);
      setAccuracyClass(device.accuracyClass || '');
      setLastCalibrated(device.lastCalibrated || '');
      setCalibrationDue(device.calibrationDue || '');
      setDeviceStatus(device.status || 'Active');
      setAssignedLab(device.assignedLab || 'Central Meteorological Calibration Lab');
    } else {
      setEditingDevice(null);
      setDeviceName('');
      setDeviceType('Thermometer Calibrator');
      setSerialNumber('');
      setAccuracyClass('');
      setLastCalibrated(new Date().toISOString().split('T')[0]);
      setCalibrationDue(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      setDeviceStatus('Active');
      setAssignedLab('Central Meteorological Calibration Lab');
    }
    setShowDeviceModal(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName || !deviceType || !serialNumber) return;

    const payload = {
      deviceName,
      deviceType,
      serialNumber,
      accuracyClass,
      lastCalibrated,
      calibrationDue,
      status: deviceStatus,
      assignedLab
    };

    try {
      const url = editingDevice ? `/api/calibration-devices/${editingDevice.deviceId}` : '/api/calibration-devices';
      const method = editingDevice ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowDeviceModal(false);
        fetchDevices();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save reference device.');
      }
    } catch (err) {
      console.error('Error saving reference device:', err);
    }
  };

  const handleDeleteDevice = async (deviceId: number) => {
    if (!confirm('Are you sure you want to delete this reference equipment?')) return;
    try {
      const res = await fetch(`/api/calibration-devices/${deviceId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchDevices();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete device.');
      }
    } catch (err) {
      console.error('Error deleting device:', err);
    }
  };

  const handleOpenPlanModal = () => {
    setPlanSensorId('');
    setPlanCalibrator(user?.displayName || user?.email || '');
    setPlanDate(new Date().toISOString().split('T')[0]);
    setPlanProcedure('SOP-CAL-01: Standard Meteorological Temperature Sensor Calibration');
    setShowPlanModal(true);
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planSensorId || !planCalibrator || !planDate) return;

    try {
      const res = await fetch('/api/calibration-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensorId: planSensorId,
          plannedDate: planDate,
          plannedCalibrator: planCalibrator,
          calibrationProcedure: planProcedure
        })
      });

      if (res.ok) {
        setShowPlanModal(false);
        fetchJobs();
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to schedule job.');
      }
    } catch (err) {
      console.error('Error planning job:', err);
    }
  };

  // Stage Transitions (ISO/IEC 17025 sequence)
  const handleTransitionStage = async (currentStage: string, nextStage: string, payload: any) => {
    if (!selectedJob) return;

    try {
      const res = await fetch(`/api/calibration-jobs/${selectedJob.jobId}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStage,
          nextStage,
          payload
        })
      });

      if (res.ok) {
        await fetchJobs();
        setStagePayload({});
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to transition stage.');
      }
    } catch (err) {
      console.error('Error transitioning stage:', err);
    }
  };

  // Sign off & E-Signature
  const handleSignOffJob = async (signatoryName: string, signatoryDesignation: string) => {
    if (!selectedJob) return;

    try {
      const res = await fetch(`/api/calibration-jobs/${selectedJob.jobId}/sign-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatoryName,
          signatoryDesignation
        })
      });

      if (res.ok) {
        await fetchJobs();
        await fetchHistory();
        onRefresh();
        alert('Job signed off and certified successfully!');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to sign off calibration job.');
      }
    } catch (err) {
      console.error('Error signing off job:', err);
    }
  };

  const handleCancelJob = async (jobId: number) => {
    if (!confirm('Are you sure you want to cancel this calibration job? This will revert the sensor status.')) return;
    try {
      const res = await fetch(`/api/calibration-jobs/${jobId}/cancel`, {
        method: 'POST'
      });
      if (res.ok) {
        setSelectedJob(null);
        fetchJobs();
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to cancel job.');
      }
    } catch (err) {
      console.error('Error cancelling job:', err);
    }
  };

  const handleOpenCertificate = (job: CalibrationJob) => {
    setSelectedCertificate(job);
    setShowCertificateModal(true);
  };

  // Filter logic
  const filteredWorkflows = jobs.filter(j => 
    j.sensorType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    j.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    j.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    j.plannedCalibrator?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDevices = devices.filter(d => 
    d.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.deviceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = history.filter(c => 
    c.technicianName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.sensorType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.result?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ISO 17025 Workflows List Component
  const renderWorkflowsList = () => (
    <div className="space-y-4">
      {/* Lab Workflow Scope & Features Banner */}
      <div className="bg-gradient-to-r from-indigo-900/10 via-sky-900/10 to-indigo-900/10 border border-indigo-200 dark:border-indigo-800/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              Laboratory Bench Calibration Workflow
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                ISO/IEC 17025
              </span>
            </h3>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Supports bench check schedules, sensor swapping (active station sensor replaced with pre-calibrated spare), and transfer function coefficient tuning (slope & offset).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowSwapModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Sensor Swap Wizard
          </button>
          <button
            onClick={() => setShowCoefficientsModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition"
          >
            <Sliders className="h-3.5 w-3.5" />
            Adjust Coefficients
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">ISO/IEC 17025 Bench Calibration Queue</h2>
            <p className="text-xs text-zinc-500">Chronological multi-stage sequence files for meteorological physical instruments.</p>
          </div>
          <button
            onClick={handleOpenPlanModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Plan Bench Check
          </button>
        </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/50 dark:bg-zinc-950/20 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
              <th className="p-4">Job ID</th>
              <th className="p-4">Sensor / S/N</th>
              <th className="p-4">Planned Date</th>
              <th className="p-4">Calibrator</th>
              <th className="p-4">Workflow Progress</th>
              <th className="p-4">System Status</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850 text-sm text-zinc-700 dark:text-zinc-300">
            {filteredWorkflows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-400 dark:text-zinc-600">
                  <Activity className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                  No calibration jobs active or planned.
                </td>
              </tr>
            ) : (
              filteredWorkflows.map((job) => {
                const stages = ['Plan', 'ReferenceSelection', 'EnvironmentCheck', 'Measurements', 'Uncertainty', 'Conformity', 'Review', 'SignOff'];
                const currentIndex = stages.indexOf(job.currentStage);
                const progressPct = Math.round(((currentIndex + 1) / stages.length) * 100);

                return (
                  <tr key={job.jobId} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-950/10 transition">
                    <td className="p-4 font-mono text-xs text-zinc-500">#{job.jobId}</td>
                    <td className="p-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{job.sensorName}</div>
                      <div className="text-xs text-zinc-500">{job.sensorType} | S/N: <span className="font-mono">{job.serialNumber}</span></div>
                    </td>
                    <td className="p-4 text-xs font-medium">{job.plannedDate}</td>
                    <td className="p-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">{job.plannedCalibrator}</td>
                    <td className="p-4">
                      <div className="space-y-1 max-w-[160px]">
                        <div className="flex justify-between text-[10px] font-semibold text-zinc-500">
                          <span>{job.currentStage === 'ReferenceSelection' ? 'Reference selection' : job.currentStage}</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              job.status === 'Signed Off' ? 'bg-emerald-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        job.status === 'Signed Off' 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30' 
                          : job.status === 'Technical Review'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 font-semibold'
                            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-850 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition"
                      >
                        {job.status === 'Signed Off' ? 'View Certificate' : 'Open Workspace'}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                      {job.status !== 'Signed Off' && (
                        <button
                          onClick={() => handleCancelJob(job.jobId)}
                          className="p-1 text-zinc-400 hover:text-rose-500 rounded transition"
                          title="Cancel Job"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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
);

  // Field (In-Situ) Verification View Component
  const renderInSituView = () => (
    <div className="space-y-4">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-900/10 via-teal-900/10 to-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <RadioTower className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              Field (In-Situ) AWS Calibration & Verification
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Online Station Comparison
              </span>
            </h3>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Compares operational AWS station telemetry directly against portable master reference meters without taking the station offline.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (stationsList.length > 0) {
              setInSituStationId(String(stationsList[0].stationId));
              const stSensors = sensors.filter(s => String(s.stationId) === String(stationsList[0].stationId));
              if (stSensors.length > 0) setInSituSensorId(String(stSensors[0].sensorId));
            }
            setShowInSituModal(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-semibold shadow-xs transition shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Log Field Comparison
        </button>
      </div>

      {/* Verification Logs Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">In-Situ Field Verification Logbook</h2>
            <p className="text-xs text-zinc-500">Historical records of portable reference meter vs. AWS station sensor comparisons.</p>
          </div>
          <span className="text-xs font-medium text-zinc-500">
            Total Checks: {inSituLogs.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-950/20 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                <th className="p-4">Station / Location</th>
                <th className="p-4">Sensor Under Test</th>
                <th className="p-4">AWS Reading</th>
                <th className="p-4">Portable Master Reading</th>
                <th className="p-4">Measured Delta</th>
                <th className="p-4">Tolerance Evaluation</th>
                <th className="p-4">Inspector / Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850 text-sm text-zinc-700 dark:text-zinc-300">
              {inSituLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-400 dark:text-zinc-600">
                    <RadioTower className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                    No field (in-situ) verifications logged yet. Click "Log Field Comparison" to log your first field check.
                  </td>
                </tr>
              ) : (
                inSituLogs.map((log) => {
                  const isPass = log.passFail === 'PASS';

                  return (
                    <tr key={log.verificationId} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-950/10 transition">
                      <td className="p-4">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{log.stationName || `Station #${log.stationId}`}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">STN-{log.stationId}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-xs text-zinc-800 dark:text-zinc-200">{log.sensorName || log.sensorType || `Sensor #${log.sensorId}`}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">SEN-{log.sensorId}</div>
                      </td>
                      <td className="p-4 font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {log.awsValue}
                      </td>
                      <td className="p-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                        {log.referenceValue}
                        <div className="text-[9px] text-zinc-400 font-normal">S/N: {log.referenceMeterSn}</div>
                      </td>
                      <td className="p-4 font-mono text-xs">
                        <span className={log.difference > 0 ? 'text-amber-600' : log.difference < 0 ? 'text-sky-600' : 'text-zinc-600'}>
                          {log.difference > 0 ? `+${log.difference}` : log.difference}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isPass
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40'
                        }`}>
                          {isPass ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {log.passFail} (Tol: ±{log.toleranceAllowed})
                        </span>
                      </td>
                      <td className="p-4 text-xs">
                        <div className="font-medium text-zinc-800 dark:text-zinc-200">{log.inspectorName}</div>
                        <div className="text-[10px] text-zinc-500">{new Date(log.verificationDate).toLocaleDateString()}</div>
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
  );

  // ISO 17025 Standard Calibration Workspace
  const renderWorkspace = () => {
    if (!selectedJob) return null;

    const canModifyMetrology = user?.role === 'Lab Metrologist' || user?.role === 'Super Administrator';

    const stages = [
      { id: 'Plan', name: 'Plan', icon: Calendar },
      { id: 'ReferenceSelection', name: 'Reference Standard', icon: Layers },
      { id: 'EnvironmentCheck', name: 'Environment Check', icon: Thermometer },
      { id: 'Measurements', name: 'Measurements', icon: Wrench },
      { id: 'Uncertainty', name: 'Uncertainty Budget', icon: Scale },
      { id: 'Conformity', name: 'Conformity Evaluation', icon: ShieldCheck },
      { id: 'Review', name: 'Technical Review', icon: FileCheck2 },
      { id: 'SignOff', name: 'Authorized Sign-off', icon: FileSignature }
    ];

    const currentStageIndex = stages.findIndex(s => s.id === selectedJob.currentStage);
    const auditTrail: any[] = JSON.parse(selectedJob.fullAuditTrail || '[]');

    const phases = [
      { id: 'Plan', name: 'Plan', description: 'Schedule & Scope' },
      { id: 'Standards', name: 'Standards', description: 'Reference & Environment' },
      { id: 'Measurement', name: 'Measurement', description: 'Readings & Uncertainty' },
      { id: 'Review', name: 'Review', description: 'Conformity & Sign-off' }
    ];

    const getPhaseIndex = (stage: string) => {
      if (stage === 'Plan') return 0;
      if (stage === 'ReferenceSelection' || stage === 'EnvironmentCheck') return 1;
      if (stage === 'Measurements' || stage === 'Uncertainty' || stage === 'Conformity') return 2;
      if (stage === 'Review' || stage === 'SignOff') return 3;
      return 0;
    };

    const currentPhaseIndex = selectedJob.status === 'Signed Off' ? 4 : getPhaseIndex(selectedJob.currentStage);

    return (
      <div className="space-y-6">
        {/* Back and title bar */}
        <div className="flex justify-between items-center">
          <button 
            onClick={() => setSelectedJob(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Queue list
          </button>
          
          <div className="flex gap-2">
            {selectedJob.status === 'Signed Off' && (
              <button
                onClick={() => handleOpenCertificate(selectedJob)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Certificate
              </button>
            )}
            <button
              onClick={() => handleCancelJob(selectedJob.jobId)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-3 py-1.5 text-xs font-medium transition"
            >
              Cancel Job
            </button>
          </div>
        </div>

        {/* High-level Workflow Stepper */}
        <div id="high-level-workflow-stepper" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Calibration Phase Progress
            </h3>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-md border border-indigo-100 dark:border-indigo-950">
              Phase {currentPhaseIndex + 1 > 4 ? 4 : currentPhaseIndex + 1} of 4: {phases[currentPhaseIndex >= 4 ? 3 : currentPhaseIndex].name}
            </span>
          </div>

          <div className="relative">
            {/* Background Line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-zinc-100 dark:bg-zinc-850 rounded-full z-0"></div>
            
            {/* Active Progress Line */}
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500 z-0"
              style={{ width: `${currentPhaseIndex === 4 ? 100 : (currentPhaseIndex / 3) * 100}%` }}
            ></div>

            <div className="relative flex justify-between z-10">
              {phases.map((phase, idx) => {
                const isCompleted = idx < currentPhaseIndex;
                const isActive = idx === currentPhaseIndex;
                
                return (
                  <div key={phase.id} className="flex flex-col items-center flex-1">
                    <div 
                      className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 border-2 font-bold text-xs z-10 ${
                        isCompleted 
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs' 
                          : isActive 
                            ? 'bg-indigo-600 border-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/50 scale-110 shadow-sm' 
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                    
                    <div className="text-center mt-2">
                      <span className={`block text-[11px] font-bold transition-colors duration-150 ${
                        isActive ? 'text-indigo-600 dark:text-indigo-400' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'
                      }`}>
                        {phase.name}
                      </span>
                      <span className="hidden md:block text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {phase.description}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-600 dark:text-indigo-400">
                ISO/IEC 17025 Compliance Laboratory Workspace
              </span>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mt-1">
                <Gauge className="h-5 w-5 text-indigo-500" />
                Calibration Session: #{selectedJob.jobId}
              </h1>
              <p className="text-xs text-zinc-500 mt-1">
                Calibrating physical instrument {selectedJob.sensorName} (S/N: {selectedJob.serialNumber})
              </p>
            </div>
            
            <div className="text-right text-xs">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">Planned Calibrator:</div>
              <div className="text-zinc-500 mt-0.5">{selectedJob.plannedCalibrator}</div>
            </div>
          </div>

          {/* Stepper progress indicator */}
          <div className="mt-8 relative">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-zinc-200 dark:bg-zinc-800 z-0"></div>
            <div className="relative flex justify-between z-10">
              {stages.map((stage, idx) => {
                const Icon = stage.icon;
                const isCompleted = idx < currentStageIndex || selectedJob.status === 'Signed Off';
                const isActive = idx === currentStageIndex && selectedJob.status !== 'Signed Off';
                
                return (
                  <div key={stage.id} className="flex flex-col items-center">
                    <div 
                      className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 border ${
                        isCompleted 
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs' 
                          : isActive 
                            ? 'bg-indigo-600 border-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/50 scale-110' 
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400'
                      }`}
                      title={stage.name}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={`text-[10px] font-semibold mt-2 max-w-[80px] text-center hidden md:block ${
                      isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : isCompleted ? 'text-emerald-600' : 'text-zinc-400'
                    }`}>
                      {stage.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Workspace Splitting Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* LEFT/MID: Interactive active stage view */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                  {currentStageIndex + 1}
                </span>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Active Sequence Stage: {stages[currentStageIndex]?.name}
                </h2>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-950">
                17025 Sequence Compliance
              </span>
            </div>

            <div className="p-6">
              {selectedJob.status === 'Signed Off' ? (
                <div className="text-center py-10 space-y-4">
                  <Award className="h-14 w-14 text-emerald-500 mx-auto" />
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">ISO/IEC 17025 Calibration Complete & Certified</h3>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto">
                    This job has been fully processed, tech-reviewed, and signatory signed-off with cryptographic electronic seal lock.
                  </p>
                  <div className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-850/40 rounded-lg text-emerald-800 dark:text-emerald-400 text-xs font-mono">
                    <Fingerprint className="h-4 w-4" />
                    Seal Lock Verified: {selectedJob.eSignatureHash?.substring(0, 16)}...
                  </div>
                  <div>
                    <button
                      onClick={() => handleOpenCertificate(selectedJob)}
                      className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-semibold text-white transition mt-4"
                    >
                      Open Calibration Certificate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* DYNAMIC FORM RENDERING ACCORDING TO STAGE */}
                  
                  {/* STAGE 1: PLAN */}
                  {selectedJob.currentStage === 'Plan' && (
                    <div className="space-y-4">
                      {!canModifyMetrology && (
                        <div className="bg-amber-50/70 border border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-950/40 dark:text-amber-400 p-4 rounded-lg text-xs flex items-start gap-3">
                          <Lock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold uppercase tracking-wider text-[10px]">Metrologist Authorization Required</p>
                            <p className="mt-1">
                              Your active account role is <span className="font-semibold text-amber-800 dark:text-amber-300">"{user?.role || 'Guest'}"</span>. 
                              Only a <strong>Lab Metrologist</strong> or <strong>Super Administrator</strong> is authorized to edit and lock calibration planning parameters under ISO/IEC 17025 rules.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-4 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs text-indigo-800 dark:text-indigo-400 space-y-2">
                        <p className="font-bold flex items-center gap-1.5 text-sm">
                          <Info className="h-4 w-4" /> Stage 1: Calibration Planning
                        </p>
                        <p>
                          Documenting the planning parameters is required prior to initiating reference standards or physical measurements under ISO/IEC 17025 guidelines. This registers the scheduled calibrator technician and standard laboratory procedure.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Calibration Scheduled Date</label>
                          <input 
                            type="date"
                            disabled={!canModifyMetrology}
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none disabled:opacity-50"
                            value={stagePayload.plannedDate || selectedJob.plannedDate || ''}
                            onChange={(e) => setStagePayload({...stagePayload, plannedDate: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Lead Metrological Calibrator</label>
                          <input 
                            type="text"
                            disabled={!canModifyMetrology}
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none disabled:opacity-50"
                            value={stagePayload.plannedCalibrator || selectedJob.plannedCalibrator || ''}
                            onChange={(e) => setStagePayload({...stagePayload, plannedCalibrator: e.target.value})}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">SOP / Laboratory Procedure followed</label>
                          <select 
                            disabled={!canModifyMetrology}
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none disabled:opacity-50"
                            value={stagePayload.calibrationProcedure || selectedJob.calibrationProcedure || ''}
                            onChange={(e) => setStagePayload({...stagePayload, calibrationProcedure: e.target.value})}
                          >
                            <option value="SOP-CAL-01: Standard Meteorological Temperature Sensor Calibration">SOP-CAL-01: Temperature Sensor Calibration</option>
                            <option value="SOP-CAL-02: Micro-Barometer Standard Calibration Sequence">SOP-CAL-02: Barometer Pressure Calibration</option>
                            <option value="SOP-CAL-03: Dynamic Wind Speed & Tunnel Verification Procedure">SOP-CAL-03: Anemometer Speed Calibration</option>
                            <option value="SOP-CAL-04: Saturated Salt Chamber Humidity Verification">SOP-CAL-04: Hygrometer Humidity Calibration</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                          disabled={!canModifyMetrology}
                          onClick={() => handleTransitionStage('Plan', 'ReferenceSelection', {
                            plannedDate: stagePayload.plannedDate || selectedJob.plannedDate,
                            plannedCalibrator: stagePayload.plannedCalibrator || selectedJob.plannedCalibrator,
                            calibrationProcedure: stagePayload.calibrationProcedure || selectedJob.calibrationProcedure || 'SOP-CAL-01'
                          })}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {!canModifyMetrology && <Lock className="h-3.5 w-3.5" />}
                          Lock & Progress to Reference selection
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STAGE 2: REFERENCE STANDARD SELECTION */}
                  {selectedJob.currentStage === 'ReferenceSelection' && (
                    <div className="space-y-4">
                      {!canModifyMetrology && (
                        <div className="bg-amber-50/70 border border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-950/40 dark:text-amber-400 p-4 rounded-lg text-xs flex items-start gap-3">
                          <Lock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold uppercase tracking-wider text-[10px]">Metrologist Authorization Required</p>
                            <p className="mt-1">
                              Your active account role is <span className="font-semibold text-amber-800 dark:text-amber-300">"{user?.role || 'Guest'}"</span>. 
                              Only a <strong>Lab Metrologist</strong> or <strong>Super Administrator</strong> is authorized to select traceability reference standards under ISO/IEC 17025 rules.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-4 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs text-indigo-800 dark:text-indigo-400 space-y-2">
                        <p className="font-bold flex items-center gap-1.5 text-sm">
                          <Layers className="h-4 w-4" /> Stage 2: Reference Standard Selection
                        </p>
                        <p>
                          ISO/IEC 17025 requires all measurements to be metrologically traceable to international standard units through an unbroken chain of calibrations. Select a registered master laboratory standard that is within its valid calibration window.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Select Reference Standard Equipment</label>
                        <select 
                          disabled={!canModifyMetrology}
                          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none font-medium disabled:opacity-50"
                          value={stagePayload.deviceId || selectedJob.deviceId || ''}
                          onChange={(e) => setStagePayload({...stagePayload, deviceId: e.target.value})}
                        >
                          <option value="">-- Choose Traceable Master Instrument --</option>
                          {devices
                            .filter(d => d.status === 'Active')
                            .map(d => (
                              <option key={d.deviceId} value={d.deviceId}>
                                {d.deviceName} (S/N: {d.serialNumber}) [Class: {d.accuracyClass || 'N/A'}] (Due: {d.calibrationDue || 'N/A'})
                              </option>
                            ))}
                        </select>
                      </div>

                      {stagePayload.deviceId && (
                        (() => {
                          const devObj = devices.find(d => d.deviceId === parseInt(stagePayload.deviceId));
                          if (!devObj) return null;
                          return (
                            <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Traceability Verified
                              </p>
                              <div className="grid grid-cols-2 gap-4 text-zinc-500">
                                <div>Standard S/N: <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold">{devObj.serialNumber}</span></div>
                                <div>Accuracy Rating: <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{devObj.accuracyClass}</span></div>
                                <div>Last Traceability Date: <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{devObj.lastCalibrated}</span></div>
                                <div>Certificate Valid Until: <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{devObj.calibrationDue}</span></div>
                              </div>
                            </div>
                          );
                        })()
                      )}

                      <div className="flex justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                          onClick={() => handleTransitionStage('ReferenceSelection', 'Plan', {})}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-semibold transition"
                        >
                          <ChevronLeft className="h-4 w-4" /> Previous
                        </button>
                        <button
                          onClick={() => handleTransitionStage('ReferenceSelection', 'EnvironmentCheck', {
                            deviceId: stagePayload.deviceId || selectedJob.deviceId
                          })}
                          disabled={!canModifyMetrology || (!stagePayload.deviceId && !selectedJob.deviceId)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {!canModifyMetrology && <Lock className="h-3.5 w-3.5" />}
                          Lock & Progress to Environment Check
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STAGE 3: ENVIRONMENT CHECK */}
                  {selectedJob.currentStage === 'EnvironmentCheck' && (
                    <div className="space-y-4">
                      {!canModifyMetrology && (
                        <div className="bg-amber-50/70 border border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-950/40 dark:text-amber-400 p-4 rounded-lg text-xs flex items-start gap-3">
                          <Lock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold uppercase tracking-wider text-[10px]">Metrologist Authorization Required</p>
                            <p className="mt-1">
                              Your active account role is <span className="font-semibold text-amber-800 dark:text-amber-300">"{user?.role || 'Guest'}"</span>. 
                              Only a <strong>Lab Metrologist</strong> or <strong>Super Administrator</strong> is authorized to perform laboratory ambient environment checks under ISO/IEC 17025 rules.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-4 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs text-indigo-800 dark:text-indigo-400 space-y-2">
                        <p className="font-bold flex items-center gap-1.5 text-sm">
                          <Thermometer className="h-4 w-4" /> Stage 3: Ambient Laboratory Environment Check
                        </p>
                        <p>
                          ISO/IEC 17025 standard laboratory environments must maintain strict temperature, relative humidity, and pressure tolerances to avoid expansion errors or instrumentation drift. Register ambient parameters before testing.
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Ambient Temp (20°C ± 4°C)</label>
                          <div className="relative">
                            <input 
                              type="number"
                              step="0.1"
                              placeholder="21.5"
                              disabled={!canModifyMetrology}
                              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 pl-3 pr-8 py-2 text-sm focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none disabled:opacity-50"
                              value={stagePayload.ambientTemperature || ''}
                              onChange={(e) => setStagePayload({...stagePayload, ambientTemperature: e.target.value})}
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-zinc-400">°C</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Relative Humidity (50% ± 20%)</label>
                          <div className="relative">
                            <input 
                              type="number"
                              step="0.1"
                              placeholder="48.2"
                              disabled={!canModifyMetrology}
                              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 pl-3 pr-8 py-2 text-sm focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none disabled:opacity-50"
                              value={stagePayload.ambientHumidity || ''}
                              onChange={(e) => setStagePayload({...stagePayload, ambientHumidity: e.target.value})}
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-zinc-400">%</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Ambient Pressure (1013 ± 50 hPa)</label>
                          <div className="relative">
                            <input 
                              type="number"
                              step="0.1"
                              placeholder="1011.3"
                              disabled={!canModifyMetrology}
                              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 pl-3 pr-10 py-2 text-sm focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none disabled:opacity-50"
                              value={stagePayload.ambientPressure || ''}
                              onChange={(e) => setStagePayload({...stagePayload, ambientPressure: e.target.value})}
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-zinc-400">hPa</span>
                          </div>
                        </div>
                      </div>

                      {stagePayload.ambientTemperature && stagePayload.ambientHumidity && stagePayload.ambientPressure && (
                        (() => {
                          const temp = parseFloat(stagePayload.ambientTemperature);
                          const hum = parseFloat(stagePayload.ambientHumidity);
                          const pres = parseFloat(stagePayload.ambientPressure);
                          const tempValid = temp >= 16 && temp <= 24;
                          const humValid = hum >= 30 && hum <= 70;
                          const presValid = pres >= 960 && pres <= 1063;
                          const envStatus = tempValid && humValid && presValid ? 'Within Limits' : 'Outside Limits';
                          
                          return (
                            <div className={`p-4 rounded-lg border text-xs space-y-2 flex items-start gap-3 transition ${
                              envStatus === 'Within Limits' 
                                ? 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400' 
                                : 'bg-rose-50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/30 text-rose-800 dark:text-rose-400'
                            }`}>
                              {envStatus === 'Within Limits' ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
                              )}
                              <div className="space-y-1">
                                <p className="font-bold">Laboratory Condition Check: {envStatus}</p>
                                <p className="text-zinc-500 dark:text-zinc-400">
                                  {envStatus === 'Within Limits' 
                                    ? 'All environmental logs comply with standard Met. Department Laboratory calibration parameters. Safe to proceed.' 
                                    : 'WARNING: Ambient parameters exceed recommended thresholds! Document justifications before recording physical measurements.'}
                                </p>
                              </div>
                            </div>
                          );
                        })()
                      )}

                      <div className="flex justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                          onClick={() => handleTransitionStage('EnvironmentCheck', 'ReferenceSelection', {})}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-semibold transition"
                        >
                          <ChevronLeft className="h-4 w-4" /> Previous
                        </button>
                        <button
                          onClick={() => {
                            const temp = parseFloat(stagePayload.ambientTemperature);
                            const hum = parseFloat(stagePayload.ambientHumidity);
                            const pres = parseFloat(stagePayload.ambientPressure);
                            const tempValid = temp >= 16 && temp <= 24;
                            const humValid = hum >= 30 && hum <= 70;
                            const presValid = pres >= 960 && pres <= 1063;
                            
                            handleTransitionStage('EnvironmentCheck', 'Measurements', {
                              ambientTemperature: temp,
                              ambientHumidity: hum,
                              ambientPressure: pres,
                              environmentStatus: tempValid && humValid && presValid ? 'Within Limits' : 'Outside Limits'
                            });
                          }}
                          disabled={!canModifyMetrology || !stagePayload.ambientTemperature || !stagePayload.ambientHumidity || !stagePayload.ambientPressure}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {!canModifyMetrology && <Lock className="h-3.5 w-3.5" />}
                          Lock & Progress to Measurements
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STAGE 4: MEASUREMENTS */}
                  {selectedJob.currentStage === 'Measurements' && (
                    <div className="space-y-4">
                      {!canModifyMetrology && (
                        <div className="bg-amber-50/70 border border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-950/40 dark:text-amber-400 p-4 rounded-lg text-xs flex items-start gap-3">
                          <Lock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold uppercase tracking-wider text-[10px]">Metrologist Authorization Required</p>
                            <p className="mt-1">
                              Your active account role is <span className="font-semibold text-amber-800 dark:text-amber-300">"{user?.role || 'Guest'}"</span>. 
                              Only a <strong>Lab Metrologist</strong> or <strong>Super Administrator</strong> is authorized to perform meteorological calibration readings under ISO/IEC 17025 rules.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-4 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs text-indigo-800 dark:text-indigo-400 space-y-2">
                        <p className="font-bold flex items-center gap-1.5 text-sm">
                          <Wrench className="h-4 w-4" /> Stage 4: Multi-point Metrological Calibration Readings
                        </p>
                        <p>
                          Verify and register reading deviations at key points defined by meteorological rules. Raw physical errors are computed instantly: <span className="font-semibold font-mono text-[11px]">Error = Sensor Reading - Reference Standard</span>.
                        </p>
                      </div>

                      {(() => {
                        // Load or initialize test points
                        const tolConfig = MET_TOLERANCES[selectedJob.sensorType || 'Default'] || MET_TOLERANCES['Default'];
                        const savedPoints = selectedJob.measurements ? JSON.parse(selectedJob.measurements) : null;
                        
                        // Initialize points in state if not done yet
                        if (!stagePayload.pointsList) {
                          const pts = savedPoints || tolConfig.points.map(pt => ({
                            refValue: pt,
                            sensorValue: pt,
                            error: 0
                          }));
                          setStagePayload({ ...stagePayload, pointsList: pts });
                          return null;
                        }

                        const handlePointField = (index: number, field: 'refValue' | 'sensorValue', val: string) => {
                          const num = parseFloat(val) || 0;
                          const list = [...stagePayload.pointsList];
                          list[index][field] = num;
                          list[index].error = parseFloat((list[index].sensorValue - list[index].refValue).toFixed(3));
                          setStagePayload({ ...stagePayload, pointsList: list });
                        };

                        return (
                          <div className="space-y-4">
                            <div className="overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-lg">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-zinc-50 dark:bg-zinc-950/20 text-zinc-500 dark:text-zinc-400 font-bold border-b border-zinc-100 dark:border-zinc-800">
                                    <th className="p-3">Calibration Point</th>
                                    <th className="p-3">Reference Standard Value ({tolConfig.unit})</th>
                                    <th className="p-3">Sensor Under Test Value ({tolConfig.unit})</th>
                                    <th className="p-3">Instrument Deviation / Error ({tolConfig.unit})</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                                  {stagePayload.pointsList.map((pt: any, idx: number) => (
                                    <tr key={idx}>
                                      <td className="p-3 font-semibold text-zinc-500">Test Point #{idx + 1}</td>
                                      <td className="p-3">
                                        <input 
                                          type="number"
                                          step="0.01"
                                          disabled={!canModifyMetrology}
                                          className="rounded border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-xs focus:border-indigo-500 dark:bg-zinc-950 w-24 font-mono font-bold disabled:opacity-50"
                                          value={pt.refValue}
                                          onChange={(e) => handlePointField(idx, 'refValue', e.target.value)}
                                        />
                                      </td>
                                      <td className="p-3">
                                        <input 
                                          type="number"
                                          step="0.01"
                                          disabled={!canModifyMetrology}
                                          className="rounded border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-xs focus:border-indigo-500 dark:bg-zinc-950 w-24 font-mono font-bold disabled:opacity-50"
                                          value={pt.sensorValue}
                                          onChange={(e) => handlePointField(idx, 'sensorValue', e.target.value)}
                                        />
                                      </td>
                                      <td className={`p-3 font-mono font-bold ${Math.abs(pt.error) > tolConfig.maxError ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {pt.error > 0 ? `+${pt.error}` : pt.error} {tolConfig.unit}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="flex justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                              <button
                                onClick={() => handleTransitionStage('Measurements', 'EnvironmentCheck', {})}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-semibold transition"
                              >
                                <ChevronLeft className="h-4 w-4" /> Previous
                              </button>
                              <button
                                onClick={() => handleTransitionStage('Measurements', 'Uncertainty', {
                                  measurements: stagePayload.pointsList
                                })}
                                disabled={!canModifyMetrology}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {!canModifyMetrology && <Lock className="h-3.5 w-3.5" />}
                                Lock & Progress to Uncertainty Budget
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* STAGE 5: UNCERTAINTY BUDGET */}
                  {selectedJob.currentStage === 'Uncertainty' && (
                    <div className="space-y-4">
                      {!canModifyMetrology && (
                        <div className="bg-amber-50/70 border border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-950/40 dark:text-amber-400 p-4 rounded-lg text-xs flex items-start gap-3">
                          <Lock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold uppercase tracking-wider text-[10px]">Metrologist Authorization Required</p>
                            <p className="mt-1">
                              Your active account role is <span className="font-semibold text-amber-800 dark:text-amber-300">"{user?.role || 'Guest'}"</span>. 
                              Only a <strong>Lab Metrologist</strong> or <strong>Super Administrator</strong> is authorized to calculate metrological uncertainty budgets under ISO/IEC 17025 rules.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-4 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs text-indigo-800 dark:text-indigo-400 space-y-2">
                        <p className="font-bold flex items-center gap-1.5 text-sm">
                          <Scale className="h-4 w-4" /> Stage 5: ISO/IEC 17025 Uncertainty Budget Calculation
                        </p>
                        <p>
                          A statement of calibration accuracy is incomplete without an expanded uncertainty budget. Register standard contributions to compute the combined standard uncertainty: uc = √(uA² + u_std² + u_res²). The expanded uncertainty is calculated using a coverage factor of k = 2 for a 95% confidence interval.
                        </p>
                      </div>

                      {(() => {
                        // Load or calculate default Type A repeatability
                        const savedUnc = selectedJob.uncertaintyBudget ? JSON.parse(selectedJob.uncertaintyBudget) : null;
                        const savedPoints = selectedJob.measurements ? JSON.parse(selectedJob.measurements) : [];
                        
                        // Type A is repeatability (standard deviation of errors)
                        let calculatedTypeA = 0.01;
                        if (savedPoints.length > 1) {
                          const errors = savedPoints.map((pt: any) => pt.error);
                          const mean = errors.reduce((acc: number, val: number) => acc + val, 0) / errors.length;
                          const sqDiffSum = errors.reduce((acc: number, val: number) => acc + Math.pow(val - mean, 2), 0);
                          calculatedTypeA = parseFloat(Math.sqrt(sqDiffSum / (errors.length - 1)).toFixed(4));
                        }

                        if (!stagePayload.uncertaintyBudget) {
                          const standardTraceableUncertainty = selectedJob.sensorType === 'Thermometer' ? 0.02 : 0.05;
                          const deviceResolution = selectedJob.sensorType === 'Thermometer' ? 0.01 : 0.1;
                          
                          // Default budget parameters
                          const budget = savedUnc || {
                            repeatability: calculatedTypeA || 0.01,
                            referenceUncertainty: standardTraceableUncertainty,
                            resolutionError: parseFloat((deviceResolution / Math.sqrt(3)).toFixed(4)), // Rectangular distribution
                            combinedUncertainty: 0,
                            expandedUncertainty: 0,
                            coverageFactor: 2
                          };
                          
                          // Auto calculate combined
                          const combined = parseFloat(Math.sqrt(
                            Math.pow(budget.repeatability, 2) + 
                            Math.pow(budget.referenceUncertainty, 2) + 
                            Math.pow(budget.resolutionError, 2)
                          ).toFixed(4));
                          
                          budget.combinedUncertainty = combined;
                          budget.expandedUncertainty = parseFloat((combined * budget.coverageFactor).toFixed(4));
                          
                          setStagePayload({ ...stagePayload, uncertaintyBudget: budget });
                          return null;
                        }

                        const handleBudgetValue = (field: string, val: string) => {
                          const num = parseFloat(val) || 0;
                          const budget = { ...stagePayload.uncertaintyBudget, [field]: num };
                          
                          // Recalculate Combined and Expanded
                          const combined = parseFloat(Math.sqrt(
                            Math.pow(budget.repeatability, 2) + 
                            Math.pow(budget.referenceUncertainty, 2) + 
                            Math.pow(budget.resolutionError, 2)
                          ).toFixed(4));
                          
                          budget.combinedUncertainty = combined;
                          budget.expandedUncertainty = parseFloat((combined * budget.coverageFactor).toFixed(4));
                          setStagePayload({ ...stagePayload, uncertaintyBudget: budget });
                        };

                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3">
                                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase">Registered Uncertainty Contributions</h3>
                                
                                <div>
                                  <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Type A - Repeatability (Std. Dev of points) [uA]</label>
                                  <input 
                                    type="number"
                                    step="0.0001"
                                    disabled={!canModifyMetrology}
                                    className="w-full rounded border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-xs focus:border-indigo-500 dark:bg-zinc-900 font-mono font-bold disabled:opacity-50"
                                    value={stagePayload.uncertaintyBudget.repeatability}
                                    onChange={(e) => handleBudgetValue('repeatability', e.target.value)}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Type B1 - Reference Standard traceable uncertainty [uB1]</label>
                                  <input 
                                    type="number"
                                    step="0.0001"
                                    disabled={!canModifyMetrology}
                                    className="w-full rounded border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-xs focus:border-indigo-500 dark:bg-zinc-900 font-mono font-bold disabled:opacity-50"
                                    value={stagePayload.uncertaintyBudget.referenceUncertainty}
                                    onChange={(e) => handleBudgetValue('referenceUncertainty', e.target.value)}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Type B2 - Resolution error contribution (Res/√3) [uB2]</label>
                                  <input 
                                    type="number"
                                    step="0.0001"
                                    disabled={!canModifyMetrology}
                                    className="w-full rounded border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-xs focus:border-indigo-500 dark:bg-zinc-900 font-mono font-bold disabled:opacity-50"
                                    value={stagePayload.uncertaintyBudget.resolutionError}
                                    onChange={(e) => handleBudgetValue('resolutionError', e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col justify-between">
                                <div className="space-y-3">
                                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase">Calculated Budget Totals</h3>
                                  
                                  <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                    <span className="text-xs text-zinc-500">Combined Std. Uncertainty (uc)</span>
                                    <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">±{stagePayload.uncertaintyBudget.combinedUncertainty}</span>
                                  </div>

                                  <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                    <span className="text-xs text-zinc-500">Coverage Factor (k)</span>
                                    <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">2.00 (95%)</span>
                                  </div>

                                  <div className="flex justify-between">
                                    <span className="text-xs text-zinc-900 dark:text-zinc-100 font-bold">Expanded Uncertainty (U)</span>
                                    <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">±{stagePayload.uncertaintyBudget.expandedUncertainty}</span>
                                  </div>
                                </div>

                                <div className="text-[10px] text-zinc-500 border-t border-zinc-200 dark:border-zinc-850 pt-2 flex items-center gap-1">
                                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                                  Mathematical uncertainty calculations generated natively according to GUM guidelines.
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                              <button
                                onClick={() => handleTransitionStage('Uncertainty', 'Measurements', {})}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-semibold transition"
                              >
                                <ChevronLeft className="h-4 w-4" /> Previous
                              </button>
                              <button
                                onClick={() => handleTransitionStage('Uncertainty', 'Conformity', {
                                  uncertaintyBudget: stagePayload.uncertaintyBudget
                                })}
                                disabled={!canModifyMetrology}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {!canModifyMetrology && <Lock className="h-3.5 w-3.5" />}
                                Lock & Progress to Conformity Evaluation
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* STAGE 6: CONFORMITY EVALUATION */}
                  {selectedJob.currentStage === 'Conformity' && (
                    <div className="space-y-4">
                      <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-4 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs text-indigo-800 dark:text-indigo-400 space-y-2">
                        <p className="font-bold flex items-center gap-1.5 text-sm">
                          <Scale className="h-4 w-4" /> Stage 6: Conformity Evaluation (ILAC-G8 Decision Rules)
                        </p>
                        <p>
                          ISO/IEC 17025 dictates that declaring conformity (Pass/Fail) requires a defined decision rule. Select the compliance guideline to apply against Maximum Permissible Error (MPE) tolerances.
                        </p>
                      </div>

                      {(() => {
                        const type = selectedJob.sensorType || 'Default';
                        const tolConfig = MET_TOLERANCES[type] || MET_TOLERANCES['Default'];
                        const savedPoints = selectedJob.measurements ? JSON.parse(selectedJob.measurements) : [];
                        const budget = selectedJob.uncertaintyBudget ? JSON.parse(selectedJob.uncertaintyBudget) : { expandedUncertainty: 0.05 };
                        const U = budget.expandedUncertainty;
                        const MPE = tolConfig.maxError;

                        // Calculate results based on decision rules
                        const decisionRule = stagePayload.conformityDecisionRule || 'Simple Acceptance (ILAC-G8:9)';
                        
                        let conformityVerdict = 'Passed';
                        let notes = '';

                        const errors = savedPoints.map((p: any) => Math.abs(p.error));
                        const maxError = Math.max(...errors, 0);

                        if (decisionRule === 'Simple Acceptance (ILAC-G8:9)') {
                          // Pass if |error| <= MPE
                          conformityVerdict = maxError <= MPE ? 'Passed' : 'Failed';
                          notes = `Evaluated under Simple Acceptance rule: Max Error (${maxError}) is ${maxError <= MPE ? 'within' : 'outside'} MPE (±${MPE} ${tolConfig.unit}).`;
                        } else {
                          // Guard-banded (Stringent / Safe): Pass if |error| + U <= MPE
                          conformityVerdict = (maxError + U) <= MPE ? 'Passed' : 'Failed';
                          notes = `Evaluated under Guard-Banded (Stringent) rule: Max Error (${maxError}) + Expanded Uncertainty (±${U}) is ${(maxError + U) <= MPE ? 'within' : 'outside'} MPE (±${MPE} ${tolConfig.unit}).`;
                        }

                        // Auto prefill state payload
                        if (!stagePayload.conformityResult) {
                          setStagePayload({
                            ...stagePayload,
                            conformityDecisionRule: decisionRule,
                            conformityResult: conformityVerdict,
                            conformityNotes: notes
                          });
                          return null;
                        }

                        const canFinalizeConformity = user?.role === 'Authorized Signatory' || user?.role === 'Super Administrator';

                        return (
                          <div className="space-y-4">
                            {!canFinalizeConformity && (
                              <div className="bg-amber-50/70 border border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-950/40 dark:text-amber-400 p-4 rounded-lg text-xs flex items-start gap-3">
                                <Lock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                  <p className="font-bold uppercase tracking-wider text-[10px]">Signatory Authorization Required</p>
                                  <p className="mt-1">
                                    Your current account role is <span className="font-semibold text-amber-800 dark:text-amber-300">"{user?.role || 'Guest'}"</span>. 
                                    Only an <strong>Authorized Signatory</strong> or <strong>Super Administrator</strong> is permitted to evaluate, verify compliance thresholds, and finalize the Conformity stage under ISO/IEC 17025 regulations.
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Select Conformity Decision Rule</label>
                                  <select 
                                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                                    value={stagePayload.conformityDecisionRule}
                                    disabled={!canFinalizeConformity}
                                    onChange={(e) => {
                                      setStagePayload({
                                        ...stagePayload,
                                        conformityDecisionRule: e.target.value,
                                        conformityResult: '', // force recalculation on render
                                      });
                                    }}
                                  >
                                    <option value="Simple Acceptance (ILAC-G8:9)">Simple Acceptance (Pass if Max Error ≤ MPE)</option>
                                    <option value="Guard-Banded Acceptance (ILAC-G8:10)">Guard-Banded Acceptance (Pass if Max Error + U ≤ MPE)</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Max Error Encountered</label>
                                  <div className="text-sm font-semibold font-mono p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded">
                                    {maxError} {tolConfig.unit} (Permissible: ±{MPE} {tolConfig.unit})
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Evaluation Verdict</label>
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border ${
                                    stagePayload.conformityResult === 'Passed' 
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                      : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400'
                                  }`}>
                                    {stagePayload.conformityResult === 'Passed' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                    Conformity {stagePayload.conformityResult}
                                  </span>
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Decision Justification Notes</label>
                                  <textarea 
                                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                                    rows={3}
                                    value={stagePayload.conformityNotes}
                                    disabled={!canFinalizeConformity}
                                    onChange={(e) => setStagePayload({...stagePayload, conformityNotes: e.target.value})}
                                  />
                                </div>
                              </div>
                            </div>

                            {(() => {
                              const sensorObj = sensors.find(s => s.sensorId === selectedJob.sensorId);
                              const today = new Date();
                              today.setHours(0,0,0,0);
                              const isUnderWarranty = sensorObj && sensorObj.warrantyEndDate && new Date(sensorObj.warrantyEndDate) >= today;

                              if (stagePayload.conformityResult !== 'Failed') return null;

                              return (
                                <div className="mt-4 p-4 rounded-lg border border-rose-200 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/10 space-y-3">
                                  <div className="flex items-start gap-2.5">
                                    <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                                    <div className="text-xs">
                                      <p className="font-bold text-rose-800 dark:text-rose-400">ISO/IEC 17025 Conformity Verdict: FAILED</p>
                                      {isUnderWarranty ? (
                                        <p className="text-rose-700 dark:text-rose-300 mt-1">
                                          <strong>Active Warranty Protection Detected!</strong> This instrument's registered procurement coverage runs until <strong>{new Date(sensorObj.warrantyEndDate!).toLocaleDateString()}</strong>. You are fully eligible to file an automated warranty replacement claim.
                                        </p>
                                      ) : (
                                        <p className="text-zinc-500 mt-1">
                                          No active warranty coverage detected. Procurement date was {sensorObj?.procurementDate || 'N/A'} (Warranty Expired: {sensorObj?.warrantyEndDate || 'N/A'}).
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {isUnderWarranty && (
                                    <button
                                      onClick={handleTriggerWarrantyClaimFlow}
                                      disabled={triggeringClaim}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-md transition cursor-pointer disabled:opacity-50"
                                    >
                                      <ClipboardList className="h-4 w-4" />
                                      {triggeringClaim ? 'Processing & Flagging Supplier...' : 'Trigger Pre-filled Warranty Claim & Flag Supplier'}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}

                            <div className="flex justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                              <button
                                onClick={() => handleTransitionStage('Conformity', 'Uncertainty', {})}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-semibold transition"
                              >
                                <ChevronLeft className="h-4 w-4" /> Previous
                              </button>
                              <button
                                disabled={!canFinalizeConformity}
                                onClick={() => handleTransitionStage('Conformity', 'Review', {
                                  conformityDecisionRule: stagePayload.conformityDecisionRule,
                                  conformityResult: stagePayload.conformityResult,
                                  conformityNotes: stagePayload.conformityNotes
                                })}
                                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                                  canFinalizeConformity 
                                    ? 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white cursor-pointer' 
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed'
                                }`}
                              >
                                {!canFinalizeConformity && <Lock className="h-3.5 w-3.5" />}
                                {canFinalizeConformity ? 'Lock & Progress to Technical Review' : 'Signatory Credentials Required'}
                                {canFinalizeConformity && <ArrowRight className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* STAGE 7: TECHNICAL REVIEW */}
                  {selectedJob.currentStage === 'Review' && (() => {
                    const canFinalizeReview = user?.role === 'Authorized Signatory' || user?.role === 'Super Administrator';
                    return (
                      <div className="space-y-4">
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-4 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs text-indigo-800 dark:text-indigo-400 space-y-2">
                          <p className="font-bold flex items-center gap-1.5 text-sm">
                            <FileCheck2 className="h-4 w-4" /> Stage 7: Independent Technical Review
                          </p>
                          <p>
                            To eliminate cognitive bias and errors, ISO/IEC 17025 mandates that an independent qualified reviewer other than the operating calibrator inspects the ambient conditions, reference standards, raw measurement readings, and mathematical uncertainty budget.
                          </p>
                        </div>

                        {!canFinalizeReview && (
                          <div className="bg-amber-50/70 border border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-950/40 dark:text-amber-400 p-4 rounded-lg text-xs flex items-start gap-3">
                            <Lock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold uppercase tracking-wider text-[10px]">Signatory Authorization Required</p>
                              <p className="mt-1">
                                Your active account role is <span className="font-semibold text-amber-800 dark:text-amber-300">"{user?.role || 'Guest'}"</span>. 
                                Only an <strong>Authorized Signatory</strong> or <strong>Super Administrator</strong> is permitted to approve technical reviews and lock the job for final certification under ISO/IEC 17025 regulations.
                              </p>
                            </div>
                          </div>
                        )}

                        {user?.email === selectedJob.plannedCalibrator ? (
                          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg text-xs flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold">Strict 17025 Separation of Duties Violation!</p>
                              <p className="mt-1">
                                You are currently registered as the Lead Calibrator technician for this job. To maintain compliant laboratory separations, please request another staff member (Supervisor or Administrator) to review and approve these measurement sets.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-lg text-xs flex items-start gap-3">
                            <ShieldCheck className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold">Compliant Reviewer Separation Confirmed</p>
                              <p className="mt-1">
                                Active account role matches separation of duties criteria. You are authorized to complete the Technical Review.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Review Comments & Validation Remarks</label>
                            <textarea 
                              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                              rows={3}
                              disabled={!canFinalizeReview}
                              placeholder="I have inspected the raw points, environment logs and expanded uncertainty. Calculations conform to CIMO rules and can be signed off."
                              value={stagePayload.reviewComments || ''}
                              onChange={(e) => setStagePayload({...stagePayload, reviewComments: e.target.value})}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          <button
                            onClick={() => handleTransitionStage('Review', 'Conformity', {})}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-semibold transition"
                          >
                            <ChevronLeft className="h-4 w-4" /> Previous
                          </button>
                          <button
                            disabled={!canFinalizeReview}
                            onClick={() => handleTransitionStage('Review', 'SignOff', {
                              reviewComments: stagePayload.reviewComments || 'Approved. Measurements verify compliance.'
                            })}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                              canFinalizeReview 
                                ? 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white cursor-pointer' 
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed'
                            }`}
                          >
                            {!canFinalizeReview && <Lock className="h-3.5 w-3.5" />}
                            {canFinalizeReview ? 'Approve Review & Lock Job' : 'Signatory Credentials Required'}
                            {canFinalizeReview && <ArrowRight className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* STAGE 8: AUTHORIZED SIGN-OFF */}
                  {selectedJob.currentStage === 'SignOff' && (() => {
                    const canSignOff = user?.role === 'Authorized Signatory' || user?.role === 'Super Administrator';
                    return (
                      <div className="space-y-4">
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-4 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs text-indigo-800 dark:text-indigo-400 space-y-2">
                          <p className="font-bold flex items-center gap-1.5 text-sm">
                            <FileSignature className="h-4 w-4" /> Stage 8: Authorized Signatory Final Certification & Lock
                          </p>
                          <p>
                            Formal sign-off registers electronic authorization signatures in the immutable audit registry. On sign-off, a unique SHA-256 seal lock will secure the raw data, and a central Meteorological Certificate will be generated.
                          </p>
                        </div>

                        {!canSignOff && (
                          <div className="bg-amber-50/70 border border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-950/40 dark:text-amber-400 p-4 rounded-lg text-xs flex items-start gap-3">
                            <Lock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold uppercase tracking-wider text-[10px]">Signatory Authorization Required</p>
                              <p className="mt-1">
                                Your active account role is <span className="font-semibold text-amber-800 dark:text-amber-300">"{user?.role || 'Guest'}"</span>. 
                                Only an <strong>Authorized Signatory</strong> or <strong>Super Administrator</strong> is authorized to apply the final digital compliance signature and seal this calibration job.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Signatory security form */}
                        <div className="bg-zinc-50 dark:bg-zinc-950 p-5 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-4">
                          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                            <Fingerprint className="h-5 w-5 text-indigo-600" />
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase">E-Signature Authentication Panel</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Authorized Signatory Name</label>
                              <input 
                                type="text"
                                disabled={!canSignOff}
                                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:border-indigo-500 dark:bg-zinc-900 font-bold"
                                placeholder={user?.displayName || 'Senior Meteorological Director'}
                                value={stagePayload.signatoryName || ''}
                                onChange={(e) => setStagePayload({...stagePayload, signatoryName: e.target.value})}
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Signatory Designation</label>
                              <input 
                                type="text"
                                disabled={!canSignOff}
                                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:border-indigo-500 dark:bg-zinc-900 font-bold"
                                placeholder="Lead Technical Laboratory Director"
                                value={stagePayload.signatoryDesignation || ''}
                                onChange={(e) => setStagePayload({...stagePayload, signatoryDesignation: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="flex items-start gap-2 pt-2 text-[10px] text-zinc-500">
                            <Lock className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                            <p>
                              By submitting this electronic signature, you formally authorize and certify that all measurements are traceably accurate, verifying full ISO/IEC 17025 laboratory standard compliance.
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          <button
                            onClick={() => handleTransitionStage('SignOff', 'Review', {})}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-semibold transition"
                          >
                            <ChevronLeft className="h-4 w-4" /> Previous
                          </button>
                          <button
                            onClick={() => handleSignOffJob(
                              stagePayload.signatoryName || user?.displayName || 'Lead Director',
                              stagePayload.signatoryDesignation || 'Lead Calibration Officer'
                            )}
                            disabled={!canSignOff || !stagePayload.signatoryName || !stagePayload.signatoryDesignation}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                              canSignOff && stagePayload.signatoryName && stagePayload.signatoryDesignation
                                ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white cursor-pointer'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed opacity-50'
                            }`}
                          >
                            {!canSignOff && <Lock className="h-3.5 w-3.5" />}
                            E-Sign & Certified Lock
                            <Award className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live Audit Trail Column */}
          <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                17025 Compliance Trail
              </span>
            </div>

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
              {auditTrail.map((log: any, index: number) => (
                <div key={index} className="relative pl-5 border-l-2 border-indigo-200 dark:border-indigo-900 last:border-transparent pb-3">
                  <div className="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500"></div>
                  <div className="text-[10px] font-semibold text-zinc-400">{new Date(log.timestamp).toLocaleString()}</div>
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{log.action}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{log.details}</div>
                  <div className="text-[9px] font-mono font-semibold text-indigo-600 mt-1">Operator: {log.user}</div>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-850 text-[10px] text-zinc-500 space-y-1">
              <p className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <Lock className="h-3.5 w-3.5 text-indigo-500" /> Immutable Trail Assurance
              </p>
              <p>
                Every stage completion modifies laboratory metadata, appending locked cryptographic logs to prevent database tampering and satisfy international accreditation reviewers.
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div id="calibration-lab-module" className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Gauge className="h-5 w-5 text-indigo-500" />
            Meteorological Calibration Lab Workstation
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            ISO/IEC 17025 compliant controlled sequence files, physical standard traceable registries, and authorized cryptographic seals.
          </p>
        </div>
        
        {!selectedJob && (
          <div className="flex items-center gap-2">
            {activeTab === 'devices' && (
              <button
                id="add-device-btn"
                onClick={() => handleOpenDeviceModal()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Register Reference Standard
              </button>
            )}
            <button
              onClick={() => { fetchDevices(); fetchJobs(); fetchHistory(); onRefresh(); }}
              className="p-2 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Refresh Data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      {!selectedJob && (
        <>
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => { setActiveTab('workflows'); setSearchQuery(''); }}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'workflows' 
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <Activity className="h-4 w-4" />
              Laboratory (Bench) Workflow
              {jobs.filter(j => j.status !== 'Signed Off').length > 0 && (
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {jobs.filter(j => j.status !== 'Signed Off').length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('insitu'); setSearchQuery(''); }}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'insitu' 
                  ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <RadioTower className="h-4 w-4 text-emerald-500" />
              Field (In-Situ) Verification
              {inSituLogs.length > 0 && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {inSituLogs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('devices'); setSearchQuery(''); }}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'devices' 
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <Layers className="h-4 w-4" />
              Reference Standards & Equipment
            </button>
            <button
              onClick={() => { setActiveTab('history'); setSearchQuery(''); }}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'history' 
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <History className="h-4 w-4" />
              Historical Certificates
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search standards, S/N references, or technicians..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 pl-10 pr-4 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
            />
          </div>

          {activeTab === 'workflows' && renderWorkflowsList()}

          {activeTab === 'insitu' && renderInSituView()}

          {activeTab === 'devices' && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-950/20 text-xs font-semibold text-zinc-500 border-b border-zinc-100 dark:border-zinc-850">
                      <th className="p-4">Standard Name</th>
                      <th className="p-4">S/N Code</th>
                      <th className="p-4">Recalibration Due</th>
                      <th className="p-4">Accuracy rating</th>
                      <th className="p-4">Operational Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850 text-sm">
                    {filteredDevices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-400">
                          No registered physical reference standards.
                        </td>
                      </tr>
                    ) : (
                      filteredDevices.map((device) => (
                        <tr key={device.deviceId} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-950/10 transition">
                          <td className="p-4">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{device.deviceName}</div>
                            <div className="text-xs text-zinc-500">{device.deviceType}</div>
                          </td>
                          <td className="p-4 font-mono text-xs">{device.serialNumber}</td>
                          <td className="p-4 text-xs font-medium">{device.calibrationDue || 'N/A'}</td>
                          <td className="p-4">
                            <span className="font-mono text-xs text-indigo-700 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30">
                              {device.accuracyClass || 'N/A'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              device.status === 'Active' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {device.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-1">
                            <button
                              onClick={() => handleOpenDeviceModal(device)}
                              className="p-1.5 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDevice(device.deviceId)}
                              className="p-1.5 text-zinc-500 hover:text-rose-600 rounded transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-950/20 text-xs font-semibold text-zinc-500 border-b border-zinc-100 dark:border-zinc-850">
                      <th className="p-4">Calibration Date</th>
                      <th className="p-4">Sensor Model</th>
                      <th className="p-4">Technician Name</th>
                      <th className="p-4">Evaluation Result</th>
                      <th className="p-4">Next Recalibration Due</th>
                      <th className="p-4 text-right">Certificate Log</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850 text-sm">
                    {filteredHistory.map((cal) => (
                      <tr key={cal.calibrationId} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-950/10 transition">
                        <td className="p-4 text-xs font-medium">{cal.calibrationDate}</td>
                        <td className="p-4">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{cal.sensorType || 'Meteorological Sensor'}</div>
                          <div className="text-xs text-zinc-400">Mfg: {cal.manufacturer || 'N/A'}</div>
                        </td>
                        <td className="p-4 text-xs font-medium">{cal.technicianName}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                            cal.result === 'Passed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {cal.result}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-medium text-zinc-500">{cal.nextDueDate}</td>
                        <td className="p-4 text-right">
                          {cal.notes && cal.notes.includes('Job') ? (
                            (() => {
                              // Identify the job ID
                              const match = cal.notes.match(/Job #(\d+)/);
                              const linkedJobId = match ? parseInt(match[1]) : null;
                              const jobObj = jobs.find(j => j.jobId === linkedJobId);
                              
                              if (jobObj) {
                                return (
                                  <button
                                    onClick={() => handleOpenCertificate(jobObj)}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                    Print Certificate
                                  </button>
                                );
                              }
                              return <span className="text-xs text-zinc-400">Legacy System Form</span>;
                            })()
                          ) : (
                            <span className="text-xs text-zinc-400">Legacy System Form</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {selectedJob && renderWorkspace()}

      {/* Modal: Schedule / Plan Calibration Job */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-50 dark:bg-zinc-950 px-6 py-4 border-b border-zinc-100 dark:border-zinc-850 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Plan ISO/IEC 17025 Calibration</h2>
              <button onClick={() => setShowPlanModal(false)} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold">×</button>
            </div>
            <form onSubmit={handleCreateJob} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Target Sensor under calibration *</label>
                <select
                  required
                  value={planSensorId}
                  onChange={(e) => setPlanSensorId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                >
                  <option value="">-- Choose Physical Sensor --</option>
                  {sensors
                    .filter(s => s.status !== 'Retired')
                    .map(s => (
                      <option key={s.sensorId} value={s.sensorId}>
                        [{s.sensorType}] S/N: {s.serialNumber || 'No S/N'} - {s.manufacturer} ({s.status})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Lead Met. Technician / Calibrator *</label>
                <input
                  type="text"
                  required
                  value={planCalibrator}
                  onChange={(e) => setPlanCalibrator(e.target.value)}
                  placeholder="Technician Full Name"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Calibration Planned Date *</label>
                <input
                  type="date"
                  required
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Standard laboratory SOP to follow</label>
                <select
                  value={planProcedure}
                  onChange={(e) => setPlanProcedure(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                >
                  <option value="SOP-CAL-01: Standard Meteorological Temperature Sensor Calibration">SOP-CAL-01: Temperature Sensor Calibration</option>
                  <option value="SOP-CAL-02: Micro-Barometer Standard Calibration Sequence">SOP-CAL-02: Barometer Pressure Calibration</option>
                  <option value="SOP-CAL-03: Dynamic Wind Speed & Tunnel Verification Procedure">SOP-CAL-03: Anemometer Speed Calibration</option>
                  <option value="SOP-CAL-04: Saturated Salt Chamber Humidity Verification">SOP-CAL-04: Hygrometer Humidity Calibration</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                >
                  Initiate Stage Sequence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register/Edit Reference Device */}
      {showDeviceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-50 dark:bg-zinc-950 px-6 py-4 border-b border-zinc-100 dark:border-zinc-850 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {editingDevice ? 'Edit Reference Standard' : 'Register Reference Standard'}
              </h2>
              <button onClick={() => setShowDeviceModal(false)} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold">×</button>
            </div>
            <form onSubmit={handleSaveDevice} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Equipment / Reference Standard Name *</label>
                  <input
                    type="text"
                    required
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="e.g. Fluke 7103 Micro-Bath"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Calibration Instrument Type *</label>
                  <select
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                  >
                    <option value="Thermometer Calibrator">Thermometer Calibrator</option>
                    <option value="Barometer Calibrator">Barometer Calibrator</option>
                    <option value="Anemometer Calibrator">Anemometer Calibrator</option>
                    <option value="Hygrometer Calibrator">Hygrometer Calibrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Traceable Instrument S/N *</label>
                  <input
                    type="text"
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="S/N references"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Accuracy Class rating</label>
                  <input
                    type="text"
                    value={accuracyClass}
                    onChange={(e) => setAccuracyClass(e.target.value)}
                    placeholder="e.g. ±0.02°C, ±0.01% FS"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Last Calibration Date</label>
                  <input
                    type="date"
                    value={lastCalibrated}
                    onChange={(e) => setLastCalibrated(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Next Recalibration Due</label>
                  <input
                    type="date"
                    value={calibrationDue}
                    onChange={(e) => setCalibrationDue(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Operational Status</label>
                  <select
                    value={deviceStatus}
                    onChange={(e) => setDeviceStatus(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                  >
                    <option value="Active">Active / Verified</option>
                    <option value="In Calibration">In Calibration</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Assigned Laboratory Location</label>
                  <input
                    type="text"
                    value={assignedLab}
                    onChange={(e) => setAssignedLab(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-indigo-500 dark:bg-zinc-950 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDeviceModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                >
                  Save Standard Equipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: ISO/IEC 17025 Formal printable certificate */}
      {showCertificateModal && selectedCertificate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 overflow-hidden border border-zinc-300 animate-in fade-in duration-200">
            {/* Top Certificate Actions bar */}
            <div className="bg-zinc-800 text-white px-6 py-3 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider">ISO/IEC 17025 Metrology Certificate</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  Print/PDF
                </button>
                <button
                  onClick={() => setShowCertificateModal(false)}
                  className="rounded bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Certificate Frame */}
            <div className="p-12 space-y-8 bg-white text-zinc-900 border-8 border-double border-zinc-300 m-4 relative printable-area">
              
              {/* Background watermark seal */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
                <Gauge className="h-96 w-96 text-zinc-900" />
              </div>

              {/* Header block */}
              <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-6 relative z-10">
                <div className="space-y-1">
                  <div className="text-lg font-bold text-zinc-950 uppercase tracking-widest flex items-center gap-1.5">
                    <Gauge className="h-6 w-6 text-indigo-700" />
                    National Metrological Department
                  </div>
                  <div className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Central Meteorology Instrument Calibration Lab</div>
                  <div className="text-[10px] text-zinc-500">ISO/IEC 17025 Accreditated Calibration Facility #MET-703</div>
                </div>
                
                <div className="text-right space-y-1">
                  <div className="text-xs font-bold text-zinc-600 uppercase tracking-wider">CERTIFICATE OF CALIBRATION</div>
                  <div className="text-md font-mono font-bold text-indigo-700">CERT-NMD-17025-{selectedCertificate.jobId}</div>
                  <div className="text-[10px] text-zinc-500">Traceability Certificate ID</div>
                </div>
              </div>

              {/* Certification Statement */}
              <div className="text-center space-y-2 relative z-10">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                  Official Instrument Seal of Accuracy
                </span>
                <p className="text-xs italic text-zinc-600 max-w-2xl mx-auto pt-2">
                  This calibration certificate documents the metrological traceability to national and international standard units of physical measurement, in accordance with ISO/IEC 17025 general standard compliance.
                </p>
              </div>

              {/* Equipment Under Test Specs */}
              <div className="grid grid-cols-2 gap-6 bg-zinc-50 border border-zinc-200 p-5 rounded-lg text-xs relative z-10">
                <div className="space-y-1.5">
                  <h3 className="font-bold text-zinc-950 uppercase border-b border-zinc-200 pb-1 text-[11px]">Calibration Object under test</h3>
                  <div>Instrument: <span className="font-semibold text-zinc-900">{selectedCertificate.sensorName}</span></div>
                  <div>Model Type: <span className="font-semibold text-zinc-900">{selectedCertificate.sensorType}</span></div>
                  <div>Manufacturer: <span className="font-semibold text-zinc-900">{selectedCertificate.manufacturer}</span></div>
                  <div>Serial Number: <span className="font-mono text-zinc-900 font-semibold">{selectedCertificate.serialNumber}</span></div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-bold text-zinc-950 uppercase border-b border-zinc-200 pb-1 text-[11px]">Traceable Reference Standard used</h3>
                  <div>Reference Device: <span className="font-semibold text-zinc-900">{selectedCertificate.deviceName}</span></div>
                  <div>Reference S/N: <span className="font-mono text-zinc-900 font-semibold">{selectedCertificate.deviceSerialNumber}</span></div>
                  <div>Procedure Followed: <span className="font-semibold text-zinc-900">{selectedCertificate.calibrationProcedure}</span></div>
                  <div>Traceable Authority: <span className="font-semibold text-zinc-900">National Metrology Institute (NMI) Traceable</span></div>
                </div>
              </div>

              {/* Ambient Parameters */}
              <div className="flex justify-between items-center bg-zinc-50 border border-zinc-200 px-5 py-3 rounded-lg text-xs relative z-10">
                <div>Ambient Laboratory Temperature: <span className="font-semibold font-mono">{selectedCertificate.ambientTemperature}°C</span></div>
                <div>Relative Humidity: <span className="font-semibold font-mono">{selectedCertificate.ambientHumidity}%</span></div>
                <div>Barometric Pressure: <span className="font-semibold font-mono">{selectedCertificate.ambientPressure} hPa</span></div>
              </div>

              {/* Measurements points table */}
              <div className="border border-zinc-300 rounded-lg overflow-hidden relative z-10">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-300">
                      <th className="p-3">Calibration Point</th>
                      <th className="p-3">Reference Standard Value</th>
                      <th className="p-3">Sensor Reading under test</th>
                      <th className="p-3">Error / Deviation</th>
                      <th className="p-3">Expanded Uncertainty (k=2)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {selectedCertificate.measurements && JSON.parse(selectedCertificate.measurements).map((pt: any, idx: number) => {
                      const budget = selectedCertificate.uncertaintyBudget ? JSON.parse(selectedCertificate.uncertaintyBudget) : null;
                      const uLimit = budget ? budget.expandedUncertainty : 'N/A';
                      const tolConfig = MET_TOLERANCES[selectedCertificate.sensorType || 'Default'] || MET_TOLERANCES['Default'];
                      
                      return (
                        <tr key={idx}>
                          <td className="p-3 font-semibold text-zinc-600">Test Point #{idx + 1}</td>
                          <td className="p-3 font-mono font-bold">{pt.refValue} {tolConfig.unit}</td>
                          <td className="p-3 font-mono">{pt.sensorValue} {tolConfig.unit}</td>
                          <td className="p-3 font-mono font-bold text-zinc-900">{pt.error > 0 ? `+${pt.error}` : pt.error} {tolConfig.unit}</td>
                          <td className="p-3 font-mono text-zinc-500">±{uLimit} {tolConfig.unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Conformity Verdict block */}
              <div className="flex justify-between items-start gap-4 text-xs bg-emerald-50/50 border border-emerald-100 p-4 rounded-lg relative z-10">
                <div className="space-y-1 max-w-xl">
                  <h4 className="font-bold text-zinc-950 uppercase text-[10px]">Decision Rule Statement of Conformity</h4>
                  <p className="text-zinc-600 text-[11px] leading-relaxed">
                    {selectedCertificate.conformityNotes || 'The instrument under test conforms fully with permissible maximum meteorological measurement tolerances.'}
                  </p>
                </div>
                
                <div className="text-center border-l border-emerald-200 pl-4 shrink-0">
                  <span className="text-[10px] font-bold text-zinc-500 block uppercase">Final Verdict</span>
                  <span className="text-md font-bold text-emerald-800 uppercase block mt-1 tracking-wider">
                    Conformity PASSED
                  </span>
                </div>
              </div>

              {/* Digital E-Signatures signature lines */}
              <div className="grid grid-cols-3 gap-8 pt-8 relative z-10">
                <div className="text-center space-y-1 border-t border-zinc-300 pt-3">
                  <div className="text-xs font-semibold text-zinc-900">{selectedCertificate.plannedCalibrator}</div>
                  <div className="text-[10px] text-zinc-500">Lead Laboratory Technician</div>
                  <div className="text-[9px] text-emerald-600 font-mono italic">Verified E-Signature</div>
                </div>

                <div className="text-center space-y-1 border-t border-zinc-300 pt-3">
                  <div className="text-xs font-semibold text-zinc-900">{selectedCertificate.reviewerName || 'Independent Officer'}</div>
                  <div className="text-[10px] text-zinc-500">Technical Reviewer Approval</div>
                  <div className="text-[9px] text-emerald-600 font-mono italic">Approved Independent Review</div>
                </div>

                <div className="text-center space-y-1 border-t border-zinc-300 pt-3">
                  <div className="text-xs font-semibold text-zinc-900">{selectedCertificate.signatoryName}</div>
                  <div className="text-[10px] text-zinc-500">{selectedCertificate.signatoryDesignation}</div>
                  <div className="text-[9px] text-emerald-600 font-mono italic">Authorized Sign-off Complete</div>
                </div>
              </div>

              {/* Tamperproof cryptographic seal block */}
              <div className="border-t border-zinc-200 pt-6 flex items-center gap-4 text-xs relative z-10">
                <Fingerprint className="h-10 w-10 text-indigo-700 shrink-0" />
                <div className="space-y-0.5">
                  <div className="font-bold text-zinc-950 uppercase tracking-widest text-[9px]">Cryptographic Integrity Verification Seal</div>
                  <div className="font-mono text-[10px] text-zinc-500 break-all bg-zinc-50 p-1.5 border border-zinc-200 rounded">
                    SHA256:{selectedCertificate.eSignatureHash}
                  </div>
                  <div className="text-[8px] text-zinc-400">
                    This digital fingerprint seals the calibration readings and environment logs. Any database tampering immediately invalidates this certificate hash block.
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Modal: Log In-Situ Field Verification Check */}
      {showInSituModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-emerald-900/10 dark:bg-emerald-950/40 px-6 py-4 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RadioTower className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Log In-Situ Field Verification Check</h2>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400">AWS Station stays online. Compare sensor output against portable reference meter.</p>
                </div>
              </div>
              <button onClick={() => setShowInSituModal(false)} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold">×</button>
            </div>

            <form onSubmit={handleSaveInSitu} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Target Weather Station *</label>
                  <select
                    required
                    value={inSituStationId}
                    onChange={(e) => {
                      setInSituStationId(e.target.value);
                      const stSensors = sensors.filter(s => String(s.stationId) === e.target.value);
                      if (stSensors.length > 0) setInSituSensorId(String(stSensors[0].sensorId));
                    }}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-emerald-500 dark:bg-zinc-950 focus:outline-none"
                  >
                    <option value="">-- Select Active Station --</option>
                    {stationsList.map(st => (
                      <option key={st.stationId} value={st.stationId}>
                        {st.stationName} ({st.wmoId || 'AWS'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Deployed AWS Sensor *</label>
                  <select
                    required
                    value={inSituSensorId}
                    onChange={(e) => setInSituSensorId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-emerald-500 dark:bg-zinc-950 focus:outline-none"
                  >
                    <option value="">-- Select Sensor --</option>
                    {sensors
                      .filter(s => !inSituStationId || String(s.stationId) === inSituStationId)
                      .map(s => (
                        <option key={s.sensorId} value={s.sensorId}>
                          [{s.sensorType}] S/N: {s.serialNumber || 'No S/N'}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Portable Traveling Standard *</label>
                  <input
                    type="text"
                    required
                    value={inSituRefDevice}
                    onChange={(e) => setInSituRefDevice(e.target.value)}
                    placeholder="e.g. Vaisala HM70 Handheld Standard"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-emerald-500 dark:bg-zinc-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Standard S/N Reference</label>
                  <input
                    type="text"
                    value={inSituRefSerial}
                    onChange={(e) => setInSituRefSerial(e.target.value)}
                    placeholder="REF-HM70-9821"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-emerald-500 dark:bg-zinc-950 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div>
                  <label className="block text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1">AWS Live Telemetry Reading *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={inSituAwsVal}
                    onChange={(e) => setInSituAwsVal(e.target.value)}
                    placeholder="e.g. 25.40"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-xs font-mono font-bold focus:border-indigo-500 dark:bg-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Reference Standard Reading *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={inSituRefVal}
                    onChange={(e) => setInSituRefVal(e.target.value)}
                    placeholder="e.g. 25.35"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-xs font-mono font-bold focus:border-emerald-500 dark:bg-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Max Permissible Tolerance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={inSituTolerance}
                    onChange={(e) => setInSituTolerance(e.target.value)}
                    placeholder="±0.20"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-xs font-mono focus:border-zinc-500 dark:bg-zinc-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Calculated Delta Preview */}
              {inSituAwsVal !== '' && inSituRefVal !== '' && (
                <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Calculated Error Delta (AWS - Reference):</span>
                    <span className="font-mono font-bold text-sm text-indigo-700 dark:text-indigo-400">
                      {(parseFloat(inSituAwsVal) - parseFloat(inSituRefVal)).toFixed(3)}
                    </span>
                  </div>
                  <div>
                    {Math.abs(parseFloat(inSituAwsVal) - parseFloat(inSituRefVal)) <= parseFloat(inSituTolerance || '0.2') ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="h-4 w-4" /> Within CIMO Tolerance
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-bold bg-rose-100 dark:bg-rose-950 px-2.5 py-1 rounded-full">
                        <AlertTriangle className="h-4 w-4" /> Exceeds Tolerance Limit
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Ambient Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={inSituAmbientTemp}
                    onChange={(e) => setInSituAmbientTemp(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:outline-none dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Ambient Humidity (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={inSituAmbientHum}
                    onChange={(e) => setInSituAmbientHum(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:outline-none dark:bg-zinc-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Field Observations / Notes</label>
                <textarea
                  rows={2}
                  value={inSituNotes}
                  onChange={(e) => setInSituNotes(e.target.value)}
                  placeholder="e.g. Visual sensor inspection normal. Zero physical biofouling or radiation shield blockage."
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-emerald-500 dark:bg-zinc-950 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInSituModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition flex items-center gap-1.5"
                >
                  <RadioTower className="h-4 w-4" /> Save Field Check Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Sensor Swap Wizard (Active Sensor <-> Pre-Calibrated Spare) */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-emerald-950/20 dark:bg-emerald-950/40 px-6 py-4 border-b border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Sensor Swap Wizard (Pre-Calibrated Spare)</h2>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400">Swap active station sensor with a pre-calibrated lab spare without missing observation windows.</p>
                </div>
              </div>
              <button onClick={() => setShowSwapModal(false)} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold">×</button>
            </div>

            <form onSubmit={handleExecuteSwap} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Target Weather Station *</label>
                <select
                  required
                  value={swapStationId}
                  onChange={(e) => {
                    setSwapStationId(e.target.value);
                    const activeSensors = sensors.filter(s => String(s.stationId) === e.target.value);
                    if (activeSensors.length > 0) setSwapOldSensorId(String(activeSensors[0].sensorId));
                  }}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-emerald-500 dark:bg-zinc-950 focus:outline-none"
                >
                  <option value="">-- Choose Weather Station --</option>
                  {stationsList.map(st => (
                    <option key={st.stationId} value={st.stationId}>
                      {st.stationName} ({st.wmoId || 'AWS'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-rose-600 dark:text-rose-400 mb-1">Active Sensor to Remove (to Lab) *</label>
                  <select
                    required
                    value={swapOldSensorId}
                    onChange={(e) => setSwapOldSensorId(e.target.value)}
                    className="w-full rounded-lg border border-rose-200 dark:border-rose-900/40 px-3 py-2 text-xs focus:border-rose-500 dark:bg-zinc-950 focus:outline-none"
                  >
                    <option value="">-- Active Deployed Sensor --</option>
                    {sensors
                      .filter(s => !swapStationId || String(s.stationId) === swapStationId)
                      .map(s => (
                        <option key={s.sensorId} value={s.sensorId}>
                          [{s.sensorType}] S/N: {s.serialNumber || 'No S/N'}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Pre-Calibrated Spare Sensor (Deploy) *</label>
                  <select
                    required
                    value={swapNewSensorId}
                    onChange={(e) => setSwapNewSensorId(e.target.value)}
                    className="w-full rounded-lg border border-emerald-200 dark:border-emerald-900/40 px-3 py-2 text-xs focus:border-emerald-500 dark:bg-zinc-950 focus:outline-none"
                  >
                    <option value="">-- Select Lab Spare --</option>
                    {sensors
                      .filter(s => s.status === 'In Stock' || s.status === 'Calibrated' || String(s.sensorId) !== swapOldSensorId)
                      .map(s => (
                        <option key={s.sensorId} value={s.sensorId}>
                          [{s.sensorType}] S/N: {s.serialNumber || 'No S/N'} ({s.status})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Spare Sensor Slope (m)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={swapSlope}
                    onChange={(e) => setSwapSlope(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs font-mono focus:outline-none dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Spare Sensor Offset (c)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={swapOffset}
                    onChange={(e) => setSwapOffset(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs font-mono focus:outline-none dark:bg-zinc-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Reason for Swap *</label>
                <select
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-emerald-500 dark:bg-zinc-950 focus:outline-none"
                >
                  <option value="Scheduled bench recalibration cycle">Scheduled bench recalibration cycle</option>
                  <option value="Field in-situ check drift threshold exceeded">Field in-situ check drift threshold exceeded</option>
                  <option value="Physical sensor damage or lightning surge">Physical sensor damage or lightning surge</option>
                  <option value="GBON mandatory compliance accuracy audit">GBON mandatory compliance accuracy audit</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSwapModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition flex items-center gap-1.5"
                >
                  <ArrowLeftRight className="h-4 w-4" /> Execute Physical Sensor Swap
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Coefficient & Transfer Function Adjustments */}
      {showCoefficientsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-sky-950/20 dark:bg-sky-950/40 px-6 py-4 border-b border-sky-200 dark:border-sky-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Adjust Transfer Function Coefficients</h2>
                  <p className="text-[10px] text-sky-700 dark:text-sky-400">Slope & offset mathematical linear / polynomial calibration adjustments.</p>
                </div>
              </div>
              <button onClick={() => setShowCoefficientsModal(false)} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold">×</button>
            </div>

            <form onSubmit={handleSaveCoefficients} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Target Physical Sensor *</label>
                <select
                  required
                  value={coefSensorId}
                  onChange={(e) => {
                    setCoefSensorId(e.target.value);
                    const s = sensors.find(item => String(item.sensorId) === e.target.value);
                    if (s && s.coefficients) {
                      setCoefSlope(String(s.coefficients.slope ?? 1.0));
                      setCoefOffset(String(s.coefficients.offset ?? 0.0));
                    }
                  }}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-sky-500 dark:bg-zinc-950 focus:outline-none"
                >
                  <option value="">-- Choose Sensor --</option>
                  {sensors.map(s => (
                    <option key={s.sensorId} value={s.sensorId}>
                      [{s.sensorType}] S/N: {s.serialNumber || 'No S/N'} - {s.manufacturer} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Transfer Model</label>
                  <select
                    value={coefModelType}
                    onChange={(e) => setCoefModelType(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-sky-500 dark:bg-zinc-950 focus:outline-none"
                  >
                    <option value="Linear">Linear: y = m·x + c</option>
                    <option value="Polynomial">2nd Order Poly: y = A + B·x + C·x²</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Slope (m / B)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={coefSlope}
                    onChange={(e) => setCoefSlope(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs font-mono font-bold focus:border-sky-500 dark:bg-zinc-950 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Offset (c / A)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={coefOffset}
                    onChange={(e) => setCoefOffset(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs font-mono font-bold focus:border-sky-500 dark:bg-zinc-950 focus:outline-none"
                  />
                </div>

                {coefModelType === 'Polynomial' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Poly C (x² term)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={coefPolyC}
                      onChange={(e) => setCoefPolyC(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs font-mono focus:outline-none dark:bg-zinc-950"
                    />
                  </div>
                )}
              </div>

              {/* Multi-point Least Squares Regression Fit Tool */}
              <div className="bg-sky-50/50 dark:bg-sky-950/10 p-3.5 rounded-lg border border-sky-100 dark:border-sky-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-sky-800 dark:text-sky-400 flex items-center gap-1">
                    <Calculator className="h-3.5 w-3.5" /> Least-Squares Regression Curve Fit Calculator
                  </span>
                  <button
                    type="button"
                    onClick={handleCalculateFit}
                    className="text-[10px] font-bold bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-1 rounded transition"
                  >
                    Calculate Slope & Offset
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Test Pt 1 (Raw / Ref)</span>
                    <div className="flex gap-1">
                      <input placeholder="Raw" value={fitPt1Raw} onChange={(e) => setFitPt1Raw(e.target.value)} className="w-1/2 p-1 border rounded text-[10px] font-mono dark:bg-zinc-950" />
                      <input placeholder="Ref" value={fitPt1Ref} onChange={(e) => setFitPt1Ref(e.target.value)} className="w-1/2 p-1 border rounded text-[10px] font-mono dark:bg-zinc-950" />
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Test Pt 2 (Raw / Ref)</span>
                    <div className="flex gap-1">
                      <input placeholder="Raw" value={fitPt2Raw} onChange={(e) => setFitPt2Raw(e.target.value)} className="w-1/2 p-1 border rounded text-[10px] font-mono dark:bg-zinc-950" />
                      <input placeholder="Ref" value={fitPt2Ref} onChange={(e) => setFitPt2Ref(e.target.value)} className="w-1/2 p-1 border rounded text-[10px] font-mono dark:bg-zinc-950" />
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Test Pt 3 (Raw / Ref)</span>
                    <div className="flex gap-1">
                      <input placeholder="Raw" value={fitPt3Raw} onChange={(e) => setFitPt3Raw(e.target.value)} className="w-1/2 p-1 border rounded text-[10px] font-mono dark:bg-zinc-950" />
                      <input placeholder="Ref" value={fitPt3Ref} onChange={(e) => setFitPt3Ref(e.target.value)} className="w-1/2 p-1 border rounded text-[10px] font-mono dark:bg-zinc-950" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Adjustment Reason / Calibration Certificate Ref</label>
                <textarea
                  rows={2}
                  value={coefNotes}
                  onChange={(e) => setCoefNotes(e.target.value)}
                  placeholder="e.g. Adjusted after standard temperature bath bench calibration cycle."
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-850 px-3 py-2 text-xs focus:border-sky-500 dark:bg-zinc-950 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCoefficientsModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition flex items-center gap-1.5"
                >
                  <Sliders className="h-4 w-4" /> Save Coefficient Adjustments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
