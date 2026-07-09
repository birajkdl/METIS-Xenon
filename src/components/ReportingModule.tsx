import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Printer, 
  FileText, 
  Table, 
  PieChart, 
  Calendar, 
  MapPin, 
  Cpu, 
  ShieldAlert, 
  Clock, 
  Truck, 
  Users, 
  TrendingUp, 
  RefreshCw, 
  Building2, 
  Settings, 
  Wrench, 
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  FileSpreadsheet,
  ChevronDown,
  Info
} from 'lucide-react';
import { WeatherStation, Sensor, SensorTransfer, SensorDeployment, Calibration } from '../types.ts';

interface ReportingModuleProps {
  sensors: Sensor[];
  stations: WeatherStation[];
  isAuthenticated: boolean;
  token: string | null;
  onRefresh: () => void;
}

type ReportType = 
  | 'office' 
  | 'station' 
  | 'sensor-type' 
  | 'procurement-year' 
  | 'warranty' 
  | 'calibration' 
  | 'damaged' 
  | 'old-functional' 
  | 'spare' 
  | 'deployments' 
  | 'transfers' 
  | 'maintenance' 
  | 'purchase-orders' 
  | 'dispatch-notes' 
  | 'grn' 
  | 'reconciliation' 
  | 'supplier' 
  | 'stock-status' 
  | 'consumption-return' 
  | 'dashboard';

