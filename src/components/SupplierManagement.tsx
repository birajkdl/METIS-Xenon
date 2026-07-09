import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  Star, 
  Award, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  Clock, 
  ArrowLeft, 
  BarChart3, 
  PlusCircle, 
  PlusSquare,
  FileSpreadsheet,
  User as UserIcon,
  Briefcase
} from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
  code: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  status: string; // 'Active', 'Inactive', 'Under Review'
  supplierType: string; // 'Supplier', 'Manufacturer', 'Both'
  supplyCategories: string | null;
  performanceRating: number;
  qualityRating: number;
  deliveryPerformance: number;
  historyOfSupply: string | null; // JSON array of {date: string, item: string, value: string}
  createdAt: string;
}

interface PriceItem {
  partName: string;
  model: string;
  price: number;
  currency: string;
  minLeadTimeDays: number;
}

interface SupplierAgreement {
  id: number;
  supplierId: number;
  title: string;
  agreementType: string; // 'Price List', 'Quotation', 'Agreement'
  documentUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string; // 'Active', 'Expired', 'Draft', 'Suspended'
  priceItems: string | null; // JSON array of PriceItem
  remarks: string | null;
  createdAt: string;
}

interface SupplierEvaluation {
  id: number;
  supplierId: number;
  evaluationDate: string;
  evaluatorEmail: string;
  qualityScore: number;
  deliveryScore: number;
  responseScore: number;
  supportScore: number;
  overallScore: number;
  feedback: string | null;
  createdAt: string;
}

interface SupplierManagementProps {
  token: string | null;
  user: any;
  role: string | null;
  theme: 'light' | 'dark';
}

