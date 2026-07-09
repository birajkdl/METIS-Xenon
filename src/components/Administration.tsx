import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  UserCheck, 
  Plus, 
  Trash2, 
  Building, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Search,
  ShieldAlert,
  Info
} from 'lucide-react';
import { Sensor, WeatherStation } from '../types.ts';

interface DbUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: string;
  phoneNumber?: string | null;
  assignedStationId: number | null;
  stationName?: string | null;
  username?: string | null;
  designation?: string | null;
  office?: string | null;
  createdAt?: string;
}

interface CustomRole {
  id: number;
  roleName: string;
  description: string | null;
  createdAt?: string;
}

interface AdministrationProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  token: string | null;
  currentUserRole: string | null;
  onRefreshData: () => void;
}

export default function Administration({
  sensors,
  stations,
  token,
  currentUserRole,
  onRefreshData
}: AdministrationProps) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'roles' | 'approvals'>('users');
  
  // Data States
  const [usersList, setUsersList] = useState<DbUser[]>([]);
  const [rolesList, setRolesList] = useState<CustomRole[]>([]);
  const [pendingSensors, setPendingSensors] = useState<Sensor[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Action Feedback States
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Custom Role Form State
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Editing User Privileges Local States
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editStationId, setEditStationId] = useState<string>('unassigned');

  // Load everything
  const loadAdministrationData = async () => {
    if (!token) return;
    setIsLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      // 1. Fetch Users (Only allowed for Super Admin / Head Office)
      const usersRes = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsersList(usersData);
      }

      // 2. Fetch Custom Roles
      const rolesRes = await fetch('/api/roles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRolesList(rolesData);
      }

      // 3. Filter pending sensors from local inventory list, or fetch again
      // We can directly filter the sensors passed down via props where approvalStatus is 'Pending Approval'
      const pending = sensors.filter(s => s.approvalStatus === 'Pending Approval');
      setPendingSensors(pending);

    } catch (err: any) {
      console.error("Failed to load admin data:", err);
      setErrorMsg("Failed to sync system database logs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdministrationData();
  }, [token, sensors]);

  // Handle Role Creation
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!newRoleName.trim()) {
      setErrorMsg("Role name is required.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          roleName: newRoleName.trim(),
          description: newRoleDesc.trim()
        })
      });

      if (res.ok) {
        setSuccessMsg(`Custom security role "${newRoleName}" defined successfully.`);
        setNewRoleName('');
        setNewRoleDesc('');
        // Reload roles
        const rolesRes = await fetch('/api/roles', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setRolesList(rolesData);
        }
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to catalog security privileges.");
      }
    } catch (err: any) {
      setErrorMsg("Network offline or database mismatch.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Role Deletion
  const handleDeleteRole = async (id: number) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this custom security role? Registered terminals matching this role will default to Read-Only.")) {
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/roles/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setSuccessMsg("Custom role purged from database schema.");
        // Reload roles
        const rolesRes = await fetch('/api/roles', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setRolesList(rolesData);
        }
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Cannot purge seeded standard role.");
      }
    } catch (err: any) {
      setErrorMsg("Failed to execute purge transaction.");
    } finally {
      setIsLoading(false);
    }
  };

  // Start Editing a User
  const startEditingUser = (u: DbUser) => {
    setEditingUid(u.uid);
    setEditRole(u.role);
    setEditStationId(u.assignedStationId ? u.assignedStationId.toString() : 'unassigned');
  };

  // Save User Privilege Updates
  const handleSaveUserPrivileges = async (uid: string) => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/users/${uid}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          role: editRole,
          assignedStationId: editStationId === 'unassigned' ? null : parseInt(editStationId)
        })
      });

      if (res.ok) {
        setSuccessMsg("System credentials and permissions synchronized.");
        setEditingUid(null);
        // Reload users
        const usersRes = await fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsersList(usersData);
        }
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to overwrite credentials.");
      }
    } catch (err) {
      setErrorMsg("Database connection timeout.");
    } finally {
      setIsLoading(false);
    }
  };

  // Approve or Reject a Supplier Sensor Catalog Entry
  const handleApproveSensor = async (sensorId: number, action: 'approve' | 'reject') => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/sensors/${sensorId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        setSuccessMsg(`Supplier catalog entry successfully ${action === 'approve' ? 'Approved & Cataloged' : 'Rejected'}.`);
        onRefreshData(); // Tell main app to reload all sensor info
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Action unauthorized or sensor mismatch.");
      }
    } catch (err) {
      setErrorMsg("Database command transmission failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Standard roles list for select box dropdown
  const standardRoles = [
    'Super Administrator',
    'Head Office Admin/User',
    'Regional Office Admin/User',
    'Synoptic/Aero-synoptic office User',
    'Station User (optional)',
    'Read-only/Audit User',
    'Supplier account'
  ];

  // Merge pre-seeded and custom roles to create complete drop-down options list
  const combinedRoles = Array.from(new Set([
    ...standardRoles,
    ...rolesList.map(r => r.roleName)
  ]));

  // Filtering users based on search
  const filteredUsers = usersList.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.displayName && u.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[#1f1f23] pb-6">
        <div>
          <h2 className="text-3xl font-serif text-white tracking-tight">System & Security Console</h2>
          <p className="text-xs text-zinc-400 font-mono mt-1">Role-Based Access Control (RBAC) & Catalog Ingestion Validation</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md text-xs font-mono font-medium flex items-center space-x-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Role: {currentUserRole || 'Read-only/Audit User'}</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center space-x-2 animate-slide-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center space-x-2 animate-slide-in">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sub tabs navigation */}
      <div className="flex border-b border-[#1f1f23] space-x-6">
        <button
          onClick={() => { setActiveSubTab('users'); setSuccessMsg(null); setErrorMsg(null); }}
          className={`pb-3 text-xs font-mono tracking-wider uppercase font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'users' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          User Directories ({usersList.length})
        </button>
        <button
          onClick={() => { setActiveSubTab('roles'); setSuccessMsg(null); setErrorMsg(null); }}
          className={`pb-3 text-xs font-mono tracking-wider uppercase font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'roles' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Security Policies ({rolesList.length})
        </button>
        <button
          onClick={() => { setActiveSubTab('approvals'); setSuccessMsg(null); setErrorMsg(null); }}
          className={`pb-3 text-xs font-mono tracking-wider uppercase font-semibold border-b-2 transition-all cursor-pointer relative ${
            activeSubTab === 'approvals' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Supplier Approvals
          {pendingSensors.length > 0 && (
            <span className="absolute -top-1.5 -right-3 px-1.5 py-0.5 bg-amber-500 text-black text-[9px] font-bold rounded-full">
              {pendingSensors.length}
            </span>
          )}
        </button>
      </div>

      {/* SUB-TAB: USER PRIVILEGE DIRECTORY */}
      {activeSubTab === 'users' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search operators, terminals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[#0d0d10] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-blue-500 w-full"
              />
            </div>
            {isLoading && (
              <div className="text-zinc-500 text-xs font-mono flex items-center space-x-1">
                <div className="w-3 h-3 border border-zinc-500 border-t-white rounded-full animate-spin"></div>
                <span>Syncing node...</span>
              </div>
            )}
          </div>

          <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0f0f12] border-b border-[#1f1f23] text-[10px] text-zinc-400 font-mono tracking-wider uppercase">
                  <th className="py-4 px-6 font-medium">Terminal operator / Email</th>
                  <th className="py-4 px-6 font-medium">Clearance level (Role)</th>
                  <th className="py-4 px-6 font-medium">Terminal Bound (Station)</th>
                  <th className="py-4 px-6 font-medium text-right">Security Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#17171c] text-xs">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-zinc-500 font-mono">
                      No terminal records matching secure search hash.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isEditing = editingUid === u.uid;
                    return (
                      <tr key={u.uid} className="hover:bg-white/[0.01] transition-all">
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400 shrink-0">
                              {u.username ? u.username.substring(0, 1).toUpperCase() : u.displayName ? u.displayName.substring(0, 1).toUpperCase() : u.email.substring(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{u.username || u.displayName || "Station Operator"}</p>
                              <p className="text-[10px] text-zinc-500 font-mono">{u.email}</p>
                              <div className="flex flex-col space-y-0.5 mt-1">
                                {u.phoneNumber && (
                                  <span className="text-[10px] text-blue-400 font-mono">
                                    📞 {u.phoneNumber}
                                  </span>
                                )}
                                {u.designation && (
                                  <span className="text-[10px] text-zinc-400 font-mono">
                                    💼 {u.designation}
                                  </span>
                                )}
                                {u.office && (
                                  <span className="text-[10px] text-emerald-400 font-mono">
                                    🏢 {u.office}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {isEditing ? (
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value)}
                              className="bg-[#0c0c0f] border border-[#232329] text-white text-xs rounded-lg p-1.5 focus:outline-hidden focus:border-blue-500"
                            >
                              {combinedRoles.map((roleOpt) => (
                                <option key={roleOpt} value={roleOpt}>
                                  {roleOpt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wide font-semibold inline-block ${
                              u.role === 'Super Administrator'
                                ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                : u.role === 'Head Office Admin/User'
                                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                                : u.role === 'Supplier account'
                                ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400'
                                : 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-400'
                            }`}>
                              {u.role}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {isEditing ? (
                            <select
                              value={editStationId}
                              onChange={(e) => setEditStationId(e.target.value)}
                              disabled={editRole !== 'Station User (optional)' && editRole !== 'Synoptic/Aero-synoptic office User'}
                              className="bg-[#0c0c0f] border border-[#232329] text-white text-xs rounded-lg p-1.5 focus:outline-hidden focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <option value="unassigned">All Stations / Unassigned</option>
                              {stations.map((st) => (
                                <option key={st.stationId} value={st.stationId}>
                                  {st.stationName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-mono text-[11px] text-zinc-400 flex items-center space-x-1">
                              <Building className="h-3.5 w-3.5 text-zinc-500" />
                              <span>{u.stationName || "All Stations / Global"}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {currentUserRole === 'Super Administrator' ? (
                            isEditing ? (
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => handleSaveUserPrivileges(u.uid)}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-[11px] font-semibold transition-all cursor-pointer"
                                >
                                  Save Logs
                                </button>
                                <button
                                  onClick={() => setEditingUid(null)}
                                  className="px-3 py-1 bg-[#16161c] hover:bg-[#23232e] text-zinc-400 border border-[#25252d] rounded-md text-[11px] font-semibold transition-all cursor-pointer"
                                >
                                  Abort
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditingUser(u)}
                                className="px-3 py-1.5 bg-[#0e0e12] hover:bg-[#1a1a24] text-zinc-300 border border-[#1f1f26] rounded-md text-[11px] font-semibold font-mono tracking-wide transition-all cursor-pointer"
                              >
                                Edit Clearance
                              </button>
                            )
                          ) : (
                            <span className="text-[10px] text-zinc-500 font-mono">No super privileges</span>
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
      )}

      {/* SUB-TAB: CUSTOM ROLES DEFINITION */}
      {activeSubTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* New Custom Role Creator Form */}
          <div className="lg:col-span-1">
            <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-xl p-6 space-y-6">
              <div>
                <h3 className="font-serif text-lg text-white">Define Custom Role</h3>
                <p className="text-zinc-500 text-xs mt-1">Register additional granular access clearances to current domain.</p>
              </div>

              {currentUserRole === 'Super Administrator' ? (
                <form onSubmit={handleCreateRole} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Access Clearance Title (Role Name)</label>
                    <input
                      type="text"
                      placeholder="e.g. Regional Inspector"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Clearance Description</label>
                    <textarea
                      placeholder="Detailed scope of responsibility..."
                      value={newRoleDesc}
                      onChange={(e) => setNewRoleDesc(e.target.value)}
                      rows={4}
                      className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs cursor-pointer transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Catalog Role Definition</span>
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 text-yellow-500 rounded-lg text-xs flex items-start space-x-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Authorization Blocked</p>
                    <p className="text-zinc-500 mt-1">Only Super Administrators can define new domain access rules.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Custom Roles List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 font-mono">Custom Clearance Protocols</h3>
            <div className="space-y-3">
              {rolesList.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#1f1f23] rounded-xl text-zinc-500 font-mono text-xs">
                  No custom clearances defined. Operating strictly on seeded core standards.
                </div>
              ) : (
                rolesList.map((role) => {
                  const isPreSeeded = standardRoles.includes(role.roleName);
                  return (
                    <div key={role.id} className="p-4 bg-[#0b0b0e] border border-[#1f1f23] rounded-xl flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-semibold text-xs font-mono">{role.roleName}</span>
                          {isPreSeeded ? (
                            <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] font-mono rounded-md uppercase font-bold">Standard</span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[8px] font-mono rounded-md uppercase font-bold">Custom</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">{role.description || "No description cataloged."}</p>
                      </div>
                      {!isPreSeeded && currentUserRole === 'Super Administrator' && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="p-1.5 bg-[#141419] hover:bg-red-950/20 text-zinc-500 hover:text-red-400 border border-[#1f1f26] rounded-md transition-all cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: SUPPLIER PENDING APPROVALS */}
      {activeSubTab === 'approvals' && (
        <div className="space-y-6">
          <div>
            <h3 className="font-serif text-lg text-white">Ingestion Queue (Supplier Submissions)</h3>
            <p className="text-zinc-500 text-xs mt-1">Approve or reject cataloged sensors registered via Supplier clearance levels.</p>
          </div>

          <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0f0f12] border-b border-[#1f1f23] text-[10px] text-zinc-400 font-mono tracking-wider uppercase">
                  <th className="py-4 px-6 font-medium">Sensor Details</th>
                  <th className="py-4 px-6 font-medium">Manufacturer / Model</th>
                  <th className="py-4 px-6 font-medium">Supplier Info</th>
                  <th className="py-4 px-6 font-medium text-right">Inbound Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#17171c] text-xs">
                {pendingSensors.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-zinc-500 font-mono">
                      Ingestion queue is clear. No inbound supplier entries pending validation.
                    </td>
                  </tr>
                ) : (
                  pendingSensors.map((s) => (
                    <tr key={s.sensorId} className="hover:bg-white/[0.01] transition-all">
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold text-white">{s.sensorType}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">ID: S-GRID-{s.sensorId.toString().padStart(4, '0')}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-[11px] text-zinc-300">
                        <p>{s.manufacturer}</p>
                        <p className="text-[9px] text-zinc-500">M/N: {s.modelNumber || "N/A"}</p>
                      </td>
                      <td className="py-4 px-6 text-zinc-400">
                        <p>{s.supplierDetails || "Unspecified Supplier"}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">Invoice: {s.invoiceReference || "N/A"}</p>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {currentUserRole === 'Super Administrator' || currentUserRole === 'Head Office Admin/User' ? (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleApproveSensor(s.sensorId, 'approve')}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-semibold font-mono tracking-wide flex items-center space-x-1 cursor-pointer transition-all"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Ingest (Approve)</span>
                            </button>
                            <button
                              onClick={() => handleApproveSensor(s.sensorId, 'reject')}
                              className="px-3 py-1 bg-red-950/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-900/30 rounded-md text-[11px] font-semibold font-mono tracking-wide flex items-center space-x-1 cursor-pointer transition-all"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-mono">Review privileges required</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
