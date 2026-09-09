import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  onIdTokenChanged,
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
  Menu,
  Save,
  Check,
  Activity,
  TrendingUp,
  Zap,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import { 
  syncUserProfileToFirestore, 
  subscribeToUserProfile, 
  saveUserPreferencesToFirestore, 
  subscribeToUserPreferences, 
  verifyFirestoreConnectivity, 
  logUserActivityToFirestore,
  saveMaintenanceTicketToFirestore,
  UserProfileDoc 
} from './lib/firestore-service.ts';
import { Database, Cloud, LogIn } from 'lucide-react';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import InventoryList from './components/InventoryList.tsx';
import AlertsView from './components/AlertsView.tsx';
import SensorRegistration from './components/SensorRegistration.tsx';
import SensorLifecycleManager from './components/SensorLifecycleManager.tsx';
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
import CalibrationLab from './components/CalibrationLab.tsx';
import InstallationPlanner from './components/InstallationPlanner.tsx';
import CapitalBudgeting from './components/CapitalBudgeting.tsx';
import MaintenanceModule from './components/MaintenanceModule.tsx';
import StationHealthView from './components/StationHealthView.tsx';
import { DashboardStats, WeatherStation, Sensor, MaintenanceTicket } from './types.ts';

// Helper to check if a JWT token has expired or is expiring soon (buffer of 60s)
function isJwtExpired(tokenString: string | null): boolean {
  if (!tokenString) return true;
  if (tokenString.startsWith('metis.')) return false; // Native server-minted METIS token
  try {
    const parts = tokenString.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && Date.now() >= (payload.exp - 60) * 1000) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'station-health' | 'inventory' | 'alerts' | 'registration' | 'lifecycle' | 'status-tracking' | 'deployments' | 'transfers' | 'administration' | 'warranty' | 'gis' | 'notifications' | 'reports' | 'audit' | 'suppliers' | 'stations' | 'documents' | 'calibration-lab' | 'installation-planning' | 'capital-budgeting' | 'maintenance'>('dashboard');
  
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
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (auth.currentUser) {
        saveUserPreferencesToFirestore(auth.currentUser.uid, { theme: next }).catch(() => {});
      }
      return next;
    });
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
  const [isFirstInstall, setIsFirstInstall] = useState<boolean>(false);

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
  const [maintenanceTarget, setMaintenanceTarget] = useState<{
    tab: 'tickets' | 'work-orders';
    ticketNumber?: string;
    workOrderId?: string;
  } | null>(null);

  const handleNavigateToMaintenance = (target: { tab: 'tickets' | 'work-orders'; ticketNumber?: string; workOrderId?: string }) => {
    setMaintenanceTarget(target);
    setActiveView('maintenance');
  };
  
  // Quick views
  const [quickViewStation, setQuickViewStation] = useState<WeatherStation | null>(null);
  const [telemetryHeartbeat, setTelemetryHeartbeat] = useState<any>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [hoveredSparklineIndex, setHoveredSparklineIndex] = useState<number | null>(null);
  const [sparklineThresholdMode, setSparklineThresholdMode] = useState<'strict' | 'adaptive'>('strict');
  const [quickViewSensor, setQuickViewSensor] = useState<Sensor | null>(null);
  const [quickViewSensorCalibrations, setQuickViewSensorCalibrations] = useState<any[]>([]);
  const [loadingQuickViewCalibrations, setLoadingQuickViewCalibrations] = useState(false);
  const [quickNoteValue, setQuickNoteValue] = useState('');
  const [savingQuickNote, setSavingQuickNote] = useState(false);
  const [quickNoteSuccess, setQuickNoteSuccess] = useState(false);
  const [quickNoteError, setQuickNoteError] = useState<string | null>(null);
  const [incomingWarrantyClaim, setIncomingWarrantyClaim] = useState<any | null>(null);

  const [createdMaintenanceTicket, setCreatedMaintenanceTicket] = useState<{
    ticketId: string;
    stationId: number;
    stationName: string;
    region: string;
    issue: string;
    driftCount: number;
    minVoltage: number;
    maxVoltage: number;
    createdAt: string;
    assignedTeam: string;
    status: string;
  } | null>(null);

  const handleScheduleProactiveMaintenance = (
    station: WeatherStation, 
    driftedPoints: any[], 
    voltages: number[],
    safeMin: number = 11.8,
    safeMax: number = 13.2,
    mode: string = 'strict'
  ) => {
    const minV = Math.min(...voltages);
    const maxV = Math.max(...voltages);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    let nextNum = 100006;
    try {
      const savedNum = localStorage.getItem('metis_next_ticket_num');
      if (savedNum) nextNum = parseInt(savedNum, 10);
    } catch (e) {}

    const ticketNumberStr = String(nextNum).padStart(6, '0');

    const newTicket: MaintenanceTicket = {
      ticketNumber: ticketNumberStr,
      stationId: station.stationId,
      stationName: station.stationName,
      region: station.region,
      status: 'Warning',
      summary: `Voltage Drift Anomaly (${mode.toUpperCase()}): ${driftedPoints.length} out-of-range point(s)`,
      description: `Telemetry voltage fluctuated between ${minV.toFixed(2)}V and ${maxV.toFixed(2)}V (Safe Band: ${safeMin}V–${safeMax}V). Automatic proactive maintenance dispatch ticket.`,
      assignedTo: 'alex_field_tech',
      createdBy: 'Telemetry Monitor',
      createdAt: now,
      priority: 'High',
      workOrderId: null
    };

    try {
      const existing = localStorage.getItem('metis_maintenance_tickets');
      const list = existing ? JSON.parse(existing) : [];
      list.unshift(newTicket);
      localStorage.setItem('metis_maintenance_tickets', JSON.stringify(list));
      localStorage.setItem('metis_next_ticket_num', (nextNum + 1).toString());
    } catch (e) {}

    // Persist to Firestore cloud database
    saveMaintenanceTicketToFirestore(newTicket, auth.currentUser?.uid).catch(err => {
      console.warn("Proactive ticket Firestore sync note:", err);
    });

    const ticket = {
      ticketId: `MNT-${ticketNumberStr}`,
      stationId: station.stationId,
      stationName: station.stationName,
      region: station.region,
      issue: `Voltage Drift Anomaly (${mode.toUpperCase()} Threshold Mode): ${driftedPoints.length} out-of-range telemetry reading(s) detected (Min: ${minV.toFixed(2)}V, Max: ${maxV.toFixed(2)}V outside safe operating band ${safeMin}V–${safeMax}V).`,
      driftCount: driftedPoints.length,
      minVoltage: minV,
      maxVoltage: maxV,
      createdAt: now,
      assignedTeam: "Regional Field Maintenance Engineering & Metrology Response Unit",
      status: "DISPATCHED / ACTIVE TICKET"
    };

    setCreatedMaintenanceTicket(ticket);
    setActiveView('maintenance');

    // Update station status locally
    setStations(prev => prev.map(s => s.stationId === station.stationId ? { ...s, status: 'Maintenance' } : s));
  };

  useEffect(() => {
    if (quickViewSensor) {
      setQuickNoteValue(quickViewSensor.quickNote || '');
      setQuickNoteSuccess(false);
      setQuickNoteError(null);
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

  useEffect(() => {
    if (quickViewStation) {
      setLoadingTelemetry(true);
      setTelemetryHeartbeat(null);
      setHoveredSparklineIndex(null);
      fetch(`/api/stations/${quickViewStation.stationId}/telemetry`)
        .then(res => {
          if (!res.ok) throw new Error("Telemetry not found");
          return res.json();
        })
        .then(data => {
          setTelemetryHeartbeat(data);
        })
        .catch(err => {
          console.error("Failed to fetch station telemetry heartbeat:", err);
          const isOff = quickViewStation.batteryCurrentVoltage !== undefined && quickViewStation.batteryCurrentVoltage !== null && quickViewStation.batteryCurrentVoltage < 11.2;
          const isMaint = quickViewStation.batteryCurrentVoltage !== undefined && quickViewStation.batteryCurrentVoltage !== null && quickViewStation.batteryCurrentVoltage < 11.6;
          const baseVolt = quickViewStation.batteryCurrentVoltage !== undefined && quickViewStation.batteryCurrentVoltage !== null ? quickViewStation.batteryCurrentVoltage : 12.2;
          const nowStr = new Date(Date.now() - (quickViewStation.stationId % 10 + 1) * 60000).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

          let grade = 'A+';
          let score = 96;
          if (isOff || baseVolt < 11.2) { grade = 'F'; score = 42; }
          else if (isMaint || baseVolt < 11.6) { grade = 'C'; score = 71; }
          else if (baseVolt < 12.0) { grade = 'B'; score = 84; }
          else if (baseVolt >= 12.4) { grade = 'A+'; score = 98; }
          else { grade = 'A'; score = 92; }

          const times = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
          const trendHistory = times.map((t, idx) => {
            const sineVar = Math.sin((idx / 8) * Math.PI * 2) * 0.25;
            const noise = ((quickViewStation.stationId * 7 + idx * 13) % 11 - 5) * 0.04;
            const v = isOff ? 10.5 : Math.max(10.8, Math.min(13.8, parseFloat((baseVolt + sineVar + noise).toFixed(2))));
            const sig = isOff ? -115 : isMaint ? -95 - (idx % 3) : -68 + Math.floor(sineVar * 10);
            return { time: t, voltage: v, signal: sig };
          });

          setTelemetryHeartbeat({
            stationId: quickViewStation.stationId,
            status: isOff ? 'Offline' : isMaint ? 'Maintenance' : 'Online',
            lastSync: isOff ? 'No sync within 24 hours' : nowStr,
            heartbeatRateHz: isOff ? 0 : isMaint ? 0.05 : 0.2,
            enclosureTempCelsius: (22 + (quickViewStation.stationId % 8)).toFixed(1),
            signalStrengthDb: isOff ? -115 : isMaint ? -95 : -68,
            performanceGrade: grade,
            performanceScore: score,
            healthFactors: {
              powerHealth: isOff ? 'Critical' : isMaint ? 'Fair' : 'Optimal',
              signalHealth: isOff ? 'Weak' : isMaint ? 'Moderate' : 'Strong',
              sensorIntegrity: isOff ? '50%' : isMaint ? '80%' : '98%'
            },
            trendHistory
          });
        })
        .finally(() => {
          setLoadingTelemetry(false);
        });
    } else {
      setTelemetryHeartbeat(null);
    }
  }, [quickViewStation]);

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

  const handleSaveQuickNote = async () => {
    if (!quickViewSensor) return;
    setSavingQuickNote(true);
    setQuickNoteSuccess(false);
    setQuickNoteError(null);
    try {
      const res = await fetch(`/api/sensors/${quickViewSensor.sensorId}/quick-note`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quickNote: quickNoteValue }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save diagnostic comment');
      }

      const updatedSensor = await res.json();
      setQuickViewSensor(updatedSensor);
      setQuickNoteSuccess(true);
      
      // Update global sensors state so that any component displaying this sensor is refreshed
      setSensors(prev => prev.map(s => s.sensorId === updatedSensor.sensorId ? updatedSensor : s));
    } catch (err: any) {
      console.error(err);
      setQuickNoteError(err.message || 'Failed to save note');
    } finally {
      setSavingQuickNote(false);
    }
  };

  // 1. Initial Setup Status & Stored Session Restoration
  useEffect(() => {
    // Check initial installation status
    fetch('/api/auth/setup-status')
      .then(res => res.json())
      .then(data => {
        if (data.isFirstInstall) {
          setIsFirstInstall(true);
          const savedToken = localStorage.getItem('metis_auth_token');
          if (!savedToken) {
            setIsAuthModalOpen(true);
          }
        }
      })
      .catch(err => console.log("Setup status check notice:", err));

    // Restore saved session token (both native METIS tokens and Firebase tokens)
    const savedToken = localStorage.getItem('metis_auth_token');
    if (savedToken) {
      if (isJwtExpired(savedToken)) {
        // Expired token: remove stale credentials so expired tokens are never transmitted
        localStorage.removeItem('metis_auth_token');
        localStorage.removeItem('metis_user_email');
      } else {
        setToken(savedToken);
      }
    }
  }, []);

  // 2. Listen to Firebase Auth state and token updates
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const idToken = await currentUser.getIdToken();
          setToken(idToken);
          localStorage.setItem('metis_auth_token', idToken);
          localStorage.setItem('metis_user_email', currentUser.email || '');

          // Automatically sync user profile to Firestore and initialize profile state
          syncUserProfileToFirestore(currentUser).then(profile => {
            if (profile) {
              setDbUser(prev => prev ? { ...prev, role: profile.role } : {
                id: 1,
                uid: profile.uid,
                email: profile.email,
                displayName: profile.displayName,
                photoURL: profile.photoURL || null,
                role: profile.role,
                assignedStationId: null,
                office: profile.office || null
              });
            }
          }).catch(err => {
            console.warn("Firestore user profile sync notice:", err);
          });

          // Real-time Firestore subscription to user profile updates
          subscribeToUserProfile(currentUser.uid, (profile) => {
            if (profile) {
              setDbUser(prev => ({
                id: prev?.id || 1,
                uid: profile.uid,
                email: profile.email,
                displayName: profile.displayName,
                photoURL: profile.photoURL || null,
                role: profile.role,
                assignedStationId: prev?.assignedStationId || null,
                office: profile.office || null
              }));
            }
          });

          // Subscribe to user preferences from Firestore (e.g. theme)
          subscribeToUserPreferences(currentUser.uid, (prefs) => {
            if (prefs?.theme && (prefs.theme === 'light' || prefs.theme === 'dark')) {
              setTheme(prefs.theme);
            }
          });
        } catch (e) {
          console.warn("Failed to fetch fresh ID token:", e);
        }
      } else {
        // Only clear if we don't have a native METIS token in localStorage
        const savedToken = localStorage.getItem('metis_auth_token');
        if (!savedToken || !savedToken.startsWith('metis.')) {
          setToken(null);
          setUser(null);
          setDbUser(null);
        }
      }
      setLoadingAuth(false);
    });

    // Proactive token refresh interval: refreshes active Firebase token every 40 minutes (tokens expire at 60 mins)
    const refreshInterval = setInterval(async () => {
      if (auth.currentUser) {
        try {
          const freshToken = await auth.currentUser.getIdToken(true);
          setToken(freshToken);
          localStorage.setItem('metis_auth_token', freshToken);
        } catch (err) {
          console.warn("Proactive token refresh notice:", err);
        }
      }
    }, 40 * 60 * 1000);

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
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
    let isCancelled = false;

    if (!token) {
      setDbUser(null);
      return;
    }

    // Check if token is already expired client-side before transmitting
    if (isJwtExpired(token)) {
      if (auth.currentUser) {
        auth.currentUser.getIdToken(true).then(freshToken => {
          if (!isCancelled) {
            setToken(freshToken);
            localStorage.setItem('metis_auth_token', freshToken);
          }
        }).catch(() => {
          localStorage.removeItem('metis_auth_token');
          if (!isCancelled) {
            setToken(null);
            setDbUser(null);
          }
        });
      } else {
        localStorage.removeItem('metis_auth_token');
        setToken(null);
        setDbUser(null);
      }
      return;
    }

    const loadUserProfile = async (authToken: string) => {
      try {
        const res = await fetch('/api/me', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data) {
            setDbUser(data);
          }
          return;
        }

        // If 401 and Firebase user is present, attempt automatic refresh
        if (res.status === 401 && auth.currentUser) {
          try {
            const freshToken = await auth.currentUser.getIdToken(true);
            if (isCancelled) return;
            setToken(freshToken);
            localStorage.setItem('metis_auth_token', freshToken);
            const retryRes = await fetch('/api/me', {
              headers: { 'Authorization': `Bearer ${freshToken}` }
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              if (!isCancelled && retryData) {
                setDbUser(retryData);
                return;
              }
            }
          } catch (refreshErr) {
            console.warn("Token refresh attempt notice:", refreshErr);
          }
        }

        // If Cloud SQL endpoint fails or session token is invalid, fallback gracefully
        if (auth.currentUser) {
          const isMaster = auth.currentUser.email === 'birajkdl@gmail.com';
          if (!isCancelled) {
            setDbUser(prev => prev || {
              id: 1,
              uid: auth.currentUser!.uid,
              email: auth.currentUser!.email || '',
              displayName: auth.currentUser!.displayName || auth.currentUser!.email?.split('@')[0] || 'User',
              photoURL: auth.currentUser!.photoURL || null,
              role: isMaster ? 'Super Administrator' : 'Meteorologist',
              assignedStationId: null
            });
          }
        } else {
          // Stale non-Firebase token
          localStorage.removeItem('metis_auth_token');
          if (!isCancelled) {
            setToken(null);
            setDbUser(null);
          }
        }
      } catch (err: any) {
        console.warn("User profile fetch note:", err?.message || err);
        if (auth.currentUser && !isCancelled) {
          const isMaster = auth.currentUser.email === 'birajkdl@gmail.com';
          setDbUser(prev => prev || {
            id: 1,
            uid: auth.currentUser!.uid,
            email: auth.currentUser!.email || '',
            displayName: auth.currentUser!.displayName || auth.currentUser!.email?.split('@')[0] || 'User',
            photoURL: auth.currentUser!.photoURL || null,
            role: isMaster ? 'Super Administrator' : 'Meteorologist',
            assignedStationId: null
          });
        }
      }
    };

    loadUserProfile(token);

    return () => {
      isCancelled = true;
    };
  }, [token]);

  // Deep Link & Email Link Redirect Handler
  useEffect(() => {
    if (loadingAuth) return;

    const params = new URLSearchParams(window.location.search);
    const ticketParam = params.get('ticket') || params.get('ticketNumber');
    const woParam = params.get('workOrder') || params.get('workOrderId');
    const viewParam = params.get('view');

    let pending: { tab: 'tickets' | 'work-orders'; ticketNumber?: string; workOrderId?: string } | null = null;

    if (ticketParam) {
      pending = { tab: 'tickets', ticketNumber: ticketParam };
    } else if (woParam) {
      pending = { tab: 'work-orders', workOrderId: woParam };
    } else if (viewParam === 'maintenance') {
      pending = { tab: 'tickets' };
    }

    if (!pending) {
      try {
        const stored = sessionStorage.getItem('metis_pending_deeplink');
        if (stored) pending = JSON.parse(stored);
      } catch (e) {}
    }

    if (pending) {
      sessionStorage.setItem('metis_pending_deeplink', JSON.stringify(pending));

      if (!user && !dbUser) {
        setIsAuthModalOpen(true);
      } else {
        sessionStorage.removeItem('metis_pending_deeplink');
        setActiveView('maintenance');
        setMaintenanceTarget(pending);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [loadingAuth, user, dbUser]);

  // Auth actions
  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('metis_auth_token');
      localStorage.removeItem('metis_user_email');
      setToken(null);
      setUser(null);
      setDbUser(null);
      await signOut(auth);
    } catch (e) {
      console.error("Sign-out failed:", e);
    }
  };

  // Submissions (Gated with Firebase JWT)

  const handleAddStationSubmit = async (data: { stationName: string; region: string; latitude: number; longitude: number; batteryVoltageType?: string; batteryCurrentVoltage?: number; stationType?: string; regionalOfficeId?: number | null; simNumber?: string | null; wigosSeries?: string; wigosIssuer?: string; wigosIssueNum?: string; wigosLocalId?: string }) => {
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

  const handleEditStationSubmit = async (stationId: number, data: { stationName: string; region: string; latitude: number; longitude: number; batteryVoltageType?: string; batteryCurrentVoltage?: number; stationType?: string; regionalOfficeId?: number | null; simNumber?: string | null; wigosSeries?: string; wigosIssuer?: string; wigosIssueNum?: string; wigosLocalId?: string }) => {
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
        isFirstInstall={isFirstInstall}
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

        {/* PRINT ONLY SYSTEM REPORT BANNER */}
        <div className="hidden print:block border-b-2 border-black pb-4 mb-6 print-header-block">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold font-serif tracking-tight text-black m-0 leading-tight">
                METIS
              </h1>
              <p className="text-[10px] font-mono tracking-widest text-zinc-600 uppercase mt-0.5">
                Meteorological Telemetry & Instrument Suite
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-black border border-black bg-zinc-100 px-1.5 py-0.5 rounded">
                Official Departmental Record
              </span>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-dashed border-zinc-300 grid grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Report Classification</p>
              <p className="font-semibold text-black mt-0.5">RESTRICTED — INTERNAL METEOROLOGICAL SERVICE USE ONLY</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Printed Document Title</p>
              <p className="font-semibold text-black mt-0.5">
                {activeView === 'dashboard' ? "Executive Performance & Operations Summary" :
                 activeView === 'stations' ? "Meteorological Terminal Registry & Hardware Ledger" :
                 activeView === 'inventory' ? "Central Physical Telemetry Instrument Inventory" :
                 activeView === 'alerts' ? "Active System Alerts & Diagnostic Exception Ledger" :
                 activeView === 'status-tracking' ? "Operational Status Tracking & Equipment Lifespan Logs" :
                 activeView === 'deployments' ? "Sensor Deployment & Station Allocation History" :
                 activeView === 'transfers' ? "Inter-agency Logistics & Hardware Transfer Ledger" :
                 activeView === 'administration' ? "User Security Authorization & Access Control Logs" :
                 activeView === 'warranty' ? "Asset Warranty Protection & Lifecycle Audits" :
                 activeView === 'notifications' ? "System Dispatch Logs & Broadcast Audits" :
                 activeView === 'reports' ? "Comprehensive Sensor & Station Analytics Report" :
                 activeView === 'audit' ? "System Compliance & Database Transaction Log Trail" :
                 activeView === 'suppliers' ? "Supplier & Procurement Vendor Registry" :
                 activeView === 'documents' ? "Standard Operating Procedures & Manuals" :
                 activeView === 'calibration-lab' ? "Meteorological Calibration Lab & Reference Equipment Registry" :
                 activeView === 'maintenance' ? "Station Issue Tickets & Maintenance Work Orders" :
                 "Meteorological Instrument Service Log"}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Generated On</p>
              <p className="font-semibold text-black mt-0.5">{new Date().toLocaleString()}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Requested By</p>
              <p className="font-semibold text-black mt-0.5">{user?.email || dbUser?.email || "Authenticated METIS Administrator"}</p>
            </div>
          </div>
        </div>

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
            onNavigateToMaintenance={handleNavigateToMaintenance}
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
              onNavigateToMaintenance={(target) => {
                setActiveView('maintenance');
                setMaintenanceTarget(target);
              }}
            />
          </div>
        ) : activeView === 'station-health' ? (
          <StationHealthView
            stations={stations}
            isAuthenticated={!!token}
            token={token}
            userRole={dbUser ? dbUser.role : null}
            onRefreshStations={fetchData}
            onNavigateToMaintenance={handleNavigateToMaintenance}
          />
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
            onOpenSensorRegistration={() => {
              setActiveView('registration');
            }}
          />
        ) : activeView === 'alerts' ? (
          <AlertsView
            sensors={sensors}
            stations={stations}
            isAuthenticated={!!token}
            onDismissAlert={handleDismissAlert}
            onRefresh={fetchData}
            onNavigateToMaintenance={(target) => {
              setActiveView('maintenance');
              setMaintenanceTarget(target);
            }}
          />
        ) : (activeView === 'status-tracking' || activeView === 'deployments' || activeView === 'transfers' || activeView === 'lifecycle') ? (
          <SensorLifecycleManager
            sensors={sensors}
            stations={stations}
            isAuthenticated={!!token}
            onUpdateSensor={handleEditSensorSubmit}
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
              prefilledWarrantyClaim={incomingWarrantyClaim}
              onClearPrefilledClaim={() => setIncomingWarrantyClaim(null)}
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
        ) : activeView === 'calibration-lab' ? (
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-zinc-950/20 text-gray-900 dark:text-gray-100">
            <CalibrationLab
              sensors={sensors}
              onRefresh={fetchData}
              user={dbUser}
              token={token}
              onTriggerWarrantyClaim={(claim) => {
                setIncomingWarrantyClaim(claim);
                setActiveView('warranty');
              }}
            />
          </div>
        ) : activeView === 'installation-planning' ? (
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-zinc-950/20 text-gray-900 dark:text-gray-100">
            <InstallationPlanner
              sensors={sensors}
              stations={stations}
              isAuthenticated={!!token}
              onRefresh={fetchData}
              token={token}
            />
          </div>
        ) : activeView === 'capital-budgeting' ? (
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-zinc-950/20 text-gray-900 dark:text-gray-100">
            <CapitalBudgeting
              sensors={sensors}
              stations={stations}
              isAuthenticated={!!token}
              onRefresh={fetchData}
              token={token}
            />
          </div>
        ) : activeView === 'maintenance' ? (
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-zinc-950/20 text-gray-900 dark:text-gray-100">
            <MaintenanceModule
              stations={stations}
              sensors={sensors}
              currentUser={user || dbUser}
              initialTab={maintenanceTarget?.tab}
              selectedTicketNumber={maintenanceTarget?.ticketNumber}
              selectedWorkOrderId={maintenanceTarget?.workOrderId}
              selectedStationId={maintenanceTarget?.stationId}
              autoOpenCreateTicket={maintenanceTarget?.autoOpenCreateTicket}
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
        isFirstInstall={isFirstInstall}
        onAuthSuccess={(t) => {
          setToken(t);
          setIsFirstInstall(false);
          fetch('/api/me', {
            headers: {
              'Authorization': `Bearer ${t}`
            }
          })
          .then(res => res.ok ? res.json() : null)
          .then(profile => {
            if (profile) {
              setDbUser(profile);
              setUser({
                email: profile.email,
                displayName: profile.username || profile.email.split('@')[0],
                uid: profile.userId
              } as any);
            }
          })
          .catch(e => console.warn("Failed to load profile after auth success:", e));
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
      <AnimatePresence>
        {quickViewStation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="bg-[#0c0c0e] border border-[#1f1f23] rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl custom-scrollbar"
            >
              <div className="p-5 border-b border-[#1f1f23] flex items-center justify-between bg-[#131316] sticky top-0 z-10">
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
              
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Station Name</label>
                    <p className="text-sm text-zinc-100 font-semibold">{quickViewStation.stationName}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Region / Office</label>
                    <p className="text-sm text-zinc-100">{quickViewStation.region}</p>
                  </div>
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

                {/* Performance Grade & Health Snapshot Card */}
                {telemetryHeartbeat && (
                  <div id="quickview-performance-grade-card" className="p-3.5 bg-[#08080a] border border-[#131316] rounded-md space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-blue-400" />
                        <span className="text-[10px] font-mono font-bold text-zinc-300 uppercase tracking-wider">
                          Performance Grade & Health Snapshot
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-500">24h Telemetry Metric</span>
                    </div>

                    <div className="flex items-center justify-between bg-[#0e0e12] p-3 rounded-md border border-[#1a1a20]">
                      <div className="flex items-center gap-3">
                        {/* Performance Grade Letter Box */}
                        <div className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center font-mono font-bold border shadow-inner ${
                          telemetryHeartbeat.performanceGrade === 'A+' || telemetryHeartbeat.performanceGrade === 'A'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10'
                            : telemetryHeartbeat.performanceGrade === 'B'
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-blue-500/10'
                            : telemetryHeartbeat.performanceGrade === 'C'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/10'
                            : 'bg-red-500/10 border-red-500/30 text-red-400 shadow-red-500/10'
                        }`}>
                          <span className="text-base leading-none">{telemetryHeartbeat.performanceGrade || 'A+'}</span>
                          <span className="text-[8px] opacity-75 font-sans mt-0.5">GRADE</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-white">
                              {telemetryHeartbeat.performanceScore || 96}/100
                            </span>
                            <span className="text-[10px] text-zinc-400 font-sans">Health Score</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {telemetryHeartbeat.performanceGrade === 'A+' || telemetryHeartbeat.performanceGrade === 'A'
                              ? 'Optimal telemetry heartbeat & stable transmission'
                              : telemetryHeartbeat.performanceGrade === 'B'
                              ? 'Good integrity with minor voltage fluctuation'
                              : telemetryHeartbeat.performanceGrade === 'C'
                              ? 'Sub-optimal power or scheduled maintenance'
                              : 'Critical telemetry disruption or low voltage'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Health Factors Breakdown */}
                    {telemetryHeartbeat.healthFactors && (
                      <div className="grid grid-cols-3 gap-2 text-[9px] font-mono">
                        <div className="bg-[#050507] p-2 rounded border border-[#141418]">
                          <span className="text-zinc-500 block uppercase text-[8px] font-bold">Power Grid</span>
                          <span className={`font-semibold ${
                            telemetryHeartbeat.healthFactors.powerHealth === 'Optimal' ? 'text-emerald-400' :
                            telemetryHeartbeat.healthFactors.powerHealth === 'Fair' ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {telemetryHeartbeat.healthFactors.powerHealth}
                          </span>
                        </div>
                        <div className="bg-[#050507] p-2 rounded border border-[#141418]">
                          <span className="text-zinc-500 block uppercase text-[8px] font-bold">Signal Quality</span>
                          <span className={`font-semibold ${
                            telemetryHeartbeat.healthFactors.signalHealth === 'Strong' ? 'text-emerald-400' :
                            telemetryHeartbeat.healthFactors.signalHealth === 'Moderate' ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {telemetryHeartbeat.healthFactors.signalHealth}
                          </span>
                        </div>
                        <div className="bg-[#050507] p-2 rounded border border-[#141418]">
                          <span className="text-zinc-500 block uppercase text-[8px] font-bold">Sensor Health</span>
                          <span className="text-blue-400 font-semibold">
                            {telemetryHeartbeat.healthFactors.sensorIntegrity}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Embedded Historical Battery Voltage Trend Line (Recharts) */}
                    {telemetryHeartbeat.trendHistory && telemetryHeartbeat.trendHistory.length > 0 && (() => {
                      const trend = telemetryHeartbeat.trendHistory;
                      const voltages = trend.map((t: any) => t.voltage);
                      const avgVoltage = voltages.length > 0 ? voltages.reduce((acc: number, v: number) => acc + v, 0) / voltages.length : 12.0;

                      const SAFE_MIN = sparklineThresholdMode === 'adaptive'
                        ? Number((avgVoltage * 0.90).toFixed(2))
                        : 11.8;
                      const SAFE_MAX = sparklineThresholdMode === 'adaptive'
                        ? Number((avgVoltage * 1.10).toFixed(2))
                        : 13.2;

                      return (
                        <div className="pt-2 border-t border-[#131316] space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <Zap className="h-3.5 w-3.5 text-amber-400" />
                              <span className="text-[10px] font-mono font-bold text-zinc-300 uppercase tracking-wider">
                                Historical Voltage Trend (24h)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Smooth Layout Transition Animated Toggle */}
                              <div id="sparkline-threshold-toggle" className="relative flex items-center bg-[#0a0a0e] border border-[#1f1f28] p-0.5 rounded">
                                <button
                                  type="button"
                                  onClick={() => setSparklineThresholdMode('strict')}
                                  className={`relative z-10 px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer select-none ${
                                    sparklineThresholdMode === 'strict'
                                      ? 'text-white'
                                      : 'text-zinc-400 hover:text-zinc-200'
                                  }`}
                                  title="Strict safety threshold (11.8V – 13.2V standard limit)"
                                >
                                  {sparklineThresholdMode === 'strict' && (
                                    <motion.div
                                      layoutId="sparkline-threshold-active-pill"
                                      className="absolute inset-0 bg-blue-600 rounded shadow-sm"
                                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                    />
                                  )}
                                  <span className="relative z-10">Strict (11.8-13.2V)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSparklineThresholdMode('adaptive')}
                                  className={`relative z-10 px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer select-none ${
                                    sparklineThresholdMode === 'adaptive'
                                      ? 'text-white'
                                      : 'text-zinc-400 hover:text-zinc-200'
                                  }`}
                                  title="Adaptive threshold (±10% of moving average)"
                                >
                                  {sparklineThresholdMode === 'adaptive' && (
                                    <motion.div
                                      layoutId="sparkline-threshold-active-pill"
                                      className="absolute inset-0 bg-purple-600 rounded shadow-sm"
                                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                    />
                                  )}
                                  <span className="relative z-10">Adaptive (±10% Avg)</span>
                                </button>
                              </div>

                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                                Cur: <strong className="text-white font-mono font-bold">{quickViewStation.batteryCurrentVoltage !== null && quickViewStation.batteryCurrentVoltage !== undefined ? `${quickViewStation.batteryCurrentVoltage}V` : `${(trend[trend.length - 1]?.voltage || 12.2).toFixed(2)}V`}</strong>
                              </span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                                (quickViewStation.batteryCurrentVoltage ?? 12.2) >= 12.0
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : (quickViewStation.batteryCurrentVoltage ?? 12.2) >= 11.5
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                {(quickViewStation.batteryCurrentVoltage ?? 12.2) >= 12.0 ? 'Optimal' : (quickViewStation.batteryCurrentVoltage ?? 12.2) >= 11.5 ? 'Moderate' : 'Low'}
                              </span>
                            </div>
                          </div>

                          {/* Recharts Trend Line Container */}
                          <div className="h-28 w-full bg-[#050507] border border-[#141418] rounded p-2 pt-2.5">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={trend}
                                margin={{ top: 4, right: 10, left: -22, bottom: 0 }}
                              >
                                <CartesianGrid stroke="#1a1a22" strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                  dataKey="time"
                                  stroke="#52525b"
                                  fontSize={9}
                                  tickLine={false}
                                  axisLine={false}
                                  dy={2}
                                />
                                <YAxis
                                  stroke="#52525b"
                                  fontSize={9}
                                  domain={[
                                    (dataMin: number) => Math.max(9.5, Number((Math.min(dataMin, SAFE_MIN) - 0.2).toFixed(1))),
                                    (dataMax: number) => Math.min(15.0, Number((Math.max(dataMax, SAFE_MAX) + 0.2).toFixed(1)))
                                  ]}
                                  tickFormatter={(val: number) => `${val.toFixed(1)}V`}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <ReferenceLine
                                  y={SAFE_MIN}
                                  stroke={sparklineThresholdMode === 'adaptive' ? '#a855f7' : '#f59e0b'}
                                  strokeDasharray="2 2"
                                  label={{
                                    value: sparklineThresholdMode === 'adaptive' ? `-10% (${SAFE_MIN}V)` : '11.8V Min',
                                    position: 'right',
                                    fill: sparklineThresholdMode === 'adaptive' ? '#c084fc' : '#fbbf24',
                                    fontSize: 8
                                  }}
                                />
                                <ReferenceLine
                                  y={SAFE_MAX}
                                  stroke={sparklineThresholdMode === 'adaptive' ? '#a855f7' : '#3b82f6'}
                                  strokeDasharray="2 2"
                                  label={{
                                    value: sparklineThresholdMode === 'adaptive' ? `+10% (${SAFE_MAX}V)` : '13.2V Max',
                                    position: 'right',
                                    fill: sparklineThresholdMode === 'adaptive' ? '#c084fc' : '#60a5fa',
                                    fontSize: 8
                                  }}
                                />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      const v = Number(data.voltage);
                                      const isGood = v >= SAFE_MIN && v <= SAFE_MAX;
                                      return (
                                        <div className="bg-[#09090b] border border-zinc-800 rounded px-2.5 py-1.5 shadow-xl text-[10px] font-mono">
                                          <div className="text-zinc-400 font-semibold">{data.time} UTC</div>
                                          <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-zinc-500">Voltage:</span>
                                            <span className={`font-bold ${isGood ? 'text-emerald-400' : 'text-amber-400'}`}>
                                              {v.toFixed(2)} V
                                            </span>
                                          </div>
                                          <div className="text-[9px] text-zinc-500 mt-0.5">
                                            Threshold ({sparklineThresholdMode}): {SAFE_MIN}V – {SAFE_MAX}V ({isGood ? 'Within Bounds' : 'Out of Bounds'})
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="voltage"
                                  stroke={
                                    telemetryHeartbeat.performanceGrade === 'A+' || telemetryHeartbeat.performanceGrade === 'A'
                                      ? '#10b981'
                                      : telemetryHeartbeat.performanceGrade === 'B'
                                      ? '#06b6d4'
                                      : telemetryHeartbeat.performanceGrade === 'C'
                                      ? '#f59e0b'
                                      : '#ef4444'
                                  }
                                  strokeWidth={2}
                                  dot={{
                                    r: 2,
                                    fill: '#09090b',
                                    strokeWidth: 1.5,
                                    stroke: telemetryHeartbeat.performanceGrade === 'A+' || telemetryHeartbeat.performanceGrade === 'A'
                                      ? '#10b981'
                                      : telemetryHeartbeat.performanceGrade === 'B'
                                      ? '#06b6d4'
                                      : telemetryHeartbeat.performanceGrade === 'C'
                                      ? '#f59e0b'
                                      : '#ef4444'
                                  }}
                                  activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 1.5 }}
                                  isAnimationActive={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Power Stability Summary Metrics */}
                          <div className="grid grid-cols-4 gap-1.5 text-[9px] font-mono text-center">
                            <div className="bg-[#050507] p-1.5 rounded border border-[#141418]">
                              <span className="text-zinc-500 block uppercase text-[8px]">Min Volts</span>
                              <span className="font-bold text-zinc-300">
                                {Math.min(...voltages).toFixed(2)}V
                              </span>
                            </div>
                            <div className="bg-[#050507] p-1.5 rounded border border-[#141418]">
                              <span className="text-zinc-500 block uppercase text-[8px]">Avg Volts</span>
                              <span className="font-bold text-zinc-300">
                                {avgVoltage.toFixed(2)}V
                              </span>
                            </div>
                            <div className="bg-[#050507] p-1.5 rounded border border-[#141418]">
                              <span className="text-zinc-500 block uppercase text-[8px]">Max Volts</span>
                              <span className="font-bold text-zinc-300">
                                {Math.max(...voltages).toFixed(2)}V
                              </span>
                            </div>
                            <div className="bg-[#050507] p-1.5 rounded border border-[#141418]">
                              <span className="text-zinc-500 block uppercase text-[8px]">Delta (Δ)</span>
                              <span className="font-bold text-blue-400">
                                {(Math.max(...voltages) - Math.min(...voltages)).toFixed(2)}V
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Last Data Sync & Sparkline Field */}
                <div id="quickview-telemetry-sync-card" className="space-y-3 p-3.5 bg-[#08080a] border border-[#131316] rounded-md">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block flex items-center justify-between">
                    <span>Last Data Sync & Heartbeat</span>
                    {loadingTelemetry ? (
                      <span className="text-blue-400 font-semibold lowercase animate-pulse">polling heartbeat...</span>
                    ) : (
                      <span className="text-zinc-600 font-normal">telemetry status</span>
                    )}
                  </label>
                  {loadingTelemetry ? (
                    <div className="flex items-center space-x-2 py-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                      <span className="text-xs text-zinc-500 font-mono">Connecting with terminal mast...</span>
                    </div>
                  ) : telemetryHeartbeat ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-100 font-semibold font-mono tracking-wide">
                          {telemetryHeartbeat.lastSync}
                        </span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                          telemetryHeartbeat.status === 'Offline' 
                            ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                            : telemetryHeartbeat.status === 'Maintenance' 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {telemetryHeartbeat.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#131316] text-[10px] font-mono text-zinc-500">
                        <div>
                          <span className="text-[8px] text-zinc-600 block uppercase font-bold">Signal</span>
                          <span className={telemetryHeartbeat.signalStrengthDb > -80 ? "text-emerald-400" : telemetryHeartbeat.signalStrengthDb > -100 ? "text-amber-400" : "text-red-400"}>
                            {telemetryHeartbeat.signalStrengthDb} dBm
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-600 block uppercase font-bold">Enc. Temp</span>
                          <span className="text-zinc-300">
                            {telemetryHeartbeat.enclosureTempCelsius}°C
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-600 block uppercase font-bold">Heartbeat</span>
                          <span className="text-zinc-300">
                            {telemetryHeartbeat.heartbeatRateHz} Hz
                          </span>
                        </div>
                      </div>

                      {/* Summary Telemetry Sparkline Chart */}
                      {telemetryHeartbeat.trendHistory && telemetryHeartbeat.trendHistory.length > 0 && (
                        <div id="quickview-telemetry-sparkline-chart" className="space-y-2 pt-2 border-t border-[#131316]">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] font-mono text-zinc-400 gap-1.5">
                            <span className="flex items-center gap-1 text-zinc-300 font-semibold">
                              <Activity className="h-3 w-3 text-blue-400" />
                              24h Telemetry Voltage Sparkline
                            </span>

                            {/* Strict vs Adaptive Threshold Toggle */}
                            <div id="sparkline-threshold-toggle-secondary" className="relative flex items-center bg-[#0a0a0e] border border-[#1f1f28] p-0.5 rounded">
                              <button
                                type="button"
                                onClick={() => setSparklineThresholdMode('strict')}
                                className={`relative z-10 px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer select-none ${
                                  sparklineThresholdMode === 'strict'
                                    ? 'text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                                title="Strict safety threshold (11.8V – 13.2V standard limit)"
                              >
                                {sparklineThresholdMode === 'strict' && (
                                  <motion.div
                                    layoutId="sparkline-threshold-active-pill-secondary"
                                    className="absolute inset-0 bg-blue-600 rounded shadow-sm"
                                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                  />
                                )}
                                <span className="relative z-10">Strict (11.8-13.2V)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSparklineThresholdMode('adaptive')}
                                className={`relative z-10 px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer select-none ${
                                  sparklineThresholdMode === 'adaptive'
                                    ? 'text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                                title="Adaptive threshold (±10% of moving average)"
                              >
                                {sparklineThresholdMode === 'adaptive' && (
                                  <motion.div
                                    layoutId="sparkline-threshold-active-pill-secondary"
                                    className="absolute inset-0 bg-purple-600 rounded shadow-sm"
                                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                  />
                                )}
                                <span className="relative z-10">Adaptive (±10% Avg)</span>
                              </button>
                            </div>
                          </div>

                          <div className="bg-[#050507] p-2.5 rounded border border-[#141418] space-y-2">
                            {(() => {
                              const trend = telemetryHeartbeat.trendHistory;
                              const voltages = trend.map((t: any) => t.voltage);
                              const avgVoltage = voltages.length > 0 ? voltages.reduce((acc: number, v: number) => acc + v, 0) / voltages.length : 12.0;

                              const SAFE_MIN = sparklineThresholdMode === 'adaptive'
                                ? Number((avgVoltage * 0.90).toFixed(2))
                                : 11.8;
                              const SAFE_MAX = sparklineThresholdMode === 'adaptive'
                                ? Number((avgVoltage * 1.10).toFixed(2))
                                : 13.2;

                              const axisMin = Math.min(...voltages, SAFE_MIN - 0.3);
                              const axisMax = Math.max(...voltages, SAFE_MAX + 0.3);
                              const range = axisMax - axisMin || 1;
                              const width = 340;
                              const height = 52;
                              const padding = 8;

                              const points = trend.map((t: any, i: number) => {
                                const x = (i / (trend.length - 1)) * width;
                                const y = height - ((t.voltage - axisMin) / range) * (height - padding * 2) - padding;
                                const isUnder = t.voltage < SAFE_MIN;
                                const isOver = t.voltage > SAFE_MAX;
                                const isOut = isUnder || isOver;
                                return { x, y, isUnder, isOver, isOut, ...t };
                              });

                              const pathD = points.reduce((acc: string, p: any, i: number) => {
                                return i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`;
                              }, '');

                              const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

                              // Calculate Y coordinates for SAFE_MIN and SAFE_MAX threshold lines
                              const ySafeMin = height - ((SAFE_MIN - axisMin) / range) * (height - padding * 2) - padding;
                              const ySafeMax = height - ((SAFE_MAX - axisMin) / range) * (height - padding * 2) - padding;

                              const driftedPoints = points.filter((p: any) => p.isOut);
                              const hasDrift = driftedPoints.length > 0;
                              const isLow = telemetryHeartbeat.status === 'Offline' || Math.min(...voltages) < 11.2;

                              const activePoint = hoveredSparklineIndex !== null && points[hoveredSparklineIndex] ? points[hoveredSparklineIndex] : null;

                              return (
                                <div className="space-y-2">
                                  {/* Range Threshold Status Bar */}
                                  <div className="flex items-center justify-between text-[9px] font-mono px-1 py-0.5 border-b border-[#131316]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-zinc-500 font-bold uppercase">Thresholds:</span>
                                      <span className={`font-semibold px-1.5 py-0.2 rounded border ${
                                        sparklineThresholdMode === 'adaptive'
                                          ? 'text-purple-300 bg-purple-500/10 border-purple-500/20'
                                          : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                      }`}>
                                        {SAFE_MIN}V – {SAFE_MAX}V {sparklineThresholdMode === 'adaptive' ? `(±10% Avg: ${avgVoltage.toFixed(2)}V)` : '(Strict)'}
                                      </span>
                                    </div>
                                    <div>
                                      {hasDrift ? (
                                        <span className="text-red-400 font-bold flex items-center gap-1 bg-red-500/10 px-1.5 py-0.2 rounded border border-red-500/20">
                                          <AlertTriangle className="h-2.5 w-2.5 text-red-400" />
                                          {driftedPoints.length} Drift{driftedPoints.length > 1 ? 's' : ''} Out of Range
                                        </span>
                                      ) : (
                                        <span className="text-emerald-400 font-medium flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                          <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
                                          Nominal Range
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Hover Inspection Tooltip Card */}
                                  {activePoint ? (
                                    <div id="sparkline-hover-inspection-tooltip" className="bg-[#0f0f14] border border-blue-500/40 rounded-md p-2 text-[10px] font-mono text-zinc-100 shadow-xl space-y-1 transition-all duration-150">
                                      <div className="flex items-center justify-between text-[9px] border-b border-[#1a1a22] pb-1">
                                        <span className="text-blue-400 font-bold flex items-center gap-1">
                                          <Zap className="h-3 w-3 text-blue-400" />
                                          INSPECT POINT #{hoveredSparklineIndex! + 1} OF {points.length}
                                        </span>
                                        <span className="text-zinc-300 font-semibold">{activePoint.time} UTC</span>
                                      </div>
                                      
                                      <div className="grid grid-cols-3 gap-2 pt-0.5">
                                        <div>
                                          <span className="text-zinc-500 block text-[8px] font-bold uppercase">Voltage</span>
                                          <span className={`text-xs font-bold ${
                                            activePoint.isUnder ? 'text-red-400' :
                                            activePoint.isOver ? 'text-amber-400' :
                                            'text-emerald-400'
                                          }`}>
                                            {activePoint.voltage.toFixed(2)} V
                                          </span>
                                        </div>

                                        <div>
                                          <span className="text-zinc-500 block text-[8px] font-bold uppercase">Signal</span>
                                          <span className="text-xs font-bold text-zinc-200">
                                            {activePoint.signal !== undefined ? `${activePoint.signal} dBm` : '-'}
                                          </span>
                                        </div>

                                        <div>
                                          <span className="text-zinc-500 block text-[8px] font-bold uppercase">Range Status</span>
                                          {activePoint.isUnder ? (
                                            <span className="text-red-400 font-bold text-[9px]">⚠️ &lt; {SAFE_MIN}V Low</span>
                                          ) : activePoint.isOver ? (
                                            <span className="text-amber-400 font-bold text-[9px]">⚠️ &gt; {SAFE_MAX}V High</span>
                                          ) : (
                                            <span className="text-emerald-400 font-semibold text-[9px]">✓ Nominal</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-[9px] font-mono text-zinc-500 italic text-center py-1 bg-[#0a0a0e] rounded border border-[#14141a]">
                                      💡 Hover or tap data points on chart to inspect timestamp &amp; voltage
                                    </div>
                                  )}

                                  {/* SVG Sparkline with Safe Operating Band & Min/Max Lines */}
                                  <svg 
                                    viewBox={`0 0 ${width} ${height}`} 
                                    className="w-full h-16 overflow-visible cursor-crosshair"
                                    onMouseLeave={() => setHoveredSparklineIndex(null)}
                                  >
                                    <defs>
                                      <linearGradient id="quickViewSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={isLow ? '#ef4444' : '#10b981'} stopOpacity="0.35" />
                                        <stop offset="100%" stopColor={isLow ? '#ef4444' : '#10b981'} stopOpacity="0.0" />
                                      </linearGradient>
                                    </defs>

                                    {/* Shaded Safe Operating Range Band */}
                                    <rect 
                                      x="0" 
                                      y={Math.min(ySafeMax, ySafeMin)} 
                                      width={width} 
                                      height={Math.max(2, Math.abs(ySafeMin - ySafeMax))} 
                                      fill={sparklineThresholdMode === 'adaptive' ? "#a855f7" : "#10b981"} 
                                      fillOpacity="0.07" 
                                      rx="2"
                                    />

                                    {/* Max Safe Threshold Line */}
                                    <line 
                                      x1="0" 
                                      y1={ySafeMax} 
                                      x2={width} 
                                      y2={ySafeMax} 
                                      stroke={sparklineThresholdMode === 'adaptive' ? "#c084fc" : "#3b82f6"} 
                                      strokeDasharray="3 3" 
                                      strokeWidth="1" 
                                      strokeOpacity="0.6" 
                                    />
                                    <text x={width - 2} y={ySafeMax - 2} textAnchor="end" fill={sparklineThresholdMode === 'adaptive' ? "#e9d5ff" : "#60a5fa"} fontSize="6.5" fontFamily="monospace">
                                      MAX {SAFE_MAX}V {sparklineThresholdMode === 'adaptive' ? '(+10%)' : ''}
                                    </text>

                                    {/* Min Safe Threshold Line */}
                                    <line 
                                      x1="0" 
                                      y1={ySafeMin} 
                                      x2={width} 
                                      y2={ySafeMin} 
                                      stroke="#f87171" 
                                      strokeDasharray="3 3" 
                                      strokeWidth="1" 
                                      strokeOpacity="0.6" 
                                    />
                                    <text x={width - 2} y={ySafeMin + 7} textAnchor="end" fill="#f87171" fontSize="6.5" fontFamily="monospace">
                                      MIN {SAFE_MIN}V {sparklineThresholdMode === 'adaptive' ? '(-10%)' : ''}
                                    </text>

                                    {/* Telemetry Voltage Area & Path */}
                                    <path d={areaD} fill="url(#quickViewSparklineGrad)" />
                                    <path d={pathD} fill="none" stroke={isLow ? '#f87171' : '#34d399'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                                    {/* Vertical Crosshair Line for Active Hovered Point */}
                                    {activePoint && (
                                      <g>
                                        <line 
                                          x1={activePoint.x} 
                                          y1={0} 
                                          x2={activePoint.x} 
                                          y2={height} 
                                          stroke="#60a5fa" 
                                          strokeDasharray="2 2" 
                                          strokeWidth="1" 
                                          strokeOpacity="0.85" 
                                        />
                                        <circle 
                                          cx={activePoint.x} 
                                          cy={activePoint.y} 
                                          r="6" 
                                          fill="none" 
                                          stroke="#60a5fa" 
                                          strokeWidth="1.5" 
                                          className="animate-pulse" 
                                        />
                                      </g>
                                    )}

                                    {/* Data Points with Threshold Alerts */}
                                    {points.map((p: any, idx: number) => {
                                      const isLast = idx === points.length - 1;
                                      const isHovered = hoveredSparklineIndex === idx;
                                      return (
                                        <g key={idx}>
                                          {/* Pulse Ring for Out-of-Range Drift */}
                                          {p.isOut && !isHovered && (
                                            <circle 
                                              cx={p.x} 
                                              cy={p.y} 
                                              r="5" 
                                              className={p.isUnder ? "fill-red-500/30 animate-ping" : "fill-amber-500/30 animate-ping"} 
                                            />
                                          )}
                                          
                                          {/* Data Point Marker */}
                                          <circle 
                                            cx={p.x} 
                                            cy={p.y} 
                                            r={isHovered ? "4" : p.isOut ? "3.5" : isLast ? "3" : "1.8"} 
                                            className={
                                              isHovered ? (p.isUnder ? "fill-red-400 stroke-white stroke-2" : p.isOver ? "fill-amber-400 stroke-white stroke-2" : "fill-blue-400 stroke-white stroke-2") :
                                              p.isUnder ? "fill-red-400 stroke-red-200 stroke-1" :
                                              p.isOver ? "fill-amber-400 stroke-amber-200 stroke-1" :
                                              isLast ? (isLow ? "fill-red-400" : "fill-emerald-400") : "fill-zinc-400"
                                            }
                                          />

                                          {/* Transparent Hover Hitbox Overlay */}
                                          <rect 
                                            x={Math.max(0, p.x - width / (points.length * 2))} 
                                            y={0} 
                                            width={width / points.length} 
                                            height={height} 
                                            fill="transparent" 
                                            className="cursor-pointer" 
                                            onMouseEnter={() => setHoveredSparklineIndex(idx)} 
                                            onTouchStart={() => setHoveredSparklineIndex(idx)} 
                                          />
                                        </g>
                                      );
                                    })}
                                  </svg>

                                  <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 pt-0.5">
                                    <span>{trend[0]?.time}</span>
                                    <span className="text-zinc-400 font-semibold">
                                      Min: {Math.min(...voltages).toFixed(1)}V / Max: {Math.max(...voltages).toFixed(1)}V (Avg: {avgVoltage.toFixed(2)}V)
                                    </span>
                                    <span>{trend[trend.length - 1]?.time}</span>
                                  </div>

                                  {/* Dynamic Proactive Maintenance Ticket Generation Button */}
                                  {hasDrift && (
                                    <div id="proactive-maintenance-button-container" className="pt-2 mt-1 border-t border-amber-500/20">
                                      <button
                                        id="btn-schedule-proactive-maintenance"
                                        onClick={() => handleScheduleProactiveMaintenance(quickViewStation, driftedPoints, voltages, SAFE_MIN, SAFE_MAX, sparklineThresholdMode)}
                                        className="w-full py-2 px-3 bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition-all cursor-pointer animate-pulse"
                                      >
                                        <Wrench className="h-3.5 w-3.5 text-amber-200" />
                                        <span>Schedule Proactive Maintenance ({driftedPoints.length} Voltage Drifts)</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">No telemetry sync recorded.</p>
                  )}
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
                      setMaintenanceTarget({
                        tab: 'tickets',
                        stationId: quickViewStation.stationId,
                        autoOpenCreateTicket: true
                      });
                      setActiveView('maintenance');
                      setQuickViewStation(null);
                    }}
                    className="w-full py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-amber-950/40"
                  >
                    <Wrench className="h-3.5 w-3.5 text-amber-200" />
                    <span>+ Create Maintenance Ticket</span>
                  </button>

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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QUICK VIEW SENSOR MODAL */}
      <AnimatePresence>
        {quickViewSensor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="bg-[#0c0c0e] border border-[#1f1f23] rounded-lg w-full max-w-md overflow-hidden shadow-2xl"
            >
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

              {/* Quick Note Section */}
              <div className="pt-3 border-t border-[#1f1f23] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">
                    Diagnostic Quick Note
                  </label>
                  {quickNoteSuccess && (
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 animate-in fade-in duration-300">
                      <Check className="h-3 w-3" />
                      <span>Saved successfully</span>
                    </span>
                  )}
                  {quickNoteError && (
                    <span className="text-[10px] text-rose-400 font-medium truncate max-w-[200px]">
                      {quickNoteError}
                    </span>
                  )}
                </div>

                <textarea
                  value={quickNoteValue}
                  onChange={(e) => {
                    setQuickNoteValue(e.target.value);
                    if (quickNoteSuccess) setQuickNoteSuccess(false);
                    if (quickNoteError) setQuickNoteError(null);
                  }}
                  disabled={savingQuickNote || !token || dbUser?.role === 'Read-only/Audit User'}
                  placeholder={
                    !token || dbUser?.role === 'Read-only/Audit User'
                      ? "Read-only access: Cannot add or modify diagnostic notes."
                      : "Type diagnostic comments, recent anomalies, or pending inspections..."
                  }
                  className="w-full h-20 px-3 py-2 bg-[#070709] rounded-lg border border-zinc-850 focus:outline-none focus:border-emerald-500 text-xs text-white placeholder-zinc-600 disabled:opacity-60 resize-none transition"
                />

                {token && dbUser?.role !== 'Read-only/Audit User' && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveQuickNote}
                      disabled={savingQuickNote}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-[11px] font-semibold transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Save className="h-3 w-3" />
                      <span>{savingQuickNote ? 'Saving...' : 'Save Diagnostic Comment'}</span>
                    </button>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Maintenance Ticket Dispatch Confirmation Modal */}
    {createdMaintenanceTicket && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-[#0c0c10] border border-amber-500/40 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl relative">
          <div className="flex items-start justify-between border-b border-[#1c1c28] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 rounded-full border border-amber-500/30">
                <Wrench className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">Maintenance Ticket Initiated</span>
                <h3 className="text-base font-serif text-white font-bold">{createdMaintenanceTicket.ticketId}</h3>
              </div>
            </div>
            <button 
              onClick={() => setCreatedMaintenanceTicket(null)}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="bg-[#121218] p-3 rounded border border-[#1e1e28] space-y-1.5">
              <div className="flex justify-between text-zinc-400">
                <span>Target Station:</span>
                <span className="text-zinc-100 font-bold">{createdMaintenanceTicket.stationName}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Province / Region:</span>
                <span className="text-zinc-200">{createdMaintenanceTicket.region}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Ticket Status:</span>
                <span className="text-emerald-400 font-bold">{createdMaintenanceTicket.status}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Timestamp:</span>
                <span className="text-zinc-300">{createdMaintenanceTicket.createdAt}</span>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded text-[11px] text-amber-200 space-y-1">
              <span className="font-bold block uppercase text-[9px] text-amber-400">Telemetry Voltage Drift Diagnostic:</span>
              <p className="leading-relaxed">{createdMaintenanceTicket.issue}</p>
            </div>

            <div className="bg-[#121218] p-3 rounded border border-[#1e1e28] space-y-1 text-[11px]">
              <span className="font-bold text-zinc-400 uppercase text-[9px] block">Assigned Unit:</span>
              <p className="text-zinc-200 font-semibold">{createdMaintenanceTicket.assignedTeam}</p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#1c1c28]">
            <button
              onClick={() => {
                setCreatedMaintenanceTicket(null);
                setActiveView('status-tracking');
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-mono font-bold transition cursor-pointer"
            >
              View Operations Lifecycle
            </button>
            <button
              onClick={() => setCreatedMaintenanceTicket(null)}
              className="px-4 py-2 bg-[#1a1a24] hover:bg-[#222230] text-zinc-300 rounded text-xs font-mono transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
}
