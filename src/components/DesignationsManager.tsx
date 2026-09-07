import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  Building2, 
  ShieldCheck, 
  FileText,
  Filter
} from 'lucide-react';
import { Designation } from '../types.ts';

interface DesignationsManagerProps {
  token: string | null;
  currentUserRole: string | null;
}

export default function DesignationsManager({ token, currentUserRole }: DesignationsManagerProps) {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Define / Add New Designation Form State
  const [showDefineModal, setShowDefineModal] = useState(false);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  // Edit Designation State
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'Active' | 'Inactive'>('Active');

  // UI Alerts
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDesignations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/designations', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setDesignations(data);
      }
    } catch (err) {
      console.error("Failed to load designations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesignations();
  }, [token]);

  const handleDefineDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!title.trim()) {
      setActionError("Designation title is required.");
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/designations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          code: code.trim() || null,
          department: department.trim() || null,
          description: description.trim() || null,
          status
        })
      });

      if (res.ok) {
        setActionSuccess(`Designation "${title.trim()}" defined successfully!`);
        setTitle('');
        setCode('');
        setDepartment('');
        setDescription('');
        setStatus('Active');
        setTimeout(() => {
          setShowDefineModal(false);
          setActionSuccess(null);
        }, 1000);
        await fetchDesignations();
      } else {
        const data = await res.json();
        setActionError(data.error || "Failed to define designation.");
      }
    } catch (err) {
      setActionError("Network error while defining designation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (des: Designation) => {
    setEditingDesignation(des);
    setEditTitle(des.title || '');
    setEditCode(des.code || '');
    setEditDepartment(des.department || '');
    setEditDescription(des.description || '');
    setEditStatus((des.status as 'Active' | 'Inactive') || 'Active');
    setActionError(null);
    setActionSuccess(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingDesignation) return;
    if (!editTitle.trim()) {
      setActionError("Designation title is required.");
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/designations/${editingDesignation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          code: editCode.trim() || null,
          department: editDepartment.trim() || null,
          description: editDescription.trim() || null,
          status: editStatus
        })
      });

      if (res.ok) {
        setActionSuccess("Designation updated successfully!");
        setTimeout(() => {
          setEditingDesignation(null);
          setActionSuccess(null);
        }, 1000);
        await fetchDesignations();
      } else {
        const data = await res.json();
        setActionError(data.error || "Failed to update designation.");
      }
    } catch (err) {
      setActionError("Network error while updating designation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDesignation = async (id: number, desTitle: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete designation "${desTitle}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/designations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        setActionSuccess(`Designation "${desTitle}" deleted successfully.`);
        await fetchDesignations();
      } else {
        const data = await res.json();
        setActionError(data.error || "Failed to delete designation.");
      }
    } catch (err) {
      setActionError("Network error while deleting designation.");
    }
  };

  const filteredDesignations = designations.filter(d => {
    const matchesSearch = 
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.code && d.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.department && d.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Action alerts */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Designations Panel */}
      <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#17171c] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-serif italic text-white">Personnel Designations</h3>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-1">
              Define and manage standardized designations for meteorologists, hydrologists, telemetry engineers, and station operators.
            </p>
          </div>
          <button
            onClick={() => {
              setShowDefineModal(true);
              setActionError(null);
              setActionSuccess(null);
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold transition cursor-pointer shadow-lg shadow-blue-600/10 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Define Designation</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search designations, codes, departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131316] border border-[#1f1f23] text-white pl-8 pr-3 py-1.5 rounded-md text-xs focus:outline-hidden focus:border-blue-500 font-sans"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Filter className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-[11px] text-zinc-500 font-mono">Status:</span>
            <div className="flex bg-[#131316] border border-[#1f1f23] rounded-md p-0.5 text-xs font-mono">
              {(['All', 'Active', 'Inactive'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded text-[10px] transition cursor-pointer ${
                    statusFilter === s ? 'bg-blue-600 text-white font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Designations Table */}
        {loading ? (
          <div className="py-12 flex items-center justify-center space-x-2 text-zinc-500 font-mono text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span>Loading designations...</span>
          </div>
        ) : filteredDesignations.length === 0 ? (
          <div className="py-14 text-center bg-[#08080a] border border-[#17171c] rounded-md">
            <Briefcase className="h-9 w-9 text-zinc-700 mx-auto mb-2.5" />
            <p className="text-xs text-zinc-400 font-medium">No designations found.</p>
            <p className="text-[10px] text-zinc-600 mt-1">Click "Define Designation" to add job titles for your staff and operators.</p>
          </div>
        ) : (
          <div className="border border-[#17171c] rounded-lg overflow-hidden bg-[#09090c]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0c0c0f] border-b border-[#1f1f23] text-[10px] text-zinc-400 font-mono tracking-wider uppercase">
                  <th className="py-3 px-4 font-medium">Designation Title</th>
                  <th className="py-3 px-4 font-medium">Code</th>
                  <th className="py-3 px-4 font-medium">Department / Division</th>
                  <th className="py-3 px-4 font-medium">Responsibilities / Scope</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131317] text-xs">
                {filteredDesignations.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.02] transition-all">
                    {/* Title */}
                    <td className="py-3.5 px-4 font-medium text-white">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span>{d.title}</span>
                      </div>
                    </td>
                    {/* Code */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-300">
                      {d.code ? (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200">
                          {d.code}
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    {/* Department */}
                    <td className="py-3.5 px-4 text-zinc-300 font-sans">
                      {d.department ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 text-zinc-500 shrink-0" />
                          <span>{d.department}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-600 font-mono text-[11px]">-</span>
                      )}
                    </td>
                    {/* Description */}
                    <td className="py-3.5 px-4 text-zinc-400 font-sans max-w-sm text-[11px] truncate">
                      {d.description || <span className="text-zinc-600 font-mono">-</span>}
                    </td>
                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold inline-flex items-center gap-1 ${
                        d.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'Active' ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
                        {d.status || 'Active'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEdit(d)}
                          className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-700/60 rounded-md transition cursor-pointer"
                          title="Edit Designation"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteDesignation(d.id, d.title)}
                          className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-md transition cursor-pointer"
                          title="Delete Designation"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DEFINE DESIGNATION MODAL */}
      {showDefineModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#09090c] border border-[#1f1f23] rounded-xl max-w-md w-full p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif text-lg text-white">Define New Designation</h4>
                <p className="text-xs text-zinc-500 font-mono mt-1">Specify official job title and responsibilities.</p>
              </div>
              <button 
                onClick={() => setShowDefineModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDefineDesignation} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Designation Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Agrometeorologist"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Designation Code / Acronym</label>
                  <input
                    type="text"
                    placeholder="e.g. SR-AGRO"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs font-mono"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Department / Division</label>
                <input
                  type="text"
                  placeholder="e.g. Agricultural Meteorology Division"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Description & Key Responsibilities</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Responsible for crop-weather advisories, soil moisture sensor calibration, and agromet bulletin dissemination."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1f1f23] mt-6">
                <button
                  type="button"
                  onClick={() => setShowDefineModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-md font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold cursor-pointer transition shadow-lg shadow-blue-600/20 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Designation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DESIGNATION MODAL */}
      {editingDesignation && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#09090c] border border-[#1f1f23] rounded-xl max-w-md w-full p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif text-lg text-white">Edit Designation</h4>
                <p className="text-xs text-zinc-500 font-mono mt-1">Update designation details and operational status.</p>
              </div>
              <button 
                onClick={() => setEditingDesignation(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Designation Title *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Designation Code</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-400 font-medium">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'Active' | 'Inactive')}
                    className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs font-mono"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Department / Division</label>
                <input
                  type="text"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Description & Scope</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-[#131316] border border-[#1f1f23] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1f1f23] mt-6">
                <button
                  type="button"
                  onClick={() => setEditingDesignation(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-md font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold cursor-pointer transition shadow-lg shadow-blue-600/20 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
