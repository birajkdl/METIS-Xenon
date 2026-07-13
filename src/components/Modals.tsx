import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Cpu, 
  ShieldCheck, 
  Calendar, 
  Settings, 
  Compass, 
  Wrench,
  AlertOctagon,
  Activity
} from 'lucide-react';
import { WeatherStation, Sensor } from '../types.ts';

interface ModalsProps {
  modalType: 'add-station' | 'edit-station' | 'add-sensor' | 'edit-sensor' | 'log-calibration' | null;
  onClose: () => void;
  stations: WeatherStation[];
  sensors: Sensor[];
  selectedSensorForCalibId?: number | null;
  onSubmitAddStation: (data: { stationName: string; region: string; latitude: number; longitude: number; batteryVoltageType?: string; batteryCurrentVoltage?: number; stationType?: string; regionalOfficeId?: number | null }) => Promise<void>;
  onSubmitAddSensor: (data: { sensorType: string; manufacturer: string; status: string; stationId: number | null }) => Promise<void>;
  onSubmitEditSensor: (sensorId: number, data: { sensorType: string; manufacturer: string; status: string; stationId: number | null }) => Promise<void>;
  onSubmitLogCalibration: (data: { sensorId: number; calibrationDate: string; technicianName: string; result: string; notes: string; nextDueDate: string }) => Promise<void>;
  editingSensor?: Sensor | null;
  editingStation?: WeatherStation | null;
  onSubmitEditStation?: (stationId: number, data: { stationName: string; region: string; latitude: number; longitude: number; batteryVoltageType?: string; batteryCurrentVoltage?: number; stationType?: string; regionalOfficeId?: number | null }) => Promise<void>;
}

