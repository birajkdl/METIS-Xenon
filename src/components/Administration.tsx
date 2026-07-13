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
  Info,
  Edit2,
  Save,
  X,
  Lock
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
  readPermission: boolean;
  writePermission: boolean;
  editPermission: boolean;
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

  // Roles Tab Sub-tab State
  const [rolesSubTab, setRolesSubTab] = useState<'roles' | 'add'>('roles');

  // Users Tab Sub-tab State
  const [usersSubTab, setUsersSubTab] = useState<'users' | 'add'>('users');

  // New Programmatic User Form State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserDesignation, setNewUserDesignation] = useState('');
  const [newUserOffice, setNewUserOffice] = useState('');
  const [newUserRole, setNewUserRole] = useState('Read-only/Audit User');
  const [newUserStationId, setNewUserStationId] = useState('unassigned');

  // New Custom Role Form State
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleRead, setNewRoleRead] = useState(true);
  const [newRoleWrite, setNewRoleWrite] = useState(false);
  const [newRoleEdit, setNewRoleEdit] = useState(false);

  // Editing Custom Role Local States
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDesc, setEditRoleDesc] = useState('');
  const [editRoleRead, setEditRoleRead] = useState(true);
  const [editRoleWrite, setEditRoleWrite] = useState(false);
  const [editRoleEdit, setEditRoleEdit] = useState(false);

  // Editing User Privileges Local States
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editStationId, setEditStationId] = useState<string>('unassigned');
  const [editOffice, setEditOffice] = useState('');
  const [regionalOfficesList, setRegionalOfficesList] = useState<any[]>([]);

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

      // Fetch Regional Offices
      try {
        const roRes = await fetch('/api/regional-offices', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (roRes.ok) {
          const roData = await roRes.json();
          setRegionalOfficesList(roData);
        }
      } catch (err) {
        console.error("Failed to load regional offices in admin:", err);
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
          description: newRoleDesc.trim(),
          readPermission: newRoleRead,
          writePermission: newRoleWrite,
          editPermission: newRoleEdit
        })
      });

      if (res.ok) {
        setSuccessMsg(`Custom security role "${newRoleName}" defined successfully.`);
        setNewRoleName('');
        setNewRoleDesc('');
        setNewRoleRead(true);
        setNewRoleWrite(false);
        setNewRoleEdit(false);
        setRolesSubTab('roles');
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

  // Handle programmatic user registration
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      setErrorMsg("Email and password are required.");
      return;
    }
    if (newUserPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          password: newUserPassword,
          username: newUsername.trim() || null,
          phoneNumber: newUserPhone.trim() || null,
          designation: newUserDesignation.trim() || null,
          office: newUserOffice.trim() || null,
          role: newUserRole,
          assignedStationId: newUserStationId !== 'unassigned' ? parseInt(newUserStationId) : null
        })
      });

      if (res.ok) {
        const created = await res.json();
        setSuccessMsg(`User account "${created.email}" created successfully.`);
        // Reset states
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUsername('');
        setNewUserPhone('');
        setNewUserDesignation('');
        setNewUserOffice('');
        setNewUserRole('Read-only/Audit User');
        setNewUserStationId('unassigned');
        
        // Go back to listing tab
        setUsersSubTab('users');

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
        setErrorMsg(data.error || "Failed to create user account.");
      }
    } catch (err: any) {
      console.error("Failed to create user:", err);
      setErrorMsg("Failed to connect to directory database.");
    } finally {
      setIsLoading(false);
    }
  };

  // Start Editing Custom Role
  const startEditingRole = (role: CustomRole) => {
    setEditingRoleId(role.id);
    setEditRoleName(role.roleName);
    setEditRoleDesc(role.description || '');
    setEditRoleRead(role.readPermission);
    setEditRoleWrite(role.writePermission);
    setEditRoleEdit(role.editPermission);
  };

  // Save Custom Role Updates
  const handleSaveRole = async (id: number) => {
    if (!token) return;
    if (!editRoleName.trim()) {
      setErrorMsg("Role name is required.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/roles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          roleName: editRoleName.trim(),
          description: editRoleDesc.trim(),
          readPermission: editRoleRead,
          writePermission: editRoleWrite,
          editPermission: editRoleEdit
        })
      });

      if (res.ok) {
        setSuccessMsg(`Custom role "${editRoleName}" updated successfully.`);
        setEditingRoleId(null);
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
        setErrorMsg(data.error || "Failed to update custom role.");
      }
    } catch (err: any) {
      setErrorMsg("Failed to execute update transaction.");
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
    setEditOffice(u.office || '');
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
          assignedStationId: editStationId === 'unassigned' ? null : parseInt(editStationId),
          office: editOffice
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
    'Technician',
    'Authorized Signatory',
    'Read-only/Audit User',
    'Supplier account'
  ];

  // Helper for standard roles default permissions mapping
  const getRolePermissions = (roleName: string) => {
    switch (roleName) {
      case 'Super Administrator':
        return {
          description: 'Full system clearance including credential rewriting, user authorization, and system diagnostics.',
          read: true,
          write: true,
          edit: true,
          isStandard: true,
          id: null
        };
      case 'Head Office Admin/User':
        return {
          description: 'Metrology department administrative clearance. Manage inventory, calibrations, and transfer validations.',
          read: true,
          write: true,
          edit: true,
          isStandard: true,
          id: null
        };
      case 'Regional Office Admin/User':
        return {
          description: 'Regional metrology oversight. Local inventory edits, and station performance auditing.',
          read: true,
          write: true,
          edit: true,
          isStandard: true,
          id: null
        };
      case 'Synoptic/Aero-synoptic office User':
        return {
          description: 'Observatory operator clearance. Records surface synoptic parameters and local sensors diagnostics.',
          read: true,
          write: true,
          edit: false,
          isStandard: true,
          id: null
        };
      case 'Station User (optional)':
        return {
          description: 'On-site observer account. Read-only logs plus local meteorological notes insertion.',
          read: true,
          write: false,
          edit: false,
          isStandard: true,
          id: null
        };
      case 'Technician':
        return {
          description: 'Engineering technician clearance. Conduct physical calibration readings and upload maintenance logs.',
          read: true,
          write: true,
          edit: true,
          isStandard: true,
          id: null
        };
      case 'Authorized Signatory':
        return {
          description: 'Formal signatory clearance. Certify and sign calibration certificates under ISO/IEC 17025 rules.',
          read: true,
          write: true,
          edit: false,
          isStandard: true,
          id: null
        };
      case 'Read-only/Audit User':
        return {
          description: 'Auditor profile. Read-only terminal access to entire meteorological system database.',
          read: true,
          write: false,
          edit: false,
          isStandard: true,
          id: null
        };
      case 'Supplier account':
        return {
          description: 'External manufacturer credentials. Catalog pending sensor entries for department review.',
          read: true,
          write: true,
          edit: false,
          isStandard: true,
          id: null
        };
      default:
        return {
          description: 'Custom security permission level.',
          read: true,
          write: false,
          edit: false,
          isStandard: false,
          id: null
        };
    }
  };

  const allRolesWithPerms = [
    ...standardRoles.map(rName => ({
      roleName: rName,
      ...getRolePermissions(rName)
    })),
    ...rolesList.filter(cr => !standardRoles.includes(cr.roleName)).map(cr => ({
      roleName: cr.roleName,
      description: cr.description,
      read: cr.readPermission,
      write: cr.writePermission,
      edit: cr.editPermission,
      isStandard: false,
      id: cr.id
    }))
  ];

  // Merge pre-seeded and custom roles to create complete drop-down options list
  const combinedRoles = Array.from(new Set([
    ...standardRoles,
    ...rolesList.map(r => r.roleName)
  ]));

  // Helper to determine if current user has read, write, and edit permissions
  const currentUserHasAllPermissions = (() => {
    if (!currentUserRole) return false;
    const standardAll = ['Super Administrator', 'Head Office Admin/User', 'Regional Office Admin/User', 'Technician'];
    if (standardAll.includes(currentUserRole)) {
      return true;
    }
    const customMatch = rolesList.find(r => r.roleName === currentUserRole);
    if (customMatch) {
      return customMatch.readPermission && customMatch.writePermission && customMatch.editPermission;
    }
    return false;
  })();

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
          Roles ({standardRoles.length + rolesList.length})
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
          {/* Inner nested tab headers */}
          {currentUserHasAllPermissions && (
            <div className="flex items-center space-x-6 border-b border-[#1f1f23] pb-2">
              <button
                onClick={() => setUsersSubTab('users')}
                className={`pb-2 text-xs font-mono tracking-wider uppercase font-semibold border-b-2 transition-all cursor-pointer ${
                  usersSubTab === 'users' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Directories
              </button>
              <button
                onClick={() => setUsersSubTab('add')}
                className={`pb-2 text-xs font-mono tracking-wider uppercase font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
                  usersSubTab === 'add' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>ADD User</span>
              </button>
            </div>
          )}

          {usersSubTab === 'users' && (
            <>
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
                                <div className="space-y-2 max-w-[200px]">
                                  <select
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value)}
                                    className="bg-[#0c0c0f] border border-[#232329] text-white text-xs rounded-lg p-1.5 focus:outline-hidden focus:border-blue-500 w-full"
                                  >
                                    {combinedRoles.map((roleOpt) => (
                                      <option key={roleOpt} value={roleOpt}>
                                        {roleOpt}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    list="edit-user-offices"
                                    placeholder="Office/Branch Name"
                                    value={editOffice}
                                    onChange={(e) => setEditOffice(e.target.value)}
                                    className="bg-[#0c0c0f] border border-[#232329] text-white text-xs rounded-lg p-1.5 focus:outline-hidden focus:border-blue-500 w-full"
                                  />
                                  <datalist id="edit-user-offices">
                                    {regionalOfficesList.map(o => (
                                      <option key={o.id} value={o.officeName} />
                                    ))}
                                  </datalist>
                                </div>
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
            </>
          )}

          {/* NESTED VIEW: ADD USER FORM */}
          {usersSubTab === 'add' && currentUserHasAllPermissions && (
            <div className="max-w-xl bg-[#0b0b0e] border border-[#1f1f23] rounded-xl p-6 space-y-6 animate-fade-in">
              <div>
                <h3 className="font-serif text-lg text-white">Create New Operator Account</h3>
                <p className="text-zinc-500 text-xs mt-1">Register a new terminal operator profile with custom credentials and security clearance role.</p>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Username / Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +977 98XXXXXXXX"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Email Address *</label>
                    <input
                      type="email"
                      placeholder="e.g. user@domain.com"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Initial Password * (min 6 characters)</label>
                    <input
                      type="password"
                      placeholder="••••••"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Designation / Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Meteorologist"
                      value={newUserDesignation}
                      onChange={(e) => setNewUserDesignation(e.target.value)}
                      className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Office / Branch</label>
                    <input
                      type="text"
                      list="create-user-offices"
                      placeholder="e.g. Kathmandu AWS Branch"
                      value={newUserOffice}
                      onChange={(e) => setNewUserOffice(e.target.value)}
                      className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500"
                    />
                    <datalist id="create-user-offices">
                      {regionalOfficesList.map(o => (
                        <option key={o.id} value={o.officeName} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Security Clearance Role</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500"
                    >
                      {combinedRoles.map((roleOpt) => (
                        <option key={roleOpt} value={roleOpt}>
                          {roleOpt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Assigned Weather Station</label>
                    <select
                      value={newUserStationId}
                      onChange={(e) => setNewUserStationId(e.target.value)}
                      disabled={newUserRole !== 'Station User (optional)' && newUserRole !== 'Synoptic/Aero-synoptic office User'}
                      className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed font-mono"
                    >
                      <option value="unassigned">All Stations / Unassigned</option>
                      {stations.map((st) => (
                        <option key={st.stationId} value={st.stationId}>
                          {st.stationName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs cursor-pointer transition-all disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Account</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: ROLES CONSOLE */}
      {activeSubTab === 'roles' && (
        <div className="space-y-6 animate-fade-in">
          {/* Inner nested tab headers */}
          <div className="flex items-center space-x-6 border-b border-[#1f1f23] pb-2">
            <button
              onClick={() => setRolesSubTab('roles')}
              className={`pb-2 text-xs font-mono tracking-wider uppercase font-semibold border-b-2 transition-all cursor-pointer ${
                rolesSubTab === 'roles' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Roles
            </button>
            <button
              onClick={() => setRolesSubTab('add')}
              className={`pb-2 text-xs font-mono tracking-wider uppercase font-semibold border-b-2 transition-all cursor-pointer ${
                rolesSubTab === 'add' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Add roles
            </button>
          </div>

          {/* NESTED VIEW: ROLES LISTING TABLE */}
          {rolesSubTab === 'roles' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-lg text-white">Security Clearance Roles</h3>
                <p className="text-zinc-500 text-xs mt-1">Review system privilege configurations across standard pre-seeded roles and custom security protocols.</p>
              </div>

              <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0f0f12] border-b border-[#1f1f23] text-[10px] text-zinc-400 font-mono tracking-wider uppercase">
                      <th className="py-4 px-6 font-medium w-1/4">Role Name</th>
                      <th className="py-4 px-6 font-medium w-1/3">Description</th>
                      <th className="py-4 px-6 font-medium text-center w-1/12">Read</th>
                      <th className="py-4 px-6 font-medium text-center w-1/12">Write</th>
                      <th className="py-4 px-6 font-medium text-center w-1/12">Edit</th>
                      <th className="py-4 px-6 font-medium text-right w-1/6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#17171c] text-xs">
                    {allRolesWithPerms.map((r) => {
                      const isEditing = editingRoleId === r.id && r.id !== null;
                      return (
                        <tr key={r.roleName} className="hover:bg-white/[0.01] transition-all">
                          {/* Column 1: Role */}
                          <td className="py-4 px-6">
                            {isEditing ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={editRoleName}
                                  onChange={(e) => setEditRoleName(e.target.value)}
                                  className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2 rounded-lg focus:outline-hidden focus:border-blue-500 font-semibold text-xs"
                                  placeholder="Role Title"
                                />
                                <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[8px] font-mono rounded-md uppercase font-bold inline-block">Editing</span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="font-semibold text-white text-xs block">{r.roleName}</span>
                                {r.isStandard ? (
                                  <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] font-mono rounded-md uppercase font-bold inline-block">Standard</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[8px] font-mono rounded-md uppercase font-bold inline-block">Custom</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Column 2: Description */}
                          <td className="py-4 px-6 text-zinc-400">
                            {isEditing ? (
                              <textarea
                                value={editRoleDesc}
                                onChange={(e) => setEditRoleDesc(e.target.value)}
                                rows={2}
                                className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2 rounded-lg focus:outline-hidden focus:border-blue-500 text-xs"
                                placeholder="Clearance description..."
                              />
                            ) : (
                              <span>{r.description || 'No description cataloged.'}</span>
                            )}
                          </td>

                          {/* Column 3: Read */}
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center">
                              {isEditing ? (
                                <input
                                  type="checkbox"
                                  checked={editRoleRead}
                                  onChange={(e) => setEditRoleRead(e.target.checked)}
                                  className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                                />
                              ) : (
                                <div className="flex items-center justify-center">
                                  {r.read ? (
                                    <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold" title="Read Access Granted">
                                      ✓
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-md bg-zinc-800/20 border border-zinc-800/40 flex items-center justify-center text-zinc-600" title="Read Access Revoked">
                                      -
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Column 4: Write */}
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center">
                              {isEditing ? (
                                <input
                                  type="checkbox"
                                  checked={editRoleWrite}
                                  onChange={(e) => setEditRoleWrite(e.target.checked)}
                                  className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                                />
                              ) : (
                                <div className="flex items-center justify-center">
                                  {r.write ? (
                                    <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold" title="Write Access Granted">
                                      ✓
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-md bg-zinc-800/20 border border-zinc-800/40 flex items-center justify-center text-zinc-600" title="Write Access Revoked">
                                      -
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Column 5: Edit */}
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center">
                              {isEditing ? (
                                <input
                                  type="checkbox"
                                  checked={editRoleEdit}
                                  onChange={(e) => setEditRoleEdit(e.target.checked)}
                                  className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                                />
                              ) : (
                                <div className="flex items-center justify-center">
                                  {r.edit ? (
                                    <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold" title="Edit Access Granted">
                                      ✓
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-md bg-zinc-800/20 border border-zinc-800/40 flex items-center justify-center text-zinc-600" title="Edit Access Revoked">
                                      -
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Column 6: Actions */}
                          <td className="py-4 px-6 text-right">
                            {currentUserRole === 'Super Administrator' ? (
                              isEditing ? (
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={() => handleSaveRole(r.id!)}
                                    className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-all cursor-pointer"
                                    title="Save Updates"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingRoleId(null)}
                                    className="p-1.5 bg-[#16161c] hover:bg-[#23232e] text-zinc-400 border border-[#25252d] rounded-md transition-all cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end space-x-1.5">
                                  {!r.isStandard && (
                                    <>
                                      <button
                                        onClick={() => {
                                          const originalRoleObj = rolesList.find(cr => cr.id === r.id);
                                          if (originalRoleObj) startEditingRole(originalRoleObj);
                                        }}
                                        className="p-1.5 bg-[#0e0e12] hover:bg-[#1a1a24] text-zinc-400 hover:text-white border border-[#1f1f26] rounded-md transition-all cursor-pointer"
                                        title="Edit Role"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteRole(r.id!)}
                                        className="p-1.5 bg-[#141419] hover:bg-red-950/20 text-zinc-500 hover:text-red-400 border border-[#1f1f26] rounded-md transition-all cursor-pointer"
                                        title="Delete Role"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                  {r.isStandard && (
                                    <div className="flex items-center space-x-1 text-[10px] text-zinc-500 font-mono italic">
                                      <Lock className="h-3 w-3" />
                                      <span>Protected</span>
                                    </div>
                                  )}
                                </div>
                              )
                            ) : (
                              <span className="text-[10px] text-zinc-500 font-mono">View Only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* NESTED VIEW: ADD ROLES FORM */}
          {rolesSubTab === 'add' && (
            <div className="max-w-xl bg-[#0b0b0e] border border-[#1f1f23] rounded-xl p-6 space-y-6">
              <div>
                <h3 className="font-serif text-lg text-white">Define Custom Role</h3>
                <p className="text-zinc-500 text-xs mt-1">Register additional granular access clearances to current domain.</p>
              </div>

              {currentUserRole === 'Super Administrator' ? (
                <form onSubmit={handleCreateRole} className="space-y-5 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Access Clearance Title (Role Name)</label>
                    <input
                      type="text"
                      placeholder="e.g. Regional Inspector"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="w-full bg-[#0d0d10] border border-[#232329] text-white p-2.5 rounded-lg focus:outline-hidden focus:border-blue-500 font-mono"
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

                  {/* Tick boxes for granting permissions */}
                  <div className="bg-[#0e0e12] border border-[#1f1f23] rounded-lg p-4 space-y-4">
                    <p className="font-semibold text-white text-xs uppercase tracking-wider font-mono mb-2 text-zinc-300">Granted Privileges</p>
                    
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        id="newRoleRead"
                        checked={newRoleRead}
                        onChange={(e) => setNewRoleRead(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4 mt-0.5"
                      />
                      <label htmlFor="newRoleRead" className="text-zinc-300 font-medium cursor-pointer">
                        <span className="block text-white font-semibold">Read Permission (Column 3)</span>
                        <span className="text-zinc-500 text-[10px] font-normal font-mono block mt-0.5">Authorize node viewing, standard telemetry read-outs, and directory audit trails.</span>
                      </label>
                    </div>

                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        id="newRoleWrite"
                        checked={newRoleWrite}
                        onChange={(e) => setNewRoleWrite(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4 mt-0.5"
                      />
                      <label htmlFor="newRoleWrite" className="text-zinc-300 font-medium cursor-pointer">
                        <span className="block text-white font-semibold">Write Permission (Column 4)</span>
                        <span className="text-zinc-500 text-[10px] font-normal font-mono block mt-0.5">Authorize terminal logging edits, adding sensors, and calibration recordings.</span>
                      </label>
                    </div>

                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        id="newRoleEdit"
                        checked={newRoleEdit}
                        onChange={(e) => setNewRoleEdit(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4 mt-0.5"
                      />
                      <label htmlFor="newRoleEdit" className="text-zinc-300 font-medium cursor-pointer">
                        <span className="block text-white font-semibold">Edit Permission (Column 5)</span>
                        <span className="text-zinc-500 text-[10px] font-normal font-mono block mt-0.5">Authorize user management, custom roles overriding, and core policy updates.</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs cursor-pointer transition-all"
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
          )}
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
