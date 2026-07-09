import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import {
  Search,
  X,
  MapPin,
  Cpu,
  Wrench,
  Layers,
  Calendar,
  Building2,
  Sparkles,
  ExternalLink,
  Settings,
  Info,
  ChevronRight,
  Menu
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import InventoryList from './components/InventoryList.tsx';
import AlertsView from './components/AlertsView.tsx';
import SensorRegistration from './components/SensorRegistration.tsx';
import StatusTracking from './components/StatusTracking.tsx';
import DeploymentManagement from './components/DeploymentManagement.tsx';
import TransferManagement from './components/TransferManagement.tsx';
import Administration from './components/Administration.tsx';
import WarrantyManagement from './components/WarrantyManagement.tsx';
import GisMap from './components/GisMap.tsx';
import StationDetailReport from './components/StationDetailReport.tsx';
import Modals from './components/Modals.tsx';
import AuthModal from './components/AuthModal.tsx';
import QRScannerModal from './components/QRScannerModal.tsx';
import NotificationsPanel from './components/NotificationsPanel.tsx';
import ReportingModule from './components/ReportingModule.tsx';
import AuditTrailPanel from './components/AuditTrailPanel.tsx';
import SupplierManagement from './components/SupplierManagement.tsx';
import StationsModule from './components/StationsModule.tsx';
import DocumentsModule from './components/DocumentsModule.tsx';
import { DashboardStats, WeatherStation, Sensor } from './types.ts';

export default function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'inventory' | 'alerts' | 'registration' | 'status-tracking' | 'deployments' | 'transfers' | 'administration' | 'warranty' | 'gis' | 'notifications' | 'reports' | 'audit' | 'suppliers' | 'stations' | 'documents'>('dashboard');
  
  // Theme state: default to 'dark', save to localStorage
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('theme-light');
      root.classList.remove('theme-dark');
    } else {
      root.classList.add('theme-dark');
      root.classList.remove('theme-light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Check if opening a full-page Station Dossier Report (new tab workflow)
  const [reportStationId, setReportStationId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stationIdParam = params.get('stationId');
    if (stationIdParam) {
      setReportStationId(parseInt(stationIdParam, 10));
    }
  }, []);
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [dbUser, setDbUser] = useState<{
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    role: string;
    assignedStationId: number | null;
  } | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Application Data States
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [stations, setStations] = useState<WeatherStation[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal control states
  const [modalType, setModalType] = useState<'add-station' | 'edit-station' | 'add-sensor' | 'edit-sensor' | 'log-calibration' | null>(null);
  const [editingSensor, setEditingSensor] = useState<Sensor | null>(null);
  const [editingStation, setEditingStation] = useState<WeatherStation | null>(null);
  const [selectedSensorForCalibId, setSelectedSensorForCalibId] = useState<number | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  // Global search & navigation states
  const [gSearchQuery, setGSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [invActiveTab, setInvActiveTab] = useState<'sensors' | 'stations'>('sensors');
  const [gisFocusStationId, setGisFocusStationId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Quick views
  const [quickViewStation, setQuickViewStation] = useState<WeatherStation | null>(null);
  const [quickViewSensor, setQuickViewSensor] = useState<Sensor | null>(null);
  const [quickViewSensorCalibrations, setQuickViewSensorCalibrations] = useState<any[]>([]);
  const [loadingQuickViewCalibrations, setLoadingQuickViewCalibrations] = useState(false);

  useEffect(() => {
    if (quickViewSensor) {
      setLoadingQuickViewCalibrations(true);
      fetch('/api/calibrations')
        .then(res => {
          if (!res.ok) throw new Error("Failed to load calibrations");
          return res.json();
        })
        .then(data => {
          const filtered = data.filter((c: any) => c.sensorId === quickViewSensor.sensorId);
          setQuickViewSensorCalibrations(filtered);
        })
        .catch(err => {
          console.error("Failed to fetch sensor calibrations:", err);
          setQuickViewSensorCalibrations([]);
        })
        .finally(() => {
          setLoadingQuickViewCalibrations(false);
        });
    } else {
      setQuickViewSensorCalibrations([]);
    }
  }, [quickViewSensor]);

  // Keyboard shortcut listener to focus global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
          (searchInput as HTMLInputElement).focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset GIS focus station ID when leaving GIS view to trigger focus on re-entry
  useEffect(() => {
    if (activeView !== 'gis') {
      setGisFocusStationId(null);
    }
  }, [activeView]);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          setToken(idToken);
        } catch (e) {
          console.error("Failed to fetch ID token:", e);
          setToken(null);
        }
      } else {
        setToken(null);
      }
      setLoadingAuth(false);
    });
  }, []);

  // 2. Fetch data from backend
  const fetchData = async () => {
    setLoadingData(true);
    setErrorMsg(null);
    try {
      // Parallel fetch for optimal load time
      const [statsRes, stationsRes, sensorsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/stations'),
        fetch('/api/sensors')
      ]);

      if (!statsRes.ok || !stationsRes.ok || !sensorsRes.ok) {
        throw new Error("One or more dashboard operations endpoints failed to respond.");
      }

      const statsData = await statsRes.json();
      const stationsData = await stationsRes.json();
      const sensorsData = await sensorsRes.json();

      setStats(statsData);
      setStations(stationsData);
      setSensors(sensorsData);
    } catch (err: any) {
      console.error("Data load failed:", err);
      setErrorMsg(err.message || "Failed to establish secure connection to Cloud SQL node.");
    } finally {
      setLoadingData(false);
    }
  };

  // Fetch initial data & refetch when auth changes
  useEffect(() => {
    fetchData();
  }, [token]);

  // Fetch database user profile details when authenticated
  useEffect(() => {
    if (token) {
      fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("Failed to load user profile");
      })
      .then(data => {
        setDbUser(data);
      })
      .catch(err => {
        console.error("Error fetching dbUser role profile:", err);
        setDbUser(null);
      });
    } else {
      setDbUser(null);
    }
  }, [token]);

  // Auth actions
  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign-out failed:", e);
    }
  };

  // Submissions (Gated with Firebase JWT)

  const handleAddStationSubmit = async (data: { stationName: string; region: string; latitude: number; longitude: number; batteryVoltageType?: string; batteryCurrentVoltage?: number; stationType?: string }) => {
    if (!token) throw new Error("You must lock in credentials before editing.");
    const res = await fetch('/api/stations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to register weather station.");
    }

    await fetchData(); // Refresh
  };

  const handleEditStationSubmit = async (stationId: number, data: { stationName: string; region: string; latitude: number; longitude: number; batteryVoltageType?: string; batteryCurrentVoltage?: number; stationType?: string }) => {
    if (!token) throw new Error("You must lock in credentials before editing.");
    const res = await fetch(`/api/stations/${stationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to update weather station.");
    }

    await fetchData(); // Refresh
  };

  const handleAddSensorSubmit = async (data: { sensorType: string; manufacturer: string; status: string; stationId: number | null }) => {
    if (!token) throw new Error("You must lock in credentials before editing.");
    const res = await fetch('/api/sensors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to catalog sensor.");
    }

    await fetchData();
  };

  const handleEditSensorSubmit = async (sensorId: number, data: { sensorType: string; manufacturer: string; status: string; stationId: number | null }) => {
    if (!token) throw new Error("You must lock in credentials before editing.");
    const res = await fetch(`/api/sensors/${sensorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to update sensor parameters.");
    }

    await fetchData();
  };

  const handleLogCalibrationSubmit = async (data: { sensorId: number; calibrationDate: string; technicianName: string; result: string; notes: string; nextDueDate: string }) => {
    if (!token) throw new Error("You must lock in credentials before editing.");
    const res = await fetch('/api/calibrations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to record calibration logs.");
    }

    await fetchData();
  };

  const handleDeleteStation = async (stationId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/stations/${stationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to delete station.");
      }
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Relational constraints prevented removing this station.");
    }
  };

  const handleDeleteSensor = async (sensorId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/sensors/${sensorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to retire sensor.");
      }
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Error occurred while deleting sensor.");
    }
  };

  const handleDismissAlert = async (sensorId: number) => {
    if (!token) return;
    const res = await fetch(`/api/sensors/${sensorId}/dismiss-alert`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to dismiss alert.");
    }

    await fetchData();
  };

  if (reportStationId !== null) {
    return <StationDetailReport stationId={reportStationId} />;
  }

  // Filter matching stations/sensors for global search dropdown
  const cleanQuery = gSearchQuery.trim().toLowerCase();
  const matchingStations = cleanQuery === '' ? [] : stations.filter(st => 
    st.stationName.toLowerCase().includes(cleanQuery) ||
    st.region.toLowerCase().includes(cleanQuery) ||
    st.stationId.toString() === cleanQuery
  ).slice(0, 5);

  const matchingSensors = cleanQuery === '' ? [] : sensors.filter(se => 
    se.sensorType.toLowerCase().includes(cleanQuery) ||
    se.manufacturer.toLowerCase().includes(cleanQuery) ||
    (se.serialNumber && se.serialNumber.toLowerCase().includes(cleanQuery)) ||
    (se.assignedOffice && se.assignedOffice.toLowerCase().includes(cleanQuery)) ||
    se.sensorId.toString() === cleanQuery
  ).slice(0, 5);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        user={user}
        role={dbUser ? dbUser.role : null}
        onLogin={handleLogin}
        onLogout={handleLogout}
        loadingAuth={loadingAuth}
        onOpenQRScanner={() => setIsQRScannerOpen(true)}
        theme={theme}
        toggleTheme={toggleTheme}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(true)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#050505]">
        
        {/* Global Premium Header containing Search */}
        <header className="h-16 border-b border-[#1f1f23] bg-[#0c0c0e] px-6 flex items-center gap-4 justify-between shrink-0 z-30 relative">
          {/* Left: Interactive search input & sidebar restore button */}
          <div className="flex items-center flex-1 max-w-xl gap-3">
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 bg-[#131316] hover:bg-zinc-800 border border-[#1f1f23] rounded-md text-zinc-400 hover:text-white transition cursor-pointer flex items-center justify-center shrink-0"
                title="Expand Sidebar"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}
            <div className="flex-1 relative">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                id="global-search-input"
                type="text"
                placeholder="Search station or sensor by name, serial, or ID... (Type '/' to focus)"
                className="w-full bg-[#131316] border border-[#212126] hover:border-[#303038] focus:border-blue-500 rounded-lg py-2 pl-10 pr-12 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-sans"
                value={gSearchQuery}
                onChange={(e) => {
                  setGSearchQuery(e.target.value);
                  setSearchFocused(true);
                }}
                onFocus={() => setSearchFocused(true)}
              />
              {gSearchQuery ? (
                <button
                  onClick={() => setGSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-[#1f1f23] border border-[#2d2d34] text-[9px] font-mono text-zinc-400 rounded">
                  /
                </kbd>
              )}
            </div>

            {/* Global Search Results Dropdown */}
            {searchFocused && gSearchQuery.trim() !== '' && (
              <>
                {/* Backdrop overlay to close when clicking outside */}
                <div className="fixed inset-0 z-10" onClick={() => setSearchFocused(false)} />
                
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0c0c0e] border border-[#1f1f23] rounded-lg shadow-2xl overflow-hidden z-20 max-h-[480px] overflow-y-auto">
                  {matchingStations.length === 0 && matchingSensors.length === 0 ? (
                    <div className="p-6 text-center text-zinc-500 text-xs">
                      No matching weather stations or sensors found for "<span className="text-zinc-300 font-semibold">{gSearchQuery}</span>"
                    </div>
                  ) : (
                    <div className="p-2 space-y-3">
                      {/* Stations section */}
                      {matchingStations.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono border-b border-[#16161a] mb-1">
                            Meteorological Terminals ({matchingStations.length})
                          </div>
                          <div className="space-y-0.5">
                            {matchingStations.map(st => (
                              <button
                                key={`st-${st.stationId}`}
                                onClick={() => {
                                  setQuickViewStation(st);
                                  setSearchFocused(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-[#131316] hover:text-white text-zinc-300 rounded-md transition flex items-center justify-between group cursor-pointer text-xs"
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  <MapPin className="h-4 w-4 text-blue-400 shrink-0 group-hover:scale-110 transition" />
                                  <div className="truncate">
                                    <div className="font-semibold text-zinc-100 group-hover:text-blue-400 transition truncate">{st.stationName}</div>
                                    <div className="text-[10px] text-zinc-500 truncate">{st.region} • ID: {st.stationId}</div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1.5 shrink-0 text-[10px] font-mono text-zinc-500 bg-[#131316] px-2 py-0.5 rounded border border-[#1f1f23] group-hover:border-blue-500/20 group-hover:text-zinc-300">
                                  <span>Station</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sensors section */}
                      {matchingSensors.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono border-b border-[#16161a] mb-1">
                            Physical Telemetry Instruments ({matchingSensors.length})
                          </div>
                          <div className="space-y-0.5">
                            {matchingSensors.map(se => (
                              <button
                                key={`se-${se.sensorId}`}
                                onClick={() => {
                                  setQuickViewSensor(se);
                                  setSearchFocused(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-[#131316] hover:text-white text-zinc-300 rounded-md transition flex items-center justify-between group cursor-pointer text-xs"
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  <Cpu className="h-4 w-4 text-emerald-400 shrink-0 group-hover:scale-110 transition" />
                                  <div className="truncate">
                                    <div className="font-semibold text-zinc-100 group-hover:text-emerald-400 transition truncate">
                                      {se.sensorType} ({se.manufacturer})
                                    </div>
                                    <div className="text-[10px] text-zinc-500 truncate">
                                      {se.serialNumber ? `S/N: ${se.serialNumber}` : 'No S/N'} • ID: {se.sensorId} {se.assignedOffice ? `• ${se.assignedOffice}` : ''}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 shrink-0">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                                    se.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' :
                                    se.status === 'In Calibration' ? 'bg-purple-500/10 text-purple-400' :
                                    se.status === 'Maintenance' ? 'bg-amber-500/10 text-amber-400' :
                                    'bg-rose-500/10 text-rose-400'
                                  }`}>
                                    {se.status}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          </div>

          {/* Right: Title & System Info badges */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-xs">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider font-bold">AWS Live Link Status</span>
            </div>
          </div>
        </header>

        {activeView === 'dashboard' ? (
          <Dashboard
            stats={stats}
            stations={stations}
            sensors={sensors}
            loading={loadingData}
            error={errorMsg}
            onRefresh={fetchData}
            onOpenAddStation={() => {
              setModalType('add-station');
            }}
            onOpenAddSensor={() => {
              setModalType('add-sensor');
            }}
            onOpenLogCalibration={(sensorId) => {
              if (sensorId) {
                setSelectedSensorForCalibId(sensorId);
              } else {
                setSelectedSensorForCalibId(null);
              }
              setModalType('log-calibration');
            }}
            isAuthenticated={!!token}
            onLogin={handleLogin}
            onLogout={handleLogout}
            user={user}
            role={dbUser ? dbUser.role : null}
            onOpenQRScanner={() => setIsQRScannerOpen(true)}
            onOpenEditStation={(station) => {
              setEditingStation(station);
              setModalType('edit-station');
            }}
          />
        ) : activeView === 'gis' ? (
          <div className="flex-1 overflow-hidden bg-[#0a0a0c] text-zinc-300 p-8 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white leading-tight tracking-tight">Interactive GIS Map</h2>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  National AWS Telemetered Station Grid & Live Operational Status Index.
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <GisMap
                stations={stations}
                sensors={sensors}
                theme={theme}
                focusStationId={gisFocusStationId}
              />
            </div>
          </div>
        ) : activeView === 'stations' ? (
          <div className="flex-1 overflow-y-auto bg-[#0a0a0c] text-zinc-300 p-8">
            <StationsModule
              stations={stations}
              sensors={sensors}
              token={token}
              role={dbUser ? dbUser.role : null}
              onRefreshData={fetchData}
              onOpenAddStation={() => setModalType('add-station')}
              onOpenEditStation={(station) => {
                setEditingStation(station);
                setModalType('edit-station');
              }}
            />
          </div>
        ) : activeView === 'inventory' ? (
          <InventoryList
            sensors={sensors}
            stations={stations}
            onOpenAddStation={() => {
              setModalType('add-station');
            }}
            onOpenAddSensor={() => {
              setModalType('add-sensor');
            }}
            onOpenEditSensor={(sensor) => {
              setEditingSensor(sensor);
              setModalType('edit-sensor');
            }}
            onOpenLogCalibration={(sensorId) => {
              setSelectedSensorForCalibId(sensorId);
              setModalType('log-calibration');
            }}
            onDeleteStation={handleDeleteStation}
            onDeleteSensor={handleDeleteSensor}
            isAuthenticated={!!token}
            onOpenQRScanner={() => setIsQRScannerOpen(true)}
            globalSearchQuery={gSearchQuery}
            setGlobalSearchQuery={setGSearchQuery}
            activeTabProp={invActiveTab}
            setActiveTabProp={setInvActiveTab}
          />
        ) : activeView === 'alerts' ? (
          <AlertsView
            sensors={sensors}
            stations={stations}
            isAuthenticated={!!token}
            onDismissAlert={handleDismissAlert}
            onRefresh={fetchData}
          />
        ) : activeView === 'status-tracking' ? (
          <StatusTracking
            sensors={sensors}
            stations={stations}
            isAuthenticated={!!token}
            onUpdateSensor={handleEditSensorSubmit}
            onRefresh={fetchData}
            token={token}
          />
        ) : activeView === 'deployments' ? (
          <DeploymentManagement
            sensors={sensors}
            stations={stations}
            isAuthenticated={!!token}
            onRefresh={fetchData}
            token={token}
          />
        ) : activeView === 'transfers' ? (
          <TransferManagement
            sensors={sensors}
            stations={stations}
            isAuthenticated={!!token}
            onRefresh={fetchData}
            token={token}
          />
        ) : activeView === 'administration' ? (
          <div className="flex-1 overflow-y-auto bg-[#0a0a0c] text-zinc-300 p-8">
            <Administration
              sensors={sensors}
              stations={stations}
              token={token}
              currentUserRole={dbUser ? dbUser.role : null}
              onRefreshData={fetchData}
            />
          </div>
        ) : activeView === 'warranty' ? (
          <div className="flex-1 overflow-y-auto bg-[#0a0a0c] text-zinc-300 p-8">
            <WarrantyManagement
              sensors={sensors}
              stations={stations}
              isAuthenticated={!!token}
              onRefresh={fetchData}
              token={token}
            />
          </div>
        ) : activeView === 'notifications' ? (
          <div className="flex-1 overflow-y-auto bg-[#0a0a0c] text-zinc-300 p-8">
            <NotificationsPanel userRole={dbUser ? dbUser.role : null} />
          </div>
        ) : activeView === 'reports' ? (
          <ReportingModule
            sensors={sensors}
            stations={stations}
            isAuthenticated={!!token}
            token={token}
            onRefresh={fetchData}
          />
        ) : activeView === 'audit' ? (
          <div className="flex-1 overflow-y-auto bg-[#0a0a0c] text-zinc-300 p-8">
            <AuditTrailPanel token={token} />
          </div>
        ) : activeView === 'suppliers' ? (
          <div className="flex-1 overflow-y-auto">
            <SupplierManagement
              token={token}
              user={user}
              role={dbUser ? dbUser.role : null}
              theme={theme}
            />
          </div>
        ) : activeView === 'documents' ? (
          <div className="flex-1 overflow-y-auto">
            <DocumentsModule
              token={token}
              user={user}
              role={dbUser ? dbUser.role : null}
              stations={stations}
              sensors={sensors}
              theme={theme}
            />
          </div>
        ) : (
          <SensorRegistration
            sensors={sensors}
            stations={stations}
            isAuthenticated={!!token}
            onAddSensor={handleAddSensorSubmit}
            onUpdateSensor={handleEditSensorSubmit}
            onDeleteSensor={handleDeleteSensor}
            onRefresh={fetchData}
            token={token}
          />
        )}
      </div>

      {/* Interactive Forms Overlay Modals */}
      <Modals
        modalType={modalType}
        onClose={() => {
          setModalType(null);
          setEditingSensor(null);
          setEditingStation(null);
          setSelectedSensorForCalibId(null);
        }}
        stations={stations}
        sensors={sensors}
        selectedSensorForCalibId={selectedSensorForCalibId}
        onSubmitAddStation={handleAddStationSubmit}
        onSubmitAddSensor={handleAddSensorSubmit}
        onSubmitEditSensor={handleEditSensorSubmit}
        onSubmitLogCalibration={handleLogCalibrationSubmit}
        editingSensor={editingSensor}
        editingStation={editingStation}
        onSubmitEditStation={handleEditStationSubmit}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        auth={auth}
        onAuthSuccess={(t) => {
          setToken(t);
          fetchData();
        }}
      />

      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        sensors={sensors}
        stations={stations}
        onOpenLogCalibration={(sensorId) => {
          setSelectedSensorForCalibId(sensorId);
          setModalType('log-calibration');
        }}
        onOpenAddSensor={() => {
          setModalType('add-sensor');
        }}
        onOpenEditSensor={(sensor) => {
          setEditingSensor(sensor);
          setModalType('edit-sensor');
        }}
        isAuthenticated={!!token}
        onRefreshData={fetchData}
        token={token}
      />

      {/* QUICK VIEW STATION MODAL */}
      {quickViewStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#0c0c0e] border border-[#1f1f23] rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#1f1f23] flex items-center justify-between bg-[#131316]">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-950/40 border border-blue-900/30 text-blue-400 rounded">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif italic text-white text-lg font-bold">Terminal Quick View</h3>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {quickViewStation.stationId}</p>
                </div>
              </div>
              <button
                onClick={() => setQuickViewStation(null)}
                className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Station Name</label>
                <p className="text-sm text-zinc-100 font-semibold">{quickViewStation.stationName}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Region / Office</label>
                <p className="text-sm text-zinc-100">{quickViewStation.region}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Latitude</label>
                  <p className="text-xs text-zinc-300 font-mono">{quickViewStation.latitude}° N</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Longitude</label>
                  <p className="text-xs text-zinc-300 font-mono">{quickViewStation.longitude}° E</p>
                </div>
              </div>

              {(() => {
                const activeSensorsCount = sensors.filter(
                  se => se.stationId === quickViewStation.stationId && se.status === 'Active'
                ).length;
                return (
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Active Instruments</label>
                    <div className="flex items-center">
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{activeSensorsCount} Active {activeSensorsCount === 1 ? 'Sensor' : 'Sensors'} Linked</span>
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 border-t border-[#1f1f23] flex flex-col space-y-2">
                <button
                  onClick={() => {
                    setGisFocusStationId(quickViewStation.stationId);
                    setActiveView('gis');
                    setQuickViewStation(null);
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Locate & Center on GIS Map</span>
                </button>

                <button
                  onClick={() => {
                    setGSearchQuery(quickViewStation.stationName);
                    setInvActiveTab('stations');
                    setActiveView('inventory');
                    setQuickViewStation(null);
                  }}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-100 border border-zinc-800 rounded text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Inspect in Inventory List</span>
                </button>

                {token && ['Super Administrator', 'Head Office Admin/User', 'Regional Office Admin/User'].includes(dbUser?.role || '') && (
                  <button
                    onClick={() => {
                      setEditingStation(quickViewStation);
                      setModalType('edit-station');
                      setQuickViewStation(null);
                    }}
                    className="w-full py-2 bg-[#1b1b21] hover:bg-[#25252e] text-zinc-300 border border-[#2d2d38] rounded text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>Edit Terminal Details</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK VIEW SENSOR MODAL */}
      {quickViewSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#0c0c0e] border border-[#1f1f23] rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#1f1f23] flex items-center justify-between bg-[#131316]">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 rounded">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif italic text-white text-lg font-bold">Instrument Quick View</h3>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {quickViewSensor.sensorId}</p>
                </div>
              </div>
              <button
                onClick={() => setQuickViewSensor(null)}
                className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Instrument Type</label>
                  <p className="text-sm text-zinc-100 font-semibold">{quickViewSensor.sensorType}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Manufacturer</label>
                  <p className="text-sm text-zinc-100">{quickViewSensor.manufacturer}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Serial Number</label>
                  <p className="text-xs text-zinc-300 font-mono">{quickViewSensor.serialNumber || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Status</label>
                  <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    quickViewSensor.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' :
                    quickViewSensor.status === 'In Calibration' ? 'bg-purple-500/10 text-purple-400' :
                    quickViewSensor.status === 'Maintenance' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-rose-500/10 text-rose-400'
                  }`}>
                    {quickViewSensor.status}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Assigned Station / Location</label>
                <div className="text-xs text-zinc-300">
                  {quickViewSensor.stationName ? (
                    <span className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3 text-blue-400" />
                      <span>{quickViewSensor.stationName} ({quickViewSensor.region || 'Assigned'})</span>
                    </span>
                  ) : (
                    <span className="text-zinc-500 font-mono italic">In Depot Storage</span>
                  )}
                </div>
              </div>

              {/* Historical Calibration Trend Chart */}
              <div className="pt-3 border-t border-[#1f1f23] space-y-2">
                <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">
                  Calibration History Trend
                </label>
                {loadingQuickViewCalibrations ? (
                  <div className="h-40 flex items-center justify-center text-xs text-zinc-500 font-mono">
                    Retrieving telemetry analytics...
                  </div>
                ) : quickViewSensorCalibrations.length > 0 ? (
                  <div className="space-y-2">
                    <div className="h-40 w-full bg-[#070709] border border-[#1b1b21] rounded p-2 pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={[...quickViewSensorCalibrations]
                            .sort((a, b) => new Date(a.calibrationDate).getTime() - new Date(b.calibrationDate).getTime())
                            .slice(-5)
                            .map(c => ({
                              date: new Date(c.calibrationDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                              fullDate: c.calibrationDate,
                              result: c.result,
                              score: c.result === 'Passed' ? 2 : c.result === 'Adjusted' ? 1 : 0
                            }))
                          }
                          margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
                        >
                          <CartesianGrid stroke="#1f1f23" strokeDasharray="3 3" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#71717a" 
                            fontSize={9} 
                            tickLine={false} 
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="#71717a" 
                            fontSize={9} 
                            domain={[0, 2]} 
                            ticks={[0, 1, 2]} 
                            tickFormatter={(val) => val === 2 ? 'Passed' : val === 1 ? 'Adjusted' : 'Failed'}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-[#111115] border border-zinc-800 p-2 rounded shadow-lg text-[10px] font-mono space-y-1">
                                    <p className="text-zinc-400 font-semibold">{data.fullDate}</p>
                                    <p className="flex items-center space-x-1">
                                      <span className="text-zinc-500">Result:</span>
                                      <span className={
                                        data.result === 'Passed' ? 'text-emerald-400' :
                                        data.result === 'Adjusted' ? 'text-amber-400' :
                                        'text-rose-400'
                                      }>{data.result}</span>
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#8b5cf6" 
                            strokeWidth={2} 
                            activeDot={{ r: 5 }} 
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              const color = payload.result === 'Passed' ? '#10b981' : payload.result === 'Adjusted' ? '#f59e0b' : '#ef4444';
                              return (
                                <circle key={`dot-${payload.fullDate}`} cx={cx} cy={cy} r={3} fill={color} stroke="none" />
                              );
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-zinc-500 font-mono px-1">
                      <span>Older</span>
                      <span className="flex items-center space-x-2">
                        <span className="inline-flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Passed</span>
                        </span>
                        <span className="inline-flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Adjusted</span>
                        </span>
                        <span className="inline-flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          <span>Failed</span>
                        </span>
                      </span>
                      <span>Recent</span>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-[#1f1f23] rounded p-4 text-center">
                    <p className="text-[11px] text-zinc-400 font-mono">No calibration records located</p>
                    <p className="text-[9px] text-zinc-500 mt-0.5">Please log standard diagnostic checks to see live calibration trend lines.</p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#1f1f23] flex flex-col space-y-2">
                <button
                  onClick={() => {
                    setGSearchQuery(quickViewSensor.serialNumber || quickViewSensor.sensorType);
                    setInvActiveTab('sensors');
                    setActiveView('inventory');
                    setQuickViewSensor(null);
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Locate in Inventory Master List</span>
                </button>

                {token && ['Super Administrator', 'Head Office Admin/User', 'Regional Office Admin/User'].includes(dbUser?.role || '') && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedSensorForCalibId(quickViewSensor.sensorId);
                        setModalType('log-calibration');
                        setQuickViewSensor(null);
                      }}
                      className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-100 border border-zinc-800 rounded text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Wrench className="h-3.5 w-3.5 text-purple-400" />
                      <span>Log Calibration Diagnostics</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingSensor(quickViewSensor);
                        setModalType('edit-sensor');
                        setQuickViewSensor(null);
                      }}
                      className="w-full py-2 bg-[#1b1b21] hover:bg-[#25252e] text-zinc-300 border border-[#2d2d38] rounded text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Modify Hardware Asset</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
