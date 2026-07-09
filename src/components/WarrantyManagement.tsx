import React, { useState, useRef, useMemo } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  Search, 
  Filter, 
  Calendar, 
  FileText, 
  UploadCloud, 
  X, 
  Edit2, 
  Building, 
  ClipboardList, 
  Info, 
  Bell, 
  CheckCircle,
  PlusCircle,
  Download,
  Check
} from 'lucide-react';
import { Sensor, WeatherStation } from '../types.ts';

interface WarrantyManagementProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  isAuthenticated: boolean;
  onRefresh: () => Promise<void>;
  token: string | null;
}

export default function WarrantyManagement({
  sensors,
  stations,
  isAuthenticated,
  onRefresh,
  token
}: WarrantyManagementProps) {
  // State variables
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'expiring' | 'expired' | 'none'>('all');
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  
  // Warranty edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    supplierDetails: '',
    invoiceReference: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    procurementDate: ''
  });
  const [docFiles, setDocFiles] = useState<Array<{ name: string; url: string; size: string }>>([]);
  const [isDraggingDocs, setIsDraggingDocs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const docInputRef = useRef<HTMLInputElement | null>(null);

  // Helper: Calculate days remaining and status of a warranty
  const getWarrantyInfo = (endDateStr: string | null, startDateStr: string | null) => {
    if (!endDateStr) {
      return { status: 'none' as const, daysLeft: 0, label: 'No Record' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(endDateStr);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = endDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return { status: 'expired' as const, daysLeft, label: 'Expired' };
    } else if (daysLeft <= 30) {
      return { status: 'expiring' as const, daysLeft, label: `Expiring soon (${daysLeft}d)` };
    } else {
      return { status: 'valid' as const, daysLeft, label: 'Valid' };
    }
  };

  // Compute stats
  const stats = useMemo(() => {
    let total = 0;
    let valid = 0;
    let expiring = 0;
    let expired = 0;
    let none = 0;

    sensors.forEach(s => {
      if (!s.warrantyEndDate) {
        none++;
      } else {
        total++;
        const info = getWarrantyInfo(s.warrantyEndDate, s.warrantyStartDate);
        if (info.status === 'valid') valid++;
        else if (info.status === 'expiring') expiring++;
        else if (info.status === 'expired') expired++;
      }
    });

    return { total, valid, expiring, expired, none };
  }, [sensors]);

  // List of upcoming expirations for notifications
  const expiringWarranties = useMemo(() => {
    return sensors
      .filter(s => s.warrantyEndDate)
      .map(s => {
        const info = getWarrantyInfo(s.warrantyEndDate, s.warrantyStartDate);
        return { sensor: s, info };
      })
      .filter(item => item.info.status === 'expiring' || (item.info.status === 'expired' && item.info.daysLeft >= -30))
      .sort((a, b) => a.info.daysLeft - b.info.daysLeft);
  }, [sensors]);

  // Filtered list of sensors
  const filteredSensors = useMemo(() => {
    return sensors.filter(sensor => {
      const matchSearch = 
        (sensor.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sensor.manufacturer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sensor.sensorType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sensor.supplierDetails || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sensor.modelNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      const info = getWarrantyInfo(sensor.warrantyEndDate, sensor.warrantyStartDate);
      if (statusFilter === 'all') return true;
      return info.status === statusFilter;
    });
  }, [sensors, searchTerm, statusFilter]);

  // Open the editor for a specific sensor's warranty details
  const handleStartEdit = (sensor: Sensor) => {
    setSelectedSensor(sensor);
    setFormData({
      supplierDetails: sensor.supplierDetails || '',
      invoiceReference: sensor.invoiceReference || '',
      warrantyStartDate: sensor.warrantyStartDate || '',
      warrantyEndDate: sensor.warrantyEndDate || '',
      procurementDate: sensor.procurementDate || ''
    });

    if (sensor.documents) {
      try {
        setDocFiles(JSON.parse(sensor.documents));
      } catch {
        setDocFiles(sensor.documents.split(',').filter(Boolean).map(url => ({
          name: url.substring(url.lastIndexOf('/') + 1) || 'Document',
          url,
          size: 'N/A'
        })));
      }
    } else {
      setDocFiles([]);
    }

    setIsEditing(true);
    setFormError(null);
    setFormSuccess(null);
  };

  // Document attachments handlers
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
    if (e.dataTransfer.files) {
      processDocFiles(Array.from(e.dataTransfer.files));
    }
  };

  const processDocFiles = (files: File[]) => {
    files.forEach(file => {
      const sizeStr = (file.size / 1024).toFixed(0) + ' KB';
      setDocFiles(prev => [...prev, {
        name: file.name,
        url: '#', // Stand-in for storage upload URL in simulation
        size: sizeStr
      }]);
    });
  };

  const removeDoc = (index: number) => {
    setDocFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedSensor) return;

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const response = await fetch(`/api/sensors/${selectedSensor.sensorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sensorType: selectedSensor.sensorType,
          manufacturer: selectedSensor.manufacturer,
          status: selectedSensor.status,
          stationId: selectedSensor.stationId,
          sensorName: selectedSensor.sensorName,
          barcode: selectedSensor.barcode,
          modelNumber: selectedSensor.modelNumber,
          serialNumber: selectedSensor.serialNumber,
          calibrationInterval: selectedSensor.calibrationInterval,
          calibrationDetails: selectedSensor.calibrationDetails,
          deploymentInfo: selectedSensor.deploymentInfo,
          assignedOffice: selectedSensor.assignedOffice,
          responsiblePersonnel: selectedSensor.responsiblePersonnel,
          conditionStatus: selectedSensor.conditionStatus,
          remarks: selectedSensor.remarks,
          photos: selectedSensor.photos,
          
          // Updated Warranty and Supplier parameters
          procurementDate: formData.procurementDate || null,
          supplierDetails: formData.supplierDetails || null,
          invoiceReference: formData.invoiceReference || null,
          warrantyStartDate: formData.warrantyStartDate || null,
          warrantyEndDate: formData.warrantyEndDate || null,
          documents: JSON.stringify(docFiles)
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to update database records.");
      }

      await onRefresh();
      
      setFormSuccess(`Warranty records for sensor S/N: ${selectedSensor.serialNumber || selectedSensor.sensorId} updated successfully.`);
      
      // Update selectedSensor with newly modified details
      const updatedSensor = {
        ...selectedSensor,
        procurementDate: formData.procurementDate || null,
        supplierDetails: formData.supplierDetails || null,
        invoiceReference: formData.invoiceReference || null,
        warrantyStartDate: formData.warrantyStartDate || null,
        warrantyEndDate: formData.warrantyEndDate || null,
        documents: JSON.stringify(docFiles)
      };
      setSelectedSensor(updatedSensor);
      
      setTimeout(() => {
        setIsEditing(false);
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "An error occurred while saving records.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[#1f1f23] pb-5 gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <Shield className="h-6 w-6 text-blue-500" />
            <h1 className="text-xl font-bold text-white uppercase tracking-wider font-sans">
              Warranty & Supplier Management
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Track hardware warranty validity, upload compliance certificates, maintain supplier directories, and monitor expiry risks.
          </p>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-[#111113] border border-[#1f1f23] rounded-lg p-4">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Total Registered</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-sans">{stats.total}</span>
            <span className="text-[9px] font-mono text-zinc-500">Warranted units</span>
          </div>
        </div>

        <div className="bg-[#111113] border border-[#1f1f23] rounded-lg p-4">
          <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-500">Active / Valid</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400 font-sans">{stats.valid}</span>
            <span className="text-[9px] font-mono text-emerald-500/80">Secured</span>
          </div>
        </div>

        <div className="bg-[#111113] border border-amber-500/20 rounded-lg p-4 bg-amber-500/[0.01]">
          <p className="text-[10px] font-mono uppercase tracking-wider text-amber-500">Expiring Soon</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400 font-sans">{stats.expiring}</span>
            <span className="text-[9px] font-mono text-amber-500/80">Under 30 days</span>
          </div>
        </div>

        <div className="bg-[#111113] border border-red-500/20 rounded-lg p-4 bg-red-500/[0.01]">
          <p className="text-[10px] font-mono uppercase tracking-wider text-red-500">Expired Warranty</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-red-400 font-sans">{stats.expired}</span>
            <span className="text-[9px] font-mono text-red-500/80">Unprotected</span>
          </div>
        </div>

        <div className="bg-[#111113] border border-[#1f1f23] rounded-lg p-4 col-span-2 lg:col-span-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">No Record</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-zinc-400 font-sans">{stats.none}</span>
            <span className="text-[9px] font-mono text-zinc-500">Missing contract</span>
          </div>
        </div>
      </div>

      {/* Proactive Expiring Soon Alert Center */}
      {expiringWarranties.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Bell className="h-5 w-5 text-amber-500 shrink-0 mt-0.5 animate-bounce" />
            <div className="flex-1 space-y-1.5">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Warranty Expiration Risk Alerts
              </h4>
              <p className="text-[10px] text-zinc-400">
                The following hardware systems have warranties expiring soon or recently expired. Please coordinate with suppliers for service agreements.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                {expiringWarranties.slice(0, 4).map(({ sensor, info }) => (
                  <div 
                    key={sensor.sensorId} 
                    className="flex items-center justify-between p-2 bg-[#0d0d10] border border-[#1f1f23] rounded-md text-[10px] font-mono"
                  >
                    <div className="truncate pr-2">
                      <span className="text-zinc-200 font-semibold">{sensor.manufacturer} {sensor.sensorType}</span>
                      <span className="text-zinc-500 block">S/N: {sensor.serialNumber || 'Unassigned'} | ID: {sensor.sensorId}</span>
                    </div>
                    
                    <span className={`px-2 py-0.5 rounded-sm font-bold shrink-0 ${
                      info.status === 'expired' 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {info.daysLeft < 0 ? `Expired ${Math.abs(info.daysLeft)}d ago` : `Expires in ${info.daysLeft}d`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left/Middle: Sensor List and Filter */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-[#111113] border border-[#1f1f23] rounded-lg p-4 flex flex-col md:flex-row gap-3.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by serial, manufacturer, model, supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black border border-[#1f1f23] rounded-md py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-2 rounded-md text-xs font-semibold border transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                    : 'bg-black border-[#1f1f23] text-zinc-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('valid')}
                className={`px-3 py-2 rounded-md text-xs font-semibold border transition cursor-pointer flex items-center space-x-1 ${
                  statusFilter === 'valid'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                    : 'bg-black border-[#1f1f23] text-zinc-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="h-3 w-3 shrink-0" />
                <span>Valid</span>
              </button>
              <button
                onClick={() => setStatusFilter('expiring')}
                className={`px-3 py-2 rounded-md text-xs font-semibold border transition cursor-pointer flex items-center space-x-1 ${
                  statusFilter === 'expiring'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                    : 'bg-black border-[#1f1f23] text-zinc-400 hover:text-white'
                }`}
              >
                <ShieldAlert className="h-3 w-3 shrink-0" />
                <span>Expiring</span>
              </button>
              <button
                onClick={() => setStatusFilter('expired')}
                className={`px-3 py-2 rounded-md text-xs font-semibold border transition cursor-pointer flex items-center space-x-1 ${
                  statusFilter === 'expired'
                    ? 'bg-red-500/10 border-red-500 text-red-400'
                    : 'bg-black border-[#1f1f23] text-zinc-400 hover:text-white'
                }`}
              >
                <ShieldX className="h-3 w-3 shrink-0" />
                <span>Expired</span>
              </button>
              <button
                onClick={() => setStatusFilter('none')}
                className={`px-3 py-2 rounded-md text-xs font-semibold border transition cursor-pointer ${
                  statusFilter === 'none'
                    ? 'bg-zinc-700/20 border-zinc-500 text-zinc-300'
                    : 'bg-black border-[#1f1f23] text-zinc-400 hover:text-white'
                }`}
              >
                No Record
              </button>
            </div>
          </div>

          {/* Sensors warranty table */}
          <div className="bg-[#111113] border border-[#1f1f23] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[#1f1f23] flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Warranty Registry</h3>
              <span className="text-[10px] text-zinc-500 font-mono">Showing {filteredSensors.length} matching sensors</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1f1f23] bg-black/40 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    <th className="py-3 px-4">Sensor Asset</th>
                    <th className="py-3 px-4">Supplier & Reference</th>
                    <th className="py-3 px-4">Warranty Validity</th>
                    <th className="py-3 px-4">Documents</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f23]">
                  {filteredSensors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-zinc-500 italic">
                        No hardware modules found matching the filter query.
                      </td>
                    </tr>
                  ) : (
                    filteredSensors.map(sensor => {
                      const info = getWarrantyInfo(sensor.warrantyEndDate, sensor.warrantyStartDate);
                      
                      let docCount = 0;
                      try {
                        if (sensor.documents) {
                          docCount = JSON.parse(sensor.documents).length;
                        }
                      } catch {}

                      return (
                        <tr key={sensor.sensorId} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-zinc-200 text-xs">
                              {sensor.manufacturer} {sensor.sensorType}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                              S/N: <span className="text-zinc-300">{sensor.serialNumber || 'N/A'}</span> | ID: {sensor.sensorId}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-xs font-mono">
                            {sensor.supplierDetails ? (
                              <div className="text-zinc-300 truncate max-w-[180px]" title={sensor.supplierDetails}>
                                {sensor.supplierDetails}
                              </div>
                            ) : (
                              <div className="text-zinc-600 italic">No supplier info</div>
                            )}
                            {sensor.invoiceReference && (
                              <div className="text-[9px] text-zinc-500 mt-0.5">
                                Inv Ref: <span className="text-zinc-400">{sensor.invoiceReference}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs font-mono">
                            {sensor.warrantyEndDate ? (
                              <div className="space-y-1">
                                <div className="flex items-center space-x-1.5">
                                  {info.status === 'valid' && <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                  {info.status === 'expiring' && <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                  {info.status === 'expired' && <ShieldX className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                                  
                                  <span className={`font-bold ${
                                    info.status === 'valid' ? 'text-emerald-400' :
                                    info.status === 'expiring' ? 'text-amber-400' : 'text-red-400'
                                  }`}>
                                    {info.status === 'valid' ? 'Valid' :
                                     info.status === 'expiring' ? `Expiring Soon` : 'Expired'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-500">
                                  {sensor.warrantyStartDate ? new Date(sensor.warrantyStartDate).toLocaleDateString() : 'N/A'} to {new Date(sensor.warrantyEndDate).toLocaleDateString()}
                                </div>
                              </div>
                            ) : (
                              <div className="text-zinc-500 italic">No Registered Warranty</div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs font-mono">
                            {docCount > 0 ? (
                              <div className="flex items-center space-x-1.5 text-zinc-300 hover:text-white">
                                <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="font-semibold underline cursor-pointer" onClick={() => handleStartEdit(sensor)}>
                                  {docCount} File{docCount > 1 ? 's' : ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-600 italic text-[10px]">No Documents</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleStartEdit(sensor)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-[#17171c] hover:bg-zinc-800 text-zinc-300 hover:text-white border border-[#232329] rounded text-[10px] font-semibold transition cursor-pointer"
                            >
                              <Edit2 className="h-3 w-3 text-blue-400" />
                              <span>{isAuthenticated ? 'Manage' : 'View'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Selected Sensor & Warranty Editor panel */}
        <div className="xl:col-span-1">
          {selectedSensor ? (
            <div className="bg-[#111113] border border-[#1f1f23] rounded-lg p-5 space-y-5">
              
              {/* Selected Sensor Header */}
              <div className="flex items-start justify-between border-b border-[#1f1f23] pb-4">
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Currently Selected</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">
                    {selectedSensor.manufacturer} {selectedSensor.sensorType}
                  </h4>
                  <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    S/N: {selectedSensor.serialNumber || 'N/A'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedSensor(null);
                    setIsEditing(false);
                  }}
                  className="p-1 hover:bg-white/5 rounded-md text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!isEditing ? (
                /* READ ONLY PREVIEW */
                <div className="space-y-5 text-xs">
                  <div className="space-y-3.5">
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-mono tracking-wider">Procurement Details</span>
                      <div className="mt-1.5 space-y-1.5 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Supplier:</span>
                          <span className="text-white font-semibold">{selectedSensor.supplierDetails || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Invoice Reference:</span>
                          <span className="text-white font-semibold">{selectedSensor.invoiceReference || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Procurement Date:</span>
                          <span className="text-white font-semibold">{selectedSensor.procurementDate || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#1f1f23]">
                      <span className="text-zinc-500 block text-[10px] uppercase font-mono tracking-wider">Warranty Scope</span>
                      <div className="mt-1.5 space-y-1.5 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Start Date:</span>
                          <span className="text-white font-semibold">{selectedSensor.warrantyStartDate || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">End Date:</span>
                          <span className="text-white font-semibold">{selectedSensor.warrantyEndDate || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-zinc-400">Current Status:</span>
                          {selectedSensor.warrantyEndDate ? (
                            (() => {
                              const info = getWarrantyInfo(selectedSensor.warrantyEndDate, selectedSensor.warrantyStartDate);
                              return (
                                <span className={`px-2 py-0.5 rounded-sm font-bold text-[9px] uppercase ${
                                  info.status === 'valid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  info.status === 'expiring' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                  'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                  {info.label}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-zinc-500 italic">No warranty registered</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stored Documents */}
                    <div className="pt-3 border-t border-[#1f1f23] space-y-2">
                      <span className="text-zinc-500 block text-[10px] uppercase font-mono tracking-wider">Stored Warranty Documents</span>
                      
                      {selectedSensor.documents ? (
                        (() => {
                          try {
                            const docs = JSON.parse(selectedSensor.documents);
                            if (docs.length === 0) throw new Error();
                            return (
                              <div className="space-y-1.5">
                                {docs.map((doc: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between p-2.5 bg-[#070709] border border-[#1f1f23] rounded-md font-mono text-[10px]">
                                    <div className="flex items-center space-x-2 truncate">
                                      <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                                      <span className="text-zinc-300 truncate" title={doc.name}>{doc.name}</span>
                                    </div>
                                    <div className="flex items-center space-x-1 shrink-0">
                                      <span className="text-zinc-600 mr-1.5">{doc.size || 'N/A'}</span>
                                      <a 
                                        href={doc.url} 
                                        className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition"
                                        title="Download/Open warranty statement"
                                      >
                                        <Download className="h-3 w-3" />
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          } catch {
                            return <p className="text-zinc-500 italic text-[10px]">No warranty certificates or invoice PDFs cataloged.</p>;
                          }
                        })()
                      ) : (
                        <p className="text-zinc-500 italic text-[10px]">No warranty certificates or invoice PDFs cataloged.</p>
                      )}
                    </div>
                  </div>

                  {isAuthenticated ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="w-full mt-4 flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md text-xs transition cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Edit Supplier & Warranty Record</span>
                    </button>
                  ) : (
                    <p className="text-[10px] text-zinc-500 text-center italic mt-4">
                      🔒 Login with writing permissions to alter supplier contracts or attach document certificates.
                    </p>
                  )}
                </div>
              ) : (
                /* EDITING VIEW FORM */
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  <div className="space-y-3">
                    
                    {/* Supplier details */}
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                        Supplier / Vendor Details
                      </label>
                      <textarea
                        value={formData.supplierDetails}
                        onChange={(e) => setFormData({...formData, supplierDetails: e.target.value})}
                        placeholder="e.g. Vaisala Helsinki Division, Contact: info@vaisala.com"
                        rows={2}
                        className="w-full bg-black border border-[#1f1f23] rounded-md py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none font-mono"
                      />
                    </div>

                    {/* Invoice reference */}
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                        Invoice / Contract Reference
                      </label>
                      <input
                        type="text"
                        value={formData.invoiceReference}
                        onChange={(e) => setFormData({...formData, invoiceReference: e.target.value})}
                        placeholder="e.g. INV-2026-9082A"
                        className="w-full bg-black border border-[#1f1f23] rounded-md py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    {/* Procurement Date */}
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-zinc-500" />
                        <span>Procurement Date</span>
                      </label>
                      <input
                        type="date"
                        value={formData.procurementDate}
                        onChange={(e) => setFormData({...formData, procurementDate: e.target.value})}
                        className="w-full bg-black border border-[#1f1f23] rounded-md py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    {/* Warranty Date Range */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                          Warranty Start
                        </label>
                        <input
                          type="date"
                          value={formData.warrantyStartDate}
                          onChange={(e) => setFormData({...formData, warrantyStartDate: e.target.value})}
                          className="w-full bg-black border border-[#1f1f23] rounded-md py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                          Warranty End
                        </label>
                        <input
                          type="date"
                          value={formData.warrantyEndDate}
                          onChange={(e) => setFormData({...formData, warrantyEndDate: e.target.value})}
                          className="w-full bg-black border border-[#1f1f23] rounded-md py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    {/* Documents uploader */}
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
                        Store Warranty Documents & Statements
                      </label>
                      
                      <div 
                        onDragOver={handleDragOverDocs}
                        onDragLeave={handleDragLeaveDocs}
                        onDrop={handleDropDocs}
                        onClick={() => docInputRef.current?.click()}
                        className={`border border-dashed rounded-md p-4 text-center cursor-pointer transition ${
                          isDraggingDocs 
                            ? 'border-blue-500 bg-blue-500/5' 
                            : 'border-[#1f1f23] hover:border-zinc-700 bg-black/40'
                        }`}
                      >
                        <input 
                          type="file" 
                          ref={docInputRef}
                          onChange={(e) => e.target.files && processDocFiles(Array.from(e.target.files))}
                          className="hidden" 
                          multiple 
                        />
                        <UploadCloud className="h-6 w-6 text-zinc-600 mx-auto mb-1" />
                        <p className="text-[10px] text-zinc-300 font-medium">Click or Drag & Drop PDF files</p>
                      </div>

                      {/* Doc Previews */}
                      {docFiles.length > 0 && (
                        <div className="mt-2.5 space-y-1">
                          {docFiles.map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-black border border-[#1f1f23] rounded-sm text-[10px] font-mono">
                              <span className="text-zinc-300 truncate max-w-[140px]" title={doc.name}>{doc.name}</span>
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

                  {/* Feedback Alerts */}
                  {formError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-md text-[10px] font-mono text-red-400 leading-normal">
                      {formError}
                    </div>
                  )}

                  {formSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-md text-[10px] font-mono text-emerald-400 leading-normal flex items-start gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{formSuccess}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-2 px-3 bg-[#131316] hover:bg-[#1a1a20] border border-[#1f1f23] text-zinc-400 hover:text-white font-semibold rounded-md text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md text-xs transition cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* EMPTY VIEW */
            <div className="bg-[#111113] border border-dashed border-[#1f1f23] rounded-lg p-8 text-center text-zinc-500 space-y-3.5">
              <Building className="h-8 w-8 text-zinc-600 mx-auto" />
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-sans">
                  No Hardware Selected
                </h4>
                <p className="text-[10px] text-zinc-500 font-mono max-w-xs mx-auto mt-1">
                  Select any sensor module from the left register to verify full procurement details, warranty logs, or attach document templates.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
