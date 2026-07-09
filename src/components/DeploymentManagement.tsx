import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Plus, 
  Calendar, 
  User, 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Info, 
  Trash2, 
  ArrowRightLeft, 
  Clock, 
  Database, 
  Wrench, 
  History, 
  FileCheck2, 
  FolderHeart,
  Boxes,
  Truck,
  CheckSquare
} from 'lucide-react';
import { Sensor, WeatherStation, SensorDeployment, SensorReplacement, CustomStatus, SensorTransfer } from '../types.ts';

interface DeploymentManagementProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  isAuthenticated: boolean;
  onRefresh: () => void;
  token: string | null;
}

export default function DeploymentManagement({
  sensors,
  stations,
  isAuthenticated,
  onRefresh,
  token
}: DeploymentManagementProps) {
  // Tabs: 'deployments' | 'replacements' | 'transfers' | 'traceability'
  const [activeTab, setActiveTab] = useState<'deployments' | 'replacements' | 'transfers' | 'traceability'>('deployments');
  
  const [deployments, setDeployments] = useState<SensorDeployment[]>([]);
  const [replacements, setReplacements] = useState<SensorReplacement[]>([]);
  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [transfers, setTransfers] = useState<SensorTransfer[]>([]);
  
  // Transfer Form State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSensorId, setTransferSensorId] = useState('');
  const [transferType, setTransferType] = useState<'Office to Office' | 'Office to Station deployment' | 'Station to Office return' | 'Regional to Head Office transfer'>('Office to Office');
  const [transferDuration, setTransferDuration] = useState<'Permanent' | 'Temporary'>('Permanent');
  const [transferSender, setTransferSender] = useState('');
  const [transferReceiver, setTransferReceiver] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferPersonnel, setTransferPersonnel] = useState('');
  const [transferCondition, setTransferCondition] = useState('');
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferApprovalStatus, setTransferApprovalStatus] = useState<'Pending' | 'Approved'>('Pending');
  
  // Loading & Messages
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Traceability State
  const [selectedTraceSensorId, setSelectedTraceSensorId] = useState<string>('');
  const [sensorHistory, setSensorHistory] = useState<any[]>([]);

  // Deployment Form State
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [deploySensorId, setDeploySensorId] = useState('');
  const [deployStationId, setDeployStationId] = useState('');
  const [deployDate, setDeployDate] = useState(new Date().toISOString().split('T')[0]);
  const [deployPersonnel, setDeployPersonnel] = useState('');
  const [deployNotes, setDeployNotes] = useState('');

  // Retrieval Form State
  const [isRetrieveModalOpen, setIsRetrieveModalOpen] = useState(false);
  const [retrievingDeployment, setRetrievingDeployment] = useState<SensorDeployment | null>(null);
  const [retrieveDate, setRetrieveDate] = useState(new Date().toISOString().split('T')[0]);
  const [retrieveNextStatus, setRetrieveNextStatus] = useState('Store');
  const [retrieveRemarks, setRetrieveRemarks] = useState('');

  // Replacement Form State
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [replaceStationId, setReplaceStationId] = useState('');
  const [replaceOldSensorId, setReplaceOldSensorId] = useState('');
  const [replaceNewSensorId, setReplaceNewSensorId] = useState('');
  const [replaceDate, setReplaceDate] = useState(new Date().toISOString().split('T')[0]);
  const [replaceReason, setReplaceReason] = useState('');
  const [replacePersonnel, setReplacePersonnel] = useState('');
  const [replaceNotes, setReplaceNotes] = useState('');
  const [replaceOldNextStatus, setReplaceOldNextStatus] = useState('Under Repair');

  // Load Deployments, Replacements, and Custom Statuses
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [depRes, repRes, statRes, transRes] = await Promise.all([
        fetch('/api/deployments'),
        fetch('/api/replacements'),
        fetch('/api/statuses'),
        fetch('/api/transfers')
      ]);

      if (depRes.ok) setDeployments(await depRes.json());
      if (repRes.ok) setReplacements(await repRes.json());
      if (statRes.ok) setStatuses(await statRes.json());
      if (transRes.ok) setTransfers(await transRes.json());
    } catch (err) {
      console.error("Error loading deployment management data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sensors, stations]);

  // Fetch full chronological lifecycle for a specific sensor
  useEffect(() => {
    if (!selectedTraceSensorId) {
      setSensorHistory([]);
      return;
    }

    const sensorId = parseInt(selectedTraceSensorId);
    const sensor = sensors.find(s => s.sensorId === sensorId);
    if (!sensor) return;

    const events: any[] = [];

    // 1. Procurement Event
    if (sensor.procurementDate) {
      events.push({
        type: 'procurement',
        date: sensor.procurementDate,
        title: 'Procurement / Initial Register',
        desc: `Acquired from ${sensor.manufacturer}. Serial: ${sensor.serialNumber || 'N/A'}. Supplier: ${sensor.supplierDetails || 'N/A'}. Invoice ref: ${sensor.invoiceReference || 'N/A'}.`,
        badgeColor: 'border-zinc-500 text-zinc-400 bg-zinc-950/20'
      });
    }

    // 2. Deployments Events (both active and past)
    const sensorDeps = deployments.filter(d => d.sensorId === sensorId);
    sensorDeps.forEach(d => {
      events.push({
        type: 'deployment_start',
        date: d.deploymentDate,
        title: `Deployed on ${d.stationName}`,
        desc: `Installed at weather station. Region: ${d.region}. Personnel: ${d.personnelInvolved}. Installation notes: ${d.installationNotes || 'None'}.`,
        badgeColor: 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
      });

      if (d.retrievalDate) {
        events.push({
          type: 'deployment_retrieval',
          date: d.retrievalDate,
          title: `Retrieved from ${d.stationName}`,
          desc: `Sensor physically uninstalled and checked out. Status closed.`,
          badgeColor: 'border-amber-500 text-amber-400 bg-amber-950/20'
        });
      }
    });

    // 3. Replacements Events (as OLD removed or NEW installed)
    const oldReps = replacements.filter(r => r.oldSensorId === sensorId);
    oldReps.forEach(r => {
      events.push({
        type: 'replacement_removed',
        date: r.replacementDate,
        title: `Replaced & Decommissioned at ${r.stationName}`,
        desc: `Removed due to: "${r.reason}". Replaced by Sensor ID SEN-${r.newSensorId.toString().padStart(4, '0')} (${r.newSensorName}). Personnel: ${r.personnelInvolved}. notes: ${r.notes || 'None'}.`,
        badgeColor: 'border-red-500 text-red-400 bg-red-950/20'
      });
    });

    const newReps = replacements.filter(r => r.newSensorId === sensorId);
    newReps.forEach(r => {
      events.push({
        type: 'replacement_installed',
        date: r.replacementDate,
        title: `Installed as Replacement at ${r.stationName}`,
        desc: `Installed in place of malfunctioning Sensor ID SEN-${r.oldSensorId.toString().padStart(4, '0')} (${r.oldSensorName}). Reason: "${r.reason}". Personnel: ${r.personnelInvolved}.`,
        badgeColor: 'border-blue-500 text-blue-400 bg-blue-950/20'
      });
    });

    // 4. Calibration Events (if any)
    const sensorCals = sensor.statusLog ? [] : []; // We can fetch calibrations too if needed, let's query calibrations directly from state or window if needed, but wait, the sensor object itself already has calibrations relations loaded or we can check. Let's inspect the calibrations log in sensor statusLog.
    
    // Status Logs parsing (helps capture calibration transitions and manual adjustments)
    if (sensor.statusLog) {
      const lines = sensor.statusLog.split('\n');
      lines.forEach(line => {
        const match = line.match(/^\[([\d\s:-]+)\]\s*(.*)$/);
        if (match) {
          const rawDate = match[1].substring(0, 10);
          const detail = match[2];
          
          // Avoid duplicate deployment/replacement logs if we already got them above
          if (!detail.toLowerCase().includes('deployed to station') && !detail.toLowerCase().includes('replaced at station') && !detail.toLowerCase().includes('retrieved from station')) {
            events.push({
              type: 'log_event',
              date: rawDate,
              title: 'Lifecycle Log Entry',
              desc: detail,
              badgeColor: 'border-purple-500 text-purple-400 bg-purple-950/20'
            });
          }
        }
      });
    }

    // 5. Transfer Events
    const sensorTransfersFiltered = transfers.filter(t => t.sensorId === sensorId);
    sensorTransfersFiltered.forEach(t => {
      let badgeCol = 'border-blue-500 text-blue-400 bg-blue-950/20';
      if (t.approvalStatus === 'Approved') badgeCol = 'border-indigo-500 text-indigo-400 bg-indigo-950/20';
      if (t.approvalStatus === 'Rejected') badgeCol = 'border-red-500 text-red-400 bg-red-950/20';

      events.push({
        type: 'transfer',
        date: t.transferDate,
        title: `Transfer Log: ${t.transferType} (${t.durationType})`,
        desc: `Sender: ${t.sender} ➔ Receiver: ${t.receiver}. Personnel: ${t.personnelInvolved}. Condition: ${t.conditionDuringTransfer}. Status: ${t.approvalStatus}. Remarks: ${t.transferRemarks || 'None'}`,
        badgeColor: badgeCol
      });
    });

    // Sort events chronologically (latest first or oldest first? Traceability flows beautifully oldest to newest, let's sort oldest to newest)
    events.sort((a, b) => a.date.localeCompare(b.date));
    setSensorHistory(events);

  }, [selectedTraceSensorId, deployments, replacements, sensors, transfers]);

  // Handle Deploy Submission
  const handleDeploySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !token) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/deployments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sensorId: parseInt(deploySensorId),
          stationId: parseInt(deployStationId),
          deploymentDate: deployDate,
          personnelInvolved: deployPersonnel.trim(),
          installationNotes: deployNotes.trim()
        })
      });

      if (res.ok) {
        setSuccessMsg("Sensor deployed successfully!");
        setDeploySensorId('');
        setDeployStationId('');
        setDeployPersonnel('');
        setDeployNotes('');
        setIsDeployModalOpen(false);
        loadData();
        onRefresh();
        setTimeout(() => setSuccessMsg(null), 2000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to register deployment.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred.");
    }
  };

  // Handle Retrieval Submission
  const handleRetrieveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retrievingDeployment || !isAuthenticated || !token) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/deployments/${retrievingDeployment.deploymentId}/retrieve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          retrievalDate: retrieveDate,
          nextStatus: retrieveNextStatus,
          remarks: retrieveRemarks.trim()
        })
      });

      if (res.ok) {
        setSuccessMsg("Sensor retrieval completed!");
        setRetrievingDeployment(null);
        setRetrieveRemarks('');
        setIsRetrieveModalOpen(false);
        loadData();
        onRefresh();
        setTimeout(() => setSuccessMsg(null), 2000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to finalize retrieval.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred.");
    }
  };

  // Handle Replacement Submission
  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !token) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/replacements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          stationId: parseInt(replaceStationId),
          oldSensorId: parseInt(replaceOldSensorId),
          newSensorId: parseInt(replaceNewSensorId),
          replacementDate: replaceDate,
          reason: replaceReason.trim(),
          personnelInvolved: replacePersonnel.trim(),
          notes: replaceNotes.trim(),
          oldSensorNextStatus: replaceOldNextStatus
        })
      });

      if (res.ok) {
        setSuccessMsg("Sensor replacement executed and tracked successfully!");
        setReplaceStationId('');
        setReplaceOldSensorId('');
        setReplaceNewSensorId('');
        setReplaceReason('');
        setReplacePersonnel('');
        setReplaceNotes('');
        setIsReplaceModalOpen(false);
        loadData();
        onRefresh();
        setTimeout(() => setSuccessMsg(null), 2000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to register replacement.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred.");
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !token) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sensorId: parseInt(transferSensorId),
          transferType,
          durationType: transferDuration,
          sender: transferSender.trim(),
          receiver: transferReceiver.trim(),
          transferDate,
          personnelInvolved: transferPersonnel.trim(),
          conditionDuringTransfer: transferCondition.trim(),
          transferRemarks: transferRemarks.trim() || null,
          approvalStatus: transferApprovalStatus
        })
      });

      if (res.ok) {
        setSuccessMsg("Transfer request logged successfully!");
        setTransferSensorId('');
        setTransferSender('');
        setTransferReceiver('');
        setTransferPersonnel('');
        setTransferCondition('');
        setTransferRemarks('');
        setIsTransferModalOpen(false);
        loadData();
        onRefresh();
        setTimeout(() => setSuccessMsg(null), 2000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to log transfer request.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred.");
    }
  };

  const handleUpdateTransferStatus = async (transferId: number, status: 'Approved' | 'Rejected') => {
    if (!isAuthenticated || !token) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const notes = prompt(`Enter optional review notes for setting status to ${status}:`) || "";

    try {
      const res = await fetch(`/api/transfers/${transferId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          approvalStatus: status,
          notes: notes.trim()
        })
      });

      if (res.ok) {
        setSuccessMsg(`Transfer request successfully ${status}!`);
        loadData();
        onRefresh();
        setTimeout(() => setSuccessMsg(null), 2000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to update transfer status.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred.");
    }
  };

  // Filter lists of sensors
  const availableSensors = sensors.filter(s => s.status !== 'Deployed');
  
  // Find sensors deployed at a selected station
  const activeStationDeployments = deployments.filter(d => d.stationId === parseInt(replaceStationId) && d.status === 'Active');

  return (
    <div className="flex-1 overflow-y-auto p-10 max-w-7xl mx-auto w-full bg-[#050505] text-[#e4e4e7]">
      
      {/* Module Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-[#1f1f23]">
        <div>
          <div className="flex items-center space-x-2.5">
            <History className="h-6 w-6 text-indigo-500" />
            <h2 className="font-serif italic text-2xl md:text-3xl tracking-wide text-white">
              Instrument Deployment & Traceability
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Complete lifecycle audit logs, active weather station allocations, and hot-swap sensor replacement registries.
          </p>
        </div>

        {/* Global Action Group */}
        <div className="flex flex-wrap gap-2">
          <button
            id="open-deploy-btn"
            onClick={() => {
              setIsDeployModalOpen(true);
              setErrorMsg(null);
            }}
            className="flex items-center space-x-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Deploy Sensor</span>
          </button>

          <button
            id="open-replace-btn"
            onClick={() => {
              setIsReplaceModalOpen(true);
              setErrorMsg(null);
            }}
            className="flex items-center space-x-2 px-3.5 py-2 bg-[#0f0f12] hover:bg-white/5 text-zinc-300 border border-[#1f1f23] rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
          >
            <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
            <span>Swap/Replace Sensor</span>
          </button>

          <button
            id="open-transfer-btn"
            onClick={() => {
              setIsTransferModalOpen(true);
              setErrorMsg(null);
            }}
            className="flex items-center space-x-2 px-3.5 py-2 bg-[#0f0f12] hover:bg-white/5 text-zinc-300 border border-[#1f1f23] rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
          >
            <Truck className="h-4 w-4 text-amber-400" />
            <span>Transfer Instrument</span>
          </button>
        </div>
      </div>

      {/* Global Toast Alert */}
      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-xs rounded-md flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-950/20 border border-red-900/30 text-red-400 text-xs rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="flex items-center space-x-1 border-b border-[#1f1f23] mb-8">
        <button
          id="tab-deployments"
          onClick={() => setActiveTab('deployments')}
          className={`px-5 py-3 text-xs tracking-wider uppercase font-mono font-bold transition-all relative ${
            activeTab === 'deployments' ? 'text-white border-b border-indigo-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Deployments Registry
        </button>
        <button
          id="tab-replacements"
          onClick={() => setActiveTab('replacements')}
          className={`px-5 py-3 text-xs tracking-wider uppercase font-mono font-bold transition-all relative ${
            activeTab === 'replacements' ? 'text-white border-b border-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Replacements Log
        </button>
        <button
          id="tab-transfers"
          onClick={() => setActiveTab('transfers')}
          className={`px-5 py-3 text-xs tracking-wider uppercase font-mono font-bold transition-all relative ${
            activeTab === 'transfers' ? 'text-white border-b border-amber-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Transfer & Relocation
        </button>
        <button
          id="tab-traceability"
          onClick={() => setActiveTab('traceability')}
          className={`px-5 py-3 text-xs tracking-wider uppercase font-mono font-bold transition-all relative ${
            activeTab === 'traceability' ? 'text-white border-b border-blue-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Traceability Inspector
        </button>
      </div>

      {activeTab === 'deployments' && (
        /* DEPLOYMENTS REGISTRY TAB */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-mono">
              Active & Past Deployments List ({deployments.length})
            </h3>
          </div>

          {deployments.length === 0 ? (
            <div className="p-16 bg-[#0f0f12] border border-[#1f1f23] rounded-md text-center text-zinc-500">
              <Boxes className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="font-serif italic text-sm text-white">No deployment records logged yet.</p>
              <p className="text-xs text-zinc-500 mt-1">Deploy sensors to weather stations using the Deploy Sensor control panel.</p>
            </div>
          ) : (
            <div className="border border-[#1f1f23] rounded-md overflow-hidden bg-[#0f0f12]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#050505] border-b border-[#1f1f23] text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
                      <th className="p-4">Sensor</th>
                      <th className="p-4">Station</th>
                      <th className="p-4">Deployment Date</th>
                      <th className="p-4">Retrieval Date</th>
                      <th className="p-4">Personnel Involved</th>
                      <th className="p-4">Logistics Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f1f23] text-xs">
                    {deployments.map(dep => (
                      <tr key={dep.deploymentId} className="hover:bg-white/[0.01] transition-colors">
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono text-zinc-500 font-bold block">SEN-{dep.sensorId.toString().padStart(4, '0')}</span>
                            <span className="font-semibold text-white truncate max-w-[180px] block">{dep.sensorName}</span>
                            <span className="text-[10px] text-zinc-400 font-mono block">S/N: {dep.serialNumber}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-zinc-200">{dep.stationName}</span>
                            <span className="text-[10px] text-zinc-500 font-mono block">{dep.region}</span>
                          </div>
                        </td>
                        <td className="p-4 text-zinc-300 font-mono">{dep.deploymentDate}</td>
                        <td className="p-4 text-zinc-400 font-mono">
                          {dep.retrievalDate ? (
                            <span className="text-zinc-500">{dep.retrievalDate}</span>
                          ) : (
                            <span className="text-emerald-500 font-sans italic text-[11px] font-semibold">Active Deployment</span>
                          )}
                        </td>
                        <td className="p-4 font-sans text-zinc-300">{dep.personnelInvolved}</td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-sm text-[10px] font-mono font-semibold border ${
                            dep.status === 'Active' 
                              ? 'border-emerald-900/50 bg-emerald-950/20 text-emerald-400' 
                              : 'border-zinc-800 bg-[#050505] text-zinc-500'
                          }`}>
                            {dep.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {dep.status === 'Active' && (
                            <button
                              id={`retrieve-btn-${dep.deploymentId}`}
                              onClick={() => {
                                setRetrievingDeployment(dep);
                                setErrorMsg(null);
                                setIsRetrieveModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-900/40 text-amber-500 rounded-sm text-[11px] font-bold transition cursor-pointer"
                            >
                              Retrieve Sensor
                            </button>
                          )}
                          {dep.status === 'Retrieved' && (
                            <span className="text-zinc-600 font-mono text-[10px]">Closed Log</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'replacements' && (
        /* REPLACEMENTS LOG TAB */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-mono">
              Sensor Maintenance Replacement History ({replacements.length})
            </h3>
          </div>

          {replacements.length === 0 ? (
            <div className="p-16 bg-[#0f0f12] border border-[#1f1f23] rounded-md text-center text-zinc-500">
              <RefreshCw className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="font-serif italic text-sm text-white">No replacement logs recorded yet.</p>
              <p className="text-xs text-zinc-500 mt-1">Malfunctioning on-site sensors can be swapped for pre-calibrated spares.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {replacements.map(rep => (
                <div 
                  key={rep.replacementId} 
                  className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-5 flex flex-col justify-between hover:border-[#2f2f35] transition-colors"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#1f1f23]">
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 font-bold block">REPLACEMENT LOG #{rep.replacementId}</span>
                        <h4 className="text-sm font-bold text-white mt-0.5">{rep.stationName}</h4>
                      </div>
                      <span className="text-xs text-zinc-400 font-mono">{rep.replacementDate}</span>
                    </div>

                    {/* Sensor swap schema */}
                    <div className="flex items-center justify-between gap-2 p-3 bg-[#050505] border border-[#1f1f23] rounded-md">
                      {/* Old sensor */}
                      <div className="w-5/12 min-w-0">
                        <span className="text-[9px] font-mono text-red-400 font-semibold block uppercase">Removed Old Sensor</span>
                        <p className="text-xs font-semibold text-white truncate mt-0.5" title={rep.oldSensorName}>{rep.oldSensorName}</p>
                        <span className="text-[9px] text-zinc-500 font-mono block">S/N: {rep.oldSerialNumber}</span>
                      </div>

                      {/* Arrow */}
                      <div className="w-2/12 flex justify-center shrink-0">
                        <ArrowRightLeft className="h-4 w-4 text-zinc-600" />
                      </div>

                      {/* New sensor */}
                      <div className="w-5/12 min-w-0">
                        <span className="text-[9px] font-mono text-emerald-400 font-semibold block uppercase">Installed New Sensor</span>
                        <p className="text-xs font-semibold text-white truncate mt-0.5" title={rep.newSensorName}>{rep.newSensorName}</p>
                        <span className="text-[9px] text-zinc-500 font-mono block">S/N: {rep.newSerialNumber}</span>
                      </div>
                    </div>

                    {/* Info items */}
                    <div className="space-y-2 text-[11px] font-mono text-zinc-400">
                      <div>
                        <span className="text-[9px] text-zinc-500 uppercase block">Reason for Replacement</span>
                        <p className="text-zinc-200 mt-0.5 italic">"{rep.reason}"</p>
                      </div>
                      {rep.notes && (
                        <div>
                          <span className="text-[9px] text-zinc-500 uppercase block">Field Engineer Notes</span>
                          <p className="text-zinc-300 mt-0.5 leading-relaxed font-sans">{rep.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-5 pt-3.5 border-t border-[#1f1f23] flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {rep.personnelInvolved}
                    </span>
                    <span className="text-[9px] uppercase px-2 py-0.5 bg-[#050505] text-zinc-400 rounded-sm">
                      Audit Compliant
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'transfers' && (
        /* TRANSFERS & RELOCATION TAB */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-mono">
                Logistics & Transfer Ledger ({transfers.length})
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Detailed record of equipment transfers, office relocations, depot returns, and regional station distributions.
              </p>
            </div>

            {/* Quick Action inside the tab */}
            {isAuthenticated && (
              <button
                onClick={() => {
                  setIsTransferModalOpen(true);
                  setErrorMsg(null);
                }}
                className="flex items-center space-x-2 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-xs font-semibold tracking-wide transition cursor-pointer font-sans"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Transfer Request</span>
              </button>
            )}
          </div>

          {transfers.length === 0 ? (
            <div className="p-16 bg-[#0f0f12] border border-[#1f1f23] rounded-md text-center text-zinc-500">
              <Truck className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="font-serif italic text-sm text-white">No transfer logs recorded yet.</p>
              <p className="text-xs text-zinc-500 mt-1">Submit equipment transfer tickets to log office returns, relocations, or regional distribution.</p>
            </div>
          ) : (
            <div className="border border-[#1f1f23] rounded-md overflow-hidden bg-[#0f0f12]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#050505] border-b border-[#1f1f23] text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
                      <th className="p-4">Sensor Info</th>
                      <th className="p-4">Transfer Type & duration</th>
                      <th className="p-4">Sender / Receiver</th>
                      <th className="p-4">Transfer Date</th>
                      <th className="p-4">Personnel & Condition</th>
                      <th className="p-4">Approval Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f1f23] text-xs">
                    {transfers.map(tr => (
                      <tr key={tr.transferId} className="hover:bg-white/[0.01] transition-colors">
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono text-zinc-500 block">SEN-{tr.sensorId.toString().padStart(4, '0')}</span>
                            <span className="font-semibold text-white truncate max-w-[180px] block">{tr.sensorName}</span>
                            <span className="text-[10px] text-zinc-400 font-mono block">S/N: {tr.serialNumber}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-zinc-200 block">{tr.transferType}</span>
                            <span className={`inline-block text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${
                              tr.durationType === 'Permanent' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/40' : 'bg-amber-950/40 text-amber-400 border border-amber-900/40'
                            }`}>
                              {tr.durationType}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1 text-zinc-300">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-zinc-500 uppercase w-8 font-mono">From:</span>
                              <span className="font-medium text-white">{tr.sender}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-zinc-500 uppercase w-8 font-mono">To:</span>
                              <span className="font-medium text-emerald-400">{tr.receiver}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-zinc-300">
                          {tr.transferDate}
                        </td>
                        <td className="p-4">
                          <div className="space-y-1 text-zinc-300">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-zinc-500" />
                              <span>{tr.personnelInvolved}</span>
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              <span className="text-zinc-500 font-semibold font-mono">Condition: </span>
                              {tr.conditionDuringTransfer}
                            </div>
                            {tr.transferRemarks && (
                              <div className="text-[10px] text-zinc-500 italic mt-0.5 max-w-[200px] truncate" title={tr.transferRemarks}>
                                "{tr.transferRemarks}"
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase border ${
                            tr.approvalStatus === 'Approved'
                              ? 'border-emerald-900/50 bg-emerald-950/20 text-emerald-400'
                              : tr.approvalStatus === 'Rejected'
                              ? 'border-red-900/50 bg-red-950/20 text-red-400'
                              : 'border-amber-900/50 bg-amber-950/20 text-amber-400'
                          }`}>
                            {tr.approvalStatus}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {tr.approvalStatus === 'Pending' ? (
                            isAuthenticated ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  id={`approve-transfer-btn-${tr.transferId}`}
                                  onClick={() => handleUpdateTransferStatus(tr.transferId, 'Approved')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[11px] font-bold transition cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  id={`reject-transfer-btn-${tr.transferId}`}
                                  onClick={() => handleUpdateTransferStatus(tr.transferId, 'Rejected')}
                                  className="px-2.5 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-sm text-[11px] font-bold transition cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-500 font-mono">🔓 Requires Admin Auth</span>
                            )
                          ) : (
                            <span className="text-[10px] text-zinc-500 font-mono italic text-zinc-600">Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'traceability' && (
        /* TRACEABILITY INSPECTOR TAB */
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1f1f23]">
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-mono">
                Instrument Lifecycle Audit Trail
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Select any registered sensor to visualize its chronological procurement, calibration, deployment, and hot-swap history.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <select
                id="traceability-sensor-select"
                value={selectedTraceSensorId}
                onChange={(e) => setSelectedTraceSensorId(e.target.value)}
                className="bg-[#0f0f12] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-600 cursor-pointer min-w-[240px]"
              >
                <option value="">-- Choose Sensor for Audit --</option>
                {sensors.map(s => (
                  <option key={s.sensorId} value={s.sensorId}>
                    SEN-{s.sensorId.toString().padStart(4, '0')}: {s.sensorName || s.manufacturer} ({s.sensorType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!selectedTraceSensorId ? (
            <div className="p-16 bg-[#0f0f12] border border-[#1f1f23] rounded-md text-center text-zinc-500">
              <Search className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="font-serif italic text-sm text-white">No instrument selected for audit.</p>
              <p className="text-xs text-zinc-500 mt-1">Please select an instrument from the dropdown menu above to inspect its pedigree.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              
              {/* Left Column: Selected Sensor Specs Card (4 columns) */}
              <div className="lg:col-span-4 space-y-6">
                {(() => {
                  const s = sensors.find(sen => sen.sensorId === parseInt(selectedTraceSensorId));
                  if (!s) return null;
                  return (
                    <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-6 sticky top-10 space-y-6">
                      <div className="pb-4 border-b border-[#1f1f23]">
                        <span className="text-[10px] font-mono font-bold text-zinc-500 bg-[#050505] border border-[#1f1f23] px-2.5 py-0.5 rounded-sm">
                          SEN-{s.sensorId.toString().padStart(4, '0')}
                        </span>
                        <h4 className="text-base font-bold text-white mt-3">{s.sensorName || `${s.manufacturer} ${s.sensorType}`}</h4>
                        <span className="text-xs text-zinc-400 font-mono mt-0.5 block">{s.sensorType}</span>
                      </div>

                      <div className="space-y-4 text-xs font-mono text-zinc-400">
                        <div>
                          <span className="text-[9px] uppercase text-zinc-500 block">Manufacturer</span>
                          <span className="text-white font-sans font-semibold text-xs mt-0.5 block">{s.manufacturer}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase text-zinc-500 block">Model & Serial No.</span>
                          <span className="text-white mt-0.5 block">M/N: {s.modelNumber || 'N/A'} <br/> S/N: {s.serialNumber || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase text-zinc-500 block">Current Status Badge</span>
                          <span className="inline-block mt-1 px-2.5 py-0.5 bg-zinc-950 text-white rounded-sm text-[10px] uppercase font-bold border border-[#1f1f23]">
                            {s.status}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase text-zinc-500 block">Operational Location</span>
                          <span className="text-zinc-200 font-sans mt-0.5 block">
                            {s.stationId ? (
                              <span className="text-emerald-400 font-semibold">Deployed to Terminal #{s.stationId}</span>
                            ) : (
                              <span>Depot Stockpile ({s.assignedOffice || 'Central Depot'})</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Interactive Chronological Pedigree Timeline (8 columns) */}
              <div className="lg:col-span-8">
                <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-8 space-y-6">
                  <h3 className="text-xs font-bold font-mono text-white tracking-widest uppercase border-b border-[#1f1f23] pb-4 flex items-center gap-2">
                    <History className="h-4 w-4 text-indigo-400" />
                    Chronological Log History
                  </h3>

                  {sensorHistory.length === 0 ? (
                    <p className="text-xs text-zinc-500 font-mono italic">No events or status changes recorded for this instrument.</p>
                  ) : (
                    <div className="relative border-l-2 border-zinc-800 ml-4 pl-8 space-y-8">
                      {sensorHistory.map((evt, idx) => (
                        <div key={idx} className="relative">
                          {/* Chronological dot */}
                          <span className="absolute -left-[41px] top-1.5 w-4 h-4 rounded-full bg-[#050505] border-2 border-indigo-500 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          </span>

                          <div className="space-y-1.5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                              <h4 className="text-sm font-bold text-white">{evt.title}</h4>
                              <span className="text-xs font-mono text-zinc-500">{evt.date}</span>
                            </div>
                            <span className={`inline-block text-[9px] font-mono px-2 py-0.5 rounded-sm border ${evt.badgeColor} uppercase font-bold`}>
                              {evt.type}
                            </span>
                            <p className="text-xs text-zinc-400 leading-relaxed font-sans mt-1">
                              {evt.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* --- MODAL 1: DEPLOY SENSOR --- */}
      {isDeployModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#0f0f12] border border-[#1f1f23] rounded-md shadow-2xl overflow-hidden">
            
            <div className="p-5 border-b border-[#1f1f23] flex items-center justify-between bg-indigo-950/20">
              <div>
                <span className="text-[9px] font-mono font-bold tracking-widest text-indigo-400 uppercase">DEPLOY INSTRUMENT</span>
                <h3 className="text-sm font-semibold text-white mt-0.5">Register Weather Station Allocation</h3>
              </div>
              <button
                onClick={() => setIsDeployModalOpen(false)}
                className="p-1 text-zinc-500 hover:text-white rounded-sm transition cursor-pointer"
              >
                <Activity className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleDeploySubmit} className="p-6 space-y-4">
              
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Select Instrument <span className="text-indigo-400">*</span>
                </label>
                <select
                  required
                  value={deploySensorId}
                  onChange={(e) => setDeploySensorId(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">-- Choose Spare/Store Sensor --</option>
                  {availableSensors.map(s => (
                    <option key={s.sensorId} value={s.sensorId}>
                      SEN-{s.sensorId.toString().padStart(4, '0')}: {s.sensorName || s.manufacturer} S/N: {s.serialNumber || 'N/A'} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Target Weather Terminal <span className="text-indigo-400">*</span>
                </label>
                <select
                  required
                  value={deployStationId}
                  onChange={(e) => setDeployStationId(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">-- Select Terminal Station --</option>
                  {stations.map(st => (
                    <option key={st.stationId} value={st.stationId}>
                      {st.stationName} ({st.region})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Deployment Date <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={deployDate}
                    onChange={(e) => setDeployDate(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Field Engineer <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Personnel involved"
                    value={deployPersonnel}
                    onChange={(e) => setDeployPersonnel(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Installation Notes / Mounting Info
                </label>
                <textarea
                  rows={3}
                  placeholder="Mounting height, calibration checks performed on site, wire paths, orientation, etc..."
                  value={deployNotes}
                  onChange={(e) => setDeployNotes(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-600 transition"
                />
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="submit"
                  disabled={!isAuthenticated}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold rounded-md text-xs tracking-wide transition cursor-pointer text-center"
                >
                  Confirm Allocation
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeployModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {!isAuthenticated && (
                <p className="text-[10px] text-zinc-500 text-center font-mono mt-1">
                  🔓 Unlock admin controls to deploy.
                </p>
              )}

            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: RETRIEVE SENSOR --- */}
      {isRetrieveModalOpen && retrievingDeployment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#0f0f12] border border-[#1f1f23] rounded-md shadow-2xl overflow-hidden">
            
            <div className="p-5 border-b border-[#1f1f23] flex items-center justify-between bg-amber-950/20">
              <div>
                <span className="text-[9px] font-mono font-bold tracking-widest text-amber-500 uppercase">RETRIEVE SENSOR</span>
                <h3 className="text-sm font-semibold text-white mt-0.5">
                  SEN-{retrievingDeployment.sensorId.toString().padStart(4, '0')}: {retrievingDeployment.sensorName}
                </h3>
              </div>
              <button
                onClick={() => setIsRetrieveModalOpen(false)}
                className="p-1 text-zinc-500 hover:text-white rounded-sm transition cursor-pointer"
              >
                <Boxes className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRetrieveSubmit} className="p-6 space-y-4">
              
              <div className="p-3 bg-[#050505] border border-[#1f1f23] rounded-md text-xs text-zinc-400 space-y-1">
                <p>Deployed Station: <span className="text-white font-semibold">{retrievingDeployment.stationName}</span></p>
                <p>Deployment Date: <span className="text-white font-mono">{retrievingDeployment.deploymentDate}</span></p>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Retrieval Date <span className="text-amber-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={retrieveDate}
                  onChange={(e) => setRetrieveDate(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Instrument Destination State <span className="text-amber-500">*</span>
                </label>
                <select
                  required
                  value={retrieveNextStatus}
                  onChange={(e) => setRetrieveNextStatus(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-600 cursor-pointer"
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
                  Retrieval Remarks / Reason
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why the sensor was unmounted (e.g., routine recalibration, repair, upgrade, damage)..."
                  value={retrieveRemarks}
                  onChange={(e) => setRetrieveRemarks(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-600 transition"
                />
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="submit"
                  disabled={!isAuthenticated}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold rounded-md text-xs tracking-wide transition cursor-pointer text-center"
                >
                  Confirm Retrieval Checkout
                </button>
                <button
                  type="button"
                  onClick={() => setIsRetrieveModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {!isAuthenticated && (
                <p className="text-[10px] text-zinc-500 text-center font-mono mt-1">
                  🔓 Unlock admin controls to retrieve.
                </p>
              )}

            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: SWAP/REPLACE SENSOR --- */}
      {isReplaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[#0f0f12] border border-[#1f1f23] rounded-md shadow-2xl overflow-hidden">
            
            <div className="p-5 border-b border-[#1f1f23] flex items-center justify-between bg-emerald-950/20">
              <div>
                <span className="text-[9px] font-mono font-bold tracking-widest text-emerald-400 uppercase">SWAP / REPLACE INSTRUMENT</span>
                <h3 className="text-sm font-semibold text-white mt-0.5">Weather Station Hot-Swap Maintenance</h3>
              </div>
              <button
                onClick={() => setIsReplaceModalOpen(false)}
                className="p-1 text-zinc-500 hover:text-white rounded-sm transition cursor-pointer"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleReplaceSubmit} className="p-6 space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Target Station <span className="text-emerald-400">*</span>
                  </label>
                  <select
                    required
                    value={replaceStationId}
                    onChange={(e) => {
                      setReplaceStationId(e.target.value);
                      setReplaceOldSensorId(''); // reset old sensor choice
                    }}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="">-- Select Station --</option>
                    {stations.map(st => (
                      <option key={st.stationId} value={st.stationId}>
                        {st.stationName} ({st.region})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Malfunctioning Sensor to Remove <span className="text-emerald-400">*</span>
                  </label>
                  <select
                    required
                    disabled={!replaceStationId}
                    value={replaceOldSensorId}
                    onChange={(e) => setReplaceOldSensorId(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-600 cursor-pointer disabled:bg-zinc-950 disabled:text-zinc-600"
                  >
                    <option value="">-- Choose Installed Sensor --</option>
                    {activeStationDeployments.map(d => (
                      <option key={d.sensorId} value={d.sensorId}>
                        SEN-{d.sensorId.toString().padStart(4, '0')}: {d.sensorName} (S/N: {d.serialNumber})
                      </option>
                    ))}
                  </select>
                  {!replaceStationId && (
                    <span className="text-[9px] text-zinc-600 mt-1 block">Please select station first</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    New Sensor to Install <span className="text-emerald-400">*</span>
                  </label>
                  <select
                    required
                    value={replaceNewSensorId}
                    onChange={(e) => setReplaceNewSensorId(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="">-- Choose Spare/Store Sensor --</option>
                    {availableSensors.map(s => (
                      <option key={s.sensorId} value={s.sensorId}>
                        SEN-{s.sensorId.toString().padStart(4, '0')}: {s.sensorName || s.manufacturer} S/N: {s.serialNumber || 'N/A'} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Destination Status of Removed Sensor <span className="text-emerald-400">*</span>
                  </label>
                  <select
                    required
                    value={replaceOldNextStatus}
                    onChange={(e) => setReplaceOldNextStatus(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    {statuses.map(st => (
                      <option key={st.id} value={st.statusName}>
                        {st.statusName} {st.isConsumableOnly === 'true' ? '(Consumable)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Date of Replacement <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={replaceDate}
                    onChange={(e) => setReplaceDate(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Responsible Personnel <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Field Engineer / Technician"
                    value={replacePersonnel}
                    onChange={(e) => setReplacePersonnel(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Reason for Sensor swap <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Malfunctioning signal, storm damage, drift, routine swap..."
                  value={replaceReason}
                  onChange={(e) => setReplaceReason(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Replacement field Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Record wiring modifications, alignment, initial onsite readings..."
                  value={replaceNotes}
                  onChange={(e) => setReplaceNotes(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-600 transition"
                />
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="submit"
                  disabled={!isAuthenticated}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold rounded-md text-xs tracking-wide transition cursor-pointer text-center"
                >
                  Execute Sensor Swap
                </button>
                <button
                  type="button"
                  onClick={() => setIsReplaceModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {!isAuthenticated && (
                <p className="text-[10px] text-zinc-500 text-center font-mono mt-1">
                  🔓 Unlock admin controls to execute swaps.
                </p>
              )}

            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: TRANSFER INSTRUMENT --- */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-[#0f0f12] border border-[#1f1f23] rounded-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            <div className="p-5 border-b border-[#1f1f23] flex items-center justify-between bg-amber-950/20 shrink-0">
              <div>
                <span className="text-[9px] font-mono font-bold tracking-widest text-amber-400 uppercase">TRANSFER SYSTEM</span>
                <h3 className="text-sm font-semibold text-white mt-0.5">Log / Request Instrument Transfer</h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 text-zinc-500 hover:text-white rounded-sm transition cursor-pointer"
              >
                <Activity className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-6 space-y-4 overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Select Instrument <span className="text-amber-400">*</span>
                  </label>
                  <select
                    required
                    value={transferSensorId}
                    onChange={(e) => {
                      setTransferSensorId(e.target.value);
                      const s = sensors.find(sen => sen.sensorId === parseInt(e.target.value));
                      if (s) {
                        setTransferSender(s.stationId ? `Station #${s.stationId}` : (s.assignedOffice || 'Central Depot'));
                      }
                    }}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-600 cursor-pointer"
                  >
                    <option value="">-- Choose Sensor --</option>
                    {sensors.map(s => (
                      <option key={s.sensorId} value={s.sensorId}>
                        SEN-{s.sensorId.toString().padStart(4, '0')}: {s.sensorName || s.manufacturer} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Transfer Type <span className="text-amber-400">*</span>
                  </label>
                  <select
                    required
                    value={transferType}
                    onChange={(e) => setTransferType(e.target.value as any)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-600 cursor-pointer"
                  >
                    <option value="Office to Office">Office to Office transfer</option>
                    <option value="Office to Station deployment">Office to Station deployment</option>
                    <option value="Station to Office return">Station to Office return</option>
                    <option value="Regional to Head Office transfer">Regional to Head Office transfer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Transfer Duration Type <span className="text-amber-400">*</span>
                  </label>
                  <select
                    required
                    value={transferDuration}
                    onChange={(e) => setTransferDuration(e.target.value as any)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-600 cursor-pointer"
                  >
                    <option value="Permanent">Permanent transfer</option>
                    <option value="Temporary">Temporary transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Transfer Date <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Sender Office/Location <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Regional Office, Station Alpha, Central Depot"
                    value={transferSender}
                    onChange={(e) => setTransferSender(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Receiver Office/Location <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Head Office, Station Beta, Regional Depot"
                    value={transferReceiver}
                    onChange={(e) => setTransferReceiver(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Personnel Involved <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Connor, Logistics Lead"
                    value={transferPersonnel}
                    onChange={(e) => setTransferPersonnel(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Condition during Transfer <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Excellent, boxed, calibrated, calibration seal intact"
                    value={transferCondition}
                    onChange={(e) => setTransferCondition(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Approval Status upon Registry <span className="text-amber-400">*</span>
                </label>
                <select
                  required
                  value={transferApprovalStatus}
                  onChange={(e) => setTransferApprovalStatus(e.target.value as any)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-600 cursor-pointer"
                >
                  <option value="Pending">Pending Review (Awaiting Supervisor Signoff)</option>
                  <option value="Approved">Approved / Execute Transfer Immediately</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Transfer Remarks / Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Any logistics specifics, delivery couriers, or custody remarks..."
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-600 transition"
                />
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="submit"
                  disabled={!isAuthenticated}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold rounded-md text-xs tracking-wide transition cursor-pointer text-center"
                >
                  Log Transfer Record
                </button>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {!isAuthenticated && (
                <p className="text-[10px] text-zinc-500 text-center font-mono mt-1">
                  🔓 Unlock admin controls to request or register transfers.
                </p>
              )}

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