export default function Modals({
  modalType,
  onClose,
  stations,
  sensors,
  selectedSensorForCalibId,
  onSubmitAddStation,
  onSubmitAddSensor,
  onSubmitEditSensor,
  onSubmitLogCalibration,
  editingSensor,
  editingStation,
  onSubmitEditStation
}: ModalsProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states - Station
  const [stationName, setStationName] = useState('');
  const [stationRegion, setStationRegion] = useState('');
  const [stationLat, setStationLat] = useState('');
  const [stationLon, setStationLon] = useState('');
  const [batteryVoltageType, setBatteryVoltageType] = useState('12V');
  const [batteryCurrentVoltage, setBatteryCurrentVoltage] = useState('12.0');
  const [stationType, setStationType] = useState('Climate');
  const [stationRegionalOfficeId, setStationRegionalOfficeId] = useState<string>('');
  const [regionalOffices, setRegionalOffices] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/regional-offices')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRegionalOffices(data);
        }
      })
      .catch(err => console.error("Failed to fetch regional offices in Modals.tsx:", err));
  }, []);

  // Form states - Sensor
  const [sensorType, setSensorType] = useState('Platinum Resistance Thermometer');
  const [sensorMfg, setSensorMfg] = useState('');
  const [sensorStatus, setSensorStatus] = useState('Store');
  const [sensorStationId, setSensorStationId] = useState<string>('');

  const [statuses, setStatuses] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/statuses')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setStatuses(data);
          // If not editing, set initial status to "Store" if available in fetched statuses
          if (modalType === 'add-sensor' && data.some(s => s.statusName === 'Store')) {
            setSensorStatus('Store');
          }
        }
      })
      .catch(err => console.error("Failed to fetch statuses in Modals.tsx:", err));
  }, [modalType]);

  // Form states - Calibration
  const [calSensorId, setCalSensorId] = useState<string>('');
  const [calDate, setCalDate] = useState(new Date().toISOString().split('T')[0]);
  const [calTech, setCalTech] = useState('');
  const [calResult, setCalResult] = useState('Passed');
  const [calNotes, setCalNotes] = useState('');
  const [calNextDue, setCalNextDue] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6); // Default 6 months
    return d.toISOString().split('T')[0];
  });

  // Populate form if editing
  useEffect(() => {
    if (modalType === 'edit-sensor' && editingSensor) {
      setSensorType(editingSensor.sensorType);
      setSensorMfg(editingSensor.manufacturer);
      setSensorStatus(editingSensor.status);
      setSensorStationId(editingSensor.stationId?.toString() || '');
    } else if (modalType === 'edit-station' && editingStation) {
      setStationName(editingStation.stationName);
      setStationRegion(editingStation.region);
      setStationLat(editingStation.latitude.toString());
      setStationLon(editingStation.longitude.toString());
      setBatteryVoltageType(editingStation.batteryVoltageType || '12V');
      setBatteryCurrentVoltage(editingStation.batteryCurrentVoltage !== undefined && editingStation.batteryCurrentVoltage !== null ? editingStation.batteryCurrentVoltage.toString() : '12.0');
      setStationType(editingStation.stationType || 'Climate');
      setStationRegionalOfficeId(editingStation.regionalOfficeId ? editingStation.regionalOfficeId.toString() : '');
    } else if (modalType === 'add-station') {
      setStationName('');
      setStationRegion('');
      setStationLat('');
      setStationLon('');
      setBatteryVoltageType('12V');
      setBatteryCurrentVoltage('12.0');
      setStationType('Climate');
      setStationRegionalOfficeId('');
    } else if (modalType === 'log-calibration') {
      if (selectedSensorForCalibId) {
        setCalSensorId(selectedSensorForCalibId.toString());
      } else if (sensors.length > 0) {
        setCalSensorId(sensors[0].sensorId.toString());
      }
    }
  }, [modalType, editingSensor, editingStation, selectedSensorForCalibId, sensors]);

  if (!modalType) return null;

  const handleAddStationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!stationName || !stationRegion || !stationLat || !stationLon) {
      setFormError("All station fields are required.");
      return;
    }
    const latNum = parseFloat(stationLat);
    const lonNum = parseFloat(stationLon);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setFormError("Latitude must be a valid number between -90 and 90.");
      return;
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      setFormError("Longitude must be a valid number between -180 and 180.");
      return;
    }

    setSubmitting(true);
    try {
      const parsedBatteryCurrentVoltage = parseFloat(batteryCurrentVoltage);
      if (modalType === 'add-station') {
        await onSubmitAddStation({
          stationName,
          region: stationRegion,
          latitude: latNum,
          longitude: lonNum,
          batteryVoltageType,
          batteryCurrentVoltage: isNaN(parsedBatteryCurrentVoltage) ? undefined : parsedBatteryCurrentVoltage,
          stationType,
          regionalOfficeId: stationRegionalOfficeId ? parseInt(stationRegionalOfficeId) : null,
        });
      } else if (modalType === 'edit-station' && editingStation && onSubmitEditStation) {
        await onSubmitEditStation(editingStation.stationId, {
          stationName,
          region: stationRegion,
          latitude: latNum,
          longitude: lonNum,
          batteryVoltageType,
          batteryCurrentVoltage: isNaN(parsedBatteryCurrentVoltage) ? undefined : parsedBatteryCurrentVoltage,
          stationType,
          regionalOfficeId: stationRegionalOfficeId ? parseInt(stationRegionalOfficeId) : null,
        });
      }
      // reset
      setStationName('');
      setStationRegion('');
      setStationLat('');
      setStationLon('');
      setBatteryVoltageType('12V');
      setBatteryCurrentVoltage('12.0');
      setStationType('Climate');
      onClose();
    } catch (err: any) {
      setFormError(err.message || "Failed to process station.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSensorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!sensorType || !sensorMfg) {
      setFormError("Sensor Type and Manufacturer are required.");
      return;
    }

    setSubmitting(true);
    try {
      const stationIdVal = sensorStationId === '' ? null : parseInt(sensorStationId);
      if (modalType === 'add-sensor') {
        await onSubmitAddSensor({
          sensorType,
          manufacturer: sensorMfg,
          status: sensorStatus,
          stationId: stationIdVal
        });
        setSensorMfg('');
        setSensorStationId('');
      } else if (modalType === 'edit-sensor' && editingSensor) {
        await onSubmitEditSensor(editingSensor.sensorId, {
          sensorType,
          manufacturer: sensorMfg,
          status: sensorStatus,
          stationId: stationIdVal
        });
      }
      onClose();
    } catch (err: any) {
      setFormError(err.message || "Failed to catalog sensor.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCalibrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!calSensorId || !calDate || !calTech || !calResult || !calNextDue) {
      setFormError("All calibration log fields are required.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitLogCalibration({
        sensorId: parseInt(calSensorId),
        calibrationDate: calDate,
        technicianName: calTech,
        result: calResult,
        notes: calNotes,
        nextDueDate: calNextDue
      });
      // reset
      setCalTech('');
      setCalNotes('');
      onClose();
    } catch (err: any) {
      setFormError(err.message || "Failed to record calibration.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md w-full max-w-lg shadow-2xl relative overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-[#1f1f23] flex items-center justify-between bg-[#131316]">
          <div className="flex items-center space-x-3.5">
            <div className="p-2 bg-[#070708] border border-[#1f1f23] text-zinc-300 rounded-sm">
              {(modalType === 'add-station' || modalType === 'edit-station') && <MapPin className="h-5 w-5" />}
              {modalType === 'add-sensor' && <Cpu className="h-5 w-5" />}
              {modalType === 'edit-sensor' && <Settings className="h-5 w-5" />}
              {modalType === 'log-calibration' && <Wrench className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-serif italic text-white text-lg leading-tight">
                {modalType === 'add-station' && 'Add Weather Station'}
                {modalType === 'edit-station' && 'Edit Weather Station'}
                {modalType === 'add-sensor' && 'Catalog New Sensor'}
                {modalType === 'edit-sensor' && 'Edit Sensor Asset'}
                {modalType === 'log-calibration' && 'Log Calibration Event'}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {modalType === 'add-station' && 'Provision a new meteorological coordinates terminal.'}
                {modalType === 'edit-station' && 'Customize meteorological coordinates and office details.'}
                {modalType === 'add-sensor' && 'Log and link a new physical diagnostic instrument.'}
                {modalType === 'edit-sensor' && 'Modify telemetry hardware assignment.'}
                {modalType === 'log-calibration' && 'Record technician drift diagnostics.'}
              </p>
            </div>
          </div>
          
          <button 
            id="modal-close-btn"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-sm transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Container */}
        <div className="p-6">
          {formError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-xs text-red-400 flex items-start gap-2">
              <AlertOctagon className="h-4 w-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* ADD / EDIT STATION FORM */}
          {(modalType === 'add-station' || modalType === 'edit-station') && (
            <form onSubmit={handleAddStationSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Station Name</label>
                <input
                  id="modal-station-name"
                  type="text"
                  placeholder="e.g. Mount Wellington Observatory"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white placeholder-zinc-600 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Region / Office Name</label>
                <input
                  id="modal-station-region"
                  type="text"
                  placeholder="e.g. Tasmania, Australia"
                  value={stationRegion}
                  onChange={(e) => setStationRegion(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white placeholder-zinc-600 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Latitude</label>
                  <input
                    id="modal-station-lat"
                    type="number"
                    step="any"
                    placeholder="e.g. -42.895"
                    value={stationLat}
                    onChange={(e) => setStationLat(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white placeholder-zinc-600 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Longitude</label>
                  <input
                    id="modal-station-lon"
                    type="number"
                    step="any"
                    placeholder="e.g. 147.234"
                    value={stationLon}
                    onChange={(e) => setStationLon(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white placeholder-zinc-600 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Station Type</label>
                <select
                  id="modal-station-type"
                  value={stationType}
                  onChange={(e) => setStationType(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition"
                >
                  <option value="Climate">Climate</option>
                  <option value="Synoptic">Synoptic</option>
                  <option value="Aero-synoptic">Aero-synoptic</option>
                  <option value="Agromet">Agromet</option>
                  <option value="precipitation">precipitation</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Assigned Regional Office</label>
                <select
                  id="modal-station-regional-office"
                  value={stationRegionalOfficeId}
                  onChange={(e) => setStationRegionalOfficeId(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition"
                >
                  <option value="">-- No Assigned Regional Office --</option>
                  {regionalOffices.map((ro) => (
                    <option key={ro.id} value={ro.id}>
                      {ro.officeName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Battery Nominal Voltage</label>
                  <select
                    id="modal-station-battery-voltage-type"
                    value={batteryVoltageType}
                    onChange={(e) => setBatteryVoltageType(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition"
                  >
                    <option value="12V">12V Battery</option>
                    <option value="4V">4V Battery</option>
                    <option value="6V">6V Battery</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Current Battery Voltage (V)</label>
                  <input
                    id="modal-station-battery-current-voltage"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 12.1"
                    value={batteryCurrentVoltage}
                    onChange={(e) => setBatteryCurrentVoltage(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white placeholder-zinc-600 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1f1f23] mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="modal-submit-station-btn"
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold transition flex items-center justify-center min-w-[100px] cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : modalType === 'add-station' ? 'Add Terminal' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* ADD / EDIT SENSOR FORM */}
          {(modalType === 'add-sensor' || modalType === 'edit-sensor') && (
            <form onSubmit={handleSensorSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Sensor Device Type</label>
                <select
                  id="modal-sensor-type"
                  value={sensorType}
                  onChange={(e) => setSensorType(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-zinc-300 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none cursor-pointer"
                >
                  <option value="Platinum Resistance Thermometer">Platinum Resistance Thermometer (Temp)</option>
                  <option value="Sonic Anemometer">Sonic Anemometer (Wind Speed/Dir)</option>
                  <option value="Precision Barometer">Precision Barometer (Pressure)</option>
                  <option value="Relative Humidity Probe">Relative Humidity Probe (Moisture)</option>
                  <option value="Pyranometer (Solar)">Pyranometer (Solar Radiation)</option>
                  <option value="Tipping Bucket Rain Gauge">Tipping Bucket Rain Gauge (Precipitation)</option>
                  <option value="Acoustic Current Profiler">Acoustic Current Profiler (Acoustic)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Manufacturer</label>
                <input
                  id="modal-sensor-mfg"
                  type="text"
                  placeholder="e.g. Vaisala, Campbell Scientific"
                  value={sensorMfg}
                  onChange={(e) => setSensorMfg(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white placeholder-zinc-600 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Operational Status</label>
                  <select
                    id="modal-sensor-status"
                    value={sensorStatus}
                    onChange={(e) => setSensorStatus(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-zinc-300 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none cursor-pointer"
                  >
                    {statuses.map(st => (
                      <option key={st.id} value={st.statusName}>
                        {st.statusName} {st.isConsumableOnly === 'true' ? '(Consumable)' : ''}
                      </option>
                    ))}
                    {statuses.length === 0 && (
                      <>
                        <option value="Store">Store</option>
                        <option value="Deployed">Deployed</option>
                        <option value="Under Calibration">Under Calibration</option>
                        <option value="Under Repair">Under Repair</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Station Assignment</label>
                  <select
                    id="modal-sensor-station"
                    value={sensorStationId}
                    onChange={(e) => setSensorStationId(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-zinc-300 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Unassigned --</option>
                    {stations.map(st => (
                      <option key={st.stationId} value={st.stationId}>{st.stationName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1f1f23] mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="modal-submit-sensor-btn"
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold transition flex items-center justify-center min-w-[100px] cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : modalType === 'add-sensor' ? 'Catalog Device' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* LOG CALIBRATION FORM */}
          {modalType === 'log-calibration' && (
            <form onSubmit={handleCalibrationSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Target Sensor Asset</label>
                <select
                  id="modal-calib-sensor"
                  value={calSensorId}
                  disabled={!!selectedSensorForCalibId}
                  onChange={(e) => setCalSensorId(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-zinc-300 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none disabled:opacity-50 cursor-pointer"
                >
                  {sensors.map(sen => (
                    <option key={sen.sensorId} value={sen.sensorId}>
                      SEN-{sen.sensorId.toString().padStart(4, '0')} : {sen.sensorType} ({sen.manufacturer})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Calibration Technician</label>
                <input
                  id="modal-calib-tech"
                  type="text"
                  placeholder="e.g. Dr. Arthur Pendelton"
                  value={calTech}
                  onChange={(e) => setCalTech(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white placeholder-zinc-600 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Calibration Result</label>
                  <select
                    id="modal-calib-result"
                    value={calResult}
                    onChange={(e) => setCalResult(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-zinc-300 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="Passed">Passed</option>
                    <option value="Adjusted">Adjusted (Hardware Recalibrated)</option>
                    <option value="Failed">Failed (Requires Maintenance)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Calibration Date</label>
                  <input
                    id="modal-calib-date"
                    type="date"
                    value={calDate}
                    onChange={(e) => setCalDate(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-zinc-300 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Next Calibration Due Date</label>
                <input
                  id="modal-calib-next-due"
                  type="date"
                  value={calNextDue}
                  onChange={(e) => setCalNextDue(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-zinc-300 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none transition cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Diagnostic Field Notes</label>
                <textarea
                  id="modal-calib-notes"
                  placeholder="Record precision checks, chamber tests, reference constants or drift adjustments..."
                  value={calNotes}
                  onChange={(e) => setCalNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white placeholder-zinc-600 focus:border-blue-500/50 rounded-md py-2 px-3 text-sm focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1f1f23] mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="modal-submit-calib-btn"
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold transition flex items-center justify-center min-w-[100px] cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Log Audit'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
