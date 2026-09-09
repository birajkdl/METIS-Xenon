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
  FolderOpen,
  Gauge,
  Wrench,
  CheckSquare,
  ClipboardList,
  Coins
} from 'lucide-react';
import { User } from 'firebase/auth';

interface SidebarProps {
  activeView: 'dashboard' | 'station-health' | 'inventory' | 'alerts' | 'registration' | 'lifecycle' | 'status-tracking' | 'deployments' | 'transfers' | 'administration' | 'warranty' | 'gis' | 'notifications' | 'reports' | 'audit' | 'suppliers' | 'requisitions' | 'stations' | 'documents' | 'calibration-lab' | 'installation-planning' | 'capital-budgeting' | 'maintenance';
  setActiveView: (view: 'dashboard' | 'station-health' | 'inventory' | 'alerts' | 'registration' | 'lifecycle' | 'status-tracking' | 'deployments' | 'transfers' | 'administration' | 'warranty' | 'gis' | 'notifications' | 'reports' | 'audit' | 'suppliers' | 'requisitions' | 'stations' | 'documents' | 'calibration-lab' | 'installation-planning' | 'capital-budgeting' | 'maintenance') => void;
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
  isFirstInstall?: boolean;
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
  onToggleCollapse,
  isFirstInstall
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
              id="nav-station-health-btn"
              onClick={() => setActiveView('station-health')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'station-health'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Activity className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Station Health</span>
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
              id="nav-installation-planning-btn"
              onClick={() => setActiveView('installation-planning')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'installation-planning'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Wrench className="h-4 w-4 shrink-0 text-teal-400 animate-pulse" />
              <span>Installation Planner</span>
            </button>

            <button
              id="nav-maintenance-btn"
              onClick={() => setActiveView('maintenance')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'maintenance'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <ClipboardList className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Maintenance</span>
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
              id="nav-lifecycle-btn"
              onClick={() => setActiveView('lifecycle')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'lifecycle' || activeView === 'status-tracking' || activeView === 'deployments' || activeView === 'transfers'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <History className="h-4 w-4 shrink-0 text-indigo-400" />
              <span>Sensor Lifecycle Manager</span>
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
              id="nav-calibration-lab-btn"
              onClick={() => setActiveView('calibration-lab')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'calibration-lab'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Gauge className="h-4 w-4 shrink-0 text-indigo-400" />
              <span>Calibration Lab</span>
            </button>

            <button
              id="nav-capital-budgeting-btn"
              onClick={() => setActiveView('capital-budgeting')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeView === 'capital-budgeting'
                  ? 'bg-white/5 border border-white/10 text-white shadow-xs'
                  : 'text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Coins className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="font-semibold text-blue-400">Capital Budgeting</span>
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

            {/* Cloud Firestore Status Badge */}
            <div className="flex items-center justify-between px-2 py-1 rounded bg-[#0d0d10] border border-[#1a1a20] text-[9px] font-mono">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Firestore Synced
              </span>
              <span className="text-zinc-500">Cloud Auth</span>
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
            <div className={`text-center p-2 rounded-md ${isFirstInstall ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-[#0f0f12] border border-dashed border-[#1f1f23]'}`}>
              <p className={`text-[10px] font-medium font-mono ${isFirstInstall ? 'text-amber-400 font-bold' : 'text-zinc-400'}`}>
                {isFirstInstall ? "⚡ First-Time Setup Required" : "Read-Only Session"}
              </p>
              <p className="text-[9px] text-zinc-500 mt-1">
                {isFirstInstall ? "No accounts found. Create Primary Super Administrator." : "Unlock controls to configure terminals & logs."}
              </p>
            </div>
            
            {/* Quick Google Sign In */}
            <button
              id="sidebar-google-signin-btn"
              onClick={onLogin}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-white hover:bg-zinc-100 text-zinc-900 font-medium rounded-md text-xs transition-all duration-150 cursor-pointer shadow-sm border border-zinc-300"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>

            {/* Email / Password Login button */}
            <button
              id="auth-login-btn"
              onClick={onLogin}
              className={`w-full flex items-center justify-center space-x-2 py-2 px-4 font-semibold rounded-md text-xs tracking-wide transition-all duration-200 cursor-pointer shadow-md ${
                isFirstInstall 
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
              }`}
            >
              <LogIn className="h-3.5 w-3.5 shrink-0" />
              <span>{isFirstInstall ? "Create Administrator" : "Password Login"}</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