export default function SupplierManagement({ token, user, role, theme }: SupplierManagementProps) {
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection & Tab state
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [detailedSupplier, setDetailedSupplier] = useState<(Supplier & { agreements: SupplierAgreement[], evaluations: SupplierEvaluation[] }) | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<'history' | 'agreements' | 'scorecard'>('history');

  // Search & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Modals
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
  const [isAddAgreementOpen, setIsAddAgreementOpen] = useState(false);
  const [isAddEvaluationOpen, setIsAddEvaluationOpen] = useState(false);
  const [isAddHistoryOpen, setIsAddHistoryOpen] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<SupplierAgreement | null>(null);

  // Form states
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    code: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    status: 'Active',
    supplierType: 'Supplier',
    supplyCategories: ''
  });

  const [agreementForm, setAgreementForm] = useState({
    title: '',
    agreementType: 'Price List',
    documentUrl: '',
    startDate: '',
    endDate: '',
    status: 'Active',
    remarks: ''
  });
  const [agreementPriceItems, setAgreementPriceItems] = useState<PriceItem[]>([
    { partName: '', model: '', price: 0, currency: 'USD', minLeadTimeDays: 7 }
  ]);

  const [evaluationForm, setEvaluationForm] = useState({
    evaluationDate: new Date().toISOString().split('T')[0],
    qualityScore: 4,
    deliveryScore: 4,
    responseScore: 4,
    supportScore: 4,
    feedback: ''
  });

  const [historyForm, setHistoryForm] = useState({
    date: new Date().toISOString().split('T')[0],
    item: '',
    value: ''
  });

  // Load initial suppliers list
  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/suppliers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to retrieve suppliers registry.');
      const data = await response.json();
      setSuppliersList(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error fetching suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSuppliers();
    }
  }, [token]);

  // Load selected supplier details
  const fetchSupplierDetails = async (id: number) => {
    try {
      const response = await fetch(`/api/suppliers/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to load supplier profile details.');
      const data = await response.json();
      setDetailedSupplier(data);
      setSelectedSupplierId(id);
      
      // Default price item or reset selection
      if (data.agreements && data.agreements.length > 0) {
        setSelectedAgreement(data.agreements[0]);
      } else {
        setSelectedAgreement(null);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error loading supplier details');
    }
  };

  const handleSelectSupplier = (id: number) => {
    fetchSupplierDetails(id);
  };

  const handleBackToList = () => {
    setSelectedSupplierId(null);
    setDetailedSupplier(null);
    setSelectedAgreement(null);
    fetchSuppliers();
  };

  // --- Supplier CRUD Actions ---
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(supplierForm)
      });

      if (!response.ok) throw new Error('Could not register supplier.');
      
      setIsAddSupplierOpen(false);
      setSupplierForm({
        name: '',
        code: '',
        contactName: '',
        email: '',
        phone: '',
        address: '',
        website: '',
        status: 'Active',
        supplierType: 'Supplier',
        supplyCategories: ''
      });
      fetchSuppliers();
    } catch (err: any) {
      alert(err.message || 'Failed to create supplier');
    }
  };

  const handleOpenEditSupplier = () => {
    if (!detailedSupplier) return;
    setSupplierForm({
      name: detailedSupplier.name,
      code: detailedSupplier.code || '',
      contactName: detailedSupplier.contactName || '',
      email: detailedSupplier.email || '',
      phone: detailedSupplier.phone || '',
      address: detailedSupplier.address || '',
      website: detailedSupplier.website || '',
      status: detailedSupplier.status,
      supplierType: detailedSupplier.supplierType,
      supplyCategories: detailedSupplier.supplyCategories || ''
    });
    setIsEditSupplierOpen(true);
  };

  const handleEditSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedSupplier) return;

    try {
      const response = await fetch(`/api/suppliers/${detailedSupplier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(supplierForm)
      });

      if (!response.ok) throw new Error('Could not update supplier profile.');
      
      setIsEditSupplierOpen(false);
      fetchSupplierDetails(detailedSupplier.id);
    } catch (err: any) {
      alert(err.message || 'Failed to update supplier profile');
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    if (!window.confirm('Are you absolutely sure you want to permanently delete this supplier? This will also remove all associated price lists, quotations, agreements, and evaluations.')) {
      return;
    }

    try {
      const response = await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete supplier.');
      
      handleBackToList();
    } catch (err: any) {
      alert(err.message || 'Failed to delete supplier');
    }
  };

  // --- Agreements & Price Items Actions ---
  const handleAddPriceItemRow = () => {
    setAgreementPriceItems([...agreementPriceItems, { partName: '', model: '', price: 0, currency: 'USD', minLeadTimeDays: 7 }]);
  };

  const handleRemovePriceItemRow = (index: number) => {
    const list = [...agreementPriceItems];
    list.splice(index, 1);
    setAgreementPriceItems(list);
  };

  const handlePriceItemChange = (index: number, field: keyof PriceItem, value: any) => {
    const list = [...agreementPriceItems];
    list[index] = {
      ...list[index],
      [field]: field === 'price' || field === 'minLeadTimeDays' ? Number(value) : value
    };
    setAgreementPriceItems(list);
  };

  const handleCreateAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedSupplier || !agreementForm.title.trim()) return;

    // Filter out incomplete price items
    const validatedPriceItems = agreementPriceItems.filter(item => item.partName.trim() !== '');

    try {
      const response = await fetch(`/api/suppliers/${detailedSupplier.id}/agreements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...agreementForm,
          priceItems: validatedPriceItems.length > 0 ? validatedPriceItems : null
        })
      });

      if (!response.ok) throw new Error('Could not record agreement / price list.');

      setIsAddAgreementOpen(false);
      setAgreementForm({
        title: '',
        agreementType: 'Price List',
        documentUrl: '',
        startDate: '',
        endDate: '',
        status: 'Active',
        remarks: ''
      });
      setAgreementPriceItems([{ partName: '', model: '', price: 0, currency: 'USD', minLeadTimeDays: 7 }]);
      
      // Reload details
      fetchSupplierDetails(detailedSupplier.id);
    } catch (err: any) {
      alert(err.message || 'Failed to submit agreement');
    }
  };

  const handleDeleteAgreement = async (agreementId: number) => {
    if (!window.confirm('Delete this agreement/price list?')) return;

    try {
      const response = await fetch(`/api/suppliers/agreements/${agreementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Could not delete agreement.');
      if (detailedSupplier) fetchSupplierDetails(detailedSupplier.id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete agreement');
    }
  };

  // --- Performance Scorecard & Evaluations ---
  const handleCreateEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedSupplier) return;

    try {
      const response = await fetch(`/api/suppliers/${detailedSupplier.id}/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(evaluationForm)
      });

      if (!response.ok) throw new Error('Could not record evaluation scorecard.');

      setIsAddEvaluationOpen(false);
      setEvaluationForm({
        evaluationDate: new Date().toISOString().split('T')[0],
        qualityScore: 4,
        deliveryScore: 4,
        responseScore: 4,
        supportScore: 4,
        feedback: ''
      });

      fetchSupplierDetails(detailedSupplier.id);
    } catch (err: any) {
      alert(err.message || 'Failed to record scorecard');
    }
  };

  const handleDeleteEvaluation = async (evalId: number) => {
    if (!window.confirm('Remove this performance scorecard record?')) return;

    try {
      const response = await fetch(`/api/suppliers/evaluations/${evalId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Could not delete evaluation.');
      if (detailedSupplier) fetchSupplierDetails(detailedSupplier.id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete evaluation scorecard');
    }
  };

  // --- Supply History Items ---
  const handleAddHistorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedSupplier || !historyForm.item.trim()) return;

    try {
      // Parse current list
      let currentHistory: any[] = [];
      if (detailedSupplier.historyOfSupply) {
        try {
          currentHistory = JSON.parse(detailedSupplier.historyOfSupply);
        } catch (e) {
          currentHistory = [];
        }
      }

      const updatedHistory = [historyForm, ...currentHistory];

      // Update via PUT supplier endpoint
      const response = await fetch(`/api/suppliers/${detailedSupplier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          historyOfSupply: updatedHistory
        })
      });

      if (!response.ok) throw new Error('Could not update history of supply.');

      setIsAddHistoryOpen(false);
      setHistoryForm({
        date: new Date().toISOString().split('T')[0],
        item: '',
        value: ''
      });

      fetchSupplierDetails(detailedSupplier.id);
    } catch (err: any) {
      alert(err.message || 'Failed to record history item');
    }
  };

  const handleDeleteHistoryItem = async (index: number) => {
    if (!detailedSupplier || !window.confirm('Delete this supply history entry?')) return;

    try {
      let currentHistory: any[] = [];
      if (detailedSupplier.historyOfSupply) {
        try {
          currentHistory = JSON.parse(detailedSupplier.historyOfSupply);
        } catch (e) {
          currentHistory = [];
        }
      }

      const updatedHistory = [...currentHistory];
      updatedHistory.splice(index, 1);

      const response = await fetch(`/api/suppliers/${detailedSupplier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          historyOfSupply: updatedHistory
        })
      });

      if (!response.ok) throw new Error('Could not update history list.');

      fetchSupplierDetails(detailedSupplier.id);
    } catch (err: any) {
      alert(err.message || 'Failed to remove entry');
    }
  };

  // --- Filtering & Searching Logic ---
  const filteredSuppliers = suppliersList.filter(sup => {
    const matchesSearch = 
      sup.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sup.code && sup.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sup.supplyCategories && sup.supplyCategories.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'All' || sup.supplierType === filterType || (filterType === 'Both' && sup.supplierType === 'Both');
    const matchesStatus = filterStatus === 'All' || sup.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'Under Review':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'Inactive':
        return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
    }
  };

  const renderStars = (rating: number) => {
    const rounded = Math.round(rating * 10) / 10;
    return (
      <div className="flex items-center space-x-1" title={`${rounded} / 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star} 
            className={`h-3 w-3 ${star <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`} 
          />
        ))}
        <span className="text-[10px] text-zinc-400 font-mono font-semibold ml-1">{rounded > 0 ? rounded.toFixed(1) : 'N/A'}</span>
      </div>
    );
  };

  const parseJsonSafe = (jsonStr: string | null): any[] => {
    if (!jsonStr) return [];
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      return [];
    }
  };

  return (
    <div className={`p-8 min-h-screen ${theme === 'light' ? 'bg-[#f4f4f7] text-zinc-900' : 'bg-[#0a0a0c] text-zinc-100'}`}>
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-5 border-b border-white/[0.04]">
        <div>
          <div className="flex items-center space-x-2.5">
            <Briefcase className="h-6 w-6 text-sky-400" />
            <h1 className="font-serif italic text-2xl text-white tracking-wide">Suppliers & Manufacturers</h1>
          </div>
          <p className="text-xs text-zinc-400 font-sans mt-1">
            Centralized registry, performance scorecard metrics, and spare parts agreement tracker
          </p>
        </div>
        
        {!selectedSupplierId && (role === 'Super Administrator' || role === 'Head Office Admin/User') && (
          <button
            id="register-supplier-btn"
            onClick={() => setIsAddSupplierOpen(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-md cursor-pointer transition-all mt-4 md:mt-0"
          >
            <Plus className="h-4 w-4" />
            <span>Register Supplier / OEM</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/20 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* DETAILED VIEW */}
      {selectedSupplierId && detailedSupplier ? (
        <div className="space-y-6">
          
          {/* Back & Control Header */}
          <div className="flex flex-wrap justify-between items-center gap-4 bg-[#0d0d11]/80 backdrop-blur-xs p-4 rounded-xl border border-white/[0.04]">
            <button
              onClick={handleBackToList}
              className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Directory</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${getStatusBadgeClass(detailedSupplier.status)}`}>
                {detailedSupplier.status}
              </span>
              
              {(role === 'Super Administrator' || role === 'Head Office Admin/User') && (
                <>
                  <button
                    onClick={handleOpenEditSupplier}
                    className="flex items-center space-x-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded-md cursor-pointer transition-colors"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(detailedSupplier.id)}
                    className="flex items-center space-x-1 bg-red-950/20 hover:bg-red-900/30 text-red-400 text-xs px-3 py-1.5 rounded-md border border-red-900/20 cursor-pointer transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Core Profile Summary Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Brief profiling (Left column) */}
            <div className="bg-[#0d0d11] p-6 rounded-xl border border-white/[0.04] space-y-6">
              <div>
                <span className="text-[9px] font-mono font-bold text-sky-400 uppercase tracking-widest block mb-1">
                  {detailedSupplier.supplierType === 'Both' ? 'Manufacturer & Supplier' : detailedSupplier.supplierType}
                </span>
                <h2 className="text-xl font-serif text-white font-semibold leading-snug">{detailedSupplier.name}</h2>
                <span className="text-xs text-zinc-500 font-mono mt-0.5 block">Code: {detailedSupplier.code || 'N/A'}</span>
              </div>

              {/* Ratings Gauges */}
              <div className="space-y-4 pt-4 border-t border-white/[0.03]">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Metis Performance Index</h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400 flex items-center space-x-1">
                        <Award className="h-3. w-3 text-sky-400 mr-1" />
                        <span>Overall Scorecard</span>
                      </span>
                      <span className="font-mono text-white font-semibold">{detailedSupplier.performanceRating > 0 ? `${detailedSupplier.performanceRating.toFixed(2)}/5` : 'No reviews'}</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-sky-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(detailedSupplier.performanceRating / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">Sensor & Equipment Quality</span>
                      <span className="font-mono text-zinc-300">{detailedSupplier.qualityRating > 0 ? `${detailedSupplier.qualityRating.toFixed(1)}/5` : 'N/A'}</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(detailedSupplier.qualityRating / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">Delivery Lead Time Adherence</span>
                      <span className="font-mono text-zinc-300">{detailedSupplier.deliveryPerformance > 0 ? `${detailedSupplier.deliveryPerformance.toFixed(1)}/5` : 'N/A'}</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(detailedSupplier.deliveryPerformance / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3 pt-4 border-t border-white/[0.03]">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Contact & Office</h3>
                
                <div className="space-y-2.5 text-xs">
                  {detailedSupplier.contactName && (
                    <div className="flex items-start space-x-2">
                      <UserIcon className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-zinc-400 text-[10px] leading-none mb-0.5">Contact Representative</p>
                        <p className="text-white font-medium">{detailedSupplier.contactName}</p>
                      </div>
                    </div>
                  )}

                  {detailedSupplier.email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <a href={`mailto:${detailedSupplier.email}`} className="text-sky-400 hover:underline truncate">{detailedSupplier.email}</a>
                    </div>
                  )}

                  {detailedSupplier.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <span className="text-zinc-300 font-mono">{detailedSupplier.phone}</span>
                    </div>
                  )}

                  {detailedSupplier.website && (
                    <div className="flex items-center space-x-2">
                      <Globe className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <a href={detailedSupplier.website} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline truncate">{detailedSupplier.website}</a>
                    </div>
                  )}

                  {detailedSupplier.address && (
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                      <span className="text-zinc-300 leading-normal">{detailedSupplier.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Supply Categories details */}
              {detailedSupplier.supplyCategories && (
                <div className="pt-4 border-t border-white/[0.03] space-y-1.5">
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Supply Portfolio</h3>
                  <div className="flex flex-wrap gap-1">
                    {detailedSupplier.supplyCategories.split(',').map((cat, idx) => (
                      <span key={idx} className="text-[9px] bg-sky-500/10 text-sky-300 px-2 py-0.5 rounded-sm font-medium">
                        {cat.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Comprehensive Info Tabbed Pane (Right 2 columns) */}
            <div className="lg:col-span-2 bg-[#0d0d11] rounded-xl border border-white/[0.04] overflow-hidden flex flex-col">
              
              {/* Tab Selector */}
              <div className="flex border-b border-white/[0.03] bg-[#09090b]">
                <button
                  onClick={() => setActiveProfileTab('history')}
                  className={`flex-1 py-4 text-center font-semibold text-xs tracking-wider uppercase border-b-2 cursor-pointer transition-all ${
                    activeProfileTab === 'history' 
                      ? 'border-sky-500 text-sky-400 bg-white/[0.01]' 
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.005]'
                  }`}
                >
                  History of Supply
                </button>
                <button
                  onClick={() => setActiveProfileTab('agreements')}
                  className={`flex-1 py-4 text-center font-semibold text-xs tracking-wider uppercase border-b-2 cursor-pointer transition-all ${
                    activeProfileTab === 'agreements' 
                      ? 'border-sky-500 text-sky-400 bg-white/[0.01]' 
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.005]'
                  }`}
                >
                  Price Lists & Agreements
                </button>
                <button
                  onClick={() => setActiveProfileTab('scorecard')}
                  className={`flex-1 py-4 text-center font-semibold text-xs tracking-wider uppercase border-b-2 cursor-pointer transition-all ${
                    activeProfileTab === 'scorecard' 
                      ? 'border-sky-500 text-sky-400 bg-white/[0.01]' 
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.005]'
                  }`}
                >
                  Scorecard & Reviews
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-6 flex-1">
                
                {/* TAB 1: HISTORY OF SUPPLY */}
                {activeProfileTab === 'history' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-serif italic text-white font-medium">Recorded Historical Supply Actions</h3>
                      {(role === 'Super Administrator' || role === 'Head Office Admin/User') && (
                        <button
                          onClick={() => setIsAddHistoryOpen(true)}
                          className="flex items-center space-x-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] px-2.5 py-1.5 rounded-md cursor-pointer transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Record Supply Transaction</span>
                        </button>
                      )}
                    </div>

                    {parseJsonSafe(detailedSupplier.historyOfSupply).length === 0 ? (
                      <div className="text-center py-12 bg-white/[0.01] border border-dashed border-white/[0.03] rounded-lg">
                        <FileText className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">No supply transaction history recorded yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/[0.03] text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                              <th className="pb-3 font-semibold">Date</th>
                              <th className="pb-3 font-semibold">Items & Equipment Supplied</th>
                              <th className="pb-3 font-semibold">Total Invoice Value</th>
                              {(role === 'Super Administrator' || role === 'Head Office Admin/User') && (
                                <th className="pb-3 font-semibold text-right">Action</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="text-xs divide-y divide-white/[0.02]">
                            {parseJsonSafe(detailedSupplier.historyOfSupply).map((item: any, idx: number) => (
                              <tr key={idx} className="hover:bg-white/[0.005]">
                                <td className="py-3 font-mono text-zinc-400">{item.date}</td>
                                <td className="py-3 text-white font-medium">{item.item}</td>
                                <td className="py-3 font-mono text-emerald-400 font-semibold">{item.value}</td>
                                {(role === 'Super Administrator' || role === 'Head Office Admin/User') && (
                                  <td className="py-3 text-right">
                                    <button
                                      onClick={() => handleDeleteHistoryItem(idx)}
                                      className="text-red-400 hover:text-red-300 p-1 rounded-sm hover:bg-red-500/10 cursor-pointer"
                                      title="Delete transaction entry"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: PRICE LISTS & AGREEMENTS */}
                {activeProfileTab === 'agreements' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                    
                    {/* List of documents (Left column) */}
                    <div className="md:col-span-1 border-r border-white/[0.03] pr-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Agreements</h4>
                        {(role === 'Super Administrator' || role === 'Head Office Admin/User') && (
                          <button
                            onClick={() => setIsAddAgreementOpen(true)}
                            className="text-sky-400 hover:text-sky-300 p-1 flex items-center space-x-1 cursor-pointer"
                          >
                            <PlusSquare className="h-4.5 w-4.5" />
                          </button>
                        )}
                      </div>

                      {detailedSupplier.agreements.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No agreements filed.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[380px] overflow-y-auto">
                          {detailedSupplier.agreements.map((ag) => (
                            <button
                              key={ag.id}
                              onClick={() => setSelectedAgreement(ag)}
                              className={`w-full text-left p-3 rounded-lg text-xs border transition-all cursor-pointer ${
                                selectedAgreement?.id === ag.id 
                                  ? 'bg-[#121217] border-sky-500/30 text-white' 
                                  : 'bg-[#09090b] border-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-[#121217]/50'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{ag.agreementType}</span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-sm ${
                                  ag.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400'
                                }`}>{ag.status}</span>
                              </div>
                              <p className="font-semibold truncate">{ag.title}</p>
                              {ag.endDate && (
                                <p className="text-[9px] text-zinc-500 mt-1 flex items-center">
                                  <Calendar className="h-2.5 w-2.5 mr-1" />
                                  <span>Expires: {ag.endDate}</span>
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Detailed selected price list items (Right columns) */}
                    <div className="md:col-span-2 space-y-4">
                      {selectedAgreement ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 bg-sky-500/10 text-sky-400 rounded-sm font-semibold uppercase">{selectedAgreement.agreementType}</span>
                                <span className="text-xs text-zinc-400 font-mono">ID: {selectedAgreement.id}</span>
                              </div>
                              <h4 className="text-sm font-semibold text-white mt-1">{selectedAgreement.title}</h4>
                              {selectedAgreement.startDate && (
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                  Validity: {selectedAgreement.startDate} to {selectedAgreement.endDate || 'Unlimited'}
                                </p>
                              )}
                            </div>
                            
                            {(role === 'Super Administrator' || role === 'Head Office Admin/User') && (
                              <button
                                onClick={() => handleDeleteAgreement(selectedAgreement.id)}
                                className="text-red-400 hover:text-red-300 p-1.5 rounded-md hover:bg-red-500/10 cursor-pointer"
                                title="Delete this agreement"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          {selectedAgreement.remarks && (
                            <p className="text-xs text-zinc-400 bg-white/[0.01] p-3 rounded-lg border border-white/[0.03]">
                              <span className="font-semibold text-zinc-300 block text-[10px] uppercase tracking-wider mb-0.5">Remarks / Scope</span>
                              {selectedAgreement.remarks}
                            </p>
                          )}

                          <div>
                            <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center">
                              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-sky-400" />
                              <span>Cataloged Price Items & Spare Parts</span>
                            </h5>

                            {parseJsonSafe(selectedAgreement.priceItems).length === 0 ? (
                              <p className="text-xs text-zinc-500 italic p-3 bg-white/[0.005] rounded-lg border border-white/[0.02]">
                                No price catalog lines are recorded for this agreement.
                              </p>
                            ) : (
                              <div className="overflow-x-auto border border-white/[0.03] rounded-lg">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-[#09090b] text-[9px] text-zinc-500 font-mono uppercase tracking-wider border-b border-white/[0.03]">
                                      <th className="p-2.5 font-semibold">Spare Part / Sensor</th>
                                      <th className="p-2.5 font-semibold">Model No</th>
                                      <th className="p-2.5 font-semibold">Unit Cost</th>
                                      <th className="p-2.5 font-semibold">Min Lead Time</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/[0.02]">
                                    {parseJsonSafe(selectedAgreement.priceItems).map((item: PriceItem, idx: number) => (
                                      <tr key={idx} className="hover:bg-white/[0.005]">
                                        <td className="p-2.5 text-zinc-200 font-medium">{item.partName}</td>
                                        <td className="p-2.5 font-mono text-zinc-400">{item.model || '-'}</td>
                                        <td className="p-2.5 font-mono text-emerald-400 font-semibold">
                                          {item.currency || 'USD'} {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-2.5 font-mono text-zinc-400 flex items-center">
                                          <Clock className="h-3 w-3 mr-1 text-zinc-500" />
                                          <span>{item.minLeadTimeDays} days</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-20 bg-white/[0.01] border border-dashed border-white/[0.03] rounded-lg">
                          <FileText className="h-10 w-10 text-zinc-700 mx-auto mb-2" />
                          <p className="text-xs text-zinc-500">No agreement selected. File or select a document to inspect pricing catalog.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: PERFORMANCE SCORECARD & EVALUATIONS */}
                {activeProfileTab === 'scorecard' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-serif italic text-white font-medium">OEM Performance Analytics</h3>
                        <p className="text-[10px] text-zinc-500">Evaluations recorded through Department of Meteorology audits</p>
                      </div>
                      
                      {(role === 'Super Administrator' || role === 'Head Office Admin/User') && (
                        <button
                          onClick={() => setIsAddEvaluationOpen(true)}
                          className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold px-3 py-1.5 rounded-md cursor-pointer transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Audit/Evaluate OEM</span>
                        </button>
                      )}
                    </div>

                    {/* Horizontal analytics breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white/[0.01] p-4 rounded-xl border border-white/[0.03]">
                      <div className="text-center p-2">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Equipment Quality</p>
                        <div className="flex items-center justify-center space-x-1">
                          <Star className="h-4.5 w-4.5 text-emerald-400 fill-emerald-400" />
                          <span className="text-lg font-mono font-bold text-white">{detailedSupplier.qualityRating > 0 ? detailedSupplier.qualityRating.toFixed(2) : '0.0'}</span>
                        </div>
                      </div>
                      <div className="text-center p-2">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Lead Time Adherence</p>
                        <div className="flex items-center justify-center space-x-1">
                          <Clock className="h-4.5 w-4.5 text-amber-400" />
                          <span className="text-lg font-mono font-bold text-white">{detailedSupplier.deliveryPerformance > 0 ? detailedSupplier.deliveryPerformance.toFixed(2) : '0.0'}</span>
                        </div>
                      </div>
                      <div className="text-center p-2">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Response Rating</p>
                        <div className="flex items-center justify-center space-x-1">
                          <CheckCircle2 className="h-4.5 w-4.5 text-sky-400" />
                          <span className="text-lg font-mono font-bold text-white">
                            {detailedSupplier.evaluations.length > 0 
                              ? (detailedSupplier.evaluations.reduce((sum, e) => sum + e.responseScore, 0) / detailedSupplier.evaluations.length).toFixed(1)
                              : '0.0'}
                          </span>
                        </div>
                      </div>
                      <div className="text-center p-2">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Assisted Technical Support</p>
                        <div className="flex items-center justify-center space-x-1">
                          <Award className="h-4.5 w-4.5 text-indigo-400" />
                          <span className="text-lg font-mono font-bold text-white">
                            {detailedSupplier.evaluations.length > 0 
                              ? (detailedSupplier.evaluations.reduce((sum, e) => sum + e.supportScore, 0) / detailedSupplier.evaluations.length).toFixed(1)
                              : '0.0'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Historical Scorecard Evaluations */}
                    <div className="space-y-4 pt-2">
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Evaluation Audit Trail</h4>
                      
                      {detailedSupplier.evaluations.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic text-center py-6">No official scorecards cataloged for this supplier yet.</p>
                      ) : (
                        <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
                          {detailedSupplier.evaluations.map((ev) => (
                            <div key={ev.id} className="bg-[#09090b] p-4 rounded-lg border border-white/[0.03] space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-white font-semibold font-mono">Overall Score: {ev.overallScore.toFixed(2)}/5</span>
                                    <span className="text-zinc-600 font-mono text-[9px] shrink-0">|</span>
                                    <span className="text-[10px] text-zinc-400 flex items-center">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      {ev.evaluationDate}
                                    </span>
                                  </div>
                                  <p className="text-[9px] text-zinc-500 mt-0.5">Assessed by: {ev.evaluatorEmail}</p>
                                </div>
                                
                                {(role === 'Super Administrator' || role === 'Head Office Admin/User') && (
                                  <button
                                    onClick={() => handleDeleteEvaluation(ev.id)}
                                    className="text-red-400 hover:text-red-300 p-1 rounded-md hover:bg-red-500/10 cursor-pointer"
                                    title="Delete scorecard"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px] font-mono bg-white/[0.005] p-2 rounded-sm">
                                <div><span className="text-zinc-500">Quality:</span> <span className="text-white font-bold">{ev.qualityScore}/5</span></div>
                                <div><span className="text-zinc-500">Delivery:</span> <span className="text-white font-bold">{ev.deliveryScore}/5</span></div>
                                <div><span className="text-zinc-500">Response:</span> <span className="text-white font-bold">{ev.responseScore}/5</span></div>
                                <div><span className="text-zinc-500">Support:</span> <span className="text-white font-bold">{ev.supportScore}/5</span></div>
                              </div>

                              {ev.feedback && (
                                <p className="text-xs text-zinc-300 leading-relaxed italic border-l-2 border-sky-500/50 pl-3">
                                  "{ev.feedback}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      ) : (
        
        /* GENERAL DIRECTORY VIEW */
        <div className="space-y-6">
          
          {/* Filters & Search Dashboard */}
          <div className="bg-[#0d0d11] p-5 rounded-xl border border-white/[0.04] grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                id="supplier-search-input"
                type="text"
                placeholder="Search suppliers, codes, categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#070709] border border-white/[0.04] rounded-lg pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-sky-500 transition-colors"
              />
            </div>

            {/* Type Filter */}
            <div>
              <select
                id="supplier-type-filter"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-[#070709] border border-white/[0.04] rounded-lg px-3 py-2.5 text-xs text-zinc-400 focus:outline-hidden focus:border-sky-500 transition-colors"
              >
                <option value="All">All Partner Types</option>
                <option value="Supplier">Only Suppliers</option>
                <option value="Manufacturer">Only Manufacturers (OEM)</option>
                <option value="Both">Both (OEMS & Dist.)</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                id="supplier-status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-[#070709] border border-white/[0.04] rounded-lg px-3 py-2.5 text-xs text-zinc-400 focus:outline-hidden focus:border-sky-500 transition-colors"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Under Review">Under Review</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

          </div>

          {/* Directory Listings */}
          {loading ? (
            <div className="flex flex-col justify-center items-center py-20 space-y-3">
              <div className="w-8 h-8 border-3 border-sky-500/20 border-t-sky-400 rounded-full animate-spin"></div>
              <p className="text-xs text-zinc-500 font-mono">Loading registry nodes...</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-20 bg-[#0d0d11] rounded-xl border border-dashed border-white/[0.03]">
              <Building2 className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-zinc-400">No Partners Found</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                No meteorological suppliers matched your search query or filters. Clear some criteria or add a new entry.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSuppliers.map((sup) => (
                <div 
                  key={sup.id}
                  className="bg-[#0d0d11] hover:bg-[#121217]/60 rounded-xl border border-white/[0.04] hover:border-sky-500/30 p-5 flex flex-col justify-between transition-all duration-200"
                >
                  <div className="space-y-4">
                    
                    {/* Header line */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[8px] font-mono font-bold text-sky-400 uppercase tracking-widest block mb-1">
                          {sup.supplierType === 'Both' ? 'OEM & Supplier' : sup.supplierType}
                        </span>
                        <h3 className="text-sm font-semibold text-white tracking-normal font-serif hover:text-sky-400 transition-colors line-clamp-1 cursor-pointer" onClick={() => handleSelectSupplier(sup.id)}>
                          {sup.name}
                        </h3>
                        {sup.code && <span className="text-[9px] font-mono text-zinc-500 mt-0.5 block">Code: {sup.code}</span>}
                      </div>
                      
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${getStatusBadgeClass(sup.status)}`}>
                        {sup.status}
                      </span>
                    </div>

                    {/* Ratings */}
                    <div className="space-y-1 bg-[#09090b] p-2.5 rounded-lg border border-white/[0.01]">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-zinc-500">Quality Index</span>
                        <span>{renderStars(sup.qualityRating)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-zinc-500">Lead Time Index</span>
                        <span>{renderStars(sup.deliveryPerformance)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-white/[0.03] mt-1.5">
                        <span className="text-zinc-400 font-bold">Overall Rating</span>
                        <span className="font-mono text-white font-bold">{sup.performanceRating > 0 ? sup.performanceRating.toFixed(2) : 'N/A'}</span>
                      </div>
                    </div>

                    {/* Supply Categories */}
                    {sup.supplyCategories && (
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        <span className="font-semibold text-zinc-500 text-[10px] uppercase tracking-wider block mb-0.5">Supply Categories</span>
                        {sup.supplyCategories}
                      </p>
                    )}
                  </div>

                  {/* Actions & Representative info */}
                  <div className="pt-4 mt-4 border-t border-white/[0.03] flex justify-between items-center text-[10px] text-zinc-400">
                    <span className="truncate max-w-[130px]" title={sup.contactName || 'N/A'}>
                      Rep: <span className="text-zinc-300 font-semibold">{sup.contactName || 'None listed'}</span>
                    </span>
                    <button
                      id={`inspect-supplier-${sup.id}-btn`}
                      onClick={() => handleSelectSupplier(sup.id)}
                      className="text-sky-400 hover:text-sky-300 font-semibold uppercase tracking-wider flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Inspect Profile</span>
                      <ArrowLeft className="h-3 w-3 rotate-180" />
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* --- MODAL: REGISTER SUPPLIER --- */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#0f0f13] border border-[#23232a] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/[0.04] flex justify-between items-center">
              <h3 className="font-serif italic text-lg text-white">Register Partner Profile</h3>
              <button onClick={() => setIsAddSupplierOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer text-sm">✕</button>
            </div>
            
            <form onSubmit={handleCreateSupplier} className="p-6 space-y-4 max-h-[450px] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Company / OEM Name *</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="e.g. Vaisala Oyj"
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Supplier Code</label>
                  <input
                    type="text"
                    value={supplierForm.code}
                    onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                    placeholder="e.g. SUP-VAI-01"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Partner Type</label>
                  <select
                    value={supplierForm.supplierType}
                    onChange={(e) => setSupplierForm({ ...supplierForm, supplierType: e.target.value })}
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-zinc-400 focus:outline-hidden"
                  >
                    <option value="Supplier">Only Supplier (Distributor)</option>
                    <option value="Manufacturer">Only Manufacturer (OEM)</option>
                    <option value="Both">Both (OEM & Direct Supplier)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Representative Name</label>
                  <input
                    type="text"
                    value={supplierForm.contactName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                    placeholder="John Doe"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Representative Phone</label>
                  <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="+358 9 89491"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Representative Email</label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="sales@company.com"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Website URL</label>
                  <input
                    type="url"
                    value={supplierForm.website}
                    onChange={(e) => setSupplierForm({ ...supplierForm, website: e.target.value })}
                    placeholder="https://company.com"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Supply Categories (comma-separated)</label>
                <input
                  type="text"
                  value={supplierForm.supplyCategories}
                  onChange={(e) => setSupplierForm({ ...supplierForm, supplyCategories: e.target.value })}
                  placeholder="Thermometers, Barometers, Spare Parts, Solar sensors"
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Corporate Address</label>
                <textarea
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="Vanha Nurmijärventie 21, 01670 Vantaa, Finland"
                  rows={2}
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden resize-none"
                />
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierOpen(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
                >
                  Register Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: EDIT SUPPLIER PROFILE --- */}
      {isEditSupplierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#0f0f13] border border-[#23232a] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/[0.04] flex justify-between items-center">
              <h3 className="font-serif italic text-lg text-white">Edit Partner Profile</h3>
              <button onClick={() => setIsEditSupplierOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer text-sm">✕</button>
            </div>
            
            <form onSubmit={handleEditSupplierSubmit} className="p-6 space-y-4 max-h-[450px] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Company / OEM Name *</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="e.g. Vaisala Oyj"
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Supplier Code</label>
                  <input
                    type="text"
                    value={supplierForm.code}
                    onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                    placeholder="e.g. SUP-VAI-01"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Partner Type</label>
                  <select
                    value={supplierForm.supplierType}
                    onChange={(e) => setSupplierForm({ ...supplierForm, supplierType: e.target.value })}
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-zinc-400 focus:outline-hidden"
                  >
                    <option value="Supplier">Only Supplier (Distributor)</option>
                    <option value="Manufacturer">Only Manufacturer (OEM)</option>
                    <option value="Both">Both (OEM & Direct Supplier)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Rep Name</label>
                  <input
                    type="text"
                    value={supplierForm.contactName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                    placeholder="John Doe"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Rep Phone</label>
                  <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="+358 9 89491"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Rep Email</label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="sales@company.com"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Website URL</label>
                  <input
                    type="url"
                    value={supplierForm.website}
                    onChange={(e) => setSupplierForm({ ...supplierForm, website: e.target.value })}
                    placeholder="https://company.com"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Supply Categories</label>
                  <input
                    type="text"
                    value={supplierForm.supplyCategories}
                    onChange={(e) => setSupplierForm({ ...supplierForm, supplyCategories: e.target.value })}
                    placeholder="Categories"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Status</label>
                  <select
                    value={supplierForm.status}
                    onChange={(e) => setSupplierForm({ ...supplierForm, status: e.target.value })}
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-zinc-400 focus:outline-hidden"
                  >
                    <option value="Active">Active</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Corporate Address</label>
                <textarea
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="Address"
                  rows={2}
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden resize-none"
                />
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditSupplierOpen(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: RECORD SUPPLY TRANSACTION --- */}
      {isAddHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#0f0f13] border border-[#23232a] rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/[0.04] flex justify-between items-center">
              <h3 className="font-serif italic text-lg text-white">Record Supply Transaction</h3>
              <button onClick={() => setIsAddHistoryOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer text-sm">✕</button>
            </div>
            
            <form onSubmit={handleAddHistorySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Supply Date *</label>
                <input
                  type="date"
                  required
                  value={historyForm.date}
                  onChange={(e) => setHistoryForm({ ...historyForm, date: e.target.value })}
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Description of Equipment Supplied *</label>
                <input
                  type="text"
                  required
                  value={historyForm.item}
                  onChange={(e) => setHistoryForm({ ...historyForm, item: e.target.value })}
                  placeholder="e.g. Acoustic Current Profiler (Qty 2) & Calibration Cables"
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Total Transaction Value *</label>
                <input
                  type="text"
                  required
                  value={historyForm.value}
                  onChange={(e) => setHistoryForm({ ...historyForm, value: e.target.value })}
                  placeholder="e.g. $14,200 USD"
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddHistoryOpen(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg cursor-pointer"
                >
                  Append Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD AGREEMENT & PRICE ITEMS --- */}
      {isAddAgreementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#0f0f13] border border-[#23232a] rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/[0.04] flex justify-between items-center">
              <h3 className="font-serif italic text-lg text-white">New Agreement / Price List</h3>
              <button onClick={() => setIsAddAgreementOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer text-sm">✕</button>
            </div>
            
            <form onSubmit={handleCreateAgreement} className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={agreementForm.title}
                  onChange={(e) => setAgreementForm({ ...agreementForm, title: e.target.value })}
                  placeholder="e.g. Annual Spare Parts Agreement 2026-2027"
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Document Type</label>
                  <select
                    value={agreementForm.agreementType}
                    onChange={(e) => setAgreementForm({ ...agreementForm, agreementType: e.target.value })}
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-zinc-400 focus:outline-hidden"
                  >
                    <option value="Price List">Price List</option>
                    <option value="Quotation">Quotation</option>
                    <option value="Agreement">Agreement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={agreementForm.startDate}
                    onChange={(e) => setAgreementForm({ ...agreementForm, startDate: e.target.value })}
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    value={agreementForm.endDate}
                    onChange={(e) => setAgreementForm({ ...agreementForm, endDate: e.target.value })}
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Document Link / PDF Ref</label>
                  <input
                    type="text"
                    value={agreementForm.documentUrl}
                    onChange={(e) => setAgreementForm({ ...agreementForm, documentUrl: e.target.value })}
                    placeholder="agreements/spec_9481.pdf"
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Status</label>
                  <select
                    value={agreementForm.status}
                    onChange={(e) => setAgreementForm({ ...agreementForm, status: e.target.value })}
                    className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-zinc-400 focus:outline-hidden"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Expired">Expired</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">General Agreement Remarks</label>
                <textarea
                  value={agreementForm.remarks}
                  onChange={(e) => setAgreementForm({ ...agreementForm, remarks: e.target.value })}
                  placeholder="Describe scope, context, or authorized signatures..."
                  rows={2}
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden resize-none"
                />
              </div>

              {/* Dynamic Price Items Catalog rows */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Part Catalog & Pricing Grid</label>
                  <button
                    type="button"
                    onClick={handleAddPriceItemRow}
                    className="flex items-center space-x-1 text-sky-400 hover:text-sky-300 text-[10px] font-semibold cursor-pointer"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Add Item Line</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                  {agreementPriceItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-[#09090b] p-2 rounded-lg border border-white/[0.03]">
                      <div className="col-span-4">
                        <input
                          type="text"
                          required={idx === 0}
                          placeholder="Spare Part / Sensor Name"
                          value={item.partName}
                          onChange={(e) => handlePriceItemChange(idx, 'partName', e.target.value)}
                          className="w-full bg-[#070709] border border-white/[0.04] rounded-sm p-1.5 text-[11px] text-white focus:outline-hidden"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Model Number"
                          value={item.model}
                          onChange={(e) => handlePriceItemChange(idx, 'model', e.target.value)}
                          className="w-full bg-[#070709] border border-white/[0.04] rounded-sm p-1.5 text-[11px] text-white focus:outline-hidden"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Cost"
                          value={item.price || ''}
                          onChange={(e) => handlePriceItemChange(idx, 'price', e.target.value)}
                          className="w-full bg-[#070709] border border-white/[0.04] rounded-sm p-1.5 text-[11px] text-white focus:outline-hidden"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Lead days"
                          title="Minimum delivery lead time in days"
                          value={item.minLeadTimeDays || ''}
                          onChange={(e) => handlePriceItemChange(idx, 'minLeadTimeDays', e.target.value)}
                          className="w-full bg-[#070709] border border-white/[0.04] rounded-sm p-1.5 text-[11px] text-white focus:outline-hidden"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        {agreementPriceItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePriceItemRow(idx)}
                            className="text-red-400 hover:text-red-300 p-1 rounded-sm cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddAgreementOpen(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
                >
                  File Agreement Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: SUBMIT PERFORMANCE EVALUATION SCORECARD --- */}
      {isAddEvaluationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#0f0f13] border border-[#23232a] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/[0.04] flex justify-between items-center">
              <h3 className="font-serif italic text-lg text-white">Evaluate OEM / Supplier</h3>
              <button onClick={() => setIsAddEvaluationOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer text-sm">✕</button>
            </div>
            
            <form onSubmit={handleCreateEvaluation} className="p-6 space-y-4 max-h-[460px] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Evaluation Date *</label>
                <input
                  type="date"
                  required
                  value={evaluationForm.evaluationDate}
                  onChange={(e) => setEvaluationForm({ ...evaluationForm, evaluationDate: e.target.value })}
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>

              {/* Slider ratings group */}
              <div className="space-y-4 pt-2">
                
                {/* Scorecard Quality */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300 font-medium">1. Sensor & Parts Build Quality *</span>
                    <span className="font-mono text-sky-400 font-bold">{evaluationForm.qualityScore} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={evaluationForm.qualityScore}
                    onChange={(e) => setEvaluationForm({ ...evaluationForm, qualityScore: Number(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>

                {/* Scorecard Delivery */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300 font-medium">2. Delivery Lead Time Adherence *</span>
                    <span className="font-mono text-sky-400 font-bold">{evaluationForm.deliveryScore} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={evaluationForm.deliveryScore}
                    onChange={(e) => setEvaluationForm({ ...evaluationForm, deliveryScore: Number(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>

                {/* Scorecard Response */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300 font-medium">3. Sales & Communication Responsiveness *</span>
                    <span className="font-mono text-sky-400 font-bold">{evaluationForm.responseScore} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={evaluationForm.responseScore}
                    onChange={(e) => setEvaluationForm({ ...evaluationForm, responseScore: Number(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>

                {/* Scorecard Technical Support */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300 font-medium">4. After-sales Technical Support *</span>
                    <span className="font-mono text-sky-400 font-bold">{evaluationForm.supportScore} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={evaluationForm.supportScore}
                    onChange={(e) => setEvaluationForm({ ...evaluationForm, supportScore: Number(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>

              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Detailed Audit Feedback / Comments</label>
                <textarea
                  value={evaluationForm.feedback}
                  onChange={(e) => setEvaluationForm({ ...evaluationForm, feedback: e.target.value })}
                  placeholder="Include any specific remarks about calibration compliance, packaging quality, custom delays, or tech support speed..."
                  rows={3}
                  className="w-full bg-[#070709] border border-white/[0.04] rounded-lg p-2.5 text-xs text-white focus:outline-hidden resize-none"
                />
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddEvaluationOpen(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
                >
                  Log Scorecard Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
