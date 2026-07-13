import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Calendar, 
  Wrench, 
  RefreshCw, 
  Layers, 
  Sliders, 
  ShoppingBag, 
  ArrowRight, 
  HelpCircle, 
  CheckCircle, 
  ChevronRight,
  Calculator,
  PieChart,
  Truck,
  Activity,
  FileText
} from 'lucide-react';
import { Sensor, WeatherStation, Calibration } from '../types.ts';

// Recharts components
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';

interface CapitalBudgetingProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  isAuthenticated: boolean;
  onRefresh: () => void;
  token: string | null;
}

// Helper defaults for sensor types to provide standard procurement, lifecycle and failures
const SENSOR_TYPE_DEFAULTS: Record<string, {
  cost: number;
  lifespan: number; // in years
  calibrationFrequency: number; // months between calibrations
  failureRate: number; // annual failure percentage
}> = {
  'Thermometer': { cost: 350, lifespan: 4, calibrationFrequency: 12, failureRate: 10 },
  'Air Temperature': { cost: 380, lifespan: 4, calibrationFrequency: 12, failureRate: 10 },
  'Hygrometer': { cost: 450, lifespan: 4, calibrationFrequency: 12, failureRate: 10 },
  'Relative Humidity': { cost: 450, lifespan: 4, calibrationFrequency: 12, failureRate: 10 },
  'Barometer': { cost: 850, lifespan: 7, calibrationFrequency: 24, failureRate: 5 },
  'Pressure': { cost: 850, lifespan: 7, calibrationFrequency: 24, failureRate: 5 },
  'Anemometer': { cost: 950, lifespan: 10, calibrationFrequency: 12, failureRate: 12 },
  'Sonic Anemometer': { cost: 2400, lifespan: 10, calibrationFrequency: 12, failureRate: 12 },
  'Wind Speed': { cost: 900, lifespan: 10, calibrationFrequency: 12, failureRate: 12 },
  'Wind Direction': { cost: 900, lifespan: 10, calibrationFrequency: 12, failureRate: 12 },
  'Rain Gauge': { cost: 650, lifespan: 5, calibrationFrequency: 6, failureRate: 15 },
  'Tipping Bucket': { cost: 650, lifespan: 5, calibrationFrequency: 6, failureRate: 15 },
  'Pyranometer': { cost: 1800, lifespan: 8, calibrationFrequency: 12, failureRate: 8 },
  'Solar Radiation': { cost: 1800, lifespan: 8, calibrationFrequency: 12, failureRate: 8 },
  'Other': { cost: 500, lifespan: 5, calibrationFrequency: 12, failureRate: 10 }
};

interface CustomTCOTransaction {
  id: string;
  category: 'parts' | 'travel' | 'calibration' | 'other';
  title: string;
  amount: number;
  date: string;
  notes?: string;
}

