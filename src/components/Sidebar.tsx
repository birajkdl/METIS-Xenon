import React from 'react';
import { 
  Wind, 
  LayoutDashboard, 
  Layers, 
  LogIn, 
  LogOut, 
  CloudSun, 
  User as UserIcon,
  ShieldCheck,
  Compass,
  Bell,
  ClipboardCheck,
  Activity,
  History,
  Truck,
  QrCode,
  Shield,
  MapPin,
  Sun,
  Moon,
  Mail,
  BarChart3,
  Handshake,
  ChevronLeft,
  FolderOpen
} from 'lucide-react';
import { User } from 'firebase/auth';

interface SidebarProps {
  activeView: 'dashboard' | 'inventory' | 'alerts' | 'registration' | 'status-tracking' | 'deployments' | 'transfers' | 'administration' | 'warranty' | 'gis' | 'notifications' | 'reports' | 'audit' | 'suppliers' | 'requisitions' | 'stations' | 'documents';
  setActiveView: (view: 'dashboard' | 'inventory' | 'alerts' | 'registration' | 'status-tracking' | 'deployments' | 'transfers' | 'administration' | 'warranty' | 'gis' | 'notifications' | 'reports' | 'audit' | 'suppliers' | 'requisitions' | 'stations' | 'documents') => void;
  user: User | null;
  role: string | null;
  onLogin: () => void;
  onLogout: () => void;
  loadingAuth: boolean;
  onOpenQRScanner: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  activeView,
  setActiveView,
  user,
  role,
  onLogin,
  onLogout,
  loadingAuth,
  onOpenQRScanner,
  theme,
  toggleTheme,
  isCollapsed,
  onToggleCollapse
}: SidebarProps) {
  return (
    <aside className={`transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 overflow-hidden border-r-0' : 'w-64'} bg-[#0a0a0c] text-[#d4d4d8] flex flex-col border-r border-[#1f1f23] shrink-0 h-screen sticky top-0`}>
      {/* Brand Header */}
      <div className="p-8 border-b border-[#1f1f23] flex items-center justify-between bg-[#0a0a0c]">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg text-white shadow-md shadow-blue-600/30">
            <Wind className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-serif italic text-lg tracking-wide text-white leading-none">METIS</h1>
            <span className="text-[9px] text-zinc-500 tracking-[0.2em] font-sans font-bold mt-1 block">By Biraj</span>
          </div>
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition cursor-pointer flex items-center justify-center shrink-0 border border-transparent hover:border-zinc-700"
          title="Collapse Sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-4 py-8 space-y-6 overflow-y-auto">
        <div>
          <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3">Management</p>
          <div className="space-y-1.5">
            <button
              id="nav-dashboard-btn"
              onClick={() => setActiveView('dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'dashboard'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Dashboard</span>
            </button>

            <button
              id="nav-gis-btn"
              onClick={() => setActiveView('gis')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'gis'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <MapPin className="h-4 w-4 shrink-0 text-blue-400" />
              <span>Interactive GIS Map</span>
            </button>

            <button
              id="nav-stations-btn"
              onClick={() => setActiveView('stations')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'stations'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Compass className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Stations Network</span>
            </button>

            <button
              id="nav-inventory-btn"
              onClick={() => setActiveView('inventory')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'inventory'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Layers className="h-4 w-4 shrink-0" />
              <span>Inventory Master List</span>
            </button>

            <button
              id="nav-registration-btn"
              onClick={() => setActiveView('registration')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'registration'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <ClipboardCheck className="h-4 w-4 shrink-0 text-blue-500" />
              <span>Sensor Registration</span>
            </button>

            <button
              id="nav-status-tracking-btn"
              onClick={() => setActiveView('status-tracking')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'status-tracking'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Activity className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>Sensor Status Tracking</span>
            </button>

            <button
              id="nav-deployments-btn"
              onClick={() => setActiveView('deployments')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'deployments'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <History className="h-4 w-4 shrink-0 text-indigo-400" />
              <span>Deployment Record</span>
            </button>

            <button
              id="nav-transfers-btn"
              onClick={() => setActiveView('transfers')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'transfers'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Truck className="h-4 w-4 shrink-0 text-amber-500" />
              <span>Transfer Management</span>
            </button>

            <button
              id="nav-warranty-btn"
              onClick={() => setActiveView('warranty')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'warranty'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Shield className="h-4 w-4 shrink-0 text-blue-400" />
              <span>Warranty Management</span>
            </button>

            <button
              id="nav-suppliers-btn"
              onClick={() => setActiveView('suppliers')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'suppliers'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Handshake className="h-4 w-4 shrink-0 text-sky-400" />
              <span>Suppliers & Partners</span>
            </button>

            <button
              id="nav-alerts-btn"
              onClick={() => setActiveView('alerts')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'alerts'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Bell className="h-4 w-4 shrink-0 text-amber-500" />
              <span>Active Alerts</span>
            </button>

            <button
              id="nav-notifications-btn"
              onClick={() => setActiveView('notifications')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'notifications'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Mail className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Email & Alert Control</span>
            </button>

            <button
              id="nav-documents-btn"
              onClick={() => setActiveView('documents')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'documents'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-blue-400" />
              <span>Documents Registry</span>
            </button>

            <button
              id="nav-reports-btn"
              onClick={() => setActiveView('reports')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'reports'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <BarChart3 className="h-4 w-4 shrink-0 text-blue-400 animate-pulse" />
              <span className="font-semibold text-blue-300">Search, Filter & Reports</span>
            </button>

            {(role === 'Super Administrator' || role === 'Head Office Admin/User') && (
              <button
                id="nav-administration-btn"
                onClick={() => setActiveView('administration')}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                  activeView === 'administration'
                    ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                    : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-blue-500" />
                <span>Security Console</span>
              </button>
            )}

            {user && (
              <button
                id="nav-audit-btn"
                onClick={() => setActiveView('audit')}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                  activeView === 'audit'
                    ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                    : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <History className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Audit Trail & Logs</span>
              </button>
            )}

            {/* Quick scan utility */}
            <button
              id="nav-scan-qr-btn"
              onClick={onOpenQRScanner}
              className="w-full flex items-center space-x-3 px-4 py-2.5 mt-2 rounded-md text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.02] border border-dashed border-[#1f1f23] hover:border-blue-500/50 transition-all duration-200 cursor-pointer"
            >
              <QrCode className="h-4 w-4 shrink-0 text-blue-400 animate-pulse" />
              <span>Scan Sensor QR</span>
            </button>
          </div>
        </div>

        <div>
          <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3">Diagnostics</p>
          <div className="mt-2 px-3 py-2.5 bg-[#0f0f12] rounded-md border border-[#1f1f23] flex items-center space-x-2 text-[10px] text-zinc-500 font-mono">
            <Compass className="h-3.5 w-3.5 text-emerald-500 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Node: SQL-CLUST-01</span>
          </div>
        </div>

        <div className="mt-4">
          <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3">Outdoor Readability</p>
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="w-full mt-2 flex items-center justify-between px-3 py-2.5 bg-[#0f0f12] hover:bg-white/[0.04] rounded-md border border-[#1f1f23] text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer shadow-xs"
            title="Toggle High-Contrast Light Mode for daytime outdoor site inspections"
          >
            <div className="flex items-center space-x-2">
              {theme === 'light' ? (
                <Sun className="h-4 w-4 text-amber-500 animate-pulse" />
              ) : (
                <Moon className="h-4 w-4 text-blue-400" />
              )}
              <span className="font-mono">
                {theme === 'light' ? 'Light Mode (Active)' : 'Sleek Dark Mode'}
              </span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-600/10 text-blue-400 rounded-sm border border-blue-500/20 uppercase tracking-wide">
              {theme === 'light' ? 'Day' : 'Night'}
            </span>
          </button>
        </div>
      </div>

      {/* Authentication and Profile Panel */}
      <div className="p-6 border-t border-[#1f1f23] bg-[#070708]">
        {loadingAuth ? (
          <div className="flex justify-center p-3">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin"></div>
          </div>
        ) : user ? (
          <div className="space-y-4">
            {/* User Profile Card */}
            <div className="flex items-center space-x-3 p-2 rounded-md bg-[#0f0f12] border border-[#1f1f23]">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "User"} 
                  className="w-8 h-8 rounded-full border border-zinc-700 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shrink-0 text-xs">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate leading-tight">
                  {user.displayName || "Station Lead"}
                </p>
                <div className="flex items-center space-x-1 mt-0.5">
                  <ShieldCheck className="h-2.5 w-2.5 text-blue-400 shrink-0" />
                  <span className="text-[8px] font-mono text-blue-400 uppercase tracking-wider font-semibold truncate max-w-[130px]" title={role || "Read-only User"}>
                    {role || "Authenticating..."}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout button */}
            <button
              id="auth-logout-btn"
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-[#131316] hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/30 text-zinc-300 border border-[#1f1f23] rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>Lock Console</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-center p-2 rounded-md bg-[#0f0f12] border border-dashed border-[#1f1f23]">
              <p className="text-[10px] text-zinc-400 font-medium font-mono">Read-Only Session</p>
              <p className="text-[9px] text-zinc-500 mt-1">Unlock controls to configure terminals & logs.</p>
            </div>
            
            {/* Login button */}
            <button
              id="auth-login-btn"
              onClick={onLogin}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md text-xs tracking-wide transition-all duration-200 cursor-pointer shadow-md shadow-blue-600/20"
            >
              <LogIn className="h-3.5 w-3.5 shrink-0" />
              <span>Unlock Admin Controls</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