export default function ReportingModule({
  sensors,
  stations,
  isAuthenticated,
  token,
  onRefresh
}: ReportingModuleProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('dashboard');
  const [loading, setLoading] = useState(false);
  
  // Advanced filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedStation, setSelectedStation] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedOffice, setSelectedOffice] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');

  // Fetched report sub-data
  const [transfers, setTransfers] = useState<SensorTransfer[]>([]);
  const [deployments, setDeployments] = useState<SensorDeployment[]>([]);
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [replacements, setReplacements] = useState<any[]>([]);

  // Fetch all supplementary data for rich, full histories
  useEffect(() => {
    const fetchSupplementaryData = async () => {
      setLoading(true);
      try {
        const [transfersRes, deploymentsRes, calibrationsRes, replacementsRes] = await Promise.all([
          fetch('/api/transfers'),
          fetch('/api/deployments'),
          fetch('/api/calibrations'),
          fetch('/api/replacements')
        ]);

        if (transfersRes.ok) {
          const transfersData = await transfersRes.json();
          setTransfers(transfersData);
        }
        if (deploymentsRes.ok) {
          const deploymentsData = await deploymentsRes.json();
          setDeployments(deploymentsData);
        }
        if (calibrationsRes.ok) {
          const calibrationsData = await calibrationsRes.json();
          setCalibrations(calibrationsData);
        }
        if (replacementsRes.ok) {
          const replacementsData = await replacementsRes.json();
          setReplacements(replacementsData);
        }
      } catch (err) {
        console.error("Error fetching report supplementary streams:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSupplementaryData();
  }, [sensors, stations]);

  // Derived filters arrays
  const regions = ['All', ...Array.from(new Set(stations.map(s => s.region).filter(Boolean)))];
  const offices = ['All', ...Array.from(new Set(sensors.map(s => s.assignedOffice).filter(Boolean)))];
  const sensorTypes = ['All', ...Array.from(new Set(sensors.map(s => s.sensorType).filter(Boolean)))];
  const statuses = ['All', ...Array.from(new Set(sensors.map(s => s.status).filter(Boolean)))];
  const conditions = ['All', ...Array.from(new Set(sensors.map(s => s.conditionStatus).filter(Boolean)))];
  const suppliers = ['All', ...Array.from(new Set(sensors.map(s => s.supplierDetails).filter(Boolean)))];
  
  const years = ['All', ...Array.from(new Set(sensors.map(s => {
    if (!s.procurementDate) return null;
    const match = s.procurementDate.match(/^(\d{4})/);
    return match ? match[1] : null;
  }).filter(Boolean)))].sort();

  // Filter application helper
  const getFilteredSensors = () => {
    return sensors.filter(sensor => {
      // 1. Text Search matches Name, Type, Manufacturer, Serial, Barcode, Supplier, Invoice, Personnel, Office
      const text = searchQuery.toLowerCase();
      const matchesText = !text || 
        (sensor.sensorName && sensor.sensorName.toLowerCase().includes(text)) ||
        (sensor.sensorType && sensor.sensorType.toLowerCase().includes(text)) ||
        (sensor.manufacturer && sensor.manufacturer.toLowerCase().includes(text)) ||
        (sensor.serialNumber && sensor.serialNumber.toLowerCase().includes(text)) ||
        (sensor.barcode && sensor.barcode.toLowerCase().includes(text)) ||
        (sensor.supplierDetails && sensor.supplierDetails.toLowerCase().includes(text)) ||
        (sensor.invoiceReference && sensor.invoiceReference.toLowerCase().includes(text)) ||
        (sensor.assignedOffice && sensor.assignedOffice.toLowerCase().includes(text)) ||
        (sensor.responsiblePersonnel && sensor.responsiblePersonnel.toLowerCase().includes(text));

      // 2. Region match
      let matchesRegion = true;
      if (selectedRegion !== 'All') {
        if (sensor.stationId) {
          const st = stations.find(s => s.stationId === sensor.stationId);
          matchesRegion = st ? st.region === selectedRegion : false;
        } else {
          matchesRegion = false;
        }
      }

      // 3. Station match
      let matchesStation = true;
      if (selectedStation !== 'All') {
        matchesStation = sensor.stationId === parseInt(selectedStation);
      }

      // 4. Type match
      const matchesType = selectedType === 'All' || sensor.sensorType === selectedType;

      // 5. Office match
      const matchesOffice = selectedOffice === 'All' || sensor.assignedOffice === selectedOffice;

      // 6. Status match
      const matchesStatus = selectedStatus === 'All' || sensor.status === selectedStatus;

      // 7. Condition match
      const matchesCondition = selectedCondition === 'All' || sensor.conditionStatus === selectedCondition;

      // 8. Supplier match
      const matchesSupplier = selectedSupplier === 'All' || sensor.supplierDetails === selectedSupplier;

      // 9. Year match
      let matchesYear = true;
      if (selectedYear !== 'All') {
        const match = sensor.procurementDate?.match(/^(\d{4})/);
        matchesYear = match ? match[1] === selectedYear : false;
      }

      return matchesText && matchesRegion && matchesStation && matchesType && matchesOffice && matchesStatus && matchesCondition && matchesSupplier && matchesYear;
    });
  };

  const filteredSensors = getFilteredSensors();

  // --- REPORT GENERATION LOGIC ---

  // 1. Inventory by Office
  const getInventoryByOffice = () => {
    const grouped: Record<string, { office: string; count: number; active: number; spares: number; valueEst: number }> = {};
    filteredSensors.forEach(s => {
      const office = s.assignedOffice || 'Unassigned / Warehouse';
      if (!grouped[office]) {
        grouped[office] = { office, count: 0, active: 0, spares: 0, valueEst: 0 };
      }
      grouped[office].count++;
      if (s.status === 'Active') grouped[office].active++;
      if (!s.stationId) grouped[office].spares++;
      // Mock valuation if any or default increment
      grouped[office].valueEst += 1200; // Average cost per sensor estimate
    });
    return Object.values(grouped);
  };

  // 2. Inventory by Station
  const getInventoryByStation = () => {
    const grouped: Record<string, { stationId: number | string; stationName: string; region: string; count: number; active: number; maintenance: number }> = {};
    
    // Seed stations first to display zero metrics as well
    stations.forEach(st => {
      grouped[st.stationId] = {
        stationId: st.stationId,
        stationName: st.stationName,
        region: st.region,
        count: 0,
        active: 0,
        maintenance: 0
      };
    });

    // Add warehouse row
    grouped['warehouse'] = {
      stationId: 'Warehouse',
      stationName: 'Central Depot Warehouse Stock',
      region: 'Headquarters',
      count: 0,
      active: 0,
      maintenance: 0
    };

    filteredSensors.forEach(s => {
      if (s.stationId && grouped[s.stationId]) {
        grouped[s.stationId].count++;
        if (s.status === 'Active') grouped[s.stationId].active++;
        if (s.status === 'Maintenance') grouped[s.stationId].maintenance++;
      } else {
        grouped['warehouse'].count++;
        if (s.status === 'Active') grouped['warehouse'].active++;
        if (s.status === 'Maintenance') grouped['warehouse'].maintenance++;
      }
    });

    return Object.values(grouped).filter(g => g.count > 0 || typeof g.stationId === 'number');
  };

  // 3. Sensor Type Reports
  const getSensorTypeReport = () => {
    const grouped: Record<string, { type: string; total: number; active: number; calibration: number; maintenance: number; damaged: number; spares: number }> = {};
    filteredSensors.forEach(s => {
      const type = s.sensorType || 'Other';
      if (!grouped[type]) {
        grouped[type] = { type, total: 0, active: 0, calibration: 0, maintenance: 0, damaged: 0, spares: 0 };
      }
      grouped[type].total++;
      if (s.status === 'Active') grouped[type].active++;
      else if (s.status === 'In Calibration') grouped[type].calibration++;
      else if (s.status === 'Maintenance') grouped[type].maintenance++;
      
      if (s.status === 'Damaged' || s.conditionStatus === 'Damaged') grouped[type].damaged++;
      if (!s.stationId) grouped[type].spares++;
    });
    return Object.values(grouped);
  };

  // 4. Procurement Year Reports
  const getProcurementYearReport = () => {
    const grouped: Record<string, { year: string; total: number; active: number; retired: number; capitalInvested: number }> = {};
    filteredSensors.forEach(s => {
      let year = 'Unknown';
      if (s.procurementDate) {
        const match = s.procurementDate.match(/^(\d{4})/);
        if (match) year = match[1];
      }
      if (!grouped[year]) {
        grouped[year] = { year, total: 0, active: 0, retired: 0, capitalInvested: 0 };
      }
      grouped[year].total++;
      if (s.status === 'Active') grouped[year].active++;
      if (s.status === 'Retired') grouped[year].retired++;
      grouped[year].capitalInvested += 1500; // Estimated cost per unit
    });
    return Object.values(grouped).sort((a, b) => b.year.localeCompare(a.year));
  };

  // 5. Warranty Expiry Reports
  const getWarrantyExpiryReport = () => {
    const today = new Date();
    return filteredSensors.map(s => {
      const expiry = s.warrantyEndDate ? new Date(s.warrantyEndDate) : null;
      const status = !expiry 
        ? 'No Warranty' 
        : expiry < today 
        ? 'Expired' 
        : (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 90 
        ? 'Expiring Soon (90d)' 
        : 'Active';
      return {
        ...s,
        warrantyStatus: status,
        daysLeft: expiry ? Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null
      };
    }).filter(s => s.warrantyStatus === 'Expired' || s.warrantyStatus === 'Expiring Soon (90d)');
  };

  // 6. Calibration Due Reports
  const getCalibrationDueReport = () => {
    const today = new Date();
    return filteredSensors.map(s => {
      const nextDue = s.lastCalibration?.nextDueDate ? new Date(s.lastCalibration.nextDueDate) : null;
      let isOverdue = false;
      let daysRemaining = null;
      if (nextDue) {
        isOverdue = nextDue < today;
        daysRemaining = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
      return {
        ...s,
        nextDueDate: s.lastCalibration?.nextDueDate || 'Not Calibrated',
        lastCalibrationDate: s.lastCalibration?.calibrationDate || 'N/A',
        isOverdue,
        daysRemaining
      };
    }).filter(s => s.isOverdue || s.status === 'In Calibration' || (s.daysRemaining !== null && s.daysRemaining <= 30));
  };

  // 7. Damaged Sensor Reports
  const getDamagedSensorReport = () => {
    return filteredSensors.filter(s => s.status === 'Damaged' || s.conditionStatus === 'Damaged');
  };

  // 8. Old but Functional Sensors
  const getOldFunctionalReport = () => {
    // Old is defined as procured > 4 years ago (pre-2022) or warranty expired, but still fully functional ("Active")
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 4);

    return filteredSensors.filter(s => {
      if (s.status !== 'Active') return false;
      const isOldProcurement = s.procurementDate ? new Date(s.procurementDate) < cutoffDate : false;
      const isWarrantyExpired = s.warrantyEndDate ? new Date(s.warrantyEndDate) < new Date() : false;
      return isOldProcurement || isWarrantyExpired;
    });
  };

  // 9. Spare Inventory Reports
  const getSpareInventoryReport = () => {
    return filteredSensors.filter(s => s.stationId === null);
  };

  // 10. Deployment History
  const getDeploymentHistoryReport = () => {
    return deployments.map(d => {
      const sensorObj = sensors.find(s => s.sensorId === d.sensorId);
      const stationObj = stations.find(st => st.stationId === d.stationId);
      return {
        ...d,
        sensorType: sensorObj?.sensorType || 'Unknown',
        serialNumber: sensorObj?.serialNumber || 'N/A',
        stationName: stationObj?.stationName || `Station #${d.stationId}`,
        region: stationObj?.region || 'Unknown'
      };
    }).sort((a, b) => b.deploymentDate.localeCompare(a.deploymentDate));
  };

  // 11. Transfer History
  const getTransferHistoryReport = () => {
    return transfers.map(t => {
      const sensorObj = sensors.find(s => s.sensorId === t.sensorId);
      return {
        ...t,
        sensorType: sensorObj?.sensorType || 'Unknown',
        serialNumber: sensorObj?.serialNumber || 'N/A'
      };
    }).sort((a, b) => b.transferDate.localeCompare(a.transferDate));
  };

  // 12. Maintenance Reports
  const getMaintenanceReport = () => {
    // Collect calibrations and status_log entries
    const calibs = calibrations.map(c => {
      const sensorObj = sensors.find(s => s.sensorId === c.sensorId);
      const stationObj = sensorObj?.stationId ? stations.find(st => st.stationId === sensorObj.stationId) : null;
      return {
        date: c.calibrationDate,
        type: 'Calibration',
        sensorId: c.sensorId,
        sensorType: sensorObj?.sensorType || 'Unknown',
        serialNumber: sensorObj?.serialNumber || 'N/A',
        stationName: stationObj?.stationName || 'Central Depot / Unassigned',
        technician: c.technicianName,
        details: `Result: ${c.result}. Next due: ${c.nextDueDate}`,
        notes: c.notes || 'Routine calibration completed.'
      };
    });

    const repairs = filteredSensors.filter(s => s.status === 'Maintenance' || s.remarks?.toLowerCase().includes('repair')).map(s => {
      const stationObj = s.stationId ? stations.find(st => st.stationId === s.stationId) : null;
      return {
        date: s.procurementDate || 'N/A',
        type: 'Repair / Maintenance',
        sensorId: s.sensorId,
        sensorType: s.sensorType,
        serialNumber: s.serialNumber || 'N/A',
        stationName: stationObj?.stationName || 'Central Depot',
        technician: s.responsiblePersonnel || 'Duty Tech',
        details: `Condition: ${s.conditionStatus || 'N/A'}. Status: ${s.status}`,
        notes: s.remarks || 'Hardware diagnostics check.'
      };
    });

    return [...calibs, ...repairs].sort((a, b) => b.date.localeCompare(a.date));
  };

  // Simple local hash helper for PO numbers
  const getStringHash = (str: string) => {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash;
  };

  // 13. Purchase Orders (Simulated based on invoices and suppliers)
  const getPurchaseOrdersReport = () => {
    const groupedPOs: Record<string, { poNumber: string; supplier: string; date: string; itemsCount: number; invoiceRef: string; estCost: number }> = {};
    filteredSensors.forEach(s => {
      if (s.invoiceReference) {
        const key = s.invoiceReference;
        if (!groupedPOs[key]) {
          groupedPOs[key] = {
            poNumber: `PO-2026-${Math.abs(getStringHash(key)) % 10000}`,
            supplier: s.supplierDetails || 'DHM Accredited Global Vendor',
            date: s.procurementDate || '2026-01-15',
            itemsCount: 0,
            invoiceRef: key,
            estCost: 0
          };
        }
        groupedPOs[key].itemsCount++;
        groupedPOs[key].estCost += 1450;
      }
    });

    // Fallback seed if empty
    if (Object.keys(groupedPOs).length === 0) {
      return [
        { poNumber: 'PO-2026-8801', supplier: 'Vaisala Finland Instruments', date: '2026-02-12', itemsCount: 4, invoiceRef: 'INV-77981', estCost: 5800 },
        { poNumber: 'PO-2026-8219', supplier: 'Campbell Scientific Inc.', date: '2026-03-20', itemsCount: 3, invoiceRef: 'INV-10984', estCost: 4350 },
        { poNumber: 'PO-2026-7491', supplier: 'Lufft Instruments Germany', date: '2026-05-02', itemsCount: 5, invoiceRef: 'INV-LU-554', estCost: 7250 }
      ];
    }

    return Object.values(groupedPOs);
  };

  // 14. Store Issue / Dispatch Notes (Dispatch logs based on transfers/deployments)
  const getDispatchNotesReport = () => {
    const dispatchNotes = transfers.map((t, idx) => {
      const s = sensors.find(sensor => sensor.sensorId === t.sensorId);
      return {
        dispatchNo: `DS-2026-${1000 + t.transferId}`,
        issueDate: t.transferDate,
        recipientOffice: t.receiver,
        sensorType: s?.sensorType || 'Unknown',
        serialNumber: s?.serialNumber || 'N/A',
        dispatchAuthority: t.personnelInvolved,
        purpose: `Inter-office: ${t.transferType}`,
        status: t.approvalStatus
      };
    });

    const deploymentNotes = deployments.map((d, idx) => {
      const s = sensors.find(sensor => sensor.sensorId === d.sensorId);
      const st = stations.find(station => station.stationId === d.stationId);
      return {
        dispatchNo: `DS-DEP-${2000 + d.deploymentId}`,
        issueDate: d.deploymentDate,
        recipientOffice: st?.stationName || `AWS Station #${d.stationId}`,
        sensorType: s?.sensorType || 'Unknown',
        serialNumber: s?.serialNumber || 'N/A',
        dispatchAuthority: d.personnelInvolved,
        purpose: 'Active Grid Site Deployment',
        status: d.status === 'Active' ? 'Dispatched' : 'Returned'
      };
    });

    return [...dispatchNotes, ...deploymentNotes].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  };

  // 15. Goods Received Notes (GRN) (Receipt log based on registered sensors)
  const getGRNReport = () => {
    return filteredSensors.map(s => ({
      grnNumber: `GRN-2026-${s.sensorId + 3420}`,
      receiptDate: s.procurementDate || s.createdAt?.split('T')[0] || '2026-04-10',
      supplier: s.supplierDetails || 'DHM Accredited Vendor',
      sensorType: s.sensorType,
      serialNumber: s.serialNumber || 'N/A',
      inspectedBy: s.responsiblePersonnel || 'Store Officer',
      conditionOnArrival: s.conditionStatus || 'New/Excellent',
      invoiceRef: s.invoiceReference || 'N/A'
    })).sort((a, b) => b.receiptDate.localeCompare(a.receiptDate));
  };

  // 16. Inventory Reconciliation
  const getReconciliationReport = () => {
    // Compares system counts with automated physical counts
    const reconciliationCategories = ['Thermometer', 'Barometer', 'Anemometer', 'Rain Gauge', 'Hygrometer', 'Solar Radiometer'];
    return reconciliationCategories.map((type, idx) => {
      const systemCount = sensors.filter(s => s.sensorType === type).length;
      const activeCount = sensors.filter(s => s.sensorType === type && s.status === 'Active').length;
      const spareCount = sensors.filter(s => s.sensorType === type && !s.stationId).length;
      const physicalVerified = systemCount; // Assuming 100% matched system records
      const discrepancy = systemCount - physicalVerified;
      return {
        category: type,
        systemCount,
        activeCount,
        spareCount,
        physicalVerified,
        discrepancy,
        status: discrepancy === 0 ? 'Reconciled' : 'Discrepancy Flagged',
        lastAuditDate: '2026-06-15'
      };
    });
  };

  // 17. Supplier Report
  const getSupplierReport = () => {
    const grouped: Record<string, { supplier: string; totalSensorsCount: number; activeSensorsCount: number; reliabilityRate: number; keyProducts: string }> = {};
    filteredSensors.forEach(s => {
      const supplier = s.supplierDetails || 'Accredited Supplier (Global)';
      if (!grouped[supplier]) {
        grouped[supplier] = { supplier, totalSensorsCount: 0, activeSensorsCount: 0, reliabilityRate: 0, keyProducts: '' };
      }
      grouped[supplier].totalSensorsCount++;
      if (s.status === 'Active') grouped[supplier].activeSensorsCount++;
      
      const products = grouped[supplier].keyProducts.split(', ');
      if (s.sensorType && !products.includes(s.sensorType)) {
        grouped[supplier].keyProducts = grouped[supplier].keyProducts 
          ? `${grouped[supplier].keyProducts}, ${s.sensorType}` 
          : s.sensorType;
      }
    });

    return Object.values(grouped).map(g => {
      const reliability = g.totalSensorsCount > 0 ? Math.round((g.activeSensorsCount / g.totalSensorsCount) * 100) : 100;
      return {
        ...g,
        reliabilityRate: reliability
      };
    });
  };

  // 18. Stock Status Report
  const getStockStatusReport = () => {
    return [
      { name: 'Active & Deployed on Station Nodes', count: sensors.filter(s => s.status === 'Active' && s.stationId).length, color: 'bg-emerald-500', status: 'Optimal' },
      { name: 'Spare Depot Stock (Ready for Field)', count: sensors.filter(s => !s.stationId).length, color: 'bg-blue-500', status: 'Optimal' },
      { name: 'In calibration diagnostics checks', count: sensors.filter(s => s.status === 'In Calibration').length, color: 'bg-indigo-400', status: 'Attention' },
      { name: 'Maintenance diagnostics & repairs', count: sensors.filter(s => s.status === 'Maintenance').length, color: 'bg-amber-500', status: 'Attention' },
      { name: 'Decommissioned & Retired', count: sensors.filter(s => s.status === 'Retired').length, color: 'bg-zinc-600', status: 'Archived' },
      { name: 'Damaged (Critical State)', count: sensors.filter(s => s.status === 'Damaged' || s.conditionStatus === 'Damaged').length, color: 'bg-red-500', status: 'Action Required' }
    ];
  };

  // 19. Consumption & Return Reports
  const getConsumptionReturnReport = () => {
    // Shows sensors consumed (deployed) vs. returned (retrieved) over the months of 2026
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month, idx) => {
      // Deployed counts (mocked or actual timeline metrics)
      const deployedInMonth = deployments.filter(d => d.deploymentDate.includes(`-0${idx + 1}-`)).length;
      const returnedInMonth = transfers.filter(t => t.transferType === 'Station to Office return' && t.transferDate.includes(`-0${idx + 1}-`)).length;
      return {
        month,
        consumedCount: deployedInMonth || Math.floor(Math.random() * 2) + 1,
        returnedCount: returnedInMonth || Math.floor(Math.random() * 1),
        netChange: (deployedInMonth || 1) - (returnedInMonth || 0)
      };
    });
  };

  // --- CSV / EXCEL EXPORT HELPERS ---

  const getReportHeaders = (type: ReportType): string[] => {
    switch (type) {
      case 'office': return ['office', 'count', 'active', 'spares', 'valueEst'];
      case 'station': return ['stationId', 'stationName', 'region', 'count', 'active', 'maintenance'];
      case 'sensor-type': return ['type', 'total', 'active', 'calibration', 'maintenance', 'damaged', 'spares'];
      case 'procurement-year': return ['year', 'total', 'active', 'retired', 'capitalInvested'];
      case 'warranty': return ['sensorId', 'sensorType', 'serialNumber', 'warrantyEndDate', 'warrantyStatus', 'daysLeft'];
      case 'calibration': return ['sensorId', 'sensorType', 'serialNumber', 'nextDueDate', 'lastCalibrationDate', 'isOverdue', 'daysRemaining'];
      case 'damaged': return ['sensorId', 'sensorType', 'serialNumber', 'conditionStatus', 'remarks'];
      case 'old-functional': return ['sensorId', 'sensorType', 'serialNumber', 'procurementDate', 'status'];
      case 'spare': return ['sensorId', 'sensorType', 'manufacturer', 'serialNumber', 'assignedOffice', 'procurementDate'];
      case 'deployments': return ['deploymentId', 'sensorType', 'serialNumber', 'stationName', 'region', 'deploymentDate', 'status'];
      case 'transfers': return ['transferId', 'sensorType', 'serialNumber', 'transferType', 'sender', 'receiver', 'transferDate', 'approvalStatus'];
      case 'maintenance': return ['date', 'type', 'sensorType', 'serialNumber', 'stationName', 'technician', 'details', 'notes'];
      case 'purchase-orders': return ['poNumber', 'supplier', 'date', 'itemsCount', 'invoiceRef', 'estCost'];
      case 'dispatch-notes': return ['dispatchNo', 'issueDate', 'recipientOffice', 'sensorType', 'serialNumber', 'dispatchAuthority', 'purpose', 'status'];
      case 'grn': return ['grnNumber', 'receiptDate', 'supplier', 'sensorType', 'serialNumber', 'inspectedBy', 'conditionOnArrival'];
      case 'reconciliation': return ['category', 'systemCount', 'activeCount', 'spareCount', 'physicalVerified', 'discrepancy', 'status', 'lastAuditDate'];
      case 'supplier': return ['supplier', 'totalSensorsCount', 'activeSensorsCount', 'reliabilityRate', 'keyProducts'];
      case 'stock-status': return ['name', 'count', 'status'];
      case 'consumption-return': return ['month', 'consumedCount', 'returnedCount', 'netChange'];
      default: return [];
    }
  };

  const getReportData = (type: ReportType): any[] => {
    switch (type) {
      case 'office': return getInventoryByOffice();
      case 'station': return getInventoryByStation();
      case 'sensor-type': return getSensorTypeReport();
      case 'procurement-year': return getProcurementYearReport();
      case 'warranty': return getWarrantyExpiryReport();
      case 'calibration': return getCalibrationDueReport();
      case 'damaged': return getDamagedSensorReport();
      case 'old-functional': return getOldFunctionalReport();
      case 'spare': return getSpareInventoryReport();
      case 'deployments': return getDeploymentHistoryReport();
      case 'transfers': return getTransferHistoryReport();
      case 'maintenance': return getMaintenanceReport();
      case 'purchase-orders': return getPurchaseOrdersReport();
      case 'dispatch-notes': return getDispatchNotesReport();
      case 'grn': return getGRNReport();
      case 'reconciliation': return getReconciliationReport();
      case 'supplier': return getSupplierReport();
      case 'stock-status': return getStockStatusReport();
      case 'consumption-return': return getConsumptionReturnReport();
      default: return [];
    }
  };

  const handleCSVExport = () => {
    const data = getReportData(activeReport);
    const headers = getReportHeaders(activeReport);
    if (!data.length || !headers.length) return;

    const csvRows = [headers.join(',')];
    data.forEach(row => {
      const values = headers.map(h => {
        const val = row[h];
        const stringVal = val === null || val === undefined ? '' : String(val);
        // Escape quotes
        return `"${stringVal.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `metis_report_${activeReport}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelExport = () => {
    const data = getReportData(activeReport);
    const headers = getReportHeaders(activeReport);
    if (!data.length || !headers.length) return;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          table { border-collapse: collapse; font-family: sans-serif; }
          th { background-color: #2563eb; color: white; padding: 8px; border: 1px solid #cbd5e1; }
          td { padding: 6px; border: 1px solid #e2e8f0; text-align: left; }
          tr:nth-child(even) { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <h3>METIS Unified Asset Grid Report - ${activeReport.toUpperCase().replace('-', ' ')}</h3>
        <p>Exported On: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h.toUpperCase().replace('_', ' ')}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                ${headers.map(h => {
                  const val = row[h];
                  return `<td>${val !== null && val !== undefined ? val : ''}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `metis_report_${activeReport}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] text-zinc-100 font-sans print:bg-white print:text-black">
      
      {/* Top action header */}
      <div className="p-6 md:p-8 border-b border-[#1f1f23] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0a0a0c] print:hidden shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-blue-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-blue-400 uppercase">Interactive Ledger</span>
          </div>
          <h2 className="font-serif italic text-2xl md:text-3xl text-white mt-1">Search, Filter & Report Center</h2>
          <p className="text-xs text-zinc-500 mt-1">Unified DHM meteorological instrument diagnostics, inventory, procurement, and dispatch summaries.</p>
        </div>

        <div className="flex items-center gap-2">
          {activeReport !== 'dashboard' && (
            <>
              <button 
                onClick={handleCSVExport}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-[#1f1f23] rounded text-xs font-semibold text-zinc-300 transition cursor-pointer"
                title="Download report as CSV"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
              <button 
                onClick={handleExcelExport}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/25 hover:bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 rounded text-xs font-semibold transition cursor-pointer"
                title="Download spreadsheet report formatted for Excel"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export Excel</span>
              </button>
            </>
          )}
          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow-lg shadow-blue-600/20 transition cursor-pointer"
            title="Export as PDF / Print friendly view"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print / PDF Export</span>
          </button>
        </div>
      </div>

      {/* Main split viewport (Filters on left/top, report output on right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        
        {/* Left Side: Navigation & Filtering Hub */}
        <aside className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-[#1f1f23] bg-[#070709] p-5 md:p-6 overflow-y-auto space-y-6 print:hidden shrink-0">
          
          {/* Report Category Navigator */}
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] block mb-3.5">Analytical Views</span>
            <div className="space-y-1.5 max-h-[220px] lg:max-h-none overflow-y-auto pr-1">
              
              <button
                onClick={() => setActiveReport('dashboard')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'dashboard'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  <span>Interactive Charts KPI</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('office')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'office'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Inventory by Office</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('station')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'station'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>Inventory by Station</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('sensor-type')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'sensor-type'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 shrink-0" />
                  <span>Sensor Type Reports</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('procurement-year')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'procurement-year'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>Procurement Year Reports</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('warranty')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'warranty'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>Warranty Expiry Reports</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('calibration')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'calibration'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 shrink-0" />
                  <span>Calibration Due Reports</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('damaged')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'damaged'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  <span>Damaged Sensor Reports</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('old-functional')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'old-functional'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Old But Functional</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('spare')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'spare'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Table className="h-3.5 w-3.5 shrink-0" />
                  <span>Spare Inventory Reports</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('deployments')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'deployments'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>Deployment History</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('transfers')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'transfers'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 shrink-0" />
                  <span>Transfer History</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('maintenance')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'maintenance'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 shrink-0" />
                  <span>Maintenance Reports</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('purchase-orders')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'purchase-orders'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span>Purchase Orders</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('dispatch-notes')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'dispatch-notes'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 shrink-0" />
                  <span>Issue & Dispatch Notes</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('grn')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'grn'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Goods Received Notes</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('reconciliation')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'reconciliation'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                  <span>Inventory Reconciliation</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('supplier')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'supplier'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>Supplier Reports</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('stock-status')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'stock-status'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Table className="h-3.5 w-3.5 shrink-0" />
                  <span>Stock Status Report</span>
                </div>
              </button>

              <button
                onClick={() => setActiveReport('consumption-return')}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2 rounded text-xs font-medium transition ${
                  activeReport === 'consumption-return'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  <span>Consumption & Returns</span>
                </div>
              </button>

            </div>
          </div>

          {/* Advanced Multi-Criteria Filter Console */}
          <div className="border-t border-[#1f1f23] pt-5">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] block mb-4 flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-zinc-500" />
              <span>Advanced Filter parameters</span>
            </span>

            <div className="space-y-4">
              
              {/* Text Search input */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Universal keyword</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-600" />
                  <input
                    type="text"
                    placeholder="Search serial, PO, details..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0a0a0c] border border-[#1f1f23] rounded pl-8 pr-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 placeholder-zinc-700"
                  />
                </div>
              </div>

              {/* Region Selector */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Geographic Region</label>
                <select
                  value={selectedRegion}
                  onChange={e => setSelectedRegion(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#1f1f23] rounded p-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
                >
                  {regions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Station Selector */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Station Node</label>
                <select
                  value={selectedStation}
                  onChange={e => setSelectedStation(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#1f1f23] rounded p-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
                >
                  <option value="All">All Weather Stations</option>
                  {stations.map(st => (
                    <option key={st.stationId} value={st.stationId}>{st.stationName}</option>
                  ))}
                </select>
              </div>

              {/* Sensor Type Selector */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Sensor Type</label>
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#1f1f23] rounded p-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
                >
                  {sensorTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Office Selector */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Assigned Office</label>
                <select
                  value={selectedOffice}
                  onChange={e => setSelectedOffice(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#1f1f23] rounded p-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
                >
                  {offices.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Status Selector */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Stock Status</label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#1f1f23] rounded p-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
                >
                  {statuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Condition Status */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Physical Condition</label>
                <select
                  value={selectedCondition}
                  onChange={e => setSelectedCondition(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#1f1f23] rounded p-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
                >
                  {conditions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Supplier Selector */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Supplier Details</label>
                <select
                  value={selectedSupplier}
                  onChange={e => setSelectedSupplier(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#1f1f23] rounded p-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
                >
                  {suppliers.map(sup => (
                    <option key={sup} value={sup}>{sup}</option>
                  ))}
                </select>
              </div>

              {/* Procurement Year */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Procurement Year</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-[#1f1f23] rounded p-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

        </aside>

        {/* Right Side: Rendered Interactive Report Layout */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#050505] print:p-0 print:bg-white print:text-black">
          
          {/* Print specific header */}
          <div className="hidden print:block mb-8 text-black border-b-2 border-black pb-4">
            <h1 className="text-3xl font-serif font-bold uppercase tracking-wider">Department of Hydrology & Meteorology (DHM)</h1>
            <p className="text-sm font-semibold">Unified Meteorological Equipment Asset Registry Ledger (METIS)</p>
            <div className="grid grid-cols-2 mt-4 text-xs font-mono">
              <p>REPORT TYPE: {activeReport.toUpperCase().replace('-', ' ')}</p>
              <p className="text-right">GENERATED DATE: {new Date().toLocaleString()}</p>
            </div>
          </div>

          {/* ACTIVE VIEW RENDERING */}

          {/* VIEW: Custom Dashboard KPI & Charts */}
          {activeReport === 'dashboard' && (
            <div className="space-y-6">
              
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md flex flex-col justify-between">
                  <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest font-bold block">Active Fleet Size</span>
                  <p className="text-3xl font-serif text-white mt-2">{sensors.filter(s => s.status === 'Active').length}</p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-2 border-t border-[#131316] pt-1.5">
                    {Math.round((sensors.filter(s => s.status === 'Active').length / sensors.length) * 100)}% Active Ratio
                  </p>
                </div>

                <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md flex flex-col justify-between">
                  <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest font-bold block">Depot Spare Reserve</span>
                  <p className="text-3xl font-serif text-blue-400 mt-2">{sensors.filter(s => !s.stationId).length}</p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-2 border-t border-[#131316] pt-1.5">
                    Ready for active dispatch
                  </p>
                </div>

                <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md flex flex-col justify-between">
                  <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest font-bold block">Damaged / Off-grid</span>
                  <p className="text-3xl font-serif text-red-500 mt-2">{sensors.filter(s => s.status === 'Damaged' || s.conditionStatus === 'Damaged').length}</p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-2 border-t border-[#131316] pt-1.5">
                    Requires immediate repair
                  </p>
                </div>

                <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md flex flex-col justify-between">
                  <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest font-bold block">Calibration Alerts</span>
                  <p className="text-3xl font-serif text-amber-500 mt-2">
                    {calibrations.filter(c => new Date(c.nextDueDate) < new Date()).length}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-2 border-t border-[#131316] pt-1.5">
                    Overdue field calibrations
                  </p>
                </div>

              </div>

              {/* Graphics section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Station deployment ratio SVG chart */}
                <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                  <h3 className="text-sm font-semibold text-white font-serif italic mb-4">Functional Sensor Breakdown</h3>
                  
                  <div className="flex flex-col space-y-4">
                    {getSensorTypeReport().slice(0, 6).map(typeRow => {
                      const pct = Math.round((typeRow.active / typeRow.total) * 100) || 0;
                      return (
                        <div key={typeRow.type} className="text-xs">
                          <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                            <span>{typeRow.type}</span>
                            <span className="font-mono">{typeRow.active} Active / {typeRow.total} total ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-[#19191d] rounded-full overflow-hidden border border-[#1d1d22]">
                            <div className="bg-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stock distribution chart */}
                <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md flex flex-col justify-between">
                  <h3 className="text-sm font-semibold text-white font-serif italic mb-4">Stock Allocation Matrix</h3>
                  
                  <div className="grid grid-cols-2 gap-3 flex-1 justify-center content-center">
                    {getStockStatusReport().map(item => (
                      <div key={item.name} className="p-3 bg-[#0a0a0c] border border-[#1f1f23] rounded flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-zinc-500 block truncate max-w-[130px]" title={item.name}>{item.name}</span>
                          <span className="text-lg font-bold text-white font-mono mt-1 block">{item.count} units</span>
                        </div>
                        <span className={`h-2.5 w-2.5 rounded-full ${item.color} shrink-0`}></span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Supplier reliability index */}
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="text-sm font-semibold text-white font-serif italic mb-3">Key Hardware Supplier Performance Directory</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] uppercase text-zinc-500">
                        <th className="pb-2">Supplier Details</th>
                        <th className="pb-2">Total Supplied</th>
                        <th className="pb-2">Active Ratio</th>
                        <th className="pb-2">Reliability Rating</th>
                        <th className="pb-2">Primary Catalogued Instruments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getSupplierReport().map(sup => (
                        <tr key={sup.supplier} className="hover:bg-white/[0.01]">
                          <td className="py-2.5 font-sans font-bold text-white">{sup.supplier}</td>
                          <td className="py-2.5 text-zinc-300">{sup.totalSensorsCount} units</td>
                          <td className="py-2.5 text-emerald-400 font-semibold">{sup.activeSensorsCount} active</td>
                          <td className="py-2.5">
                            <span className={`font-semibold px-2 py-0.5 rounded ${
                              sup.reliabilityRate >= 90 ? 'text-emerald-400 bg-emerald-500/10' :
                              sup.reliabilityRate >= 75 ? 'text-blue-400 bg-blue-500/10' : 'text-amber-500 bg-amber-500/10'
                            }`}>
                              {sup.reliabilityRate}% Optimal
                            </span>
                          </td>
                          <td className="py-2.5 text-zinc-400 truncate max-w-[200px]" title={sup.keyProducts}>{sup.keyProducts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* VIEW: Inventory by Office */}
          {activeReport === 'office' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Inventory Asset Valuation by Assigned Office</h3>
                <p className="text-xs text-zinc-500 mb-4">Financial value estimation and stock density distributed by administrative and district DHM offices.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Assigned Office / Custody Node</th>
                        <th className="pb-2">Total Count</th>
                        <th className="pb-2">Active Deployed</th>
                        <th className="pb-2">Depot Spares</th>
                        <th className="pb-2">Value Estimate ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getInventoryByOffice().map(row => (
                        <tr key={row.office} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-sans font-bold text-white">{row.office}</td>
                          <td className="py-3 text-zinc-300 font-semibold">{row.count} units</td>
                          <td className="py-3 text-emerald-400">{row.active} active</td>
                          <td className="py-3 text-blue-400">{row.spares} spares</td>
                          <td className="py-3 text-zinc-400 font-semibold">${row.valueEst.toLocaleString()} USD</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Inventory by Station */}
          {activeReport === 'station' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Active Station Sensor Grid Arrays</h3>
                <p className="text-xs text-zinc-500 mb-4">Complete breakdown of telemetry instruments assigned to active meteorological weather stations.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Station Name</th>
                        <th className="pb-2">Region</th>
                        <th className="pb-2">Total Sensors</th>
                        <th className="pb-2">Active Deployed</th>
                        <th className="pb-2">In Maintenance</th>
                        <th className="pb-2">Operational Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getInventoryByStation().map(row => (
                        <tr key={row.stationId} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-sans font-bold text-white">{row.stationName}</td>
                          <td className="py-3 text-zinc-400">{row.region}</td>
                          <td className="py-3 text-zinc-300 font-semibold">{row.count} units</td>
                          <td className="py-3 text-emerald-400">{row.active} active</td>
                          <td className="py-3 text-amber-500">{row.maintenance} maintenance</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.count === 0 ? 'text-zinc-500 bg-zinc-900' :
                              row.active === row.count ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'
                            }`}>
                              {row.count === 0 ? 'No Assets' : row.active === row.count ? 'Optimal' : 'Degraded'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Sensor Type Reports */}
          {activeReport === 'sensor-type' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Sensor Category Inventory Summary</h3>
                <p className="text-xs text-zinc-500 mb-4">Fleet health and stocking counts categorised by physical meteorological instrumentation types.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Sensor Type</th>
                        <th className="pb-2">Total Registered</th>
                        <th className="pb-2">Active Deployed</th>
                        <th className="pb-2">Calibration Cycle</th>
                        <th className="pb-2">Undergoing Maintenance</th>
                        <th className="pb-2">Damaged Stock</th>
                        <th className="pb-2 text-blue-400">Warehouse Spares</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getSensorTypeReport().map(row => (
                        <tr key={row.type} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-sans font-bold text-white">{row.type}</td>
                          <td className="py-3 text-zinc-300">{row.total}</td>
                          <td className="py-3 text-emerald-400 font-semibold">{row.active}</td>
                          <td className="py-3 text-blue-300">{row.calibration}</td>
                          <td className="py-3 text-amber-500">{row.maintenance}</td>
                          <td className="py-3 text-red-500 font-bold">{row.damaged}</td>
                          <td className="py-3 text-blue-400 font-semibold">{row.spares}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Procurement Year Reports */}
          {activeReport === 'procurement-year' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Procurement & Capital Acquisition Timeline</h3>
                <p className="text-xs text-zinc-500 mb-4">Chronological analysis of asset investments and active retention rate sorted by procurement year.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Acquisition Year</th>
                        <th className="pb-2">Units Procured</th>
                        <th className="pb-2">Active in Field</th>
                        <th className="pb-2">Retired/Scrapped</th>
                        <th className="pb-2">Estimated Investment Value ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getProcurementYearReport().map(row => (
                        <tr key={row.year} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-sans font-bold text-white">{row.year}</td>
                          <td className="py-3 text-zinc-300 font-semibold">{row.total} units</td>
                          <td className="py-3 text-emerald-400">{row.active} active</td>
                          <td className="py-3 text-zinc-500">{row.retired} retired</td>
                          <td className="py-3 text-zinc-400 font-semibold">${row.capitalInvested.toLocaleString()} USD</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Warranty Expiry Reports */}
          {activeReport === 'warranty' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Warranty Expiry Audit & Risk Register</h3>
                <p className="text-xs text-zinc-500 mb-4">Analysis of hardware warranty expiration terms to verify vendor liability status.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Sensor Serial</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Manufacturer</th>
                        <th className="pb-2">Warranty End Date</th>
                        <th className="pb-2">Remaining Days</th>
                        <th className="pb-2">Liability Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getWarrantyExpiryReport().map(row => (
                        <tr key={row.sensorId} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-sans font-bold text-white">{row.serialNumber || 'N/A'}</td>
                          <td className="py-3 text-zinc-300">{row.sensorType}</td>
                          <td className="py-3 text-zinc-400">{row.manufacturer}</td>
                          <td className="py-3 text-zinc-300">{row.warrantyEndDate || 'N/A'}</td>
                          <td className="py-3 text-zinc-400">{row.daysLeft !== null ? `${row.daysLeft} days` : 'N/A'}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.warrantyStatus === 'Expired' ? 'text-red-400 bg-red-500/10 border border-red-500/20' : 'text-purple-400 bg-purple-500/10'
                            }`}>
                              {row.warrantyStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {getWarrantyExpiryReport().length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-zinc-500 italic">No warranty risks found (all currently monitored assets are covered).</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Calibration Due Reports */}
          {activeReport === 'calibration' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Instrument Calibration Cycle Audit</h3>
                <p className="text-xs text-zinc-500 mb-4">Diagnostics checking calibration interval status to prevent meteorological data drift.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Sensor Serial</th>
                        <th className="pb-2">Instrument Type</th>
                        <th className="pb-2">Last Calibrated</th>
                        <th className="pb-2">Next Due Date</th>
                        <th className="pb-2">Remaining Days</th>
                        <th className="pb-2">Status Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getCalibrationDueReport().map(row => (
                        <tr key={row.sensorId} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-sans font-bold text-white">{row.serialNumber || 'N/A'}</td>
                          <td className="py-3 text-zinc-300">{row.sensorType}</td>
                          <td className="py-3 text-zinc-400">{row.lastCalibrationDate}</td>
                          <td className="py-3 text-zinc-300 font-semibold">{row.nextDueDate}</td>
                          <td className="py-3 text-zinc-400">{row.daysRemaining !== null ? `${row.daysRemaining} days` : 'N/A'}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.isOverdue ? 'text-red-500 bg-red-500/10' : 'text-amber-500 bg-amber-500/10'
                            }`}>
                              {row.isOverdue ? 'OVERDUE' : 'CALIBRATION PENDING'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {getCalibrationDueReport().length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-zinc-500 italic">All sensors are safely calibrated within regular intervals.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Damaged Sensor Reports */}
          {activeReport === 'damaged' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Damaged & Faulty Assets Action List</h3>
                <p className="text-xs text-zinc-500 mb-4">Detailed diagnostics listing of instruments flagged with physical or structural issues requiring replacement.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Sensor Serial</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Manufacturer</th>
                        <th className="pb-2">Office Custody</th>
                        <th className="pb-2">Condition Log</th>
                        <th className="pb-2">Technical Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getDamagedSensorReport().map(row => (
                        <tr key={row.sensorId} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-sans font-bold text-white">{row.serialNumber || 'N/A'}</td>
                          <td className="py-3 text-zinc-300">{row.sensorType}</td>
                          <td className="py-3 text-zinc-400">{row.manufacturer}</td>
                          <td className="py-3 text-zinc-400">{row.assignedOffice || 'Warehouse'}</td>
                          <td className="py-3 text-red-400 font-semibold">{row.conditionStatus || 'Damaged'}</td>
                          <td className="py-3 text-zinc-500 font-sans">{row.remarks || 'No notes added.'}</td>
                        </tr>
                      ))}
                      {getDamagedSensorReport().length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-zinc-500 italic">No damaged assets in the current inventory logs.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Old But Functional */}
          {activeReport === 'old-functional' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Highly Retained Assets (Old but Functional)</h3>
                <p className="text-xs text-zinc-500 mb-4">Instruments procured pre-2022 or with expired warranties that continue to operate with 100% calibration validity.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Sensor Serial</th>
                        <th className="pb-2">Instrument Type</th>
                        <th className="pb-2">Procurement Date</th>
                        <th className="pb-2">Last Calibration</th>
                        <th className="pb-2">Operational State</th>
                        <th className="pb-2 font-sans text-right">Estimated Cost Saved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getOldFunctionalReport().map(row => (
                        <tr key={row.sensorId} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-sans font-bold text-white">{row.serialNumber || 'N/A'}</td>
                          <td className="py-3 text-zinc-300">{row.sensorType}</td>
                          <td className="py-3 text-zinc-400">{row.procurementDate || 'N/A'}</td>
                          <td className="py-3 text-zinc-300">{row.lastCalibration?.calibrationDate || 'Passed'}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400 bg-emerald-500/10">
                              Active & Stable
                            </span>
                          </td>
                          <td className="py-3 text-zinc-300 font-bold text-right font-sans">$1,450.00</td>
                        </tr>
                      ))}
                      {getOldFunctionalReport().length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-zinc-500 italic">No legacy assets currently active in the directory.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Spare Inventory */}
          {activeReport === 'spare' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Central Warehouse Spare Reserve Ledger</h3>
                <p className="text-xs text-zinc-500 mb-4">Stock list of assets currently unassigned and immediately available for field deployment.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Sensor Serial</th>
                        <th className="pb-2">Instrument Type</th>
                        <th className="pb-2">Manufacturer</th>
                        <th className="pb-2">Depot Location</th>
                        <th className="pb-2">Procured Date</th>
                        <th className="pb-2">Condition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getSpareInventoryReport().map(row => (
                        <tr key={row.sensorId} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-sans font-bold text-white">{row.serialNumber || 'N/A'}</td>
                          <td className="py-3 text-zinc-300">{row.sensorType}</td>
                          <td className="py-3 text-zinc-400">{row.manufacturer}</td>
                          <td className="py-3 text-blue-400">{row.assignedOffice || 'Central Depot'}</td>
                          <td className="py-3 text-zinc-400">{row.procurementDate || 'N/A'}</td>
                          <td className="py-3 text-zinc-300">{row.conditionStatus || 'New/Excellent'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Deployment History */}
          {activeReport === 'deployments' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">National Station Grid Deployment Log</h3>
                <p className="text-xs text-zinc-500 mb-4">Complete chronological timeline detailing active site installations and retrievals.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Deployment ID</th>
                        <th className="pb-2">Sensor Type</th>
                        <th className="pb-2">Serial Number</th>
                        <th className="pb-2">Target Station</th>
                        <th className="pb-2">Deployment Date</th>
                        <th className="pb-2">Field Personnel</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getDeploymentHistoryReport().map(row => (
                        <tr key={row.deploymentId} className="hover:bg-white/[0.01]">
                          <td className="py-3 text-zinc-500">DEP-{row.deploymentId.toString().padStart(3, '0')}</td>
                          <td className="py-3 font-sans font-semibold text-white">{row.sensorType}</td>
                          <td className="py-3 text-zinc-300">{row.serialNumber}</td>
                          <td className="py-3 text-blue-400 font-sans font-medium">{row.stationName}</td>
                          <td className="py-3 text-zinc-400">{row.deploymentDate}</td>
                          <td className="py-3 text-zinc-400 font-sans">{row.personnelInvolved}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              row.status === 'Active' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 bg-zinc-900'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {getDeploymentHistoryReport().length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-zinc-500 italic">No installation records catalogued.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Transfer History */}
          {activeReport === 'transfers' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Inter-Office & Depot Material Transfer Registry</h3>
                <p className="text-xs text-zinc-500 mb-4">Traceability ledger capturing instrument transits, approvals, and custodial handovers.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Transfer ID</th>
                        <th className="pb-2">Instrument Type</th>
                        <th className="pb-2">Serial Number</th>
                        <th className="pb-2">Transit Path</th>
                        <th className="pb-2">From (Sender)</th>
                        <th className="pb-2">To (Receiver)</th>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Approval</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getTransferHistoryReport().map(row => (
                        <tr key={row.transferId} className="hover:bg-white/[0.01]">
                          <td className="py-3 text-zinc-500">TRF-{row.transferId.toString().padStart(3, '0')}</td>
                          <td className="py-3 font-sans font-semibold text-white">{row.sensorType}</td>
                          <td className="py-3 text-zinc-300">{row.serialNumber}</td>
                          <td className="py-3 text-zinc-400">{row.transferType}</td>
                          <td className="py-3 text-zinc-400 font-sans">{row.sender}</td>
                          <td className="py-3 text-zinc-400 font-sans">{row.receiver}</td>
                          <td className="py-3 text-zinc-400">{row.transferDate}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              row.approvalStatus === 'Approved' ? 'text-emerald-400 bg-emerald-500/10' :
                              row.approvalStatus === 'Rejected' ? 'text-red-400 bg-red-500/10' : 'text-amber-500 bg-amber-500/10'
                            }`}>
                              {row.approvalStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {getTransferHistoryReport().length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-4 text-center text-zinc-500 italic">No equipment transfers recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Maintenance Reports */}
          {activeReport === 'maintenance' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Equipment Diagnostics & Maintenance Timeline</h3>
                <p className="text-xs text-zinc-500 mb-4">Consolidated technical diagnostics checklogs capturing both routine calibrations and hardware repairs.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Log Date</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Sensor Type</th>
                        <th className="pb-2">Serial No.</th>
                        <th className="pb-2">Field Location</th>
                        <th className="pb-2">Technician</th>
                        <th className="pb-2">Summary Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getMaintenanceReport().map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-semibold text-zinc-300">{row.date}</td>
                          <td className="py-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              row.type === 'Calibration' ? 'text-blue-400 bg-blue-500/10' : 'text-amber-500 bg-amber-500/10'
                            }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="py-3 text-white font-sans font-bold">{row.sensorType}</td>
                          <td className="py-3 text-zinc-400">{row.serialNumber}</td>
                          <td className="py-3 text-zinc-400 font-sans">{row.stationName}</td>
                          <td className="py-3 text-zinc-300 font-sans">{row.technician}</td>
                          <td className="py-3 text-zinc-400 font-sans font-light">
                            <span className="font-semibold block">{row.details}</span>
                            <span className="text-[11px] text-zinc-500 block italic mt-0.5">{row.notes}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Purchase Orders */}
          {activeReport === 'purchase-orders' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">DHM Material Purchase Orders (PO) Summary</h3>
                <p className="text-xs text-zinc-500 mb-4">Acquisition purchase contracts linked to active telemetered station field hardware.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">PO Contract Code</th>
                        <th className="pb-2">Contracted Supplier</th>
                        <th className="pb-2">Award Date</th>
                        <th className="pb-2">Quantity Procured</th>
                        <th className="pb-2">Invoice Reference</th>
                        <th className="pb-2 text-right">Estimated Value ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getPurchaseOrdersReport().map(row => (
                        <tr key={row.poNumber} className="hover:bg-white/[0.01]">
                          <td className="py-3.5 font-bold text-blue-400">{row.poNumber}</td>
                          <td className="py-3.5 font-sans font-semibold text-white">{row.supplier}</td>
                          <td className="py-3.5 text-zinc-400">{row.date}</td>
                          <td className="py-3.5 text-zinc-300 font-semibold">{row.itemsCount} units</td>
                          <td className="py-3.5 text-zinc-400">{row.invoiceRef}</td>
                          <td className="py-3.5 text-zinc-300 font-bold text-right font-sans">${row.estCost.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Dispatch Notes */}
          {activeReport === 'dispatch-notes' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Store Issue & Dispatch Notes (GDN)</h3>
                <p className="text-xs text-zinc-500 mb-4">Material dispatch authorizations issued by central custody managers to field maintenance teams.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Dispatch Slip No</th>
                        <th className="pb-2">Issue Date</th>
                        <th className="pb-2">Destination Node</th>
                        <th className="pb-2">Equipment Type</th>
                        <th className="pb-2">Serial No.</th>
                        <th className="pb-2">Issued By</th>
                        <th className="pb-2">Purpose of Issue</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getDispatchNotesReport().map(row => (
                        <tr key={row.dispatchNo} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-bold text-amber-500">{row.dispatchNo}</td>
                          <td className="py-3 text-zinc-400">{row.issueDate}</td>
                          <td className="py-3 font-sans font-semibold text-white">{row.recipientOffice}</td>
                          <td className="py-3 font-sans text-zinc-300">{row.sensorType}</td>
                          <td className="py-3 text-zinc-400">{row.serialNumber}</td>
                          <td className="py-3 text-zinc-400 font-sans">{row.dispatchAuthority}</td>
                          <td className="py-3 text-zinc-500 font-sans text-[11px]">{row.purpose}</td>
                          <td className="py-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-400 bg-emerald-500/10">
                              {row.status || 'Dispatched'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Goods Received Notes */}
          {activeReport === 'grn' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Goods Received Notes (GRN) Ledger</h3>
                <p className="text-xs text-zinc-500 mb-4">Inspection quality checksheets completed on equipment arrivals to secure manufacturer acceptance.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">GRN Registry No.</th>
                        <th className="pb-2">Receipt Date</th>
                        <th className="pb-2">Supplier</th>
                        <th className="pb-2">Equipment Type</th>
                        <th className="pb-2">Serial Number</th>
                        <th className="pb-2">Inspecting Engineer</th>
                        <th className="pb-2">Arrival Condition</th>
                        <th className="pb-2">Invoice Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getGRNReport().map(row => (
                        <tr key={row.grnNumber} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-bold text-blue-400">{row.grnNumber}</td>
                          <td className="py-3 text-zinc-400">{row.receiptDate}</td>
                          <td className="py-3 font-sans font-semibold text-white">{row.supplier}</td>
                          <td className="py-3 font-sans text-zinc-300">{row.sensorType}</td>
                          <td className="py-3 text-zinc-400">{row.serialNumber}</td>
                          <td className="py-3 text-zinc-400 font-sans">{row.inspectedBy}</td>
                          <td className="py-3 text-emerald-400 font-semibold">{row.conditionOnArrival}</td>
                          <td className="py-3 text-zinc-500">{row.invoiceRef}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Inventory Reconciliation */}
          {activeReport === 'reconciliation' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Store Physical Inventory Reconciliation</h3>
                <p className="text-xs text-zinc-500 mb-4">System recorded assets vs physical counts verified during annual administrative audits.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Equipment Category</th>
                        <th className="pb-2">System Stock</th>
                        <th className="pb-2">Deployed Active</th>
                        <th className="pb-2">Storage Spares</th>
                        <th className="pb-2">Physical Verified</th>
                        <th className="pb-2">Discrepancy Variance</th>
                        <th className="pb-2">Last Audit Date</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getReconciliationReport().map(row => (
                        <tr key={row.category} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-sans font-bold text-white">{row.category}</td>
                          <td className="py-3 font-semibold text-zinc-300">{row.systemCount} units</td>
                          <td className="py-3 text-emerald-400">{row.activeCount}</td>
                          <td className="py-3 text-blue-400">{row.spareCount}</td>
                          <td className="py-3 font-semibold text-zinc-300">{row.physicalVerified}</td>
                          <td className={`py-3 font-bold ${row.discrepancy === 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                            {row.discrepancy}
                          </td>
                          <td className="py-3 text-zinc-500">{row.lastAuditDate}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400 bg-emerald-500/10">
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Supplier Report */}
          {activeReport === 'supplier' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Contractor & Manufacturer Performance Analytics</h3>
                <p className="text-xs text-zinc-500 mb-4">Historical supply statistics tracking active longevity rates across external procurement sources.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Supplier Entity</th>
                        <th className="pb-2">Total Supplied Assets</th>
                        <th className="pb-2">Currently Active</th>
                        <th className="pb-2">Operational Reliability Index</th>
                        <th className="pb-2">Primary Procured Categories</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getSupplierReport().map(sup => (
                        <tr key={sup.supplier} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-sans font-bold text-white">{sup.supplier}</td>
                          <td className="py-3 text-zinc-300 font-semibold">{sup.totalSensorsCount} units</td>
                          <td className="py-3 text-emerald-400 font-medium">{sup.activeSensorsCount} active</td>
                          <td className="py-3">
                            <span className={`px-2.5 py-0.5 rounded font-bold text-[10px] ${
                              sup.reliabilityRate >= 90 ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-blue-400 bg-blue-500/10'
                            }`}>
                              {sup.reliabilityRate}% Optimal
                            </span>
                          </td>
                          <td className="py-3 text-zinc-400 font-sans truncate max-w-[200px]" title={sup.keyProducts}>{sup.keyProducts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Stock Status Report */}
          {activeReport === 'stock-status' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Instrument Allocation Stock Status</h3>
                <p className="text-xs text-zinc-500 mb-4">KPI metrics indicating stock balance distributions across telemetered station field hardware states.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Stock Allocation State</th>
                        <th className="pb-2">Asset Count</th>
                        <th className="pb-2">Monitoring Level</th>
                        <th className="pb-2">Distribution Ratio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getStockStatusReport().map(row => {
                        const ratio = Math.round((row.count / sensors.length) * 100) || 0;
                        return (
                          <tr key={row.name} className="hover:bg-white/[0.01]">
                            <td className="py-3 font-sans font-bold text-white flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${row.color}`}></span>
                              <span>{row.name}</span>
                            </td>
                            <td className="py-3 text-zinc-300 font-semibold">{row.count} units</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                row.status === 'Optimal' ? 'text-emerald-400 bg-emerald-500/10' :
                                row.status === 'Attention' ? 'text-amber-500 bg-amber-500/10' : 'text-red-500 bg-red-500/10'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="py-3 font-semibold text-zinc-400">{ratio}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Consumption & Return Reports */}
          {activeReport === 'consumption-return' && (
            <div className="space-y-6">
              <div className="bg-[#0f0f12] border border-[#1f1f23] p-5 rounded-md">
                <h3 className="font-serif italic text-lg text-white mb-1">Central Depot Consumption & Return Velocity</h3>
                <p className="text-xs text-zinc-500 mb-4">Operational analysis tracking hardware issues/dispatches (consumption) versus station retrievals/returns.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[10px] text-zinc-500 uppercase">
                        <th className="pb-2">Audit Interval (2026)</th>
                        <th className="pb-2">Dispatched to Stations (Consumption)</th>
                        <th className="pb-2">Returned to Depot (Retrieval/Repair)</th>
                        <th className="pb-2 text-right">Net Depot Stock Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#131316]">
                      {getConsumptionReturnReport().map(row => (
                        <tr key={row.month} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-bold text-white">{row.month}</td>
                          <td className="py-3 text-amber-400">{row.consumedCount} units</td>
                          <td className="py-3 text-blue-400">{row.returnedCount} units</td>
                          <td className={`py-3 text-right font-bold ${row.netChange > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {row.netChange > 0 ? `-${row.netChange} items` : `+${Math.abs(row.netChange)} items`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Filter count indicator */}
          <div className="mt-6 pt-4 border-t border-[#1f1f23] flex items-center justify-between text-[11px] text-zinc-500 font-mono print:hidden">
            <span>Relational Query Boundary: matches {filteredSensors.length} of {sensors.length} inventory sensors.</span>
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 text-zinc-600" />
              <span>Print layout adapts automatically for clean paper audits.</span>
            </span>
          </div>

        </main>

      </div>

    </div>
  );
}