export default function CapitalBudgeting({
  sensors,
  stations,
  isAuthenticated,
  onRefresh,
  token
}: CapitalBudgetingProps) {
  const [activeTab, setActiveTab] = useState<'tco' | 'forecast' | 'spare-parts'>('tco');

  // --- 1. TCO Calculator State ---
  const [selectedSensorId, setSelectedSensorId] = useState<number | ''>('');
  const [labHourlyRate, setLabHourlyRate] = useState<number>(75);
  const [hoursPerCalibration, setHoursPerCalibration] = useState<number>(4);
  const [customMileageRate, setCustomMileageRate] = useState<number>(0.65);
  const [customTravelDayRate, setCustomTravelDayRate] = useState<number>(150);

  // Custom added TCO transactions in localStorage
  const [customTransactions, setCustomTransactions] = useState<Record<number, CustomTCOTransaction[]>>(() => {
    const saved = localStorage.getItem('metis_sensor_custom_tco_transactions');
    return saved ? JSON.parse(saved) : {};
  });

  // Modal to add a custom transaction
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [newTxTitle, setNewTxTitle] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxCategory, setNewTxCategory] = useState<'parts' | 'travel' | 'calibration' | 'other'>('parts');
  const [newTxDate, setNewTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTxNotes, setNewTxNotes] = useState('');

  // Auto-save custom transactions
  useEffect(() => {
    localStorage.setItem('metis_sensor_custom_tco_transactions', JSON.stringify(customTransactions));
  }, [customTransactions]);

  // Selected sensor details for TCO
  const selectedSensor = useMemo(() => {
    if (!selectedSensorId) return null;
    return sensors.find(s => s.sensorId === Number(selectedSensorId)) || null;
  }, [selectedSensorId, sensors]);

  // Set default sensor if none selected
  useEffect(() => {
    if (sensors.length > 0 && !selectedSensorId) {
      setSelectedSensorId(sensors[0].sensorId);
    }
  }, [sensors, selectedSensorId]);

  // Derived TCO Data for selected sensor
  const tcoBreakdown = useMemo(() => {
    if (!selectedSensor) return { procurement: 0, calibration: 0, parts: 0, travel: 0, other: 0, total: 0, details: [] };

    const typeDefaults = SENSOR_TYPE_DEFAULTS[selectedSensor.sensorType] || SENSOR_TYPE_DEFAULTS['Other'];
    
    // 1. Procurement Cost
    // Try to parse invoice value, or standard cost
    let procurementCost = typeDefaults.cost;
    if (selectedSensor.invoiceReference) {
      // Simulate/deduce a procurement cost based on invoice ref
      const hash = Math.abs(selectedSensor.invoiceReference.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
      procurementCost = typeDefaults.cost + (hash % 100);
    }

    // 2. Calibration cost
    // Count calibration operations (simulate 1 if none found, or use the actual last calibration)
    let calibrationSessions = selectedSensor.lastCalibration ? 1 : 0;
    // Let's add more simulated calibrations if procurement date was long ago
    if (selectedSensor.procurementDate) {
      const yearsInService = Math.max(1, new Date().getFullYear() - new Date(selectedSensor.procurementDate).getFullYear());
      calibrationSessions = Math.max(calibrationSessions, Math.ceil(yearsInService * (12 / typeDefaults.calibrationFrequency)));
    }
    const standardCalibHours = calibrationSessions * hoursPerCalibration;
    let calibrationCost = standardCalibHours * labHourlyRate;

    // 3. Travel cost
    // Calculate travel based on station region
    let travelMiles = 40; // Default central depot travel
    if (selectedSensor.stationId) {
      const station = stations.find(st => st.stationId === selectedSensor.stationId);
      if (station) {
        const region = station.region.toLowerCase();
        if (region.includes('east') || region.includes('koshibag')) travelMiles = 150;
        else if (region.includes('west') || region.includes('karnali')) travelMiles = 220;
        else if (region.includes('himalaya') || region.includes('high')) travelMiles = 340;
        else if (region.includes('central') || region.includes('bagmati')) travelMiles = 60;
      }
    }
    const travelTrips = Math.max(1, Math.ceil(calibrationSessions / 2)); // 1 trip for every 2 calibrations
    let travelCost = travelTrips * (travelMiles * 2 * customMileageRate + customTravelDayRate);

    // 4. Replacement parts
    let partsCost = 0;
    if (selectedSensor.conditionStatus === 'Damaged' || selectedSensor.status === 'Maintenance') {
      partsCost += typeDefaults.cost * 0.35; // 35% of cost for repairs
    }

    // 5. Custom logged transactions
    let otherCost = 0;
    const customList = customTransactions[selectedSensor.sensorId] || [];
    customList.forEach(tx => {
      if (tx.category === 'parts') partsCost += tx.amount;
      else if (tx.category === 'travel') travelCost += tx.amount;
      else if (tx.category === 'calibration') calibrationCost += tx.amount;
      else otherCost += tx.amount;
    });

    const total = procurementCost + calibrationCost + partsCost + travelCost + otherCost;

    return {
      procurement: Math.round(procurementCost),
      calibration: Math.round(calibrationCost),
      parts: Math.round(partsCost),
      travel: Math.round(travelCost),
      other: Math.round(otherCost),
      total: Math.round(total),
      trips: travelTrips,
      miles: travelMiles,
      calibrationsCount: calibrationSessions
    };
  }, [selectedSensor, labHourlyRate, hoursPerCalibration, customMileageRate, customTravelDayRate, customTransactions, stations]);

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSensorId || !newTxTitle || !newTxAmount) return;

    const newTx: CustomTCOTransaction = {
      id: Math.random().toString(36).substring(2, 9),
      category: newTxCategory,
      title: newTxTitle,
      amount: parseFloat(newTxAmount),
      date: newTxDate,
      notes: newTxNotes
    };

    setCustomTransactions(prev => ({
      ...prev,
      [Number(selectedSensorId)]: [...(prev[Number(selectedSensorId)] || []), newTx]
    }));

    // Reset Form
    setNewTxTitle('');
    setNewTxAmount('');
    setNewTxNotes('');
    setIsAddTxModalOpen(false);
  };

  const handleDeleteTransaction = (sensorId: number, txId: string) => {
    setCustomTransactions(prev => {
      const existing = prev[sensorId] || [];
      return {
        ...prev,
        [sensorId]: existing.filter(tx => tx.id !== txId)
      };
    });
  };

  // --- 2. 5-Year Capital Budget Forecasting ---
  const currentFiscalYear = 2026;

  const forecastData = useMemo(() => {
    // We project replacement budgets for the next 5 fiscal years
    const projectionYears = [2026, 2027, 2028, 2029, 2030, 2031];
    
    // Initialize years
    const yearlyMap = projectionYears.reduce((acc, yr) => {
      acc[yr] = {
        year: `FY ${yr}/${yr + 1 - 2000}`,
        calendarYear: yr,
        eolCount: 0,
        eolCost: 0,
        sensors: [] as Array<{ id: number; type: string; serial: string; cost: number; age: number; station: string }>
      };
      return acc;
    }, {} as Record<number, { year: string; calendarYear: number; eolCount: number; eolCost: number; sensors: any[] }>);

    // Active calibrations count projection for upcoming FY 2027
    const calibrationProjectionsByType: Record<string, { count: number; estimatedCost: number }> = {};

    sensors.forEach(sensor => {
      const defaults = SENSOR_TYPE_DEFAULTS[sensor.sensorType] || SENSOR_TYPE_DEFAULTS['Other'];
      
      // Calculate EOL Year based on procurement date and standard operational lifespan
      let procurementYear = currentFiscalYear - 2; // Default fallback to 2 years ago
      if (sensor.procurementDate) {
        const match = sensor.procurementDate.match(/^(\d{4})/);
        if (match) procurementYear = parseInt(match[1]);
      } else if (sensor.createdAt) {
        procurementYear = new Date(sensor.createdAt).getFullYear();
      }

      const eolYear = procurementYear + defaults.lifespan;
      const age = new Date().getFullYear() - procurementYear;

      // Map to projection year if inside our 5-year bracket
      if (yearlyMap[eolYear]) {
        let replacementCost = defaults.cost;
        yearlyMap[eolYear].eolCount++;
        yearlyMap[eolYear].eolCost += replacementCost;
        
        let stationNameStr = 'Spare Store';
        if (sensor.stationId) {
          const st = stations.find(s => s.stationId === sensor.stationId);
          stationNameStr = st ? st.stationName : `Station #${sensor.stationId}`;
        }

        yearlyMap[eolYear].sensors.push({
          id: sensor.sensorId,
          type: sensor.sensorType,
          serial: sensor.serialNumber || 'N/A',
          cost: replacementCost,
          age,
          station: stationNameStr
        });
      }

      // Calculate upcoming FY calibrations projection (only for active, deployed, or functional sensors)
      if (sensor.status !== 'Retired' && sensor.status !== 'Damaged') {
        const frequencyMonths = defaults.calibrationFrequency;
        const calibrationsPerYear = 12 / frequencyMonths; // e.g. 6m freq = 2 calibrations/year
        
        if (!calibrationProjectionsByType[sensor.sensorType]) {
          calibrationProjectionsByType[sensor.sensorType] = { count: 0, estimatedCost: 0 };
        }
        
        calibrationProjectionsByType[sensor.sensorType].count += calibrationsPerYear;
        calibrationProjectionsByType[sensor.sensorType].estimatedCost += calibrationsPerYear * (hoursPerCalibration * labHourlyRate);
      }
    });

    const timelineData = Object.values(yearlyMap).sort((a, b) => a.calendarYear - b.calendarYear);
    
    const labProjections = Object.entries(calibrationProjectionsByType).map(([type, stats]) => ({
      type,
      volume: Math.round(stats.count),
      cost: Math.round(stats.estimatedCost)
    })).sort((a, b) => b.volume - a.volume);

    const totalLabVolume = labProjections.reduce((sum, item) => sum + item.volume, 0);
    const totalLabCost = labProjections.reduce((sum, item) => sum + item.cost, 0);

    return {
      timeline: timelineData,
      labProjections,
      totalLabVolume,
      totalLabCost
    };
  }, [sensors, stations, labHourlyRate, hoursPerCalibration]);


  // --- 3. Predictive Spare Parts Inventory & Min/Max Thresholds ---
  const [customFailureRates, setCustomFailureRates] = useState<Record<string, number>>({});
  const [selectedSpareToReorder, setSelectedSpareToReorder] = useState<string | null>(null);
  const [reorderQuantity, setReorderQuantity] = useState<number>(5);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);

  const sparePartsData = useMemo(() => {
    // Categories we want to analyze
    const categories = ['Air Temperature', 'Relative Humidity', 'Barometer', 'Sonic Anemometer', 'Anemometer', 'Rain Gauge', 'Pyranometer', 'Wind Speed', 'Wind Direction'];
    
    return categories.map(cat => {
      const defaults = SENSOR_TYPE_DEFAULTS[cat] || SENSOR_TYPE_DEFAULTS['Other'];
      const failureRate = customFailureRates[cat] !== undefined ? customFailureRates[cat] : defaults.failureRate;

      // Calculate active deployed count
      const deployed = sensors.filter(s => s.sensorType === cat && s.stationId !== null && s.status === 'Active').length;
      
      // Calculate current spare count (ready in warehouse, functional status)
      const spares = sensors.filter(s => s.sensorType === cat && s.stationId === null && s.status !== 'Retired' && s.status !== 'Damaged').length;

      // Recommended safety minimum threshold: 10% of active deployments or adjusted failure rate equivalent, minimum 1
      const safetyMin = Math.max(1, Math.ceil(deployed * (failureRate / 100)));
      // Max threshold: twice the safety minimum to avoid over-purchasing capital
      const safetyMax = Math.max(4, safetyMin * 2);

      let status: 'optimal' | 'low' | 'critical' = 'optimal';
      if (spares === 0 && safetyMin > 0) status = 'critical';
      else if (spares < safetyMin) status = 'low';

      return {
        category: cat,
        deployed,
        spares,
        failureRate,
        safetyMin,
        safetyMax,
        status,
        unitCost: defaults.cost
      };
    });
  }, [sensors, customFailureRates]);

  // Overall Spare stock healthy KPI percentage
  const spareStockHealthKpi = useMemo(() => {
    if (sparePartsData.length === 0) return 100;
    const optimalCount = sparePartsData.filter(p => p.status === 'optimal').length;
    return Math.round((optimalCount / sparePartsData.length) * 100);
  }, [sparePartsData]);

  const handleFailureRateChange = (cat: string, value: number) => {
    setCustomFailureRates(prev => ({
      ...prev,
      [cat]: value
    }));
  };

  const triggerPORequest = (category: string, defaultReorder: number) => {
    setSelectedSpareToReorder(category);
    setReorderQuantity(defaultReorder || 5);
    setIsPOModalOpen(true);
  };

  const handlePOSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create a toast or alert mimicking submission
    alert(`DRAFT PURCHASE ORDER GENERATED:\n\nInstrument Class: ${selectedSpareToReorder}\nPurchase Order Qty: ${reorderQuantity} Units\nEstimated Investment: $${(SENSOR_TYPE_DEFAULTS[selectedSpareToReorder || '']?.cost || 500) * reorderQuantity}\n\nThis order has been queued under "Purchase Orders" inside the Reports center. Store logistics has been notified.`);
    
    setIsPOModalOpen(false);
  };

  // Recharts custom colors
  const TCO_COLORS = ['#3b82f6', '#818cf8', '#fb7185', '#f59e0b', '#71717a'];

  return (
    <div className="space-y-8 animate-fade-in text-gray-900 dark:text-gray-100">
      
      {/* Module Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="h-5 w-5 text-blue-500" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-blue-500">Asset Economics</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif italic text-black dark:text-white">Capital Budgeting & Resource Allocation</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Analyze Total Cost of Ownership (TCO), forecast 5-year procurement budgets, project calibration lab capacities, and manage safety spare margins.
          </p>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1.5 rounded-lg shrink-0">
          <button
            onClick={() => setActiveTab('tco')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'tco'
                ? 'bg-white dark:bg-zinc-800 text-blue-500 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
            }`}
          >
            TCO Calculator
          </button>
          <button
            onClick={() => setActiveTab('forecast')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'forecast'
                ? 'bg-white dark:bg-zinc-800 text-blue-500 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
            }`}
          >
            5-Yr Budget Forecasts
          </button>
          <button
            onClick={() => setActiveTab('spare-parts')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'spare-parts'
                ? 'bg-white dark:bg-zinc-800 text-blue-500 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Predictive Spare Parts
          </button>
        </div>
      </div>

      {/* --- TAB 1: TOTAL COST OF OWNERSHIP (TCO) --- */}
      {activeTab === 'tco' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left panel: Sensor Selection & Cost Factors */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-zinc-950/40 p-6 border border-zinc-200 dark:border-zinc-800/60 rounded-xl space-y-5">
              <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-900 pb-3">
                <Sliders className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-black dark:text-white">Cost Driver Inputs</h3>
              </div>

              {/* Sensor selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Target Physical Instrument</label>
                <select
                  value={selectedSensorId}
                  onChange={(e) => setSelectedSensorId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-xs text-black dark:text-white p-2.5 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:outline-none transition"
                >
                  <option value="">-- Select a sensor from inventory --</option>
                  {sensors.map(s => (
                    <option key={s.sensorId} value={s.sensorId}>
                      {s.sensorType} - {s.manufacturer} ({s.serialNumber || `ID: ${s.sensorId}`})
                    </option>
                  ))}
                </select>
              </div>

              {/* Lab rate factor */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-900/50">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Lab Hourly Rate ($)</label>
                  <span className="text-xs font-mono font-bold text-blue-500">${labHourlyRate}/hr</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="150"
                  value={labHourlyRate}
                  onChange={(e) => setLabHourlyRate(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Calibration hours */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Calibration Duration</label>
                  <span className="text-xs font-mono font-bold text-blue-500">{hoursPerCalibration} hrs/run</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={hoursPerCalibration}
                  onChange={(e) => setHoursPerCalibration(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Mileage rate */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-900/50">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Mileage Rate ($/mi)</label>
                  <span className="text-xs font-mono font-bold text-blue-500">${customMileageRate}/mi</span>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="1.50"
                  step="0.05"
                  value={customMileageRate}
                  onChange={(e) => setCustomMileageRate(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Daily allowance */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Tech Travel Allowance</label>
                  <span className="text-xs font-mono font-bold text-blue-500">${customTravelDayRate}/day</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="10"
                  value={customTravelDayRate}
                  onChange={(e) => setCustomTravelDayRate(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-lg text-[11px] text-zinc-500 dark:text-zinc-400 flex gap-2">
                <HelpCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  Changing these multipliers recalculates costs dynamically across travel logs and laboratory services tied to this instrument.
                </p>
              </div>
            </div>
          </div>

          {/* Right panel: Calculator results & breakdown */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedSensor ? (
              <div className="bg-zinc-50 dark:bg-zinc-900/10 border-2 border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-xl p-12 text-center text-zinc-400">
                <Calculator className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                <p className="text-xs">Select a sensor from the controller on the left to start TCO analysis</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Total Cost Display Header Card */}
                <div className="bg-white dark:bg-zinc-950/40 p-6 border border-zinc-200 dark:border-zinc-800/60 rounded-xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded uppercase">
                        {selectedSensor.sensorType} ({selectedSensor.manufacturer})
                      </span>
                      <h2 className="text-xl font-bold font-serif text-black dark:text-white mt-1.5">
                        {selectedSensor.sensorName || `${selectedSensor.sensorType} Asset`}
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                        S/N: {selectedSensor.serialNumber || 'N/A'} | ID: {selectedSensor.sensorId} | Status: <span className="font-semibold text-blue-500">{selectedSensor.status}</span>
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Total Cost of Ownership</p>
                      <p className="text-3xl font-extrabold text-blue-500 tracking-tight mt-0.5">${tcoBreakdown.total.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Visual breakdown progress bars */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-900/60">
                    
                    {/* Progress bars list */}
                    <div className="space-y-3.5">
                      <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase block mb-1">Expense Breakdown Ledger</span>
                      
                      {/* Procurement */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-600 dark:text-zinc-400 font-medium">Original Procurement</span>
                          <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">${tcoBreakdown.procurement.toLocaleString()} ({Math.round((tcoBreakdown.procurement / tcoBreakdown.total) * 100)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(tcoBreakdown.procurement / tcoBreakdown.total) * 100}%` }} />
                        </div>
                      </div>

                      {/* Calibration */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-600 dark:text-zinc-400 font-medium">Lab Calibration (Sessions: {tcoBreakdown.calibrationsCount})</span>
                          <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">${tcoBreakdown.calibration.toLocaleString()} ({Math.round((tcoBreakdown.calibration / tcoBreakdown.total) * 100)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(tcoBreakdown.calibration / tcoBreakdown.total) * 100}%` }} />
                        </div>
                      </div>

                      {/* Parts */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-600 dark:text-zinc-400 font-medium">Replacement Parts</span>
                          <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">${tcoBreakdown.parts.toLocaleString()} ({Math.round((tcoBreakdown.parts / tcoBreakdown.total) * 100)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-400 rounded-full" style={{ width: `${(tcoBreakdown.parts / tcoBreakdown.total) * 100}%` }} />
                        </div>
                      </div>

                      {/* Travel */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-600 dark:text-zinc-400 font-medium">Field Technician Travel</span>
                          <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">${tcoBreakdown.travel.toLocaleString()} ({Math.round((tcoBreakdown.travel / tcoBreakdown.total) * 100)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(tcoBreakdown.travel / tcoBreakdown.total) * 100}%` }} />
                        </div>
                      </div>

                      {/* Other */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-600 dark:text-zinc-400 font-medium">Custom Surcharges & Shipping</span>
                          <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">${tcoBreakdown.other.toLocaleString()} ({Math.round((tcoBreakdown.other / tcoBreakdown.total) * 100)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                          <div className="h-full bg-zinc-400 dark:bg-zinc-600 rounded-full" style={{ width: `${(tcoBreakdown.other / tcoBreakdown.total) * 100}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Beautiful SVG Pie Chart mapping */}
                    <div className="flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900/30 rounded-lg p-4">
                      <div className="h-44 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={[
                                { name: 'Procurement', value: tcoBreakdown.procurement },
                                { name: 'Calibration', value: tcoBreakdown.calibration },
                                { name: 'Parts', value: tcoBreakdown.parts },
                                { name: 'Travel', value: tcoBreakdown.travel },
                                { name: 'Other', value: tcoBreakdown.other }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {TCO_COLORS.map((color, index) => (
                                <Cell key={`cell-${index}`} fill={color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `$${value}`} contentStyle={{ background: '#111', color: '#fff', border: 'none', borderRadius: 6 }} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-zinc-500 font-mono mt-2">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Procurement</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" /> Lab Calib</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-rose-400 rounded-full" /> Parts</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full" /> Travel</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full" /> Other</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Surcharges and parts table */}
                <div className="bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/60 rounded-xl overflow-hidden">
                  <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/10">
                    <div>
                      <h3 className="text-sm font-semibold text-black dark:text-white">Transaction Log & Custom Charges</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Manually record spare part installations, repair labor bills, shipping, or remote dispatch expenses.</p>
                    </div>
                    <button
                      onClick={() => setIsAddTxModalOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Log Transaction</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-100/50 dark:bg-zinc-900/30 text-zinc-500 font-mono uppercase text-[10px] border-b border-zinc-200 dark:border-zinc-800">
                          <th className="p-3.5 pl-5">Date</th>
                          <th className="p-3.5">Category</th>
                          <th className="p-3.5">Transaction Detail</th>
                          <th className="p-3.5 text-right">Amount</th>
                          <th className="p-3.5 pr-5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900/60">
                        {/* Static standard components based on calculations */}
                        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/10 text-zinc-600 dark:text-zinc-300">
                          <td className="p-3.5 pl-5 font-mono text-zinc-400">{selectedSensor.procurementDate || '2026-01-15'}</td>
                          <td className="p-3.5 font-semibold text-blue-500 uppercase text-[10px]">Procurement</td>
                          <td className="p-3.5">Original factory purchase invoice reference {selectedSensor.invoiceReference || 'N/A'}</td>
                          <td className="p-3.5 text-right font-mono font-bold text-zinc-950 dark:text-zinc-50">${tcoBreakdown.procurement.toLocaleString()}</td>
                          <td className="p-3.5 pr-5 text-center text-zinc-400 italic text-[10px]">Primary Ledger</td>
                        </tr>

                        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/10 text-zinc-600 dark:text-zinc-300">
                          <td className="p-3.5 pl-5 font-mono text-zinc-400">{selectedSensor.lastCalibration?.calibrationDate || 'Active Routine'}</td>
                          <td className="p-3.5 font-semibold text-indigo-400 uppercase text-[10px]">Calibration</td>
                          <td className="p-3.5">Lab hours calibration charge ({tcoBreakdown.calibrationsCount} runs @ {hoursPerCalibration} hrs/run)</td>
                          <td className="p-3.5 text-right font-mono font-bold text-zinc-950 dark:text-zinc-50">${tcoBreakdown.calibration.toLocaleString()}</td>
                          <td className="p-3.5 pr-5 text-center text-zinc-400 italic text-[10px]">Auto Calc</td>
                        </tr>

                        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/10 text-zinc-600 dark:text-zinc-300">
                          <td className="p-3.5 pl-5 font-mono text-zinc-400">Regular Cycle</td>
                          <td className="p-3.5 font-semibold text-amber-400 uppercase text-[10px]">Travel</td>
                          <td className="p-3.5">Field site tech transit dispatch ({tcoBreakdown.trips} dispatches, {tcoBreakdown.miles * 2} mi total distance)</td>
                          <td className="p-3.5 text-right font-mono font-bold text-zinc-950 dark:text-zinc-50">${tcoBreakdown.travel.toLocaleString()}</td>
                          <td className="p-3.5 pr-5 text-center text-zinc-400 italic text-[10px]">Auto Calc</td>
                        </tr>

                        {/* Custom transactions logged */}
                        {(!customTransactions[selectedSensor.sensorId] || customTransactions[selectedSensor.sensorId].length === 0) ? (
                          <tr className="border-t border-dashed border-zinc-200 dark:border-zinc-800">
                            <td colSpan={5} className="p-5 text-center text-zinc-400 italic text-xs">
                              No additional custom transactions added yet. Click "Log Transaction" above to include manual part replacements, transit shipping, or emergency logistics.
                            </td>
                          </tr>
                        ) : (
                          customTransactions[selectedSensor.sensorId].map(tx => (
                            <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/10 text-zinc-600 dark:text-zinc-300 border-t border-zinc-100 dark:border-zinc-900/60">
                              <td className="p-3.5 pl-5 font-mono text-zinc-400">{tx.date}</td>
                              <td className="p-3.5">
                                <span className={`font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                                  tx.category === 'parts' ? 'bg-rose-500/10 text-rose-400' :
                                  tx.category === 'travel' ? 'bg-amber-500/10 text-amber-400' :
                                  tx.category === 'calibration' ? 'bg-indigo-500/10 text-indigo-400' :
                                  'bg-zinc-500/10 text-zinc-400'
                                }`}>
                                  {tx.category}
                                </span>
                              </td>
                              <td className="p-3.5">
                                <div className="font-medium text-black dark:text-white">{tx.title}</div>
                                {tx.notes && <div className="text-[10px] text-zinc-400 mt-0.5">{tx.notes}</div>}
                              </td>
                              <td className="p-3.5 text-right font-mono font-bold text-zinc-950 dark:text-zinc-50">${tx.amount.toLocaleString()}</td>
                              <td className="p-3.5 pr-5 text-center">
                                <button
                                  onClick={() => handleDeleteTransaction(selectedSensor.sensorId, tx.id)}
                                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-red-500 transition cursor-pointer"
                                  title="Delete Transaction"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Add custom transaction modal */}
          {isAddTxModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-xl max-w-md w-full shadow-2xl p-6 overflow-hidden">
                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-900 pb-3 mb-4">
                  <h3 className="text-sm font-semibold text-black dark:text-white">Log Asset Expense Transaction</h3>
                  <button onClick={() => setIsAddTxModalOpen(false)} className="text-zinc-400 hover:text-white text-xs">Close</button>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Expense Title / Item</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Impeller Replacement Part, Shipping Fee, etc."
                      value={newTxTitle}
                      onChange={(e) => setNewTxTitle(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-xs p-2.5 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:outline-none text-black dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Amount ($)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="150"
                        value={newTxAmount}
                        onChange={(e) => setNewTxAmount(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-xs p-2.5 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:outline-none text-black dark:text-white font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Transaction Date</label>
                      <input
                        type="date"
                        required
                        value={newTxDate}
                        onChange={(e) => setNewTxDate(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-xs p-2.5 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:outline-none text-black dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Expense Category</label>
                    <select
                      value={newTxCategory}
                      onChange={(e: any) => setNewTxCategory(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-xs p-2.5 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:outline-none text-black dark:text-white"
                    >
                      <option value="parts">Replacement Parts</option>
                      <option value="travel">Field Transit / Mileage Surcharges</option>
                      <option value="calibration">Lab Accreditation / Calibration Fee</option>
                      <option value="other">General Surcharges / Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Internal Notes (Optional)</label>
                    <textarea
                      placeholder="Add brief details about the replacement or service"
                      value={newTxNotes}
                      onChange={(e) => setNewTxNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-xs p-2.5 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:outline-none text-black dark:text-white"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs tracking-wide shadow-md transition cursor-pointer"
                    >
                      Record Charge Transaction
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}


      {/* --- TAB 2: 5-YEAR CAPITAL BUDGET FORECASTING --- */}
      {activeTab === 'forecast' && (
        <div className="space-y-6">
          
          {/* KPI Projection Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-zinc-950/40 p-5 border border-zinc-200 dark:border-zinc-800/60 rounded-xl">
              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">Upcoming EOL Replacement Total</span>
              <p className="text-2xl font-extrabold text-blue-500 mt-1">
                ${forecastData.timeline.reduce((sum, item) => sum + item.eolCost, 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">Total projected procurement budget needed over next 5 fiscal years.</p>
            </div>

            <div className="bg-white dark:bg-zinc-950/40 p-5 border border-zinc-200 dark:border-zinc-800/60 rounded-xl">
              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">Calibration Load Next FY (2027)</span>
              <p className="text-2xl font-extrabold text-indigo-400 mt-1">
                {forecastData.totalLabVolume} Sessions
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">Projected lab slots needed based on active instruments intervals.</p>
            </div>

            <div className="bg-white dark:bg-zinc-950/40 p-5 border border-zinc-200 dark:border-zinc-800/60 rounded-xl">
              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">Next Year Lab Capacity Budget</span>
              <p className="text-2xl font-extrabold text-teal-500 mt-1">
                ${forecastData.totalLabCost.toLocaleString()}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">Allocated costs for {forecastData.totalLabVolume * hoursPerCalibration} technician hours at standard rates.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Procurement budgeting chart */}
            <div className="bg-white dark:bg-zinc-950/40 p-6 border border-zinc-200 dark:border-zinc-800/60 rounded-xl">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-black dark:text-white">5-Year Procurement Capital Forecast</h3>
                </div>
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">EOL Projections</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastData.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="year" stroke="#888" fontSize={11} tickLine={false} />
                    <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `$${v}`} tickLine={false} />
                    <Tooltip formatter={(value) => `$${value}`} contentStyle={{ background: '#111', color: '#fff', border: 'none', borderRadius: 6 }} />
                    <Bar dataKey="eolCost" name="Replacement Investment" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-4 leading-relaxed bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-900">
                <strong>Forecasting Metric Model:</strong> Operational sensor lifespans default to <strong>10 years</strong> for Sonic/Anemometer speed instruments, <strong>5 years</strong> for Tipping Bucket precipitation gauges, <strong>4 years</strong> for Humidity/Temperature parameters, and <strong>7-8 years</strong> for pressure parameters.
              </p>
            </div>

            {/* Calibration resource allocation chart */}
            <div className="bg-white dark:bg-zinc-950/40 p-6 border border-zinc-200 dark:border-zinc-800/60 rounded-xl">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-black dark:text-white">Next FY Calibration Lab Load Breakdown</h3>
                </div>
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">Lab Operations</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastData.labProjections} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                    <XAxis type="number" stroke="#888" fontSize={11} tickLine={false} />
                    <YAxis dataKey="type" type="category" stroke="#888" fontSize={10} width={110} tickLine={false} />
                    <Tooltip formatter={(value, name) => [value, name === 'volume' ? 'Scheduled Runs' : 'Budget Cost']} contentStyle={{ background: '#111', color: '#fff', border: 'none', borderRadius: 6 }} />
                    <Bar dataKey="volume" name="Scheduled Runs" fill="#818cf8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-4 leading-relaxed bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-900">
                <strong>Lab Load Metric Model:</strong> Projected volumes show the exact scheduled cycles needed in the upcoming year to keep currently deployed instruments in compliance (e.g. 6-month cycle = 2 sessions, 12-month cycle = 1 session).
              </p>
            </div>

          </div>

          {/* Detailed timeline table matching EOL projections */}
          <div className="bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/60 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10">
              <h3 className="text-sm font-semibold text-black dark:text-white">Chronological End-of-Life (EOL) Capital Plan</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">Below is the complete audit of physical instruments scheduled to reach their end of lifespan during each fiscal period.</p>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {forecastData.timeline.map(year => (
                <div key={year.calendarYear} className="p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-500 font-mono font-bold rounded text-xs">
                        {year.year}
                      </span>
                      <span className="text-xs font-semibold text-zinc-400">
                        ({year.eolCount} instrument{year.eolCount === 1 ? '' : 's'} scheduled for decommissioning)
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase mr-1">Estimated Capital:</span>
                      <span className="text-sm font-extrabold text-blue-500">${year.eolCost.toLocaleString()}</span>
                    </div>
                  </div>

                  {year.eolCount === 0 ? (
                    <div className="text-center p-3 text-zinc-500 text-xs italic bg-zinc-50 dark:bg-zinc-900/15 rounded-lg">
                      No instruments hit their EOL index in this fiscal window. Excellent.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {year.sensors.map(se => (
                        <div key={se.id} className="p-3 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-zinc-850 dark:text-zinc-100">{se.type}</span>
                            <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                              S/N: {se.serial} | Site: {se.station}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">${se.cost}</span>
                            <div className="text-[9px] text-zinc-400 mt-0.5">Est. Part Cost</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}


      {/* --- TAB 3: PREDICTIVE SPARE PARTS INVENTORY --- */}
      {activeTab === 'spare-parts' && (
        <div className="space-y-6">
          
          {/* Spare Parts Alerts & Status KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-zinc-950/40 p-5 border border-zinc-200 dark:border-zinc-800/60 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase block">Store Safety Index</span>
                <p className="text-2xl font-extrabold text-blue-500 mt-0.5">{spareStockHealthKpi}% Healthy</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Instrument types matching safety thresholds.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950/40 p-5 border border-zinc-200 dark:border-zinc-800/60 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-lg text-red-500">
                <AlertTriangle className="h-6 w-6 animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase block">Critical Stockouts</span>
                <p className="text-2xl font-extrabold text-red-500 mt-0.5">
                  {sparePartsData.filter(p => p.status === 'critical').length} Classes
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Spare stock is entirely exhausted (0 units).</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950/40 p-5 border border-zinc-200 dark:border-zinc-800/60 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase block">Low Stock Alerts</span>
                <p className="text-2xl font-extrabold text-amber-500 mt-0.5">
                  {sparePartsData.filter(p => p.status === 'low').length} Classes
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Warehouse reserves below safety margins.</p>
              </div>
            </div>
          </div>

          {/* Grid with customizable failure rates sliders & list */}
          <div className="bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/60 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-50/50 dark:bg-zinc-900/10">
              <div>
                <h3 className="text-sm font-semibold text-black dark:text-white">Predictive Spare Stock Reorder Engine</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">Set failure frequencies & view safety thresholds automatically mapped to active station deployment loads.</p>
              </div>
              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">Interactive Modifiers</span>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sparePartsData.map(part => (
                <div key={part.category} className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 hover:bg-zinc-50 dark:hover:bg-zinc-900/10 transition">
                  
                  {/* Category Details */}
                  <div className="w-full lg:w-1/4 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-black dark:text-white">{part.category}</span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        part.status === 'optimal' ? 'bg-emerald-500/10 text-emerald-400' :
                        part.status === 'low' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-red-500/10 text-red-500 animate-pulse'
                      }`}>
                        {part.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Standard unit value: <span className="font-mono font-bold">${part.unitCost}</span>
                    </p>
                  </div>

                  {/* Deployments vs Spares Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 w-full lg:w-1/2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase block">Active Sites</span>
                      <p className="text-lg font-extrabold text-black dark:text-white">{part.deployed} Deployed</p>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase block">Annual Failure %</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={part.failureRate}
                          onChange={(e) => handleFailureRateChange(part.category, Number(e.target.value))}
                          className="w-12 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-center text-xs p-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-black dark:text-white"
                        />
                        <span className="text-xs text-zinc-500">%</span>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase block">Safety Threshold</span>
                      <p className="text-lg font-extrabold text-zinc-700 dark:text-zinc-300">Min: {part.safetyMin} / Max: {part.safetyMax}</p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase block">Warehouse Stock</span>
                      <p className={`text-lg font-extrabold ${
                        part.status === 'optimal' ? 'text-emerald-500' :
                        part.status === 'low' ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {part.spares} Spares
                      </p>
                    </div>
                  </div>

                  {/* Action Reorder PO Trigger */}
                  <div className="w-full lg:w-auto text-right">
                    {part.status !== 'optimal' ? (
                      <button
                        onClick={() => triggerPORequest(part.category, part.safetyMax - part.spares)}
                        className="w-full lg:w-auto flex items-center justify-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold shadow-md transition cursor-pointer"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>Reorder Stock Alert</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => triggerPORequest(part.category, 3)}
                        className="w-full lg:w-auto flex items-center justify-center gap-1 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded text-xs font-semibold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Restock Buffer</span>
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* Alert trigger detail explaining min/max calculation */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 flex gap-4 text-xs">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <strong className="text-amber-500">How safety thresholds work:</strong>
              <p>
                Safety minimum threshold (Safety Stock) is computed dynamically based on: <code className="bg-zinc-100 dark:bg-zinc-900 px-1 py-0.5 rounded font-mono">Math.max(1, Math.ceil(Active Deployed Count * Annual Failure Rate / 100))</code>.
              </p>
              <p className="mt-1">
                If the registered "Spare Store" inventory count falls below this safety margin, the automated logistics node flags a `REORDER ALERT` or `CRITICAL STOCKOUT` so that field installation teams are never blocked by hardware deficits during critical breakdowns.
              </p>
            </div>
          </div>

          {/* Draft Purchase Order Modal */}
          {isPOModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-xl max-w-md w-full shadow-2xl p-6 overflow-hidden">
                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-900 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-500 animate-pulse" />
                    <h3 className="text-sm font-semibold text-black dark:text-white">Draft Spare Purchase Order (PO)</h3>
                  </div>
                  <button onClick={() => setIsPOModalOpen(false)} className="text-zinc-400 hover:text-white text-xs">Close</button>
                </div>

                <form onSubmit={handlePOSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Instrument Category</label>
                    <input
                      type="text"
                      disabled
                      value={selectedSpareToReorder || ''}
                      className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs p-2.5 rounded-lg text-zinc-500 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-zinc-500 uppercase">Purchase Quantity (Units)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      value={reorderQuantity}
                      onChange={(e) => setReorderQuantity(Number(e.target.value))}
                      className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-xs p-2.5 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:outline-none text-black dark:text-white font-mono"
                    />
                    <p className="text-[10px] text-zinc-400 mt-1">Recommended to fill up to Maximum Threshold.</p>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-900 p-3.5 rounded-lg border border-zinc-100 dark:border-zinc-900 space-y-1.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="flex justify-between">
                      <span>Standard Cost / Unit:</span>
                      <span className="text-black dark:text-white font-bold">${SENSOR_TYPE_DEFAULTS[selectedSpareToReorder || '']?.cost || 500}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-zinc-200 dark:border-zinc-800">
                      <span>Total Estimated PO Investment:</span>
                      <span className="text-blue-500 font-extrabold">${((SENSOR_TYPE_DEFAULTS[selectedSpareToReorder || '']?.cost || 500) * reorderQuantity).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs tracking-wide shadow-md transition cursor-pointer"
                    >
                      Authorize PO Generation
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
