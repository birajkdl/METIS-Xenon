import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wrench, 
  CheckSquare, 
  ClipboardList, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Calendar, 
  Layers, 
  Cpu, 
  Sun, 
  Box, 
  Check, 
  ChevronRight, 
  FileText, 
  Save, 
  Search,
  Zap,
  CheckSquare as ChecklistIcon
} from 'lucide-react';
import { Sensor, WeatherStation } from '../types.ts';

interface InstallationProject {
  id: number;
  projectName: string;
  targetStationId: number | null;
  status: string; // 'Draft', 'Approved', 'Packed', 'Deployed'
  dataLoggerModel: string | null;
  solarPanelModel: string | null;
  enclosureModel: string | null;
  sensorIds: string | null;
  compatibilityStatus: string; // 'Valid', 'Warnings', 'Invalid', 'Unknown'
  compatibilityReport: string | null; // JSON report string
  scheduledDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface InstallationPlannerProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  isAuthenticated: boolean;
  onRefresh: () => Promise<void>;
  token: string | null;
}

export default function InstallationPlanner({
  sensors,
  stations,
  isAuthenticated,
  onRefresh,
  token
}: InstallationPlannerProps) {
  // Tabs
  const [activeTab, setActiveTab] = useState<'sandbox' | 'wmo'>('sandbox');

  // Loading States
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);
  const [projects, setProjects] = useState<InstallationProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<InstallationProject | null>(null);

  // WMO State
  const [selectedWmoSensorId, setSelectedWmoSensorId] = useState<number | null>(null);
  const [wmoObstacleDistance, setWmoObstacleDistance] = useState<number>(100);
  const [wmoObstacleHeight, setWmoObstacleHeight] = useState<number>(5);
  const [wmoSlope, setWmoSlope] = useState<number>(2);
  const [wmoSurface, setWmoSurface] = useState<string>('grass_short');
  const [wmoHeatDistance, setWmoHeatDistance] = useState<number>(100);
  const [savingWmo, setSavingWmo] = useState<boolean>(false);
  const [wmoSuccessMsg, setWmoSuccessMsg] = useState<string>('');

  // Sandbox Creation & Edit Modal
  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);
  const [projectForm, setProjectForm] = useState({
    id: null as number | null,
    projectName: '',
    targetStationId: '',
    status: 'Draft',
    dataLoggerModel: 'METIS-Logger-V2',
    solarPanelModel: '20W Solar Panel',
    enclosureModel: 'IP66 NEMA Weatherproof',
    sensorIds: [] as number[],
    scheduledDate: '',
    notes: ''
  });
  const [sensorSearchQuery, setSensorSearchQuery] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Notification Toast Helper
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Projects
  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/installation-projects', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (selectedProject) {
          const updated = data.find((p: any) => p.id === selectedProject.id);
          if (updated) setSelectedProject(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [token]);

  // Handle Save Project
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.projectName) {
      showToast('error', 'Project name is required');
      return;
    }

    const payload = {
      projectName: projectForm.projectName,
      targetStationId: projectForm.targetStationId ? parseInt(projectForm.targetStationId) : null,
      status: projectForm.status,
      dataLoggerModel: projectForm.dataLoggerModel,
      solarPanelModel: projectForm.solarPanelModel,
      enclosureModel: projectForm.enclosureModel,
      sensorIds: projectForm.sensorIds.join(','),
      scheduledDate: projectForm.scheduledDate,
      notes: projectForm.notes
    };

    try {
      const url = projectForm.id 
        ? `/api/installation-projects/${projectForm.id}`
        : '/api/installation-projects';
      
      const method = projectForm.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const saved = await res.json();
        showToast('success', `Project successfully ${projectForm.id ? 'updated' : 'created'}.`);
        setShowProjectModal(false);
        fetchProjects();
        if (projectForm.id) {
          setSelectedProject(saved);
        }
      } else {
        const errData = await res.json();
        showToast('error', errData.error || 'Failed to save project');
      }
    } catch (err) {
      console.error('Save project error:', err);
      showToast('error', 'Network error while saving project');
    }
  };

  // Delete Project
  const handleDeleteProject = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this installation project?')) return;
    try {
      const res = await fetch(`/api/installation-projects/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        showToast('success', 'Project deleted successfully.');
        setSelectedProject(null);
        fetchProjects();
      } else {
        showToast('error', 'Failed to delete project');
      }
    } catch (err) {
      console.error('Delete project error:', err);
    }
  };

  // Trigger Validation API
  const handleValidateProject = async (id: number) => {
    setIsValidating(true);
    try {
      const res = await fetch(`/api/installation-projects/${id}/validate`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        showToast('success', 'Compatibility report successfully compiled!');
        fetchProjects();
        onRefresh(); // Refresh central sensors state
      } else {
        showToast('error', 'Failed to compile validation report');
      }
    } catch (err) {
      console.error('Validate project error:', err);
      showToast('error', 'Network error during validation');
    } finally {
      setIsValidating(false);
    }
  };

  // Open Edit Modal
  const openEditProject = (proj: InstallationProject) => {
    setProjectForm({
      id: proj.id,
      projectName: proj.projectName,
      targetStationId: proj.targetStationId ? proj.targetStationId.toString() : '',
      status: proj.status,
      dataLoggerModel: proj.dataLoggerModel || '',
      solarPanelModel: proj.solarPanelModel || '',
      enclosureModel: proj.enclosureModel || '',
      sensorIds: proj.sensorIds ? proj.sensorIds.split(',').map(s => parseInt(s)).filter(s => !isNaN(s)) : [],
      scheduledDate: proj.scheduledDate || '',
      notes: proj.notes || ''
    });
    setSensorSearchQuery('');
    setShowProjectModal(true);
  };

  // Open Create Modal
  const openCreateProject = () => {
    setProjectForm({
      id: null,
      projectName: '',
      targetStationId: '',
      status: 'Draft',
      dataLoggerModel: 'Campbell Scientific CR1000X',
      solarPanelModel: '20W Solar Panel',
      enclosureModel: 'NEMA IP66 Fibreglass Enclosure',
      sensorIds: [],
      scheduledDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setSensorSearchQuery('');
    setShowProjectModal(true);
  };

  // Live WMO Calculator Engine (Based on WMO-No. 8 Guidelines)
  const calculateWmoClass = () => {
    const sensor = sensors.find(s => s.sensorId === selectedWmoSensorId);
    if (!sensor) return { rating: 'N/A', reason: 'Please select a sensor to evaluate.' };

    const type = (sensor.sensorType || '').toLowerCase();
    
    // Anemometer / Wind Sensor rules
    if (type.includes('wind') || type.includes('anemometer') || type.includes('vane')) {
      const distanceRatio = wmoObstacleDistance / (wmoObstacleHeight || 1);
      
      if (wmoObstacleDistance >= 100 || distanceRatio >= 10) {
        return { rating: 'Class 1', score: 1, reason: 'Pristine siting: Distance to major obstacles is >= 100m or 10x obstacle height.' };
      } else if (wmoObstacleDistance >= 30 || distanceRatio >= 4) {
        return { rating: 'Class 2', score: 2, reason: 'Good siting: Distance is >= 30m or 4x obstacle height. Standard operational margin.' };
      } else if (wmoObstacleDistance >= 10 || distanceRatio >= 2) {
        return { rating: 'Class 3', score: 3, reason: 'Fair siting: Distance >= 10m or 2x obstacle height. Potential local wind drag interference.' };
      } else if (wmoObstacleDistance >= 5) {
        return { rating: 'Class 4', score: 4, reason: 'Poor siting: Minor separation (>= 5m). Significant building wake drag likely.' };
      } else {
        return { rating: 'Class 5', score: 5, reason: 'Severely compromised siting: Distance is < 5m. Heavy turbulence & wake flow anomalies.' };
      }
    }

    // Thermometer / Humidity sensor rules
    if (type.includes('thermometer') || type.includes('temp') || type.includes('humidity') || type.includes('hygrometer')) {
      const surfaceType = wmoSurface;
      
      // Class 1 criteria
      if (wmoHeatDistance >= 100 && wmoSlope <= 10 && surfaceType === 'grass_short') {
        return { rating: 'Class 1', score: 1, reason: 'Reference quality: Over natural short grass, slope <= 10%, heat sources >= 100m.' };
      }
      // Class 2 criteria
      if (wmoHeatDistance >= 30 && wmoSlope <= 20 && (surfaceType === 'grass_short' || surfaceType === 'soil')) {
        return { rating: 'Class 2', score: 2, reason: 'Standard operational: Terrestrial cover, slope <= 20%, heat sources >= 30m.' };
      }
      // Class 3 criteria
      if (wmoHeatDistance >= 10 && wmoSlope <= 30) {
        return { rating: 'Class 3', score: 3, reason: 'Sub-optimal: Terrestrial terrain, slope <= 30%, heat sources >= 10m. Minor thermal radiation bias.' };
      }
      // Class 4 criteria
      if (wmoHeatDistance >= 5 && surfaceType !== 'asphalt') {
        return { rating: 'Class 4', score: 4, reason: 'Poor: Sited near concrete/structures or slope > 30%. High diurnal temperature bias expected.' };
      }
      // Class 5 criteria
      return { rating: 'Class 5', score: 5, reason: 'Severely restricted: Sited directly over tarmac, building roof, or < 5m from HVAC exhaust.' };
    }

    // Barometer rules (mostly terrain height related)
    if (type.includes('barometer') || type.includes('pressure')) {
      if (wmoSlope <= 15) {
        return { rating: 'Class 1', score: 1, reason: 'Standard Barometric Siting: Safe within enclosure, negligible local pressure wind dynamic bias.' };
      } else {
        return { rating: 'Class 3', score: 3, reason: 'Mountainous/Steep exposure: Slope > 15%. Local Bernoulli dynamic pressure effects may arise.' };
      }
    }

    // Rain gauge rules
    if (type.includes('rain') || type.includes('gauge') || type.includes('precipitation')) {
      const obstacleRatio = wmoObstacleDistance / (wmoObstacleHeight || 1);
      if (obstacleRatio >= 4) {
        return { rating: 'Class 1', score: 1, reason: 'Optimal wind-shielding profile: Obstacle separation is at least 4x obstacle height.' };
      } else if (obstacleRatio >= 2) {
        return { rating: 'Class 2', score: 2, reason: 'Standard profiling: Obstacle separation is at least 2x obstacle height.' };
      } else if (obstacleRatio >= 1) {
        return { rating: 'Class 3', score: 3, reason: 'Moderate obstruction: Wind shielding is excessive, risk of rain shadow intercept.' };
      } else {
        return { rating: 'Class 5', score: 5, reason: 'Severe blockage: Trees/buildings closer than height of obstacle. Rainfall intercepted.' };
      }
    }

    // Default / fallback
    if (wmoObstacleDistance >= 50) {
      return { rating: 'Class 1', score: 1, reason: 'Optimal standard separation parameters met.' };
    } else if (wmoObstacleDistance >= 20) {
      return { rating: 'Class 2', score: 2, reason: 'Acceptable separation parameters.' };
    } else {
      return { rating: 'Class 4', score: 4, reason: 'Restricted separation from local terrain obstructions.' };
    }
  };

  const calculatedWmo = calculateWmoClass();

  // Save WMO siting to database
  const handleSaveWmo = async () => {
    if (!selectedWmoSensorId) return;
    setSavingWmo(true);
    setWmoSuccessMsg('');

    const payload = {
      wmoSitingClass: calculatedWmo.rating,
      wmoChecklist: {
        evaluatedAt: new Date().toISOString(),
        obstacleDistance: wmoObstacleDistance,
        obstacleHeight: wmoObstacleHeight,
        slopePercentage: wmoSlope,
        surfaceType: wmoSurface,
        heatDistance: wmoHeatDistance,
        ratingReason: calculatedWmo.reason
      }
    };

    try {
      const res = await fetch(`/api/sensors/${selectedWmoSensorId}/wmo-siting`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('success', `Saved WMO classification metadata to sensor successfully.`);
        setWmoSuccessMsg(`Successfully saved as "${calculatedWmo.rating}"! This sensor now has accredited metadata quality.`);
        onRefresh();
      } else {
        showToast('error', 'Failed to save siting classification');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Network error while saving WMO data');
    } finally {
      setSavingWmo(false);
    }
  };

  // Find detailed sensor object from ID list
  const getBundledSensorsList = (idsStr: string | null) => {
    if (!idsStr) return [];
    const ids = idsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    return ids.map(id => sensors.find(s => s.sensorId === id)).filter(Boolean) as Sensor[];
  };

  // Filter available sensors for bundling
  const filteredAvailableSensors = useMemo(() => {
    return sensors.filter(sensor => {
      // Don't show already retired or defunct
      if (sensor.status === 'Retired') return false;
      
      // Match search query
      const matchText = `${sensor.sensorType} ${sensor.serialNumber || ''} ${sensor.manufacturer || ''} ${sensor.modelNumber || ''}`.toLowerCase();
      if (sensorSearchQuery && !matchText.includes(sensorSearchQuery.toLowerCase())) return false;

      return true;
    });
  }, [sensors, sensorSearchQuery]);

  return (
    <div className="space-y-6" id="installation-planner-container">
      {/* Toast Alert Notification */}
      {toast && (
        <div 
          className={`fixed top-4 right-4 z-50 flex items-center space-x-2 px-4 py-3 rounded-lg shadow-lg text-sm border font-medium ${
            toast.type === 'success' 
              ? 'bg-zinc-900 border-emerald-500/30 text-emerald-400' 
              : 'bg-zinc-900 border-rose-500/30 text-rose-400'
          }`}
          style={{ animation: 'slideIn 0.3s ease-out' }}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden" id="planner-banner">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Wrench className="h-32 w-32 text-zinc-400" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center space-x-3">
            <div className="bg-teal-500/10 p-2.5 rounded-lg border border-teal-500/20">
              <Wrench className="h-6 w-6 text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Intelligent AWS Installation Planner</h1>
              <p className="text-xs text-zinc-400 font-mono">ENGINEERING DIVISION &bull; ACCREDITATION SYSTEMS</p>
            </div>
          </div>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Digitally coordinate field installations. Pre-bundle dataloggers, solar arrays, and environmental enclosures in our pre-deployment sandbox. Quantify data quality metadata using the WMO-No. 8 digital siting classification calculator.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 space-x-6" id="planner-tab-navigation">
        <button
          onClick={() => setActiveTab('sandbox')}
          className={`pb-3 text-sm font-semibold transition-all duration-200 border-b-2 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'sandbox'
              ? 'border-teal-500 text-teal-400 font-bold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Box className="h-4 w-4" />
          <span>Pre-Deployment Sandbox & Bundling</span>
        </button>
        <button
          onClick={() => setActiveTab('wmo')}
          className={`pb-3 text-sm font-semibold transition-all duration-200 border-b-2 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'wmo'
              ? 'border-teal-500 text-teal-400 font-bold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ChecklistIcon className="h-4 w-4" />
          <span>WMO Siting Classification Engine</span>
        </button>
      </div>

      {/* TAB 1: PRE-DEPLOYMENT SANDBOX & BUNDLING */}
      {activeTab === 'sandbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="sandbox-view">
          {/* Projects Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Installation Projects</h3>
                <button
                  id="create-project-btn"
                  onClick={openCreateProject}
                  className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center space-x-1 transition cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Create Project</span>
                </button>
              </div>

              {loadingProjects && projects.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs font-mono">Loading projects...</div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-lg">
                  No active projects. Click "Create Project" to launch a new bundle workspace.
                </div>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto">
                  {projects.map((proj) => {
                    const statusColors: { [key: string]: string } = {
                      Draft: 'text-zinc-400 bg-zinc-800/50 border-zinc-700/30',
                      Approved: 'text-emerald-400 bg-emerald-950/20 border-emerald-500/20',
                      Packed: 'text-blue-400 bg-blue-950/20 border-blue-500/20',
                      Deployed: 'text-purple-400 bg-purple-950/20 border-purple-500/20'
                    };

                    const compColors: { [key: string]: string } = {
                      Valid: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/10',
                      Warnings: 'border-amber-500/30 text-amber-400 bg-amber-950/10',
                      Invalid: 'border-rose-500/30 text-rose-400 bg-rose-950/10',
                      Unknown: 'border-zinc-800 text-zinc-400 bg-zinc-900/10'
                    };

                    const isSelected = selectedProject?.id === proj.id;

                    return (
                      <div
                        key={proj.id}
                        id={`project-card-${proj.id}`}
                        onClick={() => setSelectedProject(proj)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-zinc-900/80 border-teal-500/50 shadow-md shadow-teal-950/20'
                            : 'bg-zinc-900/30 border-zinc-800 hover:bg-zinc-900/50 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between space-x-2">
                          <div>
                            <h4 className="text-sm font-semibold text-zinc-200 line-clamp-1">{proj.projectName}</h4>
                            <p className="text-xs font-mono text-zinc-500 mt-0.5">
                              {proj.scheduledDate || 'No date scheduled'}
                            </p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${statusColors[proj.status] || ''}`}>
                            {proj.status}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                          <span>
                            {proj.sensorIds ? proj.sensorIds.split(',').length : 0} sensor(s)
                          </span>
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] ${compColors[proj.compatibilityStatus] || ''}`}>
                            Compatibility: {proj.compatibilityStatus}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Active Workspace */}
          <div className="lg:col-span-8">
            {selectedProject ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6" id="sandbox-workspace">
                {/* Workspace Title bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-4 gap-4">
                  <div>
                    <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700">
                      ID: #{selectedProject.id} &bull; PROJECT WORKSPACE
                    </span>
                    <h2 className="text-lg font-bold text-white mt-1.5">{selectedProject.projectName}</h2>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      Target AWS: {stations.find(s => s.stationId === selectedProject.targetStationId)?.stationName || 'Not Assigned'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 self-start sm:self-center">
                    <button
                      onClick={() => openEditProject(selectedProject)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold px-3 py-2 rounded-lg transition cursor-pointer border border-zinc-700"
                    >
                      Edit Bundle
                    </button>
                    <button
                      onClick={() => handleDeleteProject(selectedProject.id)}
                      className="bg-zinc-950 hover:bg-rose-950/40 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 text-xs font-semibold px-3 py-2 rounded-lg transition cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Bundle Configuration details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="bundle-config">
                  <div className="bg-zinc-950 border border-zinc-800/60 p-4 rounded-lg flex items-center space-x-3">
                    <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                      <Cpu className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Data Logger</p>
                      <p className="text-xs font-semibold text-zinc-200 mt-0.5">{selectedProject.dataLoggerModel || 'None Specified'}</p>
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800/60 p-4 rounded-lg flex items-center space-x-3">
                    <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      <Sun className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Solar Array</p>
                      <p className="text-xs font-semibold text-zinc-200 mt-0.5">{selectedProject.solarPanelModel || 'None Specified'}</p>
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800/60 p-4 rounded-lg flex items-center space-x-3">
                    <div className="bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
                      <Layers className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Enclosure</p>
                      <p className="text-xs font-semibold text-zinc-200 mt-0.5">{selectedProject.enclosureModel || 'None Specified'}</p>
                    </div>
                  </div>
                </div>

                {/* Notes and Date */}
                <div className="bg-zinc-950/30 border border-zinc-800/50 p-4 rounded-lg text-sm text-zinc-300 space-y-2">
                  <div className="flex items-center text-xs text-zinc-400 space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Scheduled Installation Date: <strong className="text-zinc-200">{selectedProject.scheduledDate || 'Not set'}</strong></span>
                  </div>
                  {selectedProject.notes ? (
                    <p className="text-xs text-zinc-400 mt-2 bg-zinc-950/50 p-2.5 rounded border border-zinc-800 italic">
                      " {selectedProject.notes} "
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">No notes written for this project.</p>
                  )}
                </div>

                {/* Bundled Sensors List */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Bundled Sensors Package</span>
                    <span className="text-xs font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                      {getBundledSensorsList(selectedProject.sensorIds).length} Items
                    </span>
                  </h3>

                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          <th className="p-3 pl-4">Sensor Detail</th>
                          <th className="p-3">S/N</th>
                          <th className="p-3">Current Registry Status</th>
                          <th className="p-3">WMO Class</th>
                          <th className="p-3 pr-4">Warranty End</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-xs">
                        {getBundledSensorsList(selectedProject.sensorIds).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-zinc-500 italic">
                              No sensors added to this bundle yet. Click "Edit Bundle" to add certified sensors.
                            </td>
                          </tr>
                        ) : (
                          getBundledSensorsList(selectedProject.sensorIds).map((s) => {
                            const calExpired = s.lastCalibration ? new Date(s.lastCalibration.nextDueDate) < new Date() : false;
                            
                            return (
                              <tr key={s.sensorId} className="hover:bg-zinc-900/20 text-zinc-300">
                                <td className="p-3 pl-4">
                                  <p className="font-semibold text-zinc-200">{s.sensorType}</p>
                                  <p className="text-[10px] font-mono text-zinc-500">{s.manufacturer} {s.modelNumber || ''}</p>
                                </td>
                                <td className="p-3 font-mono text-zinc-300">{s.serialNumber || 'N/A'}</td>
                                <td className="p-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                                    s.status === 'Active' 
                                      ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/10' 
                                      : s.status === 'In Calibration'
                                      ? 'bg-amber-950/30 text-amber-400 border border-amber-500/10'
                                      : 'bg-rose-950/30 text-rose-400 border border-rose-500/10'
                                  }`}>
                                    {s.status}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    s.wmoSitingClass ? 'bg-zinc-800 text-teal-400 border border-teal-500/20' : 'bg-zinc-900 text-zinc-500'
                                  }`}>
                                    {s.wmoSitingClass || 'Not Assessed'}
                                  </span>
                                </td>
                                <td className="p-3 pr-4 font-mono text-zinc-400">
                                  {s.warrantyEndDate || 'N/A'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Compatibility Sandbox Validation Section */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-3 gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                        <CheckSquare className="h-4 w-4 text-teal-400" />
                        <span>Pre-Deployment Calibration & Compatibility Validation</span>
                      </h3>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">ISO/IEC 17025 ACCREDITED LOGISTICS PROTOCOL</p>
                    </div>

                    <button
                      onClick={() => handleValidateProject(selectedProject.id)}
                      disabled={isValidating}
                      className="bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center justify-center space-x-1.5 transition self-start cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      <span>{isValidating ? 'Validating Sandbox...' : 'Validate Bundle'}</span>
                    </button>
                  </div>

                  {/* Verdict Badge */}
                  {selectedProject.compatibilityStatus !== 'Unknown' && (
                    <div className={`p-4 rounded-lg border flex items-start space-x-3 ${
                      selectedProject.compatibilityStatus === 'Valid'
                        ? 'bg-emerald-950/10 border-emerald-500/20 text-emerald-400'
                        : selectedProject.compatibilityStatus === 'Warnings'
                        ? 'bg-amber-950/10 border-amber-500/20 text-amber-400'
                        : 'bg-rose-950/10 border-rose-500/20 text-rose-400'
                    }`}>
                      {selectedProject.compatibilityStatus === 'Valid' ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                      ) : selectedProject.compatibilityStatus === 'Warnings' ? (
                        <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
                      )}

                      <div className="space-y-1">
                        <h4 className="text-sm font-bold uppercase tracking-wide">
                          Overall Verdict: {selectedProject.compatibilityStatus}
                        </h4>
                        <p className="text-xs text-zinc-300">
                          {selectedProject.compatibilityStatus === 'Valid' && 'All components verified calibrated, warrantied, physically compatible and programmed. Safe to pack logistics truck.'}
                          {selectedProject.compatibilityStatus === 'Warnings' && 'Slight technical warnings or informational exceptions present. Review the checklist notes below before going to field.'}
                          {selectedProject.compatibilityStatus === 'Invalid' && 'Field deployment blocked. Some components have expired calibration, are missing, or are unavailable. Do not pack truck.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Validation Report Details List */}
                  {selectedProject.compatibilityReport ? (
                    <div className="space-y-2 mt-4">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">System Safety Checklist Details</p>
                      <div className="space-y-2">
                        {JSON.parse(selectedProject.compatibilityReport).items?.map((item: any, idx: number) => {
                          const iconColors: { [key: string]: string } = {
                            success: 'text-emerald-400 bg-emerald-950/20 border-emerald-500/10',
                            warning: 'text-amber-400 bg-amber-950/20 border-amber-500/10',
                            error: 'text-rose-400 bg-rose-950/20 border-rose-500/10',
                            info: 'text-zinc-400 bg-zinc-800/50 border-zinc-700/20'
                          };

                          return (
                            <div 
                              key={idx}
                              className={`flex items-start space-x-2.5 p-2.5 rounded border text-xs ${iconColors[item.severity] || ''}`}
                            >
                              {item.severity === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
                              {item.severity === 'warning' && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                              {item.severity === 'error' && <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                              {item.severity === 'info' && <Info className="h-4 w-4 shrink-0 mt-0.5" />}
                              
                              <p className="text-zinc-300 leading-relaxed">{item.message}</p>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono text-right mt-2">
                        Evaluated on {new Date(JSON.parse(selectedProject.compatibilityReport).validatedAt).toLocaleString()} by {JSON.parse(selectedProject.compatibilityReport).validatedBy}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-zinc-500 text-xs italic">
                      Bundle compatibility has not been evaluated yet. Click "Validate Bundle" to run pre-deployment checks.
                    </div>
                  )}
                </div>

                {/* Change Status Workflow */}
                <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Bundle Logistics Status</h4>
                  <div className="flex flex-wrap gap-2">
                    {['Draft', 'Approved', 'Packed', 'Deployed'].map((st) => {
                      const isActive = selectedProject.status === st;
                      const activeStyles: { [key: string]: string } = {
                        Draft: 'bg-zinc-800 text-white border-zinc-700',
                        Approved: 'bg-emerald-950 text-emerald-400 border-emerald-500/30',
                        Packed: 'bg-blue-950 text-blue-400 border-blue-500/30',
                        Deployed: 'bg-purple-950 text-purple-400 border-purple-500/30'
                      };

                      return (
                        <button
                          key={st}
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/installation-projects/${selectedProject.id}`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                },
                                body: JSON.stringify({ status: st })
                              });
                              if (res.ok) {
                                showToast('success', `Status shifted to ${st}.`);
                                fetchProjects();
                              }
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                            isActive 
                              ? activeStyles[st] 
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
                          }`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/10 border border-dashed border-zinc-800 rounded-xl p-12 text-center text-zinc-500 space-y-3 h-full flex flex-col items-center justify-center">
                <Box className="h-12 w-12 text-zinc-700" />
                <h3 className="text-sm font-semibold text-zinc-400">Pre-Deployment Sandbox</h3>
                <p className="text-xs text-zinc-500 max-w-md">
                  Select an Installation Project from the sidebar workspace panel to evaluate compatible bundling or manage datalogger, power supply, and sensor packaging.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WMO SITING CLASSIFICATION ENGINE */}
      {activeTab === 'wmo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="wmo-view">
          {/* Siting parameters calculator */}
          <div className="lg:col-span-7 bg-zinc-900/40 border border-zinc-800 p-6 rounded-xl space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <CheckSquare className="h-5 w-5 text-teal-400" />
                <span>WMO-No. 8 Digital Siting Evaluator</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Calculate and record siting compliance metadata according to WMO Siting Classification guidelines (Classes 1 to 5). Select a sensor to evaluate.
              </p>
            </div>

            {/* Sensor Selection */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">1. Select Sensor to Calibrate Metadata</label>
              <select
                id="wmo-sensor-select"
                value={selectedWmoSensorId || ''}
                onChange={(e) => {
                  const id = parseInt(e.target.value);
                  setSelectedWmoSensorId(id || null);
                  setWmoSuccessMsg('');
                  // Pre-load if already exists
                  const sensor = sensors.find(s => s.sensorId === id);
                  if (sensor && sensor.wmoChecklist) {
                    try {
                      const ch = JSON.parse(sensor.wmoChecklist);
                      setWmoObstacleDistance(ch.obstacleDistance ?? 100);
                      setWmoObstacleHeight(ch.obstacleHeight ?? 5);
                      setWmoSlope(ch.slopePercentage ?? 2);
                      setWmoSurface(ch.surfaceType ?? 'grass_short');
                      setWmoHeatDistance(ch.heatDistance ?? 100);
                    } catch (err) {}
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-200 rounded-lg p-2.5 outline-none font-medium transition cursor-pointer"
              >
                <option value="">-- Choose Sensor from Inventory --</option>
                {sensors.map(s => (
                  <option key={s.sensorId} value={s.sensorId}>
                    {s.sensorType} S/N: {s.serialNumber || 'N/A'} [{s.manufacturer}] {s.wmoSitingClass ? `(Current: ${s.wmoSitingClass})` : '(Unassessed)'}
                  </option>
                ))}
              </select>
            </div>

            {selectedWmoSensorId ? (
              <div className="space-y-5 pt-3 border-t border-zinc-800/60" id="wmo-siting-form">
                {/* Specific field questions based on selected sensor type */}
                <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider font-mono">
                  2. Siting Environment Checklist
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Obstacle Distance */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-300 font-semibold block">Distance to Nearest Tree/Obstacle (m)</label>
                    <input
                      type="number"
                      value={wmoObstacleDistance}
                      onChange={(e) => setWmoObstacleDistance(parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-750 text-xs text-zinc-200 rounded-lg p-2.5 outline-none font-mono"
                    />
                    <p className="text-[10px] text-zinc-500">Distance from building walls, trees, high structures.</p>
                  </div>

                  {/* Obstacle Height */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-300 font-semibold block">Height of the Nearest Obstacle (m)</label>
                    <input
                      type="number"
                      value={wmoObstacleHeight}
                      onChange={(e) => setWmoObstacleHeight(parseFloat(e.target.value) || 1)}
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-750 text-xs text-zinc-200 rounded-lg p-2.5 outline-none font-mono"
                    />
                    <p className="text-[10px] text-zinc-500">WMO rules verify distance ratio to obstacle height.</p>
                  </div>

                  {/* Terrestrial Slope */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-300 font-semibold block">Ground Terrain Slope Grade (%)</label>
                    <input
                      type="number"
                      value={wmoSlope}
                      onChange={(e) => setWmoSlope(parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-750 text-xs text-zinc-200 rounded-lg p-2.5 outline-none font-mono"
                    />
                    <p className="text-[10px] text-zinc-500">Angle grade of surrounding station topography.</p>
                  </div>

                  {/* Heat Distance */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-300 font-semibold block">Distance to Artificial Heat Source (m)</label>
                    <input
                      type="number"
                      value={wmoHeatDistance}
                      onChange={(e) => setWmoHeatDistance(parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-750 text-xs text-zinc-200 rounded-lg p-2.5 outline-none font-mono"
                    />
                    <p className="text-[10px] text-zinc-500">Distance to tarmac road surface, exhaust, structures.</p>
                  </div>
                </div>

                {/* Ground Cover */}
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300 font-semibold block">Direct Surrounding Ground Surface Cover</label>
                  <select
                    value={wmoSurface}
                    onChange={(e) => setWmoSurface(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg p-2.5 outline-none font-mono cursor-pointer"
                  >
                    <option value="grass_short">Uniform Natural short grass (height &lt; 10 cm)</option>
                    <option value="soil">Natural dry bare soil / sand</option>
                    <option value="gravel">Coarse gravel or tall vegetation</option>
                    <option value="roof">Building roof mounting</option>
                    <option value="asphalt">Concrete pavement or asphalt road surface</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-zinc-800 flex justify-between items-center">
                  <span className="text-[10px] font-mono text-zinc-500">WMO-No. 8 ACCREDITATION PROTOCOLS</span>
                  <button
                    onClick={handleSaveWmo}
                    disabled={savingWmo}
                    className="bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>{savingWmo ? 'Saving Siting Class...' : 'Commit Siting Class Metadata'}</span>
                  </button>
                </div>

                {wmoSuccessMsg && (
                  <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 text-xs font-mono">
                    {wmoSuccessMsg}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-zinc-500 text-xs italic border border-dashed border-zinc-850 rounded-xl">
                Please select a sensor from the inventory dropdown above to evaluate its WMO No.8 siting compliance.
              </div>
            )}
          </div>

          {/* Siting Class Explainer & Verdict */}
          <div className="lg:col-span-5 space-y-6">
            {selectedWmoSensorId ? (
              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl space-y-6" id="wmo-verdict-box">
                <div className="text-center space-y-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Calculated WMO Siting Class</p>
                  
                  <div className="inline-block px-6 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-inner">
                    <span className={`text-4xl font-extrabold tracking-tight font-mono ${
                      calculatedWmo.score === 1
                        ? 'text-emerald-400'
                        : calculatedWmo.score === 2
                        ? 'text-teal-400'
                        : calculatedWmo.score === 3
                        ? 'text-amber-400'
                        : calculatedWmo.score === 4
                        ? 'text-orange-400'
                        : 'text-rose-400'
                    }`}>
                      {calculatedWmo.rating}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 font-medium px-4">
                    {calculatedWmo.reason}
                  </p>
                </div>

                {/* Siting class rules description card */}
                <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-lg space-y-3 text-xs leading-relaxed text-zinc-400">
                  <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center space-x-1">
                    <Info className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Classification Standards (WMO-No. 8)</span>
                  </h4>
                  
                  <ul className="space-y-2 text-[11px] font-mono">
                    <li><strong className="text-emerald-400">Class 1:</strong> Reference site. No artificial microclimate biases. Max data quality.</li>
                    <li><strong className="text-teal-400">Class 2:</strong> Representative. Negligible microclimate interference. Accredited.</li>
                    <li><strong className="text-amber-400">Class 3:</strong> Sub-optimal. Minor obstruction interference (Data flag: Warn).</li>
                    <li><strong className="text-orange-400">Class 4:</strong> Compromised. Sited near concrete walls / thermal sources (Data flag: Caution).</li>
                    <li><strong className="text-rose-400">Class 5:</strong> Severely compromised. Severe local obstacles / heat sinks. High error margin.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl space-y-4 text-xs text-zinc-400 text-center py-12">
                <ClipboardList className="h-10 w-10 text-zinc-700 mx-auto" />
                <p>No sensor active for rating. Select a sensor on the left to see the interactive siting calculator verdict.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PORTAL MODAL FOR BUNDLE CREATION/EDIT */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowProjectModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"
            >
              <Trash2 className="h-5 w-5 rotate-45" />
            </button>

            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Box className="h-5 w-5 text-teal-400" />
              <span>{projectForm.id ? 'Edit Bundle' : 'Launch New Installation Project Bundle'}</span>
            </h2>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 block font-semibold">Project Name</label>
                <input
                  type="text"
                  required
                  value={projectForm.projectName}
                  onChange={(e) => setProjectForm({...projectForm, projectName: e.target.value})}
                  placeholder="e.g., Kathmandu Airport MET Upgrade"
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg p-2.5 outline-none focus:border-teal-500/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 block font-semibold">Target Weather Station</label>
                  <select
                    value={projectForm.targetStationId}
                    onChange={(e) => setProjectForm({...projectForm, targetStationId: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg p-2.5 outline-none"
                  >
                    <option value="">-- Choose Target AWS --</option>
                    {stations.map(st => (
                      <option key={st.stationId} value={st.stationId}>{st.stationName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 block font-semibold">Scheduled Date</label>
                  <input
                    type="date"
                    value={projectForm.scheduledDate}
                    onChange={(e) => setProjectForm({...projectForm, scheduledDate: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg p-2.5 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 block font-semibold">Data Logger Model</label>
                  <input
                    type="text"
                    value={projectForm.dataLoggerModel}
                    onChange={(e) => setProjectForm({...projectForm, dataLoggerModel: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg p-2.5 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 block font-semibold">Solar Panel (Power)</label>
                  <select
                    value={projectForm.solarPanelModel}
                    onChange={(e) => setProjectForm({...projectForm, solarPanelModel: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg p-2.5 outline-none cursor-pointer"
                  >
                    <option value="10W Solar Panel">10W Solar Panel</option>
                    <option value="20W Solar Panel">20W Solar Panel</option>
                    <option value="50W Solar Panel">50W Solar Panel</option>
                    <option value="100W Solar Panel">100W Solar Panel</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 block font-semibold">Enclosure Model</label>
                  <input
                    type="text"
                    value={projectForm.enclosureModel}
                    onChange={(e) => setProjectForm({...projectForm, enclosureModel: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg p-2.5 outline-none"
                  />
                </div>
              </div>

              {/* Multi-Select Sensors in Bundle */}
              <div className="space-y-2 border-t border-zinc-800 pt-3">
                <label className="text-xs text-zinc-300 block font-bold">Bundle Sensors Selection</label>
                
                {/* Search query box */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search available sensors by type, manufacturer, model or S/N..."
                    value={sensorSearchQuery}
                    onChange={(e) => setSensorSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs pl-8 pr-4 py-2 rounded-lg outline-none"
                  />
                </div>

                {/* Grid checklist of matching sensors */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5">
                  {filteredAvailableSensors.length === 0 ? (
                    <p className="text-center py-4 text-zinc-600 text-xs italic">No matching sensors found in active inventory.</p>
                  ) : (
                    filteredAvailableSensors.map((s) => {
                      const isChecked = projectForm.sensorIds.includes(s.sensorId);
                      return (
                        <label 
                          key={s.sensorId} 
                          className={`flex items-center space-x-3 p-2 rounded-md hover:bg-zinc-900 cursor-pointer text-xs ${
                            isChecked ? 'bg-zinc-900/50 text-teal-400 font-medium' : 'text-zinc-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const updated = isChecked
                                ? projectForm.sensorIds.filter(id => id !== s.sensorId)
                                : [...projectForm.sensorIds, s.sensorId];
                              setProjectForm({...projectForm, sensorIds: updated});
                            }}
                            className="rounded text-teal-500 focus:ring-teal-500 bg-zinc-950 border-zinc-850"
                          />
                          <div className="flex-1">
                            <span className="text-zinc-200 font-semibold">{s.sensorType}</span>
                            <span className="text-zinc-500 font-mono text-[10px] ml-2">S/N: {s.serialNumber || 'N/A'}</span>
                            <span className="text-zinc-500 font-mono text-[10px] ml-2">({s.status})</span>
                            {s.wmoSitingClass && (
                              <span className="bg-teal-950/40 text-teal-400 text-[9px] px-1.5 py-0.2 rounded border border-teal-500/10 ml-2">
                                WMO {s.wmoSitingClass}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 block font-semibold">Project Notes / Logistics Remarks</label>
                <textarea
                  value={projectForm.notes}
                  onChange={(e) => setProjectForm({...projectForm, notes: e.target.value})}
                  placeholder="Details for logistics, cabling needs, required anchors..."
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg p-2.5 outline-none focus:border-teal-500/40 h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-4 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center space-x-1"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Project Bundle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
