import React, { useState } from 'react';
import { 
  Archive, 
  Search, 
  Eye, 
  RotateCcw, 
  CheckCircle2, 
  ShieldCheck, 
  Calendar, 
  User, 
  Building2,
  FileText,
  Filter
} from 'lucide-react';
import { MaintenanceTicket, WeatherStation } from '../../types.ts';

interface ArchivedTicketsViewProps {
  archivedTickets: MaintenanceTicket[];
  stations: WeatherStation[];
  onViewTicket: (ticket: MaintenanceTicket) => void;
  onRestoreTicket: (ticketNumber: string) => void;
}

export default function ArchivedTicketsView({
  archivedTickets,
  stations,
  onViewTicket,
  onRestoreTicket
}: ArchivedTicketsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStation, setSelectedStation] = useState<string>('All');

  const filtered = archivedTickets.filter(t => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      t.ticketNumber.toLowerCase().includes(term) ||
      t.stationName.toLowerCase().includes(term) ||
      t.summary.toLowerCase().includes(term) ||
      (t.resolvedBy && t.resolvedBy.toLowerCase().includes(term)) ||
      (t.acknowledgedBy && t.acknowledgedBy.toLowerCase().includes(term)) ||
      (t.archivedBy && t.archivedBy.toLowerCase().includes(term));

    const matchesStation = selectedStation === 'All' || String(t.stationId) === selectedStation;
    return matchesSearch && matchesStation;
  });

  return (
    <div className="space-y-5 font-mono text-xs text-zinc-100">
      {/* Controls Bar */}
      <div className="bg-[#0b0e14] border border-[#1a2230] p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search archived ticket #, station, solver, or verifier..."
              className="w-full pl-9 pr-3 py-2 bg-[#06080c] border border-[#1e293b] rounded-lg text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={selectedStation}
            onChange={e => setSelectedStation(e.target.value)}
            className="px-3 py-2 bg-[#06080c] border border-[#1e293b] rounded-lg text-xs font-mono text-zinc-300 focus:outline-none focus:border-amber-500 max-w-[200px] truncate"
          >
            <option value="All">All Stations</option>
            {stations.map(st => (
              <option key={st.stationId} value={st.stationId}>{st.stationName}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2 text-zinc-400 text-xs shrink-0">
          <Archive className="h-4 w-4 text-amber-400" />
          <span>Archived Records: <strong className="text-white">{archivedTickets.length}</strong></span>
        </div>
      </div>

      {/* Archive Records Table */}
      <div className="bg-[#0b0e14] border border-[#1a2230] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-[#070a10] border-b border-[#1a2230] text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4">Ticket #</th>
                <th className="py-3.5 px-4">Station</th>
                <th className="py-3.5 px-4">Problem & Resolution</th>
                <th className="py-3.5 px-4">Solved By</th>
                <th className="py-3.5 px-4">Acknowledged By</th>
                <th className="py-3.5 px-4">Archived At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#161f2e]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    <Archive className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                    <p className="text-sm font-sans">No archived tickets found matching current filters.</p>
                    <p className="text-[11px] text-zinc-600 mt-1 font-mono">
                      Tickets move to archive after problem solution is acknowledged and user clicks &quot;Close &amp; Store in Archive&quot;.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(ticket => (
                  <tr key={ticket.ticketNumber} className="hover:bg-[#0f1522] transition-colors">
                    {/* Ticket # */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                        #{ticket.ticketNumber}
                      </span>
                    </td>

                    {/* Station */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-zinc-100 font-sans text-sm">{ticket.stationName}</div>
                      <span className="text-[10px] text-zinc-500">{ticket.region || 'Met Network'}</span>
                    </td>

                    {/* Problem Summary & Resolution */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-zinc-200 line-clamp-1">{ticket.summary}</div>
                      {ticket.resolutionNotes && (
                        <p className="text-[11px] text-emerald-300 line-clamp-1 mt-0.5 font-sans">
                          ✓ {ticket.resolutionNotes}
                        </p>
                      )}
                      {(ticket.sensorRequests?.length ?? 0) > 0 && (
                        <span className="inline-block mt-1 text-[9px] bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20">
                          {ticket.sensorRequests?.length} sensor replacement(s)
                        </span>
                      )}
                    </td>

                    {/* Solved By */}
                    <td className="py-3.5 px-4">
                      <div className="text-zinc-200">{ticket.resolvedBy || 'Technician'}</div>
                      <div className="text-[10px] text-zinc-500">{ticket.resolvedAt || 'N/A'}</div>
                    </td>

                    {/* Acknowledged By */}
                    <td className="py-3.5 px-4">
                      <div className="text-cyan-300 font-bold flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-cyan-400" />
                        <span>{ticket.acknowledgedBy || 'Supervisor'}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500">{ticket.acknowledgedAt || 'N/A'}</div>
                    </td>

                    {/* Archived By / Date */}
                    <td className="py-3.5 px-4">
                      <div className="text-amber-300">{ticket.archivedBy || 'System'}</div>
                      <div className="text-[10px] text-zinc-500">{ticket.archivedAt || 'N/A'}</div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => onViewTicket(ticket)}
                        className="px-2.5 py-1 bg-[#141d2c] hover:bg-[#1f2b3e] text-blue-300 rounded text-xs transition cursor-pointer"
                        title="View Full Archive Audit Trail"
                      >
                        <Eye className="h-3.5 w-3.5 inline mr-1" />
                        Audit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Restore Ticket #${ticket.ticketNumber} back to active maintenance queue?`)) {
                            onRestoreTicket(ticket.ticketNumber);
                          }
                        }}
                        className="px-2.5 py-1 bg-[#1c1810] hover:bg-[#2c2214] text-amber-300 rounded text-xs transition cursor-pointer"
                        title="Restore to Active Queue"
                      >
                        <RotateCcw className="h-3.5 w-3.5 inline mr-1" />
                        Restore
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
