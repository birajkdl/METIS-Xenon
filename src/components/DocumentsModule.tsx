import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  Trash2, 
  BookOpen, 
  ClipboardList, 
  Cpu, 
  Award, 
  File, 
  UploadCloud, 
  X, 
  Check, 
  Loader2, 
  Paperclip, 
  Info, 
  MapPin, 
  AlertCircle, 
  Eye, 
  Download,
  Building2
} from 'lucide-react';
import { AppDocument, WeatherStation, Sensor } from '../types.ts';

interface DocumentsModuleProps {
  token: string | null;
  user: any;
  role: string | null;
  stations: WeatherStation[];
  sensors: Sensor[];
  theme: 'light' | 'dark';
}

export default function DocumentsModule({
  token,
  user,
  role,
  stations,
  sensors,
  theme
}: DocumentsModuleProps) {
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Manuals' | 'SOP' | 'Wiring Diagram' | 'Calibration Certificate' | 'Other documents'>('Manuals');
  const [associatedStationId, setAssociatedStationId] = useState<string>('');
  const [associatedSensorId, setAssociatedSensorId] = useState<string>('');
  const [selectedSensorType, setSelectedSensorType] = useState<string>('');
  const [selectedSensorModel, setSelectedSensorModel] = useState<string>('');
  const [selectedSerialNumber, setSelectedSerialNumber] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContentBase64, setFileContentBase64] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Viewer states
  const [activeDocViewer, setActiveDocViewer] = useState<AppDocument | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    { name: 'All', label: 'All Documents' },
    { name: 'Manuals', label: 'Manuals' },
    { name: 'SOP', label: 'SOPs' },
    { name: 'Wiring Diagram', label: 'Wiring Diagrams' },
    { name: 'Calibration Certificate', label: 'Calibration Certs' },
    { name: 'Other documents', label: 'Other Docs' }
  ];

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to retrieve documents.');
      const data = await response.json();
      setDocuments(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error fetching documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDocuments();
    }
  }, [token]);

  // Handle manual file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  // Handle drag and drop file selection
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  const processFile = (file: File | undefined) => {
    if (!file) return;
    setSelectedFile(file);
    if (!title) {
      // Pre-populate title with a clean version of the file name
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setTitle(cleanName);
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileContentBase64(reader.result as string);
    };
    reader.onerror = () => {
      console.error("Error reading file to base64");
    };
    reader.readAsDataURL(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const clearForm = () => {
    setTitle('');
    setCategory('Manuals');
    setAssociatedStationId('');
    setAssociatedSensorId('');
    setSelectedSensorType('');
    setSelectedSensorModel('');
    setSelectedSerialNumber('');
    setSelectedFile(null);
    setFileContentBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uniqueSensorTypes = Array.from(new Set(sensors.map(s => s.sensorType).filter(Boolean)));
  
  const uniqueModelNumbers = useMemo(() => {
    if (!selectedSensorType) return [];
    const models = sensors
      .filter(s => s.sensorType === selectedSensorType)
      .map(s => s.modelNumber || 'N/A')
      .filter(Boolean);
    return Array.from(new Set(models));
  }, [sensors, selectedSensorType]);

  const availableSerialNumbers = useMemo(() => {
    if (!selectedSensorType || !selectedSensorModel) return [];
    return sensors
      .filter(s => s.sensorType === selectedSensorType && (s.modelNumber || 'N/A') === selectedSensorModel)
      .map(s => s.serialNumber)
      .filter(Boolean);
  }, [sensors, selectedSensorType, selectedSensorModel]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Please provide a title for the document.");
      return;
    }
    if (!selectedFile) {
      alert("Please select or drop a file to upload.");
      return;
    }

    setSubmitting(true);
    setSuccessMsg(null);
    setError(null);

    // Resolve sensor and station details
    let calculatedStationId: number | null = null;
    let calculatedSensorId: number | null = null;

    if (selectedSensorType && selectedSensorModel) {
      const matchingSensors = sensors.filter(s => 
        s.sensorType === selectedSensorType && 
        (s.modelNumber || 'N/A') === selectedSensorModel
      );

      if (category === 'Calibration Certificate' && selectedSerialNumber) {
        const specificSensor = matchingSensors.find(s => s.serialNumber === selectedSerialNumber);
        if (specificSensor) {
          calculatedSensorId = specificSensor.sensorId;
          calculatedStationId = specificSensor.stationId;
        }
      } else {
        const firstSensor = matchingSensors[0];
        if (firstSensor) {
          calculatedSensorId = firstSensor.sensorId;
          calculatedStationId = firstSensor.stationId;
        }
      }
    }

    try {
      const body = {
        title: title.trim(),
        category,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: formatBytes(selectedFile.size),
        fileContent: fileContentBase64,
        stationId: calculatedStationId,
        sensorId: calculatedSensorId,
        sensorModel: selectedSensorModel || null,
        serialNumber: (category === 'Calibration Certificate' && selectedSerialNumber) ? selectedSerialNumber : null
      };

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to upload document.');
      }

      setSuccessMsg(`Document "${title}" uploaded successfully!`);
      clearForm();
      fetchDocuments();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error uploading document.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this document?")) return;

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete document.');
      }

      setDocuments(prev => prev.filter(d => d.id !== docId));
      if (activeDocViewer?.id === docId) {
        setActiveDocViewer(null);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error deleting document.');
    }
  };

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

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (doc.uploadedBy && doc.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const renderDocumentPreview = (doc: AppDocument) => {
    if (!doc.fileContent) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-zinc-950 rounded-2xl border border-zinc-900 text-center min-h-[300px]">
          <AlertCircle className="w-10 h-10 text-amber-500 mb-2 animate-pulse" />
          <p className="text-xs text-zinc-400">This document has no binary data stored for inline preview.</p>
        </div>
      );
    }

    const isImage = doc.fileType?.startsWith('image/') || doc.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = doc.fileType === 'application/pdf' || doc.fileName.endsWith('.pdf');
    const isText = doc.fileType?.startsWith('text/') || doc.fileName.match(/\.(txt|csv|log|json|xml)$/i);
    const isCsv = doc.fileName.endsWith('.csv');

    if (isImage) {
      return (
        <div className="flex flex-col items-center justify-center bg-black/40 rounded-2xl border border-zinc-800/80 p-3 overflow-hidden h-[420px] relative group/preview">
          <img 
            src={doc.fileContent} 
            alt={doc.title} 
            className="max-h-full max-w-full object-contain rounded-xl transition-all duration-300"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-3 left-3 bg-black/75 px-2.5 py-1 rounded-md text-[10px] text-zinc-400 border border-zinc-800 pointer-events-none">
            Visual File Preview • Zoom enabled
          </div>
        </div>
      );
    }

    if (isPdf) {
      return (
        <div className="bg-black/40 rounded-2xl border border-zinc-800 overflow-hidden h-[420px] flex flex-col">
          <div className="bg-[#050507] px-4 py-2 border-b border-zinc-800 text-[10px] text-zinc-400 flex justify-between items-center font-mono">
            <span>SANDBOXED PDF VIEW</span>
            <span className="text-blue-400">Standard Navigation Ready</span>
          </div>
          <iframe 
            src={doc.fileContent} 
            title={doc.title} 
            className="w-full h-full border-none bg-zinc-100"
          />
        </div>
      );
    }

    if (isText) {
      try {
        const parts = doc.fileContent.split(',');
        const b64Data = parts[1] || parts[0];
        const textContent = atob(b64Data);

        if (isCsv) {
          const rows = textContent.split('\n').filter(r => r.trim()).map(r => r.split(','));
          return (
            <div className="bg-black/40 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col h-[420px]">
              <div className="bg-[#050507] px-4 py-2 border-b border-zinc-800 text-[10px] text-zinc-400 flex justify-between items-center font-mono">
                <span>SPREADSHEET DUMP</span>
                <span className="text-emerald-400">CSV Stream Decoded</span>
              </div>
              <div className="overflow-auto p-2 flex-1 scrollbar-thin">
                <table className="w-full text-left text-[11px] font-sans border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-850 bg-zinc-950/80 sticky top-0">
                      {rows[0]?.map((col, idx) => (
                        <th key={idx} className="p-2 text-white font-medium border-r border-zinc-850 last:border-r-0 whitespace-nowrap">
                          {col.replace(/['"]/g, '')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(1, 40).map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-zinc-900/60 hover:bg-white/[0.02]">
                        {row.map((col, cIdx) => (
                          <td key={cIdx} className="p-2 text-zinc-400 border-r border-zinc-900 last:border-r-0 truncate max-w-[150px]" title={col}>
                            {col.replace(/['"]/g, '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 40 && (
                  <div className="text-[10px] text-zinc-500 text-center py-2 border-t border-zinc-850 bg-black/20 mt-1">
                    Showing first 39 rows. Use Download to view the entire {rows.length} row list.
                  </div>
                )}
              </div>
            </div>
          );
        }

        return (
          <div className="bg-black/40 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col h-[420px]">
            <div className="bg-[#050507] px-4 py-2 border-b border-zinc-800 text-[10px] text-zinc-400 flex justify-between items-center font-mono">
              <span>RAW TEXT / DATA LOG</span>
              <span className="text-amber-400">{doc.fileName.split('.').pop()?.toUpperCase()}</span>
            </div>
            <pre className="p-4 overflow-auto font-mono text-[11px] text-zinc-300 bg-black/20 text-left leading-relaxed select-text whitespace-pre-wrap flex-1 scrollbar-thin">
              {textContent}
            </pre>
          </div>
        );
      } catch (err) {
        return (
          <div className="flex flex-col items-center justify-center p-8 bg-zinc-950 rounded-2xl border border-zinc-800 text-center min-h-[300px]">
            <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
            <p className="text-xs text-zinc-400 font-medium">Failed to decode base64 file buffer.</p>
          </div>
        );
      }
    }

    // Fallback binary card
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-950/60 rounded-2xl border border-zinc-800 text-center h-[420px]">
        <FileText className="w-16 h-16 text-blue-500/70 mb-4 stroke-[1.2]" />
        <h4 className="text-sm font-semibold text-white">No Inline Preview Available</h4>
        <p className="text-xs text-zinc-400 mt-2 max-w-xs leading-relaxed">
          Binary files (like Word documents, Excel spreadsheets, or ZIP packages) require external local software.
        </p>
        <div className="bg-black/30 border border-zinc-800/80 rounded-xl p-3 mt-4 text-[11px] text-zinc-400 font-mono w-full max-w-xs truncate text-center">
          {doc.fileName} ({doc.fileSize || 'N/A'})
        </div>
      </div>
    );
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Manuals':
        return <BookOpen className="w-5 h-5 text-blue-500" />;
      case 'SOP':
        return <ClipboardList className="w-5 h-5 text-emerald-500" />;
      case 'Wiring Diagram':
        return <Cpu className="w-5 h-5 text-amber-500" />;
      case 'Calibration Certificate':
        return <Award className="w-5 h-5 text-purple-500" />;
      default:
        return <File className="w-5 h-5 text-zinc-400" />;
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'Manuals':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'SOP':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'Wiring Diagram':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'Calibration Certificate':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
    }
  };

  return (
    <div className="flex-grow p-6 lg:p-8 space-y-8 bg-[#050505] min-h-screen text-zinc-300">
      
      {/* Header and Intro */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-800/60 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-white tracking-wide">National Document Registry</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
            Central repository for standard manuals, standard operating procedures (SOPs), station wiring topologies, and physical instrument certifications.
          </p>
        </div>
        
        {/* Simple Document Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:flex gap-4">
          <div className="bg-[#0c0c0f] border border-zinc-800/60 rounded-xl px-4 py-2 text-center min-w-[100px]">
            <span className="block text-xs text-zinc-500">Total Files</span>
            <span className="text-xl font-mono font-bold text-white mt-1 block">{documents.length}</span>
          </div>
          <div className="bg-[#0c0c0f] border border-zinc-800/60 rounded-xl px-4 py-2 text-center min-w-[100px]">
            <span className="block text-xs text-zinc-500">SOPs</span>
            <span className="text-xl font-mono font-bold text-emerald-400 mt-1 block">
              {documents.filter(d => d.category === 'SOP').length}
            </span>
          </div>
          <div className="bg-[#0c0c0f] border border-zinc-800/60 rounded-xl px-4 py-2 text-center min-w-[100px] col-span-2 sm:col-span-1">
            <span className="block text-xs text-zinc-500">Certificates</span>
            <span className="text-xl font-mono font-bold text-purple-400 mt-1 block">
              {documents.filter(d => d.category === 'Calibration Certificate').length}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-white">System Error</h3>
            <p className="text-xs text-red-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
          <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-white">Action Completed</h3>
            <p className="text-xs text-emerald-400 mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column: Upload New File */}
        <div className="xl:col-span-1">
          <div className="bg-[#0c0c0f] border border-zinc-800/60 rounded-2xl p-6 shadow-xl sticky top-6">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-500" />
              Upload Document
            </h2>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Document Title <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Vaisala Pressure Calibration Manual"
                  className="w-full px-3 py-2 bg-black rounded-lg border border-zinc-800 focus:outline-none focus:border-blue-500 text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Document Category <span className="text-red-500">*</span>
                </label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-black rounded-lg border border-zinc-800 focus:outline-none focus:border-blue-500 text-sm text-white"
                  required
                >
                  <option value="Manuals">Manuals</option>
                  <option value="SOP">SOP</option>
                  <option value="Wiring Diagram">Wiring Diagram</option>
                  <option value="Calibration Certificate">Calibration Certificate</option>
                  <option value="Other documents">Other documents</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Sensor Type
                  </label>
                  <select 
                    value={selectedSensorType}
                    onChange={(e) => {
                      setSelectedSensorType(e.target.value);
                      setSelectedSensorModel('');
                      setSelectedSerialNumber('');
                    }}
                    className="w-full px-3 py-2 bg-black rounded-lg border border-zinc-800 focus:outline-none focus:border-blue-500 text-xs text-white"
                  >
                    <option value="">-- Select Type --</option>
                    {uniqueSensorTypes.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Sensor Model
                  </label>
                  <select 
                    value={selectedSensorModel}
                    onChange={(e) => {
                      setSelectedSensorModel(e.target.value);
                      setSelectedSerialNumber('');
                    }}
                    className="w-full px-3 py-2 bg-black rounded-lg border border-zinc-800 focus:outline-none focus:border-blue-500 text-xs text-white"
                    disabled={!selectedSensorType}
                  >
                    <option value="">-- Select Model --</option>
                    {uniqueModelNumbers.map(model => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {category === 'Calibration Certificate' && (
                <div className="space-y-1.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Serial Number <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={selectedSerialNumber}
                    onChange={(e) => setSelectedSerialNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-black rounded-lg border border-zinc-800 focus:outline-none focus:border-blue-500 text-xs text-white"
                    disabled={!selectedSensorModel}
                    required
                  >
                    <option value="">-- Select Serial Number --</option>
                    {availableSerialNumbers.map(sn => (
                      <option key={sn} value={sn}>
                        {sn}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Select Document File <span className="text-red-500">*</span>
                </label>
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerFileSelect}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition duration-200 flex flex-col items-center justify-center min-h-[140px] ${
                    isDragging 
                      ? 'border-blue-500 bg-blue-500/5' 
                      : selectedFile 
                        ? 'border-emerald-500/40 bg-[#07070a]' 
                        : 'border-zinc-800 hover:border-zinc-700 hover:bg-white/[0.02]'
                  }`}
                >
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
                  />

                  {selectedFile ? (
                    <div className="space-y-2 w-full">
                      <div className="p-2 bg-emerald-500/10 rounded-lg inline-flex items-center justify-center">
                        <FileText className="w-8 h-8 text-emerald-400" />
                      </div>
                      <p className="text-xs font-semibold text-white truncate max-w-full px-4">{selectedFile.name}</p>
                      <p className="text-[10px] text-zinc-500">{formatBytes(selectedFile.size)} • {selectedFile.type || 'unknown type'}</p>
                      
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setFileContentBase64('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="px-2 py-1 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md transition"
                      >
                        Change File
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <UploadCloud className="w-10 h-10 text-zinc-500 mx-auto" />
                      <p className="text-xs font-medium text-zinc-300">
                        Drag and drop files here, or <span className="text-blue-400">browse</span>
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        Supports PDF, DOCX, XLSX, TXT, CSV, JPG (Max 5MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button 
                type="submit"
                disabled={submitting || !selectedFile || !title}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition duration-200 ${
                  submitting || !selectedFile || !title
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/15 border border-blue-500/20'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Submit Document
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: List & Filters */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Controls: Search and Filter Category Tabs */}
          <div className="bg-[#0c0c0f] border border-zinc-800/60 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by document title, file name, or uploader..."
                  className="w-full pl-9 pr-4 py-2 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:border-blue-500 text-sm text-white"
                />
              </div>
            </div>

            {/* Category selection bar */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {categories.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition duration-200 ${
                    selectedCategory === cat.name
                      ? 'bg-white text-black border-white'
                      : 'bg-black text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Documents Grid / List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-[#0c0c0f] border border-zinc-800/60 rounded-2xl">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              <p className="text-sm text-zinc-500 mt-4">Consulting database document directories...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-[#0c0c0f] border border-zinc-800/60 rounded-2xl text-center px-6">
              <FileText className="w-16 h-16 text-zinc-700 stroke-[1]" />
              <h3 className="text-lg font-medium text-white mt-4">No documents found</h3>
              <p className="text-sm text-zinc-500 mt-2 max-w-md">
                No files match your query in category "{selectedCategory === 'All' ? 'All Documents' : selectedCategory}". Try uploading one using the form on the left!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocuments.map(doc => {
                const station = stations.find(s => s.stationId === doc.stationId);
                const sensor = sensors.find(s => s.sensorId === doc.sensorId);
                
                return (
                  <div 
                    key={doc.id}
                    className="bg-[#0c0c0f] border border-zinc-800/60 hover:border-zinc-700/80 rounded-2xl p-5 flex flex-col justify-between hover:shadow-xl transition duration-200 group relative overflow-hidden"
                  >
                    {/* Top Section */}
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-black rounded-xl border border-zinc-800">
                            {getCategoryIcon(doc.category)}
                          </div>
                          <div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getCategoryBadgeClass(doc.category)}`}>
                              {doc.category}
                            </span>
                            <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">{doc.fileSize || 'N/A'}</span>
                          </div>
                        </div>
                        
                        {/* Delete action button */}
                        <button 
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-zinc-600 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition duration-200 border border-transparent hover:border-red-500/25"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h3 className="text-sm font-semibold text-white tracking-wide group-hover:text-blue-400 transition duration-150 line-clamp-1">
                        {doc.title}
                      </h3>
                      
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1 truncate">
                        <Paperclip className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                        {doc.fileName}
                      </p>

                      {/* Associated Station / Sensor / Model / Serial Badges */}
                      {(station || sensor || doc.sensorModel || doc.serialNumber) && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-zinc-800/50">
                          {station && (
                            <div className="flex items-center gap-1 text-[9px] bg-blue-500/5 border border-blue-500/20 text-blue-400 rounded px-1.5 py-0.5" title={`Station: ${station.stationName}`}>
                              <MapPin className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[120px]">{station.stationName}</span>
                            </div>
                          )}
                          {sensor && (
                            <div className="flex items-center gap-1 text-[9px] bg-purple-500/5 border border-purple-500/20 text-purple-400 rounded px-1.5 py-0.5" title={`Sensor: ${sensor.sensorType}`}>
                              <Cpu className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[120px]">{sensor.sensorType}</span>
                            </div>
                          )}
                          {doc.sensorModel && (
                            <div className="flex items-center gap-1 text-[9px] bg-amber-500/5 border border-amber-500/20 text-amber-400 rounded px-1.5 py-0.5" title={`Sensor Model: ${doc.sensorModel}`}>
                              <Cpu className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[120px]">Model: {doc.sensorModel}</span>
                            </div>
                          )}
                          {doc.serialNumber && (
                            <div className="flex items-center gap-1 text-[9px] bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5" title={`Serial Number: ${doc.serialNumber}`}>
                              <FileText className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[120px]">S/N: {doc.serialNumber}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Metadata & Primary Actions */}
                    <div className="mt-4 pt-3 border-t border-zinc-800/30 flex items-center justify-between">
                      <div className="text-[10px] text-zinc-500">
                        <span className="block truncate max-w-[140px]">Uploaded by {doc.uploadedBy?.split('@')[0]}</span>
                        <span className="block text-[9px] text-zinc-600 font-mono mt-0.5">
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setActiveDocViewer(doc)}
                          className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                        <button 
                          onClick={() => downloadDocumentFile(doc)}
                          className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Detail Viewer Modal */}
      {activeDocViewer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c0c0f] border border-zinc-800 rounded-3xl max-w-5xl w-full p-6 md:p-8 space-y-6 relative shadow-2xl overflow-y-auto max-h-[95vh] scrollbar-thin">
            <button 
              onClick={() => setActiveDocViewer(null)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-zinc-800/60 pb-4">
              <div className="p-3 bg-black rounded-2xl border border-zinc-800">
                {getCategoryIcon(activeDocViewer.category)}
              </div>
              <div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getCategoryBadgeClass(activeDocViewer.category)}`}>
                  {activeDocViewer.category}
                </span>
                <h2 className="text-xl font-bold text-white mt-1">{activeDocViewer.title}</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left Column: Adaptive Document Preview */}
              <div className="lg:col-span-3 flex flex-col justify-center">
                {renderDocumentPreview(activeDocViewer)}
              </div>

              {/* Right Column: Metadata & Associations */}
              <div className="lg:col-span-2 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="bg-black/40 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Document Metadata</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="block text-zinc-500">File Name</span>
                        <span className="text-zinc-300 font-mono select-all truncate block" title={activeDocViewer.fileName}>{activeDocViewer.fileName}</span>
                      </div>
                      <div>
                        <span className="block text-zinc-500">File Size</span>
                        <span className="text-zinc-300 font-mono mt-0.5 block">{activeDocViewer.fileSize || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-zinc-500">Uploaded By</span>
                        <span className="text-zinc-300 mt-0.5 block truncate" title={activeDocViewer.uploadedBy}>{activeDocViewer.uploadedBy?.split('@')[0]}</span>
                      </div>
                      <div>
                        <span className="block text-zinc-500">Upload Date</span>
                        <span className="text-zinc-300 mt-0.5 block">{new Date(activeDocViewer.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Document Associations Detail */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider px-1">Registrations & Links</h3>
                    <div className="bg-black/30 border border-zinc-800/40 rounded-xl p-3 text-xs">
                      <span className="text-zinc-500 font-semibold flex items-center gap-1.5 mb-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        Weather Station Link
                      </span>
                      {activeDocViewer.stationId ? (
                        <div>
                          {(() => {
                            const st = stations.find(s => s.stationId === activeDocViewer.stationId);
                            return st ? (
                              <>
                                <span className="text-white font-medium block">{st.stationName}</span>
                                <span className="text-zinc-500 text-[10px] block">{st.region} Region • ID: {st.stationId}</span>
                              </>
                            ) : (
                              <span className="text-zinc-400">Station ID: {activeDocViewer.stationId}</span>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-zinc-500 italic text-[11px]">No weather station linked to this asset</span>
                      )}
                    </div>

                    <div className="bg-black/30 border border-zinc-800/40 rounded-xl p-3 text-xs">
                      <span className="text-zinc-500 font-semibold flex items-center gap-1.5 mb-1.5">
                        <Cpu className="w-3.5 h-3.5 text-purple-400" />
                        Meteorological Sensor Link
                      </span>
                      {activeDocViewer.sensorModel ? (
                        <div>
                          <span className="text-white font-medium block">Model Number: {activeDocViewer.sensorModel}</span>
                          {activeDocViewer.serialNumber && (
                            <span className="text-zinc-500 text-[10px] block font-mono">Serial Number: {activeDocViewer.serialNumber}</span>
                          )}
                          <span className="text-zinc-600 text-[9px] block mt-1 leading-relaxed">
                            Linked to all active sensors sharing this model.
                          </span>
                        </div>
                      ) : activeDocViewer.sensorId ? (
                        <div>
                          {(() => {
                            const se = sensors.find(s => s.sensorId === activeDocViewer.sensorId);
                            return se ? (
                              <>
                                <span className="text-white font-medium block">{se.sensorType}</span>
                                <span className="text-zinc-500 text-[10px] block">Model: {se.modelNumber || 'N/A'} • S/N: {se.serialNumber || 'N/A'}</span>
                              </>
                            ) : (
                              <span className="text-zinc-400">Sensor ID: {activeDocViewer.sensorId}</span>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-zinc-500 italic text-[11px]">No active sensor linked to this asset</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Interactive File Content Pre-view helper */}
                <div className="border-t border-zinc-800 pt-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <Info className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    <span className="text-[11px] text-zinc-500">Secure sandboxed local data previewer.</span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setActiveDocViewer(null)}
                      className="flex-1 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold text-center transition cursor-pointer"
                    >
                      Close Preview
                    </button>
                    <button 
                      onClick={() => downloadDocumentFile(activeDocViewer)}
                      className="flex-1 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-blue-600/15 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Download Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
