import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Cpu, 
  Calendar, 
  ShieldCheck, 
  FileText, 
  Image as ImageIcon, 
  MapPin, 
  Printer, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  Download, 
  CheckCircle, 
  HelpCircle, 
  Wrench,
  Sun,
  Moon
} from 'lucide-react';
import { WeatherStation, Sensor, Calibration, SensorDeployment } from '../types.ts';
// @ts-ignore
import awsHimalayan from '../assets/images/aws_himalayan_1783536304824.jpg';
// @ts-ignore
import awsHilly from '../assets/images/aws_hilly_1783536317619.jpg';
// @ts-ignore
import awsTerai from '../assets/images/aws_terai_1783536330079.jpg';

export function getStationPhoto(stationName: string): { url: string; regionLabel: string; description: string } {
  const name = stationName.toLowerCase();
  
  const isHimalayan = 
    name.includes("mountain") || 
    name.includes("alpine") || 
    name.includes("high-altitude") ||
    name.includes("jomsom") ||
    name.includes("jumla") ||
    name.includes("dunai") ||
    name.includes("simikot") ||
    name.includes("darchula") ||
    name.includes("taplejung") ||
    name.includes("chame") ||
    name.includes("chautara") ||
    name.includes("charikot") ||
    name.includes("gamgadhi");

  if (isHimalayan) {
    return { 
      url: awsHimalayan, 
      regionLabel: "Himalayan Alpine Region",
      description: "AI-generated site photograph of the high-altitude weather station featuring the meteorological instrument mast (anemometer, thermometer, barometer) inside a secure perimeter fencing, set against a majestic snow-capped Himalayan mountain range backdrop."
    };
  }

  const isTerai = 
    name.includes("plains") || 
    name.includes("border") || 
    name.includes("airport") || 
    name.includes("industrial") ||
    name.includes("birgunj") ||
    name.includes("janakpur") ||
    name.includes("gaur") ||
    name.includes("kalaiya") ||
    name.includes("malangwa") ||
    name.includes("jaleshwar") ||
    name.includes("siraha") ||
    name.includes("rajbiraj") ||
    name.includes("lahan") ||
    name.includes("bharatpur") ||
    name.includes("bhairahawa") ||
    name.includes("nepalgunj") ||
    name.includes("dhangadhi") ||
    name.includes("mahendranagar");

  if (isTerai) {
    return { 
      url: awsTerai, 
      regionLabel: "Terai Plains Region",
      description: "AI-generated site photograph of the flatlands weather station featuring the instrument tower mast and tipping bucket rain gauge inside a protective security fence, surrounded by the golden agricultural plains of Terai."
    };
  }

  return { 
    url: awsHilly, 
    regionLabel: "Hilly Terraced Region",
    description: "AI-generated site photograph of the mid-hills weather station featuring the active instrumentation mast and radiation shield inside a perimeter fence, overlooking lush terraced farmlands and misty valleys."
  };
}

interface StationDetailReportProps {
  stationId: number;
  onClose?: () => void; // Optional if rendered inside main app, but we default to stand-alone view
}

