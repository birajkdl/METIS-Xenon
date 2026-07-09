import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  RefreshCw, 
  Calendar, 
  User, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Info, 
  History, 
  Globe, 
  Filter,
  FileSpreadsheet,
  FileJson
} from 'lucide-react';

interface AuditLog {
  id: number;
  action: string;
  actorEmail: string;
  actorRole: string | null;
  details: string;
  ipAddress: string | null;
  status: string;
  createdAt: string;
}

interface AuditTrailPanelProps {
  token: string | null;
}

export default function AuditTrailPanel({ token }: AuditTrailPanelProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering and Searching State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/audit/logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to retrieve audit trail data.');
      }
      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedAction('ALL');
    setSelectedStatus('ALL');
    setStartDate('');
    setEndDate('');
  };

  // Filter logic
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.actorRole && log.actorRole.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.ipAddress && log.ipAddress.includes(searchQuery));

    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
    const matchesStatus = selectedStatus === 'ALL' || log.status === selectedStatus;

    let matchesDate = true;
    if (startDate) {
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];
      matchesDate = matchesDate && logDate >= startDate;
    }
    if (endDate) {
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];
      matchesDate = matchesDate && logDate <= endDate;
    }

    return matchesSearch && matchesAction && matchesStatus && matchesDate;
  });

  // Action Badge styling helper
  const getActionBadgeStyle = (action: string) => {
    switch (action) {
      case 'LOGIN_SUCCESS':
        return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400';
      case 'LOGIN_FAILED':
        return 'bg-rose-500/10 border-rose-500/25 text-rose-400';
      case 'INVENTORY_CREATE':
        return 'bg-blue-500/10 border-blue-500/25 text-blue-400';
      case 'INVENTORY_UPDATE':
        return 'bg-amber-500/10 border-amber-500/25 text-amber-400';
      case 'TRANSFER_APPROVE':
        return 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400';
      case 'TRANSFER_REJECT':
        return 'bg-purple-500/10 border-purple-500/25 text-purple-400';
      case 'CALIBRATION_UPDATE':
        return 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400';
      case 'RECORD_DELETED':
      case 'ARCHIVE_DELETE_RECORD':
        return 'bg-red-500/10 border-red-500/25 text-red-400';
      default:
        return 'bg-zinc-500/10 border-zinc-500/25 text-zinc-400';
    }
  };

  // Format action label for humans
  const getActionLabel = (action: string) => {
    return action.replace(/_/g, ' ');
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Log ID', 'Timestamp (UTC)', 'Action Category', 'Operator Email', 'Access Role', 'Logged Details', 'Client IP', 'Outcome Status'];
    const rows = filteredLogs.map(log => [
      log.id,
      new Date(log.createdAt).toISOString().replace('T', ' ').substring(0, 19),
      log.action,
      log.actorEmail,
      log.actorRole || 'N/A',
      `"${log.details.replace(/"/g, '""')}"`,
      log.ipAddress || 'Unknown',
      log.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `METIS_AUDIT_TRAIL_EXPORT_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const handleExportJSON = () => {
    if (filteredLogs.length === 0) return;

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(filteredLogs, null, 2)
    )}`;
    
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute("download", `METIS_AUDIT_TRAIL_EXPORT_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2 md:p-6" id="audit-trail-container">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#1f1f23] pb-6">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-600/10 border border-emerald-600/20 text-emerald-400 rounded-lg">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-white tracking-wide">Audit Trail & Security Logging</h1>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-0.5">METIS SYSTEM ACCREDITATION & INTEGRITY ENGINE</p>
            </div>
          </div>
        </div>
        
        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="audit-refresh-btn"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#0f0f13] hover:bg-[#15151c] text-zinc-300 border border-[#1f1f26] hover:border-zinc-700 rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload Logs</span>
          </button>
          
          <button
            id="audit-export-csv-btn"
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 text-blue-300 rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            id="audit-export-json-btn"
            onClick={handleExportJSON}
            disabled={filteredLogs.length === 0}
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#121216] border border-zinc-800 hover:bg-[#1a1a20] text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
          >
            <FileJson className="h-3.5 w-3.5 text-orange-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-[#0c0c0f] border border-[#1f1f23] rounded-xl p-5" id="audit-filters-card">
        <div className="flex items-center space-x-2 text-zinc-400 text-xs font-mono uppercase tracking-wider mb-4 pb-3 border-b border-white/[0.03]">
          <Filter className="h-3.5 w-3.5 text-blue-400" />
          <span>Search & Advanced Log Filtering</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Keyword Search */}
          <div className="space-y-1.5 col-span-1 md:col-span-2">
            <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">General Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
              <input
                id="filter-search"
                type="text"
                placeholder="Search details, actor email, IP or roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Action Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">Category Category</label>
            <select
              id="filter-action"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Log Categories</option>
              <option value="LOGIN_SUCCESS">Login Success</option>
              <option value="LOGIN_FAILED">Login Failed</option>
              <option value="INVENTORY_CREATE">Inventory Additions</option>
              <option value="INVENTORY_UPDATE">Inventory Updates</option>
              <option value="TRANSFER_APPROVE">Transfer Approvals</option>
              <option value="TRANSFER_REJECT">Transfer Rejections</option>
              <option value="CALIBRATION_UPDATE">Calibration Records</option>
              <option value="ARCHIVE_DELETE_RECORD">Archived & Damaged</option>
              <option value="RECORD_DELETED">Deletions</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">Log Outcome</label>
            <select
              id="filter-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Outcomes</option>
              <option value="Success">Success Only</option>
              <option value="Failed">Failed Only</option>
            </select>
          </div>

          {/* Date Range - From */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">Date Range</label>
            <div className="flex gap-2">
              <input
                id="filter-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 px-2 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-[10px] text-white focus:outline-hidden focus:border-blue-500"
              />
              <input
                id="filter-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 px-2 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-[10px] text-white focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Clear filters trigger */}
        {(searchQuery || selectedAction !== 'ALL' || selectedStatus !== 'ALL' || startDate || endDate) && (
          <div className="mt-3 flex justify-end">
            <button
              id="clear-filters-btn"
              onClick={resetFilters}
              className="text-[10px] font-mono text-zinc-500 hover:text-white transition-all cursor-pointer underline underline-offset-4"
            >
              Clear Current Log Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Audit logs table/view */}
      <div className="bg-[#0c0c0f] border border-[#1f1f23] rounded-xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/20 flex justify-between items-center">
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-zinc-400">Log Registry Status: ACTIVE</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest bg-zinc-900 border border-zinc-800/80 px-2 py-0.5 rounded-md">
            Showing {filteredLogs.length} of {logs.length} entries
          </span>
        </div>

        {loading ? (
          <div className="p-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mx-auto"></div>
            <p className="text-zinc-500 text-xs font-mono uppercase tracking-wider">Synchronizing secure event stream...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-400 space-y-2">
            <ShieldAlert className="h-10 w-10 mx-auto text-rose-500/50" />
            <p className="font-semibold text-sm">Failed to Sync Secure Log Stream</p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">{error}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-zinc-500 space-y-2">
            <Search className="h-10 w-10 mx-auto text-zinc-700" />
            <p className="text-sm font-medium text-zinc-400">No logs found matching specified criteria</p>
            <p className="text-xs text-zinc-600 max-w-sm mx-auto">Try refining your keyword query, removing filters, or resetting the target date constraints.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="audit-logs-table">
              <thead>
                <tr className="bg-zinc-950/40 text-[10px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                  <th className="py-3 px-4 text-center w-12">ID</th>
                  <th className="py-3 px-4 w-40">Timestamp (UTC)</th>
                  <th className="py-3 px-4 w-44">Log Category</th>
                  <th className="py-3 px-4 w-52">Operator (Email/Role)</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 w-32">Client IP</th>
                  <th className="py-3 px-4 w-24 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-xs">
                {filteredLogs.map((log) => (
                  <tr 
                    key={log.id} 
                    className="hover:bg-white/[0.01] transition-all group"
                  >
                    {/* ID */}
                    <td className="py-3 px-4 text-center text-zinc-600 font-mono text-[10px] bg-zinc-950/20">{log.id}</td>
                    
                    {/* Timestamp */}
                    <td className="py-3 px-4 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toISOString().replace('T', ' ').substring(0, 19)}
                    </td>
                    
                    {/* Log Category */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-md border text-[9px] font-semibold font-mono uppercase ${getActionBadgeStyle(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    
                    {/* Operator Email & Role */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-zinc-200 font-medium truncate max-w-[180px]" title={log.actorEmail}>{log.actorEmail}</span>
                        {log.actorRole && (
                          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase tracking-wide">
                            {log.actorRole}
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Details */}
                    <td className="py-3 px-4">
                      <p className="text-zinc-300 leading-relaxed max-w-lg md:max-w-xl group-hover:text-white transition-all">
                        {log.details}
                      </p>
                    </td>
                    
                    {/* Client IP */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5 text-zinc-500 font-mono text-[10px]">
                        <Globe className="h-3 w-3 shrink-0 text-zinc-600" />
                        <span>{log.ipAddress || 'Unknown'}</span>
                      </div>
                    </td>
                    
                    {/* Status badge */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wider font-mono uppercase ${
                        log.status === 'Success' 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {log.status === 'Success' ? (
                          <>
                            <CheckCircle className="h-2.5 w-2.5" />
                            <span>OK</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-2.5 w-2.5" />
                            <span>ERR</span>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Informative footer */}
      <div className="bg-[#0f0f13] border border-[#1f1f26] rounded-xl p-4 flex items-start space-x-3 text-xs text-zinc-500 font-mono leading-relaxed">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <span className="text-zinc-400 font-bold">SECURE INTEGRITY SEAL:</span> All audit trail records are read-only, timestamped on the server using non-malleable PostgreSQL schema constraints, and bound to decoded cryptographic Firebase ID user signatures. Attempted security breaches, modification of archived records, or unauthenticated login failures are cataloged in near-real-time.
        </div>
      </div>
    </div>
  );
}
