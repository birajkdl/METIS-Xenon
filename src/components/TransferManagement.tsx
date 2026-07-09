import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  ArrowRightLeft, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  User as UserIcon, 
  Activity,
  ChevronDown,
  RefreshCw,
  FileText,
  Clock,
  ShieldCheck,
  Building,
  MapPin
} from 'lucide-react';
import { Sensor, WeatherStation, SensorTransfer } from '../types.ts';

interface TransferManagementProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  isAuthenticated: boolean;
  onRefresh: () => void;
  token: string | null;
}

export default function TransferManagement({
  sensors,
  stations,
  isAuthenticated,
  onRefresh,
  token
}: TransferManagementProps) {
  const [transfers, setTransfers] = useState<SensorTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDuration, setFilterDuration] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sensorId, setSensorId] = useState('');
  const [transferType, setTransferType] = useState<'Office to Office' | 'Office to Station deployment' | 'Station to Office return' | 'Regional to Head Office transfer'>('Office to Office');
  const [durationType, setDurationType] = useState<'Permanent' | 'Temporary'>('Permanent');
  const [sender, setSender] = useState('');
  const [receiver, setReceiver] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [personnelInvolved, setPersonnelInvolved] = useState('');
  const [conditionDuringTransfer, setConditionDuringTransfer] = useState('');
  const [transferRemarks, setTransferRemarks] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<'Pending' | 'Approved'>('Pending');

  // Notification states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch Transfers from API
  const fetchTransfers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/transfers');
      if (res.ok) {
        const data = await res.json();
        setTransfers(data);
      } else {
        console.error("Failed to load transfers");
      }
    } catch (err) {
      console.error("Error fetching transfers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [sensors]);

  // Handle Submission of Transfer
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !token) {
      setErrorMsg("Administrator authentication is required to log transfers.");
      return;
    }

    if (!sensorId || !sender.trim() || !receiver.trim() || !personnelInvolved.trim() || !conditionDuringTransfer.trim()) {
      setErrorMsg("Please fill out all required fields.");
      return;
    }

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
          sensorId: parseInt(sensorId),
          transferType,
          durationType,
          sender: sender.trim(),
          receiver: receiver.trim(),
          transferDate,
          personnelInvolved: personnelInvolved.trim(),
          conditionDuringTransfer: conditionDuringTransfer.trim(),
          transferRemarks: transferRemarks.trim() || null,
          approvalStatus
        })
      });

      if (res.ok) {
        setSuccessMsg(approvalStatus === 'Approved' ? "Transfer executed and registered successfully!" : "Transfer request logged and awaiting approval.");
        setIsModalOpen(false);
        
        // Reset Form
        setSensorId('');
        setSender('');
        setReceiver('');
        setPersonnelInvolved('');
        setConditionDuringTransfer('');
        setTransferRemarks('');
        setApprovalStatus('Pending');

        // Reload data
        fetchTransfers();
        onRefresh();

        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to register transfer.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred.");
    }
  };

  // Handle Approval / Rejection
  const handleReviewTransfer = async (transferId: number, status: 'Approved' | 'Rejected') => {
    if (!isAuthenticated || !token) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const notes = prompt(`Enter review notes for setting status to ${status}:`) || "";

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
        fetchTransfers();
        onRefresh();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to update status.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred.");
    }
  };

  // Auto populate defaults based on sensor selection
  const handleSensorSelection = (sId: string) => {
    setSensorId(sId);
    const selected = sensors.find(s => s.sensorId === parseInt(sId));
    if (selected) {
      // Auto populate sender location
      if (selected.status === 'Deployed' && selected.stationId) {
        const stationObj = stations.find(st => st.stationId === selected.stationId);
        setSender(stationObj ? stationObj.stationName : `Station #${selected.stationId}`);
        setTransferType('Station to Office return');
      } else {
        setSender(selected.assignedOffice || 'Central Depot');
        setTransferType('Office to Office');
      }
    }
  };

  // Auto populate receiver suggestions based on type
  useEffect(() => {
    if (transferType === 'Station to Office return') {
      setReceiver('Central Depot');
    } else if (transferType === 'Office to Station deployment') {
      setReceiver(stations[0]?.stationName || 'Station Alpha');
    } else if (transferType === 'Regional to Head Office transfer') {
      setReceiver('Head Office');
    } else if (transferType === 'Office to Office') {
      setReceiver('Regional Office');
    }
  }, [transferType, stations]);

  // Statistics Calculation
  const totalCount = transfers.length;
  const pendingCount = transfers.filter(t => t.approvalStatus === 'Pending').length;
  const approvedCount = transfers.filter(t => t.approvalStatus === 'Approved').length;
  const permanentCount = transfers.filter(t => t.durationType === 'Permanent').length;
  const temporaryCount = transfers.filter(t => t.durationType === 'Temporary').length;

  // Filtering
  const filteredTransfers = transfers.filter(tr => {
    const sName = tr.sensorName?.toLowerCase() || '';
    const sType = tr.sensorType?.toLowerCase() || '';
    const sSerial = tr.serialNumber?.toLowerCase() || '';
    const trSender = tr.sender.toLowerCase();
    const trReceiver = tr.receiver.toLowerCase();
    const trPersonnel = tr.personnelInvolved.toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = 
      sName.includes(query) ||
      sType.includes(query) ||
      sSerial.includes(query) ||
      trSender.includes(query) ||
      trReceiver.includes(query) ||
      trPersonnel.includes(query);

    const matchesType = filterType === 'all' || tr.transferType === filterType;
    const matchesDuration = filterDuration === 'all' || tr.durationType === filterDuration;
    const matchesStatus = filterStatus === 'all' || tr.approvalStatus === filterStatus;

    return matchesSearch && matchesType && matchesDuration && matchesStatus;
  });

  return (
    <div className="flex-1 bg-[#050507] text-[#e4e4e7] flex flex-col overflow-y-auto">
      
      {/* Header Panel */}
      <div className="p-8 border-b border-[#1f1f23] bg-[#07070a]/90 backdrop-blur-md sticky top-0 z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-zinc-500 uppercase tracking-widest mb-1.5">
            <Truck className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
            <span>Meteo Logistics Node</span>
          </div>
          <h2 className="text-2xl font-serif italic text-white tracking-wide">
            Instrument Transfer Management
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Authorize, review, and audit physical equipment movements including depot returns, station deployments, office-to-office relocations, and regional transfers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTransfers}
            className="p-2 bg-[#0f0f12] hover:bg-white/5 text-zinc-400 hover:text-white border border-[#1f1f23] rounded-md transition duration-200 cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isAuthenticated ? (
            <button
              id="request-transfer-btn"
              onClick={() => {
                setIsModalOpen(true);
                setErrorMsg(null);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-xs font-bold font-sans tracking-wide transition cursor-pointer shadow-md shadow-amber-600/10"
            >
              <Plus className="h-4 w-4" />
              <span>Log Transfer Record</span>
            </button>
          ) : (
            <div className="text-[10px] bg-[#1a1309] text-amber-400 border border-amber-900/40 px-3 py-2 rounded-md font-mono max-w-xs">
              🔒 Log in as admin to initiate or review instrument transfers.
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
        
        {/* Banner Alert Alerts */}
        {successMsg && (
          <div className="p-4 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 rounded-md flex items-start space-x-3 text-xs animate-fadeIn">
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Action Completed Successfully</p>
              <p className="mt-0.5 text-zinc-300">{successMsg}</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-950/40 text-red-400 border border-red-900/40 rounded-md flex items-start space-x-3 text-xs animate-fadeIn">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Logistics Verification Failure</p>
              <p className="mt-0.5 text-zinc-300">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* --- SECTION 1: LOGISTICS METRICS OVERVIEW --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-[#0a0a0d] border border-[#1f1f23] rounded-md relative overflow-hidden group hover:border-[#2f2f35] transition duration-200">
            <div className="absolute right-3 bottom-1 text-zinc-900 opacity-20 pointer-events-none group-hover:scale-105 transition-transform">
              <Truck className="h-16 w-16" />
            </div>
            <p className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">Transfer Ledger Size</p>
            <p className="text-3xl font-serif italic text-white mt-2 font-semibold">{totalCount}</p>
            <span className="text-[10px] text-zinc-500 block mt-1">Total physical operations logged</span>
          </div>

          <div className="p-5 bg-[#0a0a0d] border border-[#1f1f23] rounded-md relative overflow-hidden group hover:border-[#2f2f35] transition duration-200">
            <div className="absolute right-3 bottom-1 text-amber-950/20 opacity-30 pointer-events-none group-hover:scale-105 transition-transform">
              <Clock className="h-16 w-16" />
            </div>
            <p className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">Awaiting Sign-off</p>
            <p className="text-3xl font-serif italic text-amber-400 mt-2 font-semibold">{pendingCount}</p>
            <span className="text-[10px] text-zinc-500 block mt-1">Pending supervisor evaluation</span>
          </div>

          <div className="p-5 bg-[#0a0a0d] border border-[#1f1f23] rounded-md relative overflow-hidden group hover:border-[#2f2f35] transition duration-200">
            <div className="absolute right-3 bottom-1 text-indigo-950/20 opacity-30 pointer-events-none group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-16 w-16" />
            </div>
            <p className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">Permanent Transfers</p>
            <p className="text-3xl font-serif italic text-indigo-400 mt-2 font-semibold">{permanentCount}</p>
            <span className="text-[10px] text-zinc-500 block mt-1">Relocations with permanent custody</span>
          </div>

          <div className="p-5 bg-[#0a0a0d] border border-[#1f1f23] rounded-md relative overflow-hidden group hover:border-[#2f2f35] transition duration-200">
            <div className="absolute right-3 bottom-1 text-emerald-950/20 opacity-30 pointer-events-none group-hover:scale-105 transition-transform">
              <CheckCircle2 className="h-16 w-16" />
            </div>
            <p className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">Temporary Allocations</p>
            <p className="text-3xl font-serif italic text-emerald-400 mt-2 font-semibold">{temporaryCount}</p>
            <span className="text-[10px] text-zinc-500 block mt-1">Temporary or rotational field assets</span>
          </div>
        </div>

        {/* --- SECTION 2: PENDING APPROVAL QUEUE --- */}
        {pendingCount > 0 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
              <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
                Supervisor Authorization Queue ({pendingCount})
              </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {transfers.filter(t => t.approvalStatus === 'Pending').map(tr => (
                <div 
                  key={tr.transferId}
                  className="bg-[#0f0f13] border border-amber-900/30 rounded-md p-5 flex flex-col justify-between hover:border-amber-900/50 transition duration-200"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-zinc-500">TRANSFER ID: #{tr.transferId}</span>
                      <span className="text-[9px] font-mono text-amber-400 bg-amber-950/30 px-2 py-0.5 border border-amber-900/40 rounded-sm">
                        {tr.durationType}
                      </span>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-zinc-900 border border-[#1f1f23] rounded text-zinc-400 mt-1">
                        <Truck className="h-4.5 w-4.5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 font-mono">SEN-{tr.sensorId.toString().padStart(4, '0')}</p>
                        <h4 className="text-sm font-semibold text-white">{tr.sensorName}</h4>
                        <p className="text-xs text-zinc-400 mt-0.5">S/N: {tr.serialNumber} • Type: {tr.sensorType}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-2 border-y border-[#1f1f23] text-xs font-sans">
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 block uppercase">Sender (From)</span>
                        <span className="font-semibold text-zinc-200 block truncate">{tr.sender}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 block uppercase">Receiver (To)</span>
                        <span className="font-semibold text-emerald-400 block truncate">{tr.receiver}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-zinc-300">
                      <p><span className="text-zinc-500 font-mono text-[11px]">Personnel:</span> {tr.personnelInvolved}</p>
                      <p><span className="text-zinc-500 font-mono text-[11px]">Condition:</span> {tr.conditionDuringTransfer}</p>
                      <p><span className="text-zinc-500 font-mono text-[11px]">Type:</span> {tr.transferType}</p>
                      {tr.transferRemarks && (
                        <p className="text-zinc-400 italic text-[11px] bg-[#050505] p-2 border border-[#1f1f23] rounded">
                          "{tr.transferRemarks}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#1f1f23] flex items-center justify-between">
                    <div className="flex items-center space-x-1 text-[10px] text-zinc-500 font-mono">
                      <Calendar className="h-3 w-3" />
                      <span>Log Date: {tr.transferDate}</span>
                    </div>

                    {isAuthenticated ? (
                      <div className="flex items-center space-x-2">
                        <button
                          id={`approve-pending-btn-${tr.transferId}`}
                          onClick={() => handleReviewTransfer(tr.transferId, 'Approved')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-xs font-bold transition cursor-pointer"
                        >
                          Approve & Apply
                        </button>
                        <button
                          id={`reject-pending-btn-${tr.transferId}`}
                          onClick={() => handleReviewTransfer(tr.transferId, 'Rejected')}
                          className="px-3.5 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 rounded-sm text-xs font-bold transition cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[9px] text-zinc-500 font-mono">🔓 Auth needed to review</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- SECTION 3: SYSTEM HISTORIC LOGS LEDGER --- */}
        <div className="space-y-4">
          
          {/* Filters & Control Panel */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-[#0a0a0d] border border-[#1f1f23] rounded-md">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search ledger by model, S/N, location, personnel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#050507] border border-[#1f1f23] rounded-md pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-600 placeholder-zinc-600 font-sans"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* Filter by Transfer Type */}
              <div className="flex items-center space-x-1.5 bg-[#050507] border border-[#1f1f23] rounded-md px-2.5 py-1.5">
                <span className="text-[10px] text-zinc-500 font-mono uppercase">Type:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all">All Transfers</option>
                  <option value="Office to Office">Office to Office</option>
                  <option value="Office to Station deployment">Office to Station</option>
                  <option value="Station to Office return">Station to Office</option>
                  <option value="Regional to Head Office transfer">Regional to Head Office</option>
                </select>
              </div>

              {/* Filter by Duration */}
              <div className="flex items-center space-x-1.5 bg-[#050507] border border-[#1f1f23] rounded-md px-2.5 py-1.5">
                <span className="text-[10px] text-zinc-500 font-mono uppercase">Duration:</span>
                <select
                  value={filterDuration}
                  onChange={(e) => setFilterDuration(e.target.value)}
                  className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all">All Durations</option>
                  <option value="Permanent">Permanent</option>
                  <option value="Temporary">Temporary</option>
                </select>
              </div>

              {/* Filter by Status */}
              <div className="flex items-center space-x-1.5 bg-[#050507] border border-[#1f1f23] rounded-md px-2.5 py-1.5">
                <span className="text-[10px] text-zinc-500 font-mono uppercase">Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

            </div>

          </div>

          {/* Transfers Table */}
          {filteredTransfers.length === 0 ? (
            <div className="p-16 bg-[#0a0a0d] border border-[#1f1f23] rounded-md text-center text-zinc-500">
              <Truck className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="font-serif italic text-sm text-white">No matching transfers found.</p>
              <p className="text-xs text-zinc-500 mt-1">Try refining search parameters or register a new transfer record.</p>
            </div>
          ) : (
            <div className="border border-[#1f1f23] rounded-md overflow-hidden bg-[#0a0a0d]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#050507] border-b border-[#1f1f23] text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
                      <th className="p-4">Sensor Identification</th>
                      <th className="p-4">Transfer Logic & Scope</th>
                      <th className="p-4">From / To Route</th>
                      <th className="p-4">Transfer Date</th>
                      <th className="p-4">Custody & Condition</th>
                      <th className="p-4">Status & Approval</th>
                      <th className="p-4 text-right">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f1f23] text-xs font-sans">
                    {filteredTransfers.map(tr => (
                      <tr key={tr.transferId} className="hover:bg-white/[0.01] transition-colors">
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-mono text-zinc-500 block">SEN-{tr.sensorId.toString().padStart(4, '0')}</span>
                            <span className="font-semibold text-white block max-w-[180px] truncate">{tr.sensorName}</span>
                            <span className="text-[10px] text-zinc-400 font-mono block">S/N: {tr.serialNumber}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <span className="font-semibold text-zinc-200 block">{tr.transferType}</span>
                            <span className={`inline-block text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${
                              tr.durationType === 'Permanent' 
                                ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/40' 
                                : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40'
                            }`}>
                              {tr.durationType}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1.5 text-zinc-300">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-zinc-500 uppercase w-8 font-mono">From:</span>
                              <span className="font-medium text-white truncate max-w-[150px]" title={tr.sender}>{tr.sender}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-zinc-500 uppercase w-8 font-mono">To:</span>
                              <span className="font-medium text-amber-400 truncate max-w-[150px]" title={tr.receiver}>{tr.receiver}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-zinc-300">
                          {tr.transferDate}
                        </td>
                        <td className="p-4">
                          <div className="space-y-1 text-zinc-300 max-w-[240px]">
                            <div className="flex items-center gap-1.5 text-zinc-200">
                              <UserIcon className="h-3 w-3 text-zinc-500 shrink-0" />
                              <span className="font-medium truncate">{tr.personnelInvolved}</span>
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate" title={tr.conditionDuringTransfer}>
                              <span className="text-zinc-500 font-bold font-mono">Condition: </span>
                              {tr.conditionDuringTransfer}
                            </div>
                            {tr.transferRemarks && (
                              <div className="text-[10px] text-zinc-500 italic mt-0.5 truncate" title={tr.transferRemarks}>
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
                                  id={`review-approve-${tr.transferId}`}
                                  onClick={() => handleReviewTransfer(tr.transferId, 'Approved')}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[11px] font-bold transition cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  id={`review-reject-${tr.transferId}`}
                                  onClick={() => handleReviewTransfer(tr.transferId, 'Rejected')}
                                  className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-sm text-[11px] font-bold transition cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-500 font-mono">🔓 Authentication Needed</span>
                            )
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-mono italic">Completed</span>
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

      </div>

      {/* --- FORM MODAL: REGISTER NEW PHYSICAL TRANSFER --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-[#0f0f12] border border-[#1f1f23] rounded-md shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-scaleUp">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1f1f23] flex items-center justify-between bg-amber-950/10 shrink-0">
              <div>
                <span className="text-[9px] font-mono font-bold tracking-widest text-amber-500 uppercase">METEO LOGISTICS SYSTEM</span>
                <h3 className="text-sm font-semibold text-white mt-0.5">Register Physical Instrument Transfer</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-zinc-500 hover:text-white rounded-sm transition cursor-pointer"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitTransfer} className="p-6 space-y-4 overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Select Instrument <span className="text-amber-500">*</span>
                  </label>
                  <select
                    required
                    value={sensorId}
                    onChange={(e) => handleSensorSelection(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-600 cursor-pointer font-sans"
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
                    Transfer Scope <span className="text-amber-500">*</span>
                  </label>
                  <select
                    required
                    value={transferType}
                    onChange={(e) => setTransferType(e.target.value as any)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-600 cursor-pointer font-sans"
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
                    Transfer Duration Type <span className="text-amber-500">*</span>
                  </label>
                  <select
                    required
                    value={durationType}
                    onChange={(e) => setDurationType(e.target.value as any)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-600 cursor-pointer font-sans"
                  >
                    <option value="Permanent">Permanent transfer</option>
                    <option value="Temporary">Temporary transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Transfer Date <span className="text-amber-500">*</span>
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
                    Sender Facility / Facility <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Regional Office, Central Depot, Station Alpha"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-600 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Receiver Facility / Location <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Head Office, Station Beta, Regional Depot"
                    value={receiver}
                    onChange={(e) => setReceiver(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-600 font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Personnel Involved <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Connor, Logistics Lead"
                    value={personnelInvolved}
                    onChange={(e) => setPersonnelInvolved(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-600 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                    Condition during Transfer <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Perfect, boxed with calibration seal intact"
                    value={conditionDuringTransfer}
                    onChange={(e) => setConditionDuringTransfer(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-600 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Approval Action <span className="text-amber-500">*</span>
                </label>
                <select
                  required
                  value={approvalStatus}
                  onChange={(e) => setApprovalStatus(e.target.value as any)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-600 cursor-pointer font-sans"
                >
                  <option value="Pending">Request: Pending Review (Awaiting Supervisor Signoff)</option>
                  <option value="Approved">Direct: Execute Transfer Immediately</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">
                  Remarks / Logistics Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Any logistics details, delivery tracking number, or handoff notes..."
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-600 transition font-sans"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-4 border-t border-[#1f1f23]">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-md text-xs tracking-wide transition cursor-pointer text-center"
                >
                  Register Transfer
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-xs font-semibold transition cursor-pointer font-sans"
                >
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