export default function StationDetailReport({ stationId, onClose }: StationDetailReportProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [station, setStation] = useState<WeatherStation | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [deployments, setDeployments] = useState<SensorDeployment[]>([]);
  const [allCalibrations, setAllCalibrations] = useState<Calibration[]>([]);

  // Theme state for stand-alone dossier view (synced with general app)
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
  
  useEffect(() => {
    const loadReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [stationsRes, sensorsRes, deploymentsRes, calibrationsRes] = await Promise.all([
          fetch('/api/stations'),
          fetch('/api/sensors'),
          fetch('/api/deployments'),
          fetch('/api/calibrations')
        ]);

        if (!stationsRes.ok || !sensorsRes.ok || !deploymentsRes.ok || !calibrationsRes.ok) {
          throw new Error("Failed to load meteorological records for reporting node.");
        }

        const stations: WeatherStation[] = await stationsRes.json();
        const allSensors: Sensor[] = await sensorsRes.json();
        const allDeps: SensorDeployment[] = await deploymentsRes.json();
        const allCals: Calibration[] = await calibrationsRes.json();

        const currentStation = stations.find(s => s.stationId === stationId);
        if (!currentStation) {
          throw new Error(`Station ID ${stationId} was not found in the national registry.`);
        }

        // Filter sensors currently installed at this station
        const stationSensors = allSensors.filter(s => s.stationId === stationId);

        // Filter deployments for this station
        const stationDeployments = allDeps.filter(d => d.stationId === stationId);

        setStation(currentStation);
        setSensors(stationSensors);
        setDeployments(stationDeployments);
        setAllCalibrations(allCals);
      } catch (err: any) {
        console.error("Error generating station report:", err);
        setError(err.message || "An unexpected database synchronization error occurred.");
      } finally {
        setLoading(false);
      }
    };

    loadReportData();
  }, [stationId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-300 flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase">Compiling Station Dossier...</p>
      </div>
    );
  }

  if (error || !station) {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-300 flex flex-col items-center justify-center p-6">
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-6 max-w-md text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Registry Report Error</h2>
          <p className="text-xs text-zinc-400 leading-relaxed font-mono">{error || 'Station data unavailable.'}</p>
          <button 
            onClick={() => window.close()} 
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-md transition cursor-pointer text-white"
          >
            Close Report Tab
          </button>
        </div>
      </div>
    );
  }

  // Calculate high-level stats for the station
  const activeSensors = sensors.filter(s => s.status === 'Active');
  const calibrationOverdueCount = sensors.filter(s => {
    if (!s.lastCalibration) return true;
    const nextDue = new Date(s.lastCalibration.nextDueDate);
    return nextDue < new Date();
  }).length;

  const handlePrint = () => {
    window.print();
  };

  // Helper to parse documents/photos fields
  const parseItems = (value: string | null | undefined): string[] => {
    if (!value) return [];
    try {
      if (value.startsWith('[') && value.endsWith(']')) {
        return JSON.parse(value);
      }
    } catch {}
    return value.split(',').map(s => s.trim()).filter(Boolean);
  };

  // Aggregate documents and photos across station sensors
  const allPhotos = sensors.flatMap(s => parseItems(s.photos));
  const allDocuments = sensors.flatMap(s => parseItems(s.documents));

  return (
    <div className="min-h-screen bg-[#07070a] text-zinc-300 p-4 sm:p-8 font-sans print:bg-white print:text-black">
      {/* Printable Wrapper */}
      <div className="max-w-5xl mx-auto space-y-8 bg-black/45 border border-[#1f1f23] rounded-xl p-6 sm:p-10 shadow-2xl relative overflow-hidden print:border-none print:shadow-none print:p-0 print:bg-transparent">
        
        {/* Aesthetic corner accents */}
        <div className="absolute top-0 left-0 w-12 h-12 border-t border-l border-zinc-700/50 rounded-tl-xl pointer-events-none print:hidden"></div>
        <div className="absolute top-0 right-0 w-12 h-12 border-t border-r border-zinc-700/50 rounded-tr-xl pointer-events-none print:hidden"></div>
        <div className="absolute bottom-0 left-0 w-12 h-12 border-b border-l border-zinc-700/50 rounded-bl-xl pointer-events-none print:hidden"></div>
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b border-r border-zinc-700/50 rounded-br-xl pointer-events-none print:hidden"></div>

        {/* Toolbar Controls (Hidden in Print) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#1f1f23] print:hidden">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">OFFICIAL REGISTRY STATION RECORD</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold rounded-md text-xs border border-zinc-700 transition cursor-pointer flex items-center justify-center space-x-1.5"
              title="Toggle theme for outdoor inspection readability"
            >
              {theme === 'light' ? <Sun className="h-4 w-4 text-amber-500 animate-pulse" /> : <Moon className="h-4 w-4 text-blue-400" />}
              <span>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-md text-xs border border-zinc-700 transition cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Printer className="h-4 w-4" />
              <span>Print Station Dossier</span>
            </button>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-[#121215] hover:bg-white/5 border border-[#1f1f23] text-zinc-400 hover:text-white font-semibold rounded-md text-xs transition cursor-pointer"
            >
              Close Dossier
            </button>
          </div>
        </div>

        {/* Dossier Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start pb-8 border-b border-[#1f1f23] print:border-zinc-300">
          <div className="md:col-span-2 space-y-3">
            <div className="inline-flex items-center space-x-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-md text-[10px] font-mono tracking-wider uppercase font-semibold">
              <Building2 className="h-3 w-3" />
              <span>AWS Station Node {station.stationId}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-sans tracking-tight text-white print:text-black">
              {station.stationName}
            </h1>
            <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-400 print:text-zinc-600">
              <div className="flex items-center space-x-1">
                <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                <span>{station.region} Region</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-zinc-600">•</span>
                <span>Lat: {station.latitude.toFixed(6)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-zinc-600">•</span>
                <span>Lng: {station.longitude.toFixed(6)}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-4 grid grid-cols-2 gap-4 print:bg-zinc-100 print:border-zinc-300">
            <div className="text-center md:border-r border-[#1f1f23] print:border-zinc-300">
              <span className="text-[10px] font-mono text-zinc-500 block uppercase tracking-wider">Total Sensors</span>
              <span className="text-2xl font-bold text-white print:text-black mt-1 block">{sensors.length}</span>
              <span className="text-[9px] font-mono text-zinc-500">{activeSensors.length} Deployed Active</span>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-mono text-zinc-500 block uppercase tracking-wider">Calibration</span>
              <span className={`text-2xl font-bold mt-1 block ${calibrationOverdueCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {calibrationOverdueCount > 0 ? `${calibrationOverdueCount} Overdue` : 'Nominal'}
              </span>
              <span className="text-[9px] font-mono text-zinc-500">Interval checks</span>
            </div>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Installed Sensors & Details */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Installed Sensors */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4.5 w-4.5 text-blue-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white print:text-black">
                  Currently Deployed Sensor Array ({sensors.length})
                </h2>
              </div>

              {sensors.length === 0 ? (
                <div className="text-center py-8 bg-[#0b0b0e] border border-[#1f1f23] rounded-lg text-zinc-500 font-mono text-xs">
                  No sensors actively registered at this station node.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {sensors.map(sensor => {
                    // Check calibration expiry
                    let isOverdue = false;
                    let nextDateStr = 'N/A';
                    if (sensor.lastCalibration) {
                      nextDateStr = sensor.lastCalibration.nextDueDate;
                      isOverdue = new Date(nextDateStr) < new Date();
                    }

                    // Check warranty expiry
                    let isWarrantyActive = false;
                    let daysLeftStr = 'Expired';
                    if (sensor.warrantyEndDate) {
                      const warrantyEnd = new Date(sensor.warrantyEndDate);
                      isWarrantyActive = warrantyEnd > new Date();
                      if (isWarrantyActive) {
                        const diff = warrantyEnd.getTime() - new Date().getTime();
                        daysLeftStr = `${Math.ceil(diff / (1000 * 3600 * 24))} Days left`;
                      }
                    }

                    return (
                      <div 
                        key={sensor.sensorId}
                        className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-5 hover:border-zinc-700/60 transition print:bg-transparent print:border-zinc-300"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/50 print:border-zinc-200">
                          <div>
                            <span className="text-[10px] font-mono text-blue-500 block">SEN-{sensor.sensorId.toString().padStart(4, '0')}</span>
                            <span className="text-sm font-bold text-white print:text-black">{sensor.sensorType}</span>
                            <span className="text-xs text-zinc-400 font-mono ml-2">({sensor.manufacturer})</span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-sm text-[9px] font-semibold font-mono tracking-wider uppercase border ${
                              sensor.status === 'Active' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 print:text-emerald-700' :
                              sensor.status === 'In Calibration' ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 print:text-amber-700' :
                              'bg-zinc-800 border-zinc-700 text-zinc-400'
                            }`}>
                              {sensor.status}
                            </span>
                          </div>
                        </div>

                        {/* Sensor Technical Metadata Subgrid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3.5 text-xs">
                          <div className="space-y-2">
                            <div>
                              <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-wider">Serial Number / Model</span>
                              <span className="font-mono text-zinc-200 print:text-black font-semibold">
                                S/N: {sensor.serialNumber || 'N/A'} • M/N: {sensor.modelNumber || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-wider font-semibold">Warranty Status</span>
                              <span className={`font-semibold ${isWarrantyActive ? 'text-emerald-400 print:text-emerald-700' : 'text-zinc-500'}`}>
                                {sensor.warrantyEndDate ? `${sensor.warrantyEndDate} (${daysLeftStr})` : 'No Warranty'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-wider font-semibold font-mono">Assigned Location Context</span>
                              <span className="text-zinc-400 print:text-zinc-700">
                                Office: {sensor.assignedOffice || 'N/A'} • Custodian: {sensor.responsiblePersonnel || 'N/A'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2 sm:border-l border-zinc-800/50 sm:pl-4 print:border-zinc-200">
                            <div>
                              <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-wider">Last Calibration Summary</span>
                              {sensor.lastCalibration ? (
                                <div className="space-y-0.5 text-zinc-300 print:text-black">
                                  <div className="font-mono font-semibold flex items-center space-x-1.5">
                                    <span className={sensor.lastCalibration.result === 'Passed' ? 'text-emerald-400 print:text-emerald-700' : 'text-amber-500'}>
                                      {sensor.lastCalibration.result}
                                    </span>
                                    <span>on {sensor.lastCalibration.calibrationDate}</span>
                                  </div>
                                  <div className="text-[10px] text-zinc-500 font-mono">
                                    Tech: {sensor.lastCalibration.technicianName}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-zinc-500 italic block">No calibration records logged.</span>
                              )}
                            </div>

                            <div>
                              <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-wider font-semibold">Next Due Date</span>
                              <span className={`font-mono font-semibold ${isOverdue ? 'text-red-400 print:text-red-600' : 'text-emerald-400'}`}>
                                {nextDateStr} {isOverdue && '(OVERDUE)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Calibration Notes or Remarks if any */}
                        {sensor.remarks && (
                          <div className="mt-3 p-2 bg-[#121215] border border-zinc-800/40 rounded-md text-[11px] text-zinc-400 leading-normal print:bg-zinc-50 print:border-zinc-200">
                            <span className="font-bold text-zinc-300 mr-1.5 font-mono">Remarks:</span>
                            {sensor.remarks}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Historical Deployments Logs */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4.5 w-4.5 text-purple-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white print:text-black">
                  Deployment Timeline & Calibration Audits
                </h2>
              </div>

              {deployments.length === 0 ? (
                <div className="text-center py-6 bg-[#0b0b0e] border border-[#1f1f23] rounded-lg text-zinc-500 font-mono text-xs">
                  No chronological deployment logs recorded.
                </div>
              ) : (
                <div className="border-l border-zinc-800 pl-4 space-y-5 ml-2.5 print:border-zinc-300">
                  {deployments.map((dep, idx) => (
                    <div key={dep.deploymentId || idx} className="relative">
                      {/* Bullet point accent */}
                      <span className="absolute -left-[21.5px] top-1 h-3 w-3 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                      </span>
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-zinc-500">{dep.deploymentDate}</span>
                        <div className="text-xs font-semibold text-white print:text-black">
                          {dep.sensorType} (S/N: {dep.serialNumber || 'N/A'}) Deployed at node
                        </div>
                        <div className="text-xs text-zinc-400 leading-normal">
                          <span className="font-mono text-[10px] text-zinc-500">Personnel: </span>{dep.personnelInvolved}
                          {dep.installationNotes && (
                            <span className="block mt-0.5 text-[11px] text-zinc-500 italic">"{dep.installationNotes}"</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Station metadata, responsible office, documents, photos */}
          <div className="space-y-8">
            
            {/* Responsible Office Info */}
            <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-5 space-y-4 print:bg-transparent print:border-zinc-300">
              <div className="flex items-center space-x-2 pb-2 border-b border-zinc-800/50 print:border-zinc-200">
                <Building2 className="h-4.5 w-4.5 text-zinc-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white print:text-black">
                  Responsible Office & Custody
                </h3>
              </div>

              <div className="space-y-3.5 text-xs leading-normal">
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-wider">Regional Authority</span>
                  <span className="font-semibold text-zinc-200 print:text-black text-sm">{station.region} Regional Hydromet Office</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-wider">National Network Depot</span>
                  <span className="text-zinc-400 print:text-zinc-700">Central Field Operations Division</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-wider">Assigned Coordinator</span>
                  <span className="text-zinc-400 print:text-zinc-700">
                    {sensors[0]?.responsiblePersonnel || 'Regional Supervisor'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-wider font-semibold">Office Registry ID</span>
                  <span className="font-mono text-zinc-400">AWS-REG-{station.stationId.toString().padStart(4, '0')}</span>
                </div>
              </div>
            </div>

            {/* Maintenance Summary Remarks */}
            <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-5 space-y-4 print:bg-transparent print:border-zinc-300">
              <div className="flex items-center space-x-2 pb-2 border-b border-zinc-800/50 print:border-zinc-200">
                <Wrench className="h-4.5 w-4.5 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white print:text-black">
                  Maintenance Summary
                </h3>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div className="p-2.5 bg-[#121215] border border-zinc-800/40 rounded-md text-[11px] text-zinc-400 print:bg-zinc-50 print:border-zinc-200">
                  <span className="font-bold text-zinc-300 block mb-1 font-mono">Overview Remarks:</span>
                  This telemetric weather node is classified under the AWS (Automatic Weather Station) network. Scheduled maintenance inspections occur semi-annually. Real-time calibration records ensure accurate data transmission matching international standards.
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  Last updated: {station.createdAt ? new Date(station.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Document Assets Registry */}
            <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-5 space-y-4 print:bg-transparent print:border-zinc-300">
              <div className="flex items-center space-x-2 pb-2 border-b border-zinc-800/50 print:border-zinc-200">
                <FileText className="h-4.5 w-4.5 text-zinc-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white print:text-black">
                  Linked Document Assets
                </h3>
              </div>

              {allDocuments.length === 0 ? (
                <div className="text-zinc-500 font-mono text-[11px] leading-relaxed">
                  No schematics, calibration certificates, or datasheets currently attached to this node.
                </div>
              ) : (
                <ul className="space-y-2 text-xs">
                  {allDocuments.map((doc, idx) => (
                    <li key={idx} className="flex items-center justify-between bg-black/40 border border-[#1f1f23] p-2 rounded-md print:border-zinc-200">
                      <span className="truncate flex-1 font-mono text-zinc-400 pr-2 text-[11px]">{doc}</span>
                      <a 
                        href={`#download_${doc}`} 
                        className="text-blue-400 hover:text-blue-300 font-bold hover:underline shrink-0"
                        onClick={(e) => e.preventDefault()}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Station Photogrammetry & Diagrams */}
            <div className="bg-[#0b0b0e] border border-[#1f1f23] rounded-lg p-5 space-y-4 print:bg-transparent print:border-zinc-300">
              <div className="flex items-center space-x-2 pb-2 border-b border-zinc-800/50 print:border-zinc-200">
                <ImageIcon className="h-4.5 w-4.5 text-zinc-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white print:text-black">
                  Station Photographs
                </h3>
              </div>

              {/* Featured AI Generated Official Station Photograph */}
              {(() => {
                const sitePhoto = getStationPhoto(station.stationName);
                return (
                  <div className="space-y-3">
                    <div className="relative aspect-[4/3] bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden group print:border-zinc-300">
                      <img 
                        src={sitePhoto.url} 
                        alt={`Official AWS Installation Mast & Instrumentation Enclosure - ${sitePhoto.regionLabel}`} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 left-2 bg-indigo-600/90 backdrop-blur-md text-white text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded shadow">
                        {sitePhoto.regionLabel}
                      </div>
                      <div className="absolute top-2 right-2 bg-emerald-600/90 backdrop-blur-md text-white text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded shadow">
                        AI-GENERATED SITE PHOTO
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-8">
                        <span className="text-[10px] font-bold text-white block">
                          Official AWS Mast Installation & Security Enclosure
                        </span>
                        <p className="text-[9px] text-zinc-300 mt-0.5 font-sans leading-normal">
                          Perimeter security fence, multi-sensor aluminum mast tower, and regional backdrop.
                        </p>
                      </div>
                    </div>
                    <div className="bg-zinc-950/80 border border-zinc-900 rounded p-3 text-[10px] font-mono leading-normal text-zinc-400 space-y-1 print:bg-transparent print:border-zinc-200 print:text-zinc-700">
                      <span className="text-zinc-500 font-bold block uppercase tracking-wider text-[8px]">PHOTOGRAPHIC CLASSIFICATION LOG</span>
                      <p className="font-sans text-xs leading-relaxed">{sitePhoto.description}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Secondary Sensor-Level Photos */}
              {allPhotos.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-800/50 print:border-zinc-200">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">
                    Additional Sensor-Level Attachments ({allPhotos.length})
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {allPhotos.map((photo, idx) => (
                      <div key={idx} className="aspect-[4/3] bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden relative group">
                        <img 
                          src={photo} 
                          alt={`Sensor asset photograph ${idx + 1}`} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <span className="text-[9px] font-mono text-white">Attachment {idx + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Official Footer stamp */}
        <div className="border-t border-zinc-800/60 pt-6 mt-6 flex flex-col sm:flex-row justify-between text-[10px] font-mono text-zinc-500 leading-normal print:border-zinc-300 print:text-zinc-600">
          <span>COMPILED ON: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()} UTC</span>
          <span>METEOROLOGICAL TELEMETRY REGISTRY OFFICE</span>
        </div>

      </div>
    </div>
  );
}
