import React, { useState, useRef, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Plus, 
  Search, 
  Barcode, 
  QrCode, 
  Building2, 
  User, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  UploadCloud, 
  X, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  MapPin, 
  Calendar, 
  DollarSign, 
  ShieldAlert, 
  ChevronRight, 
  Eye, 
  Edit3,
  Undo2,
  FileCheck,
  Tag,
  Download
} from 'lucide-react';
import { Sensor, WeatherStation, AppDocument } from '../types.ts';

interface SensorRegistrationProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  isAuthenticated: boolean;
  onAddSensor: (sensorData: any) => Promise<void>;
  onUpdateSensor: (sensorId: number, sensorData: any) => Promise<void>;
  onDeleteSensor: (sensorId: number) => Promise<void>;
  onRefresh: () => void;
  token?: string | null;
}

export default function SensorRegistration({
  sensors,
  stations,
  isAuthenticated,
  onAddSensor,
  onUpdateSensor,
  onDeleteSensor,
  onRefresh,
  token
}: SensorRegistrationProps) {
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Drag and Drop State
  const [photoFiles, setPhotoFiles] = useState<Array<{ name: string; url: string; size: string }>>([]);
  const [docFiles, setDocFiles] = useState<Array<{ name: string; url: string; size: string }>>([]);
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingDocs, setIsDraggingDocs] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    sensorName: '',
    sensorType: 'Thermometer',
    manufacturer: '',
    modelNumber: '',
    serialNumber: '',
    barcode: '',
    procurementDate: new Date().toISOString().split('T')[0],
    supplierDetails: '',
    invoiceReference: '',
    warrantyStartDate: new Date().toISOString().split('T')[0],
    warrantyEndDate: '',
    calibrationInterval: '12 Months',
    calibrationDetails: '',
    status: 'Store',
    conditionStatus: 'New',
    deploymentInfo: '',
    assignedOffice: '',
    stationId: '',
    responsiblePersonnel: '',
    remarks: ''
  });

  const [statuses, setStatuses] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/statuses')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setStatuses(data);
        }
      })
      .catch(err => console.error("Failed to fetch statuses in SensorRegistration.tsx:", err));
  }, []);

  const [registryDocs, setRegistryDocs] = useState<AppDocument[]>([]);

  useEffect(() => {
    if (token) {
      fetch('/api/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setRegistryDocs(data);
          }
        })
        .catch(err => console.error("Failed to fetch documents in SensorRegistration:", err));
    }
  }, [token, selectedSensor]);

  const downloadDocumentFile = (doc: AppDocument) => {
    if (!doc.fileContent) {
      alert("This document has no stored download file data.");
      return;
    }

    try {
      const parts = doc.fileContent.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || doc.fileType || 'application/octet-stream';
      const b64Data = parts[1] || parts[0];
      
      const byteCharacters = atob(b64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to trigger file download:", err);
      alert("Failed to compile local file download.");
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Helper to generate a unique pseudorandom barcode image using lines
  const renderBarcodeLines = (code: string) => {
    const text = code || 'SEN-0000-BAR';
    // Generate simple deterministic binary pattern from string
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const bars = [];
    for (let i = 0; i < 45; i++) {
      const bit = (Math.abs(hash) >> (i % 31)) & 1;
      const width = bit === 1 ? 'w-[3px]' : 'w-[1px]';
      const gap = (i % 3 === 0) ? 'mr-[2px]' : 'mr-[1px]';
      bars.push(
        <div 
          key={i} 
          className={`h-12 bg-white ${width} ${gap} inline-block`}
        />
      );
    }
    return (
      <div className="flex flex-col items-center bg-[#0a0a0c] p-3 rounded-md border border-[#1f1f23] max-w-[280px]">
        <div className="flex items-center justify-center overflow-hidden h-12">
          {bars}
        </div>
        <div className="text-[10px] text-zinc-500 font-mono tracking-widest mt-1.5">{text}</div>
      </div>
    );
  };

  // Helper to generate a pseudo QR code block using an SVG grid
  const renderQRCodeGrid = (code: string) => {
    const text = code || 'SEN-QRCODE-DATA';
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
    }

    const size = 12;
    const rects = [];
    // Fixed anchor corners
    const isAnchor = (r: number, c: number) => {
      if (r < 3 && c < 3) return true;
      if (r < 3 && c >= size - 3) return true;
      if (r >= size - 3 && c < 3) return true;
      return false;
    };

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        let active = false;
        if (isAnchor(r, c)) {
          // Anchor patterns
          const center = (r === 1 && c === 1) || (r === 1 && c === size - 2) || (r === size - 2 && c === 1);
          const outerRing = (r === 0 || r === 2 || c === 0 || c === 2) || 
                            (r === 0 || r === 2 || c === size - 3 || c === size - 1) ||
                            (r === size - 3 || r === size - 1 || c === 0 || c === 2);
          active = center || outerRing;
        } else {
          // Pseudorandom grid based on hash
          const index = r * size + c;
          active = ((Math.abs(hash) >> (index % 31)) & 1) === 1;
        }

        if (active) {
          rects.push(
            <rect 
              key={`${r}-${c}`} 
              x={c * 8} 
              y={r * 8} 
              width={8} 
              height={8} 
              fill="#ffffff" 
            />
          );
        }
      }
    }

    return (
      <div className="flex flex-col items-center bg-[#0a0a0c] p-3 rounded-md border border-[#1f1f23] w-32">
        <svg width="96" height="96" viewBox="0 0 96 96" className="bg-[#0a0a0c]">
          {rects}
        </svg>
        <div className="text-[9px] text-zinc-500 font-mono tracking-wider mt-1.5 truncate max-w-full text-center">QR: {text.substring(0, 12)}</div>
      </div>
    );
  };

  // Populate form for Edit
  const handleEditSetup = (sensor: Sensor) => {
    setFormData({
      sensorName: sensor.sensorName || '',
      sensorType: sensor.sensorType || 'Thermometer',
      manufacturer: sensor.manufacturer || '',
      modelNumber: sensor.modelNumber || '',
      serialNumber: sensor.serialNumber || '',
      barcode: sensor.barcode || '',
      procurementDate: sensor.procurementDate || new Date().toISOString().split('T')[0],
      supplierDetails: sensor.supplierDetails || '',
      invoiceReference: sensor.invoiceReference || '',
      warrantyStartDate: sensor.warrantyStartDate || new Date().toISOString().split('T')[0],
      warrantyEndDate: sensor.warrantyEndDate || '',
      calibrationInterval: sensor.calibrationInterval || '12 Months',
      calibrationDetails: sensor.calibrationDetails || '',
      status: sensor.status || 'Active',
      conditionStatus: sensor.conditionStatus || 'New',
      deploymentInfo: sensor.deploymentInfo || '',
      assignedOffice: sensor.assignedOffice || '',
      stationId: sensor.stationId ? sensor.stationId.toString() : '',
      responsiblePersonnel: sensor.responsiblePersonnel || '',
      remarks: sensor.remarks || ''
    });

    // Parse attachments
    if (sensor.photos) {
      try {
        setPhotoFiles(JSON.parse(sensor.photos));
      } catch {
        setPhotoFiles(sensor.photos.split(',').filter(Boolean).map(url => ({ name: 'Attached Photo', url, size: 'N/A' })));
      }
    } else {
      setPhotoFiles([]);
    }

    if (sensor.documents) {
      try {
        setDocFiles(JSON.parse(sensor.documents));
      } catch {
        setDocFiles(sensor.documents.split(',').filter(Boolean).map(url => ({ name: url.substring(url.lastIndexOf('/') + 1) || 'Document', url, size: 'N/A' })));
      }
    } else {
      setDocFiles([]);
    }

    setSelectedSensor(sensor);
    setViewMode('edit');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleCreateSetup = () => {
    // Generate a default unique barcode & serial
    const randId = Math.floor(100000 + Math.random() * 900000);
    setFormData({
      sensorName: '',
      sensorType: 'Thermometer',
      manufacturer: '',
      modelNumber: 'MC-' + Math.floor(100 + Math.random() * 900),
      serialNumber: 'SN-' + randId,
      barcode: 'BAR-' + randId,
      procurementDate: new Date().toISOString().split('T')[0],
      supplierDetails: '',
      invoiceReference: 'REF-' + Math.floor(1000 + Math.random() * 9000),
      warrantyStartDate: new Date().toISOString().split('T')[0],
      warrantyEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year default
      calibrationInterval: '12 Months',
      calibrationDetails: 'Pre-deployment standard 3-point laboratory comparison calibration. Ensure reference standards align with national limits.',
      status: 'Store',
      conditionStatus: 'New',
      deploymentInfo: 'Tower Platform Sector B, Elevation +4.5m',
      assignedOffice: 'Central Engineering Office',
      stationId: stations[0]?.stationId ? stations[0].stationId.toString() : '',
      responsiblePersonnel: 'custodian@meteocalib.gov',
      remarks: ''
    });
    setPhotoFiles([
      { name: 'sens_chasis_front.jpg', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=300&q=80', size: '240 KB' }
    ]);
    setDocFiles([
      { name: 'datasheet_v4.pdf', url: '#', size: '1.2 MB' }
    ]);
    setViewMode('create');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Drag and Drop Handlers
  const handleDragOverPhotos = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhotos(true);
  };

  const handleDragLeavePhotos = () => {
    setIsDraggingPhotos(false);
  };

  const handleDropPhotos = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhotos(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    processPhotoFiles(files);
  };

  const handleDragOverDocs = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDocs(true);
  };

  const handleDragLeaveDocs = () => {
    setIsDraggingDocs(false);
  };

  const handleDropDocs = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDocs(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    processDocFiles(files);
  };

  const processPhotoFiles = (files: File[]) => {
    const validImages = files.filter(f => f.type.startsWith('image/'));
    if (validImages.length === 0) return;

    validImages.forEach(file => {
      const sizeStr = (file.size / 1024).toFixed(0) + ' KB';
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoFiles(prev => [...prev, {
          name: file.name,
          url: reader.result as string || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=300&q=80',
          size: sizeStr
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const processDocFiles = (files: File[]) => {
    files.forEach(file => {
      const sizeStr = (file.size / 1024).toFixed(0) + ' KB';
      setDocFiles(prev => [...prev, {
        name: file.name,
        url: '#',
        size: sizeStr
      }]);
    });
  };

  const removePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeDoc = (index: number) => {
    setDocFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setErrorMsg('You must login to perform this action.');
      return;
    }

    if (!formData.sensorType || !formData.manufacturer || !formData.status) {
      setErrorMsg('Missing core fields: Type, Manufacturer, or Status');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const submissionPayload = {
      ...formData,
      stationId: formData.stationId ? parseInt(formData.stationId) : null,
      photos: JSON.stringify(photoFiles),
      documents: JSON.stringify(docFiles)
    };

    try {
      if (viewMode === 'create') {
        await onAddSensor(submissionPayload);
        setSuccessMsg('Asset registered successfully!');
        setTimeout(() => {
          setViewMode('list');
          onRefresh();
        }, 1500);
      } else if (viewMode === 'edit' && selectedSensor) {
        await onUpdateSensor(selectedSensor.sensorId, submissionPayload);
        setSuccessMsg('Sensor details updated successfully!');
        setTimeout(() => {
          setViewMode('list');
          setSelectedSensor(null);
          onRefresh();
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to complete registration action.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (sensorId: number) => {
    if (!isAuthenticated) return;
    if (confirm('Are you absolutely sure you want to retire and remove this sensor from the main registry?')) {
      try {
        await onDeleteSensor(sensorId);
        setSelectedSensor(null);
        setViewMode('list');
        onRefresh();
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to delete sensor asset.');
      }
    }
  };

  // Filter & Search Logics
  const filteredSensors = sensors.filter(sensor => {
    const matchesSearch = 
      sensor.sensorType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sensor.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sensor.sensorName && sensor.sensorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sensor.serialNumber && sensor.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sensor.barcode && sensor.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      sensor.sensorId.toString().includes(searchTerm);

    const matchesType = typeFilter === 'all' || sensor.sensorType === typeFilter;
    const matchesStatus = statusFilter === 'all' || sensor.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const sensorTypes = Array.from(new Set(sensors.map(s => s.sensorType)));
  const sensorStatuses = ['Active', 'In Calibration', 'Maintenance', 'Retired'];

  return (
    <div className="flex-1 overflow-y-auto p-10 max-w-7xl mx-auto w-full bg-[#050505] text-[#e4e4e7]">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-[#1f1f23]">
        <div>
          <div className="flex items-center space-x-2.5">
            <ClipboardCheck className="h-6 w-6 text-blue-500" />
            <h2 className="font-serif italic text-2xl md:text-3xl tracking-wide text-white">
              Sensor Registration & Pedigree
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Provisioning registry entries, hardware barcodes, warranty certificates, and complete lifecycle logs.
          </p>
        </div>
        
        {viewMode === 'list' ? (
          <button
            onClick={handleCreateSetup}
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold tracking-wide shadow-lg shadow-blue-600/20 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Register New Asset</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setViewMode('list');
              setSelectedSensor(null);
            }}
            className="flex items-center space-x-2 px-4 py-2.5 bg-[#0f0f12] hover:bg-white/5 text-zinc-300 border border-[#1f1f23] rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span>Back to Asset Directory</span>
          </button>
        )}
      </div>

      {/* Main Module Layout */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Master Directory and Filters (7 Columns) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Search & Filter Bar */}
            <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-5 space-y-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by Name, Type, SN, Barcode or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f23] rounded-md pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-600 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Sensor Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    {sensorTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Operational Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    {sensorStatuses.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Assets Grid List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold">
                  Matches: {filteredSensors.length} of {sensors.length} registered
                </span>
                <span className="text-[10px] font-mono text-zinc-600">Click to load full pedigrees</span>
              </div>

              {filteredSensors.length === 0 ? (
                <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-16 text-center text-zinc-500">
                  <ClipboardCheck className="h-10 w-10 text-zinc-700 mx-auto mb-2" />
                  <p className="font-serif italic text-sm text-white">No sensor assets found.</p>
                  <p className="text-xs text-zinc-500 mt-1">Try expanding search query parameters.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredSensors.map(sensor => {
                    const isSelected = selectedSensor?.sensorId === sensor.sensorId;
                    return (
                      <div
                        key={sensor.sensorId}
                        onClick={() => setSelectedSensor(sensor)}
                        className={`p-4 bg-[#0f0f12] border rounded-md cursor-pointer transition-all flex items-center justify-between group ${
                          isSelected 
                            ? 'border-blue-600/50 bg-[#111116]' 
                            : 'border-[#1f1f23] hover:border-[#2f2f35] hover:bg-[#121215]'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono text-zinc-500 bg-[#050505] border border-[#1f1f23] px-2 py-0.5 rounded-sm">
                              SEN-{sensor.sensorId.toString().padStart(4, '0')}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${
                              sensor.status === 'Active' ? 'bg-emerald-500' :
                              sensor.status === 'In Calibration' ? 'bg-blue-500' :
                              sensor.status === 'Maintenance' ? 'bg-amber-500' : 'bg-zinc-600'
                            }`} title={sensor.status} />
                            <h4 className="text-sm font-semibold text-white tracking-wide truncate">
                              {sensor.sensorName || `${sensor.manufacturer} ${sensor.sensorType}`}
                            </h4>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-zinc-400 font-mono">
                            <div className="truncate">Type: <span className="text-zinc-200 font-sans">{sensor.sensorType}</span></div>
                            <div className="truncate">Model: <span className="text-zinc-200">{sensor.modelNumber || 'N/A'}</span></div>
                            <div className="truncate col-span-2 sm:col-span-1">Office: <span className="text-zinc-200 font-sans">{sensor.assignedOffice || 'N/A'}</span></div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          {sensor.barcode && (
                            <Barcode className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition" title={sensor.barcode} />
                          )}
                          <ChevronRight className={`h-4 w-4 text-zinc-600 group-hover:text-white transition transform ${
                            isSelected ? 'translate-x-1 text-blue-500' : ''
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right: Detailed Pedigree Sheet View (5 Columns) */}
          <div className="lg:col-span-5">
            {selectedSensor ? (
              <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md overflow-hidden sticky top-10">
                
                {/* Meta Title */}
                <div className="p-5 border-b border-[#1f1f23] bg-gradient-to-r from-blue-900/10 to-transparent flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-mono font-bold tracking-[0.25em] text-blue-500 uppercase">ASSET PEDIGREE SHEET</span>
                    <h3 className="text-base font-serif italic text-white mt-0.5">
                      SEN-{selectedSensor.sensorId.toString().padStart(4, '0')}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleEditSetup(selectedSensor)}
                      className="p-2 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 rounded-sm transition cursor-pointer"
                      title="Edit Registration Entry"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    {isAuthenticated && (
                      <button
                        onClick={() => handleDelete(selectedSensor.sensorId)}
                        className="p-2 bg-red-950/20 hover:bg-red-900/40 text-red-400 border border-red-900/20 rounded-sm transition cursor-pointer"
                        title="Retire Asset"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Pedigree Content */}
                <div className="p-6 space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto">
                  
                  {/* Visual Asset Photos */}
                  {selectedSensor.photos ? (
                    <div>
                      <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-2.5">Asset Visual Evidence</span>
                      <div className="grid grid-cols-2 gap-2">
                        {(() => {
                          try {
                            const parsed = JSON.parse(selectedSensor.photos);
                            return parsed.map((photo: any, index: number) => (
                              <div key={index} className="relative rounded-sm overflow-hidden border border-[#1f1f23] aspect-video group bg-[#050505]">
                                <img 
                                  src={photo.url} 
                                  alt={photo.name} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-350"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 flex items-end">
                                  <span className="text-[9px] font-mono text-zinc-400 truncate">{photo.name}</span>
                                </div>
                              </div>
                            ));
                          } catch {
                            return (
                              <div className="col-span-2 p-3 bg-[#050505] border border-[#1f1f23] text-zinc-500 text-xs italic">
                                Loading image file...
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-[#050505] border border-[#1f1f23] rounded-sm flex items-center space-x-3 text-zinc-500 text-xs italic">
                      <ImageIcon className="h-4 w-4 shrink-0 text-zinc-700" />
                      <span>No visual photo documentation uploaded.</span>
                    </div>
                  )}

                  {/* 23 Requested Parameter Matrix */}
                  <div className="space-y-4">
                    
                    {/* Section 1: Core Specs */}
                    <div className="border-t border-[#1f1f23] pt-4">
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold mb-3 flex items-center gap-1.5">
                        <Tag className="h-3 w-3" />
                        Core Specifications
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-xs">
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Sensor Name</p>
                          <p className="text-white font-sans font-semibold mt-0.5">{selectedSensor.sensorName || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Sensor Type</p>
                          <p className="text-white mt-0.5">{selectedSensor.sensorType}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Manufacturer</p>
                          <p className="text-white mt-0.5">{selectedSensor.manufacturer}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Model Number</p>
                          <p className="text-zinc-200 mt-0.5">{selectedSensor.modelNumber || 'N/A'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Serial Number</p>
                          <p className="text-zinc-200 mt-0.5">{selectedSensor.serialNumber || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Codes and Graphics */}
                    <div className="border-t border-[#1f1f23] pt-4">
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold mb-3 flex items-center gap-1.5">
                        <Barcode className="h-3.5 w-3.5" />
                        Barcode / QR Codes
                      </h4>
                      <div className="flex flex-wrap gap-4 items-start">
                        {renderBarcodeLines(selectedSensor.barcode || `SEN-${selectedSensor.sensorId}`)}
                        {renderQRCodeGrid(selectedSensor.barcode || `SEN-${selectedSensor.sensorId}`)}
                      </div>
                    </div>

                    {/* Section 3: Procurement & Warranty */}
                    <div className="border-t border-[#1f1f23] pt-4">
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold mb-3 flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5" />
                        Logistics, Supplier & Warranty
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-xs">
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Procurement Date</p>
                          <p className="text-zinc-300 mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-zinc-500" />
                            {selectedSensor.procurementDate || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Procurement Reference</p>
                          <p className="text-zinc-200 mt-0.5 font-bold">{selectedSensor.invoiceReference || 'N/A'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Supplier Details</p>
                          <p className="text-zinc-200 mt-0.5 font-sans whitespace-pre-line bg-[#050505] border border-[#1f1f23] p-2.5 rounded-sm text-[11px]">
                            {selectedSensor.supplierDetails || 'No Supplier Records.'}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Warranty Start</p>
                          <p className="text-zinc-300 mt-0.5">{selectedSensor.warrantyStartDate || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Warranty End</p>
                          <p className="text-zinc-300 mt-0.5">{selectedSensor.warrantyEndDate || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Operational deployment & calibration limits */}
                    <div className="border-t border-[#1f1f23] pt-4">
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold mb-3 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Operational Parameters & Calibration
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-xs">
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Condition Status</p>
                          <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wide mt-1 ${
                            selectedSensor.conditionStatus === 'New' || selectedSensor.conditionStatus === 'Excellent' 
                              ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/30' 
                              : selectedSensor.conditionStatus === 'Good' || selectedSensor.conditionStatus === 'Fair'
                                ? 'bg-amber-950/50 text-amber-400 border border-amber-900/30'
                                : 'bg-red-950/50 text-red-400 border border-red-900/30'
                          }`}>
                            {selectedSensor.conditionStatus || 'Good'}
                          </span>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Calibration Interval</p>
                          <p className="text-white mt-1 font-bold">{selectedSensor.calibrationInterval || '12 Months'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Calibration Details</p>
                          <p className="text-zinc-300 mt-0.5 font-sans text-[11px] leading-relaxed bg-[#050505] border border-[#1f1f23] p-2.5 rounded-sm">
                            {selectedSensor.calibrationDetails || 'Standard calibration interval specifications apply.'}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Assigned Office</p>
                          <p className="text-white font-sans mt-0.5">{selectedSensor.assignedOffice || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Responsible Person</p>
                          <p className="text-zinc-300 truncate mt-0.5" title={selectedSensor.responsiblePersonnel || ''}>
                            {selectedSensor.responsiblePersonnel || 'N/A'}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Assigned Station</p>
                          <p className="text-white mt-0.5 font-sans font-medium flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                            {selectedSensor.stationName || 'Unassigned'}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Deployment Details</p>
                          <p className="text-zinc-300 mt-0.5 font-sans text-[11px] leading-relaxed bg-[#050505] border border-[#1f1f23] p-2.5 rounded-sm">
                            {selectedSensor.deploymentInfo || 'No custom deployment coordinates set.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Section 5: Remarks and Docs */}
                    <div className="border-t border-[#1f1f23] pt-4">
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold mb-3 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Documents & Remarks
                      </h4>
                      <div className="space-y-3 font-sans text-xs">
                        {selectedSensor.remarks && (
                          <div>
                            <span className="block text-[9px] uppercase font-mono text-zinc-500 tracking-wider">Remarks / Notes</span>
                            <p className="text-zinc-300 bg-[#050505] p-2.5 rounded-sm border border-[#1f1f23] text-[11px] mt-1 whitespace-pre-line leading-relaxed">
                              {selectedSensor.remarks}
                            </p>
                          </div>
                        )}

                        <div>
                          <span className="block text-[9px] uppercase font-mono text-zinc-500 tracking-wider mb-2">Attached Data Sheets / Documents</span>
                          {selectedSensor.documents ? (
                            <div className="space-y-1.5 mb-4">
                              {(() => {
                                try {
                                  const docs = JSON.parse(selectedSensor.documents);
                                  return docs.map((doc: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-2.5 bg-[#050505] border border-[#1f1f23] rounded-sm text-xs font-mono">
                                      <div className="flex items-center space-x-2 truncate">
                                        <FileCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                                        <span className="text-zinc-300 truncate">{doc.name}</span>
                                      </div>
                                      <span className="text-zinc-600 text-[10px] shrink-0">{doc.size}</span>
                                    </div>
                                  ));
                                } catch {
                                  return (
                                    <div className="text-zinc-500 italic text-xs">No certified documents attached.</div>
                                  );
                                }
                              })()}
                            </div>
                          ) : (
                            <div className="text-zinc-500 italic text-xs mb-4">No direct documents attached.</div>
                          )}

                          {/* Registry Document Links */}
                          <span className="block text-[9px] uppercase font-mono text-zinc-500 tracking-wider mb-2 mt-4">Linked Registry Documents</span>
                          {(() => {
                            const linkedDocs = registryDocs.filter((d: AppDocument) => {
                              if (d.sensorModel) {
                                const modelMatches = d.sensorModel === (selectedSensor.modelNumber || 'N/A');
                                if (!modelMatches) return false;
                                
                                if (d.serialNumber) {
                                  return d.serialNumber === selectedSensor.serialNumber;
                                }
                                return true;
                              }
                              return d.sensorId === selectedSensor.sensorId;
                            });
                            if (linkedDocs.length > 0) {
                              return (
                                <div className="space-y-1.5">
                                  {linkedDocs.map((doc: AppDocument) => (
                                    <div key={doc.id} className="flex items-center justify-between p-2.5 bg-[#050505] border border-[#1f1f23] rounded-sm text-xs">
                                      <div className="flex items-center space-x-2 truncate">
                                        <FileCheck className="h-4 w-4 text-blue-400 shrink-0" />
                                        <div className="truncate">
                                          <span className="text-zinc-200 font-medium block truncate" title={doc.title}>{doc.title}</span>
                                          <span className="text-zinc-500 text-[10px] block font-mono">{doc.category} • {doc.fileName}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2 shrink-0">
                                        <span className="text-zinc-600 text-[10px] font-mono mr-1">{doc.fileSize || 'N/A'}</span>
                                        <button
                                          onClick={() => downloadDocumentFile(doc)}
                                          className="p-1 text-zinc-400 hover:text-white hover:bg-white/5 rounded transition cursor-pointer"
                                          title="Download Document"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            } else {
                              return (
                                <div className="text-zinc-500 italic text-xs">No documents linked from the National Document Registry.</div>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            ) : (
              <div className="bg-[#0f0f12] border border-[#1f1f23] rounded-md p-10 text-center text-zinc-500 flex flex-col items-center justify-center min-h-[400px]">
                <HelpCircle className="h-8 w-8 text-zinc-700 mb-2" />
                <p className="font-serif italic text-sm text-white">No Sensor Selected</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-[240px] mx-auto">
                  Select a sensor from the master directory to view its full 23-point specification sheets.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Creation and Edit Wizard UI */}
      {(viewMode === 'create' || viewMode === 'edit') && (
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto bg-[#0f0f12] border border-[#1f1f23] rounded-md overflow-hidden shadow-2xl">
          
          {/* Header */}
          <div className="p-6 border-b border-[#1f1f23] bg-gradient-to-r from-blue-900/10 to-transparent flex items-center justify-between">
            <div>
              <span className="text-[9px] font-mono font-bold tracking-[0.25em] text-blue-500 uppercase">
                {viewMode === 'create' ? 'ASSET REGISTRATION ENGINE' : 'ASSET SPECIFICATION UPDATER'}
              </span>
              <h3 className="text-lg font-serif italic text-white mt-1">
                {viewMode === 'create' ? 'Register New Meteorological Instrument' : `Editing Sensor SEN-${selectedSensor?.sensorId}`}
              </h3>
            </div>
            <div className="px-3 py-1 bg-white/5 border border-[#1f1f23] rounded-md text-[10px] font-mono text-zinc-400">
              {viewMode === 'create' ? 'NEW ENTRY' : `ID: ${selectedSensor?.sensorId}`}
            </div>
          </div>

          {/* Feedback banners */}
          {errorMsg && (
            <div className="p-4 bg-red-950/20 border-b border-red-900/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-4 bg-emerald-950/20 border-b border-emerald-900/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Core Fields Grid */}
          <div className="p-8 space-y-8">
            
            {/* Step 1: Core Specifications */}
            <div>
              <h4 className="text-[11px] font-mono uppercase tracking-[0.2em] text-blue-500 font-bold mb-4 flex items-center gap-2 pb-2 border-b border-[#1f1f23]">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center font-mono">1</span>
                Core Hardware Specifications & Identity
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Sensor Name <span className="text-blue-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ultrasonic Wind Transducer"
                    value={formData.sensorName}
                    onChange={(e) => setFormData({...formData, sensorName: e.target.value})}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Sensor Type <span className="text-blue-500">*</span></label>
                  <select
                    value={formData.sensorType}
                    onChange={(e) => setFormData({...formData, sensorType: e.target.value})}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-600 cursor-pointer transition"
                  >
                    <option value="Thermometer">Thermometer (Temperature)</option>
                    <option value="Barometer">Barometer (Pressure)</option>
                    <option value="Anemometer">Anemometer (Wind Speed)</option>
                    <option value="Hygrometer">Hygrometer (Humidity)</option>
                    <option value="Rain Gauge">Rain Gauge (Precipitation)</option>
                    <option value="Pyranometer">Pyranometer (Solar Radiation)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Manufacturer <span className="text-blue-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vaisala, Campbell Scientific"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Model Number</label>
                  <input
                    type="text"
                    placeholder="e.g. HMT-330"
                    value={formData.modelNumber}
                    onChange={(e) => setFormData({...formData, modelNumber: e.target.value})}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Serial Number</label>
                  <input
                    type="text"
                    placeholder="e.g. SN-49204-X"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({...formData, serialNumber: e.target.value})}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Asset Barcode / QR Code</label>
                  <input
                    type="text"
                    placeholder="e.g. BAR-009419"
                    value={formData.barcode}
                    onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Logistics & Supplier */}
            <div>
              <h4 className="text-[11px] font-mono uppercase tracking-[0.2em] text-emerald-500 font-bold mb-4 flex items-center gap-2 pb-2 border-b border-[#1f1f23]">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center font-mono">2</span>
                Procurement, Supplier Records & Warranty
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Procurement Date</label>
                    <input
                      type="date"
                      value={formData.procurementDate}
                      onChange={(e) => setFormData({...formData, procurementDate: e.target.value})}
                      className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-600 transition cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Invoice/Procurement Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-849102-M"
                      value={formData.invoiceReference}
                      onChange={(e) => setFormData({...formData, invoiceReference: e.target.value})}
                      className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Warranty Start Date</label>
                    <input
                      type="date"
                      value={formData.warrantyStartDate}
                      onChange={(e) => setFormData({...formData, warrantyStartDate: e.target.value})}
                      className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-600 transition cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Warranty End Date</label>
                    <input
                      type="date"
                      value={formData.warrantyEndDate}
                      onChange={(e) => setFormData({...formData, warrantyEndDate: e.target.value})}
                      className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-600 transition cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Supplier Contact Details</label>
                  <textarea
                    rows={4}
                    placeholder="Enter supplier corporate name, representative email, phone lines, and physical address details..."
                    value={formData.supplierDetails}
                    onChange={(e) => setFormData({...formData, supplierDetails: e.target.value})}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Operational deployment & calibration limits */}
            <div>
              <h4 className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-500 font-bold mb-4 flex items-center gap-2 pb-2 border-b border-[#1f1f23]">
                <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[9px] font-bold flex items-center justify-center font-mono">3</span>
                Operations, Deployment & Calibration Criteria
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Calibration Interval</label>
                    <select
                      value={formData.calibrationInterval}
                      onChange={(e) => setFormData({...formData, calibrationInterval: e.target.value})}
                      className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-600 cursor-pointer transition"
                    >
                      <option value="3 Months">3 Months (Intense Field)</option>
                      <option value="6 Months">6 Months (Standard Field)</option>
                      <option value="12 Months">12 Months (Laboratory standard)</option>
                      <option value="24 Months">24 Months (Long Term)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Current Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-600 cursor-pointer transition"
                    >
                      {statuses.map(st => (
                        <option key={st.id} value={st.statusName}>
                          {st.statusName} {st.isConsumableOnly === 'true' ? '(Consumable)' : ''}
                        </option>
                      ))}
                      {statuses.length === 0 && (
                        <>
                          <option value="Store">Store</option>
                          <option value="Deployed">Deployed</option>
                          <option value="Under Calibration">Under Calibration</option>
                          <option value="Under Repair">Under Repair</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Condition Status</label>
                    <select
                      value={formData.conditionStatus}
                      onChange={(e) => setFormData({...formData, conditionStatus: e.target.value})}
                      className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-600 cursor-pointer transition"
                    >
                      <option value="New">Brand New (As Delivered)</option>
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good (Nominal)</option>
                      <option value="Fair">Fair (Wear observed)</option>
                      <option value="Damaged">Damaged / Needs Repair</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Assigned Weather Station</label>
                    <select
                      value={formData.stationId}
                      onChange={(e) => setFormData({...formData, stationId: e.target.value})}
                      className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-600 cursor-pointer transition"
                    >
                      <option value="">No Station Assignment</option>
                      {stations.map(station => (
                        <option key={station.stationId} value={station.stationId}>
                          {station.stationName} ({station.region})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Assigned Office Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Field Laboratory Sector Seven"
                      value={formData.assignedOffice}
                      onChange={(e) => setFormData({...formData, assignedOffice: e.target.value})}
                      className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Responsible Custodian / Personnel Email</label>
                    <input
                      type="email"
                      placeholder="e.g. tech-lead@meteocalib.gov"
                      value={formData.responsiblePersonnel}
                      onChange={(e) => setFormData({...formData, responsiblePersonnel: e.target.value})}
                      className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Deployment Details</label>
                  <input
                    type="text"
                    placeholder="e.g. Tower No. 3 at 10m height, facing true North. GPS: 14.293 N, 120.912 E"
                    value={formData.deploymentInfo}
                    onChange={(e) => setFormData({...formData, deploymentInfo: e.target.value})}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Calibration Details / Procedures</label>
                  <textarea
                    rows={2}
                    placeholder="Enter standard operating procedures for calibration, reference levels, standard gas/fluid settings, etc..."
                    value={formData.calibrationDetails}
                    onChange={(e) => setFormData({...formData, calibrationDetails: e.target.value})}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
              </div>
            </div>

            {/* Step 4: Remarks, Photos and Documents */}
            <div>
              <h4 className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-bold mb-4 flex items-center gap-2 pb-2 border-b border-[#1f1f23]">
                <span className="w-4 h-4 rounded-full bg-zinc-600 text-white text-[9px] font-bold flex items-center justify-center font-mono">4</span>
                Attachments & Remarks
              </h4>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Remarks / Annotations</label>
                  <textarea
                    rows={3}
                    placeholder="Enter miscellaneous remarks, operational limits, physical condition quirks, or comments..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                    className="w-full bg-[#050505] border border-[#1f1f23] rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>

                {/* Upload Photos Section (Drag and Drop + Manual) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Upload Asset Photos</label>
                    <div 
                      onDragOver={handleDragOverPhotos}
                      onDragLeave={handleDragLeavePhotos}
                      onDrop={handleDropPhotos}
                      onClick={() => photoInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition ${
                        isDraggingPhotos 
                          ? 'border-blue-500 bg-blue-500/5' 
                          : 'border-[#1f1f23] hover:border-zinc-700 bg-[#050505]'
                      }`}
                    >
                      <input 
                        type="file" 
                        ref={photoInputRef}
                        onChange={(e) => e.target.files && processPhotoFiles(Array.from(e.target.files))}
                        className="hidden" 
                        multiple 
                        accept="image/*"
                      />
                      <UploadCloud className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                      <p className="text-xs text-zinc-300 font-medium">Drag & Drop visual photos, or <span className="text-blue-500">browse files</span></p>
                      <p className="text-[10px] text-zinc-500 mt-1">Supports PNG, JPG, GIF up to 10MB</p>
                    </div>

                    {/* Previews */}
                    {photoFiles.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {photoFiles.map((photo, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-[#050505] border border-[#1f1f23] rounded-sm text-xs font-mono">
                            <span className="text-zinc-300 truncate max-w-[120px]" title={photo.name}>{photo.name}</span>
                            <div className="flex items-center space-x-1.5 shrink-0">
                              <span className="text-zinc-600 text-[9px]">{photo.size}</span>
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                                className="text-zinc-500 hover:text-white transition cursor-pointer"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Upload Documents Section (Drag and Drop + Manual) */}
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5">Upload Calibration Data / Documents</label>
                    <div 
                      onDragOver={handleDragOverDocs}
                      onDragLeave={handleDragLeaveDocs}
                      onDrop={handleDropDocs}
                      onClick={() => docInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition ${
                        isDraggingDocs 
                          ? 'border-blue-500 bg-blue-500/5' 
                          : 'border-[#1f1f23] hover:border-zinc-700 bg-[#050505]'
                      }`}
                    >
                      <input 
                        type="file" 
                        ref={docInputRef}
                        onChange={(e) => e.target.files && processDocFiles(Array.from(e.target.files))}
                        className="hidden" 
                        multiple 
                      />
                      <UploadCloud className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                      <p className="text-xs text-zinc-300 font-medium">Drag & Drop certified PDF/DOC files, or <span className="text-blue-500">browse files</span></p>
                      <p className="text-[10px] text-zinc-500 mt-1">Supports PDF, XLSX, DOCX up to 25MB</p>
                    </div>

                    {/* Previews */}
                    {docFiles.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {docFiles.map((doc, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-[#050505] border border-[#1f1f23] rounded-sm text-xs font-mono">
                            <span className="text-zinc-300 truncate max-w-[180px]" title={doc.name}>{doc.name}</span>
                            <div className="flex items-center space-x-1.5 shrink-0">
                              <span className="text-zinc-600 text-[9px]">{doc.size}</span>
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); removeDoc(idx); }}
                                className="text-zinc-500 hover:text-white transition cursor-pointer"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Actions Footer */}
          <div className="p-6 bg-[#0c0c0e] border-t border-[#1f1f23] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setSelectedSensor(null);
              }}
              className="px-4 py-2 bg-transparent hover:bg-white/5 border border-transparent text-zinc-400 hover:text-white rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !isAuthenticated}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-md text-xs font-bold tracking-widest uppercase transition shadow-lg ${
                !isAuthenticated 
                  ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <ClipboardCheck className="h-4 w-4" />
                  <span>{viewMode === 'create' ? 'Complete Registration' : 'Update Specifications'}</span>
                </>
              )}
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
